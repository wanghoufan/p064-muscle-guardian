# 真机 QA 预检（064-ing-肌肉守护者）

> 采集时间：2026-10-30 ｜ 方式：纯 adb 只读（未安装、未改设置、未构建）
> 产物：`dist/` 8 个预缓存文件，SW 缓存名 `muscle-keeper-e04c307dd513d526`

## 一、设备实况

| 项 | WGBMXWDIAIFMPFCQ | indq5xfi6hovay4d |
|---|---|---|
| 品牌 / 型号 / device | Redmi / 21091116AC / evergo | Redmi / 22101316C / ruby |
| Android / SDK | 11 / 30 | 14 / 34 |
| 分辨率 / 密度 | 1080x2400 / 440dpi（约 392dp 宽） | 1080x2400 / 440dpi（约 392dp 宽） |
| Chrome | 无官方 Chrome；仅 `org.chromium.chrome` 158.0.8119.0 + 系统浏览器 | `com.android.chrome` 155.0.8059.84（正式 Chrome） |
| WebView | 94.0.4606.85（2021 年旧版） | 155.0.8059.43（与 Chrome 同版） |
| TTS 引擎 | 仅 `com.xiaomi.mibrain.speech` | 仅 `com.xiaomi.mibrain.speech` |
| 系统语言 | zh-CN | zh-CN |
| 屏幕超时 | 2147483647（永不熄灭） | 600000（10 分钟） |
| deviceidle | 输出为状态变更日志，未见 idle 白名单对 Chrome 的限制 | 输出含 Settings 块，`light_idle_to=5m0s`，未见异常 |
| 可测息屏 | 可，但系统永不自动灭屏，须手动按电源键 | 可（10 分钟后自灭或手动按键） |

## 二、推荐机与理由

**唯一推荐机：indq5xfi6hovay4d / Redmi 22101316C（ruby）**

1. 装了正式 `com.android.chrome` 155，PWA 安装、Service Worker、Wake Lock 行为与真实长辈机一致；另一台只有 Chromium 158 分支包，`添加至主屏幕` 入口与 SW 更新策略不可信。
2. Android 14（SDK 34）+ Chrome/WebView 同版本 155，无「WebView 与浏览器跨版本」干扰；另一台 WebView 仍是 94，老 API 行为会污染结论。
3. 屏幕超时 600s，可自然复现息屏；另一台为「永不」，测息屏只能靠手动锁屏，无法区分「App 保活成功」与「系统本就不灭屏」。
两台分辨率/密度相同（392dp 宽），尺寸维度无差别，故以浏览器与系统版本定机。

## 三、标准流程与前置

依据 `docs/sop/android.md` §8 与 `docs/pm/用户决策清单.md` E1：

1. 能力预检：scan → deps → preflight → smoke，不过不进正式、不计账本。
2. 多设备在线必须显式指定：`export ANDROID_SERIAL=indq5xfi6hovay4d`。
3. 本地产物静态托管（端口 8800，取自 HANDOFF 既有约定；不得换端口以免与既有脚本冲突）：`npx serve dist -l 8800`（或项目既有 prepare-web 输出目录）。
4. 端口映射：`adb -s indq5xfi6hovay4d reverse tcp:8800 tcp:8800`，手机 Chrome 打开 `http://localhost:8800`。
5. 浏览器菜单「添加到主屏幕」→ 从桌面图标启动（standalone 模式）→ 首屏与离线以图标启动为准。
6. 拔线前完成安装与一次完整训练，使 SW 完成预缓存；`adb reverse --remove tcp:8800` 或拔线后 localhost 立即失效。
7. 真机直驱走本窗口 bash（codex 沙箱必 BLOCKED），Maestro 为备用通道，scrcpy 只看屏。

**为什么不能用局域网 IP 替代**：Service Worker 只在安全上下文生效，浏览器只认 `https://` 与 `http://localhost`；`http://192.168.x.x:8800` 不是安全上下文，SW 不注册 → 不可安装、无离线、`navigator.wakeLock` 也会因非安全上下文不可用。用局域网 IP 只能看界面，测不出「可安装 + 断网可用 + 息屏不灭」三项核心结论。

## 四、语音与息屏测试点

### 4.1 中文语音播报（`src/services/speech.ts`）

