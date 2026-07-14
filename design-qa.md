# UI 壳 Design QA

> 历史记录：本文件保留作为早期承接记录，不是当前 Stitch 路线的有效门禁。当前不执行 Product Design Design QA，也不使用 P0/P1/P2 或 90% 相似度标准；有效标准见 `liran_docs/10-UI壳接入清单.md` 的 Stitch 实例级接收检查。

范围：Stitch 5 个业务 Screen 与当前 React UI 壳的承接检查。

| Screen         | 源图                                                                                | 实现图                      | 视口      | 关键差异                                               | 级别 | 修复结果 |
| -------------- | ----------------------------------------------------------------------------------- | --------------------------- | --------- | ------------------------------------------------------ | ---- | -------- |
| 全部站点       | `liran_docs/stitch-artifacts/10340103531009759971/01-overview/screenshot.png`       | `test-results/overview.png` | 1440×1024 | 开发预览控制器仍可见，属于施工期辅助层                 | P3   | 记录     |
| 使用记录       | `liran_docs/stitch-artifacts/10340103531009759971/02-usage/screenshot.png`          | `test-results/usage.png`    | 1440×1024 | 静态数据与原型样例不同，结构和密度已承接               | P3   | 记录     |
| 渠道状态       | `liran_docs/stitch-artifacts/10340103531009759971/04-channels/screenshot.png`       | `test-results/channels.png` | 1440×1024 | 静态数据与原型样例不同，状态层级已承接                 | P3   | 记录     |
| 悬浮窗         | `liran_docs/stitch-artifacts/10340103531009759971/05-floating/screenshot.png`       | `test-results/floating.png` | 380×260   | 原型展示多实例，施工窗口聚焦单实例；尺寸和核心层级一致 | P3   | 记录     |
| 站点管理与设置 | `liran_docs/stitch-artifacts/10340103531009759971/06-sites-settings/screenshot.png` | `test-results/sites.png`    | 1440×1024 | 静态表单数据与原型样例不同，表单分区已承接             | P3   | 记录     |

历史结论：`final result: passed`。该结论仅代表早期承接记录，不代表当前业务完成或 macOS 真机通过。当前仍需清理站点壳中已取消常用账号的静态残留，再进入真实业务接线。
