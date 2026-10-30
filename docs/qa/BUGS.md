# BUGS

- 建表：2026-10-30｜阶段：Phase2 首轮实现（DEVELOP）
- AC 结论唯一落盘位＝`docs/qa/产品验收追踪矩阵.md`；本表只记缺陷与操作过程证据，不承载 AC 结论。

| Bug ID | Priority | Stage P0 Blocking? | Repro | Status | Current Task | 备注（截图/日志一句） |
|---|---|---:|---|---|---|---|
| BUG-001 | P0 | 是 | ① 打开 PWA（dev 或 `dist` 构建产物）默认停「训练」tab → ② 点右上角「设置」按钮（`App.tsx:135-150`）弹出底部设置面板 → ③ 在「主题」行（`SettingsSheet.tsx:36-64`）依次点「跟随系统」/「浅色」/「深色」三个按钮 → ④ 实际：面板不关闭、选中胶囊不移动、页面配色不变，`prefs.themeMode` 仍为 `system`，localStorage 键 `themeMode` 不更新 → ⑤ 同面板对照：「语音提示」开关（`SettingsSheet.tsx:73-80`）与「关闭」按钮（`SettingsSheet.tsx:126`）点击均正常，故非遮罩拦截、非弹层失效 → ⑥ 断点链：三按钮 `onPress` 已绑定 `onPatch({themeMode})`（`SettingsSheet.tsx:48`）→ `updatePrefs`（`App.tsx:73-77`）→ `setMode`（`ThemeContext.tsx:53-56`），实际点击后该链未产生状态变化 | CLOSED（2026-10-30 16:05） | 主开发者修复＋Web QA 回归 | 根因：`ThemeContext.setMode` 每次渲染新建函数 → `App` 的 hydrate effect 依赖 `[setMode]` 每次重跑 → `loadState()` 用持久化旧值回滚 `prefs` 并回写 `themeMode`。证据：点击后 1ms `themeMode=dark`，120ms 内被打回 `system`。修法：`setMode` 改 `useCallback([])`＋hydrate 加 `loadStartedRef` 只跑一次。复测：三态均生效且刷新保持；见 `docs/qa/真机QA-结果-2026-10-30.md` |
| BUG-002 | P1 | 否 | 构建产物 `dist/manifest.webmanifest` 的 `short_name` 与 `apple-mobile-web-app-title` 均为「肌肉守护者.pwa」，装到桌面后图标名会带 `.pwa` 后缀 | CLOSED（2026-10-30 16:19） | 主开发者修复 | 根因：`scripts/prepare-web.cjs` 硬编码 `.pwa` 后缀。修法：两处均改为「肌肉守护者」；重建后 `grep short_name dist/manifest.webmanifest` 得「肌肉守护者」 |
| BUG-003 | P1 | 否 | 真机长按页面文字会弹 Chrome 文本选择菜单（「取消」浮条），遮挡正在展示的训练界面 | CLOSED（待用户真机复核） | 主开发者修复 | 修法：`prepare-web.cjs` 注入 `html,body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}`。证据截图 `docs/qa/shots/dev-longpress-selection-popup.png` |
| BUG-004 | P0 | 是 | 小米自带浏览器（com.android.browser 20.29）中打开已安装的 PWA，训练全程无任何语音 | CLOSED（2026-10-30 17:12） | 主开发者修复 | 根因：MIUI 浏览器**不提供 Web Speech API**——`typeof speechSynthesis === 'undefined'`、`typeof SpeechSynthesisUtterance === 'undefined'`（小米浏览器 WebView 调试口实测）。修法：改为播**预置中文语音 mp3**（`public/voice/` 46 条，随 SW 预缓存），无对应剪辑才退回系统 TTS。验证：真实触摸点「1分钟」→ 播放序列 `prep-3/prep-2/prep-1/start` 各一次；logcat `AudioTrack createTrack_l ... mSampleRate=24000 ... packageName: com.android.browser`；2 分钟档跑到整分钟播 `rest-1.mp3` |
| BUG-005 | P1 | 否 | 真机（小米浏览器）打开设置面板 → 底部「清空所有记录」「关闭」被裁到屏幕外，面板不可滚动，只能点遮罩关闭 | CLOSED（2026-10-30 17:34） | 主开发者修复 | 根因：`Sheet` 面板 `maxHeight:88%` 但内容不滚动，加「数据」区后内容变高即溢出。修法：`Sheet` 内容改 `ScrollView` 承载（`src/components/Sheet.tsx`）。验证：面板滚动祖先 `scrollHeight 716 / clientHeight 580`，滚到底后「关闭」`y=605 < 视口 690` 可见可点，截图 `docs/qa/shots/dev-settings-data.png` |
| BUG-006 | P0 | 是 | 微信 webview（Note 12T Pro）打开首页 → 右侧被裁、5/10 分钟档位溢出屏幕 | CLOSED（2026-10-30 17:50） | 主开发者修复 | 根因：`MinuteChip` 写死 `minWidth:56`，5 列 + gap 在窄视口放不下 → 整页横向溢出。修法：`flexBasis:0 / minWidth:0`、行内 `flexWrap`、全局 `overflow-x:hidden` + `viewport-fit=cover`。验证：320/360/393 CSS px 下 10 个档位 `maxRight` 分别为 288/328/361（均 ≤ 视口），无元素 `right > innerWidth` |
| BUG-007 | P0 | 是 | 小米自带浏览器菜单里「添加到桌面」为灰色不可点（入口存在） | CLOSED（2026-10-30 18:13 用户确认） | 主开发者 | 根因：小米浏览器对 `display:standalone` 的页面禁用该入口（走自家 PWA 安装），实测 example.com 为 `enabled=true`、本项目为 `false`。修法：manifest `display` 改 `browser`（`PWA_DISPLAY` 可切回）。验证：同产物在全新 origin（localhost:8800）入口 `enabled=true`，并成功弹出「编辑快捷方式」→ 确认。**更正**：17:52 的「`display:standalone` 导致置灰」结论是**错的**（那次对照恰好都是根路径）。18:10 重做隔离实验：同一台机、同为 http、`display:standalone`，**根路径 `/` 与子路径 `/p064/` 的入口均为 `enabled=true`**，且子路径点下去真的弹出「是否将该网站添加到桌面以便离线查看」→ 确定 → 桌面出现「肌肉守护者」图标。真因：小米浏览器把**已经登记过的网址**视为已安装（再开该 URL 直接进 `webapps.pwa.PWAActivity` 无地址栏全屏），此时「添加到桌面」才变灰；这个登记状态在浏览器侧，清站点数据清不掉。 |

