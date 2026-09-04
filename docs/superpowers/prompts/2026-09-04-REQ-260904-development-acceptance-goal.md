你自行判断本任务是否需要多智能体协作；如需开启，只允许一个主智能体统筹，任一时刻最多同时运行五个子代理，子代理完成后必须及时回收，回收后可按需启用新的子代理，禁止子代理继续派生代理。

请直接开始执行下面步骤，先审计已完成的 documentation 1/2 产物，再按深度流程最终目标执行全部已确认需求的 TDD 实现、内部验证、macOS 真机验收、问题回写、修改后复评和安全归档，不要先解释。

## 任务性质

这是老项目跨模块优化任务的最终 development-and-acceptance 目标。基础目标数为 2，目标提示词数量为 2，当前为第 2/2 次，目标阶段为 development-and-acceptance。文档目标已经完成并解锁本目标；本目标负责真实业务实现、内部自动化、macOS ARM64 真机、页面行为/样式检查、问题修复复测、长期事实回写、版本发布资料和最终归档。Windows 只能做 x64 交叉构建和结构检查，不能写成 Windows 真机通过。

## 当前场景

项目版本基线为 2.6.0，工作区位于 `/Users/liran/Documents/中转站悬浮窗`，任务 ID 为 `REQ-260904-usage-navigation-motion`。正式 PRD、设计文档、微观任务、开发追踪、测试用例和 macOS 待实测清单均已准备。当前没有新 UI 壳、Stitch 或外部视觉输入；只优化已有页面、组件、WebContentsView 和局部 CSS。

## 目标和完成结果

完成后必须实现并验证以下结果：

1. 全部站点总览删除渠道推荐卡片、文案、状态和占位；倍率 Popover、充值比例、渠道状态、手动关联、悬浮窗摘要和内部倍率逻辑继续可用。
2. OpenCodex 真实输入使用 `max(inputTokens - cacheReadInputTokens, 0)`，兼容 `cachedInputTokens`；缓存读取、缓存写入、输出、总数、耗时、首字和 t/s 使用正确字段。用户样例必须显示输入 3003、输出 223、缓存读取 266112、缓存写入 0、总 Token 269338、耗时 11.37s、首字 8.14s、19.61 t/s。
3. OpenCodex 默认请求最多 4000 条；Token 右侧新增缓存率列，复用 `src/renderer/shells/usage/cache-rate.ts` 的公式、格式和颜色。今天按本地当天 00:00 到当前时间；近 7 天/近 30 天按含今天的本地自然日；自定义范围包含完整端点。
4. Sub2API 服务器、Radar、常用网站分别增加模块内顶部横向胶囊切换；点击先反馈 active/loading，切换只挂载一个视图，旧响应不得覆盖新选择，失败优先恢复原页面并可重试，长名称具备 tooltip/ARIA，partition、白名单和登录隔离不变。
5. 全部站点、API 密钥、使用记录、渠道状态、站点管理、Sub2API 服务器、Radar、常用网站、通知、设置使用统一的克制高级感动效：页面/卡片 160–240ms，控件 120–180ms，支持 hover/press/focus-visible/loading/error/empty/modal/selected 和 `prefers-reduced-motion`，不阻塞操作、不改窗口尺寸、不产生重叠溢出。
6. 完成自动化、构建、macOS ARM64 真实应用验收、页面行为/样式检查、问题回写、修复复测、版本/CHANGELOG/发布资料同步和任务归档；只有归档成功后才能报告“本次任务已完成并归档”。

## 读取要求

先读取 `AGENTS.md`、`docs/pitfalls/README.md`、Electron 构建、工具链、倍率比较、sub2api 适配相关 pitfalls；再读取 `liran_docs/requirements/REQ-260904-usage-navigation-motion-PRD.md`、`docs/superpowers/specs/2026-09-04-usage-navigation-motion-design.md`、`liran_docs/03-索引.md`、`04-开发追踪.md`、`06-数据字典.md`、`07-API文档.md`、`08-测试用例.md`、`09-真机实测.md`、`10-UI壳接入清单.md` 和 M01/M02/M08/M09/M10/M11/M16 模块文档。随后读取 documentation 目标真实 diff 和本提示词关联的任务编号，重新搜索所有调用方、IPC、WebContentsView 生命周期、现有测试和 CSS 动效。不要只依赖旧总结。

## 修改范围

允许修改：`src/renderer/shells/usage/`、`src/renderer/shells/overview/`、`src/renderer/shells/sub2api-servers/`、`src/renderer/shells/radar/`、`src/renderer/shells/favorite-websites/`、`src/renderer/App.tsx`、受影响局部 CSS、相关 `src` 测试；仅在真实调用链证明必要时修改 `electron/main/services/sub2api-server-manager.ts`、Radar/常用网站 manager、共享 OpenCodex 契约或 preload 类型。允许更新 `liran_docs/01/02/03/04/06/07/08/09/10`、受影响模块文档、`CHANGELOG.md`、版本字段和最终归档资料。不得改 OpenCodex 服务端、数据库 schema、认证权限、Cookie/Token 导出、安全导航策略或无关功能；不得新增动画依赖；不得删除用户数据或文件，除非删除仅限已确认的渠道推荐展示代码且有调用方和回归证据。

