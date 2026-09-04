# OpenCodex 使用记录、服务器切换与全局交互优化 PRD

文档状态：正式 PRD
需求状态：已确认
PRD 版本：1.0
任务 ID：REQ-260904-usage-navigation-motion
创建日期：2026-09-04
最近更新：2026-09-04
流程档位：深度流程（非 UI 壳，2 个目标）

## 首次用户原话

用户要求本轮优化以下内容：

1. 全部站点页面的“渠道推荐”直接删除，因为不再使用。
2. 使用记录的 OpenCodex 模式数据不准确，需要读取 `http://localhost:10100/api/logs?limit=2000` 实际日志并修正。示例日志中：`inputTokens=269115`、`outputTokens=223`、`cachedInputTokens=266112`、`cacheCreationInputTokens=0`、`totalTokens=269338`、`durationMs=11374`、`firstOutputMs=8137`、`displayMetrics.tokPerSecond=19.6061`。真实输入应为输入总量减缓存命中，即 `269115 - 266112 = 3003`。需要检查输入、输出、缓存读取、缓存写入、总数、性能、耗时、首字和其他字段，不正确的全部修正。
3. OpenCodex 模式新增“缓存率”列，位置与中转站模式一致，在 Token 右侧，计算方式、展示方式和颜色与中转站模式一致。
4. OpenCodex 日志加载量不固定为 2000，用户倾向于加载 4000 条。
5. OpenCodex 时间范围中的“今天”必须表示本地日期当天 `00:00:00` 到当前时间，不是最近 24 小时；近 7 天、近 30 天和自定义范围也应采用清晰、可验证的本地日期边界。
6. Radar 和常用网站需要像截图红框所示，与 Sub2API 服务器一样提供顶部横向快速切换入口；当前 Sub2API 服务器快速切换不丝滑，需要修复为即时响应、切换过程不出现错误叠加或登录态串联；Radar 和常用网站也要丝滑。
7. 全部站点、API 密钥、使用记录、渠道状态、站点管理、Sub2API 服务器、Radar、常用网站、通知、设置都需要有交互效果和交互动画，整体体验要有高级感。

截图事实：附件中的红框只作为“顶部横向服务器快速切换栏”的视觉参考；截图里远程 Sub2API 后台的其他菜单不是本轮新增范围。

## 项目事实

- 当前版本为 2.6.0，技术栈为 Electron 43、React 19、TypeScript 5.9、Vite 8、Vitest 4、Playwright Electron。
- 主导航已有：全部站点、API 密钥、使用记录、渠道状态、站点管理、Sub2API 服务器、雷达、常用网站；底部还有通知和设置。
- OpenCodex 页面当前位于 `src/renderer/shells/usage/OpenCodexUsagePage.tsx`，数据归一化、筛选和统计位于 `src/renderer/shells/usage/opencodex-data.ts`。
- OpenCodex 当前请求固定 `limit: 2000`，界面文案显示“最近 2000 条”。
- 当前归一化逻辑把 `usage.inputTokens` 直接当作真实输入，把 `cachedInputTokens` 当缓存读取，把缓存写入固定为“—”，没有使用 `cacheCreationInputTokens`。
- 当前 OpenCodex“今天”逻辑为 `Date.now() - 86_400_000`，属于滚动 24 小时窗口。
- 中转站模式已有独立“缓存率”列和共享缓存率函数，可作为复用基线，不应重复实现另一套算法。
- Sub2API 服务器、Radar、常用网站均由主进程管理嵌入式 `WebContentsView`，Renderer 通过 preload IPC 接线。
- 现有页面使用 React 状态切换，已有加载、错误、空态、弹层、焦点和键盘交互；本轮应在现有结构上做最小增量，不引入新的动画框架或状态管理库，除非调查证明 CSS/React 现有能力无法满足。
- 当前项目安全边界要求：OpenCodex 管理员令牌只在主进程使用；嵌入网页必须保持 sandbox、contextIsolation、nodeIntegration=false、webSecurity 和同源导航策略；不得把 Cookie、Token 或完整页面内容传给 Renderer。

## 初步目标

### G1 全部站点删除渠道推荐

- 删除全部站点页面中面向用户的渠道推荐展示、文案、入口和无效空白占位。
- 不删除渠道状态页面、手动渠道关联、渠道刷新、渠道健康状态、倍率比较内部所需的候选和评分逻辑，除非调查证明其只服务已删除展示。
- 删除后不影响当前 Key、余额、用量、渠道状态更新时间和悬浮窗关联渠道摘要。

### G2 OpenCodex 数据口径修正

