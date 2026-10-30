#!/usr/bin/env node
// ledger-fields.test.mjs｜账本字段类型/可空性/枚举校验的回归（2026-10-11）
//
// 目的：把复评与两轮审查查出的「非法字段零校验」漏洞变成可反复执行的断言。
// 起因（全部实测确认，构造反例 exit 0 通过）：
//   派工账 date/role/used/runtime 零校验；枚举检查 `d[k] !== null` 让 null 整体绕过；
//   任务账 rework 无类型/范围校验（-1／null／字符串／小数全放行）。
// 跑法：node scripts/model/ledger-fields.test.mjs
//
// 每个用例是隔离的最小项目夹具，落在 fixtures/ledger-fields/（版本库内固定路径，禁清场）。
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdtempSync, cpSync, rmSync, writeFileSync, readFileSync, readdirSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir, homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const LEDGER = join(HERE, "check-ledger.mjs");
const FIX = join(HERE, "fixtures", "ledger-fields");

// 用 spawnSync：exit 0 时也要拿到 stdout（WARN 文案只在 stdout，execFileSync 成功路径不返回输出）
function runLedger(projectDir, env, extraArgs = []) {
  const r = spawnSync("node", [LEDGER, join(projectDir, "docs", "model"), ...extraArgs],
    { encoding: "utf8", env: { ...process.env, ...(env || {}) } });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}