## 执行步骤

1. 审计 documentation 1/2 产物：确认 PRD formal、设计文档、D1–D6 微观任务、04/08/09/10、长期模块文档和任务 ID 均真实存在；检查 `git diff` 中没有未确认的实现改动。若前置产物不完整，留在本目标先补齐，不得直接编码。
2. 按 `OCX-2601 → OCX-2602/OCX-2603/OCX-2604`、`OVR-2605`、`EMB-2606 → EMB-2607`、`MOT-2608`、`QA-2609 → DOC-2610` 顺序工作。每组先重新搜索调用方和现有测试，记录修改前行为。
3. 对 OpenCodex 先写失败测试：样例字段精确值、缓存字段兼容、负差值归零、缺失字段占位、4000 条参数、数量不足、自然日跨日/跨月/本地时区、反向自定义范围、缓存率边界和列顺序。运行定向 Vitest 确认 RED，再写最小实现使其 GREEN；不得用服务端样例之外的猜测字段。
4. 对总览推荐先写无残留和保留能力回归测试，再删除用户可见推荐展示；验证倍率 Popover、充值比例、渠道状态、手动关联和悬浮窗不受影响。不要因为删除 UI 就删除仍被内部评分或其他页面调用的共享逻辑。
5. 对服务器、Radar、常用网站快速切换先写状态和失败测试：active/loading 立即更新、稳定 ID、单视图挂载、旧响应丢弃、失败恢复、重试、长名称可访问、partition 不串。按现有 manager 生命周期做最小修改，不改变同源白名单或 Electron 安全配置。
6. 对动效先写可验证的状态/可访问性和几何检查，再用现有 CSS/React 添加局部过渡。页面/卡片控制在 160–240ms，控件控制在 120–180ms；加入 `prefers-reduced-motion`，确保键盘、文本、图标和焦点不依赖动画才能理解。禁止整页闪烁、持续大面积动画和全局样式污染。
7. 每完成一组任务，运行对应定向测试并回写 `04-开发追踪.md`；不要把局部完成写成整体完成。完成全部实现后运行全量 `npm test -- --run`、`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm run build`，再串行运行 Electron E2E；不要与生产构建并行读取 `dist/`。
8. 使用目标版本 macOS ARM64 打包应用执行 `liran_docs/09-真机实测.md` 中全部待实测步骤：OpenCodex 字段、缓存率、自然日、总览无推荐、三类快速切换、全站动效、窄窗和 380×260 悬浮窗。截图和日志保存到独立 `real-test-evidence/macos-REQ-260904/`，不得把敏感令牌、Cookie、完整 API Key 或私有日志写入证据。
9. 真机失败时按失败证据定位根因，遵循系统化调试和 TDD 修复，重新运行定向测试、全量回归和失败步骤；不得延长超时或放宽选择器掩盖问题。macOS 真机未跑通前不得进入归档。
10. 验收通过后先同步长期事实，再创建包含任务 ID 的 `liran_docs/archive/REQ-260904-usage-navigation-motion/` 归档目录和归档文件；校验归档内容、证据路径、版本与 CHANGELOG 一致性，同步索引，最后仅按任务编号清理活动区残留。其他活动任务必须保持不变。

## 业务与安全边界

OpenCodex 管理员令牌只能由主进程读取和使用，不能进入 Renderer、日志、截图、文档或归档。真实站点验证只允许用户已授权且可恢复的读取/必要分组切换，失败必须恢复原状态。不得修改 OpenCodex 服务端、远程站点业务数据、数据库 schema、认证权限、Cookie、Token、支付或危险导航边界。不得把缺失字段补成 0，不得把请求上限写成实际返回数量，不得把 Windows 交叉构建写成真机通过，不得伪造真机截图、服务响应、测试输出或发布状态。

## UI 专项要求

本目标不造新 UI 壳，不使用 Stitch 或外部视觉路线。所有 UI 改动必须落在现有真实页面/组件和局部 CSS 中，保持固定浅色主题、信息架构、公共控件规格、窗口尺寸和嵌入网页安全边界。顶部快速切换栏只切换本模块条目；动效只服务状态反馈；必须覆盖 loading/error/empty/success/disabled/selected/focus-visible/reduced-motion。桌面、窄窗口和悬浮窗检查真实几何，不以“看起来差不多”代替证据。

## 验证要求

必须先通过前置产物审计和编码解锁，再执行 TDD 实现。定向验证至少包括 `opencodex-data.test.ts`、`cache-rate.test.ts`、相关页面/manager 测试、快速连续切换和失败恢复测试；完整验证包括 `npm test -- --run`、`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm run build`、串行 `npm run test:e2e`、打包应用结构检查和 `python3 scripts/check_real_test_checklist.py liran_docs/09-真机实测.md --require-complete`。项目没有该脚本时如实使用外部技能仓库脚本并记录。页面检查必须覆盖桌面、窄窗口、380×260、焦点、无重叠、无溢出和 reduced-motion。完成前重新检查完整 diff、依赖变化、敏感信息和无关文件。