- 以 OpenCodex 日志真实字段为事实来源。
- 真实输入 Token 口径：`max(inputTokens - cacheReadInputTokens, 0)`；优先使用 `cacheReadInputTokens`，兼容 `cachedInputTokens`，避免重复扣减。
- 缓存读取 Token 使用 `cacheReadInputTokens`，兼容 `cachedInputTokens`。
- 缓存写入 Token 使用 `cacheCreationInputTokens`，缺失时显示占位符而不是伪造 0。
- 输出 Token 使用 `outputTokens`。
- 总 Token 的展示与统计必须明确口径，不能把缓存读取重复加到真实输入中；需与现有 OpenCodex 服务字段和中转站模式的用户可理解口径保持一致。
- 首字显示 `firstOutputMs`，耗时显示 `durationMs`，t/s 优先使用日志提供的 `displayMetrics.tokPerSecond.value`；若字段缺失再按既有规则安全降级，不产生 NaN/Infinity。
- 保留 reasoning、请求类型、状态、消费等已正确字段，并通过真实日志样本逐项核对。

### G3 OpenCodex 缓存率列

- 在 Token 列右侧新增“缓存率”列。
- 复用中转站模式的缓存率计算函数和颜色分段：缓存读取 /（真实输入 + 缓存读取 + 缓存写入）× 100。
- 分母为 0 时显示占位符；0 值必须保留为 0，不得被当成缺失。
- 列设置、表头、单元格、统计或导出（若 OpenCodex 当前不支持导出，则明确不扩展）保持一致。

### G4 OpenCodex 日志数量与日期边界

- 默认请求最近 4000 条日志；界面文案同步为“最近 4000 条”或等价的真实状态文案。
- 如果服务端实际返回数量少于 4000，按服务端 `total` 和实际 `logs.length` 正确显示，不伪造数量。
- “今天”：使用本地时区当天 00:00:00 至当前时间。
- “近 7 天”和“近 30 天”：采用明确的本地自然日边界，需在 PRD 正式版中锁定是“含今天共 7/30 个自然日”还是滚动窗口。
- 自定义范围：开始日期包含当天 00:00:00，结束日期包含当天至 23:59:59.999；空值和反向范围必须有明确错误或空态行为。
- 日期边界必须使用可注入时钟或等价确定性测试覆盖跨日、跨月和本地时区。

### G5 顶部跨模块快速切换

- Sub2API 服务器页面保留并优化顶部横向服务器切换栏。
- Radar 页面增加与截图红框同类的顶部 Radar 条目切换栏。
- 常用网站页面增加与截图红框同类的顶部网站切换栏。
- 快速切换项使用稳定 ID；当前项有明确选中态；长名称单行省略但可通过 tooltip/ARIA 获取完整名称。
- 点击后立即反馈选中态和加载态；不能等待远程页面完全加载后才改变 UI。
- 切换期间旧视图与新视图不能叠加；加载失败时尽量保留原页面并提供可重试状态。
- 不串联不同服务器/网站的登录态、partition、Cookie 或页面缓存。
- 服务器、Radar、常用网站三类切换栏保持各自安全导航边界和持久化模型。

### G6 全站交互效果与动画

- 覆盖全部站点、API 密钥、使用记录、渠道状态、站点管理、Sub2API 服务器、Radar、常用网站、通知、设置。
- 动效目标包括：页面切换、导航选中态、按钮 hover/press/focus、加载状态、列表/卡片进入、弹层打开关闭、筛选变化、刷新反馈、成功/失败通知和嵌入视图切换。
- 优先使用 CSS transition/keyframes 与 React 状态，动画应服务状态反馈而不是装饰堆叠。
- 支持 `prefers-reduced-motion` 和现有减少透明效果/高对比度降级。
- 不改变现有业务数据、权限、安全边界、窗口尺寸、核心布局和页面信息架构。
- 需要先确定统一动效规范：时长、缓动、位移/透明度范围、可打断规则、加载动画和错误反馈样式。

## 非目标

- 不重写 OpenCodex 服务端，不修改 `/api/logs` 服务协议。
- 不新增云端同步、遥测、账号体系或远程数据写入。
- 不引入新的动画依赖库，除非现有 CSS/React 能力经验证不足。
- 不复制截图中的 Sub2API 后台菜单，不新增用户未提出的远程后台功能。
- 不把“高级感”解释为全面重做视觉设计；本轮优先建立一致、可验证、可访问的动效系统。
- 不在未确认日期口径前直接实现“近 7 天/近 30 天”的新语义。

## 影响范围

### 预计 Renderer 文件

- `src/renderer/shells/overview/OverviewPage.tsx`
- `src/renderer/shells/overview/overview.css`
- `src/renderer/shells/usage/opencodex-data.ts`
- `src/renderer/shells/usage/opencodex-data.test.ts`
- `src/renderer/shells/usage/OpenCodexUsagePage.tsx`
- `src/renderer/shells/usage/UsagePage.tsx`
- `src/renderer/shells/usage/usage.css`
- `src/renderer/App.tsx`
- `src/renderer/styles.css`
- `src/renderer/shells/sub2api-servers/*`
- `src/renderer/shells/radar/*`
- `src/renderer/shells/favorite-websites/*`
- 各受影响页面的现有测试文件

### 预计共享/主进程文件

