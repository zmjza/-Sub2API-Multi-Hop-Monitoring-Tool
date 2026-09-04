# OpenCodex 本地服务接入避坑

## /api/logs 需要管理员令牌

**现象**

直接请求 http://localhost:10100/api/logs 返回 HTTP 401 Unauthorized，无法读取请求日志。

**根因**

OpenCodex 管理 API 强制鉴权。令牌来自 OPENCODEX_ADMIN_AUTH_TOKEN 环境变量或 ~/.opencodex/admin-api-token 文件（格式 ocx_admin_...），请求头为 Authorization: Bearer <token> 或 x-opencodex-api-key。令牌文件权限为 0600，属于本机秘密。

**正确做法**

主进程读取令牌文件后携带 Bearer 请求固定端点 http://localhost:10100/api/logs；令牌只存在于主进程内存，不进入 Renderer、IPC 参数、日志或持久化。响应结构为顶层 timeZone/total/logs，每条含 timestamp/provider/model/firstOutputMs/inboundProtocol/requestedEffort/effectiveEffort/status/durationMs/usage/displayMetrics（tokPerSecond/cost）。

**验证方式**

读取 ~/.opencodex/admin-api-token 后请求 /api/logs?limit=3 返回 200；Electron E2E 在真实服务可用时加载成功、服务不可用时显示错误态并可切回。

**禁止事项**

不要把令牌写入源码、CHANGELOG、测试输出或文档；不要允许 Renderer 直接请求任意地址；不要绕过鉴权或伪造 2000 条外的数据。

**相关文件或命令**

- electron/main/services/opencodex-service.ts
- electron/shared/opencodex.ts
- ~/.opencodex/admin-api-token
- curl -H "Authorization: Bearer <token>" http://localhost:10100/api/logs?limit=3

**适用范围**

所有读取本机 OpenCodex 服务日志、配额或管理接口的功能。

## 完整历史不能依赖 /api/logs

**现象**

`/api/logs?limit=4000` 仍只能返回 2000 条，今天或近 7 天的使用记录被截断。

**根因**

OpenCodex `/api/logs` 读取固定 2000 条内存环形缓冲；持久化 `usage.jsonl` 的完整数据由 `/api/request-history` 索引提供，并通过 cursor 分页返回。

**正确做法**

按时间范围和可用筛选条件请求 `/api/request-history?limit=100`，收到 `hasMore=true` 时继续携带 `nextCursor`，直到所有页合并完成；界面数量使用合并后的真实长度。

**验证方式**

本机真实服务 request-history 索引显示 33345 行，今日范围分页完整返回 4677 条；分页单测覆盖多页合并和 cursor 缺失错误。

**禁止事项**

不要把 `/api/logs` 的 `total` 当作完整历史总数；不要把 2000 或 4000 写成永久上限；不要在 Renderer 直接读取 usage.jsonl 或管理员令牌。

**相关文件或命令**

- `electron/main/services/opencodex-service.ts`
- `electron/shared/opencodex.ts`
- `GET http://localhost:10100/api/request-history`

**适用范围**

所有需要跨天、跨周或大于 2000 条的 OpenCodex 使用记录查询。
