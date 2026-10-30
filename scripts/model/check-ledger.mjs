#!/usr/bin/env node
// check-ledger.mjs — 账本合法性校验（TASK-MODEL-LOG / DISPATCH-LOG）。
// Usage: node check-ledger.mjs [dir] -> exit 0 合法 / exit 1 列出问题
// 分级：结构/枚举错误 = FAIL（exit 1）；写法不规范 = WARN（不影响 exit，供 supervisor 抽查）。
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 参数解析（2026-10-09 修 P1-1）：旧写法取 argv[2]，导致只传开关
// （`node check-ledger.mjs --allow-example`）把 "--allow-example" 当成目录 → 报
// 一堆 MISSING，误导排查。现改为：取第一个不以 - 开头的参数作 dir，其余作开关。
const argv = process.argv.slice(2);
const dir = argv.find((a) => !a.startsWith("-")) || "docs/model";
// --allow-example（2026-10-08）：仅供**母版/分发包自检**——模板包带 `_example` 空壳，
// 直接跑必然 exit 1。真实项目禁用此开关，否则「示例行未删」失去强制力。
const ALLOW_EXAMPLE = process.argv.includes("--allow-example");
// --evidence <dir>（2026-10-11）：留存**本次校验的原始输入副本**。
// 为什么需要：账本校验是唯一的事后裁决点，但此前不留存输入 —— 日后想复现「当时为什么报错」
// 已经不可能（账本被改过、或文件已删）。留存内容：argv、cwd、时间、退出码、fails/warns 全量、
// 以及两个账本的**逐字节副本 + sha256**。
// 口径：**显式开关，不自动写**（避免每次校验在项目里堆文件）；落盘目录由调用方指定。
const EVIDENCE_DIR = (() => {
  const i = argv.indexOf("--evidence");
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("-") ? argv[i + 1] : null;
})();
const fails = [];
const NUMERIC_OPTIONAL = ["cost_cny", "elapsed_sec"];   // 见下方校验
const warns = [];

// model 精确写法白名单
const MODEL_PROVIDERS = [
  "codebuddy/", "codex/", "opencode/", "opencode-go/", "opencode-free/",
  "volcengine-plan/", "radeon-mimo/",
];
// 已知合法模型全串（来自 USER_MODEL_OVERRIDE；不在表内但前缀合法的记 WARN，提醒更新）
const KNOWN_MODELS = [
  "codebuddy/deepseek-v4.1-flash", "codebuddy/glm-5.3-flash",
  "codebuddy/deepseek-v4-pro", // 2026-10-07 产品审查双审链审查 B（约定节，非主表行）
  "codex/gpt-6-sol", "codex/gpt-6.1-sol", "codex/gpt-6.1-terra", "codex/gpt-6-luna", "codex/gpt-5.6-luna",
  "codex/gpt-5.6-terra", "codex/gpt-5.6-sol",
  "opencode/muse-spark-1.3-contributor-free", "opencode/muse-spark-1.3-contributor",
  "opencode/mimo-v2.5-free",
  "opencode-go/muse-spark-1.3-contributor", "opencode-go/deepseek-v4.1-flash",
  "opencode-go/glm-5.3-flash", "opencode-go/space-bunny-free",
  "opencode-free/mimo-v2.5-free", "opencode-free/muse-spark-1.3-contributor-free",
  "volcengine-plan/ark-code-latest",
  "radeon-mimo/MiMo-V2.6-Flash",
];
// 特殊合法写法（非 provider/model，但属规范内的“非模型”记录）
const MODEL_SPECIAL = ["本窗口", "本窗口直驱", "本窗口Agent子代理", "—"];
const MODEL_UNRECORDED = /未派|未记录|未报|unknown/i;

function checkModel(file, ln, d) {
  const m = d.model;
  if (m === null || m === "" || m === undefined) {
    warns.push(`${file}#${ln}: WARN model 为空（须 provider/model 精确写法）`);
    return;
  }
  if (typeof m !== "string") { fails.push(`${file}#${ln}: model 非字符串`); return; }
  if (MODEL_SPECIAL.includes(m)) return;
  if (MODEL_UNRECORDED.test(m)) { warns.push(`${file}#${ln}: WARN unrecorded model="${m}"`); return; }
  if (!MODEL_PROVIDERS.some((p) => m.startsWith(p))) {
    warns.push(`${file}#${ln}: WARN bad model="${m}" (须 provider/model 精确写法，见白名单)`);
    return;
  }
  // 前缀合法：再核是否在已知模型全串内
  if (!KNOWN_MODELS.includes(m)) {
    warns.push(`${file}#${ln}: WARN unknown model="${m}" (前缀合法但不在已知表，请核 USER_MODEL_OVERRIDE)`);
  }
}

const CHAIN_STATUS = ["DELIVERED", "ACCEPTED", "OPEN"];
const ROLES = ["task-manager", "supervisor", "planner", "builder", "code-reviewer", "qa",
  "product-reviewer", "experience-recorder", "neat-freak", "senior-expert", "db-admin",
  "迁移整理工", "orchestrator"];
// 执行通道枚举（2026-10-11 补齐）：来源＝AGENTS.md「逐派记录」条列出的取值。
// 与 docs/roles/supervisor.md 的内联校验块同源，本处为唯一校验实现，supervisor 应复用本脚本。
const RUNTIMES = ["本窗口", "当前客户端窗口（自动探测）", "codebuddy", "codex",
  "opencode", "Claude Code", "—"];

// 2026-10-11 补齐的类型/可空性校验。
// 背景（复评 + 审查双轮实测）：此前仅校验必需键存在与少数枚举，且枚举检查 `d[k] !== null`
// 会让 null 整体绕过；date/role/used/runtime/数值类型零校验。构造反例
// date="乱写"/role="不存在角色"/used="备用"/runtime="不存在的通道"/result=null/
// used=null/used=""/rework=-1/rework=null/rework="两次" 全部 exit 0 通过。
// 本节按字段分别定义「必需键 / 类型 / 可空性 / 合法取值」，覆盖缺键、null、空串、错误类型。
const fieldRules = {
  date: {
    kind: "string",
    nullable: false,
    validate(v) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
      if (!m) return "bad date(须 YYYY-MM-DD)";
      const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
      const dt = new Date(Date.UTC(y, mo - 1, d));
      // 真实日历校验：拒绝 2026-02-30 这类正则能过但日历不存在的日期（不自动归一化）
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d)
        return "bad date(非真实日历日期)";
      return null;
    },
  },
  role: { kind: "string", nullable: false, enum: ROLES, enumLabel: "role" },
  result: { kind: "string", nullable: false, enum: ["PASS", "FAIL"], enumLabel: "result" },
  // used：维持现行「恒填主」语义（切备用仍填主，原因记 note）。语义一字不改。
  used: { kind: "string", nullable: false, enum: ["主"], enumLabel: "used" },
  runtime: { kind: "string", nullable: false, enum: RUNTIMES, enumLabel: "runtime" },
  // rework：返工**计数**，不允许 null/负数/非整数（审查 2026-10-11 指出不得照 tokens/cost 一并放 null）
  rework: { kind: "int", nullable: false, min: 0 },
  // elapsed_sec：**单次派工的实际耗时秒数**（2026-10-16 增，用于模型提速的可测量对比）。
  // 动机：账本原本只记「谁做了什么、结果如何」，**一个字不记花了多久** ⇒ 换模型后
  // 无法回答「到底快了多少」。实测 1692 行历史账里耗时字段 0、tokens 仅 35 行有值、
  // cost_cny 0 行 —— 不是统计方法问题，是从未采集。
  // 口径：可选字段，**拿不到就填 null，不许编**；填了必须是有限正数。
  // 采集方式：派工前后各记一次时间戳，差值写入本字段（由派工方在收工时计算）。
  elapsed_sec: { kind: "num", nullable: true, min: 0 },
  // tokens/cost：允许 null（拿不到填 null），有值时校验类型与范围
  tokens: { kind: "int", nullable: true, min: 0 },
  cost_cny: { kind: "number", nullable: true, min: 0 },
  escalated: { kind: "string", nullable: false, enum: ["YES", "NO"], enumLabel: "escalated" },
};

