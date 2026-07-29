# GeeTest、统一通知与渠道持续展示实施计划

> 状态：待实施。本文是 1.6.0 执行计划，不代表测试、真机、构建或发布已经通过。

## 目标与边界

在不绕过或自动破解验证码的前提下，为启用 GeeTest 的站点提供安全、用户参与的官方登录窗口；建立共享应用内状态通知；修复总览渠道轮询失败清空有效展示的问题。Windows/macOS 共用业务逻辑，macOS 执行真实应用验收，Windows 无真机时只记录自动化和交叉构建证据。

## 阶段 1：渠道 Bug TDD

1. 在 loader/Overview 测试中 seed 成功列表与手动关联，推进 fake timer 触发强制轮询失败，先确认当前摘要变成完整错误的 RED。
2. 让缓存状态同时保存最近成功值、lastSuccessAt 与本轮 refresh error；Overview 有成功值时继续渲染数据，只附加 refresh-failed 元数据。
3. 补首次失败、普通失败、429/auth、成功恢复、多站隔离、详情局部失败、强刷/新关联竞态与多渠道测试。
4. 回归默认 60 秒、隐藏暂停、恢复且缓存 >30 秒立即刷新、Retry-After 与 2/4/8/15 分钟退避；禁止生产高频请求与后台 toast。

## 阶段 2：GeeTest 契约、适配器与服务 TDD

1. 为公开设置和认证需求增加严格 schema/可判别结果；测试 GeeTest 开关、检测失败回退、明确验证码错误分类和普通站兼容。
2. 抽出“验证会话后读取核心能力并原子保存”的共享服务路径；先测试取消、超时、Token 无效、核心能力失败均不保存半成品。
3. 实现可注入依赖、可单测的交互认证窗口服务：原生模态 BrowserWindow、临时 session、无 preload、sandbox/contextIsolation、同源自动填充、顶层导航和新窗口限制。
4. 仅提取有限 Token 键并调用 profile/readCore 验证；结束后清理临时数据。凭据、Token、Cookie、验证码和页面内容不得进入 Renderer、日志、SQLite 或证据。
5. refresh 失败对 GeeTest 站点只返回“需要重新验证”，不得后台密码重登或自动弹窗。

## 阶段 3：站点交互与共享通知

1. 先写 Renderer 测试覆盖精确对话框文案、两个按钮、Escape、焦点恢复、重复点击和等待/取消/超时/成功状态。
2. 实现约 420–460px 的固定浅色对话框；“开始验证”调用受控 IPC，“暂不添加”不保存。
3. 先写通知队列测试，再用现有 React/CSS/Lucide 建立 Provider、Viewport 和稳定 ID 更新；支持五态、最多三条、计时、关闭、单操作、aria-live/alert 和 reduced-motion。
4. 迁移站点添加/GeeTest、批量汇总、在线更新、API Key 复制/分组、充值比例、备注、渠道关联、手动刷新失败和删除成功。字段错误、长期状态、批量进度和下载百分比保持内联。
5. 建立安全错误映射并断言 UI 不出现 `Error invoking remote method`、IPC channel、堆栈或敏感值。

## 阶段 4：验证与视觉检查

1. 依次运行定向 Vitest、format、lint、typecheck、全量 Vitest、production build 和 Electron E2E；build 与 E2E 串行。
2. 使用真实 Electron 应用检查安全验证对话框、五类通知、长短文案、焦点、约720px和宽窗口、macOS Retina、渠道刷新/失败/恢复；记录无重叠、溢出和布局跳动的脱敏证据。
3. 执行安全扫描：Renderer、IPC、日志、SQLite、缓存、截图、测试夹具和文档均不得含密码、Token、Cookie、验证码结果或原始请求体。

## 阶段 5：真机、版本与发布

1. macOS 打包应用对授权站执行真实 GeeTest 添加；仅在挑战页面由用户本人完成验证码。随后验证自动保存、重启恢复、refresh/重新验证生命周期及至少两个渠道轮询周期。
2. Windows 生成 x64 NSIS 并检查 PE、asar、版本、入口、blockmap/update manifest；未使用 Windows 真机时明确标注未真机验收。
3. 递增到 1.6.0，更新 CHANGELOG、受影响模块、测试、真机与 pitfall；运行真机清单校验和完整 diff/敏感扫描。
4. 生成并校验 macOS ARM64 DMG、Windows x64 NSIS、blockmap 与 update manifest，记录真实 SHA-256。
5. 创建 Conventional Commit，分别推送 GitHub 与 Gitee 当前分支；双推成功后运行 `npm run release:publish -- --notes "..."`，验证 tag、Release 说明和全部资产。

## 完成门禁

只有 TDD、全量测试、Electron 视觉检查、macOS 真机、Windows 交叉构建、文档/pitfall、版本提交、双远端推送和 GitHub Release 资产均有真实证据时，才可把 1.6.0 标记完成。任一失败必须记录具体阶段并停止声称已发布；不得伪造 Windows 真机、验证码结果或未执行命令。
