// continuous-push.test.mjs | regression for the "yilu tuidi" (continuous push) authorization.
//
// The 2026-10-17 self-audit found a real contradiction: AGENTS.md said the Human Gate can
// never be crossed automatically, while the very same file's continuous-push clause said
// PLAN completion auto-enters DEVELOP -- and the orchestrator prompt contradicted itself
// in THREE places (line 22 auto / line 34 stop / line 39 refuse). An executioner reading
// that has to guess, and guessing wrong means either developing without approval or
// stalling despite having approval. This test locks the wording so it cannot drift back.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}`); } };
const readPrompt = () => {
  const bare = ["编排者提示词.md"];
  const nested = ["docs", "prompts", ...bare];
  for (const p of [nested.join("/"), bare[0]]) {
    try { return readFileSync(join(ROOT, p), "utf8"); } catch {}
  }
  throw new Error("orchestrator prompt not found");
};
// AGENTS.md 自 2026-10-22 只留「红线 + 索引」，细则下沉到 docs/sop/governance-*.md。
const GOV_REL = ["AGENTS.md", "docs/sop/governance-scope.md", "docs/sop/governance-execution-modes.md",
  "docs/sop/governance-dispatch.md", "docs/sop/governance-ledger.md"];
const agents = GOV_REL.map((f) => {
  try { return readFileSync(join(ROOT, f), "utf8"); } catch { return ""; }
}).join("\n");
const prompt = readPrompt();

check("AGENTS: continuous-push clause exists", agents.includes("一路推到底"));
check("AGENTS: Human Gate clause names the exception instead of being absolute",
  /Human Gate[\s\S]{0,600}唯一例外/.test(agents));
check("AGENTS: default is still stop (no auto-cross without the order)",
  agents.includes("默认停、授权才自动"));
check("AGENTS: first-release sign-off is still required under continuous push",
  /连续推进授权[\s\S]{0,900}首次发布用户签收仍必须停/.test(agents));
check("prompt: Phase-1 table row says auto-enter under continuous push", prompt.includes("自动进入 DEVELOP"));
check("prompt: product-review step carries the same exception",
  /再说`第二阶段，开发`才进 DEVELOP。\*\*例外\*\*/.test(prompt));
check("prompt: 'no development without approval' clause carries the same exception",
  /未经批准禁开发（未说`第二阶段，开发`且无`一路推到底`授权/.test(prompt));
check("prompt: Phase2 entry line carries the same exception",
  /`一路推到底`连续推进模式下由当次授权覆盖、直接进入/.test(prompt));
check("no absolute auto-cross wording left in the prompt",
  !/一律自动进入 DEVELOP|无条件进入 DEVELOP/.test(prompt + agents));

console.log(`\nALL ${fail === 0 ? "PASS" : "FAIL"}  pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
