# governance-dispatch.md

> **本文件是治理细则真源**（2026-10-22 自 `AGENTS.md` 下沉，内容原文搬运、未删规则）。
> 触发条件：读它的人是**编排者**：两阶段治理、Phase-aware 派工链、升级规则。
> 不需要本文件时**不要读**（省上下文）——`AGENTS.md` 只留红线与索引。

- 状态：`PLAN / WAITING_HUMAN_APPROVAL / DEVELOP / PLAN_REOPEN_REQUIRED`（仅Change C受控重开期间；`PROJECT_PHASE` 当前值以 HANDOFF 为准）。
- Phase1（PLAN，用户口令`第一阶段，计划`）：task-manager／supervisor／product-reviewer（显示名 Research Reviewer，内部 ID 不变）／**builder（拟制与修改 `docs/pm/` 的 plan 正文 ＋ 制作设计验证用原型，见下）**；**planner（Sol）为把关者，只审查打分与列缺项，不亲手写 plan 正文**；禁 code-reviewer／qa 派工（正式 QA 是 Phase2 角色），禁业务代码改动，禁 Release。PLAN 链（**2026-10-08 用户定：拟稿与改稿归 builder，planner 只把关，省 Sol 额度**）：Builder(deepseek-flash) 拟稿→Research Reviewer 审→**Planner(Sol) 审查打分＋列全缺项**→不合格**打回 Builder 改稿（planner 不亲手写）**→…→Readiness Gate→Human Gate；用户不搬运反馈（TM 自动回传）；`PLAN_READINESS_SCORE>=90` 且模板 Gate 全条件满足（P0=0＋blocking P1=0＋关键事实已验证＋核心假设已合理验证＋视觉与交互验收标准非空且逐条可测）才进 WAITING（定义以 `docs/pm/PRODUCT_PLAN.template.md` 为准，卡内不另写）。
- **Phase1 原型权限边界（2026-10-09 用户定，P046 教训）**：Phase1 允许现有 builder 制作**设计验证用的 HTML/CSS/JavaScript 原型**，但**仅限隔离的原型目录 `docs/design/prototype/`**。这是**设计验证产物，不是正式业务代码，不代表授权进入 Phase 2**。**仍禁止**提前开发 Android APK／生产业务模块／正式后端服务，或实施未经批准的 SDD TASK。Phase1 内部可做原型自检（打开、点关键交互、浅深色与语言切换），**但不额外启动正式 QA 角色**（那是 Phase2 角色）。**不新增角色或 Phase。**
- **Phase1 必须交付可运行交互原型（APP 默认）**：以后新建的、有用户界面的 APP，Phase1 **默认必须提供本地完整可运行的 HTML 交互原型**（用户明确批准其他可运行形式时除外），要求：①核心页面完整，**不以局部演示替代整套流程**；②关键按钮、跳转、返回、滚动及状态切换**能实际操作**；③交接包中已确定的名称、图标、品牌、**真实图片素材全部落实**；④浅色/深色、语言及代表性异常状态能演示，**模拟系统行为必须标注**；⑤**清楚提供 HTML 文件路径及本地打开或启动命令**。**PDF、截图、纯文档、在线概念图和单独的示例预览 HTML，不能冒充上述完整原型。**
- **原型交付完整性检查条件（2026-10-09，Readiness Gate 的附加条件，不是新 Gate）**：**有用户界面的 APP** 进 `WAITING_HUMAN_APPROVAL` 前，现有 Readiness Gate 必须额外满足下列全部条件，否则**判现有 Gate 不满足**，不允许仅凭文档评分进入待人工审批：①原型文件确实存在；②本地可以正常启动；③关键页面及交互**通过浏览器自动化冒烟测试**；④用户能实际打开，**不依赖编排者现场讲解**；⑤证据中记录**路径、运行方式、测试结果和已知限制**。**文件存在检查与真实运行检查必须分开**——不能用「检查 HTML 存在」代替交互测试。
- Human Gate：`WAITING_HUMAN_APPROVAL`（`PLAN_GATE=READY_FOR_HUMAN_REVIEW`）时 TM 停循环只找人一次，不可自动跨越，不可自行启动 builder；只有用户明确说`第二阶段，开发`才进 Phase2。**唯一例外＝用户当次给了`一路推到底`连续推进授权**（见下条）：此时本 Gate 被当次授权覆盖，PLAN 完成后直接进 DEVELOP，**授权范围＝当次给的那个目标**，做完即停；**首次发布用户签收仍必须停**（连续推进不停签收）。未给该令时本 Gate 照旧不可跨越——**默认停、授权才自动**，别把授权当默认。
- Phase2（DEVELOP）：锁定 `DEV_BASELINE=PRODUCT_PLAN_Vx.x`，默认主链 Builder→Reviewer→QA→Supervisor→TM（模型以 override 表为准）；禁随意改 Plan（Plan 变更只走 Change C Controlled Reopen＋Human Approval＋新版本＋新基线）；product-reviewer（Research Reviewer）默认不派，recorder/neat 只在收尾派。
- Change Request（用户口令`变更请求：……`，TM 分类）：`CHANGE_REQUEST: NONE / A / B / C`——A=开发内小改留 DEVELOP 不召 Planner；B=局部功能变化更新局部 Requirement/DoD 留 DEVELOP 不召 Sol Planner；C=产品/架构变更进 `PLAN_REOPEN_REQUIRED`，局部暂停＋Sol Planner＋Research Reviewer＋Human Approval＋新 Plan 版本＋新 DEV_BASELINE 回 DEVELOP，不全量重跑。
- 独立重申：task-manager（唯一对人说话）与 supervisor（只对编排者说话）保持独立，不合并；无 Spark Gate；无额度状态机字段。
- **复核粒度＝交付单元，不是每个 task（2026-10-17 用户定，**默认制度，不需任何额外口令**）**：
  **同一里程碑/大阶段内的多个小任务，合并为一个「交付单元」，复核链对**交付单元**跑一次，不对每个 task 跑。**
  - 单个 task 完成时：builder **自审＋轻量自测**即可，**不派 code-reviewer／qa／supervisor**；账本照记一行（这是记账要求，不是复核）。
  - 到**交付单元边界**（一个阶段收口、功能可用、准备给人看）才依次派 `code-reviewer → qa → supervisor`，**一次走完**。
  - 记法：交付单元用独立 task id（如 `<阶段>-D1`），其行的 `chain_status=ACCEPTED/OPEN` 即复核结论 —— `check-ledger` 的
    `ACCEPTED-MISSING`／`SIGNOFF-MISSING` 仍按「有 qa 行必须闭环」判定，因此**质量门一道没减，只是不再对每个小改动触发**。
  - **不能延后的四类**（命中即按原粒度立即走复核，不得攒到阶段末）：①改公共契约／数据库 schema／鉴权与权限；
    ②动真机、线上数据或生产配置；③用户可见缺陷的修复（修完要验）；④涉及 secrets 或不可逆删除。
  - 理由：复核的价值在**发现跨任务的系统性问题**，不是把每个小改动各验三遍；按 task 跑会让
    「改一点」付出四倍等待，且真正该拦的（红线四类）根本没被延后。

