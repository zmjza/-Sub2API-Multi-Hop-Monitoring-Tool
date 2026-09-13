# 渠道状态 V1/V2 双界面与连通性测试模型加载 · PRD

## 0. 文档控制

任务 ID：REQ-260914-channel-status-dual-ui
任务名称：渠道状态 V1/V2 双界面与连通性测试模型加载
任务类型：老项目新增/改造功能
创建日期：2026-09-14
更新日期：2026-09-14
文档状态：正式 PRD
需求状态：已确认
PRD 版本：1.1

## 1. 产品/功能概述

为不同版本 Sub2API 渠道监测站点提供协议匹配的渠道状态页面、全部站点摘要和悬浮窗展示，并修复测试连通性按所选 Key 加载模型的问题。V1 使用飞轮海式卡片，V2 使用 mdkj 式矩阵卡片。

## 2. 背景与问题

现有单一卡片模型把 V2 字段塞入 V1 壳，导致模型、Ping 和状态长期显示待查询。V1/V2 的请求字段、指标和时间线语义不同，必须分别探测和渲染。

## 3. 用户与使用场景

用户在渠道状态页查看站点健康，在全部站点卡片或悬浮窗查看摘要，并在混合使用 V1/V2 站点时获得一致且不串指标的结果。

## 4. 产品目标

- 每站点先探测 V1，明确不可用才探测 V2。
- V1、V2 使用独立卡片模型和视觉结构。
- 统一向渠道页、全部站点和悬浮窗提供安全载荷。
- 临时失败保留缓存并重试，不能伪装成协议不支持。

## 5. 非目标与明确不做

- 不把两种协议归一到单一卡片。
- 不创建 Stitch、外部 AI 或独立 UI 壳。
- 不复刻官方 V2 KPI、模型、错误和用户排行总览。
- 不实现图片、音频、视频等连通性测试模式。

## 6. 当前项目事实

现有适配器、渠道缓存、站点级单飞、revision、防旧响应、stale-while-revalidate、退避和悬浮窗摘要已存在；本任务只扩展渠道监测协议与对应展示。

## 7. 用户流程

用户打开渠道状态页或站点摘要 → 请求 V1 → V1 合法且有监控则渲染 V1 → 否则请求 V2 → V2 matrix 合法则渲染 V2 → 两者明确不可用显示“暂时无法获取渠道状态”。临时失败显示错误并保留旧缓存，鉴权失败显示权限/登录问题。

## 8. 功能需求

### REQ-01 [v1.0] 探测、契约校验与回退

触发条件：打开、刷新或切换渠道状态。
前置条件：站点已保存并使用 `baseUrl + apiPrefix`。
用户操作：进入页面或刷新。
系统行为：先 GET `/api/v1/channel-monitors`；仅在 404/405、明确未启用或模式不匹配、空/null/非法结构时请求 V2。V1 HTTP 200 且 `items` 为数组并至少含一条有效 `id` 与 `name` 才停止探测。V2 并行请求 snapshot 与 matrix，携带 range、group_by=platform_group、timezone=Asia/Shanghai；matrix 合法即可渲染，snapshot 失败只降级汇总和更新时间。
数据变化：主进程写入协议能力、错误类别、请求时间和安全载荷，Renderer 只接收 `monitorSource: v1|v2|none`。
状态变化：loading、success、temporary-error、auth-error、unsupported、stale。
正常结果：V1 合法渲染 V1，V1 明确不可用且 V2 matrix 合法渲染 V2，两者明确不可用显示“暂时无法获取渠道状态”。
异常处理：401/403 显示“权限不足或登录失效，请重新验证”；429、5xx、超时、网络中断为临时失败，有缓存保留并标过期，无缓存显示“渠道状态暂时失败，将自动重试”，下周期仍按 V1→V2 重探测。
禁止行为：不得把临时失败伪装成协议不存在，不得把 V2 当 V1，不得写死单一路径。
对应 AC：AC-003。

### REQ-02 [v1.0] V1 飞轮海式页面

