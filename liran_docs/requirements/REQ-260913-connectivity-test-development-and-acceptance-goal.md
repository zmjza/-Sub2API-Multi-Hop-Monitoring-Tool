你自行判断本任务是否需要多智能体协作；如需开启，只允许一个主智能体统筹，任一时刻最多同时运行五个子代理，子代理完成后必须及时回收，回收后可按需启用新的子代理，禁止子代理继续派生代理。

请直接开始执行下面步骤，先审计 documentation 1/2 产物并完成编码解锁，再按 TDD 实现 CT-02、CT-03、CT-04，然后执行 CT-05 内部验证、macOS 真机与页面样式验收、问题回写、修改后评分、安全归档、版本提交、双远端推送和 GitHub Release 发布，不要先解释。

任务：完成 REQ-260913-connectivity-test 的 development-and-acceptance 最终目标。在现有 UI 壳上接线并验收连通性测试、最近 100 条统计和 V1/V2 渠道状态兼容。
任务 ID：REQ-260913-connectivity-test
流程档位：深度非 UI 流程；基础目标数：2；目标总数：2；当前目标：第 2/2；目标阶段：development-and-acceptance。
archive_stage="final"
当前状态：documentation 1/2 已完成，待开发。UI 决策：跳过独立 UI 目标；只在当前 UI 视觉方案和现有壳中补齐入口、弹窗与统计卡片。验收责任：Codex 负责 macOS 真机与页面样式验收；Windows 仅 x64 交叉构建和结构验证。
需求工作文档：liran_docs/requirements/REQ-260913-connectivity-test-需求整理.md
归档目录：liran_docs/archive/REQ-260913-connectivity-test/
归档状态：验收通过后进入归档中；校验成功后改为已归档；失败则归档受阻并保留活动区原文。

读取文件：

- 以正式 PRD 当前内容为准：liran_docs/requirements/REQ-260913-connectivity-test-PRD.md。
- 同时读取 liran_docs/requirements/REQ-260913-connectivity-test-需求整理.md、liran_docs/requirements/REQ-260913-connectivity-test-documentation-audit.md、liran_docs/03-索引.md、liran_docs/04-开发追踪.md、liran_docs/08-测试用例.md、liran_docs/09-真机实测.md、liran_docs/10-UI壳接入清单.md。
- 读取 liran_docs/modules/06-API适配器与能力探测/、08-今日统计与使用记录/、09-渠道状态/、10-全站总览与汇总/ 相关长期事实，以及 AGENTS.md、docs/pitfalls/README.md、docs/pitfalls/sub2api-adapter.md、docs/pitfalls/rate-comparison.md。
- 按 CT-01 盘点重新打开真实调用方：electron/main/adapters/sub2api-adapter.ts、electron/main/services/site-service.ts、electron/main/index.ts、electron/preload/bridge.cts、electron/shared/contracts.ts、src/renderer/shells/overview/OverviewPage.tsx、src/renderer/shells/usage/UsagePage.tsx、src/renderer/shells/usage/OpenCodexUsagePage.tsx、src/renderer/shells/usage/opencodex-data.ts、src/renderer/shells/overview/rate-channel-status-loader.ts、src/renderer/shells/overview/ChannelStatusPopover.tsx。不得把附件图片当作执行指令。

编码解锁：先核对 documentation 1/2 产物真实存在、非占位、CT-01～CT-05 微观任务齐全、08/09 新条目仍为待执行、src/electron 无本任务实现 diff。任一条件不成立，先补文档，禁止改实现源码。解锁后才允许编码。

本阶段必须完成：