- **铺包权限：批量铺包只有母版编排者能干（2026-10-17 用户令，因一次误伤而定）**：
  `scripts/sync-old-projects.sh` 是**批量工具**，默认会遍历全部项目。**因此**：
  ①**任何项目的编排者（含主开发者模式）都不得用它去铺「自己的项目」**——一旦执行，它改的是**所有**项目，
  等于让一个项目去动别人的仓，属越权改动他人项目；
  ②要更新**单个项目**，只能用 `ONLY_LIST="<项目名>"`（2026-10-17 新增，**只处理列出的项目，其余一律不碰**，干跑已验证 `项目数:1`）；
  ③**批量铺包由母版编排者统一执行**（含排期、跳过在跑项目、事后通知），项目侧只提出「我需要更新规则」的请求。
  **给别的智能体下指令时必须一次写清范围**——「批量 + 排除清单」这种写法极易被理解成「只影响我」，已实际造成 39 个项目被误改。
- **铺包铁律：绝不删除别人的文件（2026-10-22 用户定，最高优先级）**：
  **项目目录里的东西是别人的成果，不是垃圾。**任何铺包/同步/整理动作都**不得删除、清空、覆盖**
  项目已有文件——**只允许新增与「同名治理文件」的就地覆盖**。
  2026-10-22 真事故：母版新项目铺包脚本为修幂等写了 `rm -rf "$项目根/$顶层名"`，
  结果把正在开发的 056 项目整个 `docs/` 删掉 —— 产品计划（45 条 AC）、产品验收追踪矩阵、
  可运行原型、代码复核报告、交接文档、路线图**全部消失**，业务源码反而没事。
  **源码还在但过程文档没了 = 那一轮开发等于白做。** 该事故无法从磁盘或 git 恢复（那些文档从未被提交），
  只能靠另一个会话的上下文重写 —— 代价由用户承担。
  **因此以下四条是硬约束**：
  ①**删文件这个动作本身，在项目目录里就是错的**——脚本里出现 `rm -rf` 指向项目路径，一律当场停止并改写；
  ②铺包只允许**在空的新项目**上跑；项目已有实例文档（`docs/pm/*.md` 等非模板文件）⇒ **拒绝铺包**并报告；
  ③任何铺包动作**必须先备份项目全部文件清单 ＋ 整个 `docs/`**，铺包后逐项核对，
     **项目原有文件零丢失**才算通过；有丢失立即从备份还原并报错；
  ④新项目铺包统一走 `scripts/new-project-setup.sh`（含上述三道闸），**禁手抄步骤**——
     手抄 7 步每步都可能漏，且漏了当场不报错（2026-10-22 实测漏了 3 个坑）。
  **同理适用于任何项目目录**：清理残留、删旧文件、覆盖文档这类动作，
  一律先问用户、留备份、可回退；**不替用户决定「这个文件没用了」。**
