# Sub2API Desktop Deep Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成无框窗口生命周期、真实 sub2api 数据接线、五个业务界面增量优化、macOS 真机验收和双平台安装包交付。

**Architecture:** 保持 Electron 主进程负责认证、网络、持久化和敏感字段白名单，preload 仅暴露命名 IPC，Renderer 只消费安全视图模型。窗口行为由主进程统一管理，页面共享格式化工具和明确的异步状态，Stitch HTML 继续作为既有视觉基线，但用户确认的新行为覆盖原型中的旧实例。

**Tech Stack:** Electron 43、React 19、TypeScript 5.9、Vite 8、Zod 4、Vitest 4、Playwright Electron、electron-builder。

---

### Task 1: 共享契约、倍率和使用记录字段

**Files:**

- Modify: `electron/main/adapters/sub2api-adapter.test.ts`
- Modify: `electron/shared/contracts.test.ts`
- Modify: `electron/main/adapters/sub2api-adapter.ts`
- Modify: `electron/shared/contracts.ts`
- Modify: `electron/main/domain/types.ts`
- Modify: `electron/main/services/site-service.ts`

- [ ] 为 `data.items[].group.rate_multiplier`、`/groups/rates` 专属覆盖和 `reasoning_effort` 写失败测试。
- [ ] 运行定向 Vitest，确认因字段缺失和倍率优先级错误而失败。
- [ ] 扩展安全白名单模型，不允许完整 Key、IP、User-Agent 或原始对象越过 IPC。
- [ ] 实现倍率优先级：专属覆盖 > Key 内嵌分组默认倍率 > available group 默认倍率 > 缺失。
- [ ] 运行定向测试并确认通过。

### Task 2: 模型、分组和 Key 筛选数据

**Files:**

- Modify: `electron/main/adapters/sub2api-adapter.test.ts`
- Modify: `electron/main/adapters/sub2api-adapter.ts`
- Modify: `electron/main/services/site-service.integration.test.ts`
- Modify: `electron/main/services/site-service.ts`
- Modify: `electron/shared/contracts.ts`
- Modify: `electron/preload/index.ts`
- Modify: `electron/preload/bridge.cts`
- Modify: `electron/main/index.ts`

- [ ] 为 `/usage/dashboard/models`、可用分组和安全筛选选项写失败测试。
- [ ] 运行定向测试，确认缺少端点调用和 IPC 时失败。
- [ ] 实现主进程只读筛选选项接口，保持账号凭据和原始响应仅在主进程。
- [ ] 运行契约、适配器和服务集成测试。

### Task 3: 无框主窗口和悬浮窗生命周期

**Files:**

- Modify: `tests/e2e/electron-smoke.spec.ts`
- Modify: `electron/main/index.ts`
- Modify: `electron/preload/index.ts`
- Modify: `electron/preload/bridge.cts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`

- [ ] 先写 E2E：两窗无框；最小化隐藏主窗并显示悬浮窗；关闭退出；悬浮窗扩大隐藏自身并打开主窗。
- [ ] 运行 E2E 并确认旧生命周期导致失败。
- [ ] 增加最小命名 IPC，主窗口 `frame:false`，关闭不再被拦截隐藏。
- [ ] 主 Renderer 改为铺满 BrowserWindow，移除固定画布 scale/offset；侧栏保持固定，内容独立滚动。
- [ ] 运行 E2E，验证 60%×90% 初始窗口、可缩放和无大面积外壳空白。

### Task 4: 悬浮窗四角停靠和真实状态行

**Files:**

- Modify: `tests/e2e/electron-smoke.spec.ts`
- Modify: `electron/shared/contracts.ts`
- Modify: `electron/main/index.ts`
- Modify: `electron/preload/index.ts`
- Modify: `electron/preload/bridge.cts`
- Modify: `src/renderer/preview/types.ts`
- Modify: `src/renderer/shells/floating/FloatingWindow.tsx`
- Modify: `src/renderer/shells/floating/floating.css`

- [ ] 写失败 E2E：默认右上、四角选择与持久化、`alwaysOnTop=false`、状态行、扩大按钮。
- [ ] 实现四角枚举和主进程工作区定位，保存位置偏好而不是任意伪造 bounds。
- [ ] 移除 `alwaysOnTop` 和 `focusable:false`，保证设置控件可操作且不覆盖其他应用。
- [ ] 增加设置菜单、状态点、中文状态、更新时间及 K/M Token。
- [ ] 运行定向 E2E 并检查固定尺寸和按钮不重叠。

### Task 5: 统一 Token 与本地时间格式

**Files:**

- Create: `src/renderer/lib/format.ts`
- Create: `src/renderer/lib/format.test.ts`
- Modify: `src/renderer/shells/overview/OverviewPage.tsx`
- Modify: `src/renderer/shells/usage/UsagePage.tsx`
- Modify: `src/renderer/shells/floating/FloatingWindow.tsx`

