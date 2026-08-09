# sub2api 适配器避坑

## Chrome 登录失败态必须保留直接重试入口

**现象**

Chrome 未安装、窗口关闭、同源跳转被拦截或登录后没有白名单 Token 时，如果 Renderer 只清空 pending verification，用户只能重新填写表单并再次等待公开设置检测，失败原因和重试入口不连续。

**正确做法**

这些失败只结束当前 Chrome 会话，不保存站点；Renderer 保留安全验证弹窗和“开始登录”按钮，统一通知展示安全错误。用户可以直接重试，取消仍清空 pending 状态并恢复“等待开始”。

**验证方式**

覆盖 `CHROME_NOT_INSTALLED`、`CHROME_START_FAILED`、`CHROME_CDP_UNAVAILABLE`、`CHROME_CLOSED`、`CHROME_AUTH_TOKEN_NOT_FOUND`、`CHROME_AUTH_ORIGIN_BLOCKED` 和 `CHROME_AUTH_TIMEOUT`，断言弹窗可重试且站点数量、凭据和旧站点状态不变。

**禁止事项**

不要因为保留弹窗而保存半成品；不要把 Token 缺失降级为登录成功；不要自动读取 Cookie 或代做 Cloudflare CAPTCHA。

## Chrome 交互登录只支持明确的 Bearer Token 会话

**现象**

部分站点登录成功后只写入 HttpOnly Cookie，页面不会向脚本暴露 access token；如果应用复制全部 Cookie 或猜测 Cookie 名称，可能扩大凭据暴露面，也无法证明请求需要的 CSRF 规则正确。

**根因**

当前 Sub2API adapter 的核心接口统一使用 `Authorization: Bearer <accessToken>`。仓库没有任何站点 adapter 明确声明 Cookie 字段、发送方式或 CSRF 规则，因此不能把未知 Cookie 会话当作已支持登录。

**正确做法**

真实 Chrome 认证只在目标同源页面读取 `accessToken`、`access_token`、`auth_token` 及可选 refresh 字段；不调用 `document.cookie`、CDP Cookie API 或完整 Storage API。登录后没有白名单 Bearer Token 时返回 `CHROME_AUTH_TOKEN_NOT_FOUND`，Renderer 明确提示“暂不支持仅 Cookie 会话”，不保存站点。

**验证方式**

运行 `chrome-auth-policy.test.ts`，确认空 Storage 会话返回 `undefined`，检查脚本不包含 `document.cookie` 或 `Network.getAllCookies`；再运行 SiteService 核心校验回归，确认只有 Bearer Token 进入 profile、Key、分组、倍率和统计请求。

**禁止事项**

不要复制用户日常 Chrome Profile 或全部 Cookie；不要把 HttpOnly Cookie、验证码令牌、完整页面存储或原始 CDP 响应传入 Renderer；没有 adapter 明确合同前不要新增 Cookie-only 兼容分支。

**相关文件或命令**

- `electron/main/services/chrome-auth-policy.ts`
- `electron/main/services/chrome-auth-window.ts`
- `electron/main/services/chrome-auth-policy.test.ts`
- `npm test -- --run electron/main/services/chrome-auth-policy.test.ts`

**适用范围**

所有 Cloudflare Turnstile 真实 Chrome 登录和后续使用 Bearer Token 的站点 adapter。

## 官方 SPA 登录表单必须等待异步渲染后再填充凭据

**现象**

真实 Turnstile 官方窗口可以显示 `Verify you are human`，但邮箱和密码为空，用户完成挑战后登录按钮仍保持禁用，容易误判为人机验证失败。

**根因**

部分站点登录页由 Vue/React 异步挂载表单；`did-finish-load` 触发时页面 HTML 已完成加载，但输入框尚未挂载。只执行一次自动填充会静默找不到输入框，后续只轮询挑战 Token 不会再补填凭据。

**正确做法**

官方登录窗口在同源顶层页面内，以固定选择器白名单轮询填充，直到邮箱和密码输入框实际存在且有值；填充通过原生 `value` setter 加 `input`/`change` 事件通知站点框架。字段已有内容时不覆盖用户手动输入，成功填充后停止重试。Turnstile/GeeTest 仍由官方页面回调和用户操作处理。

**验证方式**

运行 `interactive-auth-policy.test.ts` 的异步填充回归；macOS 真机打开 `ai.maok.shop/login` 后检查官方窗口的邮箱/密码已显示脱敏值、Turnstile 控件可见且登录按钮在挑战前保持禁用。不得点击或伪造 CAPTCHA 来替代用户挑战。

