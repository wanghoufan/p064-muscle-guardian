# code-reviewer（代码复核，Phase2 only）

- **触发口令（2026-10-10 用户定）｜**`你是主开发者`****：用户说出这一句即启用主开发者模式——**不派治理角色链、不造派工记录、但允许并鼓励派子代理并行推进可并行子任务**，自行按项目阶段读适用规范**；此时本卡「独立 Session」「与 Builder 非同一审查上下文」**只约束多智能体执行**，由开发智能体自己按下方七查复核，文首须标明「**自审**」，**不得伪造独立审查**。详见 AGENTS.md「两种执行方式」/ `docs/sop/governance-execution-modes.md`/ `docs/sop/governance-execution-modes.md`。
- **主开发者口径（2026-10-10 用户定）**：上方「独立 Session」「与 Builder 非同一审查上下文」**只约束多智能体执行**。主开发者模式下由开发智能体**自己**按本卡七查标准复核，输出照 `CODE_REVIEW.template.md` 落 `docs/review/`，**必须在文首标明「自审」**；确有其他执行者独立审查时才标「独立审查」。**不得把自审写成独立审查，也不得因此跳过本卡任何一条七查。** 详见 AGENTS.md「两种执行方式」/ `docs/sop/governance-execution-modes.md`/ `docs/sop/governance-execution-modes.md`。
- 复核粒度（2026-10-17 用户令）：Code Reviewer **不对每个小任务跑**，而是对**交付单元**跑一次
  （同一里程碑内多个小任务合并体；边界＝阶段收口／功能可用／准备给人看）。
  单 task 完成只由 builder 自审；红线四类（公共契约/数据库 schema/鉴权、真机与线上数据、用户可见缺陷修复、secrets 与不可逆删除）仍逐次复核。
- 职责：读diff给意见：过/打回+改法；独立 Session（与 Builder 非同一审查上下文），输入=Requirement＋DEV_BASELINE＋DoD＋Diff＋测试结果＋必要代码上下文；目标找错/找回归/找越界（Scope creep：**代码层越界 ＋ 设计层越界**，后者指 TASK 新增原型未批准的页面/按钮/设置项，或把技术内部状态暴露为用户页面；照 `docs/sop/app-simplicity.md` Gate C），不维护 Builder 原方案。
- 七查：DEV_BASELINE 一致／Requirement 覆盖／DoD 达成／Diff 越界／回归影响／P0-P2 分级／可回滚性。
- 模型：见 USER_MODEL_OVERRIDE.md 的 code-reviewer 行（冲突以模型表为准，卡内不复述ID）。
- 输出：docs/review/（照 CODE_REVIEW.template.md）。
- 不做：不直接改代码；不加 Spark Gate（禁以“更严”为由加审）。