触发条件：探测结果为 V1。
前置条件：V1 列表契约合法。
用户操作：查看卡片、切换 7/15/30 天或点击卡片详情。
系统行为：首屏请求 `/channel-monitors`、`/groups/available`、`/groups/rates`；7 天使用 `availability_7d`，15/30 天和详情请求 `/channel-monitors/{id}/status`。
数据变化：读取 V1 列表字段、timeline 状态/延迟/PING/时间和倍率 `rates[groupId] ?? group.rate_multiplier`。
状态变化：operational 正常、degraded 降级、failed/error 错误，空/未知灰色。
正常结果：飞轮海式平台分段、1/2/3/4 列、gap-5、约 280px 高、16px 圆角；头部平台/名称/徽标/倍率/状态，中部对话延迟与端点 PING，下部可用性和近 60 次条。
异常处理：无卡显示“暂无监控项”；时间条固定 60 根，不足左补灰，颜色绿100%/黄65%/红35%/灰15%，hover 显示时间、状态、延迟。
禁止行为：不得显示 V2 缓存率、首 Token、矩阵桶或模型待查询。
对应 AC：AC-001。

### REQ-03 [v1.0] V2 mdkj 式页面

触发条件：V1 明确不可用且 V2 matrix 合法。
前置条件：`data.items` 数组结构合法，过滤后为空仍属协议合法。
用户操作：查看卡片、切换 90m/24h/7d/30d 或刷新。
系统行为：并行请求 snapshot、matrix、groups/available、groups/rates，携带时区；不请求 dimensions、models、errors、users、admin config。
数据变化：读取 platform、group_id、group_name、metrics、health、buckets、coverage；仅展示 group_id>0；snapshot 提供 data_through、coverage、bootstrap、refresh_interval_seconds、汇总，matrix 提供卡片和 buckets。
状态变化：无流量 unknown；可用率<30% critical、<70% warning、否则 healthy；首 Token>=30s critical、<10s healthy、否则 warning；两者取较差。
正常结果：mdkj 式平台分段、1/2/3/4列、gap-5、约286px高、24px圆角；头部平台/分组/徽标/倍率/状态，中部缓存率/可用率/首Token，底部矩阵桶；90m=18、24h=24、7d=14、30d=30，90m为5分钟桶。
异常处理：snapshot 失败但 matrix 合法仍渲染卡片并降级汇总/更新时间；coverage_complete=false 显示部分覆盖，bootstrap.active=true 显示回填；过滤未来桶及超过 data_through 的桶。
禁止行为：不得显示 V1 Ping、对话延迟、旧探测条或模型名，不直接使用 API health.overall 覆盖前端重算。
对应 AC：AC-002。

### REQ-04 [v1.0] 共享展示

触发条件：渠道状态页、全部站点、详情或悬浮窗请求数据。
前置条件：安全载荷或最近成功缓存存在。
用户操作：查看任一入口。
系统行为：所有入口消费同一站点载荷并按 monitorSource 选择子组件。
数据变化：V1 摘要为状态+对话延迟/7天可用率+V1条；V2 摘要为状态+可用率/首Token+V2桶条；none 显示固定空态。
状态变化：success、refreshing、stale、error、auth。
正常结果：混合站点可并存且各自指标正确。
异常处理：单站失败隔离并保留过期摘要。
禁止行为：不得各入口独立判定协议或跨协议拼接指标，不改 footer、窗口尺寸和导航语义。
对应 AC：AC-004。

### REQ-05 [v1.0] 平台、状态算法与排序

触发条件：归一化任意监控行。
前置条件：字段通过边界校验。
用户操作：按平台浏览或刷新。
系统行为：按固定顺序归一 openai、anthropic、grok、gemini、antigravity、kimi、zhipu、deepseek、其他；chatgpt/open_ai→openai、claude→anthropic、xai→grok、google/google_gemini→gemini；段内按倍率、group_id、group_name、channel_id 排序。
数据变化：生成平台段、数量、排序键和状态；V2 可用率优先 success_rate，否则 1-error_rate；无流量为 has_requests=false 或 request/success/error 均无正数；TTFT 优先 trimmed_avg_ms，再按规则退 p50_ms；cache_rate_trimmed 在0–1显示剔除值并 tooltip 原始值。
状态变化：V1 operational/degraded/failed/error→正常/降级/错误；V2 healthy/warning/critical/unknown→健康/需关注/异常/未知。
正常结果：分段和颜色稳定。
异常处理：平台或分组不能唯一匹配则“其他/待核验”。
禁止行为：不得取数组第一项补齐、用静态值或把 V2 转为 V1 字段。
对应 AC：AC-001、AC-002。

