你自行判断本任务是否需要多智能体协作；如需开启，只允许一个主智能体统筹，任一时刻最多同时运行五个子代理，子代理完成后必须及时回收，回收后可按需启用新的子代理，禁止子代理继续派生代理。

请直接开始执行下面步骤，先读取对应文档，再输出结果，不要先解释。

目标提示词类型：普通
文件指针型：是
任务 ID：REQ-260920-channel-usage-cache-alert
流程档位：深度流程
修改前评分：83/100
五维评分：项目现状 16、修改规模 17、依赖与修改后影响 17、风险与回滚 16、验证复杂度 17
评分证据：已核对 V2 adapter、Sub2API adapter、SiteService、使用记录初始化与查询协调链路、共享最近统计、后台刷新、通知服务、notification_states、设置契约和双平台发布规则；本任务跨 Renderer、主进程、持久化状态与系统通知，评分记录为 83/100。
当前阶段：documentation
目标阶段：documentation
当前目标：第 1 / 2 次
目标 N/M：第 1 / 2 次
UI 目标：跳过
UI 路线：not-applicable
等待外部输入：否
验收责任：Codex 真机测试
页面样式检查：检查页面样式是否符合方案
当前状态：提示词已解锁

本目标只做受影响文档、全部任务与微观任务拆分、开发追踪和测试/真机验收准备。用户已明确跳过独立 UI 目标，后续页面调整沿用当前视觉方案，由 development-and-acceptance 2/2 直接实现并检查页面样式。禁止修改实现源码、测试实现、版本号、CHANGELOG、构建配置和发布资产；禁止进行 UI 施工、真实 API 调试、真机验收或归档。产品需求、数据口径、状态机和 AC 以正式 PRD 当前正文为唯一事实源，不得摘要掉任何已确认细节。

无人值守：本目标只做文档，不启动浏览器、Chrome 或电脑控制，不要求用户代为操作，也不再次询问是否继续。发现文档冲突时以本任务正式 PRD 和用户已确认的 80% 阈值为准，并只修正本任务范围。

必须读取：

- AGENTS.md
- docs/pitfalls/README.md、docs/pitfalls/sub2api-adapter.md、docs/pitfalls/rate-comparison.md、docs/pitfalls/electron-build.md、docs/pitfalls/tooling.md
- liran_docs/requirements/REQ-260920-channel-usage-cache-alert-需求整理.md
- liran_docs/requirements/REQ-260920-channel-usage-cache-alert-PRD.md
- liran_docs/requirements/REQ-260920-channel-usage-cache-alert-评分记录.md
- liran_docs/用户原话.md
- liran_docs/03-索引.md、04-开发追踪.md、08-测试用例.md、09-真机实测.md、10-UI壳接入清单.md
- liran_docs/modules/06-API适配器与能力探测/_API适配器与能力探测.md
- liran_docs/modules/08-今日统计与使用记录/_今日统计与使用记录.md
- liran_docs/modules/08-今日统计与使用记录/使用记录自动筛选与汇总.md
- liran_docs/modules/09-渠道状态/_渠道状态.md
- liran_docs/modules/09-渠道状态/Key-渠道关联与状态语义.md
- liran_docs/modules/11-调度缓存与退避/渠道低频实时监控.md
- liran_docs/modules/12-通知/_通知.md
- liran_docs/modules/13-本地数据生命周期/_本地数据生命周期.md
- liran_docs/modules/14-IPC安全与日志/_IPC安全与日志.md
- liran_docs/modules/15-设置导出与删除/_设置导出与删除.md
- liran_docs/modules/17-测试构建与分发/API密钥与监控联动回归发布.md
- 正式 PRD 第 13 节列出的实现入口，只读核对调用关系，不改代码

允许修改：

