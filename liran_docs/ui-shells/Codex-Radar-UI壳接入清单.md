# Codex Radar UI 壳接入清单

## 状态

`1.9.3 已接入；真机证据按本版本单独记录`。

本轮不再制作 Radar 数据页。正式“雷达”导航展示可持久化的 HTTPS 站点列表，支持新增、打开和删除；打开后在同一个主 `BrowserWindow` 的内容区域内使用 Electron `WebContentsView` 嵌入网页。默认项为：

| 名称                  | 地址                           |
| --------------------- | ------------------------------ |
| `Codex 雷达`          | `https://codexradar.com/`      |
| `分布式雷达 Codex 站` | `https://deng.codexradar.com/` |

## 入口与行为

- 主导航保留“雷达”，进入后异步读取本地 Radar 设置并渲染列表。
- 首次启动没有设置时写入两个默认项；用户已保存空数组时保持为空，不重新灌入默认值。
- 标题区右侧提供“新增雷达站点”按钮；空列表和读取失败态也提供新增或重试入口。
- 每个站点卡片是独立“打开”按钮，删除按钮为同级元素，不会因点击删除触发打开；名称和域名可换行。
- 新增弹窗只有名称和网址字段，只接受完整 `https://` URL；格式、重复、数量限制失败时保留输入并显示行内错误。
- 删除使用应用内二次确认，显示名称和网址；支持取消、确认删除、Esc、遮罩关闭、焦点陷阱、提交防重复和关闭后焦点恢复。
- 点击卡片后网页覆盖主窗口右侧内容区域；左侧应用导航和顶部应用控制区仍由项目 Renderer 管理。
- 顶部右侧显示应用自有的“关闭雷达网页”图标；点击图标或在远程网页获得焦点时按 `Esc`，移除远程视图并恢复动态列表。
- 远程页面加载失败或跨域导航被拦截时显示可理解错误状态，关闭图标仍可用。

## 数据与 IPC

- Radar 站点保存在 SQLite `settings` 表 `radar:entries`，结构为 `{ id, label, url }[]`，数组顺序即显示顺序，不额外建表。
- 共享 Zod 契约负责名称、URL、重复项和数量校验；新增 ID 由主进程生成并持久化，Renderer 打开时只发送不透明 ID。
- `radar:list` 返回全部条目；`radar:create` 与 `radar:delete` 返回更新后的完整列表；`radar:open` 发送 ID，由主进程重新读取 URL。
- Renderer 不获得任意 URL 直接打开能力；删除正在打开的条目时主进程先关闭视图并通知 Renderer 回到 idle。

## 视图接线

- `src/renderer/App.tsx` 维护 Radar 嵌入状态和 toolbar 关闭按钮；`RadarPage.tsx` 负责动态列表、新增/删除弹窗和打开/错误状态。
- `electron/preload/index.ts` 与 `electron/preload/bridge.cts` 只暴露受控 `list/create/delete/open/close/onStateChange`，不暴露任意 URL 打开能力。
- `electron/main/index.ts` 创建、挂载、resize 同步和清理 `WebContentsView`；当前窗口内容坐标按现有壳布局使用 `x=284`、`y=80`。
- 远程视图使用 `sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`、独立内存 `partition`，不注入项目 preload。
- 远程顶层导航仅允许当前条目 HTTPS origin；新窗口、弹窗、跨域顶层跳转和额外 webview 均阻止。
- 主窗口关闭、应用退出和视图自身销毁都清理远程 webContents，不能创建第二个 `BrowserWindow`，不能调用系统浏览器。

## 样式规格

- 卡片沿用浅色工作台、蓝色主操作、8px 圆角、稳定 hover/active/focus-visible 和键盘操作。
- 打开按钮与删除按钮同级，删除按钮有 tooltip/ARIA，不会因 hover 或 focus 造成布局跳动。
- 弹窗层级高于页面内容，宽窄窗口都可滚动；名称、网址、错误文案和长 URL 允许换行，不横向溢出。
- 远程网页的应用 toolbar、关闭按钮、左侧导航和网页边界不得互相覆盖；窗口缩放后视图仍贴合内容区。
- 视觉参考截图按 1.9.3 真机证据目录单独保存。

## 接收门禁

- [x] 正式主导航可打开，默认列表为两个站点且可新增/删除。
- [x] Renderer 不再依赖固定目标枚举或 `current.json`，只通过受控 IPC 操作条目。
- [x] HTTPS、重复项、数量上限、空数组和持久化语义有单测/E2E 覆盖。
- [x] 新增/删除弹窗支持 Esc、遮罩、焦点陷阱、防重复提交和错误保留。
- [x] 打开后 WebContentsView 安全隔离、关闭/Esc、错误恢复、resize 和退出清理已验证。
- [x] macOS 真机流程和页面样式检查按本版本证据目录记录；Windows 只做交叉构建，不写成真机通过。
