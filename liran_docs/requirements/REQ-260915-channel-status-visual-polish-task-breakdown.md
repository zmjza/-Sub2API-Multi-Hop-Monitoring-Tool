# REQ-260915 多页面交互与渠道体验优化 · 任务拆分

任务 ID：REQ-260915-channel-status-visual-polish
阶段：documentation 1/2 已完成，待开发
流程：深度非 UI，跳过独立 UI 壳
状态：待开发。本文件只拆任务，不修改 src/ 或 electron/。

## 范围

按正式 PRD v1.2 一次性覆盖 REQ-01～REQ-11、来源 REQ-1～REQ-12、AC-01～AC-10。直接在现有页面改造。探测顺序以 PRD 为准：V1 优先、明确不可用才回退 V2。不接管 REQ-260904 非动效业务；动效冲突时覆盖 MOT-2608。认证窗口继续全部拒绝。

## 微观任务

| ID         | REQ    | AC           | 依赖                 | 主要文件                                                                                                                                               | 测试方式                                                                                 | 完成条件                                                                                                                                                                         | 真机影响             |
| ---------- | ------ | ------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| SEC-2614   | REQ-08 | AC-07        | 无                   | electron/shared/contracts.ts；electron/main/services/site-service.ts；渠道适配器/loader/cache；preload 白名单                                          | 契约单测、敏感字段扫描、旧响应/切站测试                                                  | 全入口共用站点级安全载荷；完整 Key/Token/Cookie/headers/凭据 URL 不进 Renderer、日志、截图、测试夹具或外开地址；401/403、429/5xx/超时、unsupported、empty 可区分                 | 无直接 UI            |
| TL-2601    | REQ-01 | AC-01        | SEC-2614             | src/renderer/shells/channels/data.ts（channelTimelineForDisplay）；electron/main/adapters/channel-monitor-v2.ts（V2_MATRIX_LENGTH）；channels/types.ts | 0/1/17/18/19+、无效/未来/未知、V2 四窗单测                                               | 共享 18 槽；真实记录旧到新、最新在右；不足左补空槽且空槽不计入可用率；V2 的 90m/24h/7d/30d 都是 18 槽，时间窗只改数据范围                                                        | 渠道时间线           |
| PLAT-2603  | REQ-02 | AC-02        | SEC-2614             | channels/data.ts 或平台归一化辅助；types.ts                                                                                                            | 别名、缺失平台、其他平台、数量单测                                                       | 五类顺序固定 OpenAI、Anthropic、Grok、Gemini、其他；别名 openai/open_ai/chatgpt、anthropic/claude、grok/xai、gemini/google/google_gemini；其余归其他；图标颜色绿/橙/深灰/浅蓝/紫 | 分类头               |
| CARD-2605  | REQ-03 | AC-02        | TL-2601、PLAT-2603   | ChannelsPage.tsx、channels.css                                                                                                                         | V1/V2 字段隔离与视觉回归                                                                 | 统一外壳、图标容器、状态胶囊、间距和时间线形状；格子颜色语义不变只改形状；V1 显示对话延迟/端点 Ping/可用率/V1 时间线；V2 显示缓存率/可用率/首 Token/V2 时间线；不混用指标        | 渠道卡片             |
| CARD-2606  | REQ-03 | AC-02        | CARD-2605            | ChannelsPage.tsx、channels.css                                                                                                                         | 宽/窄窗口几何 E2E                                                                        | V2 缓存率、可用率、首 Token 永远一行三等分；窄窗只缩小间距和字号，不隐藏、不换行、无页面溢出                                                                                     | V2 卡片              |
| TL-2602    | REQ-01 | AC-01        | CARD-2606            | ChannelsPage.tsx；Overview 渠道弹层；ApiKeysPage 左侧卡；FloatingWindow.tsx；floating.css                                                              | 四入口 18 槽 E2E 与 ARIA                                                                 | 渠道页、全部站点弹层、API 密钥左侧、悬浮窗都是近 18 次；悬浮窗无障碍文案同步，不再写最近 20 次                                                                                   | 四入口时间线         |
| PLAT-2604  | REQ-02 | AC-02        | PLAT-2603、CARD-2605 | ChannelsPage.tsx；ApiKeysPage.tsx；Overview 弹层；FloatingWindow.tsx                                                                                   | 分类头/紧凑摘要视觉检查                                                                  | 主渠道页和 API 密钥左侧用完整分类头与数量；弹层和悬浮窗只显示紧凑摘要，不加五个分类头；其他分类内名称用运行时真实名称                                                            | 分类布局             |
| KEY-2607   | REQ-04 | AC-03        | TL-2602、PLAT-2604   | ApiKeysPage.tsx、api-keys.css、types.ts、App.tsx 共享渠道 loader/cache                                                                                 | 宽窄窗口、分类切换、空态/stale/error E2E                                                 | 宽窗口渠道区+表格；窄窗口真正隐藏渠道区且无空白占位；默认 OpenAI，不显示全部；一行一张完整卡，宽度等于渠道区；分类只改左侧，不自动过滤 Key、不改分组；复用站点级 loader          | API 密钥渠道区       |
| KEY-2608   | REQ-04 | AC-03        | KEY-2607             | ApiKeysPage.tsx、api-keys.css                                                                                                                          | 表格滚动、复制 Key、分组写入回归                                                         | 去掉分组下拉下方重复分组名；名称列水平垂直居中；九列不换行，空间不足只表内横滚，页面不溢出；不改复制/脱敏/分组回滚/分页                                                          | API 密钥表格         |
| USAGE-2609 | REQ-05 | AC-04        | SEC-2614             | UsagePage.tsx、OpenCodexUsagePage.tsx、usage 局部 CSS、应用内中文日期时间面板                                                                          | 中转站+OpenCodex 控件单测/组件测试                                                       | 两种模式都用中文日期时间面板；只选整点小时；开始未选小时默认 00:00，结束未选小时默认 23:59:59；反向范围阻止查询并中文报错                                                        | 使用记录筛选         |
| USAGE-2610 | REQ-05 | AC-04        | USAGE-2609           | UsageQuery 契约、主进程查询服务、opencodex-data.ts                                                                                                     | 同日/跨日/只填一端/整点边界、分页统计 CSV                                                | 列表、统计、分页、CSV 使用同一本地时区范围；上游仅日期则按日期超集读取后再按 createdAt 过滤                                                                                      | 使用记录口径         |
| MOT-2611   | REQ-06 | AC-05        | SEC-2614             | App 局部 CSS/motion token；现有页面局部样式                                                                                                            | token 与 prefers-reduced-motion 测试                                                     | 建立新动效 token；明显丝滑；减少动态效果时无位移或短过渡但仍有状态反馈；冲突覆盖 MOT-2608 动效规则，不删旧任务其他业务                                                           | 全局动效基础         |
| MOT-2612   | REQ-06 | AC-05        | MOT-2611             | App.tsx 菜单/切页；按钮卡片筛选下拉 Tab 刷新加载成功失败空态                                                                                           | 连续切页、焦点、请求次数                                                                 | 覆盖菜单、页面、控件、状态；切页有身份边界，旧请求/滚动/焦点不回写新页；不改窗口尺寸、拖动区和请求时序                                                                           | 菜单与页面动效       |
| FLT-2613   | REQ-07 | AC-06        | MOT-2612、USAGE-2610 | FloatingWindow.tsx、floating.css、App.tsx、跨窗口 IPC/路由                                                                                             | 双击 Token/消费、主窗打开/最小化/其他页、连续双击                                        | 双击今日 Token 或今日消费完整块进入中转站使用记录，带当前站点、当前有效 Key、今日范围；380×260 和非置顶层级不变；旧请求不回写                                                    | 悬浮窗快捷导航       |
| TEST-2615  | REQ-09 | AC-08        | MOT-2612             | ConnectivityTestModal.tsx、electron/main/services/connectivity-test.ts                                                                                 | started/delta/completed/failed/cancelled、30s 超时、关闭后迟到事件                       | 动效映射真实事件；超时仍是 failed + 测试超时；运行中可取消且禁止重复启动；迟到事件不改已关闭弹窗；保留真实用量风险提示；完整 Key 不进日志                                        | 测试弹窗             |
| PAY-2616   | REQ-10 | AC-09        | SEC-2614             | OverviewPage.tsx 操作行；chrome-auth-policy.ts 的 chromeExecutableCandidates；主进程 URL 打开                                                          | 尾斜杠、已含 /purchase、危险协议、凭据 URL、无 Chrome、连点                              | 测试连通性右侧快捷充值；按 siteId 读 site.baseUrl，origin + /purchase；Chrome 优先否则系统默认浏览器；禁止认证调试 Chrome；主程序保持可操作                                      | 全部站点卡片         |
| OPEN-2617  | REQ-11 | AC-10        | SEC-2614             | electron/main/index.ts 雷达视图；sub2api-server-manager.ts；favorite-websites-manager.ts                                                               | target=_blank/window.open/按钮跳转、危险协议、非用户手势                                 | 三类内嵌页用户手势 http/https 用系统浏览器外开；继续 deny Electron 新窗；认证窗口仍全拒绝；原内嵌页可返回且主程序可切回                                                          | 雷达/服务器/常用网站 |
| QA-2618    | 全部   | AC-01～AC-10 | 其余全部             | 08-测试用例.md、09-真机实测.md、相关单测/E2E/构建                                                                                                      | 开发目标才执行：Vitest、E2E、npm run dev 源码真机、build/pack 冒烟、Windows x64 交叉构建 | 每条 AC 有待执行用例和真机项；08/09 本阶段只准备，不得写成通过                                                                                                                   | 开发目标验收         |