**禁止事项**

不要在 `did-finish-load` 只填一次后假设 SPA 已完成挂载；不要覆盖用户已经输入的字段；不要通过复制 Chrome Cookie、Token、验证码结果或完整页面存储解决登录。

**相关文件或命令**

- `electron/main/services/interactive-auth-window.ts`
- `electron/main/services/interactive-auth-policy.test.ts`
- `npm test -- --run electron/main/services/interactive-auth-policy.test.ts`

**适用范围**

所有使用异步 SPA 登录页的 GeeTest、Cloudflare Turnstile 或其他官方交互认证站点。

## access-only 交互会话不能被当作无效登录

**现象**

部分站点登录成功后只在同源存储中写入 access token，没有 refresh token。若提取器要求 access/refresh 成对出现，会把官方窗口的成功会话误判为失败，站点无法添加。

**根因**

refresh token 是续期能力，不是首次核心会话的必要条件；登录成功的最低安全凭据是 access token，之后仍需通过 profile、Key、分组、倍率和统计核心校验。

**正确做法**

有限白名单提取器允许 access token 单独存在，refresh token 仅在存在且满足长度边界时返回。交互站点没有 refresh 时，刷新失败直接进入 `auth-required`，不静默密码重登。

**验证方式**

运行 `interactive-auth-policy.test.ts` 的 access-only 夹具和 `site-service.integration.test.ts` 的重新验证回归；确认 Token 不经过 Renderer、SQLite、日志或截图。

**禁止事项**

不要复制 Chrome localStorage、Cookie 或验证码结果；不要为了补 refresh token 伪造响应或绕过官方验证。

## 重新验证必须校验 profile 账号归属

**现象**

已有站点进入 Chrome 或官方交互窗口重新登录后，如果只用 Token 能否访问核心接口判断成功，用户登录了同地址的另一个账号时会覆盖原站点凭据。

**根因**

同一站点地址允许保存多个用户名；access token 本身不能证明它属于当前 `siteId`。交互窗口成功和核心接口成功必须同时满足保存账号与 `/user/profile` 返回账号一致。

**正确做法**

重新验证读取 profile 后，使用与首次添加相同的账号归一化规则比较 email（去空格、大小写不敏感）或非 email 用户名；不一致时抛出 `SITE_ACCOUNT_IDENTITY_MISMATCH`，在写入凭据、快照、Key 缓存和运行态前终止，旧 Token 保持不变。profile 没有可识别账号时保留兼容行为，但不能伪造账号字段。

**验证方式**

运行 `site-service.integration.test.ts` 的异账号重新验证回归，确认返回安全错误、旧凭据和旧快照保持不变；再运行 Renderer 通知测试，确认只显示“登录账号与添加站点用户名不一致”。

**禁止事项**

不要只按 HTTP 200、access token 存在或余额读取成功判断账号归属；不要按 baseUrl 覆盖同地址其他账号；不要在 Renderer、日志、截图或文档中记录 Token、Cookie、密码或完整 profile 响应。

**适用范围**

所有支持同地址多账号、GeeTest、Cloudflare Turnstile 或 Chrome 交互重新验证的站点。

## 官方窗口必须同时拦截顶层重定向

**现象**

只监听 `will-navigate` 时，脚本触发的顶层 HTTP 重定向可能绕过同源导航限制，把交互窗口带到非官方 origin。

**根因**

Electron 将用户导航和服务器重定向分成不同事件；两者都可能改变顶层页面 URL。

**正确做法**

`interactive-auth-window` 同时监听 `will-navigate` 和 `will-redirect`，两者都通过 `isAllowedInteractiveNavigation` 仅允许目标 origin；跨域验证码 iframe 仍作为子资源正常加载。

**验证方式**

运行 `interactive-auth-policy.test.ts` 的导航策略测试并进行源码审计；真实打包窗口只确认挑战子资源，不复制浏览器状态。

**禁止事项**

不要允许任意顶层 URL、不要把验证码 iframe 当作顶层导航放行、不要把重定向拦截改成关闭挑战。

## 删除同地址站点必须清理全部 siteId 状态

**现象**

删除同地址多账号中的一个站点后，快照、通知规则、进行中的刷新或 Key 用量缓存仍可能在内存/SQLite 中残留，随后污染另一个账号或重启后的列表。

