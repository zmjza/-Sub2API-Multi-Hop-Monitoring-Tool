# UI 壳与 Stitch

> 2026-07-14 当前证据：5 个业务 Screen 已完成 HTML 实例级承接、真实 ViewModel/IPC 接线、构建、Electron E2E 与 macOS 打包应用页面检查；生产态不显示施工预览控件或静态业务回退。本路线不执行 Product Design Design QA。

上级：[[03-索引]]
下级：文本视觉方案、UI 壳准备、Stitch 承接、实例级接收检查
依赖：[[10-UI壳接入清单]]、全部业务模块

## 职责

按 `@product-design + Stitch / Stitch MCP` 路线建立真实 Electron 前端 UI 壳并执行视觉门禁。覆盖 RQ-17。

## 阶段

1. 确认文本视觉方案。
2. 初始化工程后创建 UI 壳总清单、单壳清单、真实文件、入口、类型、mock、局部样式和 TODO 锚点。
3. 生成固定结构 Stitch 提示词；实际 Stitch 产物登记为 5 个业务 Screen 加 1 个 Design System 资产。
4. 接收 Project ID/Screen ID，下载 HTML、代码、样式、规范和截图。
5. 先做控件规格盘点，再承接真实前端 UI 壳。
6. 对照文件白名单和样式作用域接收检查。
7. 执行 Stitch 实例级规格复修与接收检查；不执行 Product Design Design QA。

## 已确认视觉方案

- 克制的 iOS 26 液态玻璃桌面工作台；只提供固定浅色模式，不生成深色、跟随系统或主题切换规格。
- 玻璃只用于窗口外壳、侧边导航、顶部工具栏、悬浮窗和浮层；表格、表单、时间线和危险操作区使用高不透明表面。
- 支持减少透明效果与高对比度降级，不依赖颜色单独表达状态；不需要额外视觉图片。
- 实际产物包含 5 个业务 Screen：全部站点、使用记录、渠道状态、悬浮窗、站点管理与设置；账号模板功能已取消，不属于任何 Screen 或 Tab。Design System 资产只作为全局 token 来源。
- 任何早期多主题 Stitch 提示词或原型不再作为当前主题事实来源；承接前必须先清除深色、跟随系统和主题选择规格。

## 事实优先级

Stitch HTML > Stitch 代码/样式/规范 > Stitch 截图。可从 HTML 确认的实例尺寸不得用截图猜测或被通用组件抹平。

## UI 范围

全站总览、使用记录、渠道状态、站点录入/管理、设置/通知、悬浮窗。实际 Stitch 产物和下载登记见 `liran_docs/stitch-artifacts/README.md`，悬浮窗使用独立 Renderer。

## 验收

- 布局、字体、颜色、资产、文案、按钮、图标、输入、表格、分页、状态和断点逐项对比。
- UI 壳、业务接线和 macOS 页面检查均有证据；Windows 仅交叉构建，签名、公证和对外发布仍未完成。
- 接收检查覆盖固定浅色、减少透明、高对比度、响应式窗口和 macOS/Windows 降级差异，并确认没有残留主题切换入口。Stitch HTML 是第一视觉事实来源；本路线不执行 Product Design Design QA，也不采用相似度分级门禁。

## 任务范围

TASK-08-01 至 TASK-08-04、TASK-09-01 至 TASK-09-06、TASK-10-08、TASK-12-11。
