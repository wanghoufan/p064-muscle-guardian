#!/usr/bin/env node
// prototype-gate.test.mjs｜Phase1 可运行原型交付门禁的回归测试（P046 教训，2026-10-09）
//
// 目的：让「仅提交 Product Plan + PDF 截图不得进入人工原型审批；补齐可运行 HTML
//       + 核心交互测试通过 + 打开方式后才放行」这条规则**可被反复执行**，而不是
//       一次性人工验证。跑法：node scripts/model/prototype-gate.test.mjs
//
// 判定对象：check-ledger.mjs 的 Phase1 原型交付检查（PROTO-MISSING /
//       PROTO-NO-RUNTIME-EVIDENCE）。每个用例是一个隔离的最小 APP 项目夹具。
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LEDGER = join(HERE, "check-ledger.mjs");
const FIX = join(HERE, "fixtures", "proto-gate");

// 用例：[名称, 夹具目录, 期望 exit, 必须出现的码, 必须不出现的码]
const CASES = [
  ["仅 Product Plan + PDF 截图", "case1-plan-only", 1, ["PROTO-MISSING"], ["PROTO-NO-RUNTIME-EVIDENCE"]],
  ["有 HTML 但无真实运行证据", "case2-html-no-evidence", 1, ["PROTO-NO-RUNTIME-EVIDENCE"], ["PROTO-MISSING"]],
  ["可运行 HTML + 浏览器自动化冒烟证据 + 打开方式", "case3-full", 0, [], ["PROTO-MISSING", "PROTO-NO-RUNTIME-EVIDENCE"]],
  ["旧规 Plan 无原型（兼容，不打断在开发项目）", "case4-legacy", 0, [], ["PROTO-MISSING", "PROTO-NO-RUNTIME-EVIDENCE"]],
  ["PDF 改名 .html 冒充原型", "case5-fake-pdf-as-html", 1, ["PROTO-NO-RUNTIME-EVIDENCE"], []],
  ["仅单张示例预览 HTML", "case6-sample-preview-only", 1, ["PROTO-MISSING"], []],
];

let pass = 0, fail = 0;
for (const [name, dir, wantExit, wantCodes, forbidCodes] of CASES) {
  const target = join(FIX, dir, "docs", "model");
  let code = 0, out = "";
  try {
    out = execFileSync(process.execPath, [LEDGER, target], { encoding: "utf8" });
  } catch (e) {
    code = e.status ?? 1;
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
  const errs = [];
  if (code !== wantExit) errs.push(`exit=${code} 期望 ${wantExit}`);
  for (const c of wantCodes) if (!out.includes(c)) errs.push(`缺 ${c}`);
  for (const c of forbidCodes) if (out.includes(c)) errs.push(`不应出现 ${c}`);
  if (errs.length) { fail++; console.log(`FAIL  ${name} :: ${errs.join("；")}`); }
  else { pass++; console.log(`PASS  ${name} (exit=${code})`); }
}

// APP 导航与视觉方向门（2026-10-09 审查 B4 决议新增，与品牌/主题同构）
const NAV_FIX = join(HERE, "fixtures", "nav-gate");
const NAV_CASES = [
  ["导航声明与关键 AC 齐全", "case-nav-complete", 0, [], ["APP-NAV"]],
  ["缺「APP 导航与视觉方向声明」", "case-nav-decl-missing", 1, ["APP-NAV-DECL-MISSING"], []],
  ["导航关键 AC 未覆盖", "case-nav-ac-missing", 1, ["APP-NAV-AC-INCOMPLETE"], []],
];
for (const [name, dir, wantExit, wantCodes, forbidCodes] of NAV_CASES) {
  const target = join(NAV_FIX, dir, "docs", "model");
  let code = 0, out = "";
  try {
    out = execFileSync(process.execPath, [LEDGER, target], { encoding: "utf8" });
  } catch (e) {
    code = e.status ?? 1;
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
  const errs = [];
  if (code !== wantExit) errs.push(`exit=${code} 期望 ${wantExit}`);
  for (const c of wantCodes) if (!out.includes(c)) errs.push(`缺 ${c}`);
  for (const c of forbidCodes) if (out.includes(c)) errs.push(`不应出现 ${c}`);
  if (errs.length) { fail++; console.log(`FAIL  [导航门] ${name} :: ${errs.join("；")}`); }
  else { pass++; console.log(`PASS  [导航门] ${name} (exit=${code})`); }
}

console.log(`\n${fail ? "SOME FAIL" : "ALL PASS"}  pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);