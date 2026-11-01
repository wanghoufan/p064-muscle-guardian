# USER_MODEL_OVERRIDE｜一句话切模型

> **表内「备注」列（即第 6 列 `调用方式`）规矩**：只写**当前最新、已真调跑通**的调用命令与使用规矩。
> **禁止出现**：历史切换记录（「由 A 切 B」）、日期与「用户令」、已被取代的旧备用、限流／不可用／报错的旧情况回放、旧经验与旧理由。
> **换账号、限流、临时不可用属运行期处理，不进备注**（多账号切换由 `scripts/codebuddy-auto.sh` 自动完成，不是表的职责）。
> 新智能体读本列，只应看到**现在该怎么调**；历史由 `CHANGELOG.md` 与 Git 记录，表内不留档。

| 角色 | 模型（精确ID，照抄执行） | 执行通道 | 备用模型 | 备用执行通道 | 调用方式 |
|---|---|---|---|---|---|
| task-manager | 开窗口时定 | 当前客户端窗口（自动探测） | — | — | 按 `bash scripts/detect-client.sh` 探测结果派工：`mode=window_subagent` 即当前客户端窗口内 subagent 直派（按开窗口时模型执行），`mode=channel_cli` 即无原生子代理、走通道 CLI |
| supervisor | opencode-go/deepseek-v4.1-flash | opencode | — | — | 派工基础设施走 opencode 直调：`opencode run --auto -m opencode-go/deepseek-v4.1-flash "任务"`（**opencode 通道跨目录读写必带 `--auto`**，否则被 `external_directory` 静默拒、步骤假成功）。**与 builder 同模型、不同角色**：builder 写代码，supervisor 只对编排者说话、只读复检、兼 Phase Integrity 六查与账本校验，不改业务代码。表内记全ID，禁本窗口代做 |
| builder | codebuddy/deepseek-v4.1-flash | codebuddy（**走 codebuddy-auto.sh，429 自动切账号**） | opencode-go/deepseek-v4.1-flash | opencode | 派工基础设施走 codebuddy 直调：`codebuddy --model deepseek-v4.1-flash --effort high -y -p "任务"`（非交互必带 `-y`，验成功只看正文；codebuddy 无跨目录沙箱限制，跨项目读写无需额外标志）。**主用 codebuddy 通道的 `deepseek-v4.1-flash`（走 codebuddy-auto.sh，429 自动切账号），备用 `opencode-go/deepseek-v4.1-flash`** ⇒ 与 supervisor／code-reviewer **模型同名、通道互为备份**。用户口语「deepseek-flash」按别名口径落在 `deepseek-v4.1-flash`（codebuddy 通道目录里无字面 `deepseek-flash`）。**切备**：主通道超时/限额 → `opencode run --auto -m opencode-go/deepseek-v4.1-flash "任务"`（**跨目录必带 `--auto`**，否则被 `external_directory` 静默拒、步骤假成功），DISPATCH 的 `used` **仍填主**、note 记切备原因与所用通道；再限额 → 停派喊人。表内记全ID，禁本窗口代做 |
| planner | codex/gpt-6.1-terra | codex | — | — | **Phase1 只做把关者/审查者，不亲手写 plan 正文**（拟稿与改稿归 builder，planner 只审查打分与列缺项；不合格打回 builder，planner 不自己写，违反按 `WRONG_ROUTE` 打回）。派工基础设施走 codex 直调；CLI 用短名 `gpt-6.1-terra`：`codex exec -m "gpt-6.1-terra" -s danger-full-access --skip-git-repo-check "任务" </dev/null`；**需 Codex CLI ≥0.159.2**；**带 `-s danger-full-access` 解禁沙箱**（默认沙箱写不了文件，产品审查汇总无法落盘）；**解禁只解决沙箱，不解除 Phase1「禁改业务代码」约束**；须在账本 note 记带了该标志；表内记全ID，禁本窗口代做 |
| code-reviewer | opencode-go/deepseek-v4.1-flash | opencode | — | — | `opencode run --auto -m opencode-go/deepseek-v4.1-flash "任务"`（**跨目录读写必带 `--auto`**，否则被 `external_directory` 静默拒、步骤假成功；验成功只看正文）；表内记全ID，禁本窗口代做 |
| qa | codex/gpt-6-luna | codex | — | — | 派工基础设施走 codex 直调；CLI 用短名 `gpt-6-luna`，**按 `AGENTS.md` 解禁口径带 `-s danger-full-access`**：`codex exec -m "gpt-6-luna" -s danger-full-access --skip-git-repo-check "任务" </dev/null`（`-s danger-full-access`＝关闭沙箱、给完整访问权，用于解端口绑定/网络限制，实测可绑 127.0.0.1 端口）；**解禁范围＝QA＋planner＋senior-expert，其他角色是否可带以 `AGENTS.md` 口径为准**，禁超出口径乱带，且每次带该标志须在账本 note 记账；表内记全ID，禁本窗口代做。普通QA（回归/校验/DoD）走 codex Luna；真机QA（adb/Expo）走本窗口 bash 直驱（开窗口模型）。**口径以 `AGENTS.md`「TM 代做边界」为准**：真机直驱与 TM 兜底**一律记 `executed_by`＋note**（真机直驱记 `executed_by=task-manager` 并注明 qa 卡允许），不得以「supervisor 不记偏离」为由免记。 |
| product-reviewer | codebuddy/glm-5.3-flash | codebuddy | — | — | 派工基础设施走 codebuddy 通道直调：`codebuddy --model glm-5.3-flash --effort high -y -p "任务"`。只读研究、禁写业务代码与改 Plan。**产品审查双审链的审查 A 位即本模型**，与审查 B（`codebuddy/deepseek-v4-pro`）**默认可并发、零产出则退回串行** |
| experience-recorder | — | — | — | — | **由编排者（task-manager）自做，不派工。** 不占模型行、不进通道目录、不造 DISPATCH 派工行。触发时机（收尾）、写入位置（根 `经验一句话.md` 追加一句）、标准（只写可复用的经验、不写流水账）均不变，执行者＝编排者本人 |
| neat-freak | — | — | — | — | **由编排者（task-manager）自做，不派工。** 不占模型行、不进通道目录、不造 DISPATCH 派工行。触发时机（收尾）、写入位置（改对应 docs 原文＋交接记一笔）、标准（唯一现役答案）均不变，执行者＝编排者本人 |
| senior-expert | codex/gpt-6.1-sol | codex | — | — | 派工基础设施走 codex 直调；CLI 用短名 `gpt-6.1-sol`：`codex exec -m "gpt-6.1-sol" -s danger-full-access --skip-git-repo-check "任务" </dev/null`；**需 Codex CLI ≥0.159.2**（低于则拿不到该模型目录）；**带 `-s danger-full-access` 解禁沙箱**（升级任务需写业务仓库，默认沙箱写不了）；表内记全ID，只接升级任务，禁本窗口代做 |
| db-admin | volcengine-plan/ark-code-latest | opencode | radeon-mimo/MiMo-V2.6-Flash | Claude Code | 派工基础设施走 opencode 直调：`opencode run -m volcengine-plan/ark-code-latest "任务"`（ark-code-latest 模式，实际模型由控制台管理）；表内记全ID；工作区固定本机 000-alw-数据库管理专家仓，禁本窗口代做 |

