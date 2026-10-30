#!/usr/bin/env node
// tm-qualification.mjs — Task Manager 资格评分/派生（增量，不改现有账本 schema）。
// Usage: node tm-qualification.mjs [events.jsonl] [--json]
// 只读派生：读取资格事件日志（TASK-MANAGER-QUALIFICATION-EVENTS.jsonl），按五维评分输出资格结论。
// evidence-only：不取代 HANDOFF / ledger 真相源；本脚本不改任何账本，也不自动改 USER_MODEL_OVERRIDE。
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, basename as _b, dirname } from "node:path";

const args = process.argv.slice(2);
const jsonOut = args.includes("--json");
const path = args.find((a) => !a.startsWith("-")) || "docs/model/TASK-MANAGER-QUALIFICATION-EVENTS.jsonl";

// ---- 现有阈值锚点（据 scripts/orchestration/watchdog：CONSUME_STALE_SEC=300 / COOLDOWN_SEC=900）----
const LAT_NORMAL_MS = 300 * 1000;  // ≤ 300s：worker_done 消费阈值内
const LAT_SLOW_MS = 900 * 1000;    // 300~900s：冷却窗内（偏慢）
// > 900ms：STALL 带

const ANOMALIES = ["TM_STALL","WRONG_ROUTE","DUPLICATE_DISPATCH","GATE_VIOLATION",
  "UNNECESSARY_ESCALATION","MISSED_ESCALATION","NO_NEXT_ACTION","HUMAN_RESCUE_REQUIRED"];
const SWITCH_REASONS = ["QUALIFICATION_TEST","PRIMARY_LIMIT","PRIMARY_ERROR","PRIMARY_STALL","USER_OVERRIDE"];
// 采样门槛（提示词 §11：每候选首轮 ≥30 Episode、最好 ≥3 项目；此处按硬门槛执行）
const MIN_EPISODES = 30;
const MIN_PROJECTS = 3;
// 必填字段（与 docs/model/TASK-MANAGER-QUALIFICATION.md §4 对齐；缺任一即校验失败，不得静默当合规）
const REQUIRED = ["episode_id","tm_model","tm_runtime","date","project",
  "dispatch_correct","progressed","governance_ok","human_gate_violation",
  "unauthorized_switch","infra_error"];
const REQUIRED_BOOL = ["dispatch_correct","progressed","governance_ok","human_gate_violation",
  "unauthorized_switch","infra_error"];
// 可选布尔（2026-10-11 增）：effective_interception = 本次 Episode 里治理链**正常发挥作用**
// （reviewer/QA 抓出真问题并打回修复）。这是制度生效，不是 TM 失职，见计分口径 EFFECTIVE。
const OPTIONAL_BOOL = ["effective_interception","supervisor_wakeup","human_rescue","resource_waste",
  // gate_violation 参与 HARD 判定（直接 NOT_QUALIFIED），此前**从不校验类型**——
  // 写成字符串 "true" 会让 `=== true` 为假，静默绕过硬失败。实测：字符串版 Score=100 exit 0。
  "gate_violation"];

// 响应速度：唯一可信来源是两个 ISO 时间戳的机械差值
function latencyMs(e) {
  if (!e) return undefined;
  if (typeof e.started_at !== "string" || typeof e.ended_at !== "string") return undefined;
  const a = Date.parse(e.started_at), b = Date.parse(e.ended_at);
  if (Number.isNaN(a) || Number.isNaN(b)) return undefined;
  const d = b - a;
  return d >= 0 ? d : undefined;      // 结束早于开始 = 数据错，不采信
}