- 仅在调查确认需要时修改 `electron/shared/opencodex.ts`、`electron/main/services/opencodex-service.ts` 或 preload 类型。
- 预计不需要修改数据库 schema。
- 预计不需要修改嵌入网页安全策略；如必须修改，需单独记录安全审查和回归范围。

## 验收标准草案

- 全部站点页面不再出现渠道推荐文案、组件、入口或多余占位；渠道状态和手动关联功能仍可用。
- 对用户提供的样例，显示真实输入 3,003、输出 223、缓存读取 266,112、缓存写入 0、总 Token 口径无重复计算、耗时 11.37s、首字 8.14s、t/s 19.61。
- OpenCodex 表格在 Token 右侧显示缓存率，颜色和中转站模式一致；缓存率按真实输入/缓存读取/缓存写入计算。
- OpenCodex 默认加载最多 4,000 条；状态文案与服务端返回数量一致。
- “今天”在本地日期 00:00 到当前时间筛选；边界测试通过。
- Sub2API 服务器、Radar、常用网站均有顶部快速切换栏，点击后立即显示选中反馈，切换无视图叠加、无登录态串联，失败可恢复。
- 九个主页面及通知、设置均具备一致的 hover/press/focus/loading/transition/modal 反馈；减少动态效果时不影响可用性。
- 全量 Vitest、typecheck、lint、format、build、Electron E2E 和适用的 macOS 页面样式/真机检查通过；Windows 仍只报告交叉构建证据。

## 已决策项

1. “近 7 天/近 30 天”采用含今天的本地自然日：9 月 4 日近 7 天从 8 月 29 日 00:00 开始，近 30 天从 8 月 6 日 00:00 开始。
2. “全部站点渠道推荐”只删除用户可见的推荐卡片、文案和入口；倍率查看、充值比例、渠道状态、手动关联和内部倍率能力保留。
3. “高级感”采用克制动效：160–240ms 页面/卡片过渡、120–180ms 控件反馈、短距离位移、透明度/颜色/阴影过渡，不做大面积持续循环动画。
4. 快速切换栏只切换当前模块条目，三类模块统一顶部视觉形式，不做跨模块条目混切。
5. OpenCodex 总 Token 优先使用服务端 `totalTokens`；明细按真实输入、输出、缓存读取和缓存写入展示，禁止重复计算。
6. 本轮不新增 OpenCodex CSV 导出能力，只增加缓存率表格列和列设置。

## 当前决策记录

- 已确认：使用本机 OpenCodex `/api/logs` 真实字段作为修复依据。
- 已确认：OpenCodex 默认加载量目标为 4,000 条。
- 已确认：今天按本地自然日 00:00 到当前时间。
- 已确认：Radar、常用网站需要拥有与 Sub2API 服务器同类的顶部快速切换入口。
- 已确认：本轮涉及多个独立模块和 UI 动效，不能按单文件小修处理。
- 已确认：近 7 天/近 30 天采用含今天的本地自然日口径；例如 9 月 4 日近 7 天从 8 月 29 日 00:00:00 开始，近 30 天从 8 月 6 日 00:00:00 开始。
- 已确认：渠道推荐只删除总览面向用户的推荐功能/推荐卡片；保留倍率查看、充值比例、渠道状态、手动关联和内部倍率数据能力。
- 已确认：采用克制但有高级感的统一动效；页面切换/卡片进入约 160–240ms，按钮/导航约 120–180ms，支持减少动态效果。
- 已确认（按当前需求默认）：Radar、常用网站、Sub2API 服务器各自只切换本模块条目，统一顶部快速切换栏样式，不做跨模块条目混切。
- 已确认（按样例数据锁定）：OpenCodex 总 Token 优先使用服务端 `totalTokens`；组件展示使用真实输入 + 输出 + 缓存读取 + 缓存写入，不能重复计算缓存；服务端总数缺失时才使用组件求和回退。
- 已确认：数据口径设计已通过用户确认。
- 已确认：快速切换设计采用模块内条目切换、立即选中反馈、单视图挂载、失败恢复、请求序列保护和统一顶部胶囊栏；保留现有 partition、同源白名单与登录态隔离。
- 已确认：日期自然日口径、渠道推荐删除深度、动效强度、模块内快速切换范围和 OpenCodex 总 Token 口径均按本 PRD 执行。
- 已确认：本轮只优化现有页面/组件，不新造 UI 壳；采用深度非 UI 流程，先文档目标 1/2，再开发与验收目标 2/2。

## 关联执行文档

- 项目事实：[liran_docs/00-项目说明书.md](../00-项目说明书.md)
- 需求长期事实：[liran_docs/01-需求文档.md](../01-需求文档.md)
- 架构事实：[liran_docs/02-架构文档.md](../02-架构文档.md)
- 开发追踪：[liran_docs/04-开发追踪.md](../04-开发追踪.md)
- 测试用例：[liran_docs/08-测试用例.md](../08-测试用例.md)
- 真机实测：[liran_docs/09-真机实测.md](../09-真机实测.md)
- UI 壳清单：[liran_docs/10-UI壳接入清单.md](../10-UI壳接入清单.md)
