# REQ-260920 渠道状态、使用记录与缓存率告警 · 评分记录

## 评分状态

- 任务 ID：REQ-260920-channel-usage-cache-alert
- 评分阶段：正式 PRD 转换后、源码修改前
- 评分日期：2026-09-20
- 总分：83/100
- 流程等级：深度流程
- 最终流程：深度流程
- 评分分段：70–89 为深度流程
- 源码状态：尚未修改；当前只新增本任务文档和活动索引。
- 评分证据：已核对 V2 adapter、SiteService、使用记录初始化和查询协调链路、共享最近统计、后台刷新、通知服务、设置、持久化状态及跨平台发布规则。
- 范围上限：修复和扩展现有模块；不新增数据库表、通用规则引擎、第二套轮询架构或新的通知渠道。
- 安全门禁：涉及复杂多模块跨层改造、后台持久化告警状态和系统通知，最低进入深度流程。
- 项目级完整条件：未命中新项目、整体架构重构、大规模数据迁移、技术栈迁移或三个以上独立新模块，因此不进入完整流程。
- UI 判断：只修改现有使用记录指标卡，不新增设置项或独立 UI 壳；开发阶段需要页面样式检查。
- 目标节奏：用户明确跳过独立 UI 目标，采用深度两阶段：documentation 1/2 → development-and-acceptance 2/2；验收责任为 Codex 真机测试，页面样式检查为是，页面调整沿用当前视觉方案。
- 评分性质：修改前基线；实现完成后必须根据真实 diff、调用方、测试和真机证据重新评分。

## 五维评分

项目现状：16/20
修改规模：17/20
依赖与修改后影响：17/20
风险与回滚：16/20
验证复杂度：17/20
总分：83/100

| 维度             |       分数 | 证据                                                                                                     |
| ---------------- | ---------: | -------------------------------------------------------------------------------------------------------- |
| 项目现状         |      16/20 | 项目已有 V1/V2、使用记录、后台刷新、通知和持久化基础，但活动历史较多，必须避免旧任务与当前状态互相污染。 |
| 修改规模         |      17/20 | 同时涉及 V2 数据适配、Renderer 初始化、共享统计、后台告警、设置和跨平台通知，跨主进程与 Renderer。       |
| 依赖与修改后影响 |      17/20 | 渠道状态有多个展示入口；最近统计同时服务页面和告警；通知状态需与刷新调度、删除、恢复、退出和设置联动。   |
| 风险与回滚       |      16/20 | 错误适配会误报渠道异常，错误告警会造成通知轰炸；可通过独立事件指纹、持久化状态和小范围模块回滚。         |
| 验证复杂度       |      17/20 | 需要真实 V2 站点对照、并发/迟到请求、30 样本边界、持久化去重、macOS 系统通知和 Windows 构建证据。        |
| **总分**         | **83/100** | **进入深度流程。**                                                                                       |

## 评分证据明细

### 1. V2 渠道状态链路

- `electron/main/adapters/channel-monitor-v2.ts` 负责 V2 请求和快照适配。
- `electron/main/adapters/sub2api-adapter.ts` 与 `electron/main/services/site-service.ts` 参与协议选择、回退和站点数据输出。
- `src/renderer/shells/channels/ChannelStatusCard.tsx` 消费状态、指标和时间线。
- 官方截图请求参数与桌面端本机时区存在差异，但最终根因尚需真实脱敏响应确认，因此修复风险不能按单行参数修改估算。

### 2. 使用记录首次加载链路

- `src/renderer/App.tsx` 进入使用记录 Shell 时会清空旧数据。
- `src/renderer/shells/usage/UsagePage.tsx` 的首次查询依赖延时调度，切换 API Key 会主动触发查询，存在初始化竞态证据。
- `usage-query-controller.ts` 与 `usage-load-coordinator.ts` 已提供查询构造和旧请求隔离基础，修复应集中复用，避免多个入口分别打补丁。

### 3. 最近 30 次统计链路

- `electron/shared/recent-averages.ts` 可承载共享有效样本规则。
- `electron/main/services/site-service.ts`、`UsagePage.tsx`、`OpenCodexUsagePage.tsx` 与 `opencodex-data.ts` 分别处理主进程数据和两个页面模式。
- 当前分页为 20 条，必须提供独立最近 30 条数据来源或统计结果，不能只改卡片文案。

### 4. 后台告警与持久化链路

- `electron/main/services/notification-service.ts` 和 `electron/main/domain/notifications.ts` 是现有通知能力。
- `electron/main/services/refresh-scheduler.ts` 是后台刷新入口，应复用而非新增页面轮询。
- `electron/main/storage/database.ts` 已有 `notification_states`，可扩展事件类型，不需新表。
- `electron/main/index.ts`、`electron/shared/contracts.ts` 和现有通知状态存储负责生命周期、契约和自动运行；本任务不新增设置开关。

## 流程判断

- 进入深度流程：任务横跨协议适配、共享统计、主进程后台调度、持久化事件状态、跨平台原生通知和现有页面。
- 不降为标准流程：通知去重、恢复重布防、可取消两连定时器和真实 V2 站点对照形成复杂跨层行为。
- 不升为完整流程：没有新架构、数据库迁移、技术栈迁移或三个以上独立产品模块；主要复用现有服务和页面。
- 可能升档：若真实 V2 站点证明现有协议模型无法表达上游数据，需要公共协议重构或数据库迁移时，必须重新评分并暂停当前执行范围。

## 回滚边界

- V2 修复应限制在共享归一化和快照一致性入口，保留 V1 路径。
- 最近 30 次统计应由共享纯函数控制，可独立回滚指标卡变更。
- 缓存率告警使用独立事件指纹，不影响余额通知。
- 不通过删除用户数据或清空全部通知状态实现回滚。

## 修改后评分占位

- 状态：待实现完成后补充。
- 必须依据：真实 diff、重新扫描的调用方、自动化结果、macOS 真机通知、V2 真实站点对照、Windows 构建证据和发布结果。

## 评分依据文件

- `liran_docs/requirements/REQ-260920-channel-usage-cache-alert-需求整理.md`
- `liran_docs/requirements/REQ-260920-channel-usage-cache-alert-PRD.md`
- `electron/main/adapters/channel-monitor-v2.ts`
- `electron/main/adapters/sub2api-adapter.ts`
- `electron/main/services/site-service.ts`
- `electron/shared/recent-averages.ts`
- `electron/main/services/notification-service.ts`
- `electron/main/services/refresh-scheduler.ts`
- `electron/main/storage/database.ts`
- `electron/shared/contracts.ts`
- `src/renderer/App.tsx`
- `src/renderer/shells/usage/UsagePage.tsx`
- `src/renderer/shells/usage/OpenCodexUsagePage.tsx`
- `src/renderer/shells/settings/SettingsPages.tsx`
