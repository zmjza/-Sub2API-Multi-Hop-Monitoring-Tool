你自行判断本任务是否需要多智能体协作；如需开启，只允许一个主智能体统筹，任一时刻最多同时运行五个子代理，子代理完成后必须及时回收，回收后可按需启用新的子代理，禁止子代理继续派生代理。

请直接开始执行下面步骤，先读取对应文档和真实代码，再按 TDD 完成本阶段，不要只输出计划。

目标提示词类型：普通  
文件指针型：是  
任务 ID：REQ-260920-channel-usage-cache-alert  
流程档位：深度流程  
修改前评分：83/100  
五维评分：项目现状 16、修改规模 17、依赖与修改后影响 17、风险与回滚 16、验证复杂度 17  
评分证据：本任务跨 V2 adapter、SiteService、使用记录协调器、共享最近统计、后台刷新、通知状态机、SQLite 状态、共享设置契约、Renderer、系统通知、真机与双平台发布。  
当前阶段：development-and-acceptance  
当前目标：第 2 / 2 次  
目标 N/M：第 2 / 2 次  
UI 目标：跳过  
UI 路线：not-applicable；沿用当前视觉方案直接实现  
等待外部输入：否  
验收责任：Codex 真机测试  
页面样式检查：必须检查  
归档阶段：handoff；本目标结束后等待用户检查，不创建正式归档

必须读取：

- AGENTS.md 和 docs/pitfalls/README.md，以及 sub2api-adapter、rate-comparison、electron-build、tooling 相关 pitfalls。
- liran_docs/requirements/REQ-260920-channel-usage-cache-alert-需求整理.md
- liran_docs/requirements/REQ-260920-channel-usage-cache-alert-PRD.md
- liran_docs/requirements/REQ-260920-channel-usage-cache-alert-评分记录.md
- liran_docs/requirements/REQ-260920-channel-usage-cache-alert-task-breakdown.md
- liran_docs/requirements/REQ-260920-channel-usage-cache-alert-documentation-audit.md
- liran_docs/03-索引.md、04-开发追踪.md、08-测试用例.md、09-真机实测.md、10-UI壳接入清单.md
- documentation 1/2 已更新的 modules 文档和正式 PRD 第 13 节全部实现入口。
- package.json、CHANGELOG.md、发布脚本、现有测试和构建规则。先检查工作区已有用户改动，不覆盖或混入无关修改。

允许修改：

- task-breakdown 列出的 `electron/`、`src/`、`tests/` 责任文件，以及完成 TDD、实现、E2E、打包和发布所必需的现有项目文件。
- 本任务的 `liran_docs`、确认根因后的 `docs/pitfalls`、版本文件、CHANGELOG、发布元数据和真实验收证据。
- 只改解决 REQ-01～05、AC-01～16 所需的最小范围；发现工作区已有改动先保护并区分来源。

禁止修改：

- 禁止站点/域名/分组特判，禁止新增数据库表、第二套轮询、独立 UI 壳、Stitch 或无关重构。
- 禁止覆盖用户或其他活动任务的改动，禁止修改旧任务 `REQ-260920-api-key-hvoyai-floating-polish` 的需求、PRD、评分和状态。
- 禁止泄漏凭据，禁止伪造 RED、测试、真机、Windows 真机或发布结果，禁止在用户回复“归档”前创建归档。

## 执行范围与顺序

严格按 task-breakdown 拓扑执行：`V2-01～04`、`AVG-01～04`、`USG-01～03`、`ALR-01～05`、`SET-01～03`、`UI-01`、`QA-01～03`、`REL-01`。每个非平凡逻辑先写能证明当前问题的失败测试，确认 RED，再做最小实现到 GREEN；共享根因只修一次，不在多个调用方贴补丁。

### 1. V2 渠道状态

