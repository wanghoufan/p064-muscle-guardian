// codebuddy-rotate.test.mjs | regression for the 429 auto-account-switch wrapper.
//
// Why: the wrapper was written, hand-verified once, and then shipped with **no test and no
// fixture** -- exactly the "claimed in prose, never re-checked" failure this suite exists to stop.
// The real network path is NOT exercised here (it would burn accounts); instead a FAKE
// codebuddy is injected through CODEBUDDY_REAL, so every branch is driven deterministically.
//
// Covering: recursion guard (the infinite-fork bug), 429 -> switch -> success + sticky pointer,
// non-429 error passthrough (must NOT be mistaken for rate limiting), and
// "every account limited" (must return 429, exit 1, never fake success).
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, chmodSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SB = join(tmpdir(), "orca-cb-sandbox-" + process.pid);
rmSync(SB, { recursive: true, force: true });
mkdirSync(join(SB, "bin"), { recursive: true });
let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}`); } };

// fake codebuddy: prints $FAKE_OUT for every call, and counts calls in $FAKE_COUNT_FILE
writeFileSync(join(SB, "bin", "fake-codebuddy"),
  `#!/bin/bash\necho "call" >> "$FAKE_COUNT_FILE"\nprintf '%s' "$FAKE_OUT"\nexit \${FAKE_RC:-0}\n`);
chmodSync(join(SB, "bin", "fake-codebuddy"), 0o755);

// 3 accounts, no credentials touched: the wrapper only rotates a pointer file
writeFileSync(join(SB, "accounts.json"), JSON.stringify({ accounts: [{n:1},{n:2},{n:3}] }));
const STATE = join(SB, "state.json");

const runWrap = (fakeOut, fakeRc, args = []) => {
  const env = { ...process.env,
    CODEBUDDY_REAL: join(SB, "bin", "fake-codebuddy"),
    CODEBUDDY_ROTATE_DIR: SB, WB_SWITCH_ACCOUNTS_FILE: join(SB, "accounts.json"),
    AUTO_ROTATE_MAX: "3", FAKE_OUT: fakeOut, FAKE_RC: String(fakeRc ?? 0),
    FAKE_COUNT_FILE: join(SB, "calls.log") };
  try { return { code: 0, out: execFileSync("bash", [join(ROOT, "scripts", "codebuddy-auto.sh"), ...args],
      { encoding: "utf8", env, stdio: ["ignore","pipe","pipe"] }) }; }
  catch (e) { return { code: e.status ?? 1, out: `${e.stdout || ""}${e.stderr || ""}` }; }
};
const calls = () => { try { return readFileSync(join(SB, "calls.log"), "utf8").trim().split("\n").filter(Boolean).length; } catch { return 0; } };
const active = () => { try { return JSON.parse(readFileSync(STATE, "utf8")).active; } catch { return null; } };
const resetCalls = () => { try { rmSync(join(SB, "calls.log")); } catch {} };

// 1) recursion guard: the bug that caused `fork: Resource temporarily unavailable`
let src = readFileSync(join(ROOT, "scripts", "codebuddy-auto.sh"), "utf8");
check("wrapper never calls bare `codebuddy` (would hit the shadow wrapper and recurse)",
  !/\nout="\$\(codebuddy /.test(src) && !/ exec codebuddy /.test(src));

// 2) non-429 error must pass through untouched and must NOT rotate
resetCalls();
let r = runWrap("Model not found: no-such-model", 1, ["--model", "no-such-model"]);
check("non-429 error is returned verbatim", r.out.includes("Model not found"));
check("non-429 error does not retry other accounts", calls() === 1);

// 3) success on first try: pointer untouched, no wasted calls
resetCalls();
r = runWrap("done", 0);
check("clean run returns output", r.code === 0 && r.out.includes("done"));
check("clean run makes exactly one call", calls() === 1);

// 4) 429 on the first account -> rotate -> the next account works, pointer STAYS there
resetCalls();
writeFileSync(STATE, JSON.stringify({ active: 0 }));
// fake that fails with 429 only while the pointer is account 0, succeeds otherwise
const smart = join(SB, "bin", "smart-codebuddy");
writeFileSync(smart,
  `#!/bin/bash\necho "call" >> "$FAKE_COUNT_FILE"\n`
  + `a=$(python3 -c "import json;print(json.load(open('${STATE}'))['active'])" 2>/dev/null || echo 0)\n`
  + `if [ "$a" = "0" ]; then echo "Error: 429 rate limit exceeded"; exit 1; fi\n`
  + `echo "done-on-$a"\nexit 0\n`);
chmodSync(smart, 0o755);
const envSmart = { ...process.env, CODEBUDDY_REAL: smart, CODEBUDDY_ROTATE_DIR: SB,
  WB_SWITCH_ACCOUNTS_FILE: join(SB, "accounts.json"), AUTO_ROTATE_MAX: "3",
  FAKE_COUNT_FILE: join(SB, "calls.log") };
r = (() => { try { return { code: 0, out: execFileSync("bash", [join(ROOT, "scripts", "codebuddy-auto.sh")],
    { encoding: "utf8", env: envSmart, stdio: ["ignore","pipe","pipe"] }) }; }
  catch (e) { return { code: e.status ?? 1, out: `${e.stdout || ""}${e.stderr || ""}` }; } })();
check("429 on account 1 -> auto switch and succeed", r.code === 0 && r.out.includes("done-on-1"));
check("429 recovery made exactly 2 calls", calls() === 2);
check("pointer stays on the account that worked (sticky)", active() === 1);

// 5) every account limited: must return 429, exit 1, never fake success, pointer restored
resetCalls();
writeFileSync(STATE, JSON.stringify({ active: 0 }));
r = runWrap("Error: 429 rate limit exceeded", 1);
check("all accounts limited -> non-zero exit", r.code === 1);
check("all accounts limited -> 429 surfaced (no fake success)", r.out.includes("429"));
check("all accounts limited -> tried all 3 accounts", calls() === 3);
check("all accounts limited -> pointer restored to the original account", active() === 0);

rmSync(SB, { recursive: true, force: true });
console.log(`\nALL ${fail === 0 ? "PASS" : "FAIL"}  pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
