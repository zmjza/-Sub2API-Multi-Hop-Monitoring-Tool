你自行判断本任务是否需要多智能体协作；如需开启，只允许一个主智能体统筹，任一时刻最多同时运行五个子代理，子代理完成后必须及时回收，回收后可按需启用新的子代理，禁止子代理继续派生代理。

请直接执行 REQ-260914-channel-status-dual-ui 的 development-and-acceptance 阶段，完成深度非 UI 流程第 2/2 个最终目标。本任务已合并原 REQ-260915-connectivity-test-models，必须同时完成渠道状态、测试连通性按 Key 加载模型和使用记录统计。

当前阶段：development-and-acceptance
当前目标：第 2/2 个目标
流程档位：深度非 UI
目标总数：2
验收责任：Codex 负责 macOS 真机与页面样式验收；Windows 仅做 x64 交叉构建和结构验证。
归档阶段：final

任务 ID：REQ-260914-channel-status-dual-ui

进入证据：

- documentation 1/2 已完成。
- PRD、需求整理、任务拆分、微观任务、04/08/09/10 和模块长期事实已存在。
- PRD 正式状态校验和 documentation Goal 校验已通过。
- 当前 CHS 测试与真机条目仍为待执行。

读取文件：

- `AGENTS.md`
- `docs/pitfalls/README.md`
- 与渠道状态、Sub2API 适配器、缓存竞态、429 退避、Electron 构建、发布相关的 pitfall 文件
- `liran_docs/requirements/REQ-260914-channel-status-dual-ui-PRD.md`
- `liran_docs/requirements/REQ-260914-channel-status-dual-ui-需求整理.md`
- `liran_docs/requirements/REQ-260914-channel-status-dual-ui-task-breakdown.md`
- `liran_docs/03-索引.md`、`04-开发追踪.md`、`08-测试用例.md`、`09-真机实测.md`、`10-UI壳接入清单.md`
- `liran_docs/modules/06-API适配器与能力探测/`
- `liran_docs/modules/09-渠道状态/`
- `liran_docs/modules/10-全站总览与汇总/`
- 当前渠道适配器、服务、IPC、Renderer 渠道状态页、全部站点摘要、悬浮窗和相关测试源码
- 当前 Git 状态、package.json、发布脚本和 CHANGELOG

本目标必须完成：

1. 按 CHS-2601 实现 V1/V2 渠道监测适配和安全共享契约。
   - 每站点每次完整探测先请求 V1 `/api/v1/channel-monitors`。
   - 仅在 V1 明确不存在、未启用、模式不匹配、404/405、空数据或契约非法时请求 V2。
   - V2 请求 snapshot 与 matrix，携带 range、group_by=platform_group、timezone=Asia/Shanghai。
   - matrix 合法而 snapshot 失败时仍渲染 V2 卡片，汇总和更新时间降级占位。
   - 401/403 必须保留鉴权/权限错误语义。
   - 429、5xx、超时和网络中断必须作为临时失败，保留旧缓存并在下一周期按 V1→V2 重探测。
   - 完整 Key 只能在主进程读取和使用。Renderer、IPC 返回、缓存、日志、截图、测试夹具和持久化中不得出现完整 Key、Token、Cookie 或敏感原始响应。

2A. 按 CTM-2601～2603 修复测试连通性：按 siteId+keyId 安全请求 /v1/models，切换 Key 取消或忽略旧请求，自动选择首个模型，兼容多种响应结构；开始测试必须使用同一 keyId 和 model，并保留普通文本流式、取消、超时、重试和真实用量提示。

2B. 按 STAT-2601 实现中转站与 OpenCodex 最近 100 条有效记录的平均耗时、平均缓存率和四卡片布局；筛选、站点、模式和刷新后重新计算，宽窄窗口均不得溢出。

2. 按 CHS-2602 实现 V1 飞轮海式渠道状态页面。
   - 参考 `https://feilunhai.vip/monitor` 的页面层级和卡片结构。
   - 支持 7/15/30 天，默认 7 天。
   - 7 天使用列表 availability 字段；15/30 天和详情请求 status 接口。
   - 按统一平台顺序分段，分段内仍保持 V1 两指标卡片。
   - 卡片显示平台、名称、用户倍率、状态、对话延迟、端点 Ping、可用性和近 60 次探测条。
   - V1 不得出现缓存率、首 Token、矩阵桶或模型待查询。

3. 按 CHS-2603 实现 V2 mdkj 式渠道状态页面。
   - 参考 `https://mdkj.lol/monitor/cards` 的 ChannelStatusV3View/卡片结构。
   - 支持 90m/24h/7d/30d，90m 使用 5 分钟桶。
   - 按平台分段，卡片显示缓存率、可用率、首 Token、用户倍率、状态和矩阵桶。
   - 使用 coverage.data_through 过滤未来桶；coverage_complete=false 保留数据并标记部分覆盖；bootstrap.active=true 显示回填进度。
   - 前端重算可用率和首 Token 的较差状态，不直接照搬 health.overall。
   - 无流量显示 unknown/未知，不得显示正常。
   - V2 不得出现 V1 对话延迟、端点 Ping 或旧版探测条。

