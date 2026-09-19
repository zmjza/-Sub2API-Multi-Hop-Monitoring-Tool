# API Key、禾维 AI 与悬浮窗优化实施计划

> **执行要求：** 按 TDD 逐项完成；每个行为先看到测试因缺失实现而失败，再写最小实现。最终普通目标只交接等待用户检查，不执行正式归档。

**目标：** 修复 API 密钥页高度与分组菜单裁切，新增无默认站点的禾维 AI 内嵌检测和安全自动填充，并缩小悬浮窗今日统计字号。

**范围增补：** 修复使用记录选择“全部 API Key”时的查询与异步状态，确保清理旧 Key 筛选并显示当前站点全部记录。

**架构：** 继续由主进程持有完整 API Key、站点地址和 WebContentsView；Renderer 只展示已有脱敏 Key 摘要并提交 siteId。复用现有站点 Key 上下文、WebContentsView 安全导航和 preload 命名 IPC，不增加浏览器依赖或第二套 Key 选择状态。分组菜单使用 React portal 定位到 document.body，避免表格 overflow 裁切。

**技术栈：** Electron、React、TypeScript、Vite、Zod、Vitest、Playwright Electron、electron-builder。

### Task 1：锁定失败测试和安全契约

**Files:**

- Modify: src/renderer/shells/api-keys/ApiKeysPage.test.ts
- Modify: src/renderer/shells/overview/OverviewPage.test.ts
- Modify: src/renderer/shells/floating/FloatingWindow.test.ts
- Modify: electron/shared/contracts.test.ts
- Modify: electron/main/services/site-service.integration.test.ts
- Modify: tests/e2e/electron-smoke.spec.ts

- [ ] 增加 API 页面填满剩余高度、左右独立滚动和分组菜单 portal/上下翻转测试。
- [ ] 增加“智商检测中心”打开后无默认站点、列出全部站点与脱敏当前 Key、不可用项禁用的测试。
- [ ] 增加 Renderer 仅提交 siteId、主进程解析完整 Key、固定禾维 HTTPS origin、自动填充但不自动提交的安全测试。
- [ ] 将悬浮窗字号期望改为 20px。
- [ ] 运行定向测试，确认新增断言因缺失实现而失败。

### Task 2：修复 API 密钥页面高度和分组菜单

**Files:**

- Modify: src/renderer/shells/api-keys/ApiKeysPage.tsx
- Modify: src/renderer/shells/api-keys/api-keys.css
- Modify: src/renderer/shells/api-keys/ApiKeysPage.test.ts

- [ ] 修正页面、body、左右面板和表格滚动区的 flex/grid 高度链，使右侧面板始终填满内容区剩余高度。
- [ ] 让左侧渠道卡片列表使用自身剩余高度滚动，移除依赖视口固定减法的高度控制。
- [ ] 将 GroupSelect 菜单 portal 到 document.body，按触发器视口坐标计算上下方向和最大高度。
- [ ] 在滚动、缩放、站点切换或触发器卸载时关闭或重算菜单，保留现有键盘选择、写入和失败回滚语义。
- [ ] 运行 API 密钥页定向测试直到通过。

### Task 3：新增禾维 AI 站点选择和受控内嵌页

**Files:**

- Modify: src/renderer/App.tsx
- Modify: src/renderer/preview/types.ts
- Modify: src/renderer/shells/overview/OverviewPage.tsx
- Modify: src/renderer/shells/overview/overview.css
- Modify: src/renderer/shells/overview/OverviewPage.test.ts
- Modify: electron/shared/contracts.ts
- Modify: electron/shared/contracts.test.ts
- Modify: electron/main/services/site-service.ts
- Modify: electron/main/services/site-service.integration.test.ts
- Modify: electron/main/index.ts
- Modify: electron/preload/index.ts
- Modify: electron/preload/bridge.cts
- Modify: tests/e2e/electron-smoke.spec.ts

