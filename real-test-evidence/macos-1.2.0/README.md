# macOS 1.2.0 验收证据

本目录记录 1.2.0 macOS ARM64 打包应用的脱敏页面检查和本地受控集成 E2E。测试使用隔离 userData 与本地 HTTP mock，不包含真实账号、密码、Token、完整 Key 或生产响应。

- `packaged-release/01-overview.png`：本地站点卡片、状态、余额、今日统计和备注。
- `packaged-release/06-overview-quota.png`：手动 Key quota 的剩余、已用、总额和进度条。
- `packaged-release/07-batch-progress.png`：批量验证部分失败后的 100% 完成态和成功/失败汇总。
- `packaged-release/02-usage.png`：使用记录首字列、耗时列和缺失值展示。
- `packaged-release/05-floating.png`：固定 380 x 260 悬浮窗及右下角刷新按钮。
- `packaged/`：空态、窄视图入口和固定尺寸的补充截图。

命令：`SUB2API_PACKAGED_EXECUTABLE=... SUB2API_REAL_EVIDENCE_DIR=real-test-evidence/macos-1.2.0/packaged-release npx playwright test tests/e2e/electron-smoke.spec.ts --grep 'connects site entry'`

Windows 仅执行 x64 交叉构建和结构验证，不属于本目录的真机结论。