- 实现：`expo-speech` → Web 走 `speechSynthesis`，固定 `language:'zh-CN'`、`rate:0.9`，每次 `speak` 前先 `Speech.stop()`，异常静默降级；`hasChineseVoice()` 检测 `zh*` 语音。
- 触发链（`useTrainingSession.ts`）：点时长档 → 900ms 间隔播「三/二/一/开始」→ 第 3 声后提前 480ms 转 running → 每隔整分钟播「已练 N 分钟 / 还剩 N 分钟」→ 结束播 `cueDone`。
- 判定：①四条口令顺序正确、间隔约 0.9s，不重叠不吞字；②整分钟播报在 1:00、2:00 各响一次，内容与界面数字一致；③结束语在计时归零后 ≤1s 内播出；④全程普通话，无英文、无粤语、无机械断续；⑤音量在媒体通道且可听（约 60dB 距离 1m）。
- 已知平台限制：需系统中文 TTS 引擎 + 已下载中文语音包（本机仅小米 `mibrain.speech`，是否含中文包**未验证**，属手工前置）；Android Chrome 首次发声需用户手势解锁，冷启动直接进训练可能首条口令静默；Chrome 标签进后台后 `speechSynthesis` 会被挂起，后台不播；勿扰/静音会吞掉播报；`stop()` 后立即 `speak()` 在部分机型有 100–300ms 起播延迟。

### 4.2 息屏 / 中断（`src/services/wakeLock.ts` + `visibilitychange`）

- 实现：`navigator.wakeLock.request('screen')`，不支持或被拒时静默降级；`visibilitychange` 回前台时重新申请；计时用 `Date.now()` 墙钟差值，不依赖 tick 累加。
- 判定：①训练中静置 90s，屏幕不自灭（Wake Lock 生效）；②手动按电源键锁屏 60s 再解锁，剩余时间按墙钟正确递减，误差 ≤2s，且 App 未退出、未重置；③锁屏期间整分钟播报允许不响，回前台后数字正确即为通过（不得出现跳秒错乱或重复累计）；④通话/切其他 App 30s 返回，计时连续。
- 已知平台限制：Wake Lock 需安全上下文（https/localhost）且 Chrome 84+；页面不可见时浏览器自动释放锁，必须回前台重新申请；手动锁屏后 Chrome 冻结页面，`setInterval` 停摆 → 锁屏期间不会播报，且长时间后台（约 5 分钟）可能被系统回收，重开属正常但不得丢已存记录；省电模式会拒绝 Wake Lock；本机仅小米 TTS，VoiceOver/TalkBack 叠加时可能与 `speechSynthesis` 抢音频焦点。

## 五、真机测试清单（推荐机执行）

| # | 步骤 | 判定 | 耗时 |
|---|---|---|---|
| 1 | `adb reverse tcp:8800 tcp:8800`，Chrome 开 `http://localhost:8800`，装到主屏，从图标冷启动 | 桌面有独立图标，standalone 无地址栏，首屏 3s 内出 | 5min |
| 2 | 首屏渲染核对：两区（点档 / 自由）、字号、对比度、无横向滚动、无英文残留 | 与原型一致，无截断/重叠，字≥18sp 可读 | 3min |
| 3 | 点「2 分钟」档，不做任何额外点击 | 立即进入 3-2-1-开始，计数从 3 递减且伴随语音，无需再按开始 | 2min |
| 4 | 等待至 1:00 与 2:00，听整分钟播报 | 准点播报，数字与界面一致，无重叠吞字 | 3min |
| 5 | 计时归零，出现结束确认，点「已练完」 | 结束语 ≤1s，落库提示出现，返回首页今日累计 +2 分钟 | 3min |
| 6 | 进统计页看柱状图 | 纵坐标为分钟、7 日柱齐全、0 值留位、无错位 | 2min |
| 7 | 杀进程（最近任务划掉）后从图标重开 | 今日累计、历史记录、上次档位高亮均还原 | 3min |
| 8 | 飞行模式 + 杀进程 + 冷启动（离线） | 首屏正常渲染，不出现离线错误页，功能可用 | 4min |
| 9 | 训练中静置 90s 不息屏 | 屏幕保持常亮，计时连续 | 2min |
| 10 | 训练中按电源键锁屏 60s 再解锁 | 剩余时间按墙钟正确，误差 ≤2s，App 未重置 | 3min |
| 11 | 训练中切到微信 30s 再回来 | 计时连续、Wake Lock 重新生效、无重复累计 | 2min |
| 12 | 开 TalkBack，重复步骤 3–5 | 播报不被无障碍朗读抢占，焦点顺序合理 | 4min |

合计约 36 分钟。任一项 FAIL 记 `docs/qa/BUGS.md`，不改代码、不现场修。

**需用户手工操作的前置**：①USB 调试授权弹窗点「允许」（本机已授权，重插线需再确认）；②Chrome 设置→语音/系统 TTS 安装并选中中文语音包，先播一句测试；③首次访问允许「添加到主屏幕」；④关闭勿扰与静音，媒体音量调至 50% 以上；⑤关闭省电/超级省电；⑥允许 Chrome 后台活动；⑦测试 10 需手动按电源键（本预检不改 `screen_off_timeout`）。

结论：READY（设备与产物具备条件；唯一风险为系统中文语音包未验证，若步骤 3/4 无中文发声则转 BLOCKED）