## 完成后输出

逐项输出：实际修改的文件和每个文件的行为变化；每个微观任务的状态；定向测试、全量测试、typecheck、lint、format、build、E2E 的真实命令和结果；macOS 真机每一步、截图路径和失败/修复记录；Windows 交叉构建边界；修改前评分与修改后评分及证据；长期文档、04/08/09/10、CHANGELOG、版本和归档文件的真实路径；归档校验、归档索引和活动区清理结果。只有归档状态为“已归档”且所有证据真实存在时，才输出“本次任务已完成并归档”。

## 流程合同

流程档位：深度流程
修改前评分：78/100
基础目标数量：2
目标提示词数量：2
当前目标：第 2/2 次
目标阶段：development-and-acceptance
UI 目标：跳过
UI 路线：not-applicable
等待外部输入：否
验收责任：Codex 真机测试
页面样式检查：执行现有页面行为/样式检查，不创建 UI 壳或 Design QA；覆盖桌面、窄窗口、380×260、焦点、无重叠、无溢出和 reduced-motion
当前阶段：开发、内测、真机验收、回写和归档
编码解锁条件：documentation 1/2 已通过，全部微观任务、04/08/09/10 和长期事实已真实存在并审计通过
允许升级条件：只有真实 diff、重新搜索到的公共调用方、公共 API/数据库/权限变化或验证范围超过深度流程时，才提供修改后评分和证据并暂停当前目标重新路由
上下文压缩后必须恢复本流程合同，不得重新猜测档位。
没有修改后评分证据不得改变档位。
当前状态：编码已解锁
已完成门禁：需求总结已输出、需求总结已确认、验收责任已确认、PRD 草稿已转换、PRD 索引已更新、正式 PRD 已输出、前置文档真实 diff 已通过
待完成门禁：TDD 实现、内部测试回写、macOS 真机测试、验收结果回写、修改后评分、归档创建与校验、归档索引更新、活动区清理
允许下一动作：前置产物审计、TDD 实现、内部验证、macOS 真机、问题修复复测、长期事实回写、版本发布资料和最终归档
禁止动作：伪造测试/真机/截图/发布；将 Windows 交叉构建写成真机通过；改变未确认需求；绕过安全边界；归档前声明整体完成
需求总结已输出：是
需求总结已确认：是
验收责任已确认：是，Codex 真机测试
PRD 草稿已转换：是
PRD 索引已更新：是
正式 PRD 已输出：是
PRD 确认状态：已确认
提示词状态：已解锁
真实产物审计：已通过 documentation 1/2；开发阶段完成后必须再次审计
进入证据：documentation 1/2 已完成，PRD formal 校验通过，D1–D6 微观任务已写回，04/08/09/10 和长期模块文档已更新，业务实现文件已准备进入本目标
阻塞原因：不适用
状态转换规则：开发目标已解锁 → 开发中 → 内部测试通过 → 验收准备中 → 真机测试中 → 真机测试通过 → 回写中 → 修改后复评中 → 归档中 → 已归档 → 已完成；失败必须回到开发中或真机测试中修复复测，不得跳步
本阶段职责：完成全部实现、内部验证、Codex macOS 真机、问题回写、修改后复评和安全归档
禁止进入的后续阶段：本目标为最终目标，不得生成新的开发目标；若需求扩大到完整流程或发生冲突，暂停并回到 liran-plan 重新确认
需求整理好了只能进入待详细总结确认

## 归档合同

任务 ID：REQ-260904-usage-navigation-motion
需求工作文档：`liran_docs/requirements/REQ-260904-usage-navigation-motion-PRD.md`
归档目录：`liran_docs/archive/REQ-260904-usage-navigation-motion/`
归档状态：未开始
先更新长期事实，再先创建并验证归档；更新归档索引；最后按任务 ID 清理活动区。其他活动任务未受影响，当前索引有效，活动区无本任务已完成残留。归档失败时状态为归档受阻并保留活动资料；只有归档校验通过后才能使用“本次任务已完成并归档”。

## 档位执行门禁

最终目标必须依次完成：前置产物审计；编码解锁；TDD 实现；内部验证回写；真机测试或待用户验收；验收结果再次回写；修改后评分。任一阶段没有真实证据，都必须停留在当前目标并修复复测，不得跳到归档或已完成。

## 收口条件

只有当所有 D1–D6 需求均有真实实现 diff、TDD 和全量自动化通过、macOS 真机清单全部通过、页面行为/样式检查通过、所有失败已修复复测、长期事实已更新、版本与 CHANGELOG 一致、归档已创建并验证、归档索引已更新、活动区按任务 ID 清理且其他活动任务未受影响时，才可把状态转换为已完成。任一证据缺失、工具超时、外部服务不可用或归档受阻，都必须如实保留对应状态，不能宣称完成。
