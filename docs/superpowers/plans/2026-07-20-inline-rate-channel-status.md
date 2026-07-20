# 倍率卡片内联渠道状态实施计划

1. 在 `rate-comparison.test.ts` 增加并列分组独立匹配、无匹配不兜底和独立稳定性用例；先确认 RED。
2. 调整 `rate-comparison.ts` 的候选输出，使每个分组带独立 `channelId`、稳定结论和展示所需信息，同时保持站点排行公式及平台固定顺序。
3. 为总览自动渠道加载建立小型协调器及单测，覆盖列表/详情单飞、最大并发 4、失败隔离、强制重试和世代失效。
4. 在 `OverviewPage.tsx` 接入自动加载和共享缓存，增加内联渠道摘要组件；保留站点级 `ChannelStatusPopover`。
5. 在 `overview.css` 增加局部、稳定尺寸的摘要样式，延续四平台配色和单行横向滚动。
6. 更新 Electron E2E 的本地服务计数与断言，验证无需点击、详情展示、失败重试和完整渠道入口。
7. 运行 Prettier、ESLint、TypeScript、Vitest、生产构建和 Electron E2E；修复所有回归。
8. 构建 macOS ARM64 目录包并用真实 Electron 应用检查正常/窄窗口，保存截图和几何证据。
9. 更新至 1.3.4，回写 `liran_docs`、`CHANGELOG.md` 和踩坑文档，生成 DMG 与 Windows x64 NSIS，校验架构与 SHA-256。
10. 审查最终 diff、重新评分并仅基于真实证据收口。
