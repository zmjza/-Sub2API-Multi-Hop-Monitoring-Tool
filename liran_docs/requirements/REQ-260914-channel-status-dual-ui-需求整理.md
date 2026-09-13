# REQ-260914 渠道状态 V1/V2 双界面 · 需求整理

## 任务信息

- 任务 ID：REQ-260914-channel-status-dual-ui
- 任务类型：老项目新增/改造功能（渠道状态高保真双界面 + 探测顺序调整 + 连通性测试模型加载修复）
- 创建日期：2026-09-14
- 更新日期：2026-09-14
- 当前状态：两个需求已合并，正式 PRD v1.1 待确认
- 需求状态：待确认合并后的正式 PRD
- 正式 PRD：REQ-260914-channel-status-dual-ui-PRD.md
- PRD 版本：1.1
- 合并来源：REQ-260915-connectivity-test-models（原独立 Bug 修复，现并入本任务）
- 用户原话文件：liran_docs/用户原话.md
- 关联旧任务：REQ-260913-connectivity-test（已归档）。旧口径是“先 V2 再 V1、V2 归一化进现有 V1 壳、不改渠道 UI”。本任务明确推翻这两条，另立新任务，不回改 2.9.0 已发布的连通性测试和统计卡片。

## 用户想解决的问题

现在渠道状态页还是旧版探测卡片壳。V2 站被硬塞进 V1 字段后，状态、模型、Ping 全是“待查询”。用户要按站点真实协议分两套界面：有旧版就做成飞轮海 /monitor 那样；没有旧版再走新版，做成 mdkj /monitor/cards 那样。两套指标不能混在一张卡上。两种都没有，就明确说暂时无法获取渠道状态。

## 目前讨论内容

1. 用户先要求参考 sub2api 官方渠道监测，并给了 V2 matrix 样例。当时确认“先 V2，没有再兼容旧版”，而且“不改动现在渠道状态 UI，新版只替换参数”。
2. 2.9.0 按该口径发布后，V2 站在现有 V1 壳里出现“状态待查询 / 模型待查询 / 端点 PING 待查询”。根因是 90m matrix 经常 request_count=0，官方 V2 也没有 ping 和主模型。
3. 用户改口：V2 就做成 https://mdkj.lol/monitor/cards ，V1 就做成 https://feilunhai.vip/monitor 。两种不要混在一张卡上。
4. Codex 用 Chrome 打开两页，并核对 mdkj 线上 JS（ChannelStatusCardsView / ChannelStatusV3View / channelMonitorV2 / groups）和飞轮海 DOM + 官方 V1 源码。
5. 用户要求把卡片、布局、分类、请求全部整理成完整方案，不要漏细节。
6. 用户确认探测顺序改为：先测 V1；V1 没有再测 V2；都没有就显示“暂时无法获取渠道状态”。

## 已确认的内容

### A. 产品原则

- 每个站点只渲染一套渠道状态 UI，由该站探测结果决定。
- V1 站：飞轮海 /monitor 的探测卡片。
- V2 站：mdkj /monitor/cards 的用量矩阵卡片。
- 禁止一张卡同时出现“对话延迟 + 端点 PING”和“缓存率 + 可用率 + 首 Token”。
- 禁止再把 V2 matrix 归一化成 V1 的 latency/ping/7 天探测可用率来凑现有壳。
- 本任务是新 UI 范围，不是 2.9.0“不改渠道 UI”合同的延续。

### B. 探测顺序（本轮用户最终口径，覆盖 2.9.0 的先 V2）

每个站点、每次需要拉取渠道状态时：

1. 先请求 V1：GET /api/v1/channel-monitors。
2. V1 判定为“有”才停在 V1，渲染 V1 UI。
3. V1 判定为“没有”才请求 V2。
4. V2 判定为“有”则渲染 V2 UI。
5. V1、V2 都没有：界面固定文案「暂时无法获取渠道状态」。余额、用量、测试连通性不受影响。

V1“有”的默认判定：

- HTTP 200
- 响应符合 V1 列表契约
- items 是数组且至少 1 条有效监控（有 id 和 name）

V1“没有”：

- 404、405
- 明确未启用 / 模式不是 v1 / 渠道监控关闭
- 空数组、null、非数组、缺 items
- 响应结构不合法

