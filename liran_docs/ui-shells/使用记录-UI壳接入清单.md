# 使用记录 UI 壳接入清单

## 2026-07-23 自动筛选与服务端汇总增量

本增量只在现有使用记录壳内修改，不新建页面或 Stitch Screen。API Key、模型、分组、请求类型、计费类型、计费模式或有效日期范围改变后约 `300ms` 防抖自动请求，重置到第一页；强制刷新、重置和按当前筛选导出 CSV 保留。`GET /api/v1/usage` 与 `GET /api/v1/usage/stats` 必须共享同一规范化筛选对象，顶部总请求、总 Token、实际消费和平均耗时只接受服务端筛选统计，不读取未筛选站点快照，也不按当前分页估算。

### 逐文件接入计划

| 文件                                                                                                                | 计划修改                                                                 | 状态、事件与类型入口                                                                                                | 边界与失败测试                                                                                |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/renderer/shells/usage/UsagePage.tsx`                                                                           | 将六类选择和有效日期变更接入防抖；统一列表/统计 epoch；筛选变化回第一页  | `filterChanged`、`forceRefresh`、`reset`、`exportCurrentFilters`；loading/refreshing/partial/error/empty            | fake timer 证明一次变更只发一组请求；迟到统计/列表不能覆盖新条件                              |
| `src/renderer/shells/usage/types.ts`                                                                                | 以真实上游枚举替换旧预览枚举，补规范化筛选和统计来源类型                 | request type 为 unknown/sync/stream/ws_v2/cyber；billing type 为 0/1；billing mode 为 token/per_request/image/video | 未知值显式 unknown，不把旧 `chat/embedding`、`token` billing type 或 `standard` mode 继续发送 |
| `src/renderer/shells/usage/usage.css`                                                                               | 稳定两行筛选、统计卡和 refreshing 布局                                   | 控件约 40px、8px 圆角；表格横向滚动                                                                                 | 自动刷新状态不得推动统计区或表格跳动                                                          |
| `electron/main/services/site-service.ts`                                                                            | 在现有站点服务内接受单一筛选 DTO，分别读取列表和 stats，支持请求世代隔离 | 服务端统计结果标记 filter fingerprint                                                                               | stats 单项失败保留列表并显示 partial，不用本地估算兜底                                        |
| `electron/shared/contracts.ts`、`electron/preload/index.ts`、`electron/preload/bridge.cts`、`src/renderer/env.d.ts` | 扩展同条件列表/统计/导出白名单与 Zod schema                              | 固定 channel、站点 ID、页码、日期和枚举校验                                                                         | 非法枚举、反向日期、越权站点 RED；禁止任意 channel                                            |
| `electron/main/adapters/sub2api-adapter.ts`                                                                         | 对 `/usage` 与 `/usage/stats` 复用筛选序列化                             | 相同 query builder                                                                                                  | 测试逐字段比较两个请求的 query，禁止静默丢条件                                                |
| `src/renderer/shells/usage/UsagePage.test.ts` 及现有 usage service/adapter 测试                                     | 补 fake timer、分页重置、竞态、partial、CSV 当前筛选                     | 300ms 约定允许测试以精确配置值断言                                                                                  | 先 RED 再实现；不得通过拉长防抖掩盖重复请求                                                   |

允许修改范围仅限上述使用记录调用链及对应测试。禁止改全局样式、站点认证、缓存安全、其他页面业务行为、版本和构建配置；静态预览数据不得冒充服务端统计。

## 审计回写（2026-07-14）

本壳已接入真实 usage IPC、当前站下拉、今日统计、真实模型/分组/Key 枚举、组合筛选、每页 20 条、时间排序、思考等级、本地中文时间、K/M、列设置和主进程 CSV 导出；正式运行态不回退静态记录。Electron E2E、两站只读复测、CSV `0600` 权限和 macOS 打包应用页面检查已通过。

## 范围与依据

- 业务模块：M08、M16；对应 Stitch Screen `5184f4f26e7d48968b505e2b72e1ae14`。
- 依据：RQ-06/RQ-07/RQ-17；今日统计、两行筛选、密集记录表、列设置、分页和 CSV。
- 高不透明数据面优先，工具栏/浮层可使用克制玻璃。

## 历史 Stitch 壳文件与白名单

| 文件                                      | 职责                 |
| ----------------------------------------- | -------------------- |
| `src/renderer/shells/usage/UsagePage.tsx` | 页面结构与 TODO 锚点 |
| `src/renderer/shells/usage/usage.css`     | 局部样式             |
| `src/renderer/shells/usage/types.ts`      | 记录、事件类型       |
| `src/renderer/shells/usage/data.ts`       | 脱敏静态预览记录     |

本表只记录历史 Stitch 视觉承接白名单。2026-07-23 增量的合法修改范围以本文顶部“逐文件接入计划”为准；仍禁止修改全局样式、无关壳、认证/凭据安全、版本和构建配置，也不得把静态数据描述为 API 结果。

## 入口与接线

- 正式 surface：`/?surface=main` 选择“使用记录”；开发使用 `npm run dev`，生产由 Electron 主窗口加载。
- 静态 `UsageRecord[]` 仅供开发预览；生产由 usage IPC 提供。`TODO(...)` 为历史锚点，对应统计、筛选、分页、CSV、Zod 和正式导航均已接线。
- 模型来自 `/usage/dashboard/models`，分组来自 `/groups/available`，Key 来自 `/keys`；切站时清空上一站点记录和筛选枚举。
- 覆盖 success、loading、refreshing、partial、stale、error、auth-required、unsupported、empty、disabled、selected。

## 视觉与验收

- 固定浅色、减少透明和高对比度均需覆盖；不生成深色、跟随系统或主题切换。表格、筛选表单高不透明。
- 实例级保真：统计区高度、两行筛选轨道、控件高度、表头/行高、列宽、分页、列设置浮层和 CSV 按钮逐项盘点。
- Stitch HTML 来源：`liran_docs/stitch-artifacts/10340103531009759971/02-usage/screen.html`；截图同目录 `screenshot.png`。
- 控件规格盘点已完成：站点切换、统计、筛选、刷新/重置、列设置、CSV、密集表格和分页规格见下表；不存在地区列或地区操作。
- 接收检查：白名单、状态、长模型名/费用、空表、20 条分页和横向滚动稳定性已纳入自动化。当前状态：`真实业务接线与 macOS 打包应用页面检查通过`。

## 控件规格盘点

| 对象 | HTML 事实规格                                                                                                  |
| ---- | -------------------------------------------------------------------------------------------------------------- |
| 页面 | 主内容左偏移 `284px`、顶偏移 `80px`，padding `32px`；`1440px` 是内容参考上限而非固定画布，表格仅允许横向滚动。 |
| 顶栏 | 站点切换按钮高 `40px`；窗口图标按钮 `36px`；页面操作间距 `24px`。                                              |
| 指标 | 4 个统计卡使用 `p-6`、`rounded-lg`；数值 `28px`，图标 `20px`，辅助文字 `12px`。                                |
| 筛选 | 三列两行网格，间距横 `24px`/纵 `16px`；select 高 `48px`；工具按钮高 `40–48px`。                                |
| 表格 | 最小宽 `1200px`、不换行；表头/行使用横向 padding `16px`，数据行高 `64px`；正文 `12–13px`，tag `11–12px`。      |
| 分页 | 每页固定 20 条；页码按钮约 `32px`，select 高 `32px`；工具栏包含刷新、重置、列设置和 CSV。                      |

### 状态矩阵与高风险控件

状态矩阵：loading 固定统计/表格骨架；empty 保留筛选并显示空表；error/partial/stale 保留上次统计与记录；refreshing 保留内容并标记刷新；disabled 禁用筛选和操作。高风险控件为两行筛选、列设置浮层、CSV 主按钮、密集表格列宽、长模型名/脱敏 Key 和分页。

## 2026-07-18 外发版合并增量（待开发）

- 新增统计/表格字段：缓存创建 Token、平均/行级耗时和推理等级；所有字段必须保持卡片、表格、列设置、CSV 和空值状态一致。
- 接线白名单增加对应类型/测试文件时，必须先在主源码中创建合法文件并记录用途；外部源码不得直接覆盖本清单外文件。
- 页面视觉检查重点为统计卡稳定高度、密集表格列宽、耗时和推理 badge 的不换行/截断、CSV/列设置控件和移动视口横向滚动。

## 2026-07-19 1.2.1 接线结果

- 独立缓存 Token 列已移除；Token 列以绿色输入、紫色输出和蓝色缓存读取两行组合显示，并保留 Tooltip/无障碍名称。
- 时间列统一为 `YYYY/MM/DD HH:mm:ss`；首字三色规则不变。
- 真实 20 条记录的 macOS 页面检查通过，列宽、行高、长数字和分页无重叠。
