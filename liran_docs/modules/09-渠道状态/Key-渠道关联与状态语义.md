# Key-渠道关联与状态语义

## 2026-07-26 1.5.1 当前有效规则

- `group_id` 是唯一主关联键；`/channels/available` 缺少 `groups[].id` 时关系为 `partial`，不能使用渠道名称、模型、monitor ID 或取第一个渠道补齐。
- 统一 final resolver 返回一对多渠道和 `source`。自动关系完整时覆盖旧手动结果；自动关系部分、为空或请求失败时保留手动结果。
- 手动映射按 `siteId + groupId` 持久化，渠道页面支持多选、清除和恢复自动匹配；总览、渠道详情、重试和推荐复用同一最终渠道 ID 集合。
- 渠道健康最近 3 分钟只排除 `failed/error/down/unavailable`；`degraded/unknown/空状态` 在倍率稳定判定中按稳定处理。

上级：[[03-索引]]、[[_渠道状态]]
依赖：M06、M07、M10、M11、M14、M16
需求：RQ-26、RQ-27
状态：已完成；结构化关联、严格匹配语义、1.4.2 总览候选内唯一择优、状态语义和渠道去折算 UI 通过

## 关系与状态模型

关系先按 Key.groupId 定位 available channel，之后再把 channel 映射到 monitor。`group_id` 与 `monitor.id` 属于不同实体，禁止比较。当前有效规则只接受 `platforms[].groups[].id` 的精确相等；自动关系不完整时使用手动 `channelIds[]`，不再通过名称相似度或模型择优补齐。健康、同步、新鲜度和关联状态正交：remote failed/error/down/unavailable 才是不稳定，unknown/degraded/空状态在倍率稳定判定中允许稳定。

## 微观任务

- **CM-01 保留结构化 groupId**：目标是从 `/channels/available` 保留 channel/platform/groups(id/name)/models；输入为上游真实结构；文件为 adapter normalizer/contracts/tests；边界为 feature 关闭的空数组是 empty 而非必然 unsupported；RED 覆盖 group id 丢失、倍率 0、空数据；步骤为 fixture/schema/归一化；验证 adapter/contracts；完成条件是 Renderer 关系含 groupIds；依赖 AK-01；禁止只保存 groupNames。
- **CM-02 关系解析领域模型**：目标是输出 matched/unmatched/ambiguous 和 basis；输入为 key groupId、available relationships、monitors；文件为 channel-ranking.ts/tests；边界为先 groupId，再 channel 名称映射 monitor；RED 覆盖 ID 冲突、0/1/多关系；步骤为纯函数 TDD；验证 channel-ranking 测试；完成条件是结构化唯一关系稳定；依赖 CM-01；禁止比较 groupId 与 monitor.id。
- **CM-03 兼容回退评分**：目标是旧站缺 ID 时用规范化名称、平台、group_name、模型交叉确认；输入为缺失关系；文件为 channel-ranking/tests；边界为只接受唯一高置信结果并保留 basis；RED 覆盖相似短词、前后缀、平台冲突和模型歧义；步骤为证据评分与唯一差值测试；验证定向测试；完成条件是模糊结果不会静默匹配；依赖 CM-02；禁止 includes、删语义词或取第一个。
- **CM-04 正交状态契约**：目标是分别定义 health/sync/freshness/association；输入为 monitor 状态、HTTP 结果、checkedAt；文件为 contracts/channel types/tests；边界为 failed/error 仅来自远程健康枚举；RED 覆盖 refresh error+旧 normal、stale+normal、unmatched；步骤为 schema/呈现纯函数；验证 contracts/ranking；完成条件是九种用户文案不冲突；依赖 CM-02；禁止单枚举混合所有状态。
- **CM-05 渠道页面去倍率化**：目标是删除 ChannelsPage 的 BadgePercent、rate presentation 和徽标；输入为当前页面与 RQ-26；文件为 ChannelsPage、channels.css/tests；边界为保留关系排序、健康、延迟、可用率、时间线；RED 先断言无 `.channel-rate-badge` 和折算文本且健康字段存在；步骤为测试、删 props/计算/样式；验证 ChannelsPage 测试；完成条件是无空占位；依赖 CM-04；禁止删除 groups/rates 底层能力。
- **CM-06 渠道弹层去倍率化**：目标是删除 ChannelStatusPopover hero/列表倍率 props、图标和徽标；输入为弹层代码；文件为 ChannelStatusPopover、OverviewPage、overview.css/tests；边界为保留列表、详情、共享缓存、刷新；RED 为负向 DOM 断言；步骤为收窄 props、删局部 CSS；验证 Overview 测试；完成条件是弹层只表达健康信息；依赖 CM-04；禁止删除独立 RatePopover、RechargeRatioControl。
- **CM-07 关联渠道摘要语义**：目标是总览摘要展示关联、歧义、未关联、刷新失败和过期而不误报异常；输入为 CM-04 ViewModel；文件为 RateChannelSummary、Overview tests/CSS；边界为固定槽位不跳动；RED 覆盖九态和长名称；步骤为呈现函数与组件接线；验证 Overview/summary 测试；完成条件是只有 health failed 才显示异常；依赖 CM-04、OK-06；禁止用站点错误替代渠道状态。
- **CM-08 删除废弃倍率辅助逻辑**：目标是删除仅被渠道 UI 消费的 `formatRateLabel/groupRateForChannel/channelRatePresentation` 及测试；输入为调用方搜索；文件为 channel-ranking.ts/test；边界为保留 rate-comparison、RatePopover 和充值比例；RED 先用 rg 证明调用范围并补独立倍率回归；步骤为删死代码、修测试；验证相关 Vitest；完成条件是无渠道倍率引用且独立倍率测试通过；依赖 CM-05/06；禁止按名称误删 `BadgePercent` 的独立倍率用途。
- **CM-09 缓存与事件联动**：目标是 groupId/Key/monitor 变化后只失效相关关联；输入为 keys:changed、channel list revision；文件为 loader/App/coordinator/tests；边界为 siteId 分区、旧响应拒绝；RED 覆盖切组后旧渠道仍显示、局部失败；步骤为 revision key 与 invalidation 测试；验证 loader/App 测试；完成条件是关系和健康同步更新；依赖 AK-06、CM-02、CR-07；禁止全局清缓存造成请求风暴。
- **CM-10 真实形状与回归验收**：目标是用脱敏真实形状验证结构化关联、九态和去倍率 UI；输入为本地 HTTP fixture 与打包应用；文件为 adapter/ranking/E2E/真机文档；边界为 fixture 不含真实 key；RED 覆盖 channels empty、monitor empty、auth、429 和歧义；步骤为集成/E2E/截图/diff；验证全量测试与 macOS 真机；完成条件是页面和弹层无折算文本且状态真实；依赖 CM-01..09；禁止把历史截图当本轮证据。

