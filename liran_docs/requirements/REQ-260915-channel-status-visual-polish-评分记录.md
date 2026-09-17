# REQ-260915 多页面交互与渠道体验优化 · 评分记录

## 评分状态

- 任务 ID：REQ-260915-channel-status-visual-polish
- 评分阶段：正式 PRD 转换后评分
- 评分日期：2026-09-17
- 总分：86/100
- 流程等级：深度流程
- 最终流程：深度流程
- 评分分段：70–89 为深度流程
- 评分证据：已核对渠道页/弹层/悬浮窗/API 密钥/使用记录/App/契约/主进程服务/测试弹窗/全部站点卡片操作行/Chrome 探测/雷达与 Sub2API 与常用网站窗口拦截点及现有窗口约束。
- 范围上限：老项目既有页面与共享数据链路的跨模块改造；不扩展为新产品、数据库迁移或技术栈迁移。
- 安全门禁：涉及 API Key 安全边界、共享渠道载荷、跨窗口上下文、外部 URL 打开和真实站点数据，最低不得低于深度流程。
- 项目级完整条件：未命中新项目、整体架构重构、大规模数据/技术栈迁移或三个以上全新产品模块，因此不进入完整流程。
- UI 决策：跳过独立 UI 壳阶段；在现有页面中直接完成 UI 改造、微调和少量新增。
- 目标节奏：深度直接改造，两次目标：文档/任务/验收准备（1/2）→ 开发、内测、macOS 真机验收与交接（2/2）。
- 评分性质：修改前/PRD 转换后的当前基线；开发后必须依据真实 diff、调用方变化和验证证据重新评分。

## 五维评分

项目现状：16
修改规模：18
依赖与修改后影响：18
风险与回滚：16
验证复杂度：18
总分：86/100

| 维度             |  分数 | 证据                                                                                                                                                                                                 |
| ---------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 项目现状         | 16/20 | Electron + React 多页面和共享 App 状态已存在；V1/V2 载荷、API 密钥、使用记录、悬浮窗、测试弹窗和三类内嵌页已有实现，但时间线仍有 20/24/14/30 旧口径，API 密钥页尚无渠道区，内嵌页新窗口仍一律 deny。 |
| 修改规模         | 18/20 | 跨渠道状态、全部站点弹层、API 密钥、使用记录两种模式、悬浮窗、App 导航、全局样式/动效、测试弹窗状态、快捷充值和三类内嵌页外开策略。                                                                  |
| 依赖与修改后影响 | 18/20 | 需要共享渠道 loader/cache、扩展 API 密钥 Props/App 接线、小时查询契约、跨窗口导航上下文，并改雷达/Sub2API/常用网站 setWindowOpenHandler，复用 chromeExecutableCandidates 做普通外开。                |
| 风险与回滚       | 16/20 | 不涉及数据库删除、支付或认证协议迁移；新增风险集中在外部 URL 打开、浏览器回退和内嵌页安全策略，必须继续拒绝危险协议与凭据 URL。                                                                      |
| 验证复杂度       | 18/20 | 需要单测、契约/集成测试、Renderer/Electron E2E、宽窄窗口视觉检查、测试弹窗状态、系统浏览器外开、V1/V2/空态/错误态/旧响应竞态、macOS 真机与 Windows 交叉构建证据。                                    |

## 流程判断

- 深度流程下限：跨多个已有 UI 模块、共享状态和公共数据链路改造，并涉及 API Key 安全边界、跨窗口导航、外部 URL 打开和真实页面验收。
- 不进入完整流程：没有新产品、数据库/技术栈迁移、整体架构重构或三个以上全新独立产品模块。
- 可能升档：若小时筛选需要新增复杂上游聚合服务，或共享渠道载荷需要重做公共协议/缓存架构，正式开发评分可能升档。
- 安全门禁：即使分数变化，涉及 Key 安全、共享载荷、跨窗口状态和外部 URL 打开的实现不得低于深度流程。

## 评分依据文件