// ── 历史兼容：**已按 2026-10-11 用户决策整体移除** ────────────────────
//
// 用户裁定：「以前的不管，以后的为准。」
// 旧做法是给存量历史行开一份豁免白名单（逐行授权 + 来源绑定 + 审批门 + 物理行号 +
// 行内容哈希 + 字段粒度，共十道防线）。用户决定**不开这个后门**：
//   · 母版不再有 scripts/model/ledger-legacy-baseline.json；
//   · checkFields 中不再有任何「降级为 WARN」的路径——所有字段错误一律 FAIL；
//   · used / runtime / rework 的历史写法**同样按现行规则判错**，需由各项目自行修正。
// 保留原则（未变）：不动任何真实账本。存量项目的历史行由**项目自己**决定何时改。


function checkFields(file, physicalLineNo, d) {
  // 2026-10-11 用户裁定「以前的不管，以后的为准」：**不再有任何降级路径**，
  // 所有字段错误一律 FAIL。存量历史行同样按现行规则判错，由项目自行修正。
  const push = (field, value, msg) => fails.push(`${file}#${physicalLineNo}: ${msg}`);
  for (const [key, r] of Object.entries(fieldRules)) {
    if (!(key in d)) continue;                      // 缺键由必需键检查负责
    const v = d[key];
    if (v === null || v === undefined) {
      if (r.nullable) continue;                     // 允许 null（如 tokens/cost 拿不到）
      push(key, v, `bad ${key}=null（必填，不可为 null）`);
      continue;
    }
    if (r.kind === "string" && typeof v !== "string") {
      push(key, v, `bad ${key}=${JSON.stringify(v)}（须字符串）`); continue;
    }
    if (r.kind === "string" && v === "") { push(key, v, `bad ${key}=（空串）`); continue; }
    // 布尔不是合法数值（typeof true === "boolean"，此处显式排除）
    if ((r.kind === "int" || r.kind === "number") && typeof v === "boolean") {
      push(key, v, `bad ${key}=${JSON.stringify(v)}（布尔非合法数值）`); continue;
    }
    if (r.kind === "int") {
      // 整数：须有限 + 整数 + 安全整数（防 1e309→Infinity 与超 2^53 精度丢失）
      if (typeof v !== "number" || !Number.isFinite(v)) {
        const shown = (typeof v === "number" && !Number.isFinite(v)) ? String(v) : JSON.stringify(v);
        push(key, v, `bad ${key}=${shown}（须有限整数${r.nullable ? "或 null" : ""}）`); continue;
      }
      if (!Number.isInteger(v)) {
        push(key, v, `bad ${key}=${JSON.stringify(v)}（须整数${r.nullable ? "或 null" : ""}）`); continue;
      }
      if (!Number.isSafeInteger(v)) {
        push(key, v, `bad ${key}=${v}（超出安全整数范围）`); continue;
      }
    }
    if (r.kind === "number") {
      // 金额等一般数值：须有限 + 非负（1e309 会被 JSON 解析成 Infinity，必须显式拒）
      if (typeof v !== "number" || !Number.isFinite(v)) {
        // Infinity/NaN 经 JSON.stringify 会显示为 null，直接打印易误判，此处显式还原
        const shown = (typeof v === "number" && !Number.isFinite(v)) ? String(v) : JSON.stringify(v);
        push(key, v, `bad ${key}=${shown}（须有限数值${r.nullable ? "或 null" : ""}）`); continue;
      }
    }
    if (r.kind === "int" || r.kind === "number") {
      if (typeof v === "number" && r.min !== undefined && v < r.min) {
        push(key, v, `bad ${key}=${v}（须 ≥ ${r.min}）`); continue;
      }
    }
    if (r.enum && !r.enum.includes(v)) {
      push(key, v, `bad ${r.enumLabel}=${JSON.stringify(v)}（合法取值：${r.enum.join(" / ")}）`);
      continue;
    }
    if (r.validate) {                                // 自定义校验（如真实日历日期）
      const msg = r.validate(v);
      if (msg) push(key, v, msg);
    }
  }
}

// 基线须在任何 check() 之前载入（否则首轮豁免查不到条目）
function check(file, need, enums, evidence) {
  const p = join(dir, file);
  if (!existsSync(p)) { fails.push(`${file}: MISSING`); return; }
  const raw = readFileSync(p, "utf8");
  const projectRoot = dirname(dirname(dir));              // <proj>
  const projectName = basename(projectRoot);              // 项目目录名
  // **物理行号**（审查要求）：按 \n 切分后不过滤空行，下标即原文件行号。
  // 空行占位不跳号 —— 否则「过滤后下标」会与清单里的 line_no 错位。
  const physical = raw.split("\n");
  let n = 0;
  for (let i = 0; i < physical.length; i++) {
    const l = physical[i];
    if (!l.trim()) continue;                        // 空行不校验，但**占位**（i 不推进）
    const ln = i + 1;                               // 物理行号（1-based）
    let d;
    try { d = JSON.parse(l); } catch { fails.push(`${file}#${ln}: BAD_JSON`); continue; }
    if (d === null || typeof d !== "object" || Array.isArray(d)) { fails.push(`${file}#${ln}: NOT_OBJECT`); continue; }
    if (d._example === true) continue;
    n++;
    for (const k of need) if (!(k in d)) fails.push(`${file}#${ln}: missing ${k}`);
    // 结构/结果类硬错误：既有枚举检查，**永不可历史豁免**
    // 可选数值字段的真实性校验（2026-10-16 补）。
    // 背景：SPEC 里给 cost_cny / elapsed_sec 写了 min:0，但 SPEC 的 min 只在少数路径生效，
    // 实测 `elapsed_sec: -5` 与 `cost_cny: "abc"` **都能放行** —— 数值字段实际无校验，
    // 与 rework 那种「类型+值都硬拦」不一致。此处显式补齐，缺失/非数值即报错。
    for (const k of NUMERIC_OPTIONAL) {
      if (!(k in d) || d[k] === null) continue;      // 可选；缺失或 null 合法
      const v = d[k];
      if (typeof v !== "number" || !Number.isFinite(v)) {
        fails.push(`${file}#${ln}: bad ${k}=${JSON.stringify(v)}（须为有限数值或 null；拿不到就填 null，不许编）`);
      } else if (v < 0) {
        fails.push(`${file}#${ln}: bad ${k}=${v}（须 ≥ 0）`);
      }
    }
    for (const [k, vs] of Object.entries(enums)) {
      if (k in d && d[k] !== null && !vs.includes(d[k])) fails.push(`${file}#${ln}: bad ${k}=${d[k]}`);
    }
    checkFields(file, ln, d);   // ln 即物理行号
    checkModel(file, ln, d);
    if ("executed_by" in d && d.executed_by !== null && !ROLES.includes(d.executed_by)) {
      fails.push(`${file}#${ln}: bad executed_by=${d.executed_by}`);
    }
    if ("chain_status" in d && d.chain_status !== null && !CHAIN_STATUS.includes(d.chain_status)) {
      fails.push(`${file}#${ln}: bad chain_status=${d.chain_status}`);
    }
    // 证据质量（仅 TASK 账；启发式、advisory）：result=PASS 但备注含未闭环字样且未标 OPEN → WARN
    if (evidence && d.result === "PASS" && typeof d.note === "string"
        && /待评审|待复验|待验证|未验证|产品阻塞|待用户验收|未闭环|未完成/.test(d.note)
        && d.chain_status !== "OPEN") {
      warns.push(`${file}#${ln}: WARN result=PASS 但备注含未闭环字样，建议 chain_status=OPEN`);
    }
  }
  const nex = physical.filter((l) => { if (!l.trim()) return false; try { return JSON.parse(l)._example === true; } catch { return false; } }).length;
  if (n === 0 && nex > 0) {
    const m = `${file}: _example 行未删（首个真实任务前删除示例行）`;
    if (ALLOW_EXAMPLE) warns.push(`[--allow-example] ${m}`); else fails.push(m);
  } else if (n === 0) warns.push(`${file}: 空账本（首个真实任务/派工前正常）`);
  if (n > 0 && nex > 0) {
    const m = `${file}: ${nex} _example rows mixed with ${n} real rows (示例行必须在首个真实任务前删除)`;
    if (ALLOW_EXAMPLE) warns.push(`[--allow-example] ${m}`); else fails.push(m);
  }
}
check("TASK-MODEL-LOG.jsonl",
  ["task", "project", "date", "role", "model", "result", "rework", "escalated", "escalation_reason", "tokens", "cost_cny"],
  { result: ["PASS", "FAIL"], escalated: ["YES", "NO"] }, true);