V2“有”：

- HTTP 200
- 响应符合 V2 matrix 契约（有 data.items 数组；过滤后可以为空，但结构必须合法）
- snapshot 失败但 matrix 成功时，卡片仍按 matrix 渲染，汇总区和更新时间降级占位，不能因此改去渲染 V1 壳

V2“没有”：

- 404、405
- 明确未启用 / 模式不是 v2
- 响应结构不合法

错误不得互相伪装：

- 401、403：显示鉴权/权限/登录问题，不把 V1 失败伪装成 V2 成功，也不把 V2 失败伪装成 V1 成功，也不用“暂时无法获取渠道状态”掩盖权限问题。
- 429、5xx、超时、网络中断：临时失败。有旧缓存就保留并标过期，下个周期仍按“先 V1 再 V2”重试。没有旧缓存时显示临时失败，不是“该站未开放”。
- 会话内可记住该站最近一次成功协议（v1 或 v2）作为刷新优化，但不能跳过契约校验；应用重启后仍先 V1。

### C. 出现位置

主界面是侧栏「渠道状态」页，必须按官方页完整复刻对应协议。

同一站点的数据源必须一致，用于：

- 渠道状态页
- 全部站点卡片的「查看渠道状态」
- 站点卡片上的渠道摘要/时间线
- 悬浮窗渠道摘要

全部站点卡片和悬浮窗没有官方那种大卡片网格，不能把 V2 三指标和 V1 两指标塞进现有小摘要里混显示。简化摘要规则：

- V1 摘要：状态 + 对话延迟或 7 天可用率 + 探测时间条
- V2 摘要：状态 + 可用率或首 Token + 桶时间条
- 点「查看渠道状态」进入完整对应界面

### D. V1 界面（飞轮海 /monitor）

参考实页：https://feilunhai.vip/monitor
参考源码：ChannelStatusV1View.vue、MonitorHero、MonitorCardGrid、MonitorCard、MonitorMetricPair、MonitorAvailabilityRow、MonitorTimeline

页面结构：

1. 顶栏：时间窗 7 天 / 15 天 / 30 天，默认 7 天。
2. 整页状态胶囊：全部卡都是 operational 为正常；任一 failed/error 或非 operational 为 DEGRADED。
3. 刷新按钮 + 自动刷新倒计时。
4. 卡片按平台分段；分段容器采用统一平台分类，分段内卡片仍完整使用飞轮海 V1 样式。
5. 网格：1 列 / md 2 列 / xl 3 列 / 2xl 4 列，间距 gap-5。

卡片（整张可点，最小高度 280px，圆角 16px）：

- 头：平台图标、监控名、平台徽标、用户倍率、状态胶囊（正常/降级/错误）
- 中：两格「对话延迟 | 端点 PING」，单位 ms
- 大字：可用性 · 当前时间窗百分比
- 底：近 60 次探测条，PAST 到 NOW

状态词：

- operational 正常，绿
- degraded 降级，黄
- failed / error 错误，红
- 空/未知 灰，不显示成“正常”

时间条：

- 固定 60 根，不足左侧灰垫
- 高绿 100% 正常，中黄 65% 降级，短红 35% 失败，灰 15% 未测
- hover：相对时间 · 状态 · 延迟ms

时间窗：

- 7 天用列表自带 availability_7d，不打详情
- 15/30 天对每张卡请求 GET /api/v1/channel-monitors/{id}/status，取 availability_15d / availability_30d
- 点卡打开详情也走 status 接口

V1 请求：

- GET /api/v1/channel-monitors（首屏必须）
- GET /api/v1/groups/available
- GET /api/v1/groups/rates
- 用户倍率：rates[groupId] ?? group.rate_multiplier，显示「用户倍率 0.10x」
- 现有站点资料里已有分组倍率则可复用，不必重复打
- GET /api/v1/channel-monitors/{id}/status 仅 15/30 天或详情

V1 列表字段：id, name, provider, group_name, primary_model, primary_status, primary_latency_ms, primary_ping_latency_ms, availability_7d, extra_models[], timeline[], latest_quota?

timeline 点：status, latency_ms, ping_latency_ms, checked_at

飞轮海实页把主模型/分组名换成了用户倍率。本任务按实页：卡片头显示平台 + 用户倍率，不把“模型待查询”写回去。

