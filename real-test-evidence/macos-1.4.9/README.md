# macOS 1.4.9 真机证据

- 应用：1.4.9 macOS ARM64 DMG 对应应用，ad-hoc 签名、未公证。
- 验证：打包应用 Electron E2E 6/6；版本徽标显示 `v1.4.9`，点击后显示“当前已是最新版本”；站点管理页显示“检查 GitHub 稳定版更新”。
- 更新提示证据：`17-update-latest-toast.png`。
- 1.4.9 的“稍后提醒”时间逻辑由 `UpdateService` 单元测试验证为当前时间后 24 小时；本次远端已是 latest，未伪造发现新版本下载安装流程。
- Windows 仅完成交叉构建和 Release 资产审计，未执行 Windows 真机安装、自动重启或回退。
