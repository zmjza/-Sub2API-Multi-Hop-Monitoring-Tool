# sub2api API 文档

## 1.9.0 IPC 与读取约束

- 使用记录沿用 `usage:list` 的 `outputTokens`、`durationMs`，t/s 在 Renderer 纯函数派生，不新增上游接口，也不把输入/缓存 Token 纳入分子。
- 站点顺序通过受控设置/站点 IPC 读写规范化 ID 数组；负载拒绝未知字段、重复和非字符串 ID，服务端以真实站点集合再次对账。
- 站点元数据探测只由主进程对已规范化且已验证的站点地址发起：HTML 限制响应大小，title 做文本清理；favicon 仅允许同源重定向、受限大小和图片 MIME，失败回退 hostname/`Globe`。
- 悬浮窗手动刷新复用现有余额、Key 统计、usage 和渠道读取能力，必须使用请求世代或等价机制阻止旧站响应覆盖新站。
- 渠道列表与悬浮窗额度均采用每轮结束后随机 30–60 秒调度；Retry-After、认证停止和失败退避优先于普通随机周期。
- 不增加批量任务历史 IPC/数据库；设置拆页只复用现有 settings/notification IPC。

## 2026-08-04 1.7.2 交互错误响应与保存门禁

- `POST /api/v1/auth/login` 即使 HTTP 为 2xx，只要有限字段 `code` 或 `data.code` 属于 GeeTest/Turnstile 要求，客户端也返回 `INTERACTIVE_VERIFICATION_REQUIRED`，不执行 `loginResponseSchema` 成功保存。
- 站点保存前后均执行同地址同账号检查；数据库/安全存储异常不会通过 IPC 返回原始对象，服务层回滚该 `siteId` 的所有持久化和运行态数据。
- 渠道列表强制刷新失败不改变已缓存 `GET /channel-monitors` 结果；弹窗显示 stale 状态并允许用户重试，详情缓存按 `siteId:channelId` 继续隔离。

## 2026-08-03 1.7.1 官方挑战窗口兼容性

`sites:add-with-interactive-verification` 和 `sites:reverify` 仍只通过官方登录窗口取得交互会话。Turnstile 使用系统 Google Chrome 独立临时 Profile；GeeTest 使用临时 sandboxed Electron 窗口且保留原生浏览器标识，不做 UA/UA-CH 或 CDP iframe 伪装。主进程仅读取目标 origin 的有限 Token 白名单，核心接口校验通过后才原子写入凭据。Cloudflare challenge 域仍无法建立连接或服务端验证失败时，客户端保留结构化安全验证失败状态，不把它改写成普通站点地址错误，也不透传完整响应。

## 2026-08-03 1.7.0 交互登录与重新验证 IPC