### E. V2 界面（mdkj /monitor/cards）

参考实页：https://mdkj.lol/monitor/cards
参考线上产物：ChannelStatusCardsView、ChannelStatusV3View、channelMonitorV2、groups API
注意：GitHub 公开仓库的用户端 /monitor 在 V2 模式下是总览（KPI + 矩阵图 + 表格），不是卡片页。要复刻的是 mdkj 的 /monitor/cards，组件名 ChannelStatusV3View。

页面结构：

1. 标题「渠道状态」+ 状态点 +「更新至 coverage.data_through」+ 刷新。
2. 时间窗 90m / 24h / 7d / 30d，默认 90m。
3. 规则文案：可用率与首 Token 取较差状态；可用率 ≥70% 绿 / ≥30% 黄 / <30% 红。
4. 汇总：可用率 xx% · 缓存率 xx%（原始）。优先用 snapshot.trend 最后一个有 metrics 的桶，否则 snapshot.metrics。
5. 按平台分段，不是平铺。

平台分段：

- 归一：chatgpt/open_ai 到 openai，claude 到 anthropic，xai 到 grok，google/google_gemini 到 gemini
- 顺序：openai、anthropic、grok、gemini、antigravity、kimi、zhipu、deepseek、其他
- 段头：平台图标 + 平台名 + 数量
- 段内排序：用户倍率升序，再 group_id，再 group_name
- 只展示 group_id 存在且大于 0 的行，丢掉裸平台占位

网格同 V1：md 2 / xl 3 / 2xl 4，间距 gap-5。

卡片（article，最小高度 286px，圆角 24px，testid channel-monitor-v3-card）：

- 头：平台图标、group_name、平台徽标、用户倍率、状态胶囊
- 中：三格 缓存率 | 可用率 | 首 Token
- 底：近 N 次色条 PAST 到 NOW，可 hover

没有模型名，没有 Ping。

状态胶囊由前端重算，不用 API 的 health.overall：

- 可用率：有 success_rate 用 success_rate，否则 1 - error_rate
- 无流量：has_requests 为 false，或 request/success/error 都没有正数，则 unknown，可用率显示 -，不能显示健康/正常
- 可用率小于 30% 为 critical，小于 70% 为 warning，否则 healthy
- 首 Token：优先 ttft.trimmed_avg_ms；若 display_source 是 recent_100_trimmed_mean 且没有 trimmed_avg_ms，显示 -
- 否则退 p50_ms。大于等于 30s 为 critical，小于 10s 为 healthy，否则 warning。无值 unknown
- 卡片主状态 = 可用率和首 Token 里更差的（critical 大于 warning 大于 healthy 大于 unknown）
- 中文：healthy 健康，warning 需关注，critical 异常，unknown 未知/无流量
- 缓存率只展示，不进主状态。有 0 到 1 的 cache_rate_trimmed 就显示剔除低 5% 后的值，tooltip 写原始缓存率；没有则显示原始，格子标题带「· 原始」

时间条长度：90m=18，24h=24，7d=14，30d=30。90m 对应 5 分钟桶。hover：时间 · 可用率 · 缓存率 · 首 Token。颜色按该桶可用率阈值，高度按可用率。

自动刷新：snapshot.coverage.bootstrap.active 时 10 秒，否则取 refresh_interval_seconds 和 10 秒的较大值。页面隐藏时暂停。切时间窗重拉 snapshot + matrix。

V2 请求（卡片页最小集，并行）：

- GET /api/v1/channel-monitor-v2/snapshot?range={90m|24h|7d|30d}
- GET /api/v1/channel-monitor-v2/matrix?range=...&group_by=platform_group
- GET /api/v1/groups/available
- GET /api/v1/groups/rates

时区：现有适配器已带 timezone=Asia/Shanghai，继续带。

不需要：dimensions、models、errors、users、admin config。那些是官方总览页的。

snapshot 用途：更新时间 data_through、coverage_complete、bootstrap、refresh_interval_seconds、整页汇总。
matrix 用途：卡片行和 buckets。
groups 用途：用户倍率，算法与 V1 相同。

覆盖与新鲜度：

- coverage.data_through 是数据上界，超过它的桶不当最新
- coverage_complete=false 显示部分覆盖，仍渲染已有桶
- bootstrap.active 显示回填进度，不改成 V1 壳