<!-- TM 资格测试候选（A/B）：opencode-go/deepseek-v4.1-flash 与 opencode-go/mimo-v2.6-flash，Runtime=opencode；TM 行仍"开窗口时定"，主备由用户批准后按"改表→真调→记账"处理（见 docs/model/TASK-MANAGER-QUALIFICATION.md）。 -->

## 产品审查双审派工约定（**不新增角色**，复用 planner + product-reviewer）

用户口令「第三阶段产品审查」触发。位置＝**Phase1(PLAN) 末尾、Develop Approval Human Gate 之前**；不新增 Phase/状态/Gate。

| 位 | 角色 ID（不变） | 模型（精确 ID） | 调用方式 |
|---|---|---|---|
| 组织者 / 汇总 | `planner` | `codex/gpt-6.1-terra` | `codex exec -m "gpt-6.1-terra" -s danger-full-access --skip-git-repo-check "任务" </dev/null` |
| 独立审查 A | `product-reviewer` | `codebuddy/glm-5.3-flash` | `codebuddy --model glm-5.3-flash --effort high -y -p "任务"` |
| 独立审查 B | `product-reviewer` | `codebuddy/deepseek-v4-pro` | `codebuddy --model deepseek-v4-pro --effort high -y -p "任务"` |

- **表结构不动**：上表与本节并存，不改上表列结构；账本 `role` 记 `product-reviewer`，`model` 按实际执行者分别填（符合 `provider/model` 精确写法）。
- **可并发，但必须校验产出**：A、B 可并发派发，**每份收工必须跑 `bash scripts/check-dispatch-output.sh docs/review/PRODUCT_REVIEW_*.md`**（或专用 `check-product-review.sh`）。**兜底口径**：同一批并发若出现零产出，该通道后续退回串行。
- **产出校验（必守）**：每份审查**必须校验产出文件存在且非空**，缺或空即判该轮 `BLOCKED` 并**重跑**，不得因 exit 0 就放行、不得手工代写补齐。
- **汇总落盘方式**：planner(codex) 带 `-s danger-full-access`，**可直接写盘**，不需要「输出到 stdout 再由编排者落盘」的绕行。若某环境解禁失效（回「需切换到可写工作区」且 exit 0 零产出），才退回 stdout 落盘，并**按「缺产出即 BLOCKED 重跑」处理，禁信 exit 0**。
- **独立性**：A/B 不得看到对方结论、不得看到汇总结果；只读，禁止写业务代码与改 Product Plan。
- **审查维度白名单**（非代码层面）：用户使用体验／交互逻辑与流程顺序优化／新增或优化功能建议。
- **禁项**：代码风格、重构、命名、测试覆盖率、依赖升级——出现即判 `WRONG_ROUTE` 打回。
- **汇总不可抄边**：planner 须产出「一致项／分歧项＋裁决依据／仅 A／仅 B／明确不采纳项」；无分歧也要写两模型覆盖差异检查结论。
- **产物**：`docs/review/PRODUCT_REVIEW_<plan版本>_<日期>.md`，结构照 `docs/roles/product-reviewer.md`。
- **重复触发**：同一 Product Plan 版本已出报告则不重跑，除非用户明说重跑或 Plan 已升版本。
- **DEV_BASELINE**：过 Gate 进 DEVELOP 时，本报告作为成员并入基线。

