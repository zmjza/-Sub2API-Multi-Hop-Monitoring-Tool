# REQ-260920 API 密钥、禾维 AI 与悬浮窗优化 · 评分记录

## 评分状态

- 任务 ID：REQ-260920-api-key-hvoyai-floating-polish
- 评分阶段：正式 PRD 转换后评分
- 评分日期：2026-09-20
- 总分：69/100
- 流程等级：标准流程
- 最终流程：标准流程
- 评分分段：36–69 为标准流程
- 评分证据：已核对 API 密钥自定义 GroupSelect、表格 overflow/高度链路、全部站点当前 Key、App 接线、WebContentsView 安全导航、preload/IPC 契约和悬浮窗 24px 数值样式。
- 范围上限：三个现有页面和一条受控第三方网页自动填充链路；不扩展为通用浏览器自动化、数据库迁移或认证体系改造。
- 安全门禁：完整 API Key 会在会话内填入第三方页面，必须固定禾维 HTTPS origin、禁止 URL/日志/持久化泄漏、禁止远程 preload/Node/任意 IPC、禁止自动提交。
- 项目级完整条件：未命中新项目、整体架构重构、大规模数据迁移、技术栈迁移或三个以上全新产品模块，因此不进入完整流程。
- UI 决策：不创建独立 UI 壳；复用现有全部站点弹层、WebContentsView 工具栏、API 密钥页和悬浮窗视觉体系。
- 目标节奏：标准流程单目标完成 TDD、实现、内部验证、macOS 真机、版本、双平台构建、发布与交接。
- 变更：新增使用记录“全部 API Key”筛选修复，影响 UsagePage、App 查询接线、UsageLoadCoordinator 和相关测试；流程仍为标准流程，修改前总分调整为 69/100。
- 评分性质：修改前/PRD 转换后的当前基线；开发后依据真实 diff、调用方变化和验证证据重新评分。

## 五维评分

项目现状：15/20
修改规模：15/20
依赖与修改后影响：13/20
风险与回滚：14/20
验证复杂度：12/20
总分：69/100

| 维度             |  分数 | 证据                                                                                     |
| ---------------- | ----: | ---------------------------------------------------------------------------------------- |
| 项目现状         | 15/20 | API 密钥、全部站点、使用记录、WebContentsView 与悬浮窗均为成熟模块，改动需保持已有行为。 |
| 修改规模         | 15/20 | 涉及 Renderer、App、preload、共享契约、主进程网页视图和使用记录协调器，但无数据库迁移。  |
| 依赖与修改后影响 | 13/20 | 复用现有 Key 选择和网页容器模式；新增专用 IPC、页面状态和列表/统计降级行为。             |
| 风险与回滚       | 14/20 | 完整 Key 只在主进程与固定第三方页面间短暂使用；入口和 IPC 可按功能整体回滚。             |
| 验证复杂度       | 12/20 | 自动化范围清晰，真实外部页面 DOM 与双平台产物仍需额外验证。                              |

## 修改后评分

- 总分：67/100，流程等级保持标准流程。
- 项目现状 14/20：实现复用现有站点、Key、WebContentsView 和查询协调器，没有引入第二套持久化。
- 修改规模 14/20：最终 diff 跨主进程、preload、Renderer 与文档，范围与 PRD 一致。
- 依赖与影响 13/20：专用 IPC 只接受 siteId；使用记录降级集中在共享协调器。
- 风险与回滚 14/20：固定 HTTPS origin、禁用 Node/preload、权限、新窗口和 webview，完整 Key 不返回 Renderer。
- 验证复杂度 12/20：63 个测试文件 487 项、typecheck、lint、build 与 14 项 E2E 已通过；真实禾维页面和打包视觉尚未标记通过。

## 流程判断

- 进入标准流程：三个目标共享现有架构，可在一个完整开发与验收目标中闭环。
- 不升为深度流程：没有数据库迁移、公共协议重构、认证体系变更或多个全新模块。
- 不降为轻量流程：完整 Key 会进入受控第三方页面，且跨 Renderer、preload、主进程和 WebContentsView，需要安全与真实页面验证。
- 可能升档：若禾维页面无法通过现有受控网页视图稳定填充，必须新增独立浏览器自动化服务或重做网页容器架构时重新评分。

## 评分依据文件

- liran_docs/requirements/REQ-260920-api-key-hvoyai-floating-polish-需求整理.md
- liran_docs/requirements/REQ-260920-api-key-hvoyai-floating-polish-PRD.md
- src/renderer/shells/api-keys/ApiKeysPage.tsx
- src/renderer/shells/api-keys/api-keys.css
- src/renderer/shells/overview/OverviewPage.tsx
- src/renderer/shells/floating/FloatingWindow.tsx
- src/renderer/shells/floating/floating.css
- src/renderer/App.tsx
- electron/main/index.ts
- electron/preload/index.ts
- electron/preload/bridge.cts
- electron/shared/contracts.ts
