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
- **小米浏览器「添加到桌面」变灰的真因＝网址不是「子域名根路径」**（2026-10-30，两轮误判后定案）：它只对 `https://<name>.pages.dev/` 这类根路径放行；GitHub Pages 项目页 `/p064-muscle-guardian/` 子路径一律置灰，与 `display` 无关（曾误判为 `standalone` 所致，已更正）。证据：同一台机同份代码，`github.io/子路径` = `enabled=false`，`pages.dev/根路径` = `enabled=true`，可装；对照项目提词器 `p059-...pages.dev` 根路径可装。解法：主交付走 Cloudflare Pages 根路径（`npm run deploy:cf`）。**建议进用户级**
- **对照实验一次只改一个变量**：上述误判源于把 `display` 与「origin/路径」放在同一次对照里改，两个变量一起动就无法归因；正确做法是先固定其余条件（同机、同协议、同 display），只切路径，再单独切 display。
- **别把交付绑在浏览器菜单上**：国产 ROM 浏览器的安装/快捷方式行为各版本不同且不可编程（已登记的网址再开直接进 `PWAActivity` 无地址栏、入口随之变灰）。老人交付需要一条不依赖菜单的兜底：本项目做了 WebView 内嵌 APK（`android-apk/`，aapt2+d8 免 Gradle）。**建议进用户级**
- **清理临时文件只删本项目前缀，不许通配**：本轮按 `rm -f /tmp/*.xml` 清理，把别的项目遗留的 uiautomator dump 一起删了（可再生，但属越界）。正确做法：按前缀（`/tmp/p064-*`、`/tmp/muscle-*`）或先 `ls` 再逐个删。**建议进用户级**
- **Service Worker 会把 manifest 一起 cache-first 缓存**：改 manifest 后线上仍读到旧值，必须 unregister SW + 删缓存（或等新 SW 二次加载）再判断，否则会误判「改了没生效」。
