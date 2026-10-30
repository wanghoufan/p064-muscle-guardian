#!/bin/bash
# new-project-setup.sh | 新项目铺 ORCA 治理包：一条命令铺好一个空项目
#
# 用途（对应 AGENTS.md「新项目·大项目」场景）：
#   用户只做两件事 —— 新建空文件夹 + 说一句话「项目是 XXX，第一阶段，计划」。
#   本脚本把「铺包」这件事从 7 步手工动作压成 1 条命令，且**每步都做校验**。
#
# 背景（为什么要有这个脚本）：
#   2026-10-22 实测 —— 人工铺包要 7 步（整包拷 / 删账本空壳 / 建分工表软链 /
#   注入 ORCA 忽略块 / 还原项目自有 README / 跑 check-ledger / 跑 detect-client），
#   每一步都可能漏。实测漏了 3 个真坑：
#     ① 账本 `_example` 空壳没删 → check-ledger 报「示例行未删」；
#     ② 分工表仍是实文件 → 母版改表时项目静默分叉（053/054 就这样）；
#     ③ 母版包自带 README.md 覆盖了项目自己的 README → 项目简介被抹掉。
#   脚本把这三步做进流程，且**每步都自检**，漏了当场报错而不是事后才发现。
#
# 用法：
#   bash scripts/new-project-setup.sh <项目根>            # 铺包
#   bash scripts/new-project-setup.sh <项目根> --dry-run  # 只预演不写入
#
# 环境变量：
#   ORCA_MOTHER_ROOT   母版根（默认取本脚本上两级）
#   ORCA_PROJECT_NAME  项目名（只用于日志；不写进任何文件）
#
# 边界：
#   - 只做**新项目首次铺包**；老项目规则升级用 sync-old-projects.sh（且只有母版编排者能跑）。
#   - 不碰项目业务代码：只写治理文件，且**先备份再改**，任何一步失败即中止并回滚。
#   - 幂等：同一项目重复跑不会重复注入、不会丢已有内容。
set -eu

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOTHER="${ORCA_MOTHER_ROOT:-$(cd "$SELF_DIR/.." && pwd)}"
PKG="$MOTHER/新项目模板包"
PROJ="${1:-}"
DRY=""
[ "${2:-}" = "--dry-run" ] && DRY=1

[ -n "$PROJ" ] || { echo "usage: bash $0 <project-root> [--dry-run]"; exit 2; }
[ -d "$PROJ" ] || { echo "ERR: 项目根不存在：$PROJ"; exit 2; }
[ -d "$PKG" ] || { echo "ERR: 找不到新项目模板包：$PKG"; exit 2; }

PROJ="$(cd "$PROJ" && pwd)"
PROJECT_NAME="${ORCA_PROJECT_NAME:-$(basename "$PROJ")}"
BACKUP=""
step() { printf '  [%s] %s\n' "${2:-•}" "$1"; }
fail() { echo "ERR: $1"; [ -n "$BACKUP" ] && echo "  已回滚：备份在 $BACKUP"; exit 1; }

echo "ORCA 新项目铺包｜项目根：$PROJ"

# ── 0) 现状判定：空目录 or 非空目录 ────────────────────────────
INSTANCES=""
for f in README.md README.en.md .project.yaml; do
  [ -e "$PROJ/$f" ] && INSTANCES="$INSTANCES $f"
done
if [ -n "$INSTANCES" ]; then
  echo "  检测到项目自有文件：${INSTANCES# }（将保留，母版同名不覆盖）"
fi

# ── 0b) 安全闸：项目已有**实例文档**时拒绝铺包 ──────────────────
# 2026-10-22 真事故：脚本曾把正在开发的项目（056）的 docs/ 整个删掉，
# 抹掉了 PRODUCT_PLAN / 产品验收追踪矩阵 / 原型 / 评审报告。
# 根因＝「铺包」被当成了「整目录替换」，而它只该在**空项目**上跑。
# 现在：**已有实例文档 = 已有开发成果 = 拒绝铺包**，让执行者先确认。
# 判定：docs/ 下存在任何**非 .template.md** 的文件，或 docs/design/、docs/plan/ 已有内容。
EXISTING_DOCS=""
for pat in "docs/pm/*.md" "docs/qa/*.md" "docs/review/*.md" "docs/handoff/HANDOFF.md" "docs/plan/*.md" "docs/design/*"; do
  for f in $PROJ/$pat; do
    [ -f "$f" ] || continue
    case "$(basename "$f")" in *.template.md) continue ;; esac
    EXISTING_DOCS="$EXISTING_DOCS $(basename "$f")"
  done