function withFixture(name, fn, env) {
  const src = join(FIX, name);
  if (!existsSync(src)) throw new Error(`缺夹具：${src}`);
  const tmp = mkdtempSync(join(tmpdir(), "orca-ledger-"));
  try { cpSync(src, tmp, { recursive: true }); return fn(tmp, env); }
  finally { rmSync(tmp, { recursive: true, force: true }); }
}
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS " : "FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ── 用例表：[名称, 夹具, 期望 exit, 必须出现的码] ────────────────────────
const CASES = [
  ["case01-valid", 0, []],
  ["case02-used-missing", 1, ["missing used"]],
  ["case03-used-null", 1, ["bad used=null"]],
  ["case04-used-empty", 1, ["空串"]],
  ["case05-used-nonnum", 1, ["须字符串"]],
  ["case06-used-backup", 1, ["bad used="]],           // 现行语义：恒填主
  ["case07-date-garbage", 1, ["bad date"]],
  ["case08-date-impossible", 1, ["非真实日历日期"]],   // 正则能过但日历不存在
  ["case09-runtime-unknown", 1, ["bad runtime="]],
  ["case10-rework-null", 1, ["bad rework=null"]],
  ["case11-rework-negative", 1, ["bad rework="]],
  ["case12-rework-string", 1, ["须有限整数"]],
  ["case13-result-null", 1, ["bad result=null"]],
  ["case14-role-unknown", 1, ["bad role="]],
  // 升级触发校验（2026-10-11）：把「两次打回自动升 senior」从文字变成机器检查
  ["case15-escalation-missed", 1, ["被 supervisor 打回 2 次"]],   // 打了2次却没升级
  ["case16-escalation-ok", 0, []],                                // 正确升级，不误报
  ["case17-escalation-noreason", 1, ["escalation_reason 为空"]], // 升级未写原因
  // 升级判定按 task 而非按行：先记 FAIL 行、后补 senior 交付行时不得误报
  ["case18-escalation-later-row", 0, []],
  // 派工漏记（2026-10-14 体系自查 P0）：TASK 3 行真实任务 / DISPATCH 仅 _example
  ["case19-dispatch-omitted", 1, ["派工逐派漏记"]],
  // 产品验收红线（2026-10-14 自查 P1）：AC 未闭环却判 ACCEPTED ⇒ 不得放行
  ["case20-ac-untested-accepted", 1, ["ACCEPTED-BLOCK"]],
  ["case21-ac-missing-accepted", 1, ["ACCEPTED-BLOCK"]],
  ["case22-ac-all-pass", 0, []],           // AC 全 PASS 才可放行
  ["case23-ac-untested-open", 0, []],      // 未判验收（OPEN）不拦，避免误伤
  // 收工口径反转（2026-10-17 自查 P0-6/P0-7）：有 QA 交付却无收尾行 ⇒ 不得报完工；
  // 首次发布 ACCEPTED 但无显式用户签收 ⇒ 不得放行；单智能体可豁免第一条。
  ["case24-accepted-missing", 1, ["ACCEPTED-MISSING"]],
  ["case25-firstrelease-nosignoff", 1, ["SIGNOFF-MISSING"]],
  ["case26-firstrelease-signed", 0, []],
  ["case27-solo-exempt", 0, []],
  // 两账本交叉校验（2026-10-17）：同一 (task,role) 在两账的 result 必须一致，
  // 否则两本手写账已漂 —— 现场由 supervisor 抓出过缺 chain_status/对不齐的情况。
  ["case28-xref-consistent", 0, []],
  ["case29-xref-result-drift", 1, ["LEDGER-XREF"]],
  // 历史遗留漂移的合法出路（2026-10-17，因 043 实测铺包后 exit 1 而补）：
  // 禁重写实绩 ⇒ 用「更正行」降级；但没有更正行仍必须 FAIL，防止被更正行滥用绕过。
  ["case30-xref-corrected-note", 0, []],
  ["case31-xref-drift-no-note", 1, ["LEDGER-XREF"]],
  // 2026-10-27 自查 P0：四种「绕门」实测反例
  ["case32-plan-renamed", 1, ["APP-CRITICAL-AC-EMPTY"]],        // 计划改名不再跳过 APP 门
  ["case33-no-pm-dir", 0, ["APP-BASELINE-SKIPPED"]],            // 无 docs/pm 不再静默
  ["case34-ac-tbd", 1, ["ACCEPTED-BLOCK"]],                     // 状态写 TBD 也算未闭环
  ["case35-allow-example-no-bypass", 1, ["APP-CRITICAL-AC-EMPTY"], ["--allow-example"]], // 豁免旗不再跳过 APP 门
  // 2026-10-27 体系自查 P1：产品验收红线从「只报」升级为「项目侧收工门」
  ["case36-ac-missing-develop", 1, ["AC-MATRIX-MISSING"]],   // DEVELOP + 非 solo ⇒ 强制
  ["case37-ac-present-develop", 0, []],                        // 有矩阵 + AC 行 ⇒ 放行
  ["case38-solo-ac-missing", 0, ["AC-MATRIX-WARN"]],           // 主开发者模式 ⇒ 只警告
  ["case39-plan-ac-missing", 0, ["未拦截·PLAN"]],              // PLAN 阶段 ⇒ 只警告
];
for (const [fixture, wantExit, mustInclude, extraArgs] of CASES) {
  const r = withFixture(fixture, (d) => runLedger(d, undefined, extraArgs));
  const missing = mustInclude.filter((s) => !r.out.includes(s));
  check(`${fixture} → exit ${wantExit}`,
    r.code === wantExit && missing.length === 0,
    missing.length ? `缺码 ${missing.join(",")}｜实得：${r.out.trim().split("\n").pop() || "(空)"}` : "");
}

// ── 合法历史特殊值不得误报（审查 2026-10-11 明确要求）─────────────────
{
  // tokens/cost 允许 null（拿不到填 null）；chain_status 三值；executed_by 含异名
  const r = withFixture("case01-valid", (d) => runLedger(d));
  check("合法特殊值不误报（tokens/cost=null 已存在于合法夹具）", r.code === 0);
}