check("DISPATCH-LOG.jsonl",
  ["date", "task", "role", "model", "used", "runtime", "result"],
  { result: ["PASS", "FAIL"] });

// ── 升级触发校验（2026-10-11 增：把「两次打回自动升 senior」从文字变成机器检查）────
// 规则（AGENTS.md「升级」节）：计数单元＝同一 task id；只数 supervisor 判 FAIL/打回该 Task 的次数；
// 累计 2 次即应 escalated=YES。升级是**自动动作**，故漏记即为治理违规（不是提醒）。
// 同时校验 escalation_reason：标了升级却没写原因 → 无法审计。
{
  const supFail = new Map();   // task -> supervisor 判 FAIL 次数
  for (const d of readRows("DISPATCH-LOG.jsonl")) {
    if (d.role === "supervisor" && d.result === "FAIL" && typeof d.task === "string") {
      supFail.set(d.task, (supFail.get(d.task) || 0) + 1);
    }
  }
  const taskRows = readRows("TASK-MODEL-LOG.jsonl");

  // 派工漏记检查（2026-10-14 体系自查 P0 加固）：AGENTS.md 要求「逐派记录，每次派工收工
  // 编排者往 DISPATCH-LOG 记一行」，但此前**无任何交叉检查** ⇒ 漏记完全不可见。
  // 实测：015-ing-photo-library TASK 13 行 / DISPATCH 0 行，只报 WARN「空账本」即放行；
  //       038 项目 task-manager 自身派工记录仅 6/38 —— **记账纪律在记账人身上最先崩**。
  // 口径（刻意保守，避免误伤）：
  //   ① 有真实任务记录但 DISPATCH **完全为空** ⇒ FAIL（无任何派工痕迹，不可能合规）；
  //   ② 派工行数显著少于任务行数（< 1/3 且任务 ≥3 行）⇒ WARN，提示逐派记录未落实；
  //   ③ 单智能体项目不造派工行属预期，故只在「有任务且零派工」时才硬拦。
  {
    const taskReal = taskRows.length;
    const dispatchReal = readRows("DISPATCH-LOG.jsonl").length;
    // 豁免通道：单智能体项目按 AGENTS.md「不造派工行」。但**必须有机读声明**，
    // 否则「忘了记」和「本就不记」无法区分 ⇒ 豁免会变成新的后门。
    // 声明落 `docs/model/GOVERNANCE-STATE.json` 的 `execution_mode`（`solo` / `multi`）。
    const soloDeclared = (() => {
      const sp = join(dir, "GOVERNANCE-STATE.json");
      if (!existsSync(sp)) return false;
      try {
        const g = JSON.parse(readFileSync(sp, "utf8"));
        return g.execution_mode === "solo";
      } catch { return false; }
    })();
    if (taskReal > 0 && dispatchReal === 0 && !soloDeclared) {
      fails.push(`DISPATCH-LOG.jsonl: 空账本，但 TASK-MODEL-LOG.jsonl 已有 ${taskReal} 条真实任务记录 `
        + `⇒ 派工逐派漏记。按 AGENTS.md「每次派工收工记一行」，零派工记录不可能合规。`
        + `（若是单智能体项目，在 docs/model/GOVERNANCE-STATE.json 写 "execution_mode": "solo" 即可豁免 —— `
        + `须显式声明，不靠猜，避免「忘了记」与「本就不记」混同）`);
    } else if (taskReal >= 3 && dispatchReal > 0 && dispatchReal * 3 < taskReal && !soloDeclared) {
      warns.push(`DISPATCH-LOG.jsonl: 派工 ${dispatchReal} 行 vs 任务 ${taskReal} 行 `
        + `（<1/3）⇒ 逐派记录可能未落实，请核对（返工子任务不另计派工行，故非硬错）`);
    }
  }
  // 同一 task 可能有多行（先记 FAIL，再补记 senior 交付）——
  // 升级判定看**该 task 是否已有任一行标了 escalated=YES**，而不是逐行判。
  // 2026-10-11 实测：升级后另起新行记录，若按行判会对着旧的 FAIL 行继续报「漏记升级」，
  // 逼人反复补行 —— 误报比漏报更糟（会让人去改已经正确的记录）。
  const escalatedTasks = new Set(taskRows.filter((t) => t.escalated === "YES")
    .map((t) => t.task));
  for (const t of taskRows) {
    if (typeof t.task !== "string") continue;
    const hits = supFail.get(t.task) || 0;
    if (hits >= 2 && t.escalated !== "YES" && !escalatedTasks.has(t.task)) {
      fails.push(`TASK-MODEL-LOG.jsonl: task="${t.task}" 被 supervisor 打回 ${hits} 次（≥2）但全无 escalated=YES 的记录；`
        + `按 AGENTS.md 升级节应自动升 senior-expert，升级是自动动作，不得漏记`
        + `（若已另行记录升级行，本条不报）`);
    }
    if (t.escalated === "YES"
        && (t.escalation_reason === null || !String(t.escalation_reason || "").trim())) {
      fails.push(`TASK-MODEL-LOG.jsonl: task="${t.task}" escalated=YES 但 escalation_reason 为空（升级须可审计）`);
    }
  }
}