4. 按 CHS-2604 接入所有入口。
   - 渠道状态页、全部站点卡片、渠道详情和悬浮窗消费同一份站点渠道载荷。
   - `monitorSource=v1` 使用 V1 摘要，`monitorSource=v2` 使用 V2 摘要，`none` 显示“暂时无法获取渠道状态”。
   - 同页允许 V1/V2 站点并存，但单张卡片不得跨协议混用指标。
   - 保留现有 footer、按钮槽位、导航、窗口尺寸、手动关联和其他站点信息。

5. 按 CHS-2605 完成刷新、缓存和竞态保护。
   - 保留站点级单飞、并发上限、revision、防旧响应、取消和 stale-while-revalidate。
   - 手动刷新、自动刷新、切换时间窗、切换站点、页面隐藏/恢复都必须阻止旧请求回写。
   - 能力缓存只能优化刷新，不能跳过契约校验。
   - 临时失败不得永久记为不支持；退避和人工重试必须保持独立语义。

6. 按 CHS-2606 完成验证、发布和归档。
   - 先写或补充失败测试，再实现最小修复。
   - 运行相关单测、集成测试、Electron E2E、typecheck、lint、format、build 和安全扫描。
   - 运行 macOS ARM64 真机页面和样式验收，按 `liran_docs/09-真机实测.md` 逐项记录真实证据。
   - Windows 只做 x64 交叉构建和结构检查，不能写成 Windows 真机通过。
   - 任何失败都要回写 04/08/09、相关模块事实和 pitfall，修复后重新验证。
   - 版本号递增 0.1，CHANGELOG 写入详细说明。
   - 只提交本任务相关变更，使用 Conventional Commit。
   - 源码推送 GitHub 和 Gitee 两个远端当前发布分支。
   - 使用项目统一命令 `npm run release:publish -- --notes "本次更新说明"` 创建 GitHub Release。
   - 验证 Tag、Release 状态、说明、macOS ARM64 DMG、Windows x64 NSIS、blockmap 和 update-manifest.json。
   - 归档前更新长期事实，创建并校验 `liran_docs/archive/REQ-260914-channel-status-dual-ui/`，更新归档索引，清理本任务活动段落，不影响其他活动任务。

允许修改：实现本任务所需的源码、测试、相关文档、版本说明和发布配置；仅限 REQ-260914 范围。

禁止修改范围：

- 不把 V1/V2 合并为单一卡片。
- 不把 V2 matrix 转成 V1 latency、Ping 或 availability 字段。
- 不新增 Stitch、外部 AI 或独立 UI 目标。
- 不实现图片、音频、视频连通性测试。
- 不修改无关业务、数据库、认证、权限、支付、删除和远程后台菜单。
- 不绕过验证码、限流、TLS 或站点安全策略。
- 不把临时失败、鉴权失败或未验证状态写成成功。
- 不泄露完整 Key、Token、Cookie、原始响应或私有日志。
- 不把 Windows 交叉构建写成 Windows 真机验收。
- 不复用旧版本 Release 资产，不绕过统一发布命令。

验证：

- 状态回写：实现中更新 `liran_docs/04-开发追踪.md` 为进行中，测试结果写入 `08-测试用例.md`，真机结果写入 `09-真机实测.md`，问题回写相关模块和 pitfall。
- 实现前确认 CHS 微观任务和测试条目真实存在。
- 实现中更新 `liran_docs/04-开发追踪.md` 为进行中，并按任务完成情况回写。
- 自动化通过后更新 `liran_docs/08-测试用例.md` 的真实结果。
- macOS 真机逐项更新 `liran_docs/09-真机实测.md`，只给真实完成项标记通过。
- 发现问题时记录复现、根因、修复文件、验证命令和证据路径，修复后复测。
- 最终运行 `python3 scripts/check_real_test_checklist.py liran_docs/09-真机实测.md --require-complete`。
- 最终检查 `git diff`、敏感信息扫描、版本、CHANGELOG、双远端推送、Release 资产和归档内容。

下一阶段：本目标为最终目标；仅在全部验收、发布和归档证据成立后进入已完成。

最终完成条件：

- V1/V2 真实协议和两套卡片在渠道状态页可用。
- 全部站点、详情和悬浮窗按站点协议正确显示。
- 自动化测试、构建、安全检查和 macOS 真机样式验收通过。
- Windows x64 交叉构建证据完成且边界表述准确。
- 所有问题已回写、修复并复测。
- 版本 +0.1、CHANGELOG、Conventional Commit、GitHub/Gitee 推送和 GitHub Release 全部完成并验证。
- 任务归档已创建、校验、索引更新，活动区清理完成且其他任务未受影响。
- 状态按 `真机测试通过 → 归档中 → 已归档 → 已完成` 收口。

最终输出：

- 修改文件及逐文件行为变化。
- CHS 微观任务最终状态。
- 自动化、构建、安全、macOS 真机和页面样式验证命令及真实结果。
- Windows 交叉构建结果。
- 问题回写与修复复测结果。
- 版本号、提交哈希、GitHub/Gitee 推送结果。
- GitHub Release 地址和全部资产验证结果。
- 归档路径、索引更新和活动区清理结果。
- 已知限制。

只有以上全部条件真实成立后，才能将任务状态写为“已完成”。