| 方法/路径                                     | 用途                             | 安全与状态规则                                                                                  |
| --------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /api/v1/settings/public`                 | 读取公开 GeeTest/Turnstile 开关  | 仅解析 `geetest_enabled`、`turnstile_enabled` 等白名单字段；不透传完整设置                      |
| `POST /api/v1/auth/login`                     | 普通密码登录                     | 明确交互错误标准化为 `INTERACTIVE_VERIFICATION_REQUIRED`，保留真实 `httpStatus`，不透传私有响应 |
| `IPC sites:add-and-verify`                    | 首次检测、普通登录或返回验证要求 | 输入/输出使用 Zod；verification-required 只返回 provider                                        |
| `IPC sites:add-with-interactive-verification` | 官方窗口取 Token 后添加站点      | Token 只能在主进程经核心接口验证后保存                                                          |
| `IPC sites:reverify`                          | auth-required 站点主动重新验证   | 只更新原 `siteId`；失败不覆盖旧凭据；不创建新站点                                               |

交互窗口不是远程 API 代理：只允许官方同源登录页和必要验证码子资源，Renderer 不得到 Cookie、页面 HTML 或 Token。上游验证码错误码至少覆盖 `GEETEST_*`、`TURNSTILE_*` 和 `CLOUDFLARE_TURNSTILE_REQUIRED`；未知错误继续走通用安全错误。

## 2026-07-26 渠道关系与状态接口补充

| 方法与路径                                  | 用途                                      | 客户端规则                                                                                   |
| ------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| `GET /channels/available`                   | 返回 channel→platform→groups 的结构化关系 | 只信 `groups[].id` 与 Key `group_id` 精确相等；缺 ID 标记关系 `partial`，不得按名称猜测      |
| `GET /channel-monitors`                     | 返回渠道健康、时间线和摘要                | 只提供状态数据，不作为分组关系主数据源                                                       |
| `GET /channel-monitors/{channel_id}/status` | 返回单渠道模型详情                        | 详情请求必须使用统一最终关联的 `channelId`                                                   |
| IPC `channels:associations:get/set/clear`   | 读取、保存、清除站点分组手动渠道关联      | 数据键为 `siteId + groupId`，`groupId` 保留上游不透明字符串或数字，`channelIds[]` 支持一对多 |

推荐规则：1.9.0 起最近 1 分钟内仅 `failed/error/down/unavailable` 排除；其他状态和空状态按稳定处理。无关联渠道状态的候选进入独立价格池，不与有状态候选混合归一化。

## 2026-07-24 普通用户接口核对与验证

证据版本：GitHub `Wei-Shaw/sub2api` main 提交 `cb24522dd53f8f363d008e3afdc8e4baf9788cab`。公共前缀为 `/api/v1`，所有接口使用当前站点已有 Bearer Token。下列路径均为普通用户路由，不得替换为 `/admin/*`。

真实验证结论：`walkai.top` 与 `panel.hanhegufei.online` 已完成 Key 分页、分组、今日批量用量、30 天每日用量、单 Key 分组 PUT、GET 回读和原分组恢复。`ai.maok.shop` 的凭据 API 登录被 Turnstile 拒绝，仅通过用户已有浏览器会话只读确认 `/keys` 页面与脱敏 Key 能力；不得将其记录为 Electron 写入通过。

| 方法与路径                             | 用途              | 关键输入/输出                                                                                           | 规划结论                         |
| -------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `GET /keys`                            | Key 分页列表      | page/page_size/search/status/group_id/sort_by/sort_order；Key、group、并发、quota、时间                 | 齐全；适配器必须脱敏             |
| `GET /keys/{id}`                       | Key 详情/写后回读 | 当前用户所有权校验                                                                                      | 齐全                             |
| `PUT /keys/{id}`                       | 切换分组          | 仅发送 `{group_id:number}`                                                                              | 齐全；回读后才成功               |
| `GET /groups/available`                | 用户可绑定分组    | id/name/platform/rate_multiplier 等                                                                     | 齐全                             |
| `GET /groups/rates`                    | 用户专属倍率      | group_id 到 rate 的映射                                                                                 | 齐全；0 不得丢弃                 |
| `GET /channels/available`              | 用户可见渠道关系  | channel→platform→groups(id/name)→models                                                                 | 齐全；本地当前结构需保留 groupId |
| `GET /usage`                           | 使用记录          | 单 api_key_id/model/group_id/request_type/billing_type/billing_mode/start_date/end_date/period/timezone | 齐全                             |
| `GET /usage/stats`                     | 同筛选汇总        | 与列表相同筛选；total_requests/total_tokens/total_actual_cost/average_duration_ms                       | 齐全；只支持单 Key ID            |
| `POST /usage/dashboard/api-keys-usage` | Key 批量消费      | `api_key_ids`，最多 100；today/total actual cost                                                        | 齐全；不含请求、Token、耗时      |
| `GET /user/api-keys/{id}/usage/daily`  | 单 Key 每日用量   | days 1..90、timezone；每日 actual_cost                                                                  | 齐全；近30天需逐 Key 汇总        |
| `GET /channel-monitors`                | 用户渠道监控概览  | items、状态、延迟、可用率、timeline                                                                     | 齐全；读取服务端已有监控结果     |
| `GET /channel-monitors/{id}/status`    | 单监控详情        | 模型与 7/15/30 日统计                                                                                   | 齐全；按需请求                   |
| `GET /user/profile`                    | 用户账号余额      | balance                                                                                                 | 齐全；仅账号级，不是分组余额     |

### 明确缺口

1. 没有跨站统一汇总接口；Electron 必须逐站受控聚合。
2. `/usage/stats` 没有多个 `api_key_id` 参数；除批量消费外，请求、Token 和耗时必须逐 Key 查询。
3. 没有 Key 直接关联 monitor ID；必须通过 groupId 和 `/channels/available` 桥接。
4. 没有普通用户主动触发渠道探测接口；客户端轮询只读取服务端已有结果，实时程度受服务端监控周期约束。
5. `/user/profile` 余额不会随 Key/分组筛选变化；“所选 Key 可用额度”按确认公式计算，不能声称是上游分组余额。

### 安全响应规则

`GET /keys` 和详情可能包含完整 `key`。适配器必须在最内层将其转换为固定短摘要，随后丢弃原字符串；任何上游响应透传、`unknown` IPC 返回、JSON 日志或测试夹具保存完整 key 都属于验收失败。错误只保留状态类别和脱敏短消息。

### 固定提交源码证据位置

- `backend/internal/server/routes/user.go`：普通用户 `/keys`、`/groups`、`/channels`、`/usage`、`/user/api-keys/:id/usage/daily` 与 `/channel-monitors` 路由。
- `backend/internal/handler/api_key_handler.go`：Key 分页筛选和 `sort_by/sort_order`、所有权校验、更新 DTO、可绑定分组与用户专属倍率。
- `backend/internal/handler/usage_handler.go`：list/stats 共用筛选解析、100 个 ID 批量上限、每日用量 1–90 天与 timezone。
- `backend/internal/handler/available_channel_handler.go`：`platforms[].groups[].id/name`、平台和模型白名单，以及功能关闭时空数组语义。
- `backend/internal/handler/channel_monitor_user_handler.go`：概览 items、详情 models、状态、延迟、可用率和 timeline。
- `backend/internal/service/usage_log.go`、`channel.go`、`usage_service.go`：请求类型、计费类型、计费模式和 stats/daily/batch 输出字段。

上级：[[02-架构文档]]、[[01-需求文档]]
下级：[[modules/05-认证与Token生命周期]]、[[modules/06-API适配器与能力探测]]
依赖：上游 `Wei-Shaw/sub2api` 源码

## 证据口径

- `上游源码已确认`：2026-07-23 固定复核上游 `Wei-Shaw/sub2api` main 提交 `cb24522dd53f8f363d008e3afdc8e4baf9788cab` 的路由、handler 和 service 后确认。
- `真实二开站待验证`：尚未通过真实站点或当前响应证据验证的字段/能力。
- 二开站可能修改前缀、字段或能力，适配器必须进行运行时验证。

## 在线更新接口（已实现，非 sub2api 上游接口）

| 能力     | 方向/入口                           | 主要输入                                              | 标准化输出                                                                   | 当前证据                      |
| -------- | ----------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------- |
| 检查更新 | 主进程 -> 固定 Gitee HTTPS manifest | 当前版本、平台、架构、稳定通道                        | `UpdateCheckResult`：无更新/可更新/不支持/错误，含版本、说明、资源和校验信息 | Gitee Release 760145 真实验证 |
| 下载更新 | 主进程内部                          | 已校验的 manifest 资产                                | 下载进度、完成路径、SHA-256 错误                                             | macOS 远程下载真实验证        |
| 安装更新 | 主进程内部                          | 已完成且校验通过的本地包                              | Windows 启动 NSIS 并重启；macOS 打开 DMG 进入手动替换状态                    | macOS 本机真实验证            |
| 更新 IPC | Renderer <-> preload <-> 主进程     | `check`、`download`、`install`、`skip`、`remindLater` | 类型化结果与事件，禁止任意 URL/路径                                          | 自动化与 E2E 已实现           |

更新元数据最少需要版本、发布日期、平台、架构、下载地址、SHA-256、更新说明和测试版本标记；不得包含站点凭据、Token 或可执行脚本。正式实现前需要以实际 Gitee Release 资产验证字段和 URL，不得把本表当作已存在的公共 API。

默认 API 基址：`<siteBaseUrl>/api/v1`，实际保存前需探测。
鉴权：`Authorization: Bearer <access_token>`。不得把 Token 写入日志。

## 接口清单

| 能力           | 方法与路径                                                                         | 主要输入                                                                                                                       | 标准化输出                                          | 证据                                             |
| -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------ |
| 登录           | `POST /auth/login`                                                                 | 账号/邮箱、密码；具体字段按公开设置与实际响应适配                                                                              | accessToken, refreshToken?, expiresIn, user         | 上游源码已确认；两个真实二开站已验证             |
| Token 刷新     | `POST /auth/refresh`                                                               | refresh_token                                                                                                                  | 新 access/refresh token 与过期时间                  | 上游源码已确认；真实二开站待验证                 |
| 当前用户       | `GET /auth/me`                                                                     | Bearer                                                                                                                         | 当前认证主体                                        | 上游源码已确认；真实二开站待验证                 |
| 用户资料/余额  | `GET /user/profile`                                                                | Bearer                                                                                                                         | UserProfile，包括 balance                           | 上游源码已确认；两个真实二开站已验证             |
| Key 列表       | `GET /keys`                                                                        | page, page_size, search, status, group_id, sort_by, sort_order                                                                 | Paginated<ApiKeySummary>                            | 上游源码已确认；两个真实二开站已验证             |
| 可用分组       | `GET /groups/available`                                                            | Bearer                                                                                                                         | Group[]，含默认倍率                                 | 上游源码已确认；两个真实二开站已验证             |
| 专属倍率       | `GET /groups/rates`                                                                | Bearer                                                                                                                         | groupId -> customRate                               | 上游源码已确认；两个真实二开站已验证             |
| 今日统计       | `GET /usage/stats`                                                                 | period=today, timezone, api_key_id? 等                                                                                         | UsageToday                                          | 上游源码已确认；两个真实二开站已验证             |
| 使用记录       | `GET /usage`                                                                       | page, page_size, start_date, end_date, period, timezone, api_key_id, model, group_id, request_type, billing_type, billing_mode | Paginated<UsageRecord>                              | 上游源码已确认；两个真实二开站已验证             |
| 模型筛选       | `GET /usage/dashboard/models`                                                      | Bearer；按站点当前会话                                                                                                         | 使用记录可选模型字符串列表                          | 上游源码已确认；真实二开站只读验证纳入本轮       |
| Dashboard 快照 | `GET /usage/dashboard/stats`                                                       | Bearer                                                                                                                         | 用户累计/今日聚合                                   | 上游源码已确认；是否使用待实现评估               |
| 可用渠道       | `GET /channels/available`                                                          | Bearer                                                                                                                         | 渠道、平台、分组、模型与定价                        | 上游源码已确认；真实二开站待验证                 |
| 渠道监控列表   | `GET /channel-monitors`                                                            | Bearer                                                                                                                         | MonitorList                                         | 上游源码已确认；两个真实二开站已验证 supported   |
| 渠道监控详情   | `GET /channel-monitors/{id}/status`                                                | id                                                                                                                             | 站点实际返回基础渠道详情；可用率/延迟字段按能力适配 | 两个真实二开站已验证 supported；本次仅见基础字段 |
| Radar 站点列表 | 本地 IPC `radar:list`、`radar:create`、`radar:delete`、`radar:open`、`radar:close` | 主进程校验发送者、ID、名称、HTTPS URL、重复项和 50 项上限；打开只发送 ID                                                       | `{ id, label, url }[]` 与嵌入生命周期状态           | 1.9.3 自动化与 macOS 真机流程已验证              |

## 今日统计字段

`total_requests`、`total_input_tokens`、`total_output_tokens`、`total_cache_tokens`、`total_cache_read_tokens`、`total_cache_creation_tokens`、`total_tokens`、`total_cost`、`total_actual_cost`、`average_duration_ms`。

`period=today` 时后端会结合 `timezone` 计算当天开始时间。应用必须传本机 IANA 时区。

## Key、倍率与使用记录字段

- `GET /keys` 的可信倍率路径为 `data.items[].group.rate_multiplier`，Key 摘要还可读取 `group.name`、Key 状态、当前并发和分组 RPM 等非敏感字段；完整 `key` 必须在适配层立即丢弃。
- `GET /groups/rates` 只代表当前用户的专属倍率覆盖，不是所有分组默认倍率。有效倍率顺序为：用户专属倍率 > 当前 Key 内嵌 `group.rate_multiplier` > `/groups/available` 对应分组默认倍率 > 不可用。
- 数值 `0` 是有效倍率，不得用 truthy 判断误判为缺失。
- `GET /usage` 单条记录的 `reasoning_effort` 映射到 `reasoningEffort`；缺失时 UI 显示 `—`。
- 使用记录固定请求 `page_size=20`；模型选项来自 `/usage/dashboard/models`，分组和 Key 选项分别来自已确认的分组与 Key 只读接口。

## 渠道监控字段

列表标准化字段：`id`、`name`、`provider`、`groupName`、`primaryModel`、`primaryStatus`、`primaryLatencyMs`、`primaryPingLatencyMs`、`availability7d`、`extraModels`、`timeline`。

详情标准化字段：每模型 `latestStatus`、`latestLatencyMs`、`availability7d/15d/30d`、`avgLatency7dMs`。

Key 与渠道监控关联口径：`/keys` 的 `group_id/group.id` 不能与监控 `id` 直接比较。新主链为 `Key.group_id → /groups/available → /channels/available 中的分组 ID → 渠道 → monitor`，本地关系对象必须保留 groupId。标准化渠道名、平台、`monitor.group_name` 和模型只用于交叉确认；模糊兼容只接受唯一高置信结果，零个或多个结果保持未关联/关联不明确。历史名称精确匹配优先方案已被此口径取代。

2026-07-14 两个真实站点的详情端点均返回 supported，但本次脱敏字段盘点只确认 `id`、`name`、`provider`、`group_name`、`models`。7/15/30 日可用率、Ping、平均延迟和时间线属于上游源码已确认、当前两个真实响应未出现的字段；UI 必须显示“待查询/不可用”，不得用静态样例冒充。

## 错误标准化

适配层至少统一：

- `INVALID_URL`
- `NETWORK_TIMEOUT`
- `TLS_ERROR`
- `AUTH_INVALID_CREDENTIALS`
- `AUTH_REQUIRED`
- `ACCOUNT_DISABLED`
- `RATE_LIMITED`
- `API_PREFIX_NOT_FOUND`
- `UNSUPPORTED_CAPABILITY`
- `INCOMPATIBLE_RESPONSE`
- `SERVER_ERROR`
- `CANCELLED`

错误对象只保留安全摘要、HTTP 状态、能力名、可重试性和时间，不保留密码、Token、完整响应头或可能含敏感内容的原始响应。

## API 前缀探测

实现阶段应优先探测公开设置或已知安全端点；候选前缀必须是有限白名单，不允许对任意路径进行扫描。探测成功后持久化，失败时报告 `API_PREFIX_NOT_FOUND`。

## 已完成的真实二开站真机只读验证（2026-07-14）

使用用户在当前会话提供的凭据重新登录，未复用其粘贴的历史 Token、Cookie 或 Cloudflare clearance；输出和文档不保存凭据。

| 站点                              | 登录 | profile/余额                                   | keys         | usage/stats                         | channel-monitors | 证据                                                                        |
| --------------------------------- | ---- | ---------------------------------------------- | ------------ | ----------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `https://ai.maok.shop`            | 成功 | 成功；覆盖动态标题的高余额分支，不记录固定快照 | 成功，仅摘要 | 成功，今日请求/Token/费用字段可映射 | 返回 supported   | 最终打包应用、`real-test-evidence/macos-2026-07-14/README.md`；敏感值未落盘 |
| `https://panel.hanhegufei.online` | 成功 | 成功；覆盖动态标题的低余额分支，不记录固定快照 | 成功，仅摘要 | 成功，今日请求/Token/费用字段可映射 | 返回 supported   | 同上；运行时验证结果不作为固定数值断言                                      |

真实验证仅覆盖只读接口；Key 完整值、密码、Token、Cookie、请求头和原始响应未记录。渠道返回 supported 只表示列表请求未被拒绝，7/15/30 日详情字段仍需后续字段级验证。

## 待真实验证

- 二开站登录请求字段是否统一为 email/password。
- 是否所有目标站启用 refresh token。
- 二开站对 `timezone`、排序字段和筛选枚举的兼容性。
- 渠道监控是否开放给普通用户。
- 各站错误响应结构和速率限制口径。

## 本轮实现与真机证据（2026-07-14）

- `GET /api/v1/channel-monitors/{id}/status` 已加入适配器和受控 IPC；真实站点详情能力仍需按运行时响应区分 supported、unsupported 或 error。
- 使用记录 CSV 由主进程按当前查询生成，前端只接收导出结果；完整 API Key、Token、密码不进入导出。
- 登录 refresh 失败后会尝试使用安全凭据重新登录，只有新登录及核心读取成功后才替换旧会话。
- 两个真实站点的登录、profile、Key、倍率、今日统计、usage 和渠道列表/详情只读验证已在最终打包应用中成功；具体实时数值不作为固定 API 断言。

## 2026-07-18 外发版合并待验证接口与字段

以下是 1.1.0 功能合并记录，相关实现、自动化和验收证据已完成：

## 1.2.0 API 增量

- `/usage` 安全白名单新增 `first_token_ms -> firstTokenMs`，继续保留 `duration_ms -> durationMs`。
- `/keys` 首次请求保持兼容，若响应包含分页元数据则按页继续读取；只向 Renderer 返回脱敏 Key、分组、quota 和 quotaUsed。
- 新增本地 IPC `sites:note:set`，输入经过 `siteNoteSchema` 校验，只更新本地备注，不向站点发请求。

- `/channels/available`：历史适配器仅保留 `name`、`platforms[].platform`、`groups[].name`、`supported_models[].name`；后续必须同时保留可验证的 `groups[].id`，以 groupId 建立结构化关系。请求失败或字段不完整时降级为未关联/关联不明确，不按名称猜测。
- `/usage`：保留 `reasoning_effort`、`cache_creation_tokens`、`duration_ms` 及今日汇总对应的缓存创建 Token/平均耗时；所有字段必须在适配器和 Zod 共享契约中显式允许。
- Radar 不再使用 `current.json`。站点列表持久化到本地 SQLite `settings` 表，Renderer 只通过受控 IPC 按 ID 打开；主进程按当前条目 HTTPS origin 建立 `WebContentsView` 白名单，新窗口拒绝和视图生命周期由主进程负责，不进入 sub2api 认证、Token、业务数据库或 CSV 流程。
- 朋友版新增的任何字段若无法从真实上游源码或当前响应证实，必须标记“信息不全，待人工补充”，不得写入 API 合同或伪造默认值。
- refresh 失败后的密码重登由本地 HTTP 集成测试覆盖；不得主动破坏真实站点 Token 来制造失败。

## 1.2.1 IPC 与加载增量

- `sites:refresh-all`：主窗口总览触发全部站点调度刷新；当前站点优先、受控并发、同批去重、单站失败隔离。
- `keys:contexts`：一次返回按 site ID 分组的脱敏 Key 摘要与偏好，不包含完整 Key。

### 1.4.3 API 密钥管理页补充

- `api-keys:list` 返回当前管理页短期使用的完整 Key 字段时，只允许在当前 Renderer 会话内存中显示，不得写入缓存、数据库或日志。
- `api-keys:copy` 在 IPC 边界校验 `siteId/keyId`，主进程重新读取 Key 详情并调用 Electron `clipboard.writeText`；Renderer 不直接访问系统剪贴板。
- 复制接口不返回完整 Key 文本，只返回 `{ copied: true }`；复制失败使用普通错误码。
- `keys:changed`：站点级 Key context 更新事件；Renderer 仅重载对应 site ID，旧异步结果不得覆盖其他站点。
- `usage:groups`：按 site ID 独立读取 `/groups/available` 并返回使用记录分组选项，不等待模型接口。
- `usage:models`：按 site ID 独立读取 `/usage/dashboard/models` 并返回模型选项；失败或延迟不得清空已成功的分组和 Key。
- `sites:floating:set`：接受四角预设或经 schema 校验的 custom x/y；主进程负责显示器工作区校正与原生窗口移动。
- `/keys` 结果标准化后立即发布安全摘要，groups、models、rates 和 usage 可分别随后补齐；不得等待逐 Key 今日统计或任一慢筛选接口才显示其他下拉数据。

## 1.3.0 倍率查询与 IPC

- `GET /groups/available?timezone=<IANA>`：单站倍率列表的独立只读来源，不依赖 Key、余额或全站刷新；只标准化 `id/name/description/platform/status/rate_multiplier` 等明确白名单字段。
- `rates:contexts`：返回各站缓存倍率、状态、抓取时间和充值比例；缓存优先显示。
- `rates:refresh`：按 site ID 刷新一个站点倍率，同站并发请求复用；不调用 `/keys`。
- `rates:refresh-all`：最多 3 个站点并发，单站失败隔离并保留旧缓存。
- `rates:ratio:set`：只更新本地正数充值比例，不发网络请求。
- 2026-07-19 三站只读结果：walkai 18 个分组/4 个平台，maok 8 个分组/2 个平台，hanhegufei 21 个分组/4 个平台；未记录原始响应、账号、Token、Cookie 或完整 Key。

## 1.3.1 接口复用与请求边界

- 倍率稳定性与快捷渠道弹窗继续复用 `channels:list` 和 `channels:status`，没有新增后端接口或放宽共享契约；列表摘要用于全部渠道卡和分组唯一匹配，详情只在弹窗打开后读取。
- 弹窗未打开时不会因倍率、站点或全站刷新触发渠道 IPC；页面会话缓存命中时关闭重开不再次请求，主动重试绕过缓存。
- 悬浮窗复用本地 `usage:list`，每站传入 `{ period:'30d', page:1, pageSize:1, sort:'desc' }`；其中 `sort` 是应用内部查询字段，不是上游 `GET /usage` 参数。该流程只读取标准化 `createdAt` 比较站点，不保存记录内容或新增持久化字段。
- 2026-07-19 三站只读复测：walkai 18 个倍率分组、maok 8 个、hanhegufei 22 个；三站 usage list、channel list 和 channel detail 均返回 supported。

## 2026-08-09 2.0.0 本地 IPC 增量

- `sub2api-servers:list`：返回当前服务器数组，无默认项。
- `sub2api-servers:create/update`：输入经共享 Zod schema 校验，返回更新后的完整数组；更新时主进程自行判断 origin 变化并清理旧 partition。
- `sub2api-servers:delete`：先关闭当前视图并清理该服务器 partition 的全部站点数据，再删除条目。
- `sub2api-servers:open`：发送不透明 ID，主进程读取持久化 URL 并挂载 `WebContentsView`。
- `sub2api-servers:close/back/forward/reload/home/clear-session`：只接受当前打开状态操作；`clear-session` 清理 partition 后重新加载首页并重置登录状态。
- `sub2api-servers:state`：主进程广播 `{ status, target?, url?, canGoBack?, canGoForward?, loading?, loginState? }` 给主窗口。
- `sub2api-servers:open-shortcut`：Renderer 发送服务器 ID 与快捷入口 ID，主进程读取持久化相对路径并解析为当前服务器 HTTPS origin，再打开内嵌网页；禁止跨域、危险协议和用户名密码 URL。
- 2.1.2 起不再提供 `list-menus/discover-menus`；快捷入口菜单来自本地 `SUB2API_STANDARD_MENUS`，不读取 Cookie、Token、localStorage/sessionStorage、完整 HTML、DOM 或私有接口响应。
- 旧 `sub2api-servers:menus:<serverId>` 缓存键只在删除服务器、清除会话或 origin 变更时按服务器清理，应用启动和编辑弹窗均不读取。
- 站点 favicon 不新增上游请求能力；所有抓取使用安全同源 HTML/icon 读取，限制 8 秒超时、3 次重定向、256KB HTML、128KB 图片与图片 MIME。
- 无渠道推荐过滤是纯 Renderer 评分规则，不新增 IPC；时间线排序/20 格/余额口径与菜单映射均属于本地展示与通知逻辑。
