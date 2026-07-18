# 更新说明

## 1.2.0 - 2026-07-18

### 新增与优化

- 使用记录新增首字列；按 `first_token_ms` 显示首字延迟，低于 10 秒为绿色、10–20 秒为黄色、20 秒及以上为红色，缺失值显示 `—`；CSV 同步保留安全字段。
- 全部站点改为响应式卡片布局，支持双击编辑并持久化站点备注。
- 默认 Key 展示支持完整分页读取和 quota/quota_used 额度计算；自动选择继续显示用户余额，无额度 Key 回退用户余额。
- 批量验证并保存显示实时进度、成功/失败数量和完成态；悬浮窗新增当前站点手动刷新按钮。

### 验证状态

- 格式检查、Lint、TypeScript、Vitest 108 项和 Electron E2E 6/6 已验证；macOS ARM64 打包应用本地集成流程通过，页面截图已保存。
- Windows 仅执行 x64 交叉构建与结构验证，不代表 Windows 真机通过。

### 1.2.0 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.2.0-mac-arm64.dmg`          | `7fc08f1a9802af6e9cdf9f874d276642caf0d00c6163c4dc2cad4141f7552d88` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.2.0-mac-arm64.dmg.blockmap` | `adbb7c900edcc55c6320eb6c12701fbc59916628cb86635c5d470f1459a51ba1` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.2.0-win-x64.exe`            | `6b35ae13cdb8a6515898b7209da40b126d22b4626202a41c08707e7638aec014` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.2.0-win-x64.exe.blockmap`   | `bb73d6c561250123ef58157641fd9ebf412728ee0273d39072ed30b3375a1ae5` |

## 1.1.0 - 2026-07-18

### 新增

- 新增 Codex Radar 正式主导航，支持公开数据读取、刷新、加载、空态、错误态和来源链接。
- 使用记录新增推理等级、缓存创建 Token、请求耗时、今日统计和 CSV 展示。
- 渠道状态新增可用渠道关系解析、Key 分组、稳定排序和多请求竞态协调。
- 悬浮窗新增 35%–100% 透明度设置，默认 84%，支持原生同步和跨重启持久化。

### 跨平台与安全

- 保持 macOS ARM64 与 Windows x64 共用业务逻辑。
- 保留 sandbox、contextIsolation、nodeIntegration 禁用、preload 白名单和 Radar CSP 来源限制。
- 保留 macOS 非激活悬浮窗、`alwaysOnTop=false` 和固定 `380 x 260` 窗口行为。

### 验证

- macOS ARM64：打包应用 E2E 6/6 通过，页面样式和真实站点只读复测通过。
- Windows x64：NSIS/PE/asar 交叉构建与结构验证通过；未执行 Windows 真机验收。
- macOS DMG 未签名、未公证。

### 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.1.0-mac-arm64.dmg`          | `cf3eaf9372f855647dc7041c25802a4bf3f533f6ec6208512e371976dd33848a` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.1.0-mac-arm64.dmg.blockmap` | `ea39e90736817c0ebd4bd998567b28e00c20a4e0d36e1792f3aadccd9ff37cc8` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.1.0-win-x64.exe`            | `2219f4ea1ad0f218160a7df617e01839250493eedd429c17decc76ad49efcba8` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.1.0-win-x64.exe.blockmap`   | `bb4db3352c53bb1e0dc165c7969a2b5759cd66101789d94d55ec8e54a54dd8e1` |