- 先用用户的同一真实 V2 站点、同一凭据、同一分组和同一 90m 范围做脱敏对照。官方请求已知包含 `range=90m&group_by=platform_group&timezone=Asia/Shanghai`；桌面端要记录实际 timezone、group_by、data_through、coverage、分组 ID/名称、success_rate、cache_rate 和 TTFT。不得记录完整凭据、完整 URL 查询秘密或完整响应正文。
- 在证据确认前，时区只算候选原因。必须定位可复现根因，再修共享 adapter/归一化/快照链路；禁止按该站点、域名或分组硬编码。
- V2 比例同时接受 `0..1` 和 `1..100`，统一为 `0..100` 后展示和判断；`0.984` 与 `98.4` 都显示 `98.4%`。缺失、非有限和越界值不得进入健康阈值。
- `partial`、`bootstrap`、`no-sample`、`stale`、`error`、`unsupported` 必须有独立语义。鉴权与临时失败不能伪装为 V1 成功；明确不支持才按现有策略回退。V1 必须有回归测试。
- 渠道摘要、分组卡片、18 格矩阵、颜色、数据截止和更新时间必须来自同一个 `siteId + group + range + revision` 快照。快速切站、分组、范围或刷新时丢弃迟到响应，不能混合两代数据。

### 2. 使用记录首次加载和请求隔离

- 首次进入使用记录和切换站点立即查询，不要求用户先切 API Key。连续模型、分组、Key、时间等筛选变化继续使用 300ms 防抖。
- 所有查询入口复用同一构造规则。“全部 API Key”必须删除 `api_key_id`，不能沿用上一个具体 Key。切站、离页、新查询或新代次使旧请求失效。
- 列表和统计独立容错：列表成功、统计失败时保留列表并让统计卡片进入降级状态；列表失败才进入页面错误态；空结果清掉上一范围数据并显示真实空态。

### 3. 最近 30 个有效样本

- 删除顶部“平均耗时”，改为“平均首字”。Sub2API 使用 `firstTokenMs`，OpenCodex 使用 `firstOutputMs`。
- 修正共享算法：先按时间倒序，再按指标分别筛选，分别取得最多 30 个有效样本。不能先 slice 30 再过滤，也不能用当前页 20 条。
- 首字 `0ms` 是有效样本；非有限或缺失无效。缓存率 `0%` 是有效样本；零分母或缓存相关字段全缺失无效。两个指标的 N 可以不同。
- Sub2API 缓存率固定为 `cache_read / (input + cache_read + cache_creation) × 100%`，不得重复累计 cache_creation。
- 少于 30 个显示真实“近 N 次”；无有效样本显示 `—` 和“暂无有效样本”。总请求数、总 Token、总消费仍按完整筛选范围，不缩到最近 30 次。

### 4. Sub2API 缓存率系统通知

- 只监控 Sub2API；OpenCodex 只展示最近统计。按站点+分组独立计算，满 30 个 fresh 有效缓存率样本才判断。
- 阈值为严格低于 80%；`79.99%` 触发，`80.00%` 不触发。新事件使用可控 timer 在 `0、2 秒`发送两条相同原生系统通知。
- 标题固定为“Sub2API 缓存率提醒”；正文固定为“你现在使用的「<中转站>」中「<分组>」缓存率持续下降，请注意。”
- 事件身份优先 `siteId + groupId`；没有稳定 groupId 时使用站点内规范化分组名。持续异常只提醒这一组两条；应用重启后同一未恢复事件不重复。
- 只有 fresh 且满 30 个有效样本的平均值恢复到 `>=80%` 才重新 armed。网络失败、鉴权失败、样本不足、stale 数据既不告警也不恢复。
- 复用 `notification_states` 和现有通知服务，不新增数据库表或第二套轮询。缓存率检查子流程站点串行、单站点分组并发上限 2；单组失败不影响其他组。
- 不新增独立设置或 UI；恢复、删除站点/分组和应用退出时取消剩余 timer。
- 系统通知权限关闭、平台不支持或发送失败时安全降级，不崩溃、不阻塞刷新、不无限重试。通知、日志、测试证据不得泄漏 API Key、账号、完整 URL、请求正文或 Token 明细。

### 5. 页面接线

- 不创建独立 UI 壳、Stitch 或新视觉体系。沿用现有渠道状态、使用记录五卡和通知设置区的布局、图标、颜色层级、间距、响应式和键盘规则。
- 使用记录卡片显示“平均首字”和“平均缓存率”的近 N 次；不新增缓存率提醒设置控件。
- 渠道页的 loading、empty、partial、bootstrap、no-sample、stale、error、unsupported 要可辨，禁止所有非完整状态都使用异常红色。
- 系统通知使用 Electron/操作系统原生通知，不在应用内仿造用户截图。检查宽窗口、窄窗口、键盘焦点、长站点/分组名、无遮挡和无横向溢出。

验证要求：