### F. 数据与安全

- 主进程按站点判定协议，Renderer 收到 monitorSource 为 v1、v2 或 none，以及对应展示模型，不再把 V2 塞进 V1 Channel 字段。
- 完整 API Key 仍只在主进程。
- 继续站点级单飞、并发上限、revision、防旧响应、stale-while-revalidate。
- 分组匹配继续走现有手动关联/严格匹配，不准用数组第一项冒充。

### G. 空态文案

- 两协议都没有：暂时无法获取渠道状态
- 有协议但当前过滤后 0 张卡：该时间窗暂无渠道数据（V2）/ 暂无监控项（V1）
- 401/403：权限不足或登录失效，请重新验证
- 临时失败且无缓存：渠道状态暂时失败，将自动重试
- 临时失败且有缓存：保留卡片，标明可能已过期

旧文案「该站未开放渠道监控」让位给用户本轮指定的“暂时无法获取渠道状态”。

### H. 验收责任（沿用当前项目确认）

Codex 负责 macOS 真机与页面样式验收，Windows 仅交叉构建。

## 已统一的实现口径

1. 全部站点小卡片与悬浮窗使用协议对应的简化摘要。
2. V2 页面实现 90m、24h、7d、30d。
3. V1 页面实现 7 天、15 天、30 天。
4. V2 时间条使用原生 title/aria 悬浮提示，不引入新的提示层依赖。
5. V1 详情复用当前软件现有详情区域，不新增飞轮海独立弹窗。

未确认项若不再补充，默认按本方案“做齐官方页能力”执行：V2 四个时间窗、V1 三个时间窗、V2 用 title/aria hover、V1 用现有页顶详情而不是再做飞轮海弹窗、总览/悬浮窗用简化摘要。

## 不采用的方向

- 不再把 V2 归一化进 V1 壳。
- 不再先探 V2 再回退 V1。
- 不在一张卡上混用探测指标和用量指标。
- 不复刻官方 V2 总览页（KPI 五格、折线、模型/错误/用户排行表）。只要卡片页。
- 不请求 V2 dimensions/models/errors/users/admin config。
- 不把图片/音频/视频连通性测试拉进本任务。
- 不改 2.9.0 已完成的测试连通性和使用记录统计卡片，除非被渠道页改动误伤。

## 闭环实现约束

### 协议与请求

- 所有接口使用站点保存的 `baseUrl + apiPrefix`，不得把 `/api/v1` 写死。
- V1 请求：`/channel-monitors`、`/groups/available`、`/groups/rates`；15/30 天或详情请求 `/channel-monitors/{id}/status`。
- V2 请求：`/channel-monitor-v2/snapshot` 和 `/channel-monitor-v2/matrix`，携带 `range`、`group_by=platform_group`、`timezone=Asia/Shanghai`。
- 先 V1 后 V2 是每次完整探测的业务顺序；能力缓存只能优化刷新，不能跳过契约校验。

### 统一载荷与渲染

- 主进程返回 `monitorSource: v1 | v2 | none` 及对应载荷；Renderer 不解析上游原始响应。
- `v1` 必须渲染飞轮海卡片，`v2` 必须渲染 mdkj 卡片，禁止用空字段把 V2 塞进 V1 卡片。
- `auth`、`temporary`、`stale` 不等于 `none`；临时失败必须显示失败或过期状态。
- 渠道状态页、全部站点卡片和悬浮窗必须消费同一份站点载荷，禁止各自重新判定协议。

### 分组与排序

- V1 和 V2 共用平台规范化与固定顺序：openai、anthropic、grok、gemini、antigravity、kimi、zhipu、deepseek、其他。
- V1 增加平台分段，但卡片字段仍只有延迟、Ping、可用率和 V1 时间条。
- 分段内按用户倍率升序、分组 ID、分组名称、渠道 ID 排序；缺失平台归入“其他”。
- 无法唯一匹配手动关联或分组时归入“其他/待核验”，不能取数组第一项。

### 刷新与竞态

