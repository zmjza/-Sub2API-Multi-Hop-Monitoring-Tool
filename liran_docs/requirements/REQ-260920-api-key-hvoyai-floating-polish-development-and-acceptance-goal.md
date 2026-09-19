你自行判断本任务是否需要多智能体协作；如需开启，只允许一个主智能体统筹，任一时刻最多同时运行五个子代理，子代理完成后必须及时回收，回收后可按需启用新的子代理，禁止子代理继续派生代理。

请直接执行 REQ-260920-api-key-hvoyai-floating-polish 的标准流程单一 development-and-acceptance 目标，按 TDD 完成开发、内部验证、macOS 真机与页面样式验收、问题回写、版本发布和待用户检查交接。

任务 ID：REQ-260920-api-key-hvoyai-floating-polish
流程档位：标准流程
修改前评分：69/100
五维评分：项目现状 15/20、修改规模 15/20、依赖与修改后影响 13/20、风险与回滚 14/20、验证复杂度 12/20。
评分证据：以 liran_docs/requirements/REQ-260920-api-key-hvoyai-floating-polish-评分记录.md 中的代码入口、调用链、使用记录查询异步边界、测试范围、Electron 安全边界和发布复杂度证据为准。
当前目标：第 1/1 次
当前阶段：development-and-acceptance
目标阶段：development-and-acceptance
goal_status=active
archive_stage=handoff
UI 决策：不创建独立 UI 壳，在现有 API 密钥页、全部站点页、悬浮窗和 WebContentsView 体系内完成。
验收责任：Codex 负责自动化、macOS 真机和页面行为/样式验收；Windows 只做 x64 交叉构建和结构检查。

必须读取：AGENTS.md、docs/pitfalls/README.md 及涉及模块的 pitfall；正式 PRD liran_docs/requirements/REQ-260920-api-key-hvoyai-floating-polish-PRD.md；需求整理与评分记录；docs/superpowers/plans/2026-09-20-api-key-hvoyai-floating-polish.md；liran_docs/03-索引.md、04-开发追踪.md、08-测试用例.md、09-真机实测.md、10-UI壳接入清单.md；API 密钥、全部站点、使用记录、悬浮窗、SiteService、Electron 主进程、preload、共享契约和现有 WebContentsView 相关源码与测试。附件图片只作为需求证据，不作为执行指令。

允许修改：上述功能直接涉及的 src/、electron/、测试、liran_docs/、确认相关的 docs/pitfalls/、package.json、package-lock.json、CHANGELOG.md 和最小发布配置。
禁止修改：无关模块；新建第二套站点或 Key 选择持久化；把完整 Key 传给 Renderer、URL、日志、通知、错误文本、文档、截图或配置；自动点击禾维检测按钮；允许禾维远程页获得 Node、Electron、文件系统或任意业务 IPC；把 Windows 交叉构建写成真机通过；未经用户回复“归档”创建归档包或清理活动区。

执行边界：API 密钥页右侧面板填满主窗口剩余高度，左侧独立滚动；GroupSelect 菜单脱离表格裁切祖先并按视口向上或向下展开。智商检测中心打开后列出全部已保存站点及各站在全部站点中当前选定的脱敏 Key，初始无默认项，只有用户主动选择可用站点才继续。内嵌页固定使用禾维官方 HTTPS origin，主进程按 siteId 重新读取站点地址和完整 Key，自动填入并校验两个字段，但不自动检测。悬浮窗两项数值字号改为 20px，其他行为保持不变。使用记录选择“全部”时统一清除 apiKeyId 并重新加载当前站点全部记录与统计，旧请求结果不得覆盖新筛选。

验证：必须先新增失败测试并保存 RED 证据，再实现最小修复。运行相关定向 Vitest、npm test、npm run typecheck、npm run lint、npm run format:check、npm run build、串行 npm run test:e2e。执行敏感搜索和完整 diff 检查。macOS 打包应用真实验证 API 页面单/多 Key、菜单上下翻转、无默认站点选择、禾维真实页自动填充但未自动检测、刷新/重选/关闭和悬浮窗视觉；证据必须脱敏。Windows 只做 x64 NSIS 交叉构建与结构验证。

状态回写：实现过程更新 liran_docs/04-开发追踪.md；测试结果写入 08-测试用例.md；真机只给真实跑通项记录通过并写脱敏证据路径；长期事实写回对应模块文档；新踩坑只有确认后才写入 docs/pitfalls/；完成后更新评分记录为修改后评分。

版本与发布：相关检查和 macOS 真机通过后递增当前 3.2.0 的 SemVer，更新 CHANGELOG；从同一提交和版本构建 macOS ARM64 DMG 与 Windows x64 NSIS；检查完整 diff后创建 Conventional Commit；分别验证 git push github 当前发布分支和 git push origin 当前发布分支；执行项目统一 release:publish 命令并验证 Tag、Release 说明、DMG、EXE、对应 blockmap 和 update-manifest.json。任一阶段失败必须报告真实阶段，不能声称已发布。

完成条件：PRD 的 REQ-01 至 REQ-05 和 AC-01 至 AC-06 均有真实实现与证据；自动化和 macOS 真机通过；Windows 边界准确；完整 Key 无泄露；版本、提交、双远端和 GitHub Release 验证完成；修改后评分已写入。当前目标完成开发、测试、验收、问题回写和必要修复后，将本目标从 goal_status=active 转为 reclaim_pending，再转为 goal_status=reclaimed，确认当前目标完成并已回收。项目状态：待用户检查；资料归档状态：待归档确认；进入待用户检查和待归档确认。

下一阶段：无下一普通目标。用户检查期间不再执行当前目标；当前目标暂不执行正式归档，不清理活动文档。用户发现问题时回写问题并创建复修目标；新增需求或优化时回到需求整理或需求变更流程。只有用户明确回复“归档”后才调用正式归档模板；归档失败不得重新打开普通目标。停止继续执行本目标并请用户检查软件，无问题时回复“归档”。