1. 定向测试必须覆盖：`0/18/29/30/50` 样本、`79.99/80.00`、`0..1/1..100`、非法比例、V1、coverage/bootstrap、迟到响应、全部 Key 参数、列表/统计独立失败、0ms/0%、零分母、0/2 timer、取消、重启去重、恢复重布防、多站多组与并发上限 2。
2. 依次运行项目真实的 format check、ESLint、TypeScript、定向 Vitest、全量 Vitest、官方 registry audit、生产 build、Electron E2E 和敏感信息扫描。build 与 E2E 按项目规则串行。失败必须定位、修复并重跑，不降低断言或伪造通过。
3. Codex 在 macOS 真机执行：真实 V2 同口径对照；首次进入和切站；最近 30 次卡片；系统通知 0/2 秒；持续异常去重、恢复、重启和取消；通知权限关闭降级；渠道/使用记录宽窄页面样式。证据放入新的 `real-test-evidence/macos-3.5.0/...`，截图和日志脱敏。
4. Windows 没有真实设备时，只做 x64 NSIS 交叉构建、PE/asar、版本、blockmap、manifest、可解压与资产检查，不得声称 Windows 真机通知通过。
5. 真实 V2 根因确认后，把症状、根因、最小修复和验证写回对应 pitfalls 及 README 索引；信息不足就如实标记，不写推测结论。

状态回写：

- 功能、Bug 和行为调整全部通过后，将版本递增到 `3.5.0`，同步 package/锁文件、CHANGELOG 和必要长期文档。不得在验证前只改版本号。
- 从同一提交生成 macOS ARM64 DMG 与 Windows x64 NSIS，以及必要 blockmap 和 update-manifest；验证文件名、内部版本、架构、完整性和 SHA-256。`release/` 按项目规则只作临时目录。
- 完整审查最终 diff，使用 Conventional Commit 创建原子版本提交。确认远端映射后分别推送 GitHub 和 Gitee 当前发布分支，再执行 `npm run release:publish -- --notes "..."`。验证 tag、stable Release、说明和全部资产 uploaded；任一步失败停止声称发布。
- 回写 03、04、08、09、10、相关 modules、PRD 关联状态、评分记录的修改后评分和真实证据。所有问题必须先写回、修复、复测再关闭。
- 不修改或归档旧任务 `REQ-260920-api-key-hvoyai-floating-polish`，不覆盖工作区无关改动。

完成条件：

- REQ-01～REQ-05 和 AC-01～AC-16 均有代码、测试、真机或平台边界证据；V2 根因已用真实对照确认，没有站点特判；V1 和 OpenCodex 无回归。
- 自动化、生产构建、macOS 真机、页面样式、Windows 交叉构建、敏感扫描、完整 diff、版本和发布协议全部真实通过。
- 3.5.0 版本提交、GitHub 推送、Gitee 推送和 GitHub Release 均可核对；报告提交哈希、两个远端结果、Release 地址和资产验证。
- 完成修改后五维评分和普通目标回收证据，项目状态进入“待用户检查”，资料状态进入“待归档确认”。本目标禁止创建归档包、更新归档索引、清理活动区或声称“已完成并归档”。

当前目标完成开发、测试、验收、问题回写和必要修复后，必须完成普通目标回收，并留下“当前目标完成并已回收”和 `goal_status=reclaimed` 的真实证据。随后写明“项目状态：待用户检查”“资料归档状态：待归档确认”，进入待用户检查和待归档确认。

用户检查期间不再执行当前目标，当前目标暂不执行正式归档，不清理活动文档。用户发现问题时创建新的复修目标；用户提出新增需求或优化时，回到需求整理或需求变更流程。只有用户明确回复“归档”后才调用正式归档模板。归档失败不得重新打开普通目标，原目标保持 reclaimed。

下一阶段解锁条件：没有新的普通开发目标。请通知用户检查软件；用户确认无问题并明确回复“归档”后，才允许创建独立正式归档目标。

## 执行结果

- 当前目标完成并已回收。
- `goal_status=reclaimed`。
- 版本：3.5.0；提交：`b137f0f5faccf6efba8328a798c79a4e8aed0af8`。
- GitHub/Gitee 当前分支和 tag `3.5.0` 均指向版本提交；稳定 Release 五项资产为 uploaded。
- 项目状态：待用户检查。
- 资料归档状态：待归档确认。
- 未创建归档包、未更新归档索引、未清理活动文档。