**根因**

站点删除只清理了凭据和主表，历史增量新增的 siteId 分区 Map 与 setting key 没有统一清单。

**正确做法**

删除时清理 `siteId` 对应的凭据、快照、备注、渠道关系、Key/倍率设置、通知规则、当前站点引用、刷新单飞、Key 写入/用量缓存和所有运行态 Map；另一个 siteId 的值必须保持不变。

**验证方式**

运行删除隔离集成测试，检查 SQLite setting/snapshot 行、内存缓存和通知站点规则；再运行全量测试与 Electron E2E。

**禁止事项**

不要按 baseUrl 批量删除同地址其他账号；不要保留已删除站点的 Token、Key 缓存、通知或进行中请求引用。

## 2xx 登录错误包不能按成功会话解析

**现象**

部分二开站在 HTTP 2xx 响应中返回 `TURNSTILE_REQUIRED` 或 `GEETEST_REQUIRED` 错误包；若直接执行登录成功 schema，会把错误误判为普通接口异常或产生错误的会话状态。

**根因**

HTTP 状态码不是业务成功语义；登录接口的交互验证要求可能被包在顶层或有限 `data` 对象内。

**正确做法**

登录响应先经过固定 provider/错误码分类，再执行成功 schema。只返回 `INTERACTIVE_VERIFICATION_REQUIRED`、provider 和可选安全 HTTP 状态，不返回原始响应。

**验证方式**

使用 2xx、401、400 的 GeeTest/Turnstile 夹具运行 `electron/main/adapters/http-client.test.ts`，确认均分类为交互验证且不含私有字段。

**禁止事项**

不要仅按 `response.ok` 判定登录成功；不要透传错误 JSON、Token、Cookie 或完整站点响应。

**相关文件或命令**

- `electron/main/adapters/http-client.ts`
- `electron/main/adapters/http-client.test.ts`
- `npm test -- --run electron/main/adapters/http-client.test.ts`

**适用范围**

所有兼容 sub2api 的登录和交互验证接口。

## 强制刷新失败不得丢弃渠道成功缓存

**现象**

渠道弹窗打开后，强制刷新遇到网络错误会把当前选择和详情替换成完整错误态；重新打开弹窗后缓存又出现，造成“过几分钟消失”的假象。

**根因**

刷新请求把失败当成空数据提交，且自动加载 effect 依赖不稳定的选中状态，导致失败分支清空展示或重复初始化。

**正确做法**

强刷前保存最近成功列表、选中 ID 和详情；失败时恢复旧内容并设置 stale 标记，成功响应才替换缓存。选中 ID 通过 ref 参与恢复，自动加载 effect 只依赖稳定的 load callback。

**验证方式**

运行 `src/renderer/shells/overview/ChannelStatusPopover.test.ts`、渠道 loader 测试和 Electron E2E；确认强刷失败仍显示选中渠道、详情和重试入口。

**禁止事项**

不要在强刷失败时清空 `channels`、`selected` 或 `details`；不要把 `selected?.id` 作为自动加载 callback 的依赖；不要要求重新打开弹窗恢复缓存。

**相关文件或命令**

- `src/renderer/shells/overview/ChannelStatusPopover.tsx`
- `src/renderer/shells/overview/ChannelStatusPopover.test.ts`
- `src/renderer/shells/overview/rate-channel-status-loader.ts`

**适用范围**

渠道状态弹窗、总览内联渠道摘要和任何 stale-while-revalidate 详情视图。

## Electron 官方窗口的 Turnstile challenge 可能被外部网络关闭

**现象**

真实公开设置接口返回 `turnstile_enabled=true`，适配器能够识别 `turnstile` provider。部分机器把 `brunhild.challenges.cloudflare.com` 解析到 `198.18.0.111` 等 RFC 2544 假 IP，Electron challenge 请求出现 `ERR_CONNECTION_CLOSED`，页面只有 `cf-turnstile-response` 空字段、登录按钮保持禁用；1.7.6 的 IPv4 规则只能让部分入口显示控件，1.7.8 改用 Cloudflare HTTPS DNS 公布的 IPv6 边缘提示后，真实 challenge 请求可在隔离 macOS ARM64 窗口返回正常 `204/2xx`，但尚未完成用户挑战。

**根因**

