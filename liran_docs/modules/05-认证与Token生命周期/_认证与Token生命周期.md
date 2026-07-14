# 认证与 Token 生命周期

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