## 依赖顺序

SEC-2614 → TL-2601 / PLAT-2603 / USAGE-2609 / MOT-2611 / PAY-2616 / OPEN-2617 → CARD-2605 → CARD-2606 → TL-2602 / PLAT-2604 → KEY-2607 → KEY-2608 → USAGE-2610 → MOT-2612 → FLT-2613 / TEST-2615 → QA-2618。

## 文件白名单（开发目标才改）

- 渠道：src/renderer/shells/channels/ChannelsPage.tsx、channels.css、types.ts、data.ts 及分类/时间线辅助。
- API 密钥：src/renderer/shells/api-keys/ApiKeysPage.tsx、api-keys.css、types.ts、src/renderer/App.tsx 共享渠道上下文。
- 使用记录：UsagePage.tsx、OpenCodexUsagePage.tsx、opencodex-data.ts、UsageQuery 契约和主进程查询服务。
- 悬浮窗/导航：FloatingWindow.tsx、floating.css、App.tsx、跨窗口 IPC/路由。
- 全部站点与测试：src/renderer/shells/overview/OverviewPage.tsx、ConnectivityTestModal.tsx、electron/main/services/connectivity-test.ts。
- 外部打开：electron/main/index.ts 雷达视图、electron/main/services/sub2api-server-manager.ts、favorite-websites-manager.ts、chrome-auth-policy.ts。
- 数据与安全：electron/shared/contracts.ts、electron/main/services/site-service.ts、渠道适配器/loader/cache。
- 对应测试文件与局部 CSS。interactive-auth-window 不纳入。

## 验收准备

- 测试矩阵：TC-260915-01～24，状态待执行，见 08-测试用例.md。
- 真机清单：RT-01～10 对应 AC-01～AC-10，状态待执行，见 09-真机实测.md。
- Codex 用当前提交 npm run dev 打开可见 macOS Electron 源码窗口做真机和页面样式检查；随后同一提交做 macOS build/pack 冒烟；Windows 只做 x64 交叉构建和结构证据。
- 本阶段不得把 08/09 写成通过、已完成或已归档。

## 边界

- 不创建独立 UI 壳、Stitch、外部 AI 产物。
- 不改版本号、CHANGELOG、发布资产。
- 不改 V1 优先探测顺序，不改渠道调度周期。
- 不删除 REQ-260904 的 OpenCodex/总览/嵌入业务。
