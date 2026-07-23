# sub2api 适配器避坑

## 二开站核心响应可能存在多层 data 包装

**现象**

登录成功后，直接读取 `/user/profile`、`/keys` 或 `/usage/stats` 的顶层字段会得到空余额、零 Key 或默认统计，但 HTTP 请求本身返回 200。

**根因**

不同二开站在标准响应外又包了一层 `data`，列表响应还可能使用 `items` 或 `results`。上游字段名相同不代表响应层级完全一致。

**正确做法**

在适配边界统一执行有限层级的 payload 解包，再对标准化对象执行 Zod/字段校验；保留真实站点证据，不能在页面层通过猜测字段补值。

**验证方式**

使用两个真实站点重新登录，确认 profile.balance、Key 数量、usage stats 字段和可选渠道能力均来自脱敏标准化结果；同时运行 `npm test -- --run` 和 `npm run verify:real-service`。

**禁止事项**

不要把零余额或零 Key 当成真实业务结果；不要把完整响应、Token、Cookie、密码或完整 API Key 写入日志、测试快照或文档；不要为兼容未知结构扫描任意路径。

**相关文件或命令**

- `electron/main/adapters/sub2api-adapter.ts`
- `scripts/verify-real-sites.mjs`
- `scripts/verify-real-service.mjs`
- `npm run verify:real-service`

**适用范围**

所有 sub2api 二开站的 profile、Key、分组、倍率、统计和渠道监控适配。

## 使用记录原始响应不得直接越过 IPC

**现象**

真实 `/usage` 单条记录除展示字段外还包含嵌套完整 API Key、用户对象、IP 和 User-Agent；若原样返回 Renderer，会扩大敏感数据暴露面并污染 CSV。

**根因**

上游使用记录是后台审计模型，不是桌面端安全视图模型。仅做 TypeScript 类型断言不会删除运行时多余字段。

**正确做法**

在主进程适配器建立字段白名单，生成严格 Zod 校验的安全 Usage 模型；IPC 和 CSV 只消费该模型。

**验证方式**

运行适配器、IPC 合约和 CSV 测试，并扫描真实导出文件，确认不存在密码、Token、Cookie、完整 Key、IP 或 User-Agent 字段。

**禁止事项**

不要把上游原始对象透传给 Renderer；不要依赖前端隐藏列来实现脱敏。

**相关文件或命令**

- `electron/main/adapters/sub2api-adapter.ts`
- `electron/shared/contracts.ts`
- `electron/main/services/site-service.ts`
- `npm test -- --run`

**适用范围**

使用记录 IPC、表格、CSV 导出和任何真实二开站响应。

## Key 缓存为空不代表手动偏好已经失效

**现象**

从没有 Key 摘要缓存的旧版本升级后，应用首次读取站点 Key context 会把已保存的手动 Key 偏好重置为自动；同时，下拉框必须等完整 core 刷新和逐 Key 统计完成后才出现。

**根因**

启动阶段的空 Key 数组既可能表示上游确实没有 Key，也可能只是新缓存尚未建立。把“尚未加载”当成“确认不存在”会破坏跨版本偏好；把 Key 发布绑在完整刷新尾部则让慢统计阻塞基础选择数据。

**正确做法**

`/keys` 标准化完成后立即发布并持久化安全白名单摘要，后续 groups/rates/usage 再补齐。只有已经取得非空 Key 清单且确认目标 Key 不存在或停用时，才把手动偏好回退自动；首次无缓存时保留偏好等待刷新校验。

**验证方式**

运行 SiteService 升级回归测试、Key 提前发布测试和 Electron E2E；确认缓存不含完整 Key，旧偏好在首轮无缓存时保留，真实失效 Key 在刷新后回退。

**禁止事项**

不要用空数组同时表达“未加载”和“已加载为空”；不要持久化完整 Key；不要让逐 Key 今日统计阻塞 Key 下拉基础数据。