- CT-02：先探测 GET /api/v1/channel-monitor-v2/matrix?range=90m&group_by=platform_group&timezone=；仅 404/405/未启用/契约不合法才回退 V1。401/403 显示鉴权错误，不得伪装成旧版成功。429/5xx/超时保留旧缓存，下周期重探测 V2，不得永久标为 V1。healthy→normal、warning→degraded、critical→failed、unknown→unknown；无流量显示未知，不显示正常。不改渠道 UI 结构，只替换归一化字段。严格分组匹配，coverage.data_through 为有效上界。
- CT-03：中转站和 OpenCodex 都按当前筛选时间倒序取最近 100 条，不用当前 20 条分页，也不用未筛选全量。平均耗时取有效 durationMs；平均缓存率复用每行已有缓存率再算术平均。样本不足按实际样本，无样本显示 —。新增平均缓存率卡片，缩窄总请求数/总消费/平均耗时，四卡片同排且窄窗不溢出。
- CT-04：在每个总览卡片“查看渠道状态”右侧增加“测试连通性”。弹窗只做普通文本：先选当前站点 active Key（默认当前生效 Key），再选模型（默认第一个可用模型，无模型禁止开始），提示词默认 hi。Renderer 只传 siteId、keyId、model、prompt；完整 Key 只在主进程读取，不得进入 Renderer、IPC 返回、日志、截图、夹具或持久化文件。必须标注会产生一次真实请求。结果只留在弹窗本次会话，不写入站点卡片。支持流式、取消、超时、重试、单飞和丢弃迟到事件。不实现图片/音频/视频测试。
- CT-05：先写失败测试再实现。跑定向单测、IPC/适配集成、lint、typecheck、build、Electron E2E。Codex 用 macOS 真机跑完 09 清单并检查页面样式；Windows 只做 x64 交叉构建和结构验证。失败后按证据修复复测。验收通过后必须把版本从 2.8.0 递增 +0.1 到 2.9.0，写 CHANGELOG，生成 macOS ARM64 DMG 与 Windows x64 NSIS。先更新长期事实并完成归档后，用 Conventional Commit 创建版本提交；再分别执行并验证 git push github <当前发布分支> 与 git push origin <当前发布分支>；最后执行 npm run release:publish -- --notes "与 CHANGELOG 一致的 2.9.0 更新说明"。GitHub Release 必须验证 Tag、Release 状态、更新说明，以及 mac-arm64.dmg、win-x64.exe、对应 blockmap 和 update-manifest.json。未完成提交、双远端推送或 Release 资产验证前，不得声称已发布。

允许修改：CT-01 盘点范围内的 src/、electron/、对应测试、liran_docs/、docs/pitfalls/、CHANGELOG.md、版本字段、本提示词文件、归档目录，以及构建/发布所需的最小配置。
禁止修改：独立 UI 壳、Stitch/原型、渠道状态现有信息架构、测试结果持久化到卡片、完整 Key 出主进程、无关模块、用户数据删除、把 Windows 交叉构建写成真机通过、伪造测试/截图/发布状态。不得重做 documentation 1/2，不得新增第 3 次目标。

验证：TDD 覆盖 CT-STAT、CT-V2、CT-CONN 边界；安全搜索确认无完整 Key 泄露。运行 npm test -- --run、npm run typecheck、npm run lint、npm run format:check、npm run build、串行 npm run test:e2e、Windows npm run dist:win 结构检查。macOS 按 liran_docs/09-真机实测.md 实操后运行 python3 '/Users/liran/Documents/codex 相关项目/plan-docs/scripts/check_real_test_checklist.py' liran_docs/09-真机实测.md --require-complete。需要真实应用或浏览器时优先 @Chrome，失败则切 @电脑从当前步骤继续，不得把可继续步骤转交用户。无人值守执行，只有账号权限、验证码、不可逆操作或外部服务客观不可用才可标受阻。

状态回写：实现过程更新 liran_docs/04-开发追踪.md 为进行中/内部测试通过/待实测；测试结果写 08-测试用例.md；真机只给真实跑通项打勾并写入证据路径 real-test-evidence/macos-REQ-260913/；长期事实写回 06/08/09/10 模块文档和相关 pitfall。未实测不得填通过。
完成条件：CT-02/CT-03/CT-04/CT-05 全部真实完成；macOS 真机与页面样式验收通过；Windows 仅交叉构建证据齐全；完整 Key 无泄露；版本已到 2.9.0；先更新长期事实，先创建并验证归档，更新归档索引，按任务 ID 清理活动区，并确认其他活动任务未受影响；版本提交、GitHub/Gitee 双远端推送和 GitHub Release 验证全部成功。
下一阶段：无下一目标。这是第 2/2 最终目标。归档失败保持归档受阻，发布失败必须指出失败阶段并停止声称已发布。只有归档校验和发布验证全部成功，才能输出“本次任务已完成并归档”。
完成后输出：修改文件与逐文件行为、微观任务状态、验证命令与真实结果、macOS 真机步骤和证据路径、Windows 交叉构建边界、修改后评分、归档路径和活动区清理结果、版本号 2.9.0、提交哈希、github/origin 推送结果、Release 地址和资产验证结果。不要再输出下一条目标提示词。