已确认的直接证据是挑战子资源没有在 Electron 窗口建立连接；目标登录页可返回 HTTP 200，但挑战子域 TLS 无法完成，使用公开 Cloudflare 边缘地址复核返回 HTTP 522。具体是 Cloudflare 网络策略、当前网络或 Electron 客户端识别导致的哪一层阻断，信息不全，待人工补充。不能据此推断密码、站点地址或适配器协议错误。

**正确做法**

GeeTest 官方 Electron 窗口使用原生 Electron 浏览器标识，不再移除 Electron 标记或注入 UA-CH，也不通过 CDP 改写 iframe 目标；Cloudflare Turnstile 改由系统 Google Chrome 独立临时 Profile 承接。主进程仅通过随机回环 CDP 读取目标 origin 的有限 Token 白名单。两条路径都保留临时 session、同源顶层导航、用户本人挑战、核心接口校验和失败不落盘边界；网络失败时按外部阻塞记录，不伪造或绕过 CAPTCHA。

**验证方式**

运行 `interactive-auth-policy.test.ts` 和站点 Renderer/Electron E2E，重新执行 `npm run build`、`npm run pack` 和 macOS ARM64 打包应用真实流程；检查 challenge iframe、挑战域请求、登录按钮、网络失败后的直接重试、关闭图标、`Esc` 和是否进入核心校验。仅在看到成功登录与核心接口校验后标记通过。

**禁止事项**

不要复制 Chrome Cookie、验证码令牌、完整 localStorage 或页面内容；不要伪造 Turnstile 响应、关闭 challenge、修改远程路由或把外部网络失败降级为普通“站点地址无效”。

**相关文件或命令**

- `electron/main/services/interactive-auth-policy.ts`
- `electron/main/services/interactive-auth-window.ts`
- `electron/main/services/interactive-auth-policy.test.ts`
- `electron/main/index.ts`
- `npm run pack`
- `npm run dist:mac`
- `npm run dist:win`

**适用范围**

所有使用 Cloudflare Turnstile 的 sub2api 二开站官方登录窗口；GeeTest 仍遵循同一交互 session 和安全边界。公开边缘地址可能随 Cloudflare 或网络运营商变化，若固定规则失效，应更新解析来源并保持“受阻”，不能伪造挑战成功。

## Electron 官方登录窗口不应继续伪装为 Chrome

**现象**

Turnstile 已经改由系统 Google Chrome 承接后，Electron GeeTest 窗口仍残留 User-Agent、UA-CH 和 CDP iframe 目标注入代码；这会让两条认证路径的浏览器边界不一致，也增加官方页面识别异常和维护复杂度。

**根因**

历史版本为缓解 Electron/Cloudflare 兼容性曾移除 Electron 标记并注入 Google Chrome 品牌信息。Turnstile 现在由真实 Chrome 负责，继续在 GeeTest Electron 窗口保留这类脚本已经没有必要；它也不是合法的验证码结果或网络修复。

**正确做法**

GeeTest 使用原生 Electron `BrowserWindow`、临时 session、sandbox、contextIsolation、无 preload、同源顶层导航和官方页面交互，不调用 `setUserAgent`、`Network.setUserAgentOverride`、`Page.addScriptToEvaluateOnNewDocument`、`Target.attachToTarget`，不改写 `navigator`。Turnstile 只走系统 Google Chrome 独立临时 Profile；主进程仅读取同源有限 Token 白名单。

**验证方式**

运行 `interactive-auth-policy.test.ts` 的负向源码断言、全量 Vitest、TypeScript、lint、构建和 Electron E2E；再执行 macOS Chrome 超时清理烟测，确认临时 Profile/进程清理。真实 CAPTCHA、登录和核心接口保存仍由用户本人完成。

**禁止事项**

不要为了让 Electron 看起来像 Chrome 而覆盖 UA、UA-CH、`navigator.webdriver` 或通过 CDP 重载/改写挑战 iframe；不要把这种伪装写成已通过人机验证。

**相关文件或命令**

- `electron/main/services/interactive-auth-window.ts`
- `electron/main/services/interactive-auth-policy.test.ts`
- `electron/main/services/chrome-auth-window.ts`
- `npm test -- --run`
- `npm run test:e2e`

**适用范围**

所有 GeeTest/Turnstile 官方登录窗口和任何需要第三方人机验证的桌面认证流程。

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

## GeeTest 登录受阻必须与地址或网络故障区分

**现象**

站点首页、TLS 和 `/api/v1/auth/login` 路由均可访问，但站点管理添加时显示“站点地址无效、网络不可用或服务异常”；登录接口实际返回 HTTP 400 `GEETEST_VERIFICATION_FAILED`。

