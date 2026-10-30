// delivery-unit.test.mjs | locks the 2026-10-17 "review granularity" rule.
// Why a test: this rule exists precisely because a reasonable-looking default
// ("every task goes through reviewer -> qa -> supervisor") kept happening and the user had to
// correct it repeatedly. A text rule that can silently drift back is the same failure it fixes.
// It must be DEFAULT policy -- not something the user has to switch on with a magic phrase.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}`); } };
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const readPrompt = () => {
  const bare = ["编排者提示词.md"];
  const nested = ["docs", "prompts", ...bare];
  for (const p of [nested.join("/"), bare[0]]) {
    try { return readFileSync(join(ROOT, p), "utf8"); } catch {}
  }
  throw new Error("orchestrator prompt not found");
};
// AGENTS.md 自 2026-10-22 只留「红线 + 索引」，细则下沉到 docs/sop/governance-*.md；
// 断言按治理文本集合判定（守住意图，不因下沉误报）。
const GOV_REL = ["AGENTS.md", "docs/sop/governance-scope.md", "docs/sop/governance-execution-modes.md",
  "docs/sop/governance-dispatch.md", "docs/sop/governance-ledger.md"];
const agents = GOV_REL.map((f) => { try { return read(f); } catch { return ""; } }).join("\n");
const prompt = readPrompt();

check("AGENTS: delivery-unit rule exists", agents.includes("交付单元"));
check("AGENTS: rule is explicitly DEFAULT policy (no magic phrase needed)",
  /复核粒度＝交付单元[\s\S]{0,200}不需任何额外口令/.test(agents));
check("AGENTS: single task = self-review only, no reviewer/qa/supervisor dispatch",
  /单个 task 完成时[\s\S]{0,200}不派 code-reviewer/.test(agents));
check("AGENTS: full chain runs once at the delivery-unit boundary",
  agents.includes("交付单元边界") && agents.includes("一次走完"));
check("AGENTS: ledger recording is kept even when review is deferred",
  /账本照记一行/.test(agents));
check("AGENTS: the four non-deferrable classes are listed",
  /不能延后的四类/.test(agents)
  && /公共契约[\s\S]{0,80}schema[\s\S]{0,80}鉴权/.test(agents)
  && /真机[\s\S]{0,40}线上数据/.test(agents)
  && /secrets 或不可逆删除/.test(agents));
check("AGENTS: quality gates are not weakened by this rule",
  /质量门一道没减/.test(agents));

check("prompt: delivery-unit rule propagated", prompt.includes("交付单元"));
check("prompt: states it needs no command", /默认制度、不需口令/.test(prompt));
check("prompt: four non-deferrable classes propagated", prompt.includes("不得延后的四类"));

for (const f of ["docs/roles/qa.md", "docs/roles/code-reviewer.md", "docs/roles/supervisor.md"]) {
  check(`${f}: states the granularity`, read(f).includes("交付单元"));
}

// 2026-10-17 铺包权限（因一次误伤 39 个项目而定）：批量铺包只有母版干，单项目必须用 ONLY_LIST。
{
  const sc = read("scripts/sync-old-projects.sh");
  check("sync: ONLY_LIST exists and selects only listed projects", /ONLY_LIST/.test(sc));
  check("sync: AGENTS states batch sync is mother-orchestrator only",
    /批量铺包只有母版编排者能干/.test(agents));
  check("AGENTS: single-project update must use ONLY_LIST, ban-exclude-list forbidden",
    /ONLY_LIST="<项目名>"/.test(agents) && /禁用|禁止/.test(agents));
}

// 2026-10-17 second pass: the slow part was not only WHO reviews, but HOW MUCH evidence each
// small task had to produce. Heavy QA evidence and formal review/QA reports now happen once per
// delivery unit, not per task; manual md5 ledger diffing is banned outright.
const qa = read("docs/roles/qa.md");
check("qa card: heavy evidence is scoped to the delivery-unit boundary",
  /重证据手段[\s\S]{0,200}只在交付单元边界要求一次/.test(qa));
check("qa card: single-task QA has a stated action ceiling",
  /单 task 阶段[\s\S]{0,160}不得因「证据不齐」判 FAIL/.test(qa));
check("AGENTS: formal review/QA reports are produced once per delivery unit",
  /留痕粒度＝交付单元/.test(agents));
check("AGENTS: manual md5 ledger diffing is banned (machine check replaced it)",
  /禁止再手工 md5 比对/.test(agents));
check("prompt: single-task action ceiling propagated",
  /单 task 阶段的动作上限/.test(prompt));

// 2026-10-22 常驻管理工作区永不铺包（000-alw-* 是管理工作区，不是项目）。
// 黑名单必须**优先于 ONLY_LIST**：显式点名也跳过，否则白名单可绕过黑名单。
{
  const sc = read("scripts/sync-old-projects.sh");
  check("sync: 000-alw-* resident workspaces are blacklisted",
    /000-alw-\*/.test(sc));
  check("sync: blacklist is applied in the project loop (not just mentioned)",
    /SKIP\(常驻管理工作区/.test(sc));
  check("sync: blacklist precedes ONLY_LIST filter",
    (() => {
      // 行为判定（比读代码可靠）：真跑一次干跑，看**常驻工作区是否被点名跳过**。
      // 用 ONLY_LIST 点名一个常驻工作区 —— 它必须仍被跳过（黑名单优先于白名单）。
      const sh = join(ROOT, "scripts/sync-old-projects.sh");
      let out = "";
      try {
        out = execFileSync("bash", [sh, "--dry-run"], {
          env: { ...process.env, ONLY_LIST: "000-alw-数据库管理专家", SKIP_DEV_TODAY: "0" },
          encoding: "utf8",
        });
      } catch (e) { out = String(e.stdout || ""); }
      const skipped = out.includes("SKIP(常驻管理工作区");
      const zeroProjects = /项目数:\s*0/.test(out);
      return skipped && zeroProjects;
    })());
  check("AGENTS: resident workspaces never receive the governance package",
    /常驻管理工作区永不铺包/.test(agents));
  check("AGENTS: the 000-alw-* prefix is named explicitly",
    /000-alw-\*/.test(agents));
}

// 2026-10-22 铺包铁律：绝不删除别人的文件（056 项目事故）。
{
  check("AGENTS: never delete files in project directories",
    /不得删除、清空、覆盖/.test(agents) && /项目目录里的东西是别人的成果/.test(agents));
  check("AGENTS: new-project setup has a safety gate + zero-loss self-check",
    /拒绝铺包/.test(agents) && /零丢失/.test(agents));
  check("setup script exists and never recursively deletes a project path",
    (() => {
      const s = read("scripts/new-project-setup.sh");
      // 只看**代码行**（跳过注释）——注释里复盘事故时提到过那条命令，不该误判。
      const code = s.split("\n").filter(l => !/^\s*#/.test(l)).join("\n");
      // 拦的是**递归删除**（rm -rf / rm -r / rm --recursive）指向项目路径；
      // 单文件 rm -f 是允许的（软链替换、实文件换软链都必需）。
      return !/rm\s+(-[a-zA-Z]*[rR][a-zA-Z]*\s+)+"?\$\{?PROJ/.test(code)
          && !/rm\s+--recursive[^\n]*\$\{?PROJ/.test(code);
    })());
}

// must NOT have regressed into "every task gets the full chain"
check("no per-task full-chain wording remains in the prompt",
  !/每个[ t]*task[\s\S]{0,40}Builder→Code Reviewer→QA→Supervisor/.test(prompt));

console.log(`\nALL ${fail === 0 ? "PASS" : "FAIL"}  pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
