# 渠道状态 UI 壳接入清单

## 2026-08-05 1.7.9 实时状态与 stale 回退复核

- 手动选择的渠道、关联关系、列表和详情在后台强刷失败时继续显示，错误以弹窗内 stale 状态和局部重试表达，不依赖重新点击查看渠道状态恢复。
- 自动轮询和用户主动刷新共用同一缓存世代；成功响应才替换数据，失败不清空布局，窄窗口保持固定槽位和无重叠。

## 2026-08-04 1.7.2 强刷失败回退（已实现，待打包复核）

- 强制刷新失败继续展示最近一次成功列表、手动选择和详情；弹窗增加轻量 stale 提示及图标重试按钮，不依赖重新打开弹窗恢复。
- 选中渠道通过稳定引用参与强刷恢复，避免父状态更新触发自动加载循环；刷新按钮在请求期间禁用并显示旋转状态。

## 2026-08-03 1.7.0 持续显示修复（已接入，待 macOS 两周期复核）

- 手动选择的渠道、关联关系和最近一次成功摘要在后台轮询失败时继续展示；刷新态只更新状态栏，不清空卡片。首次无缓存失败才展示完整错误。
- 列表失败不清空详情缓存，详情失败只影响当前 `siteId:channelId`；旧响应按请求世代丢弃，重新打开弹层不再是恢复旧数据的必要条件。
- 后台轮询失败不弹全局短暂通知；用户点击刷新/重试仍复用共享通知 Provider，保持原有浅色、8px 圆角、窄窗口无重叠视觉。

## 2026-07-23 低频实时监控、结构化关联与去倍率增量

本增量保留现有渠道列表/详情布局，只在主窗口相关页面可见时启用轮询；悬浮窗、隐藏、最小化或后台暂停。默认 `60s`，用户可选 `30/60/120s` 且不得低于 `30s`；恢复可见且缓存超过 `30s` 时立即刷新。定时只读取 `/channel-monitors` 概览，详情 `/channel-monitors/{id}/status` 仅为当前查看或已关联渠道按需读取。刷新保留旧数据，并显示最后更新时间、倒计时、暂停/退避/刷新中。

关联优先链为 `Key.group_id → /groups/available → /channels/available 分组 ID → 渠道 → monitor`，本地关系必须保留 groupId；名称、平台、`monitor.group_name` 和模型只用于交叉确认，模糊匹配只接受唯一高置信结果。九态为正常、降级、异常、未知、数据过期、刷新失败、未关联、关联不明确和不支持；只有远程明确失败才显示异常。

### 逐文件接入计划

