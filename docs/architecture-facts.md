# 架构与构建事实（事实类唯一落盘处）

> 只放「查了就知道」的事实；风险见 `docs/risks.md`，踩坑见 `agent.md`。

## 技术栈与结构

- Expo SDK 57 + React Native 0.86 + react-native-web 0.21，**只出 Web/PWA**（无原生壳）。
- 入口 `App.tsx`（三 tab 壳＋hydrate）；`src/features/{train,test,stats,settings}`；`src/domain/{timer,stats}.ts` 纯函数；`src/services/{speech,wakeLock}.ts`；`src/storage/` 单键 JSON `muscle-keeper/state`（AsyncStorage）。
- 设置里主题走 `ThemeContext`（三态 system/light/dark），独立持久化键 `themeMode`；`prefs.themeMode` 与之同步。

## 构建链

- `npm run build` = `node scripts/check-voice.mjs` → `expo export --platform web` → `node scripts/prepare-web.cjs`。
- `prepare-web.cjs` 负责：拷图标、写 `manifest.webmanifest`（`short_name=肌肉守护者`、`display=standalone`）、注入 `theme-color`/`apple-touch-icon`/`user-select:none` 样式、注册 SW、生成 `service-worker.js`（**预缓存 dist 内全部非点文件**，cache 名由内容哈希得出）、`.nojekyll`。
- `app.json` 的 `experiments.baseUrl="."` → 产物全相对路径，可直接跑在 GitHub Pages 子路径下。

## 语音（要点）

- 播报走 `src/services/speech.ts`：**预置 mp3**（`public/voice/`，46 条：prep-3/2/1、start、finish、rest-1..10、done-1..30、done-more）→ 有键就播 Audio；无键或播不了才退回 `expo-speech`。
- 音频文件由 `scripts/gen-voice.mjs` 生成（macOS `say -v Tingting -r 165` + ffmpeg，24kHz 单声道），46 条共约 476KB。
- 回归闸：`src/services/__tests__/speech.test.ts`（48 例映射）＋ `scripts/check-voice.mjs`（缺文件即构建失败）。

## 部署

- 仓库 `github.com/wanghoufan/p064-muscle-guardian`（**public**，免费套餐 Pages 不支持 private），`.github/workflows/pages.yml` push main 即构建发布。
- 线上：`https://wanghoufan.github.io/p064-muscle-guardian/`；SW 接管后离线可用。

## 真机 QA 通道

- 传输：`adb reverse tcp:8800 tcp:8800` + 本地静态服务；或直接用线上 https（推荐，安装与 SW 才成立）。
- 页面控制：Chrome → `adb forward tcp:9223 localabstract:chrome_devtools_remote`；**小米浏览器 → `adb forward tcp:9224 localabstract:browser_webview_devtools_remote_<pid>`**（pid 从 `/proc/net/unix` 取），之后同 CDP 协议。
- 取证：`adb exec-out screencap`、`adb logcat | grep AudioTrack`（验真出声）、`uiautomator dump`（原生 UI 取 bounds）。
