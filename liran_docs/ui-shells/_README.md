# UI 壳单项清单目录

## 2026-07-14 当前状态

工程基线、五个 Stitch UI 壳、HTML 产物、控件规格和真实业务 ViewModel/IPC 接线已有构建、Vitest、Electron E2E 与 macOS 打包应用逐页检查证据。正式运行态默认不显示受控预览控件，也不以静态样例冒充远程结果；`preview=true` 仅保留给开发和自动化状态验证。常用账号功能已取消，站点壳相关静态残留已清除。

上级：[[../10-UI壳接入清单]]
下级：五个 Stitch 业务壳和一个 Radar 合并壳接入清单
依赖：文本视觉方案、已初始化的真实前端工程

真实前端文件、五个正式入口和五个单壳清单已经建立。Stitch Project、5 个业务 Screen、1 个 Design System 资产及对应 HTML/截图均已登记；控件规格盘点、实例级复修、业务接线、构建和自动化截图已有证据。静态数据文件只服务于受控预览或测试，不得在正式运行态冒充远程结果。

当前清单：

- [应用主框架与全站总览](应用主框架与全站总览-UI壳接入清单.md)
- [使用记录](使用记录-UI壳接入清单.md)
- [渠道状态](渠道状态-UI壳接入清单.md)
- [站点录入管理与设置](站点录入管理与设置-UI壳接入清单.md)
- [悬浮窗](悬浮窗-UI壳接入清单.md)
- [Codex Radar](Codex-Radar-UI壳接入清单.md)

5 个 Stitch 业务 Screen 与 5 个实现壳一一映射，Design System 只提供全局 token 与控件规格；本次新增 Radar 是非 Stitch 的独立正式导航壳。映射以 [[../10-UI壳接入清单]] 和 [[../stitch-artifacts/README]] 为准；悬浮窗使用独立 Renderer。Stitch HTML 是第一视觉事实来源，代码/CSS/规范次之，截图只辅助校对；不另设 Product Design Design QA 门禁。