// ── 产品验收红线（2026-10-14 体系自查 P1 加固）──────────────────────────
// AGENTS.md 红线：「产品验收未落盘或关键 AC 未测，不得报完工/收工」。
// 此前**只有文字、无任何机器卡点** ⇒ 实测：AC 矩阵里写「未测」+ 账本
// chain_status=ACCEPTED，校验器照样 `LEDGER-OK` exit 0 放行。
// ⇒ 红线形同虚设，是典型的「有体系但没法落实」。现补：
//   ① 账本出现 chain_status=ACCEPTED（= 已验收放行）时，验收矩阵**必须存在**；
//   ② 矩阵内不得残留 `未测`／`OPEN`（OPEN/FAIL/BLOCKED 均视为未闭环）；
//   ③ 首次发布类型的交付另由签收规则把关（此处只查 AC 是否闭环）。
// 口径说明：`BLOCKED` 是「被外部条件挡住」，仍属未闭环，故一并拦住——
// 报完工的前提是「已验收」，被挡住就不能算已验收。
// ── 两账本交叉校验（2026-10-17 补，来自项目编排者的实跑发现）────────────
// 背景：TASK-MODEL-LOG 与 DISPATCH-LOG 是**两本手写账**，字段多、每笔 5 行，
// 迟早会漂 —— supervisor 在某个项目就抓到过「DISPATCH 记 4 行、TASK 记 4 行，
// 但有 3 条 TASK 行缺 chain_status」这类不一致。
// 为什么**不做**「TASK 由 DISPATCH 派生」：DISPATCH 没有 rework / cost_cny / chain_status
// 等字段，且存量账本无法迁移 —— 派生等于废掉一半字段或重写历史（触碰实绩铁律）。
// 折中且有效：**机器逐笔对账**。同一 task 在两本账里的 role/result 必须一致，
// 且 DISPATCH 的每一条真实行都要能在 TASK 找到对应行。
{
  const tByKey = new Map();      // task\0role -> row
  const tByTask = new Map();     // task       -> Set(role)
  // 更正行索引（2026-10-17）：铁律是「历史实绩禁重写」，所以旧账的漂移**不能靠改旧行解决**，
  // 合法出路是**另起更正行**。没有这条出路，新门会把每个有旧漂移的老项目从今往后每次 commit
  // 都拦一遍（043 实测：T18-041/supervisor dispatch=FAIL vs task=PASS，铺包后 exit 1）——
  // 拦的是历史账、不是本轮新错，那就是新造的阻塞源。
  // 因此：命中「更正/校正/以…为准」更正的 task，其漂移降为提示；**没有更正的照旧 FAIL**。
  const corrected = new Set();
  for (const d of [...readRows("TASK-MODEL-LOG.jsonl"), ...readRows("DISPATCH-LOG.jsonl")]) {
    const note = String(d.note || "");
    if (/更正|校正|以.{0,20}为准|supersedes/i.test(note)) corrected.add(d.task);
  }
  for (const d of readRows("TASK-MODEL-LOG.jsonl")) {
    tByKey.set(`${d.task}\u0000${d.role}`, d);
    if (!tByTask.has(d.task)) tByTask.set(d.task, new Set());
    tByTask.get(d.task).add(d.role);
  }
  let mismatch = 0, roleDiff = 0, orphan = 0, checked = 0, fixed = 0;
  const detail = [];
  for (const d of readRows("DISPATCH-LOG.jsonl")) {
    const t = tByKey.get(`${d.task}\u0000${d.role}`);
    if (!t) {
      // 分两类，否则会把「角色口径差异」误判成「整条派工漏记」：
      //   task 在账里有、只是 role 不同 => 口径不一致（WARN）
      //   task 压根不在账里           => 真·漏记（比例过半则 FAIL）
      if (tByTask.has(d.task)) { roleDiff++; } else { orphan++; }
      continue;
    }
    checked++;
    if (d.result && t.result && d.result !== t.result) {
      if (corrected.has(d.task)) {
        fixed++;
        if (detail.length < 5) detail.push(`${d.task}/${d.role}: dispatch=${d.result} vs task=${t.result}（已有更正行，放行）`);
      } else {
        mismatch++;
        if (detail.length < 5) detail.push(`${d.task}/${d.role}: dispatch=${d.result} vs task=${t.result}`);
      }
    }
  }
  if (mismatch) {
    fails.push(`LEDGER-XREF: 同一任务在两本账的 result 不一致（${mismatch} 处）—— 两账手写必漂：`
      + `${detail.join("；")}。`
      + `**若是历史遗留**（禁重写实绩）：在任一账本为该 task 另起一行更正（note 写明「更正：以 X 为准」），`
      + `本条即降为提示；本轮新写错的不许靠更正绕过`);
  }
  if (fixed) {
    warns.push(`LEDGER-XREF: ${fixed} 处 result 漂移已由更正行覆盖（只报）`);
  }
  if (orphan) {
    const total = checked + orphan + roleDiff;
    const ratio = total > 0 ? orphan / total : 0;
    if (ratio > 0.5) {
      fails.push(`LEDGER-XREF: DISPATCH 有 ${orphan} 条 task 在 TASK-MODEL-LOG 整条不存在`
        + `（占全部 ${Math.round(ratio * 100)}%）—— 任务账漏记整条派工，比例过半不得放行。`
        + `若实为 task id 拼写不一致，改齐后重跑`);
    } else {
      warns.push(`LEDGER-XREF: DISPATCH 有 ${orphan} 条 task 在 TASK-MODEL-LOG 整条不存在`
        + `（占 ${Math.round(ratio * 100)}%，未过半，只报）`);
    }
  }
  if (roleDiff) {
    warns.push(`LEDGER-XREF: DISPATCH 有 ${roleDiff} 条的 role 与 TASK 同 task 的角色集合不一致`
      + `（口径差异，只报；同 task 的 result 已另行对账）`);
  }
}

// ── 收工口径反转 + 签收把关（2026-10-17 补）────────────────────────
// 背景（自查实证）：原逻辑只在「账本已经写了 chain_status=ACCEPTED」时才查验收矩阵，
// 于是**不宣布验收＝一次都不查**，全程 DELIVERED 的项目照样报完工 —— 红线形同虚设。
// 现两条补齐：
//   ① 有 QA 交付行、却没有任何 ACCEPTED / OPEN 收尾行 ⇒ 判 ACCEPTED-MISSING（角色交付≠已验收，
//      必须显式落在 ACCEPTED 或 OPEN，否则不得收工）；单智能体项目（execution_mode=solo）豁免。
//   ② ACCEPTED 且矩阵声明「发布类型：首次发布」⇒ 矩阵内必须有显式用户签收记录，
//      否则 SIGNOFF-MISSING（首次发布未签收不得完工）。
{
  const rows = readRows("TASK-MODEL-LOG.jsonl");
  const qaRows = rows.filter((d) => d.role === "qa" || d.role === "senior-expert");
  const closed = rows.filter((d) => d.chain_status === "ACCEPTED" || d.chain_status === "OPEN");
  const acceptedRows = rows.filter((d) => d.chain_status === "ACCEPTED");
  let soloMode = false;
  const gs = join(dir, "GOVERNANCE-STATE.json");
  if (existsSync(gs)) {
    try { soloMode = String((JSON.parse(readFileSync(gs, "utf8")) || {}).execution_mode) === "solo"; }
    catch { /* 坏 JSON 不豁免 */ }
  }
  const openRows = rows.filter((d) => d.chain_status === "OPEN");
  if (openRows.length) {
    warns.push(`ACCEPTED-OPEN（不拦截）— 有 ${openRows.length} 行 chain_status=OPEN（角色已交付但未验收）。`
      + `收工前应落到 ACCEPTED；长期停留 OPEN 表示该交付单元始终未闭环。`);
  }
  if (!soloMode && qaRows.length && !closed.length) {
    fails.push(`ACCEPTED-MISSING: 账本有 ${qaRows.length} 行 qa/senior 交付，但没有任何收尾行`
      + `（chain_status=ACCEPTED 已验收 / OPEN 未完）—— 角色交付 ≠ 已验收。`
      + `报完工前必须显式落ACCEPTED 或 OPEN（单智能体项目写 docs/model/GOVERNANCE-STATE.json `
      + `"execution_mode":"solo" 可豁免本条）`);
  }
  const mp0 = join(dirname(dir), "qa", "产品验收追踪矩阵.md");
  if (acceptedRows.length && existsSync(mp0)) {
    const txt0 = readFileSync(mp0, "utf8");
    // 首发/首版/首次发布 都算首次发布 —— 口径不能靠改两个字绕开
    const firstRelease = /发布类型\s*[：:]\s*\**\s*(首次发布|首发|首版|首次上线|首发版)/.test(txt0);
    // 2026-10-17 修：原正则 `(已签收|通过|已通过)` 会被「用户签收：通过率 100%，功能验收良好」
    // 这类句子骗过（实测放行）。现在要求**整行就是一个签收结论**，且必须带日期。
    const signed = /^\s*[-*|]?\s*用户签收\s*[：:]\s*\**\s*(已签收|已通过|通过)\s*\**\s*[（(]?\s*20\d{2}-\d{2}-\d{2}\s*[）)]?\s*$/m.test(txt0);
    if (firstRelease && !signed) {
      fails.push(`SIGNOFF-MISSING: 账本判已验收（ACCEPTED），矩阵声明「发布类型：首次发布」`
        + `但没有显式用户签收记录 —— 按 AGENTS.md 红线「首次发布未取得用户签收不得报完工」不得放行。`
        + `在 docs/qa/产品验收追踪矩阵.md 写一行「用户签收：已签收（YYYY-MM-DD）」；未签收先记 chain_status=OPEN`);
    }
  }
}
{
  const acceptedRows = [];
  for (const d of readRows("TASK-MODEL-LOG.jsonl")) {
    if (d.chain_status === "ACCEPTED") acceptedRows.push(d);
  }
  if (acceptedRows.length) {
    const mp = join(dirname(dir), "qa", "产品验收追踪矩阵.md");
    if (!existsSync(mp)) {
      fails.push(`ACCEPTED-BLOCK: 账本有 ${acceptedRows.length} 行 chain_status=ACCEPTED（判已验收），`
        + `但 docs/qa/产品验收追踪矩阵.md 不存在 —— 按 AGENTS.md 红线「产品验收未落盘不得报完工」不得放行`);
    } else {
      const lines = readFileSync(mp, "utf8").split("\n");
      const bad = [];
      lines.forEach((ln, i) => {
        // 2026-10-17 修：原来只扫「含 AC-<数字>」的行，改写成 AC01 / ac_2 就整份漏检
        // （实测反例：`| AC01 | 未测 |` 与「整份无编号」都 exit 0）。
        // 现在：带编号的行按编号判定；**不含任何编号的行**，只要出现未测信号也照样拦。
        const hasAc = /\bAC[\s_-]?\d+\b/i.test(ln);
        if (!hasAc && !/未测|未完成|未通过|待补|待测|待验证|部分通过|(^|[^A-Za-z])TBD([^A-Za-z]|$)|(^|[^A-Z])OPEN([^A-Z]|$)|FAIL|BLOCKED/.test(ln)) return;
        if (/未测|未完成|未通过|待补|待测|待验证|部分通过|(^|[^A-Za-z])TBD([^A-Za-z]|$)|(^|[^A-Z])OPEN([^A-Z]|$)|FAIL|BLOCKED/.test(ln)) bad.push(`#${i + 1}`);
      });
      if (bad.length) {
        fails.push(`ACCEPTED-BLOCK: 账本判已验收（chain_status=ACCEPTED），但验收矩阵仍有关键条目未闭环：`
          + `${bad.slice(0, 5).join("、")}${bad.length > 5 ? ` 等 ${bad.length} 处` : ""}。`
          + `未测/未完成/待补/待测/TBD/OPEN/FAIL/BLOCKED 均属未闭环，报完工前提不成立`);
      }
    }
  }
}

