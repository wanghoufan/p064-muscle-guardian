#!/usr/bin/env node
// ui-leak.mjs — 用户界面内部信息泄露扫描（docs/sop/app-ui-layers.md 的机器辅助）
//
// 定位：**提示工具**，不是新的 Gate。它扫描用户界面源码/原型，找出 L3 内部信息
//       可能被渲染到普通用户界面的地方，供既有 QA / Code Reviewer 人工语义核验。
//       命中不等于必须改（见 §5 误伤白名单）；未达标准走原有返工机制。
//
// 用法：
//   node scripts/model/ui-leak.mjs <path...>          # 扫描目录或文件
//   node scripts/model/ui-leak.mjs <path> --json     # 机器可读
//
// 设计要点：
//   1. **不机械禁用**：地区玩法名、玩法版本、查看来源、安全/法律提示不算泄露。
//   2. **区分"数据键"与"上屏文案"**：像 i18n.js 里的 `E01: { title: "13张等待另一张二条" }`
//      是把内部 ID 当**键**、上屏的是人话标题——这是**正确**做法，不应误报。
//      只有当内部标识**本身**出现在上屏文案里（title/text/label/body 等面向用户的值）才报。
//   3. 覆盖真实渲染：既扫静态 HTML 文案，也扫 JS 里写给界面的字符串赋值。

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const asJson = process.argv.includes("--json");
if (!args.length) {
  console.error("usage: node ui-leak.mjs <path...> [--json]");
  process.exit(2);
}

const SKIP_DIR = new Set(["node_modules", ".git", "assets", "images", "vendor"]);
const EXT = new Set([".html", ".htm", ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".dart", ".kt", ".swift"]);

