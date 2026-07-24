# macOS 1.4.6 更新替换验证

日期：2026-07-25

## 已验证

- `hdiutil verify release/Sub2API-Multi-Hub-Monitor-1.4.6-mac-arm64.dmg` 返回 `checksum ... is VALID`。
- 构建目录 App 通过 `codesign --verify --deep --strict`；构建日志明确为 ad-hoc signing，未进行 notarization。
- 从 `1.4.5` DMG 挂载并复制旧 App，再从 `1.4.6` DMG 挂载并复制新 App，在隔离临时目录 `/tmp/sub2api-update-real-test.f4UY6F` 执行目录替换：替换前版本 `1.4.5`，替换后版本 `1.4.6`。
- 替换后的 1.4.6 App 使用独立 `SUB2API_TEST_USER_DATA` 启动，5 秒内进程保持运行，证明 DMG 内 App 可启动。
- Electron E2E 6/6 通过并保存了 1600px 宽窗口、720px 窄窗口及站点设置页面截图（本目录 `10` 至 `16` 等文件）；截图证明现有页面布局无明显重叠，但不包含线上“有新版本”状态。

## 未验证

- Gitee Release 尚未创建：Release API 返回 HTTP 401，当前下载 URL 返回 HTTP 404。
- 上述替换是 macOS 本机真实 DMG 手动替换验收，不是线上下载、静默更新或自动重启成功证据。
- 无 Windows 真机环境；Windows 仅有 x64 NSIS 交叉构建和结构审计证据。