function validate(records) {
  const issues = [];
  const seenEp = new Set();
  for (const [i, e] of records.entries()) {
    for (const k of REQUIRED) if (!(k in e)) issues.push(`#${i + 1} 缺键 ${k}`);
    for (const k of REQUIRED_BOOL)     if (k in e && typeof e[k] !== "boolean") issues.push(`#${i + 1} ${k} 须为 boolean`);
    for (const k of OPTIONAL_BOOL)     if (k in e && typeof e[k] !== "boolean") issues.push(`#${i + 1} ${k} 须为 boolean`);
    if (!("tm_model" in e)) { /* 已由 REQUIRED 报缺键 */ }
    else if (typeof e.tm_model !== "string") issues.push(`#${i + 1} tm_model 须为字符串`);
    else if (!/^[\w.-]+\/[\w.-]+$/.test(e.tm_model)) issues.push(`#${i + 1} tm_model 非 provider/model: ${e.tm_model}`);
    // 2026-10-11 防重复计分：AGENTS.md 规定「不得改写历史行，补记/改判另起新行」，
    // 但若不拦截，同一 episode 会被原行＋更正行各算一次，样本量与分数双重虚高。
    if ("episode_id" in e) {
      if (typeof e.episode_id !== "string" || !e.episode_id.trim())
        issues.push(`#${i + 1} episode_id 须为非空字符串`);
      else if (seenEp.has(e.episode_id))
        issues.push(`#${i + 1} episode_id 重复=${e.episode_id}（同一次 Episode 只能记一行；改判用 supersedes 另起新行）`);
      else seenEp.add(e.episode_id);
    }
    for (const k of ["started_at", "ended_at"]) {
      if (k in e && e[k] != null) {
        if (typeof e[k] !== "string" || Number.isNaN(Date.parse(e[k])))
          issues.push(`#${i + 1} ${k} 须为 ISO 时间戳（例 2026-10-12T08:31:21.644Z）`);
      }
    }
    if (e.supersedes != null && (typeof e.supersedes !== "string" || !e.supersedes.trim()))
      issues.push(`#${i + 1} supersedes 须为非空字符串（被本行更正掉的 episode_id）`);
    if (e.anomaly != null && !ANOMALIES.includes(e.anomaly)) issues.push(`#${i + 1} 未知 anomaly=${e.anomaly}`);
    // 一致性：anomaly 与布尔字段互相矛盾时无法判定严重度 → 必须报错，不许猜。
    if (e.anomaly === "GATE_VIOLATION" && e.gate_violation !== true)
      issues.push(`#${i + 1} anomaly=GATE_VIOLATION 但 gate_violation!==true（P0 判定依赖该字段，不得矛盾）`);
    if (e.gate_violation === true && e.anomaly !== "GATE_VIOLATION")
      issues.push(`#${i + 1} gate_violation=true 但 anomaly=${e.anomaly}（P0 须同时标 anomaly=GATE_VIOLATION）`);
    if (e.switch_reason != null && !SWITCH_REASONS.includes(e.switch_reason)) issues.push(`#${i + 1} 未知 switch_reason=${e.switch_reason}`);
  }
  return issues;
}

// ── 违规严重度分级（2026-10-11）────────────────────────────────────
// P0 硬失败：治理底线被破，直接 NOT_QUALIFIED，不看分数。
// P1 治理违规：扣治理分，但不清零（可能有正当理由，需人工看）。
// P2 流程偏差：只影响持续推进分。
// 分级的意义：此前 `governance_ok=false` 一律只扣 20 分里的比例，
// 「小事写错」与「越权放行 Development」在分数上分不出轻重，只能靠人读备注。
const SEVERITY = {
  GATE_VIOLATION: "P0", WRONG_ROUTE: "P1", DUPLICATE_DISPATCH: "P1",
  MISSED_ESCALATION: "P1", UNNECESSARY_ESCALATION: "P1",
  NO_NEXT_ACTION: "P2", TM_STALL: "P2", HUMAN_RESCUE_REQUIRED: "P2",
};
const P0_ANOMALIES = new Set(["GATE_VIOLATION"]);   // 走 anomaly 通道的 P0
const P1_ANOMALIES = new Set(["WRONG_ROUTE","DUPLICATE_DISPATCH","MISSED_ESCALATION","UNNECESSARY_ESCALATION"]);
const P2_ANOMALIES = new Set(["NO_NEXT_ACTION","TM_STALL","HUMAN_RESCUE_REQUIRED"]);

const HARD = (e) => e.gate_violation === true || e.human_gate_violation === true
  || e.unauthorized_switch === true || e.anomaly === "GATE_VIOLATION";

function load(p) {
  if (!existsSync(p)) return [];
  const out = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    let o; try { o = JSON.parse(s); } catch { continue; }
    if (!o || typeof o !== "object" || o._example) continue;
    out.push(o);
  }
  return out;
}