**根因**

站点公开配置启用了 GeeTest，登录请求必须包含交互式验证码结果。当前客户端只提交邮箱和密码；HTTP 层又把登录接口的非 401/403 错误统一归类为 `SERVER_ERROR`，服务层因此显示通用地址或网络错误。

**正确做法**

把结果记录为认证受阻，并在安全错误模型中将已确认的验证码错误映射为明确提示。若要支持此类站点，应设计用户可见的交互式验证流程，不得由后台 HTTP 客户端模拟或绕过验证码。

**验证方式**

分别检查首页、证书、公开设置和登录端点：公开设置确认 `geetest_enabled=true`，无验证码登录返回 HTTP 400 且错误类别为 `GEETEST_VERIFICATION_FAILED`；应用同一 `Sub2ApiClient` 请求可复现当前通用错误映射。验证记录必须脱敏。

**禁止事项**

不要把 GeeTest 失败归因于 URL、DNS、TLS、账号密码或接口不存在；不要记录账号密码、验证码结果或完整响应上下文；不要尝试绕过人机验证。

**相关文件或命令**

- `electron/main/adapters/http-client.ts`
- `electron/main/adapters/schemas.ts`
- `electron/main/services/site-service.ts`
- `curl https://<site>/api/v1/settings/public`

**适用范围**

开启 GeeTest 或类似交互式验证码的 sub2api 二开站登录与站点添加流程。

## GeeTest 登录成功不能只等待通用 access_token 键

**现象**

用户已在官方登录窗口完成人机验证并进入管理界面，但应用持续等待，无法自动继续添加站点。

**根因**

实际 sub2api 二开站把访问令牌写入 localStorage 的 `auth_token`，刷新令牌写入 `refresh_token`。只读取 `access_token` 或仅依据页面跳转判断登录成功都会漏掉有效会话，后者还可能把未验证完成的页面状态误判为成功。

**正确做法**

仅在严格同源、沙箱化、临时 Electron session 内读取有限白名单，至少兼容已确认的 `auth_token`/`refresh_token`；拿到令牌后必须调用核心 profile、Key、usage 等读取门禁验证会话，全部满足保存条件后再原子写入站点与凭据。进入核心验证与保存阶段后临时禁止关闭验证窗口，失败后恢复关闭能力，避免 UI 已报告取消但后台仍完成保存。取消、超时、令牌无效或核心读取失败均不得留下半成品。

**验证方式**

策略单测覆盖直接键、结构化白名单、未知键拒绝、缺少 refresh token 拒绝和同源导航；服务集成测试断言无效交互令牌不产生站点、凭据或缓存；macOS 真机完成用户本人 GeeTest 后自动添加，并在重启后恢复站点和会话。

**禁止事项**

不要遍历或导出全部 localStorage、Cookie、响应体或页面全局对象；不要在 Renderer、日志、截图、IPC 返回值或文档中暴露令牌；不要把页面出现“控制台”等文字作为认证成功依据。

**相关文件或命令**

- `electron/main/services/interactive-auth-policy.ts`
- `electron/main/services/interactive-auth-window.ts`
- `electron/main/services/site-service.ts`

**适用范围**

通过 Electron 官方站点窗口承接 GeeTest、Turnstile 或其他用户交互式登录会话。

## 自动轮询退避与人工重试必须使用独立语义

**现象**

渠道自动刷新失败后，要么“重试”按钮仍被退避拦截，要么定时轮询因复用 `force=true` 每分钟绕过退避，造成持续请求；缓存存在时还可能被错误地当作本轮刷新成功。

**根因**

`force` 同时承担“跳过新鲜缓存”和“跳过失败退避”两个不同含义。自动轮询确实需要绕过新鲜缓存发起更新，但不应绕过 Retry-After 或 2/4/8/15 分钟退避；用户明确点击重试时才允许单次绕过普通退避。

**正确做法**

将 `forceRefresh` 与 `bypassBackoff` 分开：定时轮询传入前者但不传后者，人工重试同时传入二者。退避命中必须返回失败语义而不是旧缓存成功语义；UI 继续展示最近成功缓存，并标注更新失败和最后成功时间。

**验证方式**

fake timer 测试分别断言自动轮询不绕过退避、人工重试可单次绕过、Retry-After 生效、成功后清除警告；真实 macOS 观察两个 60 秒轮询周期，手动渠道关联和最后成功数据持续显示。

