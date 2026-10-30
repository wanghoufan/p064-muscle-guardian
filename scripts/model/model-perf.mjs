#!/usr/bin/env node
// model-perf.mjs — 按「角色 × 模型」统计耗时，用于换模型后的提速对比。
//
// 为什么需要（2026-10-16 实测）：账本原本只记「谁做了什么、结果如何」，**不记花了多久**。
// 实测 1692 行历史账里耗时字段 0 条、tokens 仅 35 行有值、cost_cny 0 行 ——
// 所以换模型后**无法回答「到底快了多少」**。这不是统计方法问题，是数据从未采集。
// 本工具不猜、不估：只读账本里已有的 `elapsed_sec`，没有就明说没有。
//
// 用法：
//   node scripts/model/model-perf.mjs <项目根或docs/model路径> [--role code-reviewer] [--json]
// 例：
//   node scripts/model/model-perf.mjs ~/coding/1.Active/028-ing-酒吧聚会社交导演
//   node scripts/model/model-perf.mjs <路径> --role code-reviewer
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const jsonOut = args.includes("--json");
const roleFilter = args.includes("--role") ? args[args.indexOf("--role") + 1] : null;
const target = args.find((a) => !a.startsWith("-") && a !== roleFilter) || "docs/model";

// 收集所有账本：既支持单个目录，也支持扫一个父目录（多项目汇总）
function collectLedgers(p) {
  if (!existsSync(p)) return [];
  const st = statSync(p);
  if (st.isFile()) return [p];
  if (p.endsWith("docs") || p.endsWith("docs/model")) {
    const direct = join(p, "DISPATCH-LOG.jsonl");
    if (existsSync(direct)) return [direct];
  }
  const out = [];
  try {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const sub = join(p, e.name);
      if (e.isDirectory()) {
        const lm = join(sub, "docs", "model");
        if (existsSync(join(lm, "DISPATCH-LOG.jsonl"))) out.push(join(lm, "DISPATCH-LOG.jsonl"));
        else if (existsSync(join(lm, "TASK-MODEL-LOG.jsonl"))) out.push(join(lm, "TASK-MODEL-LOG.jsonl"));
      }
    }
  } catch {}
  return out;
}

const rows = [];
let totalRows = 0, withElapsed = 0;
for (const f of collectLedgers(resolve(target))) {
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    let o; try { o = JSON.parse(s); } catch { continue; }
    if (!o || o._example) continue;
    totalRows++;
    if (roleFilter && o.role !== roleFilter) continue;
    rows.push(o);
    if (typeof o.elapsed_sec === "number") withElapsed++;
  }
}

// 简易列对齐（CJK 字符按 2 宽计，避免中文表头错位）
const W = (str) => { const s2 = String(str); let w = 0; for (const ch of s2) w += /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/.test(ch) ? 2 : 1; return w; };
const pad = (v, n, dir = "r") => {
  const t = String(v); const sp = " ".repeat(Math.max(0, n - W(t)));
  return dir === "r" ? sp + t : t + sp;
};

const agg = new Map();
for (const o of rows) {
  const k = `${o.role}|${o.model}`;
  const a = agg.get(k) || { role: o.role, model: o.model, n: 0, timed: 0, sum: 0, pass: 0, fail: 0, rework: 0 };
  a.n++;
  if (o.result === "PASS") a.pass++; else a.fail++;
  if (typeof o.rework === "number") a.rework += o.rework;
  if (typeof o.elapsed_sec === "number") { a.timed++; a.sum += o.elapsed_sec; }
  agg.set(k, a);
}
const list = [...agg.values()].sort((x, y) => y.n - x.n);

if (jsonOut) {
  console.log(JSON.stringify({
    scanned_files: collectLedgers(resolve(target)).length,
    total_rows: totalRows, matched_rows: rows.length,
    with_elapsed: withElapsed,
    has_baseline: withElapsed > 0,
    groups: list.map((a) => ({
      role: a.role, model: a.model, dispatches: a.n, timed: a.timed,
      avg_elapsed_sec: a.timed ? +(a.sum / a.timed).toFixed(1) : null,
      median_elapsed_sec: null, pass: a.pass, fail: a.fail, rework_total: a.rework,
    })),
  }, null, 2));
} else {
  console.log(`# 模型效能统计（来源 ${target}）`);
  console.log(`扫描账本行 ${totalRows}｜命中 ${rows.length}｜**含耗时数据 ${withElapsed}**\n`);
  if (!withElapsed) {
    console.log("⚠️ 账本里没有任何 elapsed_sec 数据 ⇒ **无法比较快慢**。");
    console.log("   原因：耗时字段是 2026-10-16 才加的，历史行从没有过。");
    console.log("   要能对比，需从现在开始记录：派工前记时间戳、收工时把差值写进");
    console.log("   DISPATCH-LOG / TASK-MODEL-LOG 的 `elapsed_sec`（拿不到填 null，不许编）。");
    console.log("   下方表格仍给出派工量与成败分布，供确认「样本来自哪些模型」。\n");
  }
  console.log(pad("角色",18,"r")+pad("模型",36,"r")+pad("派工",5)+pad("有耗时",7)+pad("均耗时s",9)+pad("PASS",6)+pad("FAIL",6));
  for (const a of list) {
    const avg = a.timed ? (a.sum / a.timed).toFixed(1) : "—";
    console.log(pad(a.role,18,"r")+pad(String(a.model).slice(0,34),36,"r")+pad(a.n,5)+pad(a.timed,7)+pad(avg,9)+pad(a.pass,6)+pad(a.fail,6));
  }
}
