# Codex Radar UI 壳接入清单

## 状态

`真机测试通过`。本轮已接入主线正式导航，并在 macOS ARM64 内部目录包中完成成功、加载、空态、错误、刷新、来源链接和窄视口视觉检查；截图与自动化证据见 `real-test-evidence/macos-1.1.0/playwright/` 和 `test-results/radar.png`。

## 范围与入口

- 正式入口：主 Renderer `/?surface=main` 的正式导航，导航标签为“雷达”。
- 允许文件：`src/renderer/shells/radar/RadarPage.tsx`、`src/renderer/shells/radar/radar-data.ts`、`src/renderer/shells/radar/radar.css`、对应 `*.test.ts`，以及 `src/renderer/App.tsx` 的导航挂载和 `index.html` 的明确 CSP 连接白名单。
- 禁止文件：Electron 主进程业务、preload、SQLite、站点凭据、认证、公共 CSS reset、其他 UI 壳和新增依赖。

## 视觉与状态

- 沿用当前固定浅色桌面工作台；标题、操作按钮、模型卡、badge、表格和免责声明使用现有局部控件尺度。
- 必须覆盖 ready、loading、refreshing、empty、network-error、http-error、invalid-payload 和窄视口状态。
- 长模型名、评分、成本、耗时和推荐文案必须稳定换行/截断，不得造成页面横向溢出或遮挡。
- 外部链接使用系统浏览器打开；公开数据只存在页面运行时，不落盘。

## 接线与验证

- `DONE(ui-shell)`：页面结构、模型卡和局部响应式状态已接入。
- `DONE(codex-connect)`：仅连接公开 Radar fetch，不连接站点 IPC。
- `DONE(codex-state)`：加载、错误、空数据和刷新状态已接入。
- `DONE(codex-route)`：正式导航入口和当前 shell 选择已接入。
- 测试必须检查 CSP 不含 `connect-src *`、数据解析去重、推理等级标签、成功/失败/空态和导航可达性。

## 接收门禁

只有页面落到真实 Renderer、白名单内、局部样式生效、无新增依赖、无站点敏感数据接线、可从正式导航打开并通过最小单测/构建后，才能进入业务接线和 macOS 页面样式检查。
