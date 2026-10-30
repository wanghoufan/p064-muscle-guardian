# agent.md｜本项目踩坑与交付约定

## 浏览器 QA（2026-10-30 用户令，长期有效）

- 本项目真机／网页 QA 一律通过 **MCP 操作 Neo 浏览器**（BrowserOS），在后台执行。
- 禁止弹出浏览器窗口、禁止碰主 Chrome、禁止占用电脑前台焦点。
- 能复用已打开的标签就复用，不得反复新建标签；测试结束后必须关闭本次测试标签。
- 当前客户端未挂载 Neo MCP 时：立即停下并向用户说明，**不得**用内置浏览器 / Chrome / Playwright 顶替执行 QA。

## 踩坑（2026-10-30 真机阶段）

- **交付浏览器以用户实际所用为准**：计划写「Chrome / 系统浏览器」是二选一，两者都要冒烟；只测 Chrome 会把「小米浏览器无 Web Speech API」这种致命问题留到用户手上。
- **小米浏览器 = com.android.browser**：无 `speechSynthesis` / `SpeechSynthesisUtterance`（不是权限也不是静音）；但暴露 `browser_webview_devtools_remote_<pid>`，可用 CDP 精确驱动。
- **原生菜单别靠盲点**：Chrome/小米的 ⋮ 菜单有滚动静止惯性，`adb input tap` 会错位命中相邻项。可靠做法＝滚到列表末端夹紧 → `uiautomator dump` 取 bounds → 点中心；工具栏按钮的 y 以 bounds 为准（工具栏在 y≈94–248，不是 78）。
- **`input text` 不能输中文**，应用抽屉里按拼音搜也不稳；核验「是否装上」用 `pm list packages | grep -i webapk` + 桌面/抽屉截图，别只看 Chrome 面板文案（它会显示「已安装此应用」却没落地包）。
- **小米浏览器「添加到桌面」变灰的真因**：它只在页面**不是**可安装 PWA 时才允许建快捷方式。`display:standalone` → 该项 `enabled="false"`（实测 example.com 反而 `enabled="true"`）；改 `display:browser` 后同一页面恢复可用，且「编辑快捷方式」弹窗正常、名称取 manifest name。已把 `prepare-web.cjs` 的 display 做成 `PWA_DISPLAY`（默认 browser）。
- **改完仍灰＝该 origin 的旧安装态没清**：小米浏览器按 origin 记「已安装/曾是 PWA」，页面侧清不掉（unregister SW + 删 caches 无效）。对照组：同一台机器、同一份 `display:browser` 产物，在新 origin（localhost:8800）入口立刻可用。解法：清该站点的浏览器数据，或换新地址。
- **Service Worker 会把 manifest 一起 cache-first 缓存**：改 manifest 后线上仍读到旧值，必须 unregister SW + 删缓存（或等新 SW 二次加载）再判断，否则会误判「改了没生效」。
