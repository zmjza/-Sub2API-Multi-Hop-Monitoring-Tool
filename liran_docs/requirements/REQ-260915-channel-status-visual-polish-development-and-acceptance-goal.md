你自行判断本任务是否需要多智能体协作；如需开启，只允许一个主智能体统筹，任一时刻最多同时运行五个子代理，子代理完成后必须及时回收，回收后可按需启用新的子代理，禁止子代理继续派生代理。

请直接开始执行下面步骤，先审计 documentation 产物，再按微观任务顺序做 TDD 实现、内部验证、macOS 源码真机、问题回写、修复复测和修改后评分，不要先解释。

目标提示词类型：普通
文件指针型：是
任务 ID：REQ-260915-channel-status-visual-polish
流程档位：深度流程
修改前评分：86/100
五维评分：项目现状 16、修改规模 18、依赖与修改后影响 18、风险与回滚 16、验证复杂度 18
评分证据：documentation 1/2 已核对渠道页、弹层、API 密钥、使用记录两种模式、悬浮窗、测试弹窗、全部站点操作行、chromeExecutableCandidates、雷达/Sub2API/常用网站 setWindowOpenHandler 及 720px/1260px/380×260 约束；评分记录 86/100。
当前阶段：development-and-acceptance
目标阶段：development-and-acceptance
当前目标：第 2 / 2 次
目标 N/M：第 2 / 2 次
UI 目标：跳过
验收责任：Codex 真机测试
页面样式检查：是
归档阶段：handoff

产品需求以正式 PRD 当前正文为准，不得摘要掉 REQ/AC 细节。微观任务以 task-breakdown 当前正文为准。
无人值守：涉及真实 Chrome 会话、登录态、标签页或扩展时优先使用 Chrome 控制；无法完成时自动切换电脑控制，从当前步骤继续。可组合命令行、浏览器、Chrome 和电脑控制，不得要求用户代为操作，不得再问工具选择或是否继续。只有登录凭据、验证码、账号权限、付款授权、不可逆确认或外部服务客观不可用等真实硬性阻塞才能暂停。

必须读取：

- AGENTS.md、docs/pitfalls/README.md、docs/pitfalls/rate-comparison.md、docs/pitfalls/electron-build.md
- liran_docs/requirements/REQ-260915-channel-status-visual-polish-PRD.md
- liran_docs/requirements/REQ-260915-channel-status-visual-polish-需求整理.md
- liran_docs/requirements/REQ-260915-channel-status-visual-polish-task-breakdown.md
- liran_docs/requirements/REQ-260915-channel-status-visual-polish-documentation-audit.md
- liran_docs/03-索引.md、04-开发追踪.md、08-测试用例.md、09-真机实测.md、10-UI壳接入清单.md
- 受影响模块：09 渠道状态、07 API-Key、08 使用记录、02 悬浮窗、10 全站总览、01 应用外壳、14 IPC、06 适配器、11 调度
- 正式 PRD 第 13 节列出的实现入口与对应测试
- 当前 Git 状态、package.json、发布脚本和 CHANGELOG

允许修改：

- 本任务文件白名单内的 src、electron、对应测试、局部 CSS、必要契约
- liran_docs/03、04、08、09、10、受影响模块长期事实、docs/pitfalls
- 本任务版本号、CHANGELOG、发布所需脚本调用结果记录
  禁止修改：
- 独立 UI 壳、Stitch、外部 AI 产物
- interactive-auth-window 策略
- V1 优先、V2 回退探测顺序和渠道调度周期
- REQ-260904 非动效业务；动效冲突时只覆盖 MOT-2608 动效规则
- 数据库删除、认证迁移、支付改造、无关模块

