# 应用主框架与全站总览 UI 壳接入清单

## 审计回写（2026-07-14）

`1440 x 1024` 仅为视觉参考，不是固定画布。Renderer 响应式铺满 BrowserWindow；Electron 主窗口默认使用工作区宽度 60%、高度 90%，居中并允许边缘/四角缩放。左侧导航固定在视口左侧，右侧页面独立滚动。

已接入 Dashboard IPC、真实余额/今日统计/状态/缓存/更新时间、当前站持久化、自动/手动 Key 下拉、刷新和站点导航。总览不再包含悬浮窗预览或固定“正在获取余额”等假状态；Token 使用 K/M，缺少可信倍率时显示“倍率不可用”。本地 HTTP Electron E2E、两站只读复测与 macOS 打包应用页面检查已通过。

## 范围与依据

- 业务模块：M10、M16；对应 Stitch Screen `1c782820120b464b91b8c59135fd07e3`。
- 依据：已确认的高密度固定浅色桌面工作台、克制液态玻璃和 RQ-09/RQ-11/RQ-17。
- 功能：导航、顶部栏、五项汇总指标和站点表格。悬浮窗规格由独立 Screen/Renderer 承担，不在总览页面展示预览。

## 真实文件与白名单

| 文件                                                  | 职责                               |
| ----------------------------------------------------- | ---------------------------------- |
| `src/renderer/shells/overview/OverviewPage.tsx`       | 页面结构、状态样例和 TODO 接线锚点 |
| `src/renderer/shells/overview/overview.css`           | 仅此壳局部样式                     |
| `src/renderer/shells/overview/types.ts`               | 视图、事件类型                     |
| `src/renderer/shells/overview/data.ts`                | 无敏感信息的静态 UI 数据           |
| `src/renderer/App.tsx`                                | 主框架、导航和受控查询参数入口     |
| `src/renderer/styles.css`                             | 固定浅色全局 token 与主框架样式    |
| `src/renderer/preview/PreviewControls.tsx`            | 非遮挡式施工状态控制               |
| `src/renderer/preview/types.ts`                       | 查询参数与状态类型                 |
| `src/renderer/preview/preview.test.ts`                | 状态与固定浅色回归测试             |
| `package.json`、`package-lock.json`、`pnpm-lock.yaml` | 仅登记离线图标依赖 `lucide-react`  |

Stitch 承接后的 Codex 修改白名单仅为上表文件。禁止修改其他业务壳、Electron/preload、配置和业务实现；依赖例外仅允许 `lucide-react`，用于替代 Stitch 的在线 Material Symbols，保证 Electron 离线可用。

## 入口与接线

- 正式 surface：`/?surface=main`，导航选择“全部站点”；开发启动 `npm run dev`，生产由 Electron 主窗口加载。`?preview=true&shell=overview&state=...` 只用于受控开发/自动化状态验证。
- 静态 `OverviewSite[]` 仅供开发预览；生产数据由 Dashboard IPC 和当前站状态提供，事件契约为 `OverviewEvents`。
- `TODO(...)` 是历史接线锚点；对应 ViewModel、聚合状态、IPC 校验和导航已经落地，后续修改必须保持受控边界。
- 状态：success、loading、refreshing、partial、stale、error、auth-required、unsupported、empty、disabled、selected。

## 视觉与验收

- 只实现固定浅色；不提供深色、跟随系统或主题切换。减少透明时外壳实色降级，高对比度强化边框/焦点，表格必须高不透明。
- 实例级保真：导航宽度、工具栏高度、指标间距、表格行高、列宽、按钮/图标/徽标尺寸和截断逐项记录，不提前通用化。
- Stitch HTML 来源：`liran_docs/stitch-artifacts/10340103531009759971/01-overview/screen.html`；截图同目录 `screenshot.png`。
- 控件规格盘点已完成：侧栏、工具栏、五个指标和站点表格规格记录在下表并按 HTML 复修；原 HTML 的悬浮窗实例不进入当前页面。
- 接收检查：白名单、局部样式、静态数据来源、全部状态、无新增依赖、无全局污染。
- Stitch 接收检查：与 Screen `1c782820120b464b91b8c59135fd07e3` 按 HTML 实例规格核对；HTML 是第一视觉事实来源。当前状态：`真实业务接线与 macOS 打包应用页面检查通过`。

## 控件规格盘点

| 对象   | HTML 事实规格                                                                                                                                                                |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 主框架 | 视觉参考为 `1440×1024`；实际外壳宽高为当前 BrowserWindow 的 100%。固定侧栏 `260px`，左/上偏移 `24px`，高度 `calc(100vh - 48px)`；主内容左偏移 `284px` 并响应式铺满剩余空间。 |
| 顶栏   | 高 `80px`，宽 `calc(100% - 284px)`，横向 padding `32px`；圆形图标按钮 `36px`，图标 `20px`。                                                                                  |
| 指标区 | 桌面 5 列、间距 `24px`；指标卡高 `120px`、padding `24px`、圆角 `24px`；标签 `12px`、数值 `24px`。                                                                            |
| 站点表 | 外层最小宽 `800px`；表头高 `60px`、横向 padding `24px`；数据行高 `64px`、圆角 `16px`、12 列网格、间距 `16px`。                                                               |
| 文字   | Plus Jakarta Sans；页面/品牌标题 `18px`，正文 `14px`，辅助/表头 `11–12px`，核心余额最高 `24px`；长站名和 Key 单行截断。                                                      |
| 状态   | success 保持完整表格；loading 使用固定高度骨架；refreshing/partial/stale/error 保留缓存；empty 替换表体；selected 使用浅主色行底。                                           |

### 状态矩阵与高风险控件

状态矩阵：success 保持完整表格；loading 使用固定高度骨架；refreshing/partial/stale/error 保留缓存；empty 替换表体；selected 使用浅主色行底。高风险控件：侧栏选中态、36px 图标按钮、指标卡固定高度、12 列站点表、状态 badge 和长 Key 截断。固定浅色覆盖 HTML 内旧主题配置；减少透明时取消 backdrop-filter，高对比度强化边框和 focus-visible。