**相关文件或命令**

- `electron/main/services/site-service.ts`
- `electron/main/adapters/sub2api-adapter.ts`
- `electron/main/services/site-service.integration.test.ts`
- `npm run test`

**适用范围**

旧版本升级、每站点手动 Key 偏好、Key 摘要缓存和分阶段刷新。

## 使用记录日期和排序必须使用真实接口参数

**现象**

发送 `period=today` 或 `sort=asc|desc` 时，真实站点忽略参数，仍返回全历史并保持默认排序。

**根因**

两个真实站点的 `/usage` 使用日期边界参数以及 `sort_by=created_at`、`sort_order=asc|desc`，与统计端点的 `period=today` 不是同一协议。

**正确做法**

按用户本机时区计算 today、7d、30d 和 custom 的日历边界；排序显式发送 `sort_by=created_at` 与 `sort_order`。重置必须恢复今天、第一页、最新倒序。

**验证方式**

运行 `site-service.integration.test.ts`，再用真实站点对比今天与近 7 天总数、正序首条时间和分页范围。

**禁止事项**

不要复用统计端点的 period 参数；不要以 UI 箭头变化代替网络参数验证。

**相关文件或命令**

- `electron/main/services/site-service.ts`
- `electron/main/services/site-service.integration.test.ts`
- `src/renderer/shells/usage/UsagePage.tsx`

**适用范围**

两个已验证站点及兼容 sub2api `/usage` 的二开站。

## 渠道静态预览数据不得与真实响应合并

**现象**

正式运行时渠道名称来自真实接口，但延迟、Ping、可用率和时间线仍显示固定样例值，形成真假混合结果。

**根因**

Renderer 按数组下标把 Stitch 静态数据补到真实渠道记录，缺失字段被误当成允许伪造的视觉空位。

**正确做法**

适配器标准化渠道列表和详情，Renderer 正式态只读取白名单 IPC；缺失值明确显示“待查询”。静态数据只用于无 preload 的受控预览。

**验证方式**

运行渠道适配器、合约和页面测试，并在两个真实站点核对渠道数量、延迟、Ping、可用率和时间线均来自响应或显示缺失态。

**禁止事项**

不要按数组下标伪造降级状态；不要用静态样例填补真实响应缺字段。

**相关文件或命令**

- `electron/main/adapters/sub2api-adapter.ts`
- `electron/shared/contracts.ts`
- `src/renderer/shells/channels/ChannelsPage.tsx`
- `src/renderer/shells/channels/ChannelsPage.test.ts`

**适用范围**

渠道列表、详情、状态时间线和正式 Renderer 数据边界。

## CSV 导出覆盖已有文件后仍需显式收紧权限

**现象**

CSV 内容已脱敏且防公式注入，但真机导出文件权限为 `0644`，同机其他用户仍可能读取使用记录。

**根因**

`fs.writeFile` 默认受进程 umask 影响；仅在创建时传入 mode 也不能保证覆盖既有文件后权限被收紧。

**正确做法**

写入时指定 `mode: 0o600`，完成后再次调用 `chmod(0o600)`；CSV 字段继续只来自主进程白名单模型。

**验证方式**

Electron E2E 导出后断言 `stat.mode & 0o077 === 0`；最终打包应用真实导出后确认权限为 `0600`，并扫描表头、公式起始单元格和敏感字段。

**禁止事项**

不要把系统默认 umask 当作安全保证；不要因为 CSV 不含完整 Key 就忽略账号使用记录的本地访问权限。

**相关文件或命令**