- 保持站点级单飞、并发上限、revision、防旧响应、取消和 stale-while-revalidate。
- V1/V2 切换必须原子替换协议和载荷，禁止出现 V1 标题配 V2 指标。
- 手动刷新、自动刷新、切换窗口、切换站点和页面重新进入都必须让旧请求失去回写资格。
- 页面隐藏时暂停自动刷新，恢复可见时重新按当前顺序校验一次。
- V2 `coverage.data_through` 之后的未来桶不得参与最新值和状态计算；部分覆盖可渲染但需保留覆盖标记。

### 错误与空态

- V1 404/405、未启用、空数组或契约非法：继续请求 V2。
- V2 404/405、未启用或契约非法：显示“暂时无法获取渠道状态”。
- 401/403：显示“权限不足或登录失效，请重新验证”。
- 429、5xx、超时、网络中断：有缓存显示过期缓存并自动重试；无缓存显示“渠道状态暂时失败，将自动重试”。
- 合法协议但当前没有卡片：V1 显示“暂无监控项”，V2 显示“该时间窗暂无渠道数据”。

### 验收与交付

- 自动化测试必须覆盖 V1/V2 解析、先 V1 后 V2、平台分段、排序、状态映射、未来桶过滤、缓存竞态和错误矩阵。
- 真机验收必须覆盖 V1 真站、V2 真站、双协议不可用站点，并检查渠道状态页、全部站点卡片、详情和悬浮窗的一致性。
- UI 复刻不走 Stitch 或外部 AI；开发阶段直接参考两个真实网址实现两套卡片并完成样式回归。
- Windows 只做交叉构建证据，不能写成 Windows 真机通过。

## 当前形成的流程

需要渠道状态时，先 GET /channel-monitors。200 且至少 1 条有效监控则渲染飞轮海式 V1 卡片；没有或契约非法则改打 V2 snapshot + matrix。V2 契约合法则渲染 mdkj 卡片页；仍没有则显示“暂时无法获取渠道状态”。401/403 显示鉴权问题。429/5xx/超时保留缓存或显示临时失败。V1 的 7 天用列表，15/30 天打 status。V2 切时间窗重拉 snapshot 和 matrix。两组都用 groups 取用户倍率。

## 当前验收想法

- V1 真站（如飞轮海）：渠道页应出现延迟、PING、7 天可用性、近 60 次条，状态为正常/降级/错误，不能出现缓存率/首 Token。
- V2 真站（如 mdkj）：渠道页应按平台分段，出现缓存率、可用率、首 Token、近 18 次条，状态为健康/需关注/异常，不能出现端点 PING 和模型待查询。
- 两协议都没有的站：空态写“暂时无法获取渠道状态”，不能再写待查询。
- 同一应用里 V1 站和 V2 站可以并存，互不串壳。
- 401/403 与“暂时无法获取”要能区分。
- 窄窗网格 1 列，宽窗 3/4 列，卡片不溢出。
- 完整 Key 不进 Renderer、日志、截图。

## 项目调查补充

来源：Chrome 实页 + mdkj 线上 JS + 官方源码快照 + 当前仓库适配器。均为 AI 查证，不是用户原话。

- 当前探测在 electron/main/adapters/sub2api-adapter.ts 的 readOptionalChannelsWithFallback：先打 V2 matrix，missing 才 V1。本任务要反过来。
- 当前 UI 在 src/renderer/shells/channels/ChannelsPage.tsx：V1 壳，字段 latencyMs / pingMs / availability7d / primaryModel，时间线 20 格。V2 站因此显示待查询。
- 总览/悬浮窗同样消费这套 Channel 字段。
- V2 归一化在 electron/main/adapters/channel-monitor-v2.ts，本任务应停止把 V2 填进 V1 探测字段，改为给 Renderer 独立 V2 模型。
- classifyV2Failure 已有 missing / auth / temporary，V1 也应对齐这三类，不能只用 isUnsupported。

## 本轮结论

完整方案已经按两套官方页展开：布局、分类、卡片字段、状态算法、请求清单、错误处理和空态文案都写进本文。探测顺序按用户本轮要求改为先 V1 后 V2，双无则“暂时无法获取渠道状态”。未确认的 5 项给了默认：做齐官方时间窗，总览/悬浮窗用简化摘要，V1 详情继续用现有页顶而不是再做弹窗。

## 用户追加确认：两套界面模板与全站卡片区分

