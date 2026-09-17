你自行判断本任务是否需要多智能体协作；如需开启，只允许一个主智能体统筹，任一时刻最多同时运行五个子代理，子代理完成后必须及时回收，回收后可按需启用新的子代理，禁止子代理继续派生代理。

请直接开始执行下面步骤，先读取对应文档，再输出结果，不要先解释。

目标提示词类型：普通
文件指针型：是
任务 ID：REQ-260915-channel-status-visual-polish
流程档位：深度流程
修改前评分：86/100
五维评分：项目现状 16、修改规模 18、依赖与修改后影响 18、风险与回滚 16、验证复杂度 18
评分证据：已核对渠道页、全部站点弹层、API 密钥、使用记录两种模式、悬浮窗、测试弹窗、全部站点卡片操作行、chromeExecutableCandidates、雷达/Sub2API/常用网站 setWindowOpenHandler 及 720px/1260px/380×260 窗口约束；评分记录为 86/100。
当前阶段：documentation
目标阶段：documentation
当前目标：第 1 / 2 次
目标 N/M：第 1 / 2 次
UI 目标：跳过
验收责任：Codex 真机测试
页面样式检查：是

本目标只做文档、任务拆分、微观任务、开发追踪和验收准备，禁止修改实现源码、做 UI 施工、真机验收或归档。产品需求以正式 PRD 当前正文为准，不得摘要掉 REQ/AC 细节。
无人值守：本目标只做文档，不启动浏览器或电脑控制；执行期间不得要求用户代为操作或再次确认是否继续。

必须读取：

- liran_docs/requirements/REQ-260915-channel-status-visual-polish-PRD.md
- liran_docs/requirements/REQ-260915-channel-status-visual-polish-需求整理.md
- liran_docs/requirements/REQ-260915-channel-status-visual-polish-评分记录.md
- liran_docs/用户原话.md
- liran_docs/03-索引.md
- liran_docs/04-开发追踪.md
- liran_docs/08-测试用例.md
- liran_docs/09-真机实测.md
- liran_docs/10-UI壳接入清单.md
- docs/pitfalls/README.md、docs/pitfalls/rate-comparison.md、docs/pitfalls/electron-build.md
- 正式 PRD 第 13 节列出的实现入口，只读核对，不改代码

允许修改：

- liran_docs/requirements/ 下本任务文档，包括新建 task-breakdown
- liran_docs/03-索引.md、04-开发追踪.md、08-测试用例.md、09-真机实测.md、10-UI壳接入清单.md
- 本任务确实改动到的 modules 长期事实，以及 docs/pitfalls 中与本任务相关的条目/索引
  禁止修改：
- src、electron、测试实现、构建配置、package.json 版本、CHANGELOG、发布资产
- 独立 UI 壳、Stitch、外部 AI 产物
- 其他活动任务正文，尤其不得改写或接管 REQ-260904-usage-navigation-motion 的非动效业务

必须一次性覆盖正式 PRD 的 REQ-01～REQ-11 与 AC-01～AC-10，来源编号 REQ-1～REQ-12 不得遗漏。拆分时至少单独落到微观任务：

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

验收准备必须写入：Codex 用当前提交 npm run dev 打开可见 macOS Electron 源码窗口做真机和页面样式检查；随后同一提交做 macOS build/pack 冒烟；Windows 只做 x64 交叉构建和结构证据。08/09 新增条目一律待执行，不得提前写成通过。

验证要求：

- 以正式 PRD 当前内容核对任务树、微观任务、04/08/09/10 与 AC 追踪矩阵一一对应
- 运行必要文档/格式检查；git diff --check
- 确认 src/ 与 electron/ 没有本目标产生的实现源码 diff
- 发现遗漏先补文档再结束，不得宣称已解锁开发

状态回写：

- 03-索引.md：本任务进入 documentation 1/2 已完成、待开发
- 04-开发追踪.md：只追加本任务活动段，写清微观任务、依赖、允许文件、测试方式和状态=待开发
- 08-测试用例.md、09-真机实测.md：追加本任务待执行项
- 10-UI壳接入清单.md：记录现有页面接线，明确无独立 UI 壳
- 回写本任务 documentation-goal 完成证据；提示词状态保持可交接，不归档

完成条件：

- 本任务全部已确认需求都已拆成可执行微观任务，编号稳定，文件白名单和完成条件可核对
- 03/04/08/09/10 与 PRD/AC 一致且非占位
- 无实现源码 diff，无通过/已完成/已归档误标
- 下一目标所需前置产物真实存在

下一阶段解锁条件：documentation 产物审计通过后，才能生成并执行 development-and-acceptance 第 2 / 2 次。下一目标才允许改 src/electron、TDD、内部验证、macOS 真机、问题回写和修改后评分。本目标不得进入编码解锁，不得创建归档。

## 完成证据（documentation 1/2）

- 任务拆分：liran_docs/requirements/REQ-260915-channel-status-visual-polish-task-breakdown.md，微观任务 SEC-2614～QA-2618，覆盖 REQ-01～REQ-11 与 AC-01～AC-10。
- 03-索引.md：状态改为 documentation 1/2 已完成、待开发。
- 04-开发追踪.md：已追加本任务活动段，状态=待开发。
- 08-测试用例.md：TC-260915-01～24，状态待执行。
- 09-真机实测.md：RT-01～10，状态待执行。
- 10-UI壳接入清单.md：记录现有页面接线，明确无独立 UI 壳。
- 模块长期事实：09/07/08/02/10/01/14 已前置本任务事实；06/11 明确不改探测顺序/调度。
- pitfalls：rate-comparison.md 新增 18 格槽位；electron-build.md 新增内嵌页外开；README 条目数为 41/16。
- 审计：liran_docs/requirements/REQ-260915-channel-status-visual-polish-documentation-audit.md。
- 提示词状态：可交接，不归档。本目标未修改 src/ 与 electron/。
