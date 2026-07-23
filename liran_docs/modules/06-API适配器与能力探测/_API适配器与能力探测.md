# API 适配器与能力探测

## 2026-07-23 规划影响

- `/keys` 必须从第一页开始使用固定 page_size；现有第一页默认 10、后续 100 的策略可能产生分页偏移，列入 AK-02 修复。
- 新增 GET 单 Key、PUT 最小分组负载、POST 批量消费、GET 每日消费和过滤 stats；当前 HTTP 客户端只有 GET 能力，POST/PUT 必须以固定路径、固定 JSON 和安全错误模型扩展，不能提供任意请求接口。
- 上游 `request_type` 为 `unknown/sync/stream/ws_v2/cyber`，`billing_type` 为数值 0 钱包或 1 订阅，`billing_mode` 为 `token/per_request/image/video`。当前页面的 chat/embedding、token 字符串 billing type、standard billing mode 都是待替换旧值。
- `/channels/available` 必须保留 groups[].id；空数组可能是功能关闭或无可见渠道，不能单凭空数组伪造 unsupported。
- HttpClient 当前不保留 Retry-After；后续只能提取并校验安全的 retryAfter 时间，不透传完整响应头。
- 上游缺口：无跨站汇总、无 Key 直连 monitor ID、无普通用户 run-now。管理员 run 接口禁止调用。

> 2026-07-14 当前证据：有限多层 `data` 解包、Zod 边界、错误分类、核心/可选能力、模型/分组筛选和倍率来源优先级已落地。两个获授权站点已通过只读脚本与服务层复测，macOS 打包应用的本地完整业务流 E2E 已通过。

上级：[[03-索引]]
下级：基址探测、标准客户端、能力矩阵、错误标准化
依赖：[[05-认证与Token生命周期]]、[[07-API文档]]

## 职责

以有限白名单探测 API 前缀，将二开站响应标准化，并独立记录能力。覆盖 RQ-16 及所有远程数据需求。

## 叶子能力

适配层拆为安全基址探测、标准客户端和能力矩阵三个稳定边界。

### 基址探测

- 对规范化站点 URL 尝试有限候选前缀；不得任意扫描路径。
- 成功后持久化；变更时允许用户重新测试。

### 标准客户端

- 统一超时、取消、Bearer、时区、语言、安全 User-Agent 和错误解析。
- 不伪装官方浏览器，不绕过限流。

### 能力矩阵

- 核心：login、profile、keys、availableGroups、usageStats、usageList。
- 可选：refresh、groupRates、usageModels、channelMonitors、channelStatus。
- 能力缺失只局部降级；结构不兼容记录证据摘要。

## 验收

- 标准站、前缀变化、字段缺失、HTML 错误页、404 可选能力、超时和取消均有契约测试。

## 当前实现证据

已实现有限 URL 规范化、JSON HTTP 客户端、登录响应 Zod 校验、嵌套 `data` 解包、profile、keys、groups/available、groups/rates、usage stats、usage list、usage/dashboard/models 和渠道监控适配。2026-07-23 的本轮规划以 `Wei-Shaw/sub2api` main 提交 `cb24522dd53f8f363d008e3afdc8e4baf9788cab` 为固定上游证据；既有获授权站点只读验证仅证明历史核心能力，不代表 RQ-22..27 已实现。未返回的渠道扩展指标继续显示“待查询”，不得用静态值补齐。

## 任务范围

TASK-04-01 至 TASK-04-05。

## 2026-07-18 外发版合并增量（内部测试通过；真实站点复测待执行）

本轮两个真实站点只读复测成功：登录、core、usage list/filter、channels 和 channel detail 均已取得脱敏能力结论；证据来自 `scripts/verify-real-sites.mjs` 的当前轮命令输出，凭据未写入文件。

- 新增可选 `/channels/available` 读取，仅归一化渠道名、平台、分组名和模型名关系；请求失败或字段不完整时能力状态为 `unsupported`/`unknown`，不得阻塞核心站点保存。
- usage 归一化补齐 `reasoning_effort`、`cache_creation_tokens`、`duration_ms` 和平均耗时，并在共享契约中保留可选字段边界。
- 关系解析必须丢弃完整 Key、Token、密码和原始响应；多候选关系返回未确定，由 Renderer 保持稳定原顺序。
- 新增契约、适配器和兼容二开响应测试；真实站点只读复测留到第二次 `/goal` 和 macOS 真机阶段。

对应规划任务：MERGE-02、MERGE-05。
