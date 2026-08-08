# IPC、安全与日志脱敏

## 2026-08-05 1.7.9 Chrome CDP 与身份边界

- Chrome 认证只在主进程执行，同源顶层导航和令牌字段白名单由策略层限制；Renderer 不接收 Cookie、验证码结果、完整存储或密码。
- profile 账号不匹配在凭据写入前终止，错误经过固定 IPC/通知映射；Chrome 子进程和临时 Profile 在关闭、超时和失败路径清理。

## 2026-08-04 1.7.8 交互窗口退出与网络边界

- 官方窗口和安全验证提示框的关闭按钮/`Esc` 只触发取消，主进程清理临时 session 后拒绝保存；challenge IPv6 解析规则不经过 Renderer/IPC，不返回网络原始响应。

## 2026-08-04 1.7.7 交互输入与敏感边界

- Renderer 仅发起站点输入和 provider 白名单请求；主进程官方窗口在同源页面内异步填充字段，Renderer 不接收密码、Token、Cookie、验证码结果或原始页面响应。
- 认证窗口取消、超时、加载失败和挑战网络失败均以固定安全错误返回，不留下半成品 IPC/存储状态。

## 2026-08-04 1.7.3 窗口重定向与回滚安全边界

- 交互窗口继续使用临时 session、sandbox、contextIsolation、无 preload，并同时拒绝跨域顶层导航和重定向。
- access/refresh、验证码结果、Cookie 和原始响应不经过 Renderer；重新验证或删除失败不会留下站点级半成品。

## 2026-08-04 1.7.2 错误分类与回滚边界

- IPC 只返回固定 `verification-required` provider 或站点摘要；2xx 交互错误和服务端原始响应均在主进程归一化。
- 站点保存失败的清理覆盖 SQLite siteId 行、凭据引用、Key/倍率设置、快照和内存 Map；不得记录失败写入中的密码、Token 或原始响应。

## 2026-08-03 1.7.0 双 provider 与重新验证安全边界

- 新增 `sites:add-with-interactive-verification`、`sites:reverify` 使用严格 provider/siteId schema；禁止 Renderer 传入任意 URL、Token、Cookie、HTTP 方法或站点凭据引用。
- 官方窗口无 preload、sandbox、contextIsolation、临时 session、同源顶层导航和有限 Token 白名单；成功前不写入凭据，失败后清理临时数据。
- 账号标签只返回脱敏值；交互 provider 可出现在站点摘要，access/refresh Token、密码、验证码结果和原始响应绝不经过 IPC、SQLite、日志、截图或文档。

## 2026-07-29 交互认证窗口安全边界（待实施）

- GeeTest 窗口使用系统原生边框的模态 `BrowserWindow`，Windows/macOS 共享业务逻辑；`nodeIntegration:false`、`contextIsolation:true`、`sandbox:true`，不加载项目 preload。
- 使用非持久化临时 session；仅允许目标站点同源顶层导航，拒绝新窗口和跨站顶层跳转，但允许 GeeTest iframe、脚本及网络子资源正常完成挑战。
- 账号密码只在严格同源页面尝试自动填写；无法可靠定位表单时允许用户在官方页面手动输入。Renderer 不获得密码、Token、Cookie、验证码结果或页面 HTML。
- Token 读取限制为有限白名单并在主进程验证会话；成功、取消、超时或失败后清理临时 session，任何未验证结果不得保存站点或凭据。
- GeeTest 站点 refresh 失败后标记“需要重新验证”；禁止后台密码重登和非用户触发的验证窗口。
- 新 IPC 必须使用固定 channel、严格输入输出 schema、重复点击去重和安全错误模型；日志、SQLite、截图、测试夹具与发布说明执行敏感扫描。状态：`待安全负面测试与打包应用验收`。

## 2026-07-23 规划影响

新增 API 密钥、过滤 stats、所选 Key 汇总和渠道调度 IPC 必须逐项建立严格 Zod 输入/输出，禁止把 `unknown`、完整上游对象、任意 URL/方法或 Token 暴露给 Renderer。分组写入对象必须 `.strict()` 且只含 siteId、keyId、groupId；Key 输出 schema 不得存在完整 key 字段。日志、错误、测试快照、CSV 和 E2E 截图纳入敏感模式扫描。当前状态为待实现，不得继承旧版本安全测试结论。

> 2026-07-14 真机回写：`sandbox`、`contextIsolation`、禁用 Node integration、CommonJS preload 白名单桥、输入/输出 Zod 校验和敏感字段扫描已落地。Electron E2E 已断言桥对象并完成业务 IPC 流；打包应用数据、SQLite、凭据后端、CSV 和稳定截图扫描未发现秘密泄漏。

上级：[[03-索引]]
下级：preload 契约、IPC 校验、Electron 安全、日志
依赖：[[02-架构文档]]、[[06-数据字典]]

## 职责

建立 Renderer 与主进程的最小可信边界。覆盖 RQ-15、RQ-18。

## 规则

- contextIsolation 开启、Node integration 关闭、sandbox 可行性在初始化时验证。
- preload 只暴露站点、查询、设置、窗口和通知等命名方法。
- 每个 channel 有请求/响应 schema、调用权限和安全错误格式。
- 拒绝任意导航、任意新窗口和任意 shell 打开；外部 URL 使用协议/域名策略。
- CSP 限制脚本、样式、连接和资源；开发与生产策略分开。
- 日志 redactor 处理 password、token、authorization、apiKey、secretRef 和敏感嵌套字段。
- 1.4.3 管理页允许完整 Key 在 Renderer 会话内存中短暂展示，但任何 IPC 日志、错误日志、数据库、缓存、截图和测试证据仍必须脱敏；复制 IPC 只返回成功布尔值。

## 验收

- 非法 IPC、超大输入、原型污染、导航、CSP、日志嵌套脱敏和错误响应均有安全测试。

## 当前实现证据

preload 已只暴露 `sites.list/addAndVerify/refresh/usage/channels` 命名 API，主进程使用 Zod 校验站点、站点 ID 和使用记录查询；Renderer 未获得 Node、密码、Token 或任意 HTTP 权限。非法 channel、CSP、日志嵌套脱敏和导航负面测试仍待补齐。

## 任务范围

TASK-01-03、TASK-01-04、TASK-12-07 至 TASK-12-09。

## 2026-07-18 外发版合并增量（内部测试通过；真机待实测）

本轮已复核生产 CSP、preload 桥、安全窗口选项、公开 Radar 来源白名单和敏感信息扫描；Windows asar 中包含 `dist-electron/preload/bridge.cjs`，未发现新增凭据泄露。

- Radar 不再是 Renderer `fetch` 数据来源，也不再依赖 `current.json` 或主应用 CSP 的外部 `connect-src`；站点列表经 SQLite 设置表持久化，打开的 HTTPS origin 由主进程受限 `WebContentsView` 承载。
- Radar 远程页面不得经过站点 IPC、日志 redactor 以外的敏感数据流或业务数据库表；只允许当前保存条目 HTTPS origin 内的顶层导航，不调用系统浏览器，不读取 Cookie、Token、凭据或页面数据。
- 透明度设置必须继续通过现有 Zod IPC 边界，不开放任意窗口参数、文件路径、shell 或导航能力。
- MERGE-03、MERGE-07、MERGE-08、MERGE-10 必须补充 CSP、preload 桥、敏感扫描、窗口显示和 Windows 结构证据。