// 采集完整度（2026-10-27 自查 B1，**只报不拦**）
// 背景：九角色里 db-admin 零记录、supervisor/senior 仅单一模型，且 elapsed/tokens/cost 覆盖率 <4%
// ⇒ 账本能回答「成没成」，回答不了「换哪个模型更快更便宜」。此处只提示补采集，不回填历史。
{
  const rows = readRows("TASK-MODEL-LOG.jsonl").filter((d) => !d._example);
  if (rows.length >= 20) {
    const el = rows.filter((d) => typeof d.elapsed_sec === "number").length;
    const tk = rows.filter((d) => typeof d.tokens === "number").length;
    const cost = rows.filter((d) => typeof d.cost_cny === "number").length;
    if (el / rows.length < 0.1 || tk / rows.length < 0.1) {
      warns.push(`MODEL-PERF-INCOMPLETE（不拦截）— ${rows.length} 行任务账里 elapsed_sec ${el} 行、tokens ${tk} 行、cost_cny ${cost} 行。`
        + `换模型决策需要速度/成本维度；派工收尾时建议补填，历史行不回填。`);
    }
  }
}

// 读取账本真实行（跳过 _example 与坏行）—— 供升级触发、派工漏记、产品验收红线三处共用。
function readRows(name) {
  const out = [];
  const fp = join(dir, name);
  if (!existsSync(fp)) return out;
  for (const l of readFileSync(fp, "utf8").split("\n")) {
    const s2 = l.trim();
    if (!s2) continue;
    let o; try { o = JSON.parse(s2); } catch { continue; }
    if (o && typeof o === "object" && !o._example) out.push(o);
  }
  return out;
}