- V1 渠道状态页面固定以飞轮海 https://feilunhai.vip/monitor 的卡片样式作为模板。
- V2 渠道状态页面固定以 mdkj https://mdkj.lol/monitor/cards 的卡片样式作为模板。
- 全部站点中的每个站点卡片，凡是展示渠道摘要、渠道指标或渠道时间条，也必须根据该站点最终探测到的协议分别渲染 V1 或 V2 样式。
- V1 站点卡片不得出现 V2 的缓存率、首 Token、矩阵桶指标；V2 站点卡片不得出现 V1 的端点 Ping、对话延迟、旧版探测条。
- 同一页面可以同时存在 V1 站点和 V2 站点，但每个站点只能使用与自身协议匹配的一套渠道样式。
- 该确认解决原“是否将 V2 统一塞入现有 V1 摘要”的歧义，后续 PRD、任务拆分、实现和验收均以此为准。

## Chrome 实页复核：V1 与 V2 页面结构事实

本轮使用 Chrome 读取以下真实页面的可见 DOM 与卡片结构：

- V1：`https://feilunhai.vip/monitor`
- V2：`https://mdkj.lol/monitor/cards`

### V1 实页结构

- 页面主区包含“渠道状态”标题、7 天 / 15 天 / 30 天时间窗口、刷新按钮和自动刷新倒计时。
- 主状态在卡片网格之前显示，实际页面会根据卡片状态汇总为 `DEGRADED` 等整页状态。
- 卡片容器是单层网格，实测 class 为 `grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`，即窄窗 1 列、md 2 列、xl 3 列、2xl 4 列。
- V1 卡片实测最小高度 280px、圆角 16px、内边距 20px；卡片整体可点击并带悬浮上移与阴影。
- 卡片头部依次放平台图标、监控/分组名称、平台名称、用户倍率和状态胶囊。
- 卡片中部固定为两列指标：“对话延迟”和“端点 PING”，单位为 ms。
- 卡片下部显示“可用性 · 当前时间窗”、百分比和近 60 次记录时间条，时间条末端标记 PAST / NOW。
- V1 当前实页没有平台分段标题；本项目实现时保留飞轮海卡片字段和视觉层级，但增加与 V2 相同的平台分段容器。

### V2 实页结构

- 页面主区包含“渠道状态”标题、“更新至”时间、刷新按钮、90m / 24h / 7d / 30d 窗口按钮和规则说明。
- 汇总区显示可用率与缓存率。
- 页面按平台分段，Chrome 实测出现 `OpenAI`、`Anthropic`、`Grok`、`Gemini` 等二级标题，并在标题旁显示该平台卡片数量。
- 每个平台段内部使用 `grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`，与 V1 相同的响应式断点和间距。
- V2 卡片实测最小高度 286px、圆角 24px、内边距 20px，使用 `glass-card`，卡片悬浮时提高层级。
- 卡片头部依次放平台图标、分组名称、平台徽标、用户倍率和状态胶囊。
- 卡片中部固定为三列指标：“缓存率”“可用率”“首 Token”。
- 卡片下部显示近 18 次记录，按 5 分钟桶生成按钮式时间条，支持时间、可用率、缓存率和首 Token 的悬浮提示，末端标记 PAST / NOW。
- V2 页面不显示端点 Ping 和 V1 的“对话延迟”指标。

### V1 按平台分段的实现规则

- V1 站点也采用平台分段容器，分段方式与 V2 统一：先规范化平台标识，再按固定平台顺序输出平台段，段标题显示平台图标、平台名称和卡片数量。
- V1 段内继续使用飞轮海 V1 卡片样式和字段，不因分段而加入缓存率、首 Token 或矩阵桶。
- V1 分段排序使用用户倍率升序、分组 ID、分组名称；无法唯一确定平台的卡片归入“其他”。
- V1 页面因此同时满足“飞轮海卡片模板”和“与 V2 一致的平台分类”，但不改变 V1 指标语义。

### 全部站点卡片的协议分样式规则

- 站点级 `monitorSource` 决定卡片子组件：`v1` 使用飞轮海式摘要，`v2` 使用 mdkj 式摘要，`none` 使用“暂时无法获取渠道状态”。
- 全部站点页面允许 V1 和 V2 卡片并存；每张站点卡片只渲染一种协议的指标和时间条。
- V1 摘要保留状态、对话延迟或可用性、V1 探测时间条；V2 摘要保留状态、可用率或首 Token、V2 桶时间条。
- 摘要卡片继续服从现有站点卡片固定底部操作区和窄窗不溢出约束；协议差异只存在于渠道内容区域。

