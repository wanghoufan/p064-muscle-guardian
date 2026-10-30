#!/bin/bash
# run-gates.sh | 一键体检：把治理体系的全部机器检查一次跑完
#
# 用法：bash scripts/run-gates.sh            # 全跑
#       bash scripts/run-gates.sh --fast     # 跳过 7-Skill（外部仓库不在时自动跳）
# 退出码：0 = GATES-OK；1 = 至少一项失败
#
# 为什么要有它（2026-10-27 体系自查 C1）：
#   11 个回归测试与两个门禁脚本此前**没有任何统一调用点**——文档写「必须跑」，
#   但没 CI、没脚本串起来，下一个人不跑就等于没验。这里给一个入口，一条命令自证。
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

fail=0
passn=0
run() { # run <显示名> <命令...>
  local name="$1"; shift
  local out rc
  out=$("$@" 2>&1); rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "PASS $name"
    passn=$((passn+1))
  else
    echo "FAIL $name (exit=$rc)"
    echo "$out" | tail -6 | sed 's/^/  | /'
    fail=$((fail+1))
  fi
}

echo "=== 门禁 ==="
run "SYNC"    bash scripts/check-sync.sh
run "CHANNEL" bash scripts/check-channel-preflight.sh
run "LEDGER"  node scripts/model/check-ledger.mjs docs/model --allow-example

echo "=== 回归 ==="
for t in tm-qualification prototype-gate ui-leak ledger-fields solo-agent \
         gates delivery-unit continuous-push codebuddy-rotate governance-size; do
  run "$t" node "scripts/model/$t.test.mjs"
done

if [ "${1:-}" != "--fast" ]; then
  SKILL_DIR="${ORCA_SKILL_REPO:-$HOME/Downloads/大模型 HANDOFF/60 Skill 仓库}"
  if [ -f "$SKILL_DIR/orca-design-pipeline/validate_skillset.py" ]; then
    run "7-Skill" python3 "$SKILL_DIR/orca-design-pipeline/validate_skillset.py" "$SKILL_DIR" --master "$PWD"
  else
    echo "SKIP 7-Skill（未找到 $SKILL_DIR）"
  fi
fi

echo "---"
if [ "$fail" -eq 0 ]; then
  echo "GATES-OK（$passn 项通过）"
  exit 0
fi
echo "GATES-FAIL（失败 $fail 项 / 通过 $passn 项）"
exit 1