- [ ] 写失败测试覆盖 999、1K、1.25K、1M、去尾零和无效日期。
- [ ] 实现 `formatTokenCount` 与 `formatLocalTimestamp`，不得改 CSV 原始值。
- [ ] 替换三个页面的显示格式并运行单测。

### Task 6: 全部站点真实状态

**Files:**

- Create: `src/renderer/shells/overview/OverviewPage.test.tsx`
- Modify: `src/renderer/shells/overview/OverviewPage.tsx`
- Modify: `src/renderer/shells/overview/overview.css`
- Modify: `src/renderer/App.tsx`

- [ ] 写失败测试：不存在“正在获取余额”和悬浮窗预览；倍率缺失显示“暂不可用”；刷新按钮有事件。
- [ ] 删除假指标卡和正式页面预览，保留 Stitch 的高密度指标与表格比例。
- [ ] 连接页面刷新、loading/success/error/stale 状态并防止布局跳动。
- [ ] 运行页面测试和 Renderer 构建。

### Task 7: 使用记录站点下拉和 20 条安全分页

**Files:**

- Modify: `src/renderer/shells/usage/UsagePage.test.ts`
- Modify: `src/renderer/shells/usage/UsagePage.tsx`
- Modify: `src/renderer/shells/usage/usage.css`
- Modify: `src/renderer/preview/types.ts`
- Modify: `src/renderer/App.tsx`

- [ ] 写失败测试：站点下拉、真实模型/分组/Key、最多 20 条、思考等级、本地时间、K/M、无地区列。
- [ ] 切换站点时先清空旧数据并进入 loading，避免上一站数据冒充。
- [ ] 连接筛选选项、服务端分页和完整 CSV 当前筛选条件。
- [ ] 表格最多渲染 20 条，页面只通过分页访问后续记录。
- [ ] 运行页面、契约和服务测试。

### Task 8: 渠道列表和异步状态

**Files:**

- Modify: `src/renderer/shells/channels/ChannelsPage.test.ts`
- Modify: `src/renderer/shells/channels/ChannelsPage.tsx`
- Modify: `src/renderer/shells/channels/channels.css`
- Modify: `src/renderer/App.tsx`

- [ ] 写失败测试：真实站点下拉、超过六项独立滚动、状态徽标靠近 PING、切站不显示旧详情。
- [ ] 实现列表局部滚动和稳定详情区，保留 7/15/30 日真实字段。
- [ ] 对 loading/error/unsupported/empty 明确分支，缺失数据统一显示“待查询”。
- [ ] 运行页面测试和 Renderer 构建。

### Task 9: 站点验证进度、通知和设置

**Files:**

- Modify: `electron/shared/contracts.test.ts`
- Modify: `electron/shared/contracts.ts`
- Modify: `electron/main/services/site-service.ts`
- Modify: `electron/main/index.ts`
- Modify: `electron/preload/index.ts`
- Modify: `electron/preload/bridge.cts`
- Modify: `src/renderer/shells/sites/SitesPage.test.ts`
- Modify: `src/renderer/shells/sites/SitesPage.tsx`
- Modify: `src/renderer/shells/sites/sites.css`
- Modify: `src/renderer/App.tsx`

- [ ] 写失败测试覆盖单站阶段、批量 `1/10`、不中断、成功/失败清单、恢复通知和通用设置。
- [ ] 将添加验证进度绑定到稳定任务标识，批量逐项广播进度和最终结果。
- [ ] 扩展通知设置和通用设置持久化，但不增加遥测、云同步或远端写操作。
- [ ] 完善 switch 的 focus/disabled/transition，运行定向测试。

### Task 10: 文档、回归、真机与打包

**Files:**

- Modify: `liran_docs/用户原话.md`
- Modify: `liran_docs/00-项目说明书.md` through `liran_docs/10-UI壳接入清单.md`
- Modify: affected files under `liran_docs/modules/`
- Modify: all five checklists under `liran_docs/ui-shells/`
- Modify: `liran_docs/stitch-artifacts/README.md`
- Modify: `docs/pitfalls/README.md`
- Modify: `docs/pitfalls/electron-build.md`
- Modify: `docs/pitfalls/sub2api-adapter.md`

- [ ] 按真实实现和测试证据更新需求、架构、数据、API、任务、测试、真机和 UI 壳映射，清除相反旧规则与悬空 ID。
- [ ] 运行 format、lint、typecheck、Vitest、build、Electron E2E、敏感扫描、文档链接检查和 `git diff --check -- .`。
- [ ] 使用两个授权站点做只读真实接口验证，凭据仅通过进程内环境变量使用且不进入输出或文件。
- [ ] 打包 macOS ARM64 DMG，启动打包应用逐页完成窗口、数据、样式和交互真机检查，证据保存到 `real-test-evidence/`。
- [ ] 交叉构建 Windows x64 NSIS，只记录自动化和产物证据。
- [ ] 将最终 DMG/EXE 放到根目录，扫描安装包与仓库敏感信息，审计所有收口条件。