done
if [ -n "$EXISTING_DOCS" ]; then
  echo "ERR: 该项目已有实例文档（${EXISTING_DOCS# }）—— 说明它**不是空新项目**，或已有开发成果。"
  echo "     铺包会覆盖治理文件，可能抹掉项目自己的计划/验收/评审文档。"
  echo "     处置：①确认这是新项目 → 清空 docs/ 下的实例文档后再跑；"
  echo "          ②这不是新项目 → **不要铺包**（老项目规则升级用 sync-old-projects.sh，且只有母版编排者能跑）。"
  exit 1
fi

# ── 1) 原子备份（把「不可逆」变成「可回退」）────────────────────
# 【铁律】备份**项目全部文件清单**（不只是 3 个自有文件）—— 铺包后要逐项核对，
# 任何一个项目原有文件消失就立刻还原并报错。2026-10-22 的事故正是「没备份 docs/」导致无法还原。
if [ -z "$DRY" ]; then
  BACKUP="$(mktemp -d)/orca-newproject-backup"
  mkdir -p "$BACKUP"
  # 3a) 全量清单（用于事后核对）
  ( cd "$PROJ" && find . -type f -not -path "./.git/*" -not -name ".DS_Store" 2>/dev/null | sort ) \
    > "$BACKUP/manifest-before.txt"
  # 3b) 项目自有文件逐个备份
  for f in $INSTANCES; do
    [ -e "$PROJ/$f" ] && cp -P "$PROJ/$f" "$BACKUP/$f"
  done
  # 3c) 备份整个 docs/（过程文档层：计划/验收矩阵/评审/原型/交接/路线图）
  #     这些是**项目自己的成果**，铺包绝不能碰；备份它们是为了万一被覆盖能还原。
  if [ -d "$PROJ/docs" ]; then
    cp -R "$PROJ/docs" "$BACKUP/docs" 2>/dev/null || true
  fi
  step "已备份：全量文件清单（$(wc -l < "$BACKUP/manifest-before.txt" | tr -d ' ') 项）＋ 自有文件 ＋ 整个 docs/" "备"
fi

# ── 2) 整包拷（末尾 /. 关键，漏了会多套一层目录）──────────────
# 【铁律】本脚本**绝不删除项目里的任何东西**，也**不覆盖项目的实例文档**。
# 2026-10-22 真事故（056 项目）：先前这一步是「按顶层名递归删除后再拷贝」，
# 结果把正在开发的项目整个 docs/ 删掉 —— PRODUCT_PLAN / 产品验收追踪矩阵 /
# 原型 / 评审报告全部消失，业务源码反而没事。**项目是别人的，不能删。**
# 正确口径：
#   - 目录一律**不删**（cp -R 会合并进已有目录）；
#   - 只处理包内**同名文件**，且只在「目标是软链」时删软链本身（cp 写穿软链会 Permission denied）；
#   - 项目的实例文档（docs/pm/PRODUCT_PLAN_*.md 等）不在包内文件名里，天然不会被碰。
if [ -z "$DRY" ]; then
  ( cd "$PKG" && find . -maxdepth 1 -mindepth 1 -type f -print ) | while read -r rel; do
    name="${rel#./}"
    # README.md/.project.yaml＝项目自有（第 3 步还原）；
    # README.en.md＝**母版的英文导航**、CHANGELOG.md＝**母版的变更说明正典**（2026-10-22 起不再随包分发）
    # —— 这两个是母版自己的东西，躺进项目根既没用又会让项目根越来越脏（母版 CHANGELOG 有 134 KB）。
    case "$name" in README.md|.project.yaml|README.en.md|CHANGELOG.md) continue ;; esac
    if [ -L "$PROJ/$name" ]; then rm -f "$PROJ/$name"; fi
  done
  cp -R "$PKG/." "$PROJ/" 2>/dev/null || fail "整包拷失败"
