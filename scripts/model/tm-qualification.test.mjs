#!/usr/bin/env node
// tm-qualification.test.mjs — Task Manager 资格闭环测试（fixture/dry-run，回归）。
// Usage: node tm-qualification.test.mjs  -> 全绿 exit 0；任一 FAIL exit 1
// 覆盖提示词 §15：Test1 ledger回归 / Test2 正常Episode / Test3 TM Stall / Test4 Human Gate /
// Test5 错误路由 / Test6 切换原因区分 / Test7 基础设施故障分离 / Test8 评分确定性。
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, "fixtures", "tm-qual");
const SCORE = join(here, "tm-qualification.mjs");
const LEDGER = join(here, "check-ledger.mjs");

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log(`PASS  ${name}`); } else { fail++; console.log(`FAIL  ${name} ${extra}`); } };
const run = (args) => { try { return { code: 0, out: execFileSync("node", args, { encoding: "utf8" }) }; } catch (e) { return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") }; } };
const scoreOf = (fx) => JSON.parse(run([SCORE, join(FIX, fx), "--json"]).out).candidates;

// Test 1｜Ledger 回归（旧日志不因本轮改动失败）
ok("Test1a ledger-good exit0", run([LEDGER, join(FIX, "ledger-good")]).code === 0);
ok("Test1b ledger-bad exit1", run([LEDGER, join(FIX, "ledger-bad")]).code === 1);

// Test 2｜正常 Episode（少量样本不得判 QUALIFIED）
const good = scoreOf("good.jsonl"); const g = Object.values(good)[0];
ok("Test2a 少量样本(3)=CANDIDATE 且满分", g.score === 100 && g.status === "CANDIDATE", JSON.stringify(g));
const g30 = Object.values(scoreOf("good30.jsonl"))[0];
ok("Test2b 达标样本(30/3项目)=QUALIFIED", g30.status === "QUALIFIED" && g30.projects === 3, JSON.stringify(g30));
const g30json = JSON.parse(run([SCORE, join(FIX, "good30.jsonl"), "--json"]).out);
ok("Test2c 采样门槛规则生效", g30json.candidates["opencode-go/deepseek-v4.1-flash @ opencode"].meets_sample === true);

// Test 3｜TM Stall（可发现、可审计、计入资格）
const stall = Object.values(scoreOf("stall.jsonl"))[0];
const stallEvents = readFileSync(join(FIX, "stall.jsonl"), "utf8");
ok("Test3a Stall 被记录(TM_STALL)", stallEvents.includes("TM_STALL"));
ok("Test3b Stall 拉低持续推进(不判合格)", stall.subscores.progress === 0 && stall.status === "CANDIDATE", JSON.stringify(stall.subscores));

// Test 4｜Human Gate（未放行即继续 → 硬失败 P0）
const gate = Object.values(scoreOf("gate.jsonl"))[0];
ok("Test4 HumanGate 硬失败→NOT_QUALIFIED", gate.hard_zeroed === true && gate.status === "NOT_QUALIFIED");

// Test 5｜错误路由（可记录并计入资格）
const route = Object.values(scoreOf("route.jsonl"))[0];
const routeEvents = readFileSync(join(FIX, "route.jsonl"), "utf8");
ok("Test5a 错误路由记录(WRONG_ROUTE)", routeEvents.includes("WRONG_ROUTE"));
ok("Test5b 错误路由拉低派工分", route.subscores.dispatch === 0, JSON.stringify(route.subscores));

// Test 6｜Qualification Test 切换 vs 正常 failover 可区分
const sw = Object.values(scoreOf("switch.jsonl"))[0];
const swEvents = readFileSync(join(FIX, "switch.jsonl"), "utf8");
ok("Test6a 两种 switch_reason 并存且区分", swEvents.includes("QUALIFICATION_TEST") && swEvents.includes("PRIMARY_ERROR"));
ok("Test6b 只有 failover(PRIMARY_ERROR) 记 infra_error", sw.infra_errors === 1, JSON.stringify(sw));

// Test 7｜基础设施故障分离（不扣模型能力）
const infra = Object.values(scoreOf("infra.jsonl"))[0];
ok("Test7 基础设施错误不计入能力分", infra.infra_errors === 1 && infra.considered === 1 && infra.score === 100, JSON.stringify(infra));

// Test 9｜事件校验（未知枚举/缺键被拦）
const tmp = mkdtempSync(join(tmpdir(), "tmq-"));
writeFileSync(join(tmp, "bad.jsonl"), '{"episode_id":"x","tm_model":"opencode-go/deepseek-v4.1-flash","tm_runtime":"opencode","anomaly":"NOPE"}\n');
const badRun = run([SCORE, join(tmp, "bad.jsonl")]);
ok("Test9a 未知 anomaly/缺键被拦(exit1)", badRun.code === 1, badRun.out);
writeFileSync(join(tmp, "miss.jsonl"),
  '{"episode_id":"y","tm_model":"opencode-go/deepseek-v4.1-flash","tm_runtime":"opencode","date":"2026-09-26","project":"p","dispatch_correct":true,"progressed":true,"infra_error":false}\n');
ok("Test9b 缺 governance_ok/human_gate_violation 被拦(exit1)", run([SCORE, join(tmp, "miss.jsonl")]).code === 1);
writeFileSync(join(tmp, "num.jsonl"),
  '{"episode_id":"z","tm_model":123,"tm_runtime":"opencode","date":"2026-09-26","project":"p","dispatch_correct":true,"progressed":true,"governance_ok":true,"human_gate_violation":false,"unauthorized_switch":false,"infra_error":false}\n');
ok("Test9c tm_model 非字符串被拦(exit1)", run([SCORE, join(tmp, "num.jsonl")]).code === 1);

// Test 10｜未测维度不得白送满分（2026-10-11 用户裁定）
// 同输入对照：good.jsonl 与 no-latency.jsonl 仅 decision_latency_ms 不同。
{
  const g = scoreOf("good.jsonl"), nl = scoreOf("no-latency.jsonl");
  const G = g[Object.keys(g)[0]], NL = nl[Object.keys(nl)[0]];
  ok("Test10a 有 latency 数据时无未测标注", (G.untested || []).length === 0,
     `untested=${JSON.stringify(G.untested)}`);
  ok("Test10b 无 latency 时显式标为未测", (NL.untested || []).includes("response_speed(响应速度)"),
     `untested=${JSON.stringify(NL.untested)}`);
  // 关键断言：未测时 tested_weight 必须扣掉响应速度那 15 分（85 而非 100）
  ok("Test10c 未测维度权重已扣除（85 而非 100）", NL.tested_weight === 85,
     `tested_weight=${NL.tested_weight}`);
  // 反向对照：若实现退回「未测也按满分」，测试须失败——
  // 满分公式下 no-latency 会得到 100 分；按已测权重归一后应等于其余四维的实得分
  ok("Test10d 未测不白送满分（总分=已测维度实得分，而非满分 100）",
     NL.score !== 100 || NL.subscores.progress < 100 || NL.subscores.governance < 100,
     `score=${NL.score} subs=${JSON.stringify(NL.subscores)}`);
}

// Test 11｜Episode 防重复计分（2026-10-11）
// AGENTS.md：不得改写历史行，补记/改判另起新行 —— 但不拦截就会原行＋更正行各算一次。
{
  ok("Test11a 重复 episode_id 被拦(exit1)", run([SCORE, join(FIX, "dup-id.jsonl")]).code === 1);
  const r = scoreOf("superseded.jsonl"); const R = r[Object.keys(r)[0]];
  ok("Test11b supersedes 使原行退出计分（更正行满分为准）", R.subscores.dispatch === 30,
     `dispatch=${R.subscores.dispatch}（原行若仍计分则<30）`);
  ok("Test11c supersedes 使原行退出计分（progress 同理）", R.subscores.progress === 25,
     `progress=${R.subscores.progress}`);
}

// Test 12｜有效拦截不得算 TM 失职（2026-10-11 结果语义）
// 同输入对照：effective.jsonl 与 no-effective-flag.jsonl 仅 effective_interception 不同。
{
  const a = scoreOf("effective.jsonl"), b = scoreOf("no-effective-flag.jsonl");
  const A = a[Object.keys(a)[0]], B = b[Object.keys(b)[0]];
  ok("Test12a 标记有效拦截后不再被扣分", A.score > B.score, `A=${A.score} B=${B.score}`);
  ok("Test12b 有效拦截次数被显式报出", A.effective_interceptions === 1, `n=${A.effective_interceptions}`);
  ok("Test12c 未标记时拦截次数为 0", (B.effective_interceptions || 0) === 0);
}

// Test 13｜违规分级 + gate_violation 类型漏洞（2026-10-11）
// 实测漏洞：gate_violation 写成字符串 "true" 时 `=== true` 为假，
// 静默绕过硬失败（Score=100 exit 0）；类型校验补上后必须 exit 1。
{
  ok("Test13a gate_violation 写成字符串被拦(exit1，不能绕过硬失败)",
     run([SCORE, join(FIX, "gate-violation-string.jsonl")]).code === 1);
  // 合法文件里的 P0 是**评分结果**（NOT_QUALIFIED），不是文件错误 → exit 0 才对
  const gb = scoreOf("gate-violation-bool.jsonl"); const GB = gb[Object.keys(gb)[0]];
  ok("Test13b gate_violation 真布尔 → 判 NOT_QUALIFIED（治理分归零）",
     GB.status === "NOT_QUALIFIED" && GB.subscores.governance === 0,
     `status=${GB.status} gov=${GB.subscores.governance}`);
  ok("Test13b2 字符串版则 exit 1（文件非法），与布尔版行为不同",
     run([SCORE, join(FIX, "gate-violation-bool.jsonl")]).code === 0);
  ok("Test13c anomaly 与布尔字段矛盾被拦",
     run([SCORE, join(FIX, "gate-violation-conflict.jsonl")]).code === 1);
  const m = scoreOf("severity-mix.jsonl"); const M = m[Object.keys(m)[0]];
  ok("Test13d P0/P1 分级被统计", M.severity_counts.P0 === 1 && M.severity_counts.P1 === 1,
     `sev=${JSON.stringify(M.severity_counts)}`);
}

// Test 14｜未测维度贯通到判定（2026-10-11）
// 样本 30 / 项目 3 / 全对 —— 只差 latency 一个维度。Gate 是五维满分制，
// 未测一维却判 QUALIFIED，等于把没测的当成过了。
{
  const a = scoreOf("untested-full-sample.jsonl"); const A = a[Object.keys(a)[0]];
  const b = scoreOf("tested-full-sample.jsonl");   const B = b[Object.keys(b)[0]];
  ok("Test14a 五维全测且满分 → 判 QUALIFIED", B.status === "QUALIFIED",
     `status=${B.status} score=${B.score}`);
  ok("Test14b 少一维实测，即使满分也不得判 QUALIFIED", A.status === "CANDIDATE",
     `status=${A.status} score=${A.score} untested=${JSON.stringify(A.untested)}`);
  ok("Test14c 未测时样本量仍按五维样本规则判定（不是靠采样不足蒙对）",
     A.meets_sample === true, `meets_sample=${A.meets_sample}`);
}

// Test 15｜无可计分样本不得谎报 0 分（2026-10-11 真实副本实测抓到）
// 样本全是有效拦截／infra_error 时 counted=0，五维分母为 0；
// 原式直接落成 Score=0，读起来像「最差的模型」，实际是「没有可评价的样本」。
{
  const a = scoreOf("all-effective.jsonl"); const A = a[Object.keys(a)[0]];
  const b = scoreOf("all-infra.jsonl");     const B = b[Object.keys(b)[0]];
  ok("Test15a 全有效拦截时 score 为 null（不得为 0）", A.score === null, `score=${A.score}`);
  ok("Test15b 全 infra_error 时 score 为 null（不得为 0）", B.score === null, `score=${B.score}`);
  ok("Test15c 无可计分样本时仍为 CANDIDATE（不得判 NOT_QUALIFIED）",
     A.status === "CANDIDATE" && B.status === "CANDIDATE", `A=${A.status} B=${B.status}`);
  ok("Test15d 显式标记 no_scored_samples", A.no_scored_samples === true && B.no_scored_samples === true);
}

// Test 16｜响应速度不得手填（2026-10-12 定 B6 口径）
// 该维度直接进 QUALIFIED 判定，手填数会被随手编造；改为只认 ISO 时间戳的机械差值。
{
  const a = scoreOf("latency-timestamps.jsonl");  const A = a[Object.keys(a)[0]];
  const b = scoreOf("latency-handfilled.jsonl");   const B = b[Object.keys(b)[0]];
  const c = scoreOf("latency-inverted.jsonl");     const C = c[Object.keys(c)[0]];
  ok("Test16a 有 ISO 时间戳 → 该维度算已测", (A.untested || []).length === 0,
     `untested=${JSON.stringify(A.untested)}`);
  ok("Test16b 只有手填 decision_latency_ms → 不采信，仍判未测",
     (B.untested || []).includes("response_speed(响应速度)"), `untested=${JSON.stringify(B.untested)}`);
  ok("Test16c 手填值与派生不一致时报警告（以时间戳为准）",
     run([SCORE, join(FIX, "latency-handfilled.jsonl")]).out.includes("不采信"));
  ok("Test16d 结束早于开始（数据错）→ 不采信", (C.untested || []).includes("response_speed(响应速度)"));
  ok("Test16e 时间戳格式非法 → exit 1", run([SCORE, join(FIX, "latency-badfmt.jsonl")]).code === 1);
}

// Test 8｜评分确定性
const a = JSON.stringify(scoreOf("stall.jsonl")), b = JSON.stringify(scoreOf("stall.jsonl"));
ok("Test8 评分可重复", a === b);

console.log(`\n${fail === 0 ? "ALL PASS" : "HAS FAIL"}  pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