- liran_docs/requirements/ 下本任务文件，包括新建 REQ-260920-channel-usage-cache-alert-task-breakdown.md、documentation 审计或必要的阶段证据文件
- liran_docs/03-索引.md、04-开发追踪.md、08-测试用例.md、09-真机实测.md、10-UI壳接入清单.md
- 上述本任务确实影响到的 modules 长期事实文档
- docs/pitfalls/ 中与本任务已确认工程事实相关的条目和 README 索引；未确认的 V2 根因必须标记“以下为基于现有证据的推测”或留待开发阶段验证

禁止修改：

- src、electron、tests 中的实现文件、package.json、package-lock.json、CHANGELOG.md、构建/发布脚本和 release 资产
- 真实前端 UI 壳、CSS、组件、Stitch、外部 AI 或 Product Design 产物
- 旧任务 REQ-260920-api-key-hvoyai-floating-polish 的需求整理、PRD、评分、目标和状态
- 其他活动任务的范围、评分、完成状态和归档材料

必须一次性把正式 PRD 的 REQ-01～REQ-05、AC-01～AC-16 拆成可执行微观任务，并建立稳定编号、依赖、输入、输出、允许文件、禁止文件、RED 证据、正常/失败路径、完成条件和回写位置。至少单独覆盖：

- V2 同一真实站点/凭据/范围的脱敏请求响应对照：timezone、group_by、data_through、coverage、分组 ID/名称、success_rate、cache_rate、TTFT；在证据确认前不得把时区写成最终根因
- V2 比例兼容 0..1 与 1..100、非法/缺失/越界值、partial/bootstrap/no-sample/stale/error/unsupported 状态，以及 V1 明确不回归
- 渠道摘要、卡片、18 格矩阵、颜色和更新时间使用同一快照；快速切站/分组/范围时丢弃迟到响应
- 使用记录首次进入和切站立即查询；筛选变化 300ms 防抖；全部 API Key 不携带 api_key_id；离页和新请求使旧请求失效；列表与统计独立容错
- 共享最近 30 次计算：按时间倒序、首字和缓存率分别筛选有效样本、真实 0ms/0% 有效、零分母/全缺失无效、样本不足显示真实 N、无样本显示占位
- Sub2API firstTokenMs、OpenCodex firstOutputMs；删除平均耗时；总请求数/Token/消费保持完整筛选范围；当前页 20 条不得代替最近 30 条
- Sub2API 站点+分组告警状态机：满 30 个有效样本、严格 <80%、80.00% 不触发、0/2 秒两条、持续异常去重、>=80% 恢复重布防、重启持久化
- 通知身份优先 siteId+groupId、缺少 groupId 时规范化分组名；复用 notification_states，不新增数据库表；OpenCodex 不触发告警
- 网络/鉴权失败、样本不足和陈旧数据不告警也不恢复；单组失败隔离；站点串行、站点内分组并发上限 2
- 不新增独立设置或 UI；恢复、删除站点/分组和应用退出时取消剩余定时通知
- 通知标题/正文、权限关闭/平台不支持安全降级、日志与通知不泄漏 API Key、账号、完整 URL、请求正文或 Token 明细
- 使用记录卡片与设置项现有页面的 loading/empty/error/partial/no-valid-sample、宽窄窗口、键盘可达和页面样式检查项；不建立独立 UI 目标，后续按当前视觉方案直接实现
- TDD、单元/集成/Electron E2E、真实 V2 站点、macOS 系统通知、Windows x64 构建和 3.5.0 发布的顺序、证据和失败回写

文档产物要求：

