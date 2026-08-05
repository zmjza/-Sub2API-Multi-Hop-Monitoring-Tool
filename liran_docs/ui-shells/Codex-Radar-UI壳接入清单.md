# Codex Radar UI 壳接入清单

## 状态

`1.8.1 已接入并完成 macOS 真实 Electron 验收`。

本轮不再在应用内制作 Radar 数据页。正式“雷达”导航只展示两个入口卡片，并在同一个主 `BrowserWindow` 的内容区域内使用 Electron `WebContentsView` 打开固定站点。真实站点流程、resize、关闭、Esc 和截图证据见 `real-test-evidence/macos-1.8.1-radar-final/`。

## 入口与行为

| 卡片名称              | 固定地址                       |
| --------------------- | ------------------------------ |
| `Codex 雷达`          | `https://codexradar.com/`      |
| `分布式雷达 Codex 站` | `https://deng.codexradar.com/` |

- 主导航继续保留“雷达”。
- 雷达选择页只显示上述两个卡片，不请求 `current.json`，不展示评分、成本、推荐、模型列表、数据时间或数据状态。
- 点击卡片后网页覆盖主窗口右侧内容区域；左侧应用导航和顶部应用控制区仍由项目 Renderer 管理。
- 顶部右侧显示应用自有的“关闭雷达网页”图标；点击图标或在远程网页获得焦点时按 `Esc`，移除远程视图并恢复两个卡片。
- 远程页面加载失败或跨域导航被拦截时显示可理解的错误状态，关闭图标仍可用。

## 视图接线

- `src/renderer/App.tsx` 维护 Radar 嵌入状态和 toolbar 关闭按钮；`RadarPage.tsx` 只负责入口卡片及打开/错误状态。
- `electron/preload/index.ts` 与 `electron/preload/bridge.cts` 只暴露固定 `RadarTargetId`、关闭方法和状态订阅，不暴露任意 URL。
- `electron/main/index.ts` 创建、挂载、resize 同步和清理 `WebContentsView`；当前窗口内容坐标按现有壳布局使用 `x=284`、`y=80`，网页从顶部控制区下方开始显示。
- 远程视图使用 `sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`、独立内存 `partition`，不注入项目 preload。
- 远程顶层导航仅允许两个精确 HTTPS origin；新窗口、弹窗、跨域顶层跳转和额外 webview 均阻止。
- 主窗口关闭、应用退出和视图自身销毁都清理远程 webContents，不能创建第二个 `BrowserWindow`，不能调用系统浏览器。

## 样式规格

- 入口卡片沿用浅色工作台、现有字体和局部控件层级；卡片具有稳定尺寸、hover、active、focus-visible 状态，支持键盘操作。
- 两个卡片使用不同但克制的蓝/青色图标强调，标题和域名可换行，不允许横向溢出、重叠或布局跳动。
- 远程网页的应用 toolbar、关闭按钮、左侧导航和网页边界不得互相覆盖；窗口缩放后视图仍贴合内容区。
- 视觉参考截图：`radar-chooser.png`、`radar-codex-window.png`、`radar-codex-window-small.png`、`radar-distributed-window.png`、`radar-codex.png`、`radar-distributed.png`。

## 接收门禁

- [x] 正式主导航可打开，选择页只有两个固定入口。
- [x] Renderer 不再请求或依赖 `current.json`，CSP 不保留不必要的 Radar 外部连接权限。
- [x] 固定目标枚举、origin 白名单、新窗口拒绝、sandbox/contextIsolation/nodeIntegration 和独立 partition 已验证。
- [x] 关闭图标、Esc、错误恢复、重复打开防护、主窗口 resize 和退出清理已验证。
- [x] 真实 macOS Electron 流程已打开两个公网站点并保存截图；Windows 只按项目规则做交叉构建，不写成真机通过。