## 9. 数据、状态与业务规则

### 9.1 统一载荷

主进程按站点判定协议并完成 schema 校验、字段归一化、错误分类和脱敏；Renderer 只接收 `monitorSource: v1|v2|none`、对应展示模型、状态、指标、时间线、覆盖时间和 `fetchedAt`，不解析上游原始响应。`auth`、`temporary`、`stale` 不等于 `none`。

### 9.2 V1 数据模型

列表模型至少保留 `id`、`name`、`provider`、`group_id/group_name`、`primary_model`、`primary_status`、`primary_latency_ms`、`primary_ping_latency_ms`、`availability_7d`、`extra_models[]`、`timeline[]`、`latest_quota`；时间线点保留 `status`、`latency_ms`、`ping_latency_ms`、`checked_at`。7 天使用列表字段，15/30 天和详情使用 status 响应。

### 9.3 V2 数据模型

matrix 的 `data.items[]` 为卡片来源；每项读取 `platform`、`group_id`、`group_name`、`metrics`、`health`、`buckets`。metrics 至少保留 `request_count`、`success_requests`、`error_requests`、`has_requests`、`success_rate`、`error_rate`、`cache_rate`、`cache_rate_trimmed`、`cache_rate_numerator`、`cache_rate_denominator`、`ttft`、`duration`；ttft 保留 `sample_count`、`p50_ms`、`p90_ms`、`p95_ms`、`avg_ms`、`trimmed_avg_ms`、`display_source`、`sample_as_of`。coverage 保留 `requested_start`、`requested_end`、`coverage_start`、`data_through`、`computed_at`、`aggregation_lag_seconds`、`coverage_complete`、`bucket_seconds` 和 bootstrap 的 active/progress/covered_from/target_start。

### 9.4 刷新、竞态与缓存

保持站点级单飞、并发上限、请求世代 revision、防旧响应回写、AbortController 取消和 stale-while-revalidate。手动刷新、自动刷新、切换窗口、切换站点、页面离开和重新进入都使旧请求失去回写资格；V1/V2 协议与载荷必须原子替换，禁止 V1 标题配 V2 指标。页面隐藏暂停自动刷新，恢复可见后按当前顺序重新校验。会话内可记忆最近成功协议优化刷新，但应用重启或能力失效时仍先 V1。

### 9.5 V2 新鲜度与自动刷新

`coverage.data_through` 是数据有效上界，之后的未来桶不参与最新值、汇总和状态。`coverage_complete=false` 仍渲染已有数据并标记部分覆盖；`bootstrap.active=true` 显示回填进度。bootstrap 活跃时刷新间隔 10 秒，否则取服务端 `refresh_interval_seconds` 与 10 秒的较大值。

## 10. 页面与 UI 需求

### 10.1 共同页面骨架

渠道状态页沿用应用侧栏、顶部工具栏、浅色主题、现有字体和窗口尺寸；两协议均使用 1 列 / md 2 列 / xl 3 列 / 2xl 4 列响应式网格，`gap-5`，卡片 hover 提升层级，保持键盘焦点和窄窗口可读。V1 增加平台分段标题，尽管飞轮海实页原本单层平铺；段标题显示平台图标、平台名称和数量。

### 10.2 V1 页面复刻

参考 `https://feilunhai.vip/monitor` 及其 ChannelStatusV1View、MonitorHero、MonitorCardGrid、MonitorCard、MonitorMetricPair、MonitorAvailabilityRow、MonitorTimeline 结构。顶栏提供 7 天/15 天/30 天，默认 7 天，显示整页状态胶囊、刷新按钮和自动刷新倒计时。整页任一卡片非 operational 时显示 DEGRADED。卡片整张可点，最小高度约 280px、圆角约 16px、内边距约 20px；头部为平台图标、监控名、平台徽标、用户倍率、状态胶囊；中部为“对话延迟 / 端点 PING”；下部为“可用性·当前时间窗”和近 60 次探测条。

