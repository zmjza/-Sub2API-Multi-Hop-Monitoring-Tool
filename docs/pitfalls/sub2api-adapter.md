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