### 调用通道说明
- **当前客户端窗口（自动探测）**：每轮开工先跑 `bash scripts/detect-client.sh`（输出 `client=/subagent=/mode=`，认客户端顺序＝bundle id → TERM_PROGRAM → 环境变量 → 父进程链 → 仓库痕迹目录仅作提示）。`mode=window_subagent`＝当前客户端有原生子代理，在窗口内直派（TM），可享真 resume／并行／worktree 隔离；`mode=channel_cli`＝没有原生子代理或客户端未识别（保守默认），改走通道 CLI，**只在汇报里带一句"当前客户端未识别，按 CLI 通道派"，不找用户**。已校准客户端＝Orca／Trae／Qoder／Codex／Claude Code／opencode；新客户端跑一次 `bash scripts/detect-client.sh` 校准后加进脚本映射即可
- **opencode**：`opencode run --auto -m <精确ID> "任务"`（supervisor/code-reviewer/db-admin；**跨目录读写必带 `--auto`**，否则 `external_directory` 静默失败）
- **codebuddy**：`codebuddy --model <精确ID> --effort high -y -p "任务"`（builder 主；走 `scripts/codebuddy-auto.sh` 自动切账号）
- **codex**：`codex exec -m "<短名>" --skip-git-repo-check "任务" </dev/null`（planner/senior-expert/qa）
- **Claude Code**：`radeon-mimo/MiMo-V2.6-Flash` 备用经 Claude Code 调用（policy.json `runner_bin: "claude"`）
- **ark-code-latest 模式**：分工表只写 `volcengine-plan/ark-code-latest`，实际模型由火山方舟控制台切换（3-5 分钟生效），不在配置中写具体模型 ID