### 10.3 V2 页面复刻

参考 `https://mdkj.lol/monitor/cards` 的 ChannelStatusCardsView/ChannelStatusV3View。顶部显示“渠道状态”、状态点、“更新至 coverage.data_through”、刷新按钮、90m/24h/7d/30d；规则文案说明可用率和首 Token 取较差状态；汇总优先取 snapshot.trend 最后一个有 metrics 的桶，否则 snapshot.metrics，显示可用率与原始缓存率。卡片为 article，testid `channel-monitor-v3-card`，最小高度约 286px、圆角约 24px、内边距约 20px；头部平台图标、分组名、平台徽标、用户倍率、状态胶囊；中部“缓存率 / 可用率 / 首 Token”；底部矩阵桶按钮条和 PAST/NOW。V2 不显示 Ping、对话延迟和模型名。

### 10.4 时间条与交互

V1 固定 60 根，不足左侧补灰；颜色代表正常/降级/失败/未测，hover 显示相对时间、状态和延迟。V2 时间条长度为 90m=18、24h=24、7d=14、30d=30，90m 对应 5 分钟桶，hover 使用原生 title/aria 显示时间、可用率、缓存率和首 Token，不引入新提示层依赖。

### 10.5 全部站点和悬浮窗

站点卡片的渠道摘要区域按 `monitorSource` 选择子组件，协议差异只存在于渠道内容区，底部 footer、按钮槽位、拖动、窗口尺寸和导航保持现有实现。V1 摘要为状态 + 对话延迟或 7 天可用率 + V1 探测条；V2 摘要为状态 + 可用率或首 Token + V2 桶条；none 为“暂时无法获取渠道状态”。点击“查看渠道状态”进入完整对应页面/详情。

## 11. 异常、边界与安全规则

401/403 显示“权限不足或登录失效，请重新验证”，不能回退或掩盖为 none；429、5xx、超时、网络中断保留旧缓存并标过期，下一周期继续 V1→V2，不能永久记为不支持。合法协议但过滤后无卡时，V1 显示“暂无监控项”，V2 显示“该时间窗暂无渠道数据”；双协议明确不可用才显示“暂时无法获取渠道状态”。

完整 API Key 只在主进程读取和使用；不得进入 Renderer 状态、IPC 返回、缓存、日志、截图、测试夹具或持久化。错误只传递安全类别、状态码类别、可重试性和用户文案，不传原始 response、headers、完整 URL 查询、Token、Cookie 或敏感上下文。分组/平台关联继续使用严格唯一匹配，歧义归入“其他/待核验”，禁止用数组第一项补齐。

## 12. 兼容性与限制

兼容旧版 V1 与新版 V2，可同页混合多个站点；V1 和 V2 各自使用对应模板，不能共用无法表达指标的单一卡片。V1 页面实现 7/15/30 天，V2 页面实现 90m/24h/7d/30d。V1/V2 均不可用时不影响余额、用量和连通性测试。不要请求 V2 dimensions、models、errors、users、admin config，不复刻官方 V2 KPI、折线、模型/错误/用户排行总览。Windows 仅交叉构建和结构验证，Codex 负责 macOS 真机与页面样式验收。

## 13. 影响范围

适配器与共享契约、渠道状态服务/缓存、渠道状态页、全部站点摘要、悬浮窗、测试连通性弹窗、Key 模型查询 IPC、使用记录统计、相关测试、pitfall、版本与发布文档。

### 13.1 测试连通性与所选 Key 模型加载

#### 测试连通性入口与弹窗

- 全部站点每张站点卡片保留现有操作区，并在“查看渠道状态”右侧提供“测试连通性”。
- 沿用当前项目弹层、按钮、输入框和深色流式输出区视觉，不创建独立 UI 壳。
- 弹窗显示站点名称/状态、API Key 选择、模型选择、提示词输入、流式结果、关闭和开始测试按钮；默认提示词为 hi。
- 只实现普通文本请求；图片、音频、视频、生图、语音、搜索和实时模式不实现。