- [ ] 在全部站点页面增加“智商检测中心”入口和站点选择弹层，初始选择值为空。
- [ ] 复用每站现有当前 Key 上下文，只显示 Key 名称和 maskedLabel；无 Key、无效地址或失效项显示原因并禁用。
- [ ] Renderer 选择后只把 siteId 交给命名 IPC，不传完整 Key 或完整凭据。
- [ ] 主进程再次读取站点和当前 Key，创建固定禾维 HTTPS 页的 WebContentsView，并应用现有导航、新窗口、下载和权限限制。
- [ ] 页面加载后用最小 DOM 选择器集合填入接口地址和 API Key，派发 input/change 并回读校验；不得点击检测按钮，不得把 Key 写入 URL、日志、错误文本或持久化数据。
- [ ] 提供返回全部站点、重新选择、刷新和关闭操作，以及 loading、filled、fill-error、load-error 反馈。
- [ ] 运行 Renderer、契约、服务和 Electron E2E 定向测试直到通过。

### Task 4：缩小悬浮窗统计字号

**Files:**

- Modify: src/renderer/shells/floating/floating.css
- Modify: src/renderer/shells/floating/FloatingWindow.test.ts

- [ ] 将 .floating-metrics b 从 24px 调整为 20px。
- [ ] 保持两列布局、数值格式、双击导航和底部状态栏不变。
- [ ] 运行悬浮窗定向测试。

### Task 5：修复使用记录全部 API Key 筛选

**Files:**

- Modify: src/renderer/shells/usage/UsagePage.tsx
- Modify: src/renderer/App.tsx
- Modify: src/renderer/shells/usage/usage-load-coordinator.ts
- Modify: src/renderer/shells/usage/UsagePage.test.ts
- Modify: src/renderer/shells/usage/usage-load-coordinator.test.ts

- [ ] 先增加失败测试，证明“全部”查询不携带旧 apiKeyId，且新查询结果不会被旧请求覆盖。
- [ ] 在查询边界统一把空 API Key 筛选归一为 undefined，切换“全部”时清除旧 Key 状态并重新加载列表与统计。
- [ ] 保留具体 Key 查询、时间范围、分页、错误和重试语义。
- [ ] 运行 UsagePage 与 UsageLoadCoordinator 定向测试。

### Task 6：文档、版本、验证和发布

**Files:**

- Modify: liran_docs/04-开发追踪.md
- Modify: liran_docs/08-测试用例.md
- Modify: liran_docs/09-真机实测.md
- Modify: affected files under liran_docs/modules/
- Modify: docs/pitfalls/README.md and confirmed related pitfall files
- Modify: liran_docs/requirements/REQ-260920-api-key-hvoyai-floating-polish-评分记录.md
- Modify: package.json
- Modify: package-lock.json
- Modify: CHANGELOG.md

- [ ] 更新开发追踪、测试用例、真机清单、长期模块事实和已确认的新踩坑；不写未经验证的结论。
- [ ] 运行 npm test、npm run typecheck、npm run lint、npm run format:check、npm run build 和 npm run test:e2e。
- [ ] 在 macOS 打包应用完成 API 页面、分组菜单、站点选择、禾维真实页填充、刷新/重选/关闭及悬浮窗视觉检查；证据脱敏保存。
- [ ] 递增 SemVer 并更新 CHANGELOG；从同一提交构建 macOS ARM64 DMG 和 Windows x64 NSIS。Windows 只记录交叉构建证据。
- [ ] 检查完整 diff 和敏感信息，创建 Conventional Commit，分别推送 github 与 origin 当前发布分支。
- [ ] 执行 npm run release:publish -- --notes 与 CHANGELOG 一致的说明，并验证 Tag、Release、DMG、EXE、blockmap 和 update-manifest.json。
- [ ] 写入修改后评分和 goal_status=reclaimed，将项目状态设为待用户检查、资料状态设为待归档确认；不创建归档包。