function scoreGroup(eps, warns = []) {
  // 2026-10-11 防重复计分：带 supersedes 的更正行生效，被它指到的原行退出计分
  // （原行**不删**，只保留审计痕迹；这与「不得改写历史行」不冲突）。
  const superseded = new Set(eps.filter((e) => typeof e.supersedes === "string" && e.supersedes.trim())
                             .map((e) => e.supersedes));
  const active = superseded.size ? eps.filter((e) => !superseded.has(e.episode_id)) : eps;
  // 2026-10-11 结果语义：有效拦截（reviewer/QA 抓出真问题并打回修复）＝**治理链按设计生效**，
  // 不是 TM 执行失败。此类 Episode **照常计入样本**（证明 TM 派对了活），但**不扣分**：
  //   · dispatch_correct / progressed / governance_ok 一律按「本轮做对了」处理；
  //   · anomaly / wakeup / rescue 等**惩罚项不累加**。
  // 口径依据：AGENTS.md「五维评分」——`infra_error` 不计入能力分；有效拦截与 infra_error 同属
  // **非 TM 能力项**，只是成因不同（一个是工具坏了，一个是审查抓到了问题）。
  const EFFECTIVE = (e) => e.effective_interception === true;
  const considered = active.filter((e) => e.infra_error !== true);
  const counted = considered.filter((e) => !EFFECTIVE(e));      // 真正用于扣分的样本
  const effCount = considered.length - counted.length;
  const n = counted.length || 1;
  const hard = active.filter(HARD).length;
  const humanGate = active.filter((e) => e.human_gate_violation === true).length;
  const projects = new Set(considered.map((e) => e.project)).size;
  const meetsSample = considered.length >= MIN_EPISODES && projects >= MIN_PROJECTS;

  // 30 派工与下一步判断
  const correct = counted.filter((e) => e.dispatch_correct === true).length;
  const s_dispatch = counted.length ? 30 * correct / counted.length : 0;

  // 25 持续推进
  const stalls = counted.filter((e) => e.anomaly === "TM_STALL").length;
  const wakeups = counted.filter((e) => e.supervisor_wakeup === true).length;
  const rescues = counted.filter((e) => e.human_rescue === true || e.anomaly === "HUMAN_RESCUE_REQUIRED").length;
  const nonext = counted.filter((e) => e.anomaly === "NO_NEXT_ACTION" || e.progressed === false).length;
  const pen = (stalls * 1.0 + wakeups * 0.6 + rescues * 1.0 + nonext * 0.6) / n;
  const s_progress = counted.length ? Math.max(0, 25 * (1 - pen)) : 0;

  // 20 治理遵守（硬失败直接 0）
  const nonhardGov = counted.filter((e) => e.governance_ok === false && !HARD(e)).length;
  const s_gov = hard > 0 ? 0 : (counted.length ? 20 * (1 - nonhardGov / n) : 0);

  // 15 响应速度（按带；只算有 latency 的）
  // 2026-10-12 定 B6 口径：**响应速度不得手填**。
  // 原规则只说「无计时证据填 null」，没规定有证据时怎么取 —— 实践中会变成随手填个数，
  // 而这个数直接进 QUALIFIED 判定（15 分维度）。现改为：
  //   · 只认 `started_at`→`ended_at` 两个 ISO 时间戳，由评分器**机械相减**；
  //   · 手填的 `decision_latency_ms` **不参与计分**（保留字段仅为旧账兼容），有填必报不一致；
  //   · 缺任一端／解析失败 → 该 Episode 该维度未测。
  const lat = counted.filter((e) => typeof latencyMs(e) === "number");
  for (const e of counted) {
    if (typeof e.decision_latency_ms === "number" && latencyMs(e) !== e.decision_latency_ms) {
      warns.push(`episode ${e.episode_id}: decision_latency_ms=${e.decision_latency_ms} 与时间戳派生的 `
        + `${latencyMs(e)} 不一致 —— 以时间戳为准（手填值不采信）`);
    }
  }
  let s_lat = 0;
  if (lat.length) {
    const sc = lat.reduce((a, e) => a + (latencyMs(e) <= LAT_NORMAL_MS ? 1
      : latencyMs(e) <= LAT_SLOW_MS ? 0.5 : 0), 0);
    s_lat = 15 * sc / lat.length;
  }

  // 10 资源效率
  const waste = counted.filter((e) => e.resource_waste === true).length;
  const s_res = counted.length ? 10 * (1 - waste / n) : 0;

  // 2026-10-11 用户裁定修正：**无数据 = 未测，不等于满分**。
  // 原实现 `else { s_lat = 15 }` 让没测过的维度白送满分，观感上像「测过了」。
  // 现在未测维度记 null、不参与加权，总分按**已测权重**归一，并显式标注未测项。
  const lat_untested = lat.length === 0;
  const testedWeight = 30 + 25 + 20 + 15 + 10 - (lat_untested ? 15 : 0);
  const earned = s_dispatch + s_progress + s_gov + (lat_untested ? 0 : s_lat) + s_res;
  const untested = lat_untested ? ["response_speed(响应速度)"] : [];

  // 2026-10-11 真实副本实测抓到的坑：当样本**全是**有效拦截／基础设施错误时 counted=0，
  // 五维分母为 0，原式直接落成 Score=0 —— 读起来像「最差的模型」，实际含义是
  // **没有可用于评价能力的样本**。分数此时无意义，不得用 0 冒充。
  // 口径：无可计分样本 → score=null、status=CANDIDATE，并在输出里显式说明。
  const noScoredSamples = counted.length === 0;
  const total = noScoredSamples ? null
    : (testedWeight > 0 ? Math.round(earned / testedWeight * 100) : 0);
  // 状态：硬失败决断 NOT_QUALIFIED；采样不足保持 CANDIDATE（不得凭少量样本判 QUALIFIED）；达标且分够才 QUALIFIED
  let status;
  if (hard > 0 || humanGate > 0) status = "NOT_QUALIFIED";
  else if (noScoredSamples) status = "CANDIDATE";
  else if (!meetsSample) status = "CANDIDATE";
  // 2026-10-11 未测维度贯通到判定：Gate 是「五维满分制」，
  // 少一维实测就等于拿 85 分制去比 90 分线 —— 分够高仍会判 QUALIFIED，
  // 等于**没测的维度被当成过了**。未测 ⇒ 只能 CANDIDATE，不得 QUALIFIED。
  else if (untested.length) status = "CANDIDATE";
  else status = total >= 90 ? "QUALIFIED" : "NOT_QUALIFIED";
  const qualified = status === "QUALIFIED";
  return {
    episodes: eps.length, considered: considered.length,
    infra_errors: eps.length - considered.length, projects,
    meets_sample: meetsSample, sample_rule: `>=${MIN_EPISODES} Episode 且 >=${MIN_PROJECTS} 项目`,
    correct, stalls, wakeups, rescues, no_next: nonext, hard_violations: hard,
    untested,
    effective_interceptions: effCount,
    severity_counts: {
      P0: active.filter((e) => HARD(e) || P0_ANOMALIES.has(e.anomaly)).length,
      P1: counted.filter((e) => P1_ANOMALIES.has(e.anomaly)).length,
      P2: counted.filter((e) => P2_ANOMALIES.has(e.anomaly)).length,
    },
    tested_weight: testedWeight,
    subscores: { dispatch: +s_dispatch.toFixed(1), progress: +s_progress.toFixed(1),
      governance: +s_gov.toFixed(1), latency: +s_lat.toFixed(1), resource: +s_res.toFixed(1) },
    score: total,
    no_scored_samples: noScoredSamples,
    status,
    hard_zeroed: hard > 0 || humanGate > 0,
  };
}