// ── APP 基础能力声明检查（2026-10-08）──────────────────────────────
// 背景：APP 主题/多语言默认要求只写在 PRODUCT_PLAN 模板里，Phase1 收工时无人拦，
// 要到 Design Pipeline 才 BLOCKED（拦得住但白干一轮文档）。这里把校验前移到收工检查。
// 只报 FAIL/WARN，不新增流程与 Gate。规则见 docs/sop/app-theme-i18n.md。
// 路径归一：去前导 ./ 与重复斜杠，便于精确比对
function normalizePath(p) {
  return String(p).replace(/\/\.\//g, "").replace(/\/\/\//g, "/").replace(/^\.\//, "");
}

function readIfExists(p) { try { return existsSync(p) ? readFileSync(p, "utf8") : ""; } catch { return ""; } }

// HANDOFF 指名的需求真源（PLAN_VERSION 行里指向的 Plan 文件路径）
function trueSource(root) {
  const h = readIfExists(join(root, "docs/handoff/HANDOFF.md"));
  if (!h) return { src: null, err: "docs/handoff/HANDOFF.md 不存在，无法判定需求真源" };
  const line = h.split("\n").find((l) => /PLAN_VERSION/.test(l));
  if (!line) return { src: null, err: "HANDOFF 无 PLAN_VERSION 行，需求真源不可判定" };
  const m = line.match(/`([^`]+\.md)`/);
  if (!m) return { src: null, err: "HANDOFF 的 PLAN_VERSION 未用反引号标出 Plan 文件路径，真源不可判定" };
  const p = m[1];
  if (!existsSync(join(root, p))) return { src: null, err: `HANDOFF 的 PLAN_VERSION 指向的文件不存在：${p}` };
  return { src: p, err: null };
}

// APP 基础能力硬门（2026-10-08 B1 升级：从 WARN 升 FAIL）
// 前一版三处空转：①模板自带六关键字→原样也命中；②只 WARN 而迁移提示词写「WARN 视为通过」；
// ③只 grep 声明段、从不校验这六类是否真进了「关键 AC 集合」。现改为：
//   · 六类必须出现在**标了 关键：是 的 AC 条目**里（匹配范围限定到关键 AC 行，不再 grep 整篇）；
//   · 命中不到 ⇒ FAIL（真拦，不是提醒）；非 APP 项目与历史版本不受影响。
// APP 品牌资产（2026-10-08）：与主题/多语言同属 APP 前置，单一真源 docs/sop/app-brand-assets.md
const BRAND_DECL = /(APP\s*品牌资产方向|品牌资产方向)/;
const BRAND_AC = [
  ["三方向附命名候选", /中文名|中文名称|命名候选|名称建议|命名/],
  ["三方向附图标方向", /图标|icon/i],
  ["三方向附启动画面方向", /启动画面|启动页|Splash|Launch|闪屏/i],
  ["Freeze 锁定最终四项", /最终拍板|最终定稿|Freeze.*锁定|锁定.*最终|冻结.*最终/],
];

// APP 导航与视觉方向（2026-10-09 审查 B4 决议：加机器码）。单一真源 docs/sop/app-navigation.md
// 注意：模板自带的小节标题「**APP 导航与视觉方向声明（…）**」会让宽松正则恒真，
// 导致"空声明也算已填"。故 NAV_DECL 只认**实际填写的标记行**（行首无 ** 包裹）。
const NAV_DECL = /^\s*-\s*APP\s*导航与视觉方向声明[：:]\s*\S/m;
const NAV_AC = [
  ["三方向同一核心页面对比", /同一核心页面|同页对比|同页并置|核心页面/],
  ["非只改配色", /只改配色|换配色|配色变化|非只换色/],
  ["底部导航决策已写明", /是否采用底部导航|底部导航.*(采用|不采用)|需不需要底部|是否需要底部/],
  ["底栏滚动固定不遮挡", /底栏.*(固定|位置固定)|滚动.*独立|不被遮挡|内容不被遮挡/],
  ["Android 真机证据", /真机|实机|运行截图|录屏|设备运行/],
];

// 关键词门只验字面，故必须同时接受中文等价说法——否则「主题三态：浅色/深色/跟随系统」
// 这类完全合规的写法会被误判 FAIL（2026-10-08 实测正例暴露）。
const APP_AC = [
  ["主题三态", /LIGHT|浅色|深色|三态/],
  ["SYSTEM 默认", /SYSTEM|跟随系统|系统主题|系统外观/],
  ["中英可用", /zh-CN|中文|英语|english|\ben\b/i],
  ["不支持语言回退 zh-CN", /回退|fallback|兜底/],
  ["设置持久化", /持久|persist|重启保留|重启保持/i],
  ["切换不丢状态", /不丢|不丢业务|保持|preserv|状态保持/i],
];

// 抽出「关键：是」的 AC 条目行（关键 AC 集合），匹配只在这里面做
function criticalAcLines(text) {
  const out = [];
  for (const ln of text.split("\n")) {
    if (!/AC-\d+/.test(ln)) continue;
    if (/关键\s*[:：]\s*是|\*\*关键：是\*\*/.test(ln)) out.push(ln);
  }
  return out;
}

function checkAppBaseline(root) {
  const pmDir = join(root, "docs/pm");
  // 本项目根本没有 Product Plan（纯后端仓/未立项仓）⇒ 本检查不适用，但必须**可见**：
  // 2026-10-27 修：原实现静默 return，实测「不建 docs/pm/」即可让整组 APP 门消失且零提示。
  if (!existsSync(pmDir)) {
    warns.push(`APP-BASELINE-SKIPPED（未拦截）— 本项目没有 docs/pm/ 目录，APP 基础能力门未执行。`
      + `面向用户的 APP 项目请把 Product Plan 放进 docs/pm/；纯后端/未立项仓可忽略本条。`);
    return;
  }
  const ts = trueSource(root);
  const src = ts.src;
  const cands = [];
  if (existsSync(pmDir)) {
    let files = [];
    try { files = readdirSync(pmDir).filter((f) => f.endsWith(".md") && !f.includes("template")); } catch { files = []; }
    for (const f of files) {
      // 2026-10-27 修：原实现只认文件名 ^PRODUCT_PLAN，实测把计划改名成「主计划.md」即可
      // 让整组 APP 门静默降级。现在文件名不匹配时再看内容，像产品计划（FR-/AC-/产品计划）就算候选。
      const label = `docs/pm/${f}`;
      let looksPlan = /^PRODUCT[_-]?PLAN/i.test(f) || /Product\s*Plan/i.test(f);
      if (!looksPlan) {
        try {
          const head = readFileSync(join(pmDir, f), "utf8").slice(0, 20000);
          looksPlan = /\bFR-\d+|\bAC-\d+|产品计划|需求真源/.test(head);
        } catch { looksPlan = false; }
      }
      if (!looksPlan) continue;
      // 精确匹配真源路径；不再用 basename 包含判断（改名即可绕过＝漏洞）
      const same = (p) => p === label || p === f || normalizePath(p) === normalizePath(label);
      cands.push({ label, isSrc: same(src) });
    }
  }
  // HANDOFF 指名但在 docs/pm/ 之外的真源（如项目根的用户草稿）也要查
  if (src && !cands.some((c) => c.isSrc)) {
    const direct = readIfExists(join(root, src));
    // 只认**产品计划类**文档：技术规格（specs/…spec.md 等）不是 Product Plan，不得当计划判
    if (direct && /product[\s_-]?plan|产品\s*plan|需求/i.test(src)) {
      cands.push({ label: src, isSrc: true });
    }
  }
  // 需求真源不可判定或与候选都不匹配 ⇒ FAIL（2026-10-08）。
  // 修掉一个旁路：此前用 basename 包含判断，改个文件名即可让强门静默降级成 WARN。
  // 2026-10-17 G2 修：只在**确实存在候选计划**时才判真源不可解析。
  // 原写法无条件 FAIL，于是「按 README 新建的空项目」（docs/pm 里只有 *.template.md、
  // 被过滤后 cands 为空）在第一道机器门上恒红；报错文案还说「docs/pm 下有 Product Plan」，
  // 与事实不符（G2）。既误报又误导。
  if (!src) {
    if (cands.length) {
      fails.push(`APP-TRUEOUT-SOURCE-UNRESOLVED — ${ts.err}。docs/pm 下有 Product Plan 但无法确认哪份是真源时，`
        + `不得默认放行：补齐 HANDOFF 的 PLAN_VERSION（格式：- PLAN_VERSION：以 \`路径.md\` 为需求真源）后重跑。`);
    } else {
      warns.push(`APP-TRUEOUT-SOURCE-UNRESOLVED（未拦截）— ${ts.err}；但 docs/pm 下**没有任何 Product Plan**`
        + `（只有模板文件），本项不适用。项目真正开工产出 Plan 后此项自动转为强制。`);
    }
    return;
  }
  if (cands.length && !cands.some((c) => c.isSrc)) {
    fails.push(`APP-TRUEOUT-SOURCE-MISMATCH — HANDOFF 的 PLAN_VERSION 指向 \`${src}\`，`
      + `但 docs/pm 下没有同名 Plan（现有：${cands.map((c) => c.label).join("、")}）。`
      + `真源被改名或移走时不得默认放行：把 PLAN_VERSION 改成实际路径后重跑。`);
    return;
  }
  for (const c of cands) {
    const text = readIfExists(join(root, c.label));
    if (!text) continue;
    const probe = text.replace(/(无|不含|不做|不涉及|非|不适用)[^\n]{0,12}?(Android|iOS|Flutter|小程序|移动端|APP|客户端)/gi, "");
    const strong = /(Android|iOS|Flutter|React\s*Native|小程序|移动端|APP\s*(项目|应用|端)|面向用户交付|客户端\s*App|APK|IPA)/i.test(probe);
    const basis = /(LIGHT|DARK|SYSTEM|深色|浅色|主题切换|zh-CN|多语言|国际化|本地化)/.test(probe);
    if (!strong && !basis) continue;
    if (!/(APP\s*基础能力声明|app[-_ ]baseline)/.test(text)) {
      const msg = `缺「APP 基础能力声明」（主题三态/语言集/系统跟随/回退/持久化；见 docs/sop/app-theme-i18n.md）`;
      if (c.isSrc) fails.push(`${c.label}: APP-BASELINE-MISSING — ${msg}。不进 Design Pipeline，补齐后再收工。`);
      else warns.push(`${c.label}: WARN 非当前真源的 APP Product Plan ${msg}（历史版本可不补；若将启用则须先补）`);
      continue;
    }
    // 关键 AC 集合必须非空且覆盖六类
    const crit = criticalAcLines(text);
    if (!crit.length) {
      if (c.isSrc) fails.push(`${c.label}: APP-CRITICAL-AC-EMPTY — 已声明 APP 基线，但关键 AC 集合为空或无一条标「关键：是」；`
        + `六类（主题三态／SYSTEM 默认／中英可用／回退 zh-CN／持久化／切换不丢状态）必须进关键 AC 集合，不得进 Human Review。`);
      continue;
    }
    const pool = crit.join("\n");
    const missing = APP_AC.filter(([, re]) => !re.test(pool)).map(([n]) => n);
    if (missing.length) {
      if (c.isSrc) fails.push(`${c.label}: APP-CRITICAL-AC-INCOMPLETE — 关键 AC 集合未覆盖：${missing.join("、")}。`
        + `这六类必须各自有一条标「关键：是」的 AC；补不齐不得进 Human Review。`);
      else warns.push(`${c.label}: WARN 非当前真源的 APP Plan 关键 AC 未覆盖：${missing.join("、")}`);
    }
    // 品牌资产：声明缺失 FAIL；关键 AC 未覆盖 FAIL
    if (!BRAND_DECL.test(text)) {
      const m = `缺「APP 品牌资产方向」（中文名/英文名/安卓图标/启动画面方向；见 docs/sop/app-brand-assets.md）。`
        + `P045 教训：品牌资产未前置，开发阶段由执行者自行决定命名与图标，结果不可控。`;
      if (c.isSrc) fails.push(`${c.label}: APP-BRAND-ASSETS-MISSING — ${m} 未补齐不得进 Design Pipeline。`);
      else warns.push(`${c.label}: WARN 非当前真源的 APP Plan ${m}`);
    } else {
      const missB = BRAND_AC.filter(([, re]) => !re.test(pool)).map(([n]) => n);
      if (missB.length) {
        if (c.isSrc) fails.push(`${c.label}: APP-BRAND-AC-INCOMPLETE — 品牌资产关键 AC 未覆盖：${missB.join("、")}。`
          + `三方向附候选与 Freeze 锁定最终四项必须各有标「关键：是」的 AC；缺任一类不得进 Human Review。`);
        else warns.push(`${c.label}: WARN 非当前真源的 APP Plan 品牌资产关键 AC 未覆盖：${missB.join("、")}`);
      }
    }
    // 导航与视觉方向：声明缺失 FAIL；关键 AC 未覆盖 FAIL（同构于品牌/主题）
    // 兼容口径（同原型门）：只对**新规 Plan**判 FAIL——判据＝Plan 里带模板新增的
    // 「APP 导航与视觉方向声明」小节。早于本规则的历史 Plan（含在开发的 P045/P046）
    // 只报 WARN，不打断其开发链（用户令：不打断 P045；P046 先补 HTML 不被导航门卡住）。
    const navNewRegime = /APP\s*导航与视觉方向声明/.test(text);
    if (!NAV_DECL.test(text) && navNewRegime) {
      const m = `缺「APP 导航与视觉方向声明」（底部导航是否采用及理由、三方向差异化轴、导航入口/图标/四态/排版/显隐/适配；`
        + `见 docs/sop/app-navigation.md）。导航是产品决策，不是 Builder 临场发挥；未定清楚会导致底栏随意设计或跟随内容滚动。`;
      if (c.isSrc) fails.push(`${c.label}: APP-NAV-DECL-MISSING — ${m} 未补齐不得进 Design Pipeline。`);
      else warns.push(`${c.label}: WARN 非当前真源的 APP Plan ${m}`);
    } else {
      const missN = NAV_AC.filter(([, re]) => !re.test(pool)).map(([n]) => n);
      if (missN.length) {
        if (c.isSrc) fails.push(`${c.label}: APP-NAV-AC-INCOMPLETE — 导航关键 AC 未覆盖：${missN.join("、")}。`
          + `这五类必须各自有一条标「关键：是」的 AC；缺任一类不得进 Human Review。`);
        else warns.push(`${c.label}: WARN 非当前真源的 APP Plan 导航关键 AC 未覆盖：${missN.join("、")}`);
      }
    }
    // Phase1 原型交付完整性（2026-10-09 用户定，P046 教训）
    // Readiness Gate 的附加条件，不新增 Gate：APP 进 WAITING_HUMAN_APPROVAL 前必须有
    // 可运行的交互原型，且「文件存在」与「真实运行」分开判定。
    //   · PDF／截图／纯文档／在线概念图／单张示例预览 HTML 不算原型。
    checkPrototypeDelivery(root, c.label, text);
  }
}

