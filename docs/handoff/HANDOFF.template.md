# HANDOFF｜交接（暂停/恢复用，先读我）

> 上限 ≤100 行 / ≤8KB。事实进 `docs/architecture-facts.md`，风险进 `docs/risks.md`，踩坑进 `agent.md`，本文件只留指针与现势。
> 旧版字段（governance-state / Evidence / Human Gate / Promotion / Dispatch ID）已废弃，不填。

## §0 常驻指针

| 要什么 | 去哪 |
|---|---|
| 开工路由、红线、索引 | `AGENTS.md`（唯一真源） |
| 架构与构建事实 | `docs/architecture-facts.md` |
| 未决风险与待验证项 | `docs/risks.md` |
| 踩坑与审查交付约定 | `agent.md` |
| 经验条目 | `经验一句话.md` |
| 治理细则 | `docs/sop/governance-{scope,execution-modes,dispatch,ledger}.md` |
| 角色卡 | `docs/roles/` |

## §1 当前进展

- Captured at（YYYY-MM-DD HH:MM）：
- PROJECT_PHASE：（PLAN / WAITING_HUMAN_APPROVAL / DEVELOP / PLAN_REOPEN_REQUIRED）
- PLAN_VERSION：（如 PRODUCT_PLAN_V1.0，无则空）
- PLAN_READINESS_SCORE：（0-100，无则空；定义以 `docs/pm/PRODUCT_PLAN.template.md` 为准）
- PLAN_GATE：（IN_PROGRESS / READY_FOR_HUMAN_REVIEW / APPROVED）
- DEV_BASELINE：（如 PRODUCT_PLAN_V1.0；DEVELOP 必填）
- CHANGE_REQUEST：（NONE / A / B / C）
- Stage ID（本阶段叫什么）：
- 剩 P0（没完的才列，多一条都不行）：
- 当前 Task（正干到哪）（累计打回 n/2，supervisor 每次打回时 TM 同步更新）：
- 执行链/Session（可选，仅真 resume 通道填；ID 由基础设施返回，不手造）：
- 本轮已完成：

## §2 下一步

- 下一步（Next Single Action）：
- 人要拍什么板（列出来问，不问不许开工）：
- permission_request（可选：原文/决策/回执一句）：

## §3 未完成

- 未闭环评审意见（code-reviewer/qa 留的还没改的）：
- 产品验收（追踪矩阵落点 / 未测 AC / 是否待用户签收）：
- 用户签收（触发依据 / 证据包位置 / 签收人 / 结论（已签收 / 待签收 / 不需要））：
- docs 落盘清单（本轮新增/改了哪几个 docs 文件）：
- 收尾记一笔（neat-freak 口径由编排者自做、不派工）：文档对齐了没、临时文件清了没、未决列完没

## §4 红线

- 不 push；commit 需明确授权（含分支名）。
- 产品验收未落盘或关键 AC 未测、首次发布未签收，不得报完工。
- 体系更新未同步两包与概览、或门禁未过，不得收工。
- 不删历史（只迁移/归档）；不替用户判定文件无用。

## §5 三日流水

- YYYY-MM-DD：
- （超过 3 天的条目先问「还有效吗」：有效结论上提，无效才删）

## §6 接续提示词

（≤3 句：先读本文件 §0–§3，按 §2 继续。）