- `electron/main/index.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `stat /tmp/sub2api-usage-test.csv`

**适用范围**

macOS、Windows 本地 CSV 导出及后续任何包含账号使用信息的文件输出。

## 长生命周期事件监听器不得捕获首次页面状态

**现象**

进入使用记录后立即刷新站点，分组下拉先出现，但延迟返回的模型选项被丢弃并长期只剩“全部”。

**根因**

`keys:changed` 监听器只在应用首次渲染时注册，闭包捕获了初始 shell。事件触发后递增站点请求世代，却按旧 shell 判断不加载使用记录筛选，导致进入页面时发出的模型请求成为旧世代且没有替代请求。

**正确做法**

长生命周期监听器通过 ref 读取当前 shell，并继续按 site ID 和请求世代校验结果。当前页面是使用记录时，Key 变化必须重新独立请求分组和模型；旧请求可以丢弃，但必须有新世代请求接替。

**验证方式**

Electron E2E 将模型接口延迟，确认分组先出现后立即点击顶栏刷新；刷新触发 `keys:changed` 后，模型选项仍在限定时间内补齐。

**禁止事项**

不要移除请求世代校验；不要在事件监听器中读取首次渲染闭包状态；不要用延长超时掩盖模型永不补回。

**相关文件或命令**

- `src/renderer/App.tsx`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run build`
- `npm run test:e2e`

**适用范围**

Key context 事件、使用记录分阶段筛选、站点刷新和任何跨页面长期订阅。

## 自动 Key 候选态不能被手动展示态覆盖

**现象**

用户从自动选择切到手动 Key 后，再切回自动选择，余额规则已经恢复为站点余额，但卡片倍率和默认 Key 仍短暂显示上一个手动 Key，直到下一次完整刷新。

**根因**

服务层只有一个运行态 Key 容器。手动选择会覆盖自动算法最近选出的候选，切回自动时没有可立即恢复的自动运行态；新增站点路径还独立实现了一套选择逻辑，未初始化自动候选。

**正确做法**

独立保存自动算法选出的 Key、脱敏标签和倍率。新增站点、普通刷新、Token 续期刷新和重新登录刷新统一通过同一个运行态更新函数；手动偏好只覆盖当前展示态，切回自动立即恢复自动候选。

**验证方式**

服务集成测试用两个安全 Key 缓存验证自动、手动、自动切换；Electron E2E 用不同额度和倍率的两个 Key 验证自动模式立即恢复站点余额且卡片倍率回到自动候选。

**禁止事项**

不要用下一次网络刷新掩盖偏好切换后的本地不一致；不要让新增站点和刷新站点各自维护重复的 Key 选择逻辑。

**相关文件或命令**

- `electron/main/services/site-service.ts`
- `electron/main/services/site-service.integration.test.ts`
- `tests/e2e/electron-smoke.spec.ts`

**适用范围**

默认 Key 自动策略、手动偏好、额度展示、卡片倍率和悬浮窗运行态。

## 独立鉴权接口必须复用会话恢复链路

**现象**

余额刷新可以从过期 Token 恢复，但独立倍率后台刷新收到 401 后直接显示“需要重新登录”，即使 refresh token 或保存的账号密码仍然有效。

**根因**

新增倍率接口直接读取持久化 access token，没有接入既有的 refresh token 和密码重登策略；站点集合不变化时，认证失败后也不会自动重新触发倍率加载。

**正确做法**

倍率读取先使用当前 access token；认证失败后尝试 refresh token，刷新失败再使用保存的账号密码登录。仅在取得有效新会话后写回凭据并重试倍率接口；非认证错误继续保留缓存和明确错误态。

**验证方式**

服务集成测试让 access token 和 refresh token 依次返回 401，再由密码登录签发新会话；断言倍率恢复成功、刷新和登录各调用一次、凭据更新为新会话。

**禁止事项**

不要把所有独立 IPC 请求都假设为长期有效 Token；不要在非认证错误时无条件登录；不要在恢复成功前覆盖原凭据。

**相关文件或命令**

- `electron/main/services/site-service.ts`
- `electron/main/services/site-service.integration.test.ts`
- `electron/main/adapters/http-client.ts`

**适用范围**