- **常驻管理工作区永不铺包（2026-10-22 用户定）**：
  `000-alw-*` 前缀的目录是**常驻管理工作区，不是项目**（项目管家／GitHub 档案／自动化任务／
  数据库管理专家／个人偏好与技能管理）—— 它们有各自的工作流与文件体系，**一律不铺 ORCA 治理包**。
  `scripts/sync-old-projects.sh` 已加黑名单（`000-alw-*` 命中即跳过并打印 `SKIP(常驻管理工作区，永不铺包)`），
  **黑名单优先于 `ONLY_LIST`** —— 即便显式点名也跳过。理由：这些目录里的 AGENTS.md／角色卡／
  README 是**它们自己的**工作约定，被母版副本覆盖会让各自的工作流失效（2026-10-22 实测：
  数据库管理专家的 AGENTS.md 被铺包后混进 213 行 ORCA 区块，183 行自有内容被割在区块外）。
  **人工装一次不算「铺包」**（那是一次性的、可控的），但**任何自动批量动作都不许碰它们**。

- **连续推进模式（2026-10-16 用户令）**：用户说`一路推到底`／「不要中途找我」＝**对本次目标的连续推进授权**。PLAN 完成后**自动进 DEVELOP**、产品审查后**自动继续**、各复核环节**环间不问**，收工**只报一次**。**授权范围＝用户当次给的那个目标**，做完即停。**四类红线（secrets／不可逆删除／生产与他人项目／commit-push 授权）＋首次发布签收＋超出既定 Plan 范围的变更（Change C）仍然必须停** —— 本模式**不是**无限通行证，也不放宽任何红线。与主开发者触发口令**正交**：前者管「停不停」，后者管「几个人干活」。
- 升级保留：同一 Task 累计被 supervisor 打回 2 次自动升 senior-expert（Sol），或编排者判定 P0-hard 手动升；senior 接手后被打回 2 次即停线找人（详见本文件升级节）。

