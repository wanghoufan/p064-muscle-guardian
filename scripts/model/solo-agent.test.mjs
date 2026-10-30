#!/usr/bin/env node
// solo-agent.test.mjs｜单智能体执行方式的回归测试（2026-10-10 用户定「两种执行方式」）
//
// 目的：让「单智能体不被强制走整套多角色派工与账本」与「质量门禁一条不减」两条
//       口径**可被反复执行**，而不是一次性人工核对。
// 跑法：node scripts/model/solo-agent.test.mjs
//
// 用例分两组：
//   A 组｜单智能体免管理负担——DISPATCH-LOG 可留空、check-ledger 不因此 FAIL
//   B 组｜质量门禁不因单智能体而失效——APP 基线硬门对单智能体项目照常 FAIL
// 每个用例是隔离的最小项目夹具，落在 fixtures/solo-agent/（版本库内固定路径，禁清场）。
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdtempSync, cpSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const LEDGER = join(HERE, "check-ledger.mjs");
const FIX = join(HERE, "fixtures", "solo-agent");

function runLedger(projectDir, { allowExample = false } = {}) {
  // check-ledger.mjs 吃的是账本所在目录（docs/model/）；项目根由它自己往回推两级
  const dir = join(projectDir, "docs", "model");
  const args = allowExample ? [dir, "--allow-example"] : [dir];
  try {
    const out = execFileSync("node", [LEDGER, ...args], { encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

// 把夹具拷进临时目录再跑：check-ledger 会按项目根读 docs/ 与 docs/model/，
// 直接在夹具上跑会把结果写进夹具，破坏夹具的原始状态。
function withFixture(name, fn) {
  const src = join(FIX, name);
  if (!existsSync(src)) throw new Error(`缺夹具：${src}`);
  const tmp = mkdtempSync(join(tmpdir(), "orca-solo-"));
  try {
    cpSync(src, tmp, { recursive: true });
    return fn(tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS " : "FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
}

// ── A 组｜管理负担可省，账本校验不因此 FAIL ──────────────────────────
{
  const r = withFixture("case1-no-dispatch", (d) => runLedger(d));
  check("A1 单智能体无派工：DISPATCH-LOG 留空不 FAIL",
    r.code === 0 && /LEDGER-OK/.test(r.out), `exit=${r.code}`);
  check("A2 空派工账本只报 WARN（不造行即可）",
    /DISPATCH-LOG\.jsonl: 空账本/.test(r.out));
}
{
  const r = withFixture("case2-self-reviewed", (d) => runLedger(d));
  check("A3 自审任务行合法（role=builder/chain_status 可用）",
    r.code === 0 && /LEDGER-OK/.test(r.out), `exit=${r.code}`);
}

// ── A' 组｜「留空即可」≠「删文件」：账本文件缺失仍须 FAIL ─────────────
{
  // 单智能体免的是「造行」，不是「免登记」。删掉账本文件等于绕过登记口径，必须拦住。
  const r = withFixture("case5-ledger-file-removed", (d) => runLedger(d));
  check("A4 账本文件缺失仍 FAIL（可留空、不可删文件绕过登记）",
    r.code === 1 && /MISSING/.test(r.out), `exit=${r.code}`);
}

// ── B 组｜质量门禁不减：APP 基线硬门对单智能体照常生效 ───────────────
{
  const r = withFixture("case3-app-baseline-missing", (d) => runLedger(d));
  check("B1 单智能体项目需求真源不可判定仍 FAIL（不得因单智能体放行）",
    r.code === 1 && /APP-TRUEOUT-SOURCE-UNRESOLVED/.test(r.out), `exit=${r.code}`);
}
{
  const r = withFixture("case4-keyword-in-plan-only", (d) => runLedger(d));
  check("B2 关键 AC 集合为空仍 FAIL（不得因单智能体跳过）",
    r.code === 1 && /APP-CRITICAL-AC-EMPTY|APP-CRITICAL-AC-INCOMPLETE|APP-BASELINE/.test(r.out),
    `exit=${r.code}`);
}

function grepHit(file, pattern) {
  try { execFileSync("grep", ["-q", pattern, file]); return true; } catch { return false; }
}

// 母版专属 vs 项目通用：这个测试里有一组断言查的是**母版仓库结构**
// （两包 + 对外概览 ORCA治理体系说明.md）。这些文件在真实项目里不存在，
// 铺过去跑必然 FAIL —— 2026-10-12 实测：040 同步后 solo-agent 8/15，
// 7 条失败全是「找不到 新项目模板包/…」。
// 处置：**母版专属断言在非母版自动跳过并显式报出**，不算 PASS 也不算 FAIL；
// 角色卡/AGENTS/README 这些**项目也有的**文件仍然照常校验。
const IS_MASTER = existsSync(join(HERE, "..", "..", "新项目模板包", "AGENTS.md"));

// ── 治理规则文本聚合（2026-10-22 瘦身新增）────────────────────────────
// AGENTS.md 自 2026-10-22 起只留「红线 + 索引」，细则下沉到 docs/sop/governance-*.md。
// 因此「规则文本是否存在」一律按**治理文本集合**判定，而不是只看 AGENTS.md。
// 这样既守住断言意图（规则必须在现行真源里），又不因下沉而误报。
const GOV_REL = [
  "AGENTS.md",
  join("docs", "sop", "governance-scope.md"),
  join("docs", "sop", "governance-execution-modes.md"),
  join("docs", "sop", "governance-dispatch.md"),
  join("docs", "sop", "governance-ledger.md"),
];
const govText = (root) => GOV_REL.map((f) => {
  try { return readFileSync(join(root, f), "utf8"); } catch { return ""; }
}).join("\n");
const govHit = (root, phrase) => GOV_REL.some((f) => {
  try { return grepHit(join(root, f), phrase); } catch { return false; }
});

const skipIfNotMaster = (name) => {
  if (!IS_MASTER) {
    console.log(`SKIP  ${name}（母版专属断言：非母版仓库无两包/概览结构，已跳过而非伪装 PASS）`);
    return true;
  }
  return false;
};

// ── C 组｜规则文本到位（单智能体口径写进了母版与两包）────────────────
{
  const ROOT = join(HERE, "..", "..");
  const targets = [
    ["AGENTS.md", "AGENTS.md"],
    ["README.md", "README.md"],
    ["ORCA治理体系说明.md", "ORCA治理体系说明.md"],
    [join("docs", "roles", "builder.md"), join("docs", "roles", "builder.md")],
    [join("docs", "roles", "code-reviewer.md"), join("docs", "roles", "code-reviewer.md")],
    [join("docs", "roles", "qa.md"), join("docs", "roles", "qa.md")],
    [join("新项目模板包", "AGENTS.md"), join("新项目模板包", "AGENTS.md")],
    [join("新项目模板包", "README.md"), join("新项目模板包", "README.md")],
    [join("老项目迁移模板包", "AGENTS.md"), join("老项目迁移模板包", "AGENTS.md")],
    [join("老项目迁移模板包", "README.md"), join("老项目迁移模板包", "README.md")],
  ];
  const MASTER_ONLY = new Set([join("新项目模板包", "AGENTS.md"), join("新项目模板包", "README.md"),
    join("老项目迁移模板包", "AGENTS.md"), join("老项目迁移模板包", "README.md"),
    "ORCA治理体系说明.md"]);   // 仅母版仓库有，项目里不存在
  const absent = targets
    .filter(([f]) => !(MASTER_ONLY.has(f) && !IS_MASTER))   // 非母版时不算这些缺失
    .filter(([f]) => !existsSync(join(ROOT, f)) || !grepHit(join(ROOT, f), "主开发者"))
    .map(([f]) => f);
  if (!skipIfNotMaster("C1 单智能体口径已写入母版与两包关键文件"))
    check("C1 主开发者口径已写入母版与两包关键文件", absent.length === 0, absent.join(", "));
}
{
  const ROOT = join(HERE, "..", "..");
  // 不得把「独立审查」当默认口径：多智能体角色卡的独立性要求必须仍然在文
  const multiOk = ["builder.md", "code-reviewer.md", "qa.md"].every((f) =>
    grepHit(join(ROOT, "docs", "roles", f), "只约束多智能体"));
  check("C2 多智能体独立性要求仍保留在角色卡内（未被单智能体口径覆盖）", multiOk);
}

// ── C' 组｜触发口令「你是主开发者」到位 ─────────────────────────────
{
  const ROOT = join(HERE, "..", "..");
  // 用户只发这一句就够：口令必须写在规则里，且写明「不再询问／不自动派工／自行找规范」
  const phrase = "你是主开发者";
  const parts = [
    [phrase, "触发口令原文（2026-10-17 改名）"],
    ["你是唯一开发者", "旧口令保留为同义别名（不得失效）"],
    ["不得再次询问", "不再询问是否启用"],
    ["不得自动派遣其他治理角色", "不自动派遣治理角色"],
    ["按需查找、读取并执行现有规范", "自行读取现有规范"],
    ["用户不负责逐项指定规范", "用户不指定规范"],
    ["不代表跳过产品方案确认", "不跳过 Human Gate 与授权"],
  ];
  const miss = parts.filter(([kw]) => !govHit(ROOT, kw)).map(([, label]) => label);
  check("C3 触发口令与配套条款在治理规则文本齐备（AGENTS + governance-*.md）", miss.length === 0, miss.join(", "));

  const rd = join(ROOT, "README.md");
  const rdOk = grepHit(rd, phrase) && grepHit(rd, "自行读取") && grepHit(rd, "只决定执行模式");
  if (!skipIfNotMaster("C4 README 说明「只需说这一句」且注明不跳过 Gate"))
    check("C4 README 说明「只需说这一句」且注明不跳过 Gate", rdOk);

  // 两包同步后口令必须同样可用（复制模板即可生效）
  const pkgs = ["新项目模板包", "老项目迁移模板包"]
    .filter((p) => grepHit(join(ROOT, p, "AGENTS.md"), phrase)).length;
  if (!skipIfNotMaster("C5 触发口令随两包分发（复制模板即可生效）"))
    check("C5 触发口令随两包分发（复制模板即可生效）", pkgs === 2, `命中 ${pkgs}/2`);
}

// ── C''' 组｜触发口令必须出现在**每个对外必现位** ────────────────────
// 回归：首轮实现只写了 AGENTS.md/README，漏了对外概览与三张角色卡，
// 靠人工发现。口令是用户唯一入口，漏一处＝该处读者不知道有这回事。
{
  const ROOT = join(HERE, "..", "..");
  const phrase = "你是主开发者";
  const spots = [
    ["AGENTS.md", "触发口令"],
    ["README.md", "用户导航"],
    ["ORCA治理体系说明.md", "对外概览（四件套第 2 步，仅母版有)"],
    [join("docs", "roles", "builder.md"), "角色卡 builder"],
    [join("docs", "roles", "code-reviewer.md"), "角色卡 code-reviewer"],
    [join("docs", "roles", "qa.md"), "角色卡 qa"],
  ];
  // 「对外概览」只有母版有（老项目没有两包概念，概览无对外用途），非母版跳过该位
  const MASTER_ONLY = !IS_MASTER && "ORCA治理体系说明.md";
  const absent = spots
    .filter(([f]) => f !== MASTER_ONLY)
    .filter(([f]) => !existsSync(join(ROOT, f)) || !grepHit(join(ROOT, f), phrase))
    .map(([, label]) => label);
  if (!skipIfNotMaster("C7 触发口令在概览与三张角色卡齐备（不只在 AGENTS/README）"))
    check("C7 触发口令在概览与三张角色卡齐备（不只在 AGENTS/README）",
      absent.length === 0, absent.join(", "));

  // check-sync.sh 本身也只在母版（老项目的同步由母版脚本统一做）
  if (!skipIfNotMaster("C8 check-sync 关键词清单含口令（漏同步会自动 OVERVIEW-STALE）")) {
    const cs = join(ROOT, "scripts", "check-sync.sh");
    check("C8 check-sync 关键词清单含口令（漏同步会自动 OVERVIEW-STALE）",
      grepHit(cs, `"${phrase}"`));
  }
}

// ── C'' 组｜不得擅自切换模式 ────────────────────────────────────────
{
  const ROOT = join(HERE, "..", "..");
  const ok = govHit(ROOT, "不得擅自改变既定执行方式")
    && govHit(ROOT, "多智能体（默认）");
  check("C6 多智能体仍为默认，且无要求时不得擅自改模式", ok);
}

// ── D 组｜不得出现第二套体系（无单智能体专属文件/目录）───────────────
{
  const ROOT = join(HERE, "..", "..");
  const suspects = [];
  for (const d of ["docs/roles", "docs/sop", "docs/pm", "docs/qa", "docs/review",
    "docs/templates", "docs/prompts"]) {
    const base = join(ROOT, d);
    let items = [];
    try { items = readdirSync(base, { withFileTypes: true }); } catch { continue; }
    for (const it of items) {
      if (/solo|单智能体|single-agent/i.test(it.name)) suspects.push(`${d}/${it.name}`);
    }
  }
  check("D1 无单智能体专属角色卡/SOP/模板包（未产生第二套体系）",
    suspects.length === 0, suspects.join(", "));
}

const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
// ── E 组｜2026-10-17 更正：主开发者 ≠ 只能一个人串行干活 ────────────────
// 回归背景：原 AGENTS.md 写着「不得因为客户端支持子智能体就自动派工」，
// 「唯一开发者」这个口令又把人数锁死 —— 于是子代理并行被长期误禁用。
// 这组用例保证「可并行执行」这条永远不会被重新删掉。
{
  const md = govText(join(HERE, "..", ".."));
  check("E1 明确「不派治理角色链」而不是「不派智能体」",
    md.includes("不得自动派遣其他治理角色") || md.includes("不派治理角色链"));
  check("E2 明确允许并鼓励派子代理并行推进",
    /允许、且鼓励用子代理并行推进执行任务/.test(md));
  check("E3 写明「不是只能一个人串行干活」",
    md.includes("不是「只能一个人串行干活」"));
  check("E4 执行层／判定层分界写清",
    /执行层可外包给子代理/.test(md) && /判定层不外包/.test(md));
  check("E5 子代理产出须附证据且落 docs/qa/<交付单元>/",
    md.includes("可核查证据") && md.includes("docs/qa/<交付单元>/"));
  check("E6 子代理不算独立审查者（标注不许拔高）",
    md.includes("不是独立审查者"));
  check("E7 关键路径主开发者须亲手复验一次",
    /关键路径主开发者至少亲手复验一次/.test(md));
  check("E7b 子代理模型/强度口径已写清",
    /子代理的模型与推理强度怎么定/.test(md)
    && /先看客户端支不支持/.test(md)
    && /Codex 系与桌面版 GPT/.test(md)
    && /省额度/.test(md)
    && /优先用本体系分工表里的模型/.test(md)
    && /不要写无法执行的规则/.test(md)
    && /默认继承主线程/.test(md)
    && /只有 GPT 一侧才讲模型映射/.test(md)
    && /WorkBuddy／Qoder／CodeBuddy sh／opencode 等其他智能体与开发平台/.test(md)
    && /一律继承主开发者模型/.test(md)
    && /执行层在 GPT 侧统一用 `opencode-go\/deepseek-v4\.1-flash`/.test(md)
    && /按频率限额/.test(md)
    && /\| 子代理在干什么 \| 取哪一行 \| 现役模型 \|/.test(md)
    && /写代码、改代码/.test(md)
    && /只读研究、竞品\/参考资料调研/.test(md)
    && /数据库 schema 审查/.test(md)
    && /复核、判 PASS\/FAIL、宣布收工/.test(md)
    && /禁把治理角色映射给子代理/.test(md)
    && /不许声称/.test(md));
  check("E8 该模式下你不是编排者",
    md.includes("你不是编排者"));
  check("E9 旧的禁并行窄表述已删除（治理规则文本全集）",
    !/不得因为当前客户端支持子智能体就自动派工/.test(md));

  // 同一句窄表述当初也出现在 README（两包都带着），只改 AGENTS 等于没改 ——
  // 这次实测就是把 README 里那句漏掉才被发现。README 与概览一起纳入。
  const rd = readFileSync(join(HERE, "..", "..", "README.md"), "utf8");
  check("E10 README 里的禁并行窄表述已删除", !/不会因为当前客户端支持子智能体就自动派工/.test(rd));
  check("E10 README 章节名与治理规则文本/概览指向一致（链接不得是死的）",
    rd.includes("主开发者开发使用说明") && md.includes("主开发者开发使用说明"));
  check("E11 README 写明「不是只能一个人干活」并给出执行层/判定层",
    rd.includes("只能一个人干活") && rd.includes("执行层") && rd.includes("判定层"));

  const ov = join(HERE, "..", "..", "ORCA治理体系说明.md");
  if (existsSync(ov)) {
    const ovd = readFileSync(ov, "utf8");
    check("E12 概览写清并行边界与旧口令别名",
      ovd.includes("执行层") && ovd.includes("判定层") && ovd.includes("你是唯一开发者"));
  }
}

console.log(`\nALL ${fail ? "FAIL" : "PASS"}  pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);