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
