#!/usr/bin/env node
// governance-size.test.mjs | 体积闸与入口闸边界自测（2026-10-27）
// 用法：node scripts/model/governance-size.test.mjs
// 覆盖：恰好等于上限放行、超一行/超一字节拦住、旧读盘顺序表述拦住、入口标记重复拦住、常驻文件缺失拦住。
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const CHECK = join(ROOT, "scripts", "check-sync.sh");
const MARKER = "入口路由（全体系唯一）";
// 用 join 拼路径，避免 `docs/prompts/` 字面量被两包同步器归一化后造成包内漂移。
const PROMPT_CARD = ["docs", "prompts", "编排者提示词.md"].join("/");

const ROUTE_FILES = [
  "AGENTS.md",
  "README.md",
  "README.en.md",
  "ORCA治理体系说明.md",
  "经验一句话.md",
  PROMPT_CARD,
  "docs/handoff/HANDOFF.md",
  "docs/handoff/HANDOFF.template.md",
];

function filler(lines, prefix = "x") {
  return Array.from({ length: lines }, (_, i) => `${prefix}${i + 1}`).join("\n") + "\n";
}

function makeFixture(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "orca-size-"));
  const files = {
    "AGENTS.md": `# A\n\n> ${MARKER}\n`,
    "README.md": "# R\n",
    "README.en.md": "# R\n",
    "ORCA治理体系说明.md": "# O\n",
    "经验一句话.md": filler(3, "- e"),
    [PROMPT_CARD]: "# P\n",
    "docs/handoff/HANDOFF.template.md": "# T\n",
    "docs/handoff/HANDOFF.md": filler(100),
    "docs/architecture-facts.md": filler(150),
    "docs/risks.md": filler(100),
    "agent.md": filler(200),
    ...overrides,
  };
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue;
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

function runGate(dir) {
  try {
    const out = execFileSync("bash", [CHECK, "--self-test-size", dir], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

let pass = 0;
let fail = 0;
function check(name, dir, expectCode, expectText) {
  const r = runGate(dir);
  const okCode = r.code === expectCode;
  const okText = expectText ? r.out.includes(expectText) : true;
  if (okCode && okText) {
    pass += 1;
    console.log(`PASS ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL ${name} (exit=${r.code}, want=${expectCode})`);
    if (!okText) console.log(`  missing text: ${expectText}`);
    console.log(r.out.trim().split("\n").map((l) => `  | ${l}`).join("\n"));
  }
  rmSync(dir, { recursive: true, force: true });
}

check("T1 恰好 100 行 / 8192 字节放行", makeFixture(), 0, null);

check(
  "T2 HANDOFF 101 行拦住",
  makeFixture({ "docs/handoff/HANDOFF.md": filler(101) }),
  1,
  "HANDOFF-SIZE"
);

check(
  "T3 HANDOFF 超 8192 字节拦住",
  makeFixture({ "docs/handoff/HANDOFF.md": "y".repeat(8193) + "\n" }),
  1,
  "HANDOFF-SIZE"
);

check(
  "T4 经验条目超 8192 字节拦住",
  makeFixture({ "经验一句话.md": "z".repeat(8193) + "\n" }),
  1,
  "LESSONS-SIZE"
);

check(
  "T5 旧读盘顺序表述拦住",
  makeFixture({ "README.md": "开工读盘顺序：先读 AGENTS.md\n" }),
  1,
  "ENTRY-LEGACY"
);

check(
  "T6 入口标记重复拦住",
  makeFixture({ "AGENTS.md": `# A\n\n> ${MARKER}\n> ${MARKER}\n` }),
  1,
  "ENTRY-DUP"
);

check(
  "T7 常驻文件缺失拦住",
  makeFixture({ "docs/risks.md": null }),
  1,
  "RISKS-SIZE-MISSING"
);

check(
  "T8 架构事实超 150 行拦住",
  makeFixture({ "docs/architecture-facts.md": filler(151) }),
  1,
  "FACTS-SIZE"
);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail === 0 ? 0 : 1);
