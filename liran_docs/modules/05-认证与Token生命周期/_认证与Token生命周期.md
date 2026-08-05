# 认证与 Token 生命周期

## 2026-08-05 1.7.10 Chrome 失败态直接重试

- Chrome 未安装、启动失败、窗口关闭、同源拦截、Token 缺失和超时均保留安全验证入口；通知只显示安全错误，失败不写入新站点或覆盖旧凭据。

## 2026-08-05 1.7.9 真实 Chrome Turnstile 与账号归属

- Turnstile 使用 macOS/Windows 系统 Chrome 独立临时 Profile；CDP 仅读取同源 `auth_token`/`access_token`/`refresh_token` 白名单，关闭、超时和失败都会清理 Profile。
- 重新验证必须把 profile 账号与站点账号归一化比较；不一致时不写入新 Token、快照或运行态，旧凭据保持有效。

## 2026-08-04 1.7.8 官方窗口网络与退出

- 启动交互窗口前为 Cloudflare challenge 域使用公开 IPv6 HTTPS 边缘提示，避免部分网络把挑战主机解析到 RFC 2544 假 IP；挑战仍由官方页面和用户本人完成。
- 官方窗口支持原生关闭按钮和 `Esc`，退出只清理临时 session，不保存站点；安全提示框继续支持右上角关闭图标与 `Esc`。

## 2026-08-04 1.7.7 官方登录窗口表单状态

- 交互窗口对异步 SPA 登录表单持续填充用户输入，使用固定邮箱/密码字段白名单和框架事件；已有字段值不覆盖。
- Turnstile/GeeTest 的挑战结果仍只由官方页面回调产生；应用不读取验证码结果、不复制外部浏览器会话，成功后才进入 Token 核心校验和原子保存。

## 2026-08-04 1.7.3 access-only 会话与重定向边界

- 交互登录成功可只有 access token；refresh token 缺失不影响首次核心校验，但失效后直接进入 `auth-required`。
- 官方窗口同时校验 `will-navigate`/`will-redirect` 的目标 origin；重新验证失败不覆盖旧会话。

## 2026-08-04 1.7.2 2xx 交互错误与重新验证

- 登录成功响应解析前先识别 GeeTest/Cloudflare Turnstile 要求，2xx 错误包不能生成会话。
- 交互站点 Token 失效且没有 refresh token 时保持 `auth-required`，只允许用户主动打开官方窗口重新验证。

## 2026-08-03 1.7.0 GeeTest/Turnstile 交互认证（当前有效）

- provider 判定来自公开设置或明确登录错误；交互错误保留真实 HTTP 状态并标准化为可判别结果，Renderer 只收到安全文案和 provider。
- 交互站点 refresh 失效后进入 `auth-required`，禁止密码重登；用户主动重新验证后才轮换 Token。成功更新原站点，失败不覆盖旧凭据。
- 旧 `authenticationMode=geetest` 继续兼容，新的 Turnstile 使用通用 `interactive + authenticationProvider` 表达。

> 2026-07-14 真机回写：账号密码登录、Bearer、refresh 单飞、refresh 失败后密码重登和成功后会话轮换已落地；本地 HTTP 集成测试通过。两个真实站点重新登录及 macOS safeStorage 跨重启恢复通过；真实 refresh 失效不做破坏性验证，DPAPI 待 Windows CI。

上级：[[03-索引]]
下级：登录、刷新单飞、密码重登、认证失效
依赖：[[04-常用账号与安全凭据]]、[[06-API适配器与能力探测]]

## 职责

封装普通用户登录、Token 存取、自动续期、刷新去重和认证失效。覆盖 RQ-01、RQ-14、RQ-16。

## 认证顺序

1. 有未过期 access token 时直接请求。
2. 401 或临近过期时使用 refresh token；同站并发刷新必须单飞。
3. refresh 不支持或失败时，读取加密密码进行一次重登。
4. 重登失败进入 auth-required，停止该站普通轮询并提醒用户。

## 错误与安全

- 区分错误凭据、禁用账号、限流、网络和不兼容响应。
- 失败不得删除最后成功业务缓存。
- Token 轮换必须原子更新，新 Token 落盘成功后再废弃旧引用。

## 验收

- 登录成功/失败、刷新单飞、Token 轮换、refresh 缺失、密码重登和 auth-required 均有 mock 集成测试。

## 当前实现证据

已实现 `Sub2ApiClient` 登录/刷新和 `AuthCoordinator` 每站单飞；safeStorage 通过 `CredentialVault` 保存加密凭据，两个真实站点已在最终打包应用中重新登录、跨重启恢复并完成核心只读读取。refresh 失败后的密码重登由本地 HTTP 集成测试覆盖；真实站点不主动破坏 Token。Windows DPAPI 仍待 CI。

## 任务范围

TASK-03-04 至 TASK-03-06、TASK-12-02。

## 2026-07-29 交互式认证增量（待开发）

- 公开设置或登录错误可将站点认证模式标记为 `password` 或 `interactive-geetest`。
- 交互窗口使用临时 Electron session；只在严格同源页面自动填充，有限白名单读取 access/refresh token，并以真实 profile/core 请求确认会话。
- GeeTest 站点 refresh 失效后进入 `auth-required`，不得后台密码重登或自动弹窗；用户主动重新验证后才能轮换凭据。
- Token、Cookie、密码、验证码结果和页面内容不得经过 Renderer、普通数据库、日志、截图或文档。
