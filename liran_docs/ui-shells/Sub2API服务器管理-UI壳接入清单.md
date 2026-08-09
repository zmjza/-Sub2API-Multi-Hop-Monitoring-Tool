# Sub2API 服务器管理 UI 壳接入清单

## 状态

`2.0.0 进行中`。正式“Sub2API 服务器管理”导航承载用户绑定的二开站，不读取或修改 Radar 数据，不进入现有站点凭据/Token/监控流程。

## 入口与行为

- 主导航在“站点管理”与“雷达”之间新增“Sub2API 服务器管理”；首次进入显示空态，支持新增、查看、编辑、删除和打开。
- 卡片展示名称、域名、登录状态和最多 5 个快捷入口；快捷入口在卡片上不显示删除，只在编辑弹窗内增删改排序。
- 新增/编辑弹窗字段：名称、HTTPS 根地址、可选登录页识别规则、快捷入口列表。字段有行内校验，提交防重，Esc/遮罩关闭、焦点陷阱、关闭后焦点恢复和长文本防溢出。
- 删除使用应用内确认，展示服务器名称与地址；确认后主进程关闭视图并清理该服务器 partition 全部站点数据。
- 点击卡片或快捷入口后，在当前主窗口内容区用 Electron `WebContentsView` 内嵌网页；左侧导航和顶部应用控制区仍由项目 Renderer 管理。
- 内嵌工具栏提供返回、前进、主页、刷新、关闭；按钮状态由主进程广播；Esc 关闭；加载失败/登录过期显示可恢复状态。

## 数据与 IPC

- 服务器保存在 SQLite `settings` 键 `sub2api-servers:entries`，结构为 `{ id, name, baseUrl, loginRule?, shortcuts[], loginState, seenLoggedIn, createdAt, updatedAt, partitionId }[]`。
- 共享 Zod 契约负责 HTTPS-only、重复名称/地址、50 项上限、快捷入口 5 项上限与同源 path；新增 ID 和 partitionId 由主进程生成。
- Renderer 只发送不透明 ID 与输入；`sub2api-servers:list/create/update/delete/open/close/back/forward/reload/home/clear-session` 都校验发送者。

## 视图接线

- `src/renderer/App.tsx` 维护 Sub2API 服务器嵌入状态、toolbar 和导航；`Sub2ApiServersPage.tsx` 负责列表、卡片、编辑/删除弹窗和打开/错误状态。
- `electron/preload/index.ts` 与 `electron/preload/bridge.cts` 只暴露受控服务器方法与 `onStateChange`。
- 主进程独立服务创建、挂载、resize 同步和清理 `WebContentsView`；使用 `persist:sub2api-server-<id>` 分区，不注入项目 preload。
- 远程顶层导航仅允许当前服务器 HTTPS origin；新窗口、弹窗、跨域顶层跳转和额外 webview 均阻止。

## 样式规格

- 沿用现有浅色工作台、蓝色主操作、8px 圆角、稳定 hover/active/focus-visible 和键盘操作。
- 卡片主体、编辑、删除、快捷入口为同级交互元素，禁止嵌套 button；快捷入口为小标签/图标按钮，无删除按钮。
- 内嵌 toolbar、左侧导航、远程网页边界和主窗口缩放不得互相覆盖；宽窄窗口均可滚动，长文本换行不横向溢出。

## 接收门禁

- [ ] 正式主导航可进入，空态、CRUD、编辑、删除确认和最多 5 个快捷入口完整。
- [ ] 内嵌网页使用独立持久化分区，重启保留登录态；清除会话和删除清理已实现。
- [ ] HTTPS、重复项、数量上限、同源快捷入口和登录状态规则有单测/E2E 覆盖。
- [ ] macOS 真机与页面样式检查按 2.0.0 证据目录记录；Windows 只做交叉构建。