执行顺序：先审计 documentation 产物存在且非占位，再按 SEC-2614 → TL-2601 / PLAT-2603 / USAGE-2609 / MOT-2611 / PAY-2616 / OPEN-2617 → CARD-2605 → CARD-2606 → TL-2602 / PLAT-2604 → KEY-2607 → KEY-2608 → USAGE-2610 → MOT-2612 → FLT-2613 / TEST-2615 → QA-2618。每个含分支逻辑的任务先补失败测试再最小实现。

必须一次性覆盖 REQ-01～REQ-11 与 AC-01～AC-10，来源编号 REQ-1～REQ-12 不得遗漏。实现时至少落到：

- 全入口 18 格时间线，含渠道页、全部站点弹层、API 密钥左侧、悬浮窗；空槽左补、最新在右；V2 的 90m/24h/7d/30d 仍是 18 槽
- 平台五类分类与图标颜色，主渠道页/API 密钥完整分类头，弹层和悬浮窗紧凑摘要
- V1/V2 统一外壳但指标不混用；V2 缓存率、可用率、首 Token 永远一行
- API 密钥宽窗口渠道区+表格，窄窗口隐藏渠道区；一行一张完整卡；默认 OpenAI；去重分组名；名称水平垂直居中
- 使用记录中转站与 OpenCodex 中文日期时间、整点小时、开始 00:00、结束 23:59:59、真实查询/CSV 口径
- 新全局动效覆盖菜单/页面/控件/状态，明显丝滑，支持 prefers-reduced-motion，冲突覆盖旧 MOT-2608 动效规则但不删旧任务其他业务
- 悬浮窗双击今日 Token/消费完整块，带当前站点、当前有效 Key、今日范围进入中转站使用记录；几何 380×260 不变
- 测试连通性弹窗按 started/delta/completed/failed/cancelled 和 30 秒超时 failed 做真实状态动效
- 全部站点卡片测试连通性右侧快捷充值：按 siteId 读 baseUrl，打开 origin+/purchase，Chrome 优先
- Sub2API/雷达/常用网站用户手势安全 http/https 外开系统浏览器，继续 deny Electron 新窗口，认证窗口仍全拒绝
- 共享安全：完整 Key/Token/Cookie/headers/凭据 URL 不进 Renderer、日志、截图、测试夹具或外开地址

验证要求：

- 相关单测、E2E、typecheck、lint、format、build
- Codex 用当前提交 npm run dev 打开可见 macOS Electron 源码窗口，按 09 RT-01～10 做真机和页面样式检查
- 同一提交 macOS build/pack 冒烟；Windows 只做 x64 交叉构建和结构证据
- git diff --check、敏感字段扫描
- 按项目规则递增 SemVer，写 CHANGELOG，Conventional Commit，推送 GitHub 与 Gitee，执行 npm run release:publish
- 修改后评分：项目现状、修改规模、依赖与修改后影响、风险与回滚、验证复杂度，总分 0–100，附真实 diff 证据

状态回写：

- 04-开发追踪.md：进行中 → 内部测试通过 → 待实测 → 真机测试通过
- 08-测试用例.md：TC-260915-01～24 只给真实跑过的项写结果
- 09-真机实测.md：RT-01～10 只给真实跑通项打勾
- 问题回写模块长期事实和 pitfalls；失败必须修复复测

完成条件：

- 当前目标完成开发、测试、验收、问题回写和必要修复
- AC-01～AC-10 均有真实自动化或 macOS 源码真机证据
- Windows 交叉构建边界表述准确，不得写成 Windows 真机通过
- 版本、CHANGELOG、双远端推送和 GitHub Release 资产验证完成
- 修改后评分已记录

下一阶段解锁条件：当前目标完成并已回收。先把 goal_status=reclaimed，项目状态：待用户检查，资料归档状态：待归档确认。用户检查期间不再执行当前目标。当前目标暂不执行正式归档，不清理活动文档，进入待用户检查和待归档确认。用户发现问题则回写修复复测；新增需求或优化回到需求整理或需求变更流程。只有用户明确回复“归档”后才调用正式归档模板。归档失败不得重新打开普通目标。
