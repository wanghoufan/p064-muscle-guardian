# HANDOFF｜交接（暂停/恢复用，先读我）

> 上限 ≤100 行 / ≤8KB。事实进 `docs/architecture-facts.md`，风险进 `docs/risks.md`，踩坑进 `agent.md`，本文件只留指针与现势。

## §0 常驻指针

| 要什么 | 去哪 |
|---|---|
| 开工路由、红线、索引 | `AGENTS.md` |
| 产品计划（需求真源） | `docs/pm/PRODUCT_PLAN.md` |
| 可点击原型 | `docs/design/prototype/index.html` |
| 架构与构建事实 | `docs/architecture-facts.md`（已建） |
| 未决风险 | `docs/risks.md`（已建，R1–R8） |
| 踩坑与浏览器 QA 规矩 | `agent.md`（已建） |
| 经验条目 | `经验一句话.md` |
| 治理细则 | `docs/sop/governance-{scope,execution-modes,dispatch,ledger}.md` |

## §1 当前进展

- Captured at：2026-10-30 18:20
- PLAN_VERSION：以 `docs/pm/PRODUCT_PLAN.md` 为需求真源（当前 V1.1）
- PROJECT_PHASE：DEVELOP（用户已下「开发」令；Phase1 Gate 记 IN_PROGRESS，按连续推进执行）
- PLAN_READINESS_SCORE：88
- PLAN_GATE：IN_PROGRESS（未正式放行，开发为用户当场授权）
- DEV_BASELINE：0.1.0（`dist` 17:20 重建，SW cache=muscle-keeper-454038382f50cfb9，54 个预缓存文件）
- CHANGE_REQUEST：NONE
- Stage ID：Phase2 首轮实现（064-ing-肌肉守护者）
- 剩 P0：①用户人耳确认「三二一开始／整分钟播报」后签收 ②图标仍为方向②，A1 定的是方向① ③AC-33 冻结记录未产出（矩阵唯一 NOT_TESTED）
- 当前 Task：BUG-001 已闭环＋Web QA 回归＋真机 QA 完成；用户四项已拍板（A1/D1/E1+E2 全授权/F1）
- 本轮已完成：⓪语音方案改造：小米浏览器无 Web Speech API → 改为预置 mp3（46 条，SW 预缓存），实测出声 ①BUG-001 修复（根因：`setMode` 引用不稳→hydrate 反复重跑回滚偏好）②BUG-002 `.pwa` 后缀、BUG-003 长按选中菜单 一并修 ③Neo 后台回归（三态主题+刷新持久化+训练/测试/统计+离线产物）④真机 QA：Redmi 22101316C 14 项，13 PASS / 1 未完成（安装到主屏），详见 `docs/qa/真机QA-结果-2026-10-30.md` ⑥验收矩阵回填 14 PASS / 0 FAIL / 1 NOT_TESTED / 29 PARTIAL（AC-23 随语音改造改判）⑦语音加回归闸：48 例映射测试＋构建前 `check-voice`（46 条 mp3 缺一即失败）⑨修窄屏溢出（BUG-006：档位 minWidth 写死致微信里右侧被裁）＋小米浏览器「添加到桌面」置灰（BUG-007：其规则是 `display:standalone` 就禁用快捷方式，改 `browser`）⑩新增 **Android APK 通道**（`android-apk/`，WebView 内嵌 dist，无 Gradle，`./android-apk/build.sh` 出 ~590KB 安装包，彻底绕开浏览器菜单）⑧按用户要求加「数据清零」：设置→数据区，训练记录/测试记录分别可清＋清空全部，两步确认，**只清记录不动主题与语音设置**（原「清空所有记录」会连设置一起重置）

## §2 下一步

- 下一步：用户已能「添加到桌面」（18:13 确认）。等他从桌面图标点开、听一次语音后签收；桌面若有两个同名图标，删掉指向 localhost 的测试那个 → 按 A1 重出图标方向①（192/512/180）→ 补 AC-33 冻结记录 → 补 360×640 窄屏与 OPPO/华为安装入口说明（R3）
- 已拍板：A1 肌肉守护者/MuscleKeeper（图标方向①腿形护盾，现网图标仍为②，待重出）/ D1 暂不做导出 / E1+E2 全授权（commit、push origin/main、Pages 工作流、public 仓库）/ F1 Redmi（QA 机 22101316C）
- permission_request：（无）

## §3 未完成

- 未闭环缺陷：无（BUG-001/002/003/004/005 全 CLOSED）
- 未闭环评审意见：无（未到交付单元边界，未派 code-reviewer/qa/supervisor）
- 产品验收：`docs/qa/产品验收追踪矩阵.md` 已回填（14 PASS／0 FAIL／1 NOT_TESTED／29 PARTIAL）；证据 `docs/qa/真机QA-结果-2026-10-30.md`＋`docs/qa/shots/`；安装说明 `docs/安装说明-手机.md`（小米自带浏览器路径）
- 用户签收：首次发布 → 待签收（依据：真机安装 + 一次倒计时训练 + 一次测试 + 查看统计）
- docs 落盘清单：`docs/pm/PRODUCT_PLAN.md`、`docs/design/prototype/index.html`、`docs/handoff/HANDOFF.md`、`agent.md`（本项目新建）；应用代码在本仓库根
- 收尾一笔：Neo 标签已关、8800 已停、`adb reverse/forward` 已全部移除（9223/9224 均清）；两台真机未加锁、无需 release；仓库 public＋Pages 已上线

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
- 2026-10-30：Pages 上线；用户指定交付目标＝小米自带浏览器；实测其无 Web Speech API（BUG-004）→ 语音改预置 mp3 并加回归闸；小米浏览器实测出声＋整分钟播报；事实/风险/踩坑外移成 `architecture-facts.md`、`risks.md`、`agent.md`。
- 2026-10-30：加「数据清零」（训练/测试分开清、两步确认、不动设置）；连带修 BUG-005（设置面板不可滚动致底部按钮被裁）。

## §6 接续提示词

先读本文件 §0–§3 与 `agent.md`，按 §2 等用户人耳确认后签收，再重出图标方向①并补 AC-33 冻结记录。