| 文件                                                                                                                                                                                                                                               | 计划修改                                                                                    | 接口、状态与事件入口                                                         | 边界与失败测试                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/renderer/shells/channels/ChannelsPage.tsx`                                                                                                                                                                                                    | 接入轮询反馈和间隔选择；删除 BadgePercent、倍率徽标、倍率不可用/折算文案、tooltip/占位      | visibility、countdown、lastUpdated、refreshing、backoff、九态                | hidden/minimized 不请求；刷新保留卡片；DOM 无渠道倍率展示                  |
| `src/renderer/shells/channels/types.ts`                                                                                                                                                                                                            | 增加 monitor freshness、backoff、relation groupId 和九态联合；删除仅供渠道折算的 view props | 只接受主进程归一化状态                                                       | unknown/refresh-failed 不得映射 failed；关系对象不能丢 groupId             |
| `src/renderer/shells/channels/channels.css`                                                                                                                                                                                                        | 删除 `.channel-rate-badge*` 与无用占位，稳定实时反馈栏                                      | 局部状态标签、倒计时和旧数据视觉                                             | 删除后卡片高度不塌陷；长状态不重叠                                         |
| `src/renderer/shells/overview/ChannelStatusPopover.tsx` 及总览局部样式                                                                                                                                                                             | 同步删除快捷弹层倍率呈现；按关联结果加载详情                                                | open/close、linked monitor demand、refresh                                   | 关闭后不继续详情轮询；不得删除独立倍率入口                                 |
| `electron/main/services/site-service.ts`、计划新增 `electron/main/services/channel-monitor-scheduler.ts`和 `electron/main/services/channel-monitor-scheduler.test.ts`、既有 `electron/main/services/refresh-scheduler.ts` 参考模式与窗口可见性桥接 | 站点请求继续由现有服务执行；独立渠道状态机合并同站概览、全局并发 2、多站错峰与小抖动        | 429 遵守 Retry-After，否则 2/4/8/15 分钟；auth/unsupported 停止              | fake clock 覆盖隐藏/恢复、单飞、退避复位、退出清理；不得改变余额调度器语义 |
| `src/renderer/shells/overview/rate-channel-status-loader.ts`、`src/renderer/channel-load-coordinator.ts`                                                                                                                                           | 复用现有列表/详情 single-flight、缓存和 revision，接收调度器 seed                           | 列表按 siteId、详情按 siteId:monitorId                                       | 周期概览不得触发 N+1 详情；旧详情响应不得覆盖新选择                        |
| `electron/main/adapters/sub2api-adapter.ts` 与 schema                                                                                                                                                                                              | 保留 groups/channels/monitor 的结构 ID，归一化真实状态                                      | `/groups/available`、`/channels/available`、`/channel-monitors`、按需 status | 空数组、缺字段、歧义和 unsupported 显式，不伪造 monitor ID                 |
| `electron/shared/contracts.ts`、`electron/preload/index.ts`、`electron/preload/bridge.cts`、`src/renderer/env.d.ts`                                                                                                                                | 固定轮询配置、可见性和脱敏状态白名单，使用 Zod                                              | interval 只允许 30/60/120                                                    | 拒绝低于 30 秒、任意 channel 和非法站点 ID                                 |
| 渠道页面、调度、关联、E2E 测试                                                                                                                                                                                                                     | 新增请求计数、九态、唯一高置信、去倍率与保留倍率回归                                        | mock server/fake timer/本地 fixture                                          | 不以真实站高频测试；独立 RatePopover/充值比例必须继续通过                  |

允许删除仅被渠道健康 UI 消费的 `BadgePercent` 引用、折算辅助函数和局部样式。禁止删除 `RatePopover.tsx`、`RechargeRatioControl.tsx`、`rate-comparison.ts`、`/groups/rates`、倍率缓存、充值比例设置或总览独立“查看倍率”。上游没有普通用户主动探测接口，因此不得添加“立即探测/Ping 远程渠道”按钮或伪造请求。

## 审计回写（2026-07-14）

本壳已接入真实站点下拉、渠道列表、选择、详情 IPC、unsupported 和空态；切换站点/渠道会清空旧对象数据并显示真实加载状态。获授权站点只读验证仅确认其实际返回字段，缺失的延迟/可用率显示“待查询”而不使用假值。Electron E2E 与 macOS 打包应用页面检查已通过。

### 2026-07-20 1.3.4 增量

站点级渠道状态弹窗仍采用点击后按需加载，完整列表和详情 UI 不变；总览倍率卡片通过共享 loader 自动显示当前匹配渠道，并 seed 弹窗缓存，避免重复接口请求。列表/详情失败可分别重试，不影响其他分组或站点。

## 范围与依据

- 业务模块：M09、M16；对应 Stitch Screen `9ee4845a9bdc44ed8d9dec8d224bfd59`。
- 依据：RQ-08/RQ-16/RQ-17；左侧渠道列表、右侧详情、延迟、Ping、7/15/30 日可用率和时间线。

## 历史 Stitch 壳文件与白名单

| 文件                                            | 职责                      |
| ----------------------------------------------- | ------------------------- |
| `src/renderer/shells/channels/ChannelsPage.tsx` | 列表/详情结构和 TODO 锚点 |
| `src/renderer/shells/channels/channels.css`     | 局部样式                  |
| `src/renderer/shells/channels/types.ts`         | 渠道、事件类型            |
| `src/renderer/shells/channels/data.ts`          | 非真实站点静态数据        |

本表只记录历史 Stitch 视觉承接白名单。2026-07-23 增量的合法修改范围以本文顶部“逐文件接入计划”为准，其中调度器和其测试是后续开发阶段计划新增的合法文件；仍禁止全局样式、无关壳、认证/凭据安全、版本、构建配置和新依赖。

## 入口与接线

- 正式 surface：`/?surface=main` 选择“渠道状态”；开发使用 `npm run dev`，生产由 Electron 主窗口加载。
- 静态 `ChannelPreview[]` 仅供开发预览；生产由渠道列表/详情 IPC 提供。`TODO(...)` 为历史锚点，对应能力探测、unsupported 局部降级、状态校验和正式导航已接线。
- 覆盖全部 11 种通用状态，并额外在后续 Stitch 实例中表达 normal/degraded/failed/unknown。
- 渠道超过 6 个时列表区域独立纵向滚动；当前选中渠道保留在详情区顶部，状态徽标位于端点 Ping 附近。

## 视觉与验收

- 时间线和详情使用高不透明浅色表面；减少透明、高对比度必须保持状态不只靠颜色，不生成其他主题。
- 实例级盘点：列表行高、状态标识、详情分栏、延迟/Ping 数字、周期控件、时间线单元尺寸与 tooltip。
- Stitch HTML 来源：`liran_docs/stitch-artifacts/10340103531009759971/04-channels/screen.html`；截图同目录 `screenshot.png`。
- 控件规格盘点已完成：渠道列表、平台/模型、状态、延迟、Ping、可用率、刷新和时间线规格见下表。
- 接收检查无白名单越界，覆盖长渠道名、多模型、超过 6 个渠道滚动、unsupported 和时间线密度。当前状态：`真实业务接线与 macOS 页面检查通过；扩展指标仍取决于真实响应`。

## 控件规格盘点

| 对象     | HTML 事实规格                                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 页面     | 侧栏 `260px`、主区左偏移 `284px`；顶栏使用 `72px` token；内容 `1440px` 为参考上限并随 BrowserWindow 响应式布局，padding `32px`。 |
| 渠道列表 | 超过 6 个渠道后列表区域独立滚动；卡片 padding `24px`、圆角 `24px`、浅边框和轻阴影，详情区保持稳定。                              |
| 卡片头   | 平台图标容器 `40px`、圆角 `12px`；标题 `16px` 单行截断；状态 pill `12px`、横向 padding `10px`。                                  |
| 指标     | 延迟/Ping 数值 `24px`，标签 `12px`；7 日可用率 `24px`，百分号 `14px`。                                                           |
| 时间线   | 近 60 次记录，高 `24px`、柱间距 `1px`；PAST/NOW 标签 `10px`；normal/warning/error/empty 需形状或文字辅助。                       |
| 操作     | 周期/站点选择控件高 `40px`，刷新和窗口图标按钮 `36px`，图标 `20px`。                                                             |

### 状态矩阵与高风险控件

状态矩阵：unsupported 显示局部能力缺失；degraded/failed/unknown 只作用渠道卡；stale/error 保留最近卡片；loading/empty 使用稳定网格占位。高风险控件为长渠道名、多模型标签、状态 pill、延迟数值、60 格时间线和周期切换。

## 2026-07-18 外发版合并增量（待开发）

- 新增关系排序与请求协调入口：关系数据只作为排序/首选提示，不能覆盖真实站点列表；零候选、多候选和接口失败必须保持可解释的未确定/unsupported 状态。
- 页面接线必须展示当前站点数据时间、刷新中状态和迟到响应丢弃结果；超过 6 个渠道时滚动容器、详情区和状态徽标尺寸不得被新增标签撑开。
- 视觉复核覆盖关系 badge、可用率排序、错误/空态、切站后清空旧详情、周期控件和密集时间线，不改变既有固定浅色规格。

## 2026-07-19 1.3.1 总览快捷弹窗

- 历史实现曾展示整站全部渠道；2026-07-23 起目标改为按当前 Key 的结构化 groupId 关系展示关联渠道。无法唯一关联时显示未关联或关联不明确，不按名称猜测。
- 首个详情与全部渠道卡在同一可滚动内容区；切换渠道只刷新详情，列表保持稳定。loading/error/unsupported/empty/success 状态均保留固定标题和关闭入口。
- 首次点击才读取列表/详情；当前页面会话缓存已加载列表和详情，主动重试绕过缓存。
- 局部样式限定在 `.rate-channel-popover`、`.rate-channel-content` 和 `.rate-channel-list`，没有修改渠道正式页面、全局主题或公共组件默认值。
- macOS 打包应用截图：`real-test-evidence/macos-1.3.1/09-channel-status-popover.png`。