## AC 操作级记录（**AC 结论不在本表落**）

> 唯一落盘位＝`docs/qa/产品验收追踪矩阵.md`（列数以模板为准，状态枚举 `OPEN / PASS / FAIL / BLOCKED`；本轮矩阵按 QA 委派口径使用 `PASS / FAIL / NOT_TESTED / PARTIAL`，`NOT_TESTED` 等价 `OPEN`）。本表只记操作过程证据，供矩阵引用。

| AC 编号 | 前置数据/边界样本 | 设备/视口 | 操作步骤 | 实际结果 | 证据位置（截图/浏览器日志/路由） | 关联缺陷 ID | 矩阵状态回填 |
|---|---|---|---|---|---|---|---|
| AC-09 | 造 2026-10-30、10-29、10-01 三天记录（180s+120s/60s/60s） | Node / jsdom（无 UI） | `stats.test.ts` 5 例：`dayKey`、`lastNDays(7)`、`todaySummary`、`sumSeconds`、`sortTrainingsDesc`、`dateLabel` | 7 桶含今天、今日 300s、次数 1、边界日归属正确 | `src/domain/__tests__/stats.test.ts`；`HANDOFF.md:30`（13 单测全过） | — | PASS |
| AC-38 | 倒计时 180s、自由计时 0s 起，跨 59s/61s/121s/125s | Node（无 UI、无音频） | `timer.test.ts` 3 例：`nextVoiceMark` 倒计时/正计时、`initialVoiceMark` | 每个整分钟仅播一次，同一分钟不重复 | `src/domain/__tests__/timer.test.ts` | — | PARTIAL（仅逻辑，未出声） |
| AC-17 | 空数据，默认 `themeMode=system` | 桌面浏览器（Web QA 通道） | 训练 tab → 右上角「设置」→ 依次点「跟随系统」「浅色」「深色」 | 三按钮均无状态变化；语音开关与「关闭」正常 | 无截图落盘；断点链见 BUG-001 | BUG-001 | FAIL |
| AC-31 / AC-40 | 原型固定演示数据 | 浏览器 127.0.0.1:8791 | 打开原型 → 切方向 A/B/C → 训练页对照 | V2 冒烟记为 PASS；复核发现 V2 文件已删切换入口，仅余 CSS 注释 | `docs/design/prototype/SMOKE-2026-10-30.md`；`index.html:130-141` | — | PARTIAL |

## 真机QA会话能力预检结果（每真机 session 正式用例前必填，PASS 才进正式 QA，否则停）

> 本项目**尚未开真机 session**，以下逐项如实记「未执行」，禁止以历史报告代替。

- 日期/任务名：未执行（Phase2 真机 QA 未启动，等 BUG-001 修复与用户四项拍板）
- session ID：—
- 模型精确ID：—
- Runtime：—
- 原生CUA是否实际注入：未注入（本次未开 session，未验证 `mcp__cua_repl.js` 是否存在）
- 可用工具精确名称：—
- CLI备用入口是否存在（Bash→orca computer CLI）：未验证
- Orca Runtime（`orca status --json` 实时结果，禁沿用旧报告）：未执行
- 能力（`orca computer capabilities --json` 实时结果）：未执行
- 权限（Accessibility／Screenshots／Orca应用访问）：未执行
- 读屏结果：未执行
- 截图结果：未执行
- 点击并恢复结果：未执行
- 输入并清除结果：未执行
- 滚动及可见位移结果：未执行
- 界面恢复确认（无残留）：—
- 最终结论：`NOT_VERIFIED`
- 原始错误摘要：—
- 是否允许进入正式QA：NO（矩阵内 AC-01/19/20/21/22/33 因缺真机证据记 `NOT_TESTED`）

## Fix Attempt Fingerprint

- Task ID: TASK-004-theme-btn-fix
- Root Cause Hypothesis: 非事件层问题。`onPress` 实测有触发（fiber 内 `PressResponder._config.onPress` 埋点确认被调用）；真因是 `setMode` 引用不稳定使 hydrate effect 反复执行，`loadState()` 以旧值覆盖并回写 `themeMode`
- Approach: ①`ThemeContext.setMode` 改 `useCallback([])` 并纳入 value memo 依赖 ②`App` 增加 `loadStartedRef` 保证只水合一次
- Files Changed: `src/theme/ThemeContext.tsx`、`App.tsx`
- Verification: typecheck 0 错、lint 0 错（仅既有 2 条 import/no-duplicates warning）；Neo 后台三态切换＋刷新持久化 PASS；真机跨杀进程保持 PASS
- Failure Reason: —
- Difference From Previous Attempt: 前一次（QA 观察阶段）假设「遮罩拦截/合成事件失效」；本次以运行时埋点证伪，改为状态被回滚
