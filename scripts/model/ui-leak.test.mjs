#!/usr/bin/env node
// ui-leak.test.mjs — 界面信息分层（L1/L2/L3）扫描器回归测试
// 覆盖两个验收口径（2026-10-09 用户令）：
//   ① 负面：P046 式内部信息直上屏须被识别（证据等级/内部ID/AC-FR/Phase-Gate/版本/hash/动态渲染）
//   ② 正面：正常地区玩法名、查看来源、安全短提示、玩法版本**不得误伤**
// 跑法：node scripts/model/ui-leak.test.mjs
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCANNER = join(HERE, "ui-leak.mjs");
const FIX = join(HERE, "fixtures", "ui-leak");

function scan(dir) {
  try {
    return execFileSync(process.execPath, [SCANNER, dir, "--json"], { encoding: "utf8" });
  } catch (e) {
    return e.stdout ?? "{}";
  }
}
const count = (dir) => { try { return JSON.parse(scan(dir)).count ?? -1; } catch { return -1; } };

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
};

// ① 负面：须识别（>0 命中）
check("负面：内部信息直上屏被识别", count(join(FIX, "negative-leak")) > 0);

// ② 正面：正常用户内容不得误伤（0 命中）
check("正面：地区玩法/来源/安全提示/玩法版本不误伤", count(join(FIX, "positive-good")) === 0);

console.log(`\n${fail ? "SOME FAIL" : "ALL PASS"}  pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);