// Phase1 原型交付完整性检查（Readiness Gate 附加条件）
// 失败码：PROTO-MISSING / PROTO-NOT-RUNNABLE / PROTO-NO-RUNTIME-EVIDENCE
const PROTO_DIR = "docs/design/prototype";
// 计数用：真实运行证据（浏览器自动化冒烟测试记录）
function protoHasRuntimeEvidence(root) {
  const dirs = [join(root, PROTO_DIR), join(root, "docs/design")];
  const hits = [];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    let files = [];
    try { files = readdirSync(d).filter((f) => /\.(md|json|log)$/i.test(f)); } catch { files = []; }
    for (const f of files) {
      const t = readIfExists(join(d, f));
      // 浏览器自动化/真实运行证据的关键词：Playwright/Cypress/browser executed/console 等
      if (/(playwright|cypress|puppeteer|browser[_ ]?executed|浏览器自动化|冒烟测试|smoke)/i.test(t)) hits.push(`${PROTO_DIR}/${f}`);
    }
  }
  return hits;
}

function checkPrototypeDelivery(root, planLabel, planText) {
  const ts = trueSource(root);
  const isSrc = !!ts.src && normalizePath(planLabel) === normalizePath(ts.src);
  // 兼容口径：本规则只对**新规下写的** Product Plan 判 FAIL。
  // 判据＝Plan 里带模板新增的「原型交付完整性检查条件」小节；早于本规则的历史 Plan
  // （如正在开发的 P045）没有该小节，只报 WARN，不打断其开发链（用户令：P045 不打断）。
  const underNewRegime = /原型交付完整性检查条件/.test(planText);
  const hard = isSrc && underNewRegime;

  const protoDir = join(root, PROTO_DIR);
  const htmls = [];
  if (existsSync(protoDir)) {
    try {
      for (const f of readdirSync(protoDir)) {
        if (/\.html$/i.test(f) && !/example|sample|demo-preview/i.test(f)) htmls.push(f);
      }
    } catch { /* ignore */ }
  }

  if (!htmls.length) {
    const msg = `Phase1 未交付可运行交互原型（${PROTO_DIR}/ 下无可运行 HTML）。`
      + `面向用户的 APP 在 Phase1 必须交付本地完整可运行的原型（核心页面完整、关键交互可操作、`
      + `已确定名称/图标/品牌/真实图片落实、浅深色与语言及异常状态可演示、给出路径与打开命令）；`
      + `PDF／截图／纯文档／在线概念图／单张示例预览 HTML 不算。见 AGENTS.md「Phase1 必须交付可运行交互原型」。`;
    if (hard) fails.push(`${planLabel}: PROTO-MISSING — ${msg}`);
    else warns.push(`${planLabel}: WARN 未交付可运行交互原型${underNewRegime ? "（非真源 Plan）" : "（本 Plan 早于原型规则，仅提醒）"}：${msg}`);
    return;
  }

  // 文件存在 ≠ 真实运行：分开判定，不能拿「HTML 存在」代替交互冒烟测试
  const evidence = protoHasRuntimeEvidence(root);
  if (!evidence.length) {
    const msg = `有原型文件但缺**真实运行验证证据**（浏览器自动化冒烟测试记录：路径、运行方式、`
      + `跑了哪些交互、结果、已知限制）。文件存在检查与真实运行检查必须分开——不能拿「检查 HTML 存在」`
      + `代替交互测试。`;
    if (hard) fails.push(`${planLabel}: PROTO-NO-RUNTIME-EVIDENCE — ${msg}`);
    else warns.push(`${planLabel}: WARN ${msg}`);
  }
}


