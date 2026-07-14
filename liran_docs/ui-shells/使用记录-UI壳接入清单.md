# 使用记录 UI 壳接入清单

## 审计回写（2026-07-14）

本壳已接入真实 usage IPC、当前站下拉、今日统计、真实模型/分组/Key 枚举、组合筛选、每页 20 条、时间排序、思考等级、本地中文时间、K/M、列设置和主进程 CSV 导出；正式运行态不回退静态记录。Electron E2E、两站只读复测、CSV `0600` 权限和 macOS 打包应用页面检查已通过。

## 范围与依据

- 业务模块：M08、M16；对应 Stitch Screen `5184f4f26e7d48968b505e2b72e1ae14`。
- 依据：RQ-06/RQ-07/RQ-17；今日统计、两行筛选、密集记录表、列设置、分页和 CSV。
- 高不透明数据面优先，工具栏/浮层可使用克制玻璃。

## 真实文件与白名单

| 文件                                      | 职责                 |
| ----------------------------------------- | -------------------- |
| `src/renderer/shells/usage/UsagePage.tsx` | 页面结构与 TODO 锚点 |
| `src/renderer/shells/usage/usage.css`     | 局部样式             |
| `src/renderer/shells/usage/types.ts`      | 记录、事件类型       |
| `src/renderer/shells/usage/data.ts`       | 脱敏静态预览记录     |

白名单仅限上表。禁止修改全局样式、其他壳、Electron/preload、配置和依赖，禁止新增文件或把静态数据描述为 API 结果。

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