### UI 实施边界确认

- 本任务不走 Stitch 或外部 AI 单独设计流程，不创建独立 UI 壳目标。
- V1 和 V2 必须分别实现两套不同的渠道状态卡片，不得继续共用当前无法兼容两种协议的单一卡片结构。
- V1 卡片以 `https://feilunhai.vip/monitor` 的页面结构、字段层级、指标排列、状态胶囊、可用性展示和 60 次探测时间条为复刻依据。
- V2 卡片以 `https://mdkj.lol/monitor/cards` 的页面结构、平台分段、字段层级、三指标排列、状态胶囊和矩阵时间桶为复刻依据。
- 复刻结果接入当前软件的渠道状态页、全部站点卡片和悬浮窗；同一站点只渲染与自身协议匹配的卡片组件。
- 当前软件的应用外壳、导航、弹层容器、基础字体加载、主题切换和窗口响应式能力继续复用；协议相关的卡片布局、指标、状态色、时间条和分组结构按对应网址分别实现。
- 不把 V1 或 V2 的指标强行转换成另一套卡片字段，不以“当前 UI 视觉统一”为理由合并两套卡片。
- 后续流程仍不拆独立 UI 目标，但开发任务必须包含两套卡片的实现、页面接线和真实页面样式复核。

## 用户追加需求：测试连通性按所选 Key 加载模型

本次将原 REQ-260915-connectivity-test-models 合并到本任务，作为同一开发、测试和发布闭环的一部分。

### 问题与已确认根因

- 在全部站点卡片打开“测试连通性”后，选择 API Key，模型下拉不会显示该 Key 实际拥有的模型，导致无法开始普通文本测试。
- ConnectivityTestModal.tsx 当前调用站点登录态的 /usage/dashboard/models，不是所选 Key 的模型权限列表。
- 模型加载 effect 只依赖 siteId，切换 keyId 后不会重新请求。
- 当前 preload、bridge 和主进程没有按 siteId + keyId 获取模型列表的安全 IPC。
- 模型为空时界面直接禁用“开始测试”；现有 /v1/chat/completions 测试入口本身不是问题。

### 功能规则

1. 测试连通性弹窗打开时，按当前默认 active Key 加载模型；切换 Key 后立即取消或忽略旧请求并重新加载。
2. Renderer 只提交 siteId、keyId；主进程重新校验站点存在、Key 存在且 active，再读取完整 Key secret。
3. 主进程使用该 Key 请求 GET {site.baseUrl}/v1/models，不得拼接管理端 /api/v1 前缀。
4. 兼容 { data: [{ id }] }、{ data: { models: [...] } }、{ models: [...] } 以及数组对象中的 id、model、name 字段；过滤空值、去重并限制数量。
5. 成功后自动选中第一个可用模型，用户可手动切换；无模型时显示“没有可用模型”并禁止开始测试。
6. 失败时显示可理解错误和重试入口；401、403、404、429、5xx、超时、非法 JSON 和空列表不得伪造模型。
7. 开始测试必须沿用所选 keyId 和 model，不得静默回退其他 Key；保持普通文本流式输出、取消、超时、重试和真实用量提示。
8. 完整 Key 不进入 Renderer、IPC 返回、日志、截图、测试夹具或持久化；测试结果只保留在当前弹窗会话。

### 关联文件与验收

- 主要文件：src/renderer/shells/overview/ConnectivityTestModal.tsx、electron/preload/index.ts、electron/preload/bridge.cts、electron/main/index.ts。
- 验收覆盖：默认 Key 自动加载模型、切换 Key 更新模型、非数字 Key ID、同一 Key+模型发起测试、错误/空态/重试、请求竞态和敏感信息脱敏。
- 本范围仍只实现普通文本请求；图片、音频、视频、生图、语音、搜索和实时模式不实现。

## 下一轮继续讨论

用户确认“需求整理好了”后，再生成正式 PRD。未补充则按本文默认执行。

> 本文档是需求整理工作文档，不是正式 PRD，不强制正式章节、REQ/AC、版本号、矩阵、Goal 或执行流水。