// ── 产品验收矩阵门（2026-10-27 体系自查 P1）────────────────────────────
// 背景：AGENTS.md 红线「产品验收未落盘或关键 AC 未测不得报完工」此前**只有文字**，
// check-sync 的 AC 巡检也只报不拦（实测 10/24 落盘仍 SYNC-OK）。这里把红线挂到
// 项目侧收工必跑的命令上（AGENTS.md 已要求「记账后与收工前必跑 check-ledger」）。
// 分级：主开发者模式 / PLAN 及未开工 → WARN（不误伤）；DEVELOP 且非 solo → FAIL。
const AC_MATRIX = "docs/qa/产品验收追踪矩阵.md";
function checkAcceptanceMatrix(root) {
  // 母版/分发包只有 _example 空壳，readRows 已过滤 → 走「未开工」WARN，不会误红。
  const rows = readRows("TASK-MODEL-LOG.jsonl");
  if (!rows.length) {
    warns.push(`AC-MATRIX-SKIPPED（未拦截）— TASK-MODEL-LOG 无真实任务行，项目未开工，验收矩阵门不适用。`);
    return;
  }
  const f = join(root, AC_MATRIX);
  const text = readIfExists(f);
  if (/^\|\s*AC-\d+/m.test(text)) return;
  const detail = text ? `${AC_MATRIX} 文件在但无 AC 条目` : `${AC_MATRIX} 缺失`;

  let mode = "", phase = "";
  try {
    const st = JSON.parse(readIfExists(join(root, "docs/model/GOVERNANCE-STATE.json")) || "{}");
    mode = String(st.execution_mode || "");
    phase = String(st.project_phase_field || "");
  } catch { /* 坏 JSON 按未知处理 */ }
  if (!phase) {
    const m = /PROJECT_PHASE\s*[:：]\s*`?([A-Z_]+)/.exec(readIfExists(join(root, "docs/handoff/HANDOFF.md")));
    if (m) phase = m[1];
  }

  if (mode === "solo") {
    warns.push(`AC-MATRIX-WARN（未拦截·主开发者模式）— ${detail}；主开发者自测须在 TASK 账本 note/chain_status 留痕，首次发布签收前必须补矩阵。`);
    return;
  }
  if (!phase || /^(PLAN|WAITING_HUMAN_APPROVAL|PLAN_REOPEN_REQUIRED|ABSENT)$/.test(phase)) {
    warns.push(`AC-MATRIX-WARN（未拦截·${phase || "阶段未知"}）— ${detail}；进入 DEVELOP 后本项自动转为 FAIL。`);
    return;
  }
  if (phase === "DEVELOP") {
    fails.push(`AC-MATRIX-MISSING — 项目处于 DEVELOP 且非主开发者模式，但 ${detail}。`
      + `红线「产品验收未落盘或关键 AC 未测不得报完工」自本版起为机器强制：`
      + `补 ${AC_MATRIX}（每条 AC 含状态与证据）后重跑。`);
    return;
  }
  warns.push(`AC-MATRIX-WARN（未拦截·未知阶段 ${phase}）— ${detail}`);
}

const projectRoot = basename(dir) === "model" ? join(dir, "..", "..") : dir;
// 母版/分发包自检（--allow-example）跳过 APP 门（2026-10-09 修 P1-5）：
// 母版是**分发源**、不是受治理的真实项目——没有产品计划真源、没有 Phase2 APP 项目，
// 跑 APP 门必然报 TRUEUT-UNRESOLVED 等，属噪声。真项目的 APP 门照常生效。
// 2026-10-27 修：原实现在 --allow-example 下**整组跳过** APP 门，而 pre-commit-guard 又把
// 「4.Templates（PC）」路径下所有项目视为母版 ⇒ 该目录里任何真实项目都自动获得豁免（实测）。
// 现在 APP 门一律执行；母版无 docs/pm 时只出 WARN，不误报失败。
if (existsSync(dir)) checkAppBaseline(projectRoot);
if (existsSync(dir)) checkAcceptanceMatrix(projectRoot);

// ── 原始输入留存（2026-10-11，仅在显式 --evidence <dir> 时写）────────────────
if (EVIDENCE_DIR) writeEvidence();

for (const w of warns) console.log(w);
if (fails.length) {
  console.log(fails.join("\n"));
  if (!EVIDENCE_DIR) console.log("[提示] 本次有失败。如需留存原始输入备查：--evidence docs/model/.evidence");
  process.exit(1);
}
console.log(warns.length ? "LEDGER-OK (含 WARN)" : "LEDGER-OK");

// 证据卡路径归一（导出供单测直接打；锚点盖不住的一律兜底抹除）
export function _normPath(x, anchors, projRoot) {
  let v = String(x);
  for (const a of anchors) v = v.split(a).join(a === projRoot ? "<项目根>" : "<工作目录>");
  return v.replace(/\/(?:Users|home|var|tmp|private|opt|etc)\/[^"\s')\]]*/g, "<本机路径>");
}

function writeEvidence() {
  // 失败也写：事后复现「当时为什么报错」正是留存的用途，只在成功时留档等于漏掉最需要的那次。
  const out = resolve(EVIDENCE_DIR);
  mkdirSync(out, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const inputs = {};
  for (const f of ["TASK-MODEL-LOG.jsonl", "DISPATCH-LOG.jsonl"]) {
    const fp = join(dir, f);
    if (!existsSync(fp)) { inputs[f] = { present: false }; continue; }
    const raw = readFileSync(fp, "utf8");
    inputs[f] = {
      present: true,
      sha256: createHash("sha256").update(raw).digest("hex"),
      bytes: Buffer.byteLength(raw, "utf8"),
      lines: raw.split("\n").length,
      copy_path: `input-${ts}-${f}`,   // 相对证据目录；副本留在本地，禁入仓
    };
  }
  // 路径归一（2026-10-12 定）：证据卡**可能进 git**，不得含本机绝对路径。
  // 证据卡留「判定与哈希」，原始副本（input-*）留在本地不外传。
  const projRoot = resolve(dirname(dir));
  // 归一锚点：项目根优先（docs/model 的上两级）；找不到 docs/ 时（临时目录等）
  // 退到「证据目录的父目录」。**必须留一个能盖住全路径的兜底** ——
  // 否则传入路径在锚点之外时会把本机绝对路径原样写进可进 git 的证据卡。
  const anchors = [resolve(projRoot)];  // 见 _normPath 导出（单测直接打它）
  for (let up = resolve(out), n = 0; n < 4 && up !== "/" && up !== dirname(up); n++) {
    up = dirname(up); anchors.push(up);
  }
  anchors.push(resolve(process.cwd()));
  const norm = (x) => _normPath(x, anchors, resolve(projRoot));
  const meta = {
    tool: "check-ledger.mjs",
    schema: "orca-evidence/v1",
    argv: process.argv.slice(2).map(norm),
    cwd: "<工作目录>",
    ledger_dir: norm(resolve(dir)),
    keep_in_git: "证据-<时间>.json（可进 git：判定与哈希，无本机路径）",
    keep_local_only: "input-*.jsonl（逐字节原始副本，含业务内容，禁入仓）",
    at: new Date().toISOString(),
    exit_code: fails.length ? 1 : 0,
    fails, warns,
    inputs,          // 原始输入的 sha256/行数/字节数/副本路径（副本逐字节另存，不塞进 JSON）
  };
  writeFileSync(join(out, `证据-${ts}.json`), JSON.stringify(meta, null, 2), "utf8");
  // 逐字节副本（从源文件重读，不复用内存内容，避免把副本与哈希算自两份不同数据）
  for (const f of ["TASK-MODEL-LOG.jsonl", "DISPATCH-LOG.jsonl"]) {
    const i = inputs[f];
    if (!i || !i.present) continue;
    // copy_path 是**相对证据目录**的（禁把本机绝对路径写进可进 git 的证据卡），
    // 所以这里必须 join(out) —— 直接用 copy_path 会写到 CWD 找不到的相对路径。
    writeFileSync(join(out, i.copy_path), readFileSync(join(dir, f), "utf8"), "utf8");
  }
  // 自检：证据卡声明的每个副本必须真实存在且哈希相符 —— 指向不存在的文件等于没留证
  // 2026-10-27 修死码：原实现失败时置 false、随后无条件置 true，副本损坏仍报「已验证」。
  let copiesOk = true;
  for (const f of ["TASK-MODEL-LOG.jsonl", "DISPATCH-LOG.jsonl"]) {
    const i = inputs[f];
    if (!i || !i.present) continue;
    const fp = join(out, i.copy_path);
    const h = existsSync(fp) ? createHash("sha256").update(readFileSync(fp)).digest("hex") : null;
    if (h !== i.sha256) {
      console.log(`[evidence] 警告：副本校验失败 ${f}（期望 ${i.sha256}，实得 ${h}）`);
      copiesOk = false;
    }
  }
  meta.copy_verified = copiesOk;
  writeFileSync(`${out}/证据-${ts}.json`, JSON.stringify(meta, null, 2), "utf8");
  console.log(`[evidence] 已留存原始输入 → ${out}（证据-${ts}.json ＋ 两份逐字节副本；副本禁入仓）`);
}