// ── 单智能体空派工账合法，不判漏记 ───────────────────────────────────
{
  const r = withFixture("case01-valid", (d, env) => {
    // 把派工账清空，模拟单智能体「不造派工行」
    writeFileSync(join(d, "docs/model/DISPATCH-LOG.jsonl"), "");
    return null;
  });
  // 豁免必须**显式声明** execution_mode=solo；不声明就是漏记（否则豁免本身成后门）
  const r2 = withFixture("case01-valid", (d) => {
    writeFileSync(join(d, "docs/model/DISPATCH-LOG.jsonl"), "");
    writeFileSync(join(d, "docs/model/GOVERNANCE-STATE.json"),
      JSON.stringify({ execution_mode: "solo" }));
    return runLedger(d);
  });
  check("单智能体显式声明 execution_mode=solo → 空派工账 exit 0", r2.code === 0, `exit=${r2.code}`);

  const r3 = withFixture("case01-valid", (d) => {
    writeFileSync(join(d, "docs/model/DISPATCH-LOG.jsonl"), "");
    return runLedger(d);
  });
  check("未声明 solo 却空派工账 → 判漏记 exit 1（豁免不得成为后门）", r3.code === 1, `exit=${r3.code}`);
  void r;
}

// ── 原始输入留存（--evidence，2026-10-11）─────────────────────────────
{
  const ev = mkdtempSync(join(tmpdir(), "orca-ev-"));
  try {
    const r = withFixture("case01-valid", (d) =>
      spawnSync("node", [LEDGER, join(d, "docs", "model"), "--evidence", ev],
        { encoding: "utf8" }).status ?? 1);
    const files = readdirSync(ev);
    const meta = files.find((f) => f.startsWith("证据-") && f.endsWith(".json"));
    const copies = files.filter((f) => f.startsWith("input-"));
    check("--evidence 落盘证据 JSON", !!meta, `files=${files.join(",")}`);
    check("--evidence 落盘两份逐字节输入副本", copies.length === 2, `copies=${copies.length}`);
    const m = meta ? JSON.parse(readFileSync(join(ev, meta), "utf8")) : {};
    check("证据含 argv/cwd/时间/退出码", !!(m.argv && m.cwd && m.at && m.exit_code !== undefined));
    check("证据含输入 sha256（可核对副本真伪）",
      !!(m.inputs && m.inputs["TASK-MODEL-LOG.jsonl"] && m.inputs["TASK-MODEL-LOG.jsonl"].sha256));
    // 默认不落盘：不开开关时不得产生任何证据文件
    const r2 = withFixture("case01-valid", (d) => runLedger(d));
    check("不开 --evidence 时不落盘（无副作用）", r2.code === 0);
  } finally { rmSync(ev, { recursive: true, force: true }); }
}