- liran_docs/requirements/REQ-260915-channel-status-visual-polish-需求整理.md
- liran_docs/requirements/REQ-260915-channel-status-visual-polish-PRD.md
- src/renderer/shells/channels/ChannelsPage.tsx
- src/renderer/shells/api-keys/ApiKeysPage.tsx
- src/renderer/shells/usage/UsagePage.tsx
- src/renderer/shells/usage/OpenCodexUsagePage.tsx
- src/renderer/shells/floating/FloatingWindow.tsx
- src/renderer/shells/overview/OverviewPage.tsx
- src/renderer/shells/overview/ConnectivityTestModal.tsx
- src/renderer/App.tsx
- electron/shared/contracts.ts
- electron/main/index.ts
- electron/main/services/site-service.ts
- electron/main/services/connectivity-test.ts
- electron/main/services/chrome-auth-policy.ts
- electron/main/services/sub2api-server-manager.ts
- electron/main/services/favorite-websites-manager.ts

## 修改后阶段评分（2026-09-17）

- 当前总分：87/100，仍为深度流程；未因分数变化升档。
- 项目现状：17/20。18 格时间线、五类平台、API 密钥双栏、中文小时筛选、快捷充值和安全外开路径均已落到当前源码；源码真机仍有边界项待补。
- 修改规模：18/20。实际 diff 覆盖 Renderer、Electron 主进程/IPC、测试、CSS、长期文档与避坑记录，仍未扩展数据库或技术栈。
- 依赖与修改后影响：18/20。API 密钥表列宽、隐藏滚动条但保留滚动、五控件操作行和使用记录结束边界均已修复并有单测/真机截图；外部页面和打包发布仍影响最终收口。
- 风险与回滚：16/20。凭据不进入 Renderer/日志/截图的约束与危险 URL 拒绝仍保留；系统浏览器外开和真实 Chrome 依赖继续要求边界复测。
- 验证复杂度：18/20。相关 Vitest 已通过，宽窗/900px 窄窗 API 密钥、日期小时、快捷充值和雷达外开已有源码真机证据；减少动态效果、失败/取消/超时和完整三类外开还未全部执行。

评分证据：`npx vitest run src/renderer/shells/overview/OverviewPage.test.ts src/renderer/shells/usage/UsagePage.test.ts src/renderer/shells/api-keys/ApiKeysPage.test.ts electron/shared/usage-datetime.test.ts` 通过；真机证据见 `real-test-evidence/macos-REQ-260915/rt-api-key-final.png`、`rt-api-key-narrow-900.png`、`rt-overview-final.png`、`rt-04-custom-hour-result-after-label.png`、`rt-purchase-chrome.png`、`rt-radar-main-after-external.png`。本评分不代表已完成打包、双远端推送或 GitHub Release。

## 修改后最终评分（2026-09-17，3.0.0 打包后）

- 总分：88/100，仍为深度流程；未因分数变化升档。
- 项目现状：18/20。18 格时间线、五类平台、API 密钥双栏、中文小时筛选、快捷充值、安全外开和 3.0.0 双平台产物均已落到当前源码与构建产物。
- 修改规模：18/20。实际 diff 覆盖 Renderer、Electron 主进程/IPC、测试、CSS、长期文档与避坑记录，仍未扩展数据库或技术栈。
- 依赖与修改后影响：18/20。API 密钥表列宽、隐藏滚动条但保留滚动、五控件操作行和使用记录结束边界均已修复；外开策略和发布脚本沿用现有通道。
- 风险与回滚：16/20。凭据不进入 Renderer/日志/截图的约束与危险 URL 拒绝仍保留；系统浏览器外开和真实 Chrome 依赖的未点开分支保持部分通过。
- 验证复杂度：18/20。Vitest 62/477、typecheck/lint/format、E2E last-run passed、macOS DMG 与 Windows x64 交叉构建结构证据已齐；OpenCodex 真机小时筛选、系统减少动态效果、连通性失败/取消/超时未全部真机执行。

评分证据：`npm test` 62 files / 477 passed；`npm run typecheck`、`npm run lint`、`npm run format:check`、`git diff --check` 通过；`test-results/.last-run.json` status=passed；macOS `Sub2API-Multi-Hub-Monitor-3.0.0-mac-arm64.dmg` SHA-256 `9e9ae967d674724f9677d9203476604b5a8bd3d3b0fbf218600af5ea9957a912`；Windows `Sub2API-Multi-Hub-Monitor-3.0.0-win-x64.exe` SHA-256 `48b1127bdb9b290f84e4b12bab517cf296aadd36c496f81508733fc4d761575b`；win-unpacked `Sub2API-Monitor.exe` 为 PE32+ x86-64，asar version=3.0.0。