**禁止事项**

不要用一个布尔参数混合缓存与退避策略；不要在后台轮询失败时清空渠道列表、手动关联或弹出全局通知；不要把返回旧缓存当成本轮网络请求成功。

**相关文件或命令**

- `src/renderer/shells/overview/rate-channel-status-loader.ts`
- `src/renderer/shells/overview/OverviewPage.tsx`
- `src/renderer/channel-polling.ts`

**适用范围**

渠道列表、倍率或其他同时具有 stale-while-revalidate、自动调度和人工重试的 Renderer 数据源。

## Turnstile 与 GeeTest 登录拒绝必须保留真实 HTTP 状态

**现象**

部分站点在登录接口返回 `401` 时同时携带 Turnstile 或 GeeTest 错误码。若统一把交互验证错误写成 `httpStatus=400`，日志、诊断和后续重试策略会与真实响应不一致，难以区分账号拒绝、验证未完成和普通参数错误。

**根因**

交互验证分类发生在通用错误归一化之前，错误对象曾使用固定状态码，而不是当前 `Response.status`。站点实现可能用 400、401 或其他明确的非 2xx 状态表达同一验证门禁。

**正确做法**

在有限 provider 错误码/消息识别成功后，保留当前响应的 `response.status`，只输出 provider、能力、可重试性和安全文案；不透传完整 JSON、Token、Cookie 或页面内容。GeeTest/Turnstile 统一走官方窗口和核心接口验证，不能尝试绕过挑战。

**验证方式**

适配器测试分别覆盖 400 与 401 的 `GEETEST_*`、`TURNSTILE_*` 错误，断言 provider 正确、`httpStatus` 等于实际响应码且无私有响应字段；服务集成测试覆盖重新验证成功更新原站点、失败保留旧凭据。

**禁止事项**

不要把所有验证码拒绝固定成 400；不要把 401 当作普通密码重登许可；不要在浏览器自动破解、绕过或代替用户完成 CAPTCHA。

**相关文件或命令**

- `electron/main/adapters/http-client.ts`
- `electron/main/adapters/http-client.test.ts`
- `electron/main/services/site-service.integration.test.ts`

**适用范围**

所有需要 GeeTest、Cloudflare Turnstile 或类似交互式登录验证的 sub2api 二开站。

## 菜单发现已废弃，快捷入口必须使用内置标准模板

**现象**

2.1.0 使用同 partition 的临时 `WebContentsView` 从服务器网页读取导航结构；真实 `api-feng.online` 受 Turnstile、异步 SPA 挂载和前端鉴权守卫影响，自动发现无法稳定拿到完整菜单，用户还需要先登录、再刷新，体验不符合需求。

**根因**

这些二开站都基于 `Wei-Shaw/sub2api`，菜单路径实际是固定模板，不需要也不应该依赖远程 DOM。按网页实时结构抓菜单会把登录态、验证码、异步渲染和二开差异全部引入快捷入口流程。

**正确做法**

快捷入口改用软件内置的 `SUB2API_STANDARD_MENUS` 标准模板，保存服务器后即可在编辑弹窗直接搜索、分组勾选；打开时只把相对路径解析到当前服务器 HTTPS origin。旧快捷入口按规范化路径匹配模板，匹配不到的进入“历史快捷入口”区域，未移除时继续保留。旧菜单发现缓存停止读取，只在删除服务器、清除会话或 origin 变更时按服务器清理。

**验证方式**

运行模板契约单测、存储缓存清理单测和 Electron E2E，确认无需登录即可选择、5 项上限、搜索分组、旧入口兼容、保存重启保留；再用真实 `api-feng.online` 验证域名替换、入口直达和登录态复用。

**禁止事项**

不要恢复远程 DOM/菜单发现 IPC；不要在快捷入口选择阶段要求用户先登录；不要读取 Cookie、Token、页面存储、完整 HTML 或私有接口；不要把 `/custom/:id` 或仅展开父菜单硬编码进模板。

**相关文件或命令**

- `electron/main/services/sub2api-server-manager.ts`
- `electron/shared/sub2api-server.ts`
- `electron/shared/sub2api-menu-template.ts`
- `src/renderer/shells/sub2api-servers/Sub2ApiServersPage.tsx`

**适用范围**

所有基于 `Wei-Shaw/sub2api` 二开的 Sub2API 服务器快捷入口功能。