倍率、使用记录、渠道状态及后续任何独立于核心站点刷新的鉴权请求。

## sub2api handler 注释不能替代真实路由注册事实

**现象**

上游部分 handler 注释或命名使用 `api-keys`，但普通用户 API Key 的真实注册路径是 `/api/v1/keys`；按注释拼接会得到 404。

**根因**

代码注释、handler 名称和 Router 注册路径不是同一证据层级，历史重命名后可能不同步。

**正确做法**

接口文档和 adapter 以固定上游提交的 Router 注册、请求 schema 和响应 schema 为准，并用授权站点真实请求复核。当前 Key 列表、详情和更新路径分别为 `/keys`、`/keys/{id}` 和 `/keys/{id}`。

**验证方式**

adapter 单测断言实际 URL；两个授权站点对 `/api/v1/keys` 完成分页读取，并对单 Key PUT、GET 回读及原分组恢复成功。

**禁止事项**

不要根据注释臆造 `/api/v1/api-keys`；不要因一个二开站 404 就静默改用 `/admin/*`。

**相关文件或命令**

- `electron/main/adapters/sub2api-adapter.ts`
- `electron/main/adapters/sub2api-adapter.test.ts`
- `scripts/verify-real-sites.mjs`

**适用范围**

sub2api 普通用户 API Key 列表、详情、更新和后续上游路由核对。

## Turnstile 登录失败不能包装成接口不支持或真机通过

**现象**

某授权站首页可访问且用户现有浏览器会话中的 `/keys` 页面正常，但 API 密码登录返回 HTTP 400 `turnstile verification failed`，Electron 无法取得会话执行写入验证。

**根因**

该二开站在登录链路强制 Turnstile，人机验证属于站点认证策略，不代表 Key 接口缺失，也不能由普通 API 客户端安全绕过。

**正确做法**

把结果记录为认证受阻。可以使用用户已有登录会话只读确认页面与脱敏 Key 能力，但必须把 Electron 登录、分组写入和恢复标为未验证；其他可登录站点继续完成可恢复写入测试。

**验证方式**

记录 HTTP 400 的脱敏错误类别和已有浏览器会话的只读页面事实；最终报告明确区分两站 `verified-and-restored` 与该站 Turnstile 阻断。

**禁止事项**

不要绕过验证码、持久化浏览器凭据或复制完整 Key；不要把浏览器页面可见写成 Electron 登录或分组写入通过。

**相关文件或命令**

- `scripts/verify-real-sites.mjs`
- `liran_docs/09-真机实测.md`

**适用范围**

带 Turnstile、验证码或其他交互式人机验证的 sub2api 二开站认证与真机结论。

## 429 退避只应跨 IPC 传递安全 Retry-After 元数据

**现象**

Renderer 需要按站点的 `Retry-After` 调整渠道轮询，但若直接透传 HTTP 错误对象，响应体、请求上下文或认证细节可能越过 IPC。

**根因**

普通 Error 字符串不足以表达退避秒数，原始 HTTP 客户端错误又包含超出 Renderer 所需的敏感或不稳定字段。

**正确做法**

HTTP 层只解析合法的 `Retry-After` 秒数或日期并规范化为安全数值，主进程错误模型仅保留错误类别与该数值。Renderer 以其为优先退避依据，否则使用 2/4/8/15 分钟序列。

**验证方式**

HTTP client 单测覆盖秒数、日期、非法值和无 header；IPC/调度单测确认不包含响应体、Token、完整 URL 查询或 headers。

**禁止事项**

不要把原始 response、headers 或 body 传给 Renderer；不要在 429 时继续按 30/60 秒频率请求。

**相关文件或命令**

- `electron/main/adapters/http-client.ts`
- `electron/main/adapters/http-client.test.ts`
- `src/renderer/channel-polling.ts`

**适用范围**

渠道实时监控和后续任何需要跨 IPC 协调 HTTP 限流退避的轮询任务。