Phase1（PLAN）：builder(deepseek-flash) 拟稿→product-reviewer（Research Reviewer）审→**planner（Terra）审查打分＋列缺项→不合格打回 builder 改稿**→…→Readiness Gate→Human Gate（**planner 只把关不执笔**；builder 在 Phase1 **可写 `docs/pm/` plan 正文 ＋ 隔离目录 `docs/design/prototype/` 的设计验证用原型**，禁业务改动／禁 code-reviewer／qa／Release／禁 APK／禁正式后端）。**有用户界面的 APP 必须带可运行原型进 Human Gate**（见「原型交付完整性检查条件」）。- **产品审查链（2026-10-07 用户定；口令`第三阶段产品审查`（**「第三阶段」仅为口令字面，不代表新增 Phase**；实为 Phase1 末尾、Develop Gate 前的加强链，仍是「两阶段治理」）；不新增角色/Phase/Gate）**：Phase1 末尾、Develop Approval Human Gate **之前**的加强链。planner(`codex/gpt-6.1-terra`) 任组织者并冻结当前 Product Plan 版本→**串行**派两份**互不可见对方结论**的独立审查 A/B（2026-10-07 实测：codebuddy 双实例**并发会互相干扰，被抢的那个静默失败且 exit 0、零产出**；**2026-10-17 用户令改为「可并发，但必须跑产出非空校验兜底」**——并发省下的等待时间，比事后发现零产出再重跑更划算；禁并发降为**兜底手段**：同一批并发若出现零产出，该通道后续退回串行；**零产出守卫已通用化**：`scripts/check-dispatch-output.sh <声明的产出文件...>` 对**任何**派工校验「产出存在且非空」（不再只覆盖产品审查链）—— 并发放开能成立的前提就是这道门；每份**必须校验产出文件存在且非空**：收工跑 `bash scripts/check-product-review.sh docs/review/PRODUCT_REVIEW_<plan版本>_<日期>.md`（零产出或缺汇总段即 exit 1，**2026-10-17 新增，原先这条只有文字**），缺即 BLOCKED 重跑，禁信 exit 0；planner(codex) **已按用户令加 `-s danger-full-access`，可直接写盘**；仅当解禁失效（回「需切换到可写工作区」且 exit 0 零产出）才退回 stdout 落盘）（均 `role=product-reviewer`，A=`codebuddy/glm-5.3-flash`、B=`codebuddy/deepseek-v4-pro`，只读禁写业务代码与改 Plan）→两份报告交回 planner 做参考/比较/汇总/裁决→产出 `docs/review/PRODUCT_REVIEW_<plan版本>_<日期>.md`（必含：一致项／分歧项＋裁决依据／仅A／仅B／用户体验改进／交互流程顺序优化／新增或优化功能候选／**明确不采纳项**；五段须以机器锚点 `PRODUCT_REVIEW_CONSENSUS`／`_DIVERGENCE`／`_ONLY_A`／`_ONLY_B`／`_REJECTED` 落进报告，供上条脚本校验）→用户 Human Gate 把关→说`第二阶段，开发`才进 DEVELOP，报告并入 `DEV_BASELINE`。**审查维度白名单＝用户使用体验／交互逻辑与流程顺序／新增或优化功能**，非代码层面；出现重构/命名/覆盖率/依赖升级类意见判 `WRONG_ROUTE` 打回。**汇总不得抄边**，无分歧也要写两模型覆盖差异检查结论。同一 Plan 版本已出报告不重跑（除非用户明说重跑或 Plan 升版本）。派工口径见 `USER_MODEL_OVERRIDE.md`「产品审查双审派工约定」。
Phase2（DEVELOP）：builder 写→code-reviewer 复核→qa 测→supervisor 复检→编排者收齐找人（默认主链；完成判断＝角色交付＋`docs/qa/` 产品验收追踪矩阵关键 AC 全有证据（且计划内用户可见要求无遗漏、逐条已进 AC，这些关键 AC 最终状态均已通过；发布类型为 `首次发布` 的，须用户签收通过才算完成，签收前状态记 `OPEN`（用户签收属 Human Gate 范畴（用户参与）、是既有「开发前计划批准」的延续，不新增 QA Gate）），禁以单测/构建/代码审查通过或工具调用成功替代产品验收；模型以 override 表为准；product-reviewer 默认不派）。真机QA每session先过能力预检PASS才进正式，否则停（详情见qa卡）；codex 派工带 `-s danger-full-access`（**2026-10-07 用户令由「仅限 QA」放宽到 QA＋planner＋senior-expert**：QA 解端口/网络限制、planner 解「默认沙箱写不了文件致汇总无法落盘」、senior-expert 升级任务需写业务仓库；**该标志只解沙箱、不解角色职责边界**——planner 在 Phase1 仍禁改业务代码与改 Plan，禁带 Release，违反按 `WRONG_ROUTE` 打回；每次带该标志须在账本 note 记账）。**experience-recorder 与 neat-freak 均由编排者自做，不再派工**（neat-freak 2026-10-16 用户令；experience-recorder 2026-10-17 用户令，其表内模型已不在通道目录）——收尾时编排者自己记经验、自己对账文档，不造 DISPATCH 行。**派工口＝自动探测，不填表**（2026-10-03 定）：每轮开工先跑 `bash scripts/detect-client.sh` 认当前客户端（认客户端顺序＝bundle id → TERM_PROGRAM → 环境变量 → 父进程链 → 仓库痕迹目录仅作提示），按 `mode` 派工、**不找用户填**：`mode=window_subagent`＝当前客户端有原生子代理（Orca／Trae／Qoder／Codex／Claude Code／opencode 等已校准），在本客户端窗口内派 subagent，全自动、享真 resume／并行／worktree 隔离；`mode=channel_cli`＝无原生子代理或客户端未识别（**保守默认**），改走通道 CLI 直调（表定 codebuddy/codex/opencode 的角色照旧通道直调，禁套娃），**只在汇报里带一句「当前客户端未识别，按 CLI 通道派」，不找用户**。新客户端跑一次该脚本校准后加进映射即可；override 表 Runtime 列写「当前客户端窗口（自动探测）」即客户端无关，**一套模板包通用于任何客户端**。三类例外（人肉调试/外部施工/迁移基线）可起终端，见 编排者提示词 :10。基础设施活必带 docs/sop/ 对应规范（DB 带 supabase.md 或 sqlite.md，部署带 docker.md，Android 打包带 android.md），supervisor 抽查。
跳步：单文件小修可跳 planner/product；**单文件且纯文档/注释/格式类**（不改业务行为、不动逻辑）**可只做代码自审，不派 qa 与 supervisor**；**交付单元边界必须依次派 code-reviewer→qa→supervisor；四类不得延后的事项随时可派**（与「单 task 自审」不冲突：跑的是边界与四类，不是每个 task）。跳了记一句原因。**2026-10-17 用户定**：流程负担只砍在「不改行为的纯文档/格式小修」这一类，真改逻辑/真机/真数据的活仍走满复核链 —— 负担过重的问题该在**并发与等待**上解，不该在质量门上让。**边界：免派工 ≠ 免留痕**—— 已铺包项目做这类小修**仍要落极简 QA 留痕**（`docs/qa/` 一行结论 + 账本记一行 `chain_status=OPEN`），只是不为此单独派 qa／supervisor 两个角色；否则与「已铺包必须留痕」红线打架。**主开发者模式下，本行的 code-reviewer／qa／supervisor 由同一个智能体按角色卡质量标准自任，但代码自审与真实 QA 两步一个都不能省，只是执行者是自己。**分歧听谁的：技术分歧听 code-reviewer，范围分歧听 Task Manager。
- TM 代做边界（2026-09-26 定）：TM（编排者）原则上不代做角色活，三类区分——①**真机QA直驱**＝合规（qa 卡允许，note 记原因）；②**通道兜底**＝通道超时/沙箱阻塞致角色派不出，TM 可临时补位，但须①账本记 `executed_by=task-manager`、②note 写原因与通道、③同一任务兜底≥2 次即上报用户定通道；③**越权代做**＝TM 亲自写业务代码/跑 QA 并当角色交付且不记 `executed_by`，视为违规打回。
- Decision Sidecar（非角色，不占 9+1+1）：TM 仅规则无唯一答案时调 `scripts/decision/orca-decide.mjs`（照 docs/sop/decision-router.md），advisory only，失败回 V2.1 逻辑；supervisor 抽查调用点合规；每次调用落决策流水 `docs/model/JEV-DECISION-LOG.jsonl`（best-effort，只记非敏感元数据，不记原文/Key；不改 Jev 权限与 Contract）。
- 派工前通道预检（2026-09-29 定）：派任何角色前跑 `bash scripts/check-channel-preflight.sh`（拿分工表**在用**模型与三条通道实际目录对账：codex `codex debug models`／codebuddy `--help` 列表／opencode `opencode models`）。报 `CHANNEL-STALE`＝**表里有、通道目录里没有**，该角色**禁派**（先人工升客户端 `codex update` 再重跑预检，或改用该角色备用模型）。**禁自动装更新**（升级连带改目录/认证/沙箱默认，可能打翻整表）；**换模型或升客户端后必须重跑预检**（目录会变）。实证 2026-09-29：codex 0.155.1 目录无 `gpt-6.1-sol` → 派 senior-expert 必报 `not supported`，升到 0.159.2 才通。
- **opencode 通道跨目录（2026-10-14 修订，取代 09-29 旧禁令）**：opencode 通道角色（**supervisor／code-reviewer**，以及 builder 的 opencode 备用通道）在 `opencode run` 下读写**本仓以外**目录（如 `1.Active/` 下别的项目）会被 `external_directory` 权限自动拒、步骤**静默失败**，看着像做完实则没做。**实测结论（2026-10-14）：命令带 `--auto` 即解除该限制**，跨项目读、写实测均成功 ⇒ 跨目录活**不必**先取授权或切备用通道，**但必须在派工命令里带 `--auto`**（漏带就会静默失败）。临时文件仍优先放已 gitignore 的 `temp/`。（旧口径「opencode 通道无此限制」已作废。）
- External Builder Runtime 通用插座：builder 仍是 builder（9+1＋1 不新增），Runtime 仅为执行通道（本窗口 subagent / codex / opencode / External Runtime），由 override「执行通道/Runtime」列或口头指定、派工基础设施自动调用；Runtime 自带 internal reviewer/QA/self-check 仅为自检证据，不能替代 code-reviewer/qa/product-reviewer/supervisor；permission_request 走机器可读→ORCA/TM 审批单点→用户定→回 runtime，builder 不直聊用户；禁把通道角色包进本窗口subagent套娃调用（表定codebuddy/codex/opencode的角色必须走通道直调），违者打回。

- 触发：① 同一 Task 累计被 supervisor 打回 2 次自动升 ② 编排者判定 P0-hard 手动升。满足一条即升。
- 计数口径（防歧义，2026-09-26 定）：计数单元＝**同一 task id（含其返工子任务，不按角色拆分）**；只数 **supervisor 判 FAIL/打回该 Task 交付**的次数（逐次在 DISPATCH 账以 `role=supervisor,result=FAIL` 记行，可机器计数）；**QA 自身任务判 FAIL 不计**，但若 supervisor 因 QA 证据问题打回并要求该 Task 返工，则计 1 次；自修好不计数，不断链也累计。
- 升与打扰（2026-09-26 用户定）：**达 2 次即自动升 senior，不打断用户**；不得以"原因消除"为由免升，也不得为此询问用户——升级是编排者的自动动作，少中断。
- 只升当次，不永久转正。换模型/换 Runtime 即开新链（旧链结论进 HANDOFF，缓存不跨链）。升级原因 + 返工次数记进任务账本。senior 接手后不再计数升级，被 supervisor 打回 2 次即停线找人（列阻塞＋要拍的板，不再升，无更高角色）。
- senior 模型读 `USER_MODEL_OVERRIDE.md` 的 senior-expert 行。