#### 按 Key 获取模型

- 弹窗打开时使用当前默认 active Key 加载模型；切换 Key 后取消或忽略旧请求并立即按新 Key 重新加载。
- Renderer 只提交 siteId 和 keyId；主进程重新校验站点存在、Key 存在且为 active 后读取 secret。
- 主进程请求 GET {site.baseUrl}/v1/models，不得拼接管理端 /api/v1 前缀。
- 兼容 { data: [{ id }] }、{ data: { models: [...] } }、{ models: [...] }，以及对象中的 id、model、name 字段；过滤空值、去重并限制返回数量。
- 成功后自动选择第一个可用模型，用户可手动切换；没有模型显示“没有可用模型”并禁用开始测试。
- 401、403、404、429、5xx、超时、非法 JSON 和空列表必须显示明确错误或空态，并提供重试入口，不得伪造模型。

#### 测试执行与安全

- 开始测试必须使用用户选择的同一个 keyId 和 model，不得静默回退其他 Key。
- 保持现有普通文本 /v1/chat/completions 流式测试、取消、超时、重试、成功/失败状态和真实用量提示。
- 同一时间只允许一个活动测试；关闭弹窗、切换站点或卸载组件时取消请求并阻止迟到事件回写。
- 测试结果仅保留在当前弹窗会话，不写入站点卡片或持久化存储。
- 完整 Key 只在主进程读取和使用，不进入 Renderer 状态、IPC 返回、日志、截图、测试夹具或持久化。

#### 使用记录统计联动

- 中转站和 OpenCodex 均按当前筛选结果倒序取最近 100 条记录；数据层不得只取当前分页 20 条。
- 平均耗时只对有效 durationMs 求算术平均；平均缓存率直接对每条已有缓存率求算术平均，不重新汇总 Token。
- 少于 100 条按实际有效样本数计算；无有效样本显示占位符并提供样本数或等价提示。
- 新增“平均缓存率”卡片，缩窄总请求数、总消费、平均耗时卡片，使四张卡片在宽屏同排且窄窗不溢出。
- 筛选、站点切换、模式切换和刷新后重新计算。

#### 连通性验收标准

- 默认 Key 能从该 Key 的 /v1/models 响应得到模型并自动选中第一项。
- 切换 Key 后模型列表更新，旧 Key 模型不残留。
- 选中模型后开始测试可用，主进程收到同一 keyId 和模型。
- 非数字 Key ID 仍能正确读取；错误、空列表、竞态、取消和重试均有明确状态。
- 完整 API Key 不出现在 Renderer、IPC 返回、日志、截图和测试夹具。

## 14. 验收标准

### AC-001

对应需求：REQ-02、REQ-05。
验收步骤：打开真实 V1 站点并切换时间窗。
预期结果：飞轮海式卡片、指标、平台分段和 7/15/30 天行为正确。
失败条件：显示 V2 指标、时间窗错误或卡片溢出。

### AC-002

对应需求：REQ-03、REQ-05。
验收步骤：打开真实 V2 站点并切换时间窗。
预期结果：mdkj 式卡片、矩阵桶、覆盖信息和 90m/24h/7d/30d 正确。
失败条件：显示 V1 指标、未来桶参与状态或覆盖信息丢失。

### AC-003

对应需求：REQ-01。
验收步骤：使用 V1/V2 合法、明确不支持、鉴权和临时失败响应。
预期结果：先 V1 后 V2，错误、缓存和重试语义正确。
失败条件：临时失败被当成不支持或鉴权错误被吞掉。

### AC-004

对应需求：REQ-04。
验收步骤：同页加载 V1/V2 站点并查看全部站点、详情和悬浮窗。
预期结果：协议对应 UI，指标不串用。
失败条件：任一入口混用两套指标或站点间串数据。

### AC-005

对应需求：REQ-01～REQ-05。
验收步骤：运行自动化、macOS 真机和 Windows 交叉构建并检查发布。
预期结果：验证通过，版本递增 +0.1，双远端推送和 Release 资产完成。
失败条件：任一平台验证缺失、发布资产不完整或未完成双远端推送。

### AC-006