// L3 内部信息模式：只在"面向用户的文案"里才算泄露
// 注意 `action-code`（data-act / act=）**故意不收**：它们是 DOM 事件钩子，永不上屏。
const LEAKS = [
  { id: "evidence-grade", re: /(证据等级|置信度内部等级)\s*[:：]/g, why: "内部证据/置信等级（L3），须转成用户能懂的话" },
  { id: "evidence-grade-en", re: /\bevidence[_-]?grade\b(?![}\s]*[:：]\s*["'])/g, why: "evidence_grade 字段（L3），勿直接上屏" },
  { id: "internal-id", re: /\b(DRAW_S\d+|E\d{2,3})\b(?!\s*[:：])/g, why: "内部数据 ID（L3），须换成用户可读名称", skipAsKey: true },
  { id: "ac-fr", re: /\b(AC|FR|INT|ST|SCR)-\d+\b/g, why: "AC/FR/交互/状态编号（L3），不得上屏", skipAsKey: true },
  { id: "phase-gate", re: /\b(Phase\s*\d|门禁)\b/gi, why: "Phase/Gate（L3），仅记录在原型 README 等内部资料" },
  { id: "dev-version", re: /\bv?\d+\.\d+\.\d+(-[a-z0-9.]+)?\b(?=[^\n]{0,20}(build|版本|version))/gi, why: "开发版本号（L3）；用户需要的玩法版本除外" },
  { id: "hash", re: /\b[0-9a-f]{8,}\b(?=[^\n]{0,20}(commit|sha|hash|校验))/gi, why: "构建/提交 hash（L3）" },
];

// 动态渲染线索：把内部字段变量直接塞进可见文本，无法靠字面量捕捉
const DYNAMIC = [
  { re: /esc\(\s*\w+\.id\s*\)/g, why: "把内部 .id 直接渲染到界面；应改用可读名称" },
  { re: /\btextContent\s*=\s*[^;\n]*\.\s*id\b/g, why: "把内部 .id 赋给可见文本" },
  { re: /\[\s*[\w.]*[Ii]d\s*,\s*esc\(/g, why: "元数据行直接展示 id（L3），应换可读名称" },
];

// 误伤白名单：这些上下文里的相同字样是**正当**的用户可见内容
const ALLOW = [
  // 地区玩法名（真实用户需要的规则差异）
  /(四川|海南|广东|重庆|全国|国标|竞技|雀魂|立直)/,
  // 查看来源功能与其链接
  /(查看来源|来源|出处|参考资料|资料来源|原文链接)/,
  // 必要安全/法律/隐私提示
  /(安全|风险|不适|疼痛|停止|退出|隐私|授权|许可|版权|免责声明|同意)/,
  // 玩法版本（用户可感知的规则版本，非开发版本号）
  /(版本|规则版本|玩法版本)/,
];

function collectFiles(p, out = []) {
  const st = statSync(p);
  if (st.isFile()) { if (EXT.has(extname(p))) out.push(p); return out; }
  for (const name of readdirSync(p)) {
    if (SKIP_DIR.has(name)) continue;
    const f = join(p, name);
    try { collectFiles(f, out); } catch { /* unreadable */ }
  }
  return out;
}

// 判断该行是否属于"正当用户内容"（白名单放行）
function allowlisted(line) { return ALLOW.some((re) => re.test(line)); }

// 判断是否为"把内部 ID 当数据键"的正确写法（如 i18n 里 `E01: { title: "人话" }`）
function isDataKey(line, id) {
  if (id === "evidence-grade" || id === "phase-gate" || id === "hash" || id === "dev-version") return false;
  // 形如  E01: {  /  "E01": {  /  case 'E01'  → 键，不是上屏文案
  return new RegExp(`(^|[{,\\[]\\s*)["']?\\b${id === "internal-id" ? "(DRAW_S\\d+|E\\d{2,3})" : "[A-Z]+-\\d+"}\\b["']?\\s*:`).test(line)
      || new RegExp(`\\b${id === "internal-id" ? "(DRAW_S\\d+|E\\d{2,3})" : "[A-Z]+-\\d+"}\\b\\s*:`).test(line);
}

const findings = [];
for (const root of args) {
  if (!existsSync(root)) { console.error(`skip (missing): ${root}`); continue; }
  for (const file of collectFiles(root)) {
    let text;
    try { text = readFileSync(file, "utf8"); } catch { continue; }
    const lines = text.split("\n");
    let inBlock = false;   // 跨行 /* ... */ 注释状态
    lines.forEach((line, i) => {
      const t = line.trim();
      // 注释判定：单行 // 、跨行 /* */、HTML <!-- -->、Python/Shell #；跟踪块注释开合
      let comment = inBlock;
      if (!comment && (t.startsWith("//") || t.startsWith("#") || t.startsWith("*"))) comment = true;
      if (t.includes("/*") && !t.includes("*/")) inBlock = true;
      else if (t.includes("*/")) inBlock = false;
      if (t.includes("<!--")) comment = true;
      if (comment || allowlisted(line)) return;
      // 字面量泄露
      for (const rule of LEAKS) {
        const re = new RegExp(rule.re.source, rule.re.flags);
        let m;
        while ((m = re.exec(line)) !== null) {
          if (isDataKey(line, rule.id)) break;
          findings.push({ file, line: i + 1, id: rule.id, match: m[0].trim(), why: rule.why, text: line.trim().slice(0, 120) });
          break; // 每行每规则只报一次，避免刷屏
        }
      }
      // 动态渲染线索（内部字段变量直接上屏）
      for (const rule of DYNAMIC) {
        const re = new RegExp(rule.re.source, rule.re.flags);
        const m = line.match(re);
        if (m) {
          findings.push({ file, line: i + 1, id: "dynamic-render", match: m[0].trim(), why: rule.why, text: line.trim().slice(0, 120) });
          break;
        }
      }
    });
  }
}

if (asJson) {
  console.log(JSON.stringify({ findings, count: findings.length }, null, 2));
} else {
  if (!findings.length) {
    console.log("UI-LEAK: 0 suspicious internal-info occurrences (提示性扫描，非判定)");
  } else {
    console.log(`UI-LEAK: ${findings.length} suspicious occurrence(s) — 人工语义核验后判定（见 docs/sop/app-ui-layers.md §5）\n`);
    for (const f of findings) {
      console.log(`  ${f.file}:${f.line}  [${f.id}] "${f.match}"`);
      console.log(`      ${f.why}`);
    }
  }
}
// 提示工具：永不因扫描结果自行判 FAIL；是否返工由既有 QA/Code Reviewer 决定。
process.exit(0);