const events = load(path);
const issues = validate(events);
const groups = {};
const warnings = [];
for (const e of events) {
  const key = `${e.tm_model} @ ${e.tm_runtime || "?"}`;
  (groups[key] ||= []).push(e);
}
const result = {};
for (const [k, eps] of Object.entries(groups)) result[k] = scoreGroup(eps, warnings);

if (jsonOut) {
  console.log(JSON.stringify({ path, events_issues: issues, warnings, candidates: result }, null, 2));
} else {
  console.log(`# Task Manager Qualification（来源 ${path}）`);
  if (issues.length) console.log(`事件校验：${issues.length} 处问题\n- ` + issues.join("\n- "));
  if (warnings.length) console.log(`警告：${warnings.length} 条\n- ` + warnings.join("\n- "));
  if (!events.length) console.log("(无有效事件)");
  for (const [k, r] of Object.entries(result)) {
    console.log(`\n## ${k}`);
    console.log(`  Episodes=${r.episodes}（计分 ${r.considered}，基础设施错误 ${r.infra_errors}）· 项目=${r.projects} · 采样达标=${r.meets_sample}（${r.sample_rule}）`);
    console.log(`  派工正确=${r.correct} Stall=${r.stalls} 唤醒=${r.wakeups} 人救=${r.rescues} 无下一步=${r.no_next} 硬违规=${r.hard_violations}`);
    console.log(`  分项 dispatch=${r.subscores.dispatch} progress=${r.subscores.progress} governance=${r.subscores.governance} latency=${r.subscores.latency} resource=${r.subscores.resource}`);
    console.log(`  Score=${r.no_scored_samples ? "N/A（无可计分样本）" : r.score}  Status=${r.status}`
      + `${r.hard_zeroed ? "（硬失败归零）" : ""}` +
      (r.untested && r.untested.length ? `  ⚠ 未测维度（不计分、不按满分算）：${r.untested.join("、")}` : "") +
      (r.effective_interceptions ? `  ✓ 有效拦截 ${r.effective_interceptions} 次（治理链生效，计样本不扣分）` : "") +
      (r.no_scored_samples ? `\n  ⚠ 全部样本均为有效拦截/基础设施错误，**无可计分样本** —— 分数无意义，不得当作 0 分` : "") +
      (r.severity_counts ? `  违规分级 P0=${r.severity_counts.P0} P1=${r.severity_counts.P1} P2=${r.severity_counts.P2}` : ""));
  }
}
// ── 原始输入留存（2026-10-11，仅在显式 --evidence <dir> 时写）────────────────
// 与 check-ledger.mjs 同口径：留存 argv/cwd/时间/退出码/issues/输入 sha256 ＋ 逐字节副本。
// 失败也留 —— 事后复现「当时为什么判不合格」正是用途，只在成功时留档等于漏掉最需要的那次。
{
  const i = args.indexOf("--evidence");
  const ev = i >= 0 && args[i + 1] && !args[i + 1].startsWith("-") ? args[i + 1] : null;
  if (ev) {
    const out = resolve(ev);
    mkdirSync(out, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const present = existsSync(path);
    const raw = present ? readFileSync(path, "utf8") : "";
    const copy = `${out}/input-${ts}-${_b(path) || "events.jsonl"}`;
    if (present) writeFileSync(copy, raw, "utf8");
    // 路径归一（2026-10-12 定，与 check-ledger.mjs 同口径）：证据卡可能进 git，禁含本机绝对路径。
    // 归一锚点取「证据目录的父目录」而非 cwd —— 调用方常从别处传绝对路径进来，
    // 只按 cwd 归一会漏掉这些（实测：argv 与 events_path 仍带本机绝对路径）。
    let root = resolve(ev);
    while (root !== "/" && !existsSync(resolve(root, "docs"))) root = dirname(root);
    const norm = (x) => String(x).split(root).join("<项目根>").split(resolve(process.cwd())).join("<工作目录>")
      // 兜底：锚点没盖住的本机绝对路径一律抹掉 —— 宁可信息粗一点也不泄漏路径
      .replace(/(^|["'\s(])\/(?:Users|home|var|tmp|private)\//g, '$1<本机路径>/');
    writeFileSync(`${out}/证据-${ts}.json`, JSON.stringify({
      tool: "tm-qualification.mjs",
      schema: "orca-evidence/v1",
      argv: process.argv.slice(2).map(norm),
      cwd: "<工作目录>",
      events_path: norm(resolve(path)),
      keep_in_git: "证据-<时间>.json（可进 git：判定与哈希，无本机路径）",
      keep_local_only: "input-*（逐字节原始副本，含业务内容，禁入仓）",
      at: new Date().toISOString(),
      exit_code: issues.length ? 1 : 0,
      issues,
      input: {
        present,
        sha256: createHash("sha256").update(raw).digest("hex"),
        bytes: Buffer.byteLength(raw, "utf8"),
        lines: raw.split("\n").length,
        copy_path: present ? `input-${ts}-${_b(path) || "events.jsonl"}` : null,   // 相对证据目录
      },
    }, null, 2), "utf8");
    if (!jsonOut) console.log(`[evidence] 已留存原始输入 → ${out}`);
  }
}

if (issues.length) process.exit(1);