对应需求：REQ-01、REQ-03、REQ-04、REQ-05。
验收步骤：在全部站点打开测试连通性，验证默认 Key、切换 Key、模型加载、普通文本测试、错误/空态/取消/重试及使用记录四卡片统计。
预期结果：模型来自所选 Key 的 /v1/models 响应并自动选择第一项；切换 Key 后旧模型清除；测试使用同一 keyId 和 model；平均耗时与平均缓存率按最近 100 条有效记录计算；敏感信息不泄露。
失败条件：模型沿用旧 Key、调用站点登录态模型接口、无模型仍可提交、迟到请求回写、统计只取分页数据或出现完整 Key。

## 15. 需求追踪矩阵

| 需求           | 微观任务                  | 测试                           | 真机  |
| -------------- | ------------------------- | ------------------------------ | ----- |
| REQ-01         | CHS-2601                  | CHS-PROBE/ERROR                | 3/5   |
| REQ-02         | CHS-2602                  | CHS-UI-V1                      | 1     |
| REQ-03         | CHS-2603                  | CHS-UI-V2                      | 2     |
| REQ-04         | CHS-2604                  | CHS-MIXED                      | 4     |
| REQ-05         | CHS-2605/2606             | CHS-CACHE/REG/BUILD            | 5/6/7 |
| REQ-06～REQ-10 | CTM-2601～2604、STAT-2601 | CTM-MODEL/KEY/STREAM、STAT-100 | 8/9   |

## 16. 关联文档索引

| 文件类型 | 文件路径                                                                          | 文件作用           | 当前状态 | 关联需求 |
| -------- | --------------------------------------------------------------------------------- | ------------------ | -------- | -------- |
| 需求整理 | `liran_docs/requirements/REQ-260914-channel-status-dual-ui-需求整理.md`           | 需求事实           | 已确认   | 全部     |
| 任务拆分 | `liran_docs/requirements/REQ-260914-channel-status-dual-ui-task-breakdown.md`     | 微观任务           | 已创建   | 全部     |
| Goal     | `liran_docs/requirements/REQ-260914-channel-status-dual-ui-documentation-goal.md` | documentation 1/2  | 待执行   | 全部     |
| 开发追踪 | `liran_docs/04-开发追踪.md`                                                       | 执行追踪           | 待开发   | 全部     |
| 测试用例 | `liran_docs/08-测试用例.md`                                                       | 自动化测试         | 待执行   | 全部     |
| 真机实测 | `liran_docs/09-真机实测.md`                                                       | macOS/Windows 验收 | 待执行   | 全部     |
| UI 接线  | `liran_docs/10-UI壳接入清单.md`                                                   | 现有壳边界         | 待开发   | 全部     |

## 17. 待确认项

无

## 18. 决策记录

- 2026-09-14：用户确认 PRD 没问题。
- 2026-09-14：用户确认 V1 使用飞轮海样式、V2 使用 mdkj 样式，先 V1 后 V2，不创建独立 UI 目标。

## 19. 需求变更记录

- 由 REQ-260913 的“先 V2、共用旧壳”口径拆出新任务；旧任务不回改。

## 20. PRD 版本说明

- 1.0（2026-09-14）：正式 PRD，覆盖双协议探测、独立卡片和共享摘要。

## 21. 变更影响矩阵

| 范围        | 影响                                           | 处理          |
| ----------- | ---------------------------------------------- | ------------- |
| 适配器/契约 | 新增 V2 matrix/snapshot 归一化与 V1 探测优先级 | CHS-2601      |
| 渠道状态 UI | 两套卡片与平台分段                             | CHS-2602/2603 |
| 总览/悬浮窗 | 按协议摘要                                     | CHS-2604      |
| 缓存/调度   | 竞态、退避、临时失败                           | CHS-2605      |
| 发布        | 版本 +0.1、双远端和 Release                    | CHS-2606      |

## 22. 当前状态与下一步

当前：两个需求已合并，正式 PRD v1.1 已确认。下一步重新生成合并后的任务拆分和两次目标提示词；最终目标同时完成渠道状态、测试连通性、统计、测试、macOS 真机、Windows 交叉构建、发布和归档。