## 逐任务验证命令

| 任务  | 可执行验证命令                                                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| CM-01 | `npm test -- --run electron/main/adapters/sub2api-adapter.test.ts electron/shared/contracts.test.ts`                              |
| CM-02 | `npm test -- --run src/renderer/shells/channels/channel-ranking.test.ts`                                                          |
| CM-03 | `npm test -- --run src/renderer/shells/channels/channel-ranking.test.ts`                                                          |
| CM-04 | `npm test -- --run electron/shared/contracts.test.ts src/renderer/shells/channels/channel-ranking.test.ts`                        |
| CM-05 | `npm test -- --run src/renderer/shells/channels/ChannelsPage.test.ts`                                                             |
| CM-06 | `npm test -- --run src/renderer/shells/overview/OverviewPage.test.ts`                                                             |
| CM-07 | `npm test -- --run src/renderer/shells/overview/OverviewPage.test.ts src/renderer/shells/channels/channel-ranking.test.ts`        |
| CM-08 | `npm test -- --run src/renderer/shells/channels/channel-ranking.test.ts src/renderer/shells/overview/rate-comparison.test.ts`     |
| CM-09 | `npm test -- --run src/renderer/shells/overview/rate-channel-status-loader.test.ts src/renderer/channel-load-coordinator.test.ts` |
| CM-10 | `npm run build && npm run test:e2e -- --grep "渠道状态                                                                            | 关联渠道 | 倍率"` |

## 删除白名单

允许删除的是渠道健康 UI 专用的折算 props、BadgePercent、`.channel-rate-badge*` 和对应辅助函数。禁止删除 `RatePopover.tsx`、`RechargeRatioControl.tsx`、`rate-comparison.ts`、倍率缓存、充值比例设置、`/groups/rates` 和总览独立“查看倍率”入口。
