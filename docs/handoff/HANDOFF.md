# HANDOFF｜交接（暂停/恢复用，先读我）

> 上限 ≤100 行 / ≤8KB。事实进 `docs/architecture-facts.md`，风险进 `docs/risks.md`，踩坑进 `agent.md`，本文件只留指针与现势。

## §0 常驻指针

| 要什么 | 去哪 |
|---|---|
| 开工路由、红线、索引 | `AGENTS.md` |
| 产品计划（需求真源） | `docs/pm/PRODUCT_PLAN.md` |
| 可点击原型 | `docs/design/prototype/index.html` |
| 架构与构建事实 | `docs/architecture-facts.md`（未建，Phase2 首日补） |
| 未决风险 | `docs/risks.md`（未建，风险暂列 PRODUCT_PLAN §17） |
| 踩坑与浏览器 QA 规矩 | `agent.md`（已建） |
| 经验条目 | `经验一句话.md` |
| 治理细则 | `docs/sop/governance-{scope,execution-modes,dispatch,ledger}.md` |

## §1 当前进展

- Captured at：2026-10-30 17:15
- PLAN_VERSION：以 `docs/pm/PRODUCT_PLAN.md` 为需求真源（当前 V1.1）
- PROJECT_PHASE：DEVELOP（用户已下「开发」令；Phase1 Gate 记 IN_PROGRESS，按连续推进执行）
- PLAN_READINESS_SCORE：88
- PLAN_GATE：IN_PROGRESS（未正式放行，开发为用户当场授权）
- DEV_BASELINE：0.1.0（`dist` 16:19 重建，SW cache=muscle-keeper-9adbbfe630e3023b）
- CHANGE_REQUEST：NONE
- Stage ID：Phase2 首轮实现（064-ing-肌肉守护者）
- 剩 P0：①交付目标改为**小米自带浏览器**（已装成 PWA、语音已修、待用户人耳确认）②AC-23 无中文语音降级随语音改造已实质解决，待矩阵改判 ③图标仍为方向②，A1 定的是方向① ④首次发布未签收
- 当前 Task：BUG-001 已闭环＋Web QA 回归＋真机 QA 完成；用户四项已拍板（A1/D1/E1+E2 全授权/F1）
- 本轮已完成：⓪语音方案改造：小米浏览器无 Web Speech API → 改为预置 mp3（46 条，SW 预缓存），实测出声 ①BUG-001 修复（根因：`setMode` 引用不稳→hydrate 反复重跑回滚偏好）②BUG-002 `.pwa` 后缀、BUG-003 长按选中菜单 一并修 ③Neo 后台回归（三态主题+刷新持久化+训练/测试/统计+离线产物）④真机 QA：Redmi 22101316C 14 项，13 PASS / 1 未完成（安装到主屏），详见 `docs/qa/真机QA-结果-2026-10-30.md` ⑤验收矩阵回填 13 PASS / 1 FAIL / 1 NOT_TESTED / 29 PARTIAL

## §2 下一步

- 下一步：小米自带浏览器路径已通（装机＋语音＋整分钟播报）。等用户人耳确认后签收；随后按 A1 重出图标方向①、补 360×640 窄屏、矩阵 AC-23 改判
- 已拍板：A1 肌肉守护者/MuscleKeeper（图标方向①腿形护盾，现网图标仍为②，待重出）/ D1 暂不做导出 / E1+E2 全授权（commit、push origin/main、Pages 工作流、public 仓库）/ F1 Redmi（QA 机 22101316C）
- permission_request：（无）

## §3 未完成

- 未闭环缺陷：无 P0 未闭环（BUG-001/002/003/004 全 CLOSED）；矩阵 AC-23 待按新语音方案改判
- 未闭环评审意见：无（未到交付单元边界，未派 code-reviewer/qa/supervisor）
- 产品验收：`docs/qa/产品验收追踪矩阵.md` 已建并回填（13 PASS／1 FAIL／1 NOT_TESTED／29 PARTIAL）；真机证据 `docs/qa/shots/`
- 用户签收：首次发布 → 待签收（依据：真机安装 + 一次倒计时训练 + 一次测试 + 查看统计）
- docs 落盘清单：`docs/pm/PRODUCT_PLAN.md`、`docs/design/prototype/index.html`、`docs/handoff/HANDOFF.md`、`agent.md`（本项目新建）；应用代码在本仓库根
- 收尾一笔：Neo 测试标签 page 15/20 已关；8800 静态服务已停；`adb reverse tcp:8800` 与 `forward tcp:9223` 已移除；仓库已转 public 并开 Pages（免费套餐 Pages 不支持 private）

## §4 红线

- 不 push；commit 需明确授权（含分支名）。
- 产品验收未落盘或关键 AC 未测、首次发布未签收，不得报完工。
- 体系更新未同步两包与概览、或门禁未过，不得收工。
- 不删历史（只迁移/归档）；不替用户判定文件无用。

## §5 三日流水

- 2026-10-30：产出 Phase1 计划 V1.0 与原型；冒烟全 PASS；Readiness 85。
- 2026-10-30：按用户第二轮意见改版到 V1.1（方向 B、仅中文、同页两区、整分钟播报、测试确认、图表纵坐标）；原型 V2 冒烟 7/7 PASS；Readiness 88。
- 2026-10-30：正式 PWA 实现完成并构建出 0.1.0；按 webqa.md 打通 Neo MCP 后台 QA 通道（建/复用/关闭标签均验证）、按设备锁 skill 锁定 note11 5g 并已 release；发现主题按钮点击缺陷后按用户令暂停开发。
- 2026-10-30：主开发者接手；BUG-001 定位为状态回滚并修复（+BUG-002/003）；Neo 后台回归 PASS；Redmi 22101316C 真机 13/14 项 PASS；矩阵与 BUGS 落盘。

## §6 接续提示词

先读本文件 §0–§3 与 `agent.md`，按 §2 先修设置面板主题按钮缺陷并用 Neo 后台回归，再取用户四项决策后推进真机 QA。