- task-breakdown 必须覆盖全部 REQ/AC，并给出底层共享统计与状态机先于服务接线、主进程先于 Renderer、内部测试先于真机和发布的拓扑顺序
- 04-开发追踪只追加本任务活动段，写清深度流程 1/2、独立 UI 目标跳过、UI 路线 not-applicable、验收责任、页面检查、任务依赖和当前状态
- 08-测试用例新增本任务待执行用例，至少覆盖 0/18/29/30/50 样本、79.99/80.00、0..1/1..100、迟到响应、统计独立失败、通知定时器取消和重启去重
- 09-真机实测新增待执行清单：真实 V2 站点对照、使用记录首次进入、最近 30 次卡片、macOS 0/2 秒通知、去重/恢复、页面样式、macOS ARM64 包；Windows 只记录 x64 NSIS/结构证据，除非有真实 Windows 设备
- 10-UI壳接入清单只登记本任务沿用当前视觉方案、跳过独立 UI 目标和后续开发接线范围；UI 路线写 not-applicable，禁止创建或修改真实前端文件
- modules 只补长期事实、接口边界、状态与依赖，不复制 PRD、微观任务或执行流水
- pitfalls 只写已经由源码或命令确认的工程事实；真实 V2 根因留到开发阶段验证后回写

验证要求：

- 用正式 PRD 逐项核对 REQ-01～REQ-05、AC-01～AC-16 与 task-breakdown、04、08、09、10 和 modules 的追踪关系，无遗漏、无重排、无假完成
- 运行 liran-plan 的文档/阶段/提示词校验器中适用于 documentation 1/2 的检查；记录真实命令和结果
- 运行 git diff --check，并确认本目标没有产生 src、electron、tests 实现、版本、CHANGELOG 或 release diff
- 检查旧 REQ-260920-api-key-hvoyai-floating-polish 三份核心文档没有本目标 diff
- 发现遗漏先补文档再结束；不得仅写“待后续补充”并解锁下一阶段

状态回写：

- 03-索引.md：本任务更新为 documentation 1/2 已完成、待 development-and-acceptance 2/2
- 04-开发追踪.md：记录文档产物、微观任务、依赖和状态=文档目标已完成/待 development-and-acceptance 2/2
- 08-测试用例.md、09-真机实测.md：只新增待执行项，不得提前写通过
- 10-UI壳接入清单.md：记录独立 UI 目标跳过、路线 not-applicable、沿用当前视觉方案、Codex 真机测试和检查页面样式
- 本 documentation-goal 文件追加可核对完成证据；提示词状态保持可交接，中间目标禁止归档

完成条件：

- 本任务全部已确认需求已拆成可执行微观任务，编号稳定，依赖、文件白名单、RED/Green、失败路径、完成条件和回写位置完整
- 03/04/08/09/10、受影响 modules、任务拆分和 PRD/AC 追踪一致，内容非占位
- 所有测试和真机项保持待执行，没有伪造通过、根因、截图、通知或发布结果
- 无业务源码、测试实现、版本或构建产物 diff，旧任务文档未被混入
- documentation 产物审计通过，下一阶段所需文件真实存在

下一阶段解锁条件：documentation 1/2 的真实产物和审计全部通过后，才允许生成并执行 development-and-acceptance 第 2/2 次目标。下一目标直接按当前视觉方案完成 TDD、实现、内部验证、页面样式检查、macOS 真机、问题回写、修复复测、修改后评分、3.5.0 双平台构建与发布交接。当前目标不得编码、真机测试、发布、回收最终目标或创建归档。

## 2026-09-20 实际完成证据

- 已创建 `REQ-260920-channel-usage-cache-alert-task-breakdown.md` 和 `REQ-260920-channel-usage-cache-alert-documentation-audit.md`，覆盖 REQ-01～05、AC-01～16、稳定任务编号、依赖、输入输出、允许/禁止文件、RED、正常/失败路径、完成条件和回写。
- 已更新 03、04、08、09、10 与受影响 modules；测试、真机、根因和发布均保持待执行。
- 需求整理、正式 PRD/评分、documentation 提示词、development-and-acceptance 提示词和本任务专属产物均通过 liran-plan 校验。
- `git diff --check`、精确追踪搜索、业务源码/测试/版本/CHANGELOG/release 空 diff、旧任务三份核心文档空 diff均通过。
- documentation 1/2 已完成；下一文件为 `REQ-260920-channel-usage-cache-alert-development-and-acceptance-goal.md`。
