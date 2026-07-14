# 悬浮窗 UI 壳接入清单

## 审计回写（2026-07-14）

悬浮窗保持独立 Renderer 和 `380 x 260` 固定尺寸；主界面的 `1440 x 1024` 仅为视觉参考，主窗口 60%×90% 初始尺寸和后续响应式缩放不影响悬浮窗。

已接入真实当前站、余额、默认 Key、倍率、今日 Token/消费、动态标题、真实状态行、缓存与更新时间；左右切站持久化当前站并跨窗口同步，扩大按钮隐藏悬浮窗并打开、聚焦主面板。四角位置已持久化，默认右上。悬浮窗保持已显示但 `alwaysOnTop:false`，所有常驻显示路径使用非激活显示，浏览器等前台应用可覆盖；macOS 台前调度/多 Space 可见且不覆盖全屏应用。非激活显示修复已通过开发 E2E，macOS 新打包应用复测待执行；物理多显示器因当前环境不适用。

## 范围与依据

- 业务模块：M02、M16；独立 Renderer，对应 Stitch Screen `29f04763029b4f6db724b9d31427f34a`。
- 依据：RQ-03/RQ-11/RQ-17；左右切站、余额、默认 Key/倍率、今日 Token/消费和查询状态。

## 真实文件与白名单

| 文件                                              | 职责                               |
| ------------------------------------------------- | ---------------------------------- |
| `src/renderer/shells/floating/FloatingWindow.tsx` | 固定窗口结构、预览入口和 TODO 锚点 |
| `src/renderer/shells/floating/floating.css`       | 独立 `380 x 260` 局部样式          |
| `src/renderer/shells/floating/types.ts`           | 快照、事件类型                     |
| `src/renderer/shells/floating/data.ts`            | 脱敏静态快照                       |
| `electron/main/index.ts`                          | 同步 HTML 证实的施工窗口逻辑尺寸   |
| `tests/e2e/electron-smoke.spec.ts`                | 独立窗口尺寸与入口烟测             |

该表记录本壳视觉承接和接线文件。后续修改必须以任务白名单为准，不得借悬浮窗视觉修改扩大到无关权限、依赖或业务模块。

## 入口与接线

- 正式独立 Renderer surface：`/?surface=floating`；`npm run dev` 和生产主进程均创建第二个 BrowserWindow。
- 静态 `FloatingSnapshot` 仅供开发预览；生产由当前站 Dashboard ViewModel 提供。`TODO(...)` 为历史锚点，对应快照、缓存优先级、Zod 与详情打开已接线。
- success、loading、refreshing、partial、stale、error、auth-required、unsupported、empty、disabled、selected 全部可切换。

## 视觉与验收

- HTML 实际逻辑尺寸为 `380 x 260`；只实现固定浅色。减少透明时实色降级，高对比度强化边框/焦点。长站名、动态标题和错误不得撑高窗口。
- 实例级盘点：外框、内边距、箭头按钮、标题单/双行、数值字号、Key 截断、指标列、动画占位、缓存/错误标识和更新时间。
- Stitch HTML 来源：`liran_docs/stitch-artifacts/10340103531009759971/05-floating/screen.html`；截图同目录 `screenshot.png`。
- 当前已观察控件：多实例 `380×260` 规格、左右切站、动态标题、省略/滚动标题、余额、今日 Token/消费、正常/延迟较高/连接中和刚刚更新状态。
- 接收检查覆盖浅色正常、查询、过期、错误实例，并确认无其他主题入口。自动化已验证固定 `380 x 260`、四角持久化、两站切换、动态标题、缓存、最小化显示和扩大恢复主面板。当前状态：`真实业务接线与 macOS 打包应用页面检查通过；物理多显示器不适用`。

## 控件规格盘点

| 对象     | HTML 事实规格                                                                                             |
| -------- | --------------------------------------------------------------------------------------------------------- |
| 外框     | `380×260`、白底、1px `#e2e8f0`、圆角 `24px`、overflow hidden；展示画布 padding `40px` 不属于窗口。        |
| 顶栏     | 横向 padding `20px`、纵向 `12px`；切站按钮 `32px`，图标 `20px`；站名 `14px` 单行居中截断。                |
| 标题     | 副标题 `12px`；动态标题 `15px`、紧凑行高，长文按 HTML 滚动，reduced-motion 时截断。                       |
| 核心指标 | 余额 `32px`（部分实例 `40/42px`）；Key `13px`、下拉图标 `16px`；倍率 pill 高 `24px`、padding `2px 10px`。 |
| 今日指标 | 两列、间距 `12px`；metric box padding `12px`、圆角 `16px`；标签 `12px`、数值 `15px`。                     |
| 底栏     | 横向 padding `20px`、纵向 `12px`；状态点 `10px`；状态/更新时间 `12px`。连接中实例使用固定占位和旋转动画。 |

### 状态矩阵与高风险控件

状态矩阵：success/延迟较高保留全部指标；loading/refreshing 显示连接阶段与 3–5 秒；stale/error 保留旧指标并标缓存；auth-required/unsupported 显示局部原因。高风险控件为 32px 箭头按钮、滚动标题、32–42px 余额、Key 截断、24px 倍率 pill 和固定 260px 高度。
