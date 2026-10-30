# 接手速览｜064-ing-肌肉守护者

> 你是刚接手本仓库开发的智能体？先花 2 分钟读这份，再按末尾顺序读指针文件。**不要凭空猜测项目现状**——本文件就是为你写的。

## 一句话
「肌肉守护者」＝给长辈用的**深蹲训练 App**。技术栈 Expo / React Native，同时产出 Web 版（PWA，可添加到桌面）和 Android APK。数据**全本地**（AsyncStorage），无登录、无后端、不上传。当前版本 **v0.1.0 已发布**。

## 当前状态（截至 2026-10-30 晚）
- **仓库**：`wanghoufan/p064-muscle-guardian`，`main` 分支，**公开（public）**
- **在线站**：Cloudflare Pages `https://p064-muscle-guardian.pages.dev`（已验证可访问）；另镜像 GitHub Pages
- **GitHub Release**：`v0.1.0`，含 release 签名 APK `muscle-guardian-v0.1.0.apk`（中文文件名会被 gh 降级，故用 ASCII 名上传）
- **README**：已重写为应用说明（单语中文，因 `src/i18n/strings.ts` 写明「不做英文」走 `--no-en`）；`validate_readme.py` → `DOCUMENTATION_READY`
- **主页 / 个人站**：已在 `wanghoufan/wanghoufan` 主页 README（健康分类，总数 38，双语 parity OK）与 `p003-houfan-xuezhang-site` 个人站（`slug=muscle-guardian`，封面 `public/projects/muscle-guardian.png`）登记
- **截图**：`docs/qa/shots/` 有训练/测试/统计/设置四张真实界面图 + `web-cover-1600x900.png` 封面

## 接手前必须知道的三条红线
1. 🔒 **签名密钥密码不可恢复**：只存在于本机 `android-apk/.keystore-pass`（gitignore 不入库）和你与用户的历史对话里，**任何仓库 / 文档都不含明文**。构建用 `bash android-apk/build-release.sh`（脚本自动读该文件，无需手输）。密码丢了＝无法给已发布 App 打更新包，用户需自行离线备份。
2. **仓库是 public**：绝不把任何密钥、隐私、内部链接写进会被提交的文档或代码。
3. **项目只做中文**：`strings.ts` 明确要求不做英文。新增 README / 文档默认中文；英文版仅在已建立的双语位点（主页 README、个人站）同步。

## 按这个顺序读，5 分钟全懂
1. `docs/handoff/HANDOFF.md` ← 主线交接（进展 / 下一步 / 红线 / 三日流水）
2. `AGENTS.md` ← 开工路由与红线
3. `docs/architecture-facts.md` `docs/risks.md` `agent.md` ← 架构事实 / 风险 / 踩坑
4. `docs/pm/PRODUCT_PLAN.md` ← 需求真源（当前 V1.1）
5. `git log` ← 所有提交的来龙去脉
6. `.workbuddy/memory/` ← 本机每日流水（含今晚发布细节）

## 还差什么（接手后可能要做的）
- 图标仍为方向②，A1 已定方向①（腿形护盾）→ 重出 192 / 512 / 180
- 用户人耳确认语音（「三二一开始」/ 整分钟播报）后正式签收首次发布
- AC-33 冻结记录未产出（验收矩阵唯一 NOT_TESTED）
- 窄屏 360×640 与 OPPO / 华为安装入口说明（风险 R3）

## 给用户的一段「接续提示词」（直接复制给新智能体）
> 你接手 GitHub 仓库 `wanghoufan/p064-muscle-guardian`（本地路径见下）的开发。先读 `docs/handoff/ONBOARD-NEXT.md` 与 `docs/handoff/HANDOFF.md`，按里面的顺序搞清楚现状，**不要凭空猜测**。当前 v0.1.0 已发布（Pages 在线站 + GitHub Release + Android APK）。重要约束：① 签名密钥密码只在本机 `android-apk/.keystore-pass`，仓库里没有任何明文，别试图从代码里找；构建用 `bash android-apk/build-release.sh`。② 仓库是 public，别提交任何密钥。③ 项目只做中文（`strings.ts` 规定）。接手后先告诉我你理解了什么、以及准备做什么，再动手。