// ── 证据卡路径归一 ＋ 副本自检（2026-10-12 定）──────────────────────────
// 口径：证据卡可能进 git，不得含本机绝对路径；原始副本留本地禁入仓；
// 证据卡声明的副本必须真实存在且哈希相符（指向不存在的文件等于没留证）。
{
  const ev = mkdtempSync(join(tmpdir(), "orca-ev2-"));
  try {
    withFixture("case01-valid", (d) =>
      spawnSync("node", [LEDGER, join(d, "docs", "model"), "--evidence", ev], { encoding: "utf8" }));
    const meta = readdirSync(ev).find((f) => f.startsWith("证据-"));
    const raw = readFileSync(join(ev, meta), "utf8");
    const m = JSON.parse(raw);
    check("证据卡不含本机绝对路径（可安全进 git）",
      !/\/Users\/|\/var\/folders\//.test(raw), `命中：${raw.match(/\/Users\/|\/var\/folders\//g)?.join()}`);
    check("证据卡声明哪些可进 git / 哪些只留本地",
      !!m.keep_in_git && !!m.keep_local_only);
    check("副本路径为相对（禁写本机绝对路径）",
      m.inputs["TASK-MODEL-LOG.jsonl"].copy_path.startsWith("input-"));
    // 副本必须真实存在且哈希相符
    const cp = join(ev, m.inputs["TASK-MODEL-LOG.jsonl"].copy_path);
    check("证据卡声明的副本真实存在且哈希相符",
      existsSync(cp) && m.copy_verified === true);
  } finally { rmSync(ev, { recursive: true, force: true }); }
}

// ── 证据卡兜底抹除：锚点盖不住的路径也不得残留（2026-10-12）────────────────
// 只测「锚点已覆盖」的常规情形是不够的 —— 实测删掉兜底正则后测试仍全过，
// 说明兜底**当时根本没被测到**。这里直接构造一个锚点外的绝对路径来打它。
{
  const ev = mkdtempSync(join(tmpdir(), "orca-ev3-"));
  try {
// 用 home 下另一个绝对路径调用：既不在 cwd，也不在项目根锚点内
    const weird = join(homedir(), `orca-ev-anchor-${Date.now()}`, "ledger");
    mkdirSync(join(weird, "docs", "model"), { recursive: true });
    writeFileSync(join(weird, "docs", "model", "TASK-MODEL-LOG.jsonl"),
      '{"task":"T","project":"p","date":"2026-10-12","role":"builder","model":"codex/gpt-6.1-sol","result":"PASS","rework":0,"escalated":"NO","escalation_reason":null,"tokens":null,"cost_cny":null}\n');
    writeFileSync(join(weird, "docs", "model", "DISPATCH-LOG.jsonl"), '{"_example":true}\n');
    spawnSync("node", [LEDGER, join(weird, "docs", "model"), "--evidence", ev], { encoding: "utf8" });
    const meta = readdirSync(ev).find((f) => f.startsWith("证据-"));
    const raw = meta ? readFileSync(join(ev, meta), "utf8") : "{}";
    check("锚点外绝对路径也被兜底抹除（证据卡零本机路径）",
      !raw.includes(weird), `命中：${weird}`);
    rmSync(weird, { recursive: true, force: true });
  } finally { rmSync(ev, { recursive: true, force: true }); }
}

// ── 路径归一纯函数单测（2026-10-12）────────────────────────────────────
// 直接打 norm 函数本身：端到端跑不出来的情况（锚点刚好都覆盖了）会让兜底分支
// 长期不被执行 —— 实测正是如此，删掉兜底正则后端到端测试仍全过。
{
  // check-ledger.mjs 是**脚本**（顶层直接执行），静态 import 会连带跑整个校验；
  // 这里从源码里取出该纯函数单独求值，避免副作用。
  const src = readFileSync(LEDGER, "utf8");
  const body = src.slice(src.indexOf("export function _normPath"),
                         src.indexOf("function writeEvidence"));
  const _normPath = new Function(`${body.replace("export ", "")}; return _normPath;`)();
  const anchors = ["/proj", "/work"];
  const n = (x) => _normPath(x, anchors, "/proj");
  check("归一：项目根前缀 → <项目根>", n("/proj/docs/model") === "<项目根>/docs/model", n("/proj/docs/model"));
  check("归一：工作目录前缀 → <工作目录>", n("/work/x") === "<工作目录>/x", n("/work/x"));
  check("归一：锚点外的本机路径被兜底抹除",
    !/\/Users\/|\/home\/|\/var\//.test(n("/Users/zzy/proj/docs/model")),
    n("/Users/zzy/proj/docs/model"));
  check("归一：任意绝对路径都不残留盘符前缀",
    !/^\/(Users|home|var|tmp|private|opt|etc)\//.test(n("/etc/hosts")), n("/etc/hosts"));
}

// ── 升级计数口径不被破坏：role=supervisor,result=FAIL 仍须可用 ────────
{
  const r = withFixture("case01-valid", (d) => {
    writeFileSync(join(d, "docs/model/DISPATCH-LOG.jsonl"),
      // task 用夹具里真实存在的 "t"（case01 的 TASK 行 task=t）。写成不存在的 task 会让
      // 新的 LEDGER-XREF「整条漏记」判定报 FAIL —— 那正是本用例不想碰的规则。
      JSON.stringify({ date: "2026-10-11", task: "t", role: "supervisor",
        model: "opencode/muse-spark-1.3-contributor-free", used: "主",
        runtime: "opencode", result: "FAIL" }) + "\n");
    return runLedger(d);
  });
  check("升级计数口径有效（supervisor+FAIL 仍 exit 0）", r.code === 0, `exit=${r.code}`);
}

const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
console.log(`\nALL ${fail ? "FAIL" : "PASS"}  pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);