fi
step "整包拷 $PKG → 项目根（只覆盖同名治理文件；不删任何目录、不碰项目实例文档）" "拷"

# ── 3) 还原项目自有文件（母版 README 不得覆盖项目简介）─────────
if [ -n "$INSTANCES" ] && [ -z "$DRY" ]; then
  for f in $INSTANCES; do
    [ -e "$BACKUP/$f" ] && cp -P "$BACKUP/$f" "$PROJ/$f"
  done
  step "还原项目自有文件：${INSTANCES# }" "还"
fi

# ── 4) 删账本模板空壳（不删 → check-ledger 报「示例行未删」）─────
if [ -z "$DRY" ]; then
  for f in "$PROJ"/docs/model/*.jsonl; do
    [ -f "$f" ] || continue
    # macOS 用 -i ''（BSD sed）；Linux / Git-Bash 用 -i
    if sed -i '' "/\"_example\"/d" "$f" 2>/dev/null; then :; else
      sed -i "/\"_example\"/d" "$f" 2>/dev/null || fail "删空壳失败：$f"
    fi
  done
fi
step "账本 _example 空壳已清（docs/model/*.jsonl）" "账"

# ── 5.1) 实例化常驻位（架构事实 / 风险）──────────────────────
# 包里只有 *.template.md；项目要的是可填的实例文件。已存在就跳过（不覆盖用户内容）。
if [ -z "$DRY" ]; then
  for pair in "docs/architecture-facts.template.md:docs/architecture-facts.md" \
              "docs/risks.template.md:docs/risks.md" \
              "docs/agent.template.md:agent.md" \
              "docs/handoff/HANDOFF.template.md:docs/handoff/HANDOFF.md"; do
    tpl="${pair%%:*}"; dst="${pair##*:}"
    [ -f "$PROJ/$tpl" ] || continue
    [ -e "$PROJ/$dst" ] && continue
    cp "$PROJ/$tpl" "$PROJ/$dst" || fail "实例化失败：$dst"
  done
fi
step "常驻位已实例化（architecture-facts / risks / agent.md / HANDOFF.md；已存在则不覆盖）" "例"

# ── 5) 分工表建软链指母版（包里是实文件；不建就静默分叉）────────
# 只在「目标是实文件」时改成软链；**先备份**（用 .旧版-日期 命名，不覆盖既有备份）。
# 若目标已是软链 → 已是正确状态，不动。
if [ -z "$DRY" ]; then
  UMO="$PROJ/USER_MODEL_OVERRIDE.md"
  if [ ! -L "$UMO" ]; then
    if [ -e "$UMO" ]; then
      BAK="$UMO.旧版-$(date +%F)"
      [ -e "$BAK" ] || cp "$UMO" "$BAK"
    fi
    rm -f "$UMO"          # 只删这一个实文件本身，不涉及任何目录
    ln -s "$MOTHER/USER_MODEL_OVERRIDE.md" "$UMO" || fail "建软链失败"
  fi
  [ -f "$(readlink "$UMO")" ] || fail "软链悬空：母版 USER_MODEL_OVERRIDE.md 不存在"
fi
step "USER_MODEL_OVERRIDE.md → 软链指母版真源" "链"

# ── 6) 注入 ORCA 忽略块（公开仓不带 ORCA；私有仓也挡，防转公开漏历史）──
if [ -z "$DRY" ]; then
  bash "$MOTHER/scripts/orca-gitignore.sh" "$PROJ" >/dev/null 2>&1 || fail "注入 ORCA 忽略块失败"
  # 自检：治理文件必须真的被忽略
  MISSED=""
  for f in AGENTS.md GOVERNANCE_VERSION 编排者提示词.md docs/roles/task-manager.md \
           scripts/model/check-ledger.mjs scripts/codebuddy-auto.sh; do
    git -C "$PROJ" check-ignore -q "$f" 2>/dev/null || MISSED="$MISSED $f"
  done
  [ -n "$MISSED" ] && fail "以下治理文件未被忽略（会上传 GitHub）：$MISSED"
fi
step "ORCA 忽略块已注入并自检通过（治理文件不会上传 GitHub）" "护"

# ── 6.1) 装账本 pre-commit 钩子（2026-10-27 C1）：脚本一直随包分发但没人调用，等于摆设 ──
if [ -z "$DRY" ]; then
  if [ -d "$PROJ/.git" ] && [ -f "$PROJ/scripts/install-governance-hooks.sh" ]; then
    if bash "$PROJ/scripts/install-governance-hooks.sh" "$PROJ" >/dev/null 2>&1; then
      step "账本 pre-commit 钩子已装入 .git/hooks" "钩"
    else
      echo "  [提醒] pre-commit 钩子未装上（不影响铺包；可稍后手动跑 scripts/install-governance-hooks.sh）"
    fi
  else
    echo "  [提醒] 项目尚未 git init，跳过 pre-commit 钩子安装"
  fi
fi

# ── 7) 校验 ───────────────────────────────────────────────────
if [ -z "$DRY" ]; then
  for f in AGENTS.md 编排者提示词.md 经验一句话.md docs/roles/task-manager.md \
           docs/pm/PRODUCT_PLAN.template.md docs/qa/产品验收追踪矩阵.template.md \
           docs/handoff/HANDOFF.template.md docs/model/TASK-MODEL-LOG.jsonl \
           docs/architecture-facts.md docs/risks.md agent.md docs/handoff/HANDOFF.md \
           scripts/detect-client.sh scripts/model/check-ledger.mjs; do
    [ -e "$PROJ/$f" ] || fail "关键治理文件缺失：$f"
  done
  ( cd "$PROJ" && node scripts/model/check-ledger.mjs docs/model >/tmp/orca-newproj-ledger.txt 2>&1 ) \
    || { cat /tmp/orca-newproj-ledger.txt; fail "check-ledger 未通过"; }
fi
step "check-ledger 通过（LEDGER-OK）" "验"

# ── 8) 【红线自检】项目原有文件一个都不能少 ─────────────────────
# 铺包只允许**新增**治理文件与**覆盖**同名治理文件；**项目原有文件消失 = 事故**，
# 立即从备份还原并报错退出，绝不留下半残状态。
if [ -z "$DRY" ]; then
  ( cd "$PROJ" && find . -type f -not -path "./.git/*" -not -name ".DS_Store" 2>/dev/null | sort ) \
    > "$BACKUP/manifest-after.txt"
  LOST="$(comm -23 "$BACKUP/manifest-before.txt" "$BACKUP/manifest-after.txt" | grep -v '^\./\(docs/roles/\|docs/sop/\|docs/templates/\|docs/prompts/\|docs/model/\|docs/pm/.*\.template\.md\|docs/qa/.*\.template\.md\|docs/review/.*\.template\.md\|docs/plan/.*\.template\.md\|docs/handoff/.*\.template\.md\|scripts/model/\|scripts/decision/\|scripts/orchestration/\|docs/assets/orca-\|docs/model/TASK-MANAGER-QUALIFICATION.md\)' || true)"
  if [ -n "$LOST" ]; then
    echo "ERR: 铺包后以下**项目原有文件消失**（事故，立即还原）："
    echo "$LOST" | sed 's/^/  - /'
    # 还原：整个 docs/ 恢复原状 + 自有文件恢复。
    # 用 mv 而非递归删除：把「当前状态」挪到备份目录（可再恢复），而不是删除。
    if [ -d "$BACKUP/docs" ]; then
      mkdir -p "$BACKUP/rolled-back"
      [ -e "$PROJ/docs" ] && mv "$PROJ/docs" "$BACKUP/rolled-back/docs"
      cp -R "$BACKUP/docs" "$PROJ/docs"
    fi
    for f in $INSTANCES; do
      [ -e "$BACKUP/$f" ] && cp -P "$BACKUP/$f" "$PROJ/$f"
    done
    fail "已从备份还原 docs/ 与项目自有文件；请检查后再跑"
  fi
fi
step "红线自检通过：项目原有文件零丢失" "检"

# ── 完成 ──────────────────────────────────────────────────────
echo "DONE: $PROJ"
echo "  下一步：在这个项目里打开客户端，对编排者说——"
echo "    项目是 ${PROJECT_NAME}，第一阶段，计划。"
