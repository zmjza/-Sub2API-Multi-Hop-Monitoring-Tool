# 更新说明

## 1.5.1 - 2026-07-26

### Key 分组精确渠道关联与三分钟推荐

- 以 `group_id` 对 `channels/available` 的 `platforms[].groups[].id` 做精确主关联，同一分组命中多个渠道时逐个展示和评分。
- 增加按站点和分组持久化的手动多渠道关联；自动关系完整时优先自动关系，自动关系缺失时保留手动选择，并支持恢复自动匹配。
- 推荐稳定窗口从 5 分钟改为 3 分钟；仅 `failed`、`error`、`down`、`unavailable` 视为不稳定，`unknown`、`degraded`、空状态按稳定处理。
- 推荐按“有状态综合分”和“无状态最低价”分池，综合分为价格分 60% + 稳定分 40%，卡片显示全部关联渠道。

### 1.5.1 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.5.1-mac-arm64.dmg`          | `b34d8e82ea4790c7aec898f68676b27f486b873b64473a59bf867a582ac4733d` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.5.1-mac-arm64.dmg.blockmap` | `56307a8c6ec21987c8cf420acdde18b085c8610ff2d344eda800b532a96b0082` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.5.1-win-x64.exe`            | `c19ee1bfaf6a1712d5e46dd2f031fad54b6ba45e65dda1ecfadbe17ab524a9c1` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.5.1-win-x64.exe.blockmap`   | `2da4fc7d82386213759b5880464d00dc07ef2a005c92adaa838bcecbcd856f6a` |

## 1.5.0 - 2026-07-25

### 在线更新组件与双入口交互优化

- 右上角版本徽标整个区域可点击，点击后立即显示检查中状态，并通过 single-flight 防止重复检查。
- 设置页“检查更新”按钮复用与版本徽标相同的检查入口、loading、最新、失败和跳过反馈。
- 发现新版本后自动切换到“全部站点”，显示圆润的自制更新卡片，包含当前/目标版本、真实更新说明、真机测试标记和统一操作按钮。
- 更新弹框支持跳过此版本、稍后提醒、下载进度、Escape/遮罩/关闭按钮、焦点恢复以及宽窄窗口响应式布局。
- 保持 GitHub 稳定版 Release、SHA-256 校验、Windows 自动重启和 macOS 下载/打开 DMG 后必要时手动替换的既有策略。
- 本版本包含页面交互与视觉行为变化，不是无业务变化的测试 patch；Windows 仍只做交叉构建，macOS 进行真实页面验收。

### 1.5.0 远端产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.5.0-mac-arm64.dmg`          | `a495b5e5042cd1f33a602601da860984c01cba93436bbab39a662cd52a273dc1` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.5.0-mac-arm64.dmg.blockmap` | `5a2ed6be95c90079b4c4c3fb63a37d3a1fe381c27c798ebaec49e6bde73ee1c6` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.5.0-win-x64.exe`            | `0031fd8d4a5a2ec3b4ba705e5001da76e695269461319c842d4311d9feb6c849` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.5.0-win-x64.exe.blockmap`   | `14fc5c93c94760c5cbffad0915f0860a72f4995703111108ce7d952d5cf7cfba` |

## 1.4.9 - 2026-07-25

### 在线更新提醒修复

- 修复“稍后提醒”写入当前时间导致下一次检查立即再次弹出的问题，默认延后 24 小时提醒。
- 保持 GitHub 稳定版更新源、更新说明弹框、SHA-256 校验、Windows 自动重启和 macOS 打开 DMG 策略不变。
- 1.4.8 已发布为在线更新交互优化版；1.4.6 及更早旧客户端仍需先安装已切换到 GitHub 更新源的版本。

## 1.4.8 - 2026-07-25

### 在线更新检查反馈优化

- 启动检查和点击右上角版本徽标时显示“正在检查更新”消息，检查期间避免重复触发。
- 已是最新版本、检查失败和跳过/稍后提醒均显示明确的应用内消息。
- 发现新版本时改为询问式更新弹框，展示真实更新说明、真机测试标记、立即更新、跳过此版本和稍后提醒。
- 保留 GitHub Release、SHA-256 校验、Windows 自动重启和 macOS 打开 DMG 的既有策略。
- 1.4.6 及更早旧客户端若仍使用旧 Gitee 更新逻辑，需先安装已切换到 GitHub 更新源的版本，不能由远程 Release 改写旧客户端代码。

## 1.4.7 - 2026-07-25

### API 密钥表格高度优化

- API 密钥页面在只有一条或少量数据时，表格面板会自动延伸到内容区底部，不再留下大块空白。
- 表格区域保留横向滚动，并在内容较多时支持内部滚动；筛选、分组下拉、分页和现有数据接口不变。
- 本版本为界面优化版本，macOS ARM64 与 Windows x64 安装包同步生成。

### 1.4.7 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.4.7-mac-arm64.dmg`          | `982eb262a92dafa1ae1f3d42bac9525ab23af36e5ee9d554fdef10197ee50d26` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.7-mac-arm64.dmg.blockmap` | `42bbcdfffb7d175eaf6e5f0330b4dcd85affe0479a0dd9d7b9dde69ca7391c56` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.4.7-win-x64.exe`            | `6a5f85996b0f8c68369d2ca177ac6afdd4a003ee5fc8aeec309c636a00173e50` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.7-win-x64.exe.blockmap`   | `f843cbf3e3498c5442fe9dd51c039e14592ea5898745d130cbedf12d64f26a39` |

## 1.4.6 - 2026-07-25

### 在线更新真机测试准备

- 增加固定 Gitee Release 源、严格 SemVer/稳定版 manifest 校验、SHA-256 下载校验、下载进度和临时文件清理。
- 右上角版本徽标支持检查更新，启动时自动检查；支持立即更新、跳过此版本和稍后提醒。
- Windows 目标为 NSIS 静默安装并自动重启；macOS 在当前 ad-hoc/未公证条件下打开 DMG 并提示手动替换。
- 本版本为“真机更新测试专用”，本版本不包含业务功能变化。`mac-arm64.dmg` 是 macOS ARM64 安装包，`win-x64.exe` 是 Windows x64 安装包；两者均上传到同一 Gitee Release。

### 1.4.6 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.4.6-mac-arm64.dmg`          | `1f605d1b463d2696e5ca763783ae7a3f8d531af5652cda8489361e4124f76b1b` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.6-mac-arm64.dmg.blockmap` | `19adf7fbc37727d7348341dc3f64c1c2694de4891d47bd1dddce6fed28a7300a` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.4.6-win-x64.exe`            | `0483cbe7c8758fe57e263df8c8d3ecb6e6153f1ee051c80fb1881aef0d51c49f` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.6-win-x64.exe.blockmap`   | `548cab13adeff98f2f020748d15e477566e50f74ca8b324ec687baf9e630055b` |

## 1.4.5 - 2026-07-25

### API 密钥菜单与版本标识

- API 密钥分组菜单改为按内容自适应宽度，长分组名称、平台和倍率不再被固定触发器宽度截断，并保留视口边界约束。
- 主界面右上角保留带历史图标的“最后更新：时间”徽标，并在旁边新增独立的 `v1.4.5` 版本徽标；开发预览无 Electron bridge 时显示“开发版”。

### 1.4.5 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.4.5-mac-arm64.dmg`          | `b200bc0ac4fefe4cdf730a644b90f5bae661bd63e107ce7a1c3d7289126e4e82` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.5-mac-arm64.dmg.blockmap` | `8a696d1e75458eafe3da5b122031530bdced6804bcec8a0ffdc754e4613d6eea` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.4.5-win-x64.exe`            | `c116140f2bd5c7f3453b4d84b6294441668258a83b3e6e1750e8979c2d999f37` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.5-win-x64.exe.blockmap`   | `a5a53e2f5d80f8b12c43ada8d22f967a244978824d97495cf5792d7074f281f6` |

## 1.4.4 - 2026-07-24

### 总览推荐、额度与 API 密钥视觉优化

- 无渠道状态的有效 OpenAI、Claude、Gemini、Grok 分组现在参与倍率推荐，并明确标记为“无渠道状态”，不会伪装成健康渠道；有渠道但匹配歧义或明确异常仍不参与。
- 悬浮窗和总览卡片继续按当前有效 Key 计算有限额剩余额度；无额度限制时使用站点账号余额。
- 全部站点卡片底部充值比例独占一行，两个操作入口保持可读，窄卡片不再遮挡或压缩。
- API 密钥行内分组改为支持键盘与外部点击关闭的自定义菜单，名称、平台和倍率分栏展示；API 密钥、使用记录和渠道状态站点选择器优先显示备注。

### 验证状态

- Prettier、ESLint、TypeScript、Vitest 35 文件/219 项通过；macOS DMG `hdiutil verify`、ad-hoc bundle 校验和 Windows PE/asar 结构校验通过。macOS 安装副本页面几何复核与三个真实站点交互待实测。

### 1.4.4 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.4.4-mac-arm64.dmg`          | `37426653edaa32c51605eb749953e334fe0cff510796e05e0ea41a4b316d6a61` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.4-mac-arm64.dmg.blockmap` | `b66f1ed8331c985a8422aed4b190751bd82f9511cab65fe28aabdc7f8877a94d` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.4.4-win-x64.exe`            | `f5d527c91c752d3946ef9e9dfc6e48f4224e8313468cf491309ec0b7979cc9da` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.4-win-x64.exe.blockmap`   | `0b0b37b5a639db5333f62515eae3567f6cd8febbdac85ee948e373a0db0d3d21` |

## 1.4.3 - 2026-07-24

### API 密钥页面与悬浮窗统计优化

- API 密钥页面显示完整 Key，支持点击复制；完整值仅用于当前运行内存，不写入数据库、日志、缓存或测试证据，剪贴板写入由主进程完成。
- 名称列居中并优化字重，平台改为 Claude/OpenAI/Grok/Gemini 图标，倍率改为图标数值，分组下拉项提前显示平台和倍率。
- 合并今日与近 30 天消费列，删除过期时间列，优化搜索、分组、状态和站点选择控件。
- 悬浮窗“今日 Token”“今日消费”改按当前有效 API Key 统计，不再使用整站快照。

### 验证状态

- TypeScript、ESLint、Prettier、Vitest 和开发态 Electron E2E 通过；macOS 安装副本页面检查通过，maok 真实登录因 Turnstile verification failed 受阻，Windows 仅交叉构建。

### 1.4.3 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.4.3-mac-arm64.dmg`          | `79c3e6e9c295d6bda0b64803771e9d0dce6d84597304219f5ad4301a835ed934` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.3-mac-arm64.dmg.blockmap` | `e1daf4e3005f080251d404eccd814ade60690a00b06a8240cef06e7a10f3b0f0` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.4.3-win-x64.exe`            | `f527a660b102ff580db529f17710c452c0806a3b563be94c83bdfccefec55b7c` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.3-win-x64.exe.blockmap`   | `6e707a5e4f3d7ce99e31653ed2a219e1514b1832159104433871940f04b3fcd2` |

## 1.4.2 - 2026-07-24

### 总览额度与渠道关联

- 全部站点不再显示“按订阅规则”；`subscriptionType` 只保留为上游元数据，不再覆盖总览额度语义。
- 有限额 Key 继续按 `max(0, min(账号余额, quota - quota_used))` 展示 1.3.9 的总额、已用、进度和剩余；缺失、0 或无效 quota 视为无限额并显示账号余额。
- 顶部“所选 Key 可用额度”对每个已解析站点的金额求和，未知站点不伪造为零；安装态 E2E 验证 5 个 `$8.50` 汇总为 `$42.50`。
- 严格渠道匹配仍对多个候选返回歧义，保证倍率比较不误用渠道；总览仅在该结构化候选集合内按名称、关系平台、模型、健康、新鲜度、可用率和稳定 ID 选出唯一最接近渠道，卡片、详情请求和重试共用其 ID。

### 验证与发布

- Prettier、ESLint、TypeScript、Vitest 34 文件/215 项、生产构建、开发 Electron E2E 6/6 和 `/Applications` 安装副本 E2E 6/6 通过。
- 16 张 macOS 安装应用证据位于 `real-test-evidence/macos-1.4.2/`，包含顶部额度求和、有限额卡片和宽窄总览。
- DMG 通过 `hdiutil verify`；构建目录与 `/Applications` 安装副本通过 `codesign --verify --deep --strict`，版本/asar 为 1.4.2，主程序为 ARM64。
- Windows x64 NSIS 已交叉构建，安装器为 PE32，解包主程序为 PE32+ x86-64，asar 为 1.4.2；未执行 Windows 真机。
- macOS 仍为 ad-hoc 签名且未公证，不表述为 Apple Developer ID 可信分发。

### 1.4.2 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.4.2-mac-arm64.dmg`          | `1bb98803bb98f50b327ab293024108a6a57c59b181b6f16fe0212f85f90f5b49` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.2-mac-arm64.dmg.blockmap` | `e362ab0b49b58d05c4aad0110bbabb7a7fcc308caf0f0ec6b5cb47e97f400c60` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.4.2-win-x64.exe`            | `7405b626cdc49cbc65810ba300747761bcba085b4a25fd4a7cb7c04ee15184f0` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.2-win-x64.exe.blockmap`   | `a1d261094373c4938819f5436e762c8187c3f075f947e1a8482560298b56a0b6` |

## 1.4.1 - 2026-07-24

### macOS 安装启动修复

- 修复 `1.4.0` macOS 应用仅保留 Electron linker-generated 签名、bundle 资源未封装进签名，导致带下载隔离属性的安装副本可能被 macOS 判定为损坏或无法打开的问题。
- macOS 构建改由 electron-builder 使用 `identity: "-"` 完成整包 ad-hoc 签名，不再依赖不完整的 linker 签名，也不对成品应用执行手工 `codesign --deep`。
- 新增构建清单回归测试，固定 `1.4.1` 版本、preload 版本和 macOS 签名配置。

### 验证与发布

- DMG 通过 `hdiutil verify`；DMG 内应用和 `/Applications` 安装副本均通过 `codesign --verify --deep --strict`，标识为 `com.liran.sub2api.monitor`，版本为 `1.4.1`，主程序为 ARM64。
- `/Applications` 安装副本使用原有用户数据经 LaunchServices 启动，前台窗口可见；开发 Electron E2E 与最终安装副本 E2E 均为 6/6。
- Prettier、ESLint、TypeScript、Vitest 34 文件/210 项和官方 npm registry 审计通过，审计为 0 个漏洞。
- Windows x64 NSIS 已重新交叉构建并完成 PE/asar/版本结构验证；未执行 Windows 真机。
- macOS 仍不是 Apple Developer ID 签名且未公证，不能表述为 Apple 可信分发或无提示首次打开。

### 1.4.1 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.4.1-mac-arm64.dmg`          | `e25a5a5ecdb1c5e0e9a598eabda5f8d205199b3c1b8f512e3dcc2b5e912081ce` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.1-mac-arm64.dmg.blockmap` | `dd0162b7d5356a841b6515186ed17864969c742d73eab3d9b187b63c9a1e6ee5` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.4.1-win-x64.exe`            | `4455af60671d1633a45cdedebbf231c91e0aa7a8e8eca8d7f35863154e3aeb80` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.1-win-x64.exe.blockmap`   | `c24ab8de965d8106f5cfb65fc58df2e786cd8c9b3f20856da8193b25a4cdd213` |

## 1.4.0 - 2026-07-24

### API 密钥与统计口径

- 新增普通用户 API 密钥页面，支持安全分页、名称或脱敏摘要搜索、分组与状态筛选、今日和近 30 天实际消费展示，以及单 Key 分组切换。
- 分组写入只发送 `group_id`，同 Key 单飞，成功后远程回读确认；完整 Key 仅在主进程适配器局部短暂读取，不进入 Renderer、IPC 返回、SQLite、日志、CSV、截图或夹具。
- 使用记录六类筛选与有效日期约 300ms 自动请求，列表和顶部统计共用规范化查询；总请求、总 Token、实际消费和平均耗时来自服务端筛选统计。
- 全部站点顶部与卡片改用每站实际当前 Key 口径，有限额、无限额和订阅分组分别使用明确额度规则，当前 Key 不确定时不回退整站数据。

### 渠道监控与关联

- 主窗口相关页面可见时以 60 秒默认周期低频刷新渠道概览，可选 30/60/120 秒；后台、隐藏和最小化暂停，429 遵守安全 `Retry-After` 或 2/4/8/15 分钟退避。
- Key 与渠道优先使用 `group_id` 和普通用户可用关系链匹配，名称、平台和模型仅作唯一高置信回退；关联不明确不再误取首个候选。
- 渠道状态页和总览渠道区域删除 BadgePercent、倍率不可用和折算文案；独立倍率比较、充值比例及底层倍率接口保持不变。
- 使用精确 overrides 升级 `fast-uri` 与 `shell-quote` 的修复版本，官方 npm registry 高危审计为 0。

### 验证与发布

- TypeScript、ESLint、Vitest 34 文件/210 项、生产构建、开发 Electron E2E 6/6 和 macOS ARM64 打包应用 Electron E2E 6/6 通过。
- 两个授权站点完成 Key 分组 PUT、GET 回读和原分组恢复；第三站凭据登录被 Turnstile 拦截，仅通过用户已有登录会话只读确认 API 密钥页面，未冒充 Electron 写入验证。
- 15 张 macOS 打包应用证据位于 `real-test-evidence/macos-1.4.0/`，包含 API 密钥 1600px/720px、总览、使用记录、渠道状态、站点管理和悬浮窗。
- DMG 校验有效，macOS 主程序为 Mach-O ARM64；Windows NSIS 为 PE32，解包主程序为 PE32+ x86-64；两端 asar 为 1.4.0。Windows 仅交叉构建与结构验证，未执行真机。

### 1.4.0 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.4.0-mac-arm64.dmg`          | `23ff81cdf2669cec87fc74d1998ae06a11caef3da91e3d97c002a97a8b21a2d4` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.0-mac-arm64.dmg.blockmap` | `63ef32eb96c13a19f7659957877826c2d7b22db18b55cde00e93bffd2d5d83b6` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.4.0-win-x64.exe`            | `837ed245c4530dfa7990cabca2826506e922b401249d7ba8e6dff5e43fe5099a` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.4.0-win-x64.exe.blockmap`   | `44718563aa4ac7c46e667569640cc4918b04f2d7bccf173bf20a496628a99831` |

## 1.3.9 - 2026-07-21

### 倍率标题清理

- 删除倍率区域的“倍率对比”主标题及其副标题，保留刷新周期下拉框和刷新按钮，卡片区域与业务逻辑不变。
- 四平台官网 SVG 图标、40×40 图标槽位、单行横滑、Antigravity→Gemini 归类和真实倍率接口保持不变。

### 验证与发布

- TDD RED 确认旧主标题仍存在；Green 定向 Electron E2E 和完整开发 E2E 均通过，确认标题与副标题均不渲染。
- Prettier、ESLint、TypeScript、Vitest 28 文件/171 项、生产构建和 macOS ARM64 打包应用 E2E 通过。
- DMG 校验有效，macOS 主程序为 Mach-O ARM64；Windows NSIS 为 PE32，解包主程序为 PE32+ x86-64。Windows 仅交叉构建与结构验证，未执行真机。

### 1.3.9 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.3.9-mac-arm64.dmg`          | `0a59b8addc14985bf048fe19bbe8964b2cb7b869326b77e1cce112967e77c4f7` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.9-mac-arm64.dmg.blockmap` | `8e8c7a06afee912dec3a7ce942cbef628979299bc8dc3526df1e1a6c6ecb87d6` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.3.9-win-x64.exe`            | `09cb07e483da2cc764daf17b2c7025e1fa797e38a5fa9556e461a02618a7cce5` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.9-win-x64.exe.blockmap`   | `ca4cf6114e393c72635a6347dc465b805716d3a46b4175ce3850bb884f5e88b6` |

## 1.3.8 - 2026-07-21

### 倍率标题与官网图标

- 删除“倍率对比”标题下的“按充值比例折算后，比较各平台最低分组”副标题，只保留主标题、刷新周期和刷新按钮。
- OpenAI、Claude、Gemini、Grok 改用官网公开 SVG：分别来自 `developers.openai.com`、`claude.ai`、Gemini 官网声明的 `gstatic.com` 资源和 `grok.com`。
- 四个 SVG 全部保存为 Renderer 本地资源并离线打包；OpenAI、Claude 由 Vite 内联，Gemini、Grok 作为独立 SVG 文件输出，运行时不请求官网。
- 不改变倍率、渠道稳定性、推荐排序、刷新、缓存或其他页面业务逻辑。

### 验证与发布

- TDD RED 确认旧副标题仍存在；Green E2E 验证副标题数量为 0、四个 40×40 图标均加载成功且资源类型为 SVG。
- Prettier、ESLint、TypeScript、Vitest 28 文件/171 项、生产构建和最终 macOS ARM64 打包应用 Electron E2E 6/6 通过。
- 1600px 与 720px 页面截图确认官网图标清晰，无模糊、裁切、重叠或布局偏移；13 张证据位于 `real-test-evidence/macos-1.3.8/`。
- DMG 校验有效，macOS 主程序为 Mach-O ARM64；Windows NSIS 为 PE32，解包主程序为 PE32+ x86-64。Windows 仅交叉构建与结构验证，未执行真机。

### 1.3.8 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.3.8-mac-arm64.dmg`          | `b54c0c4e4dfee4792894452a6692aa961fcd7bb75c5277776e90688eb3be1e73` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.8-mac-arm64.dmg.blockmap` | `bc2066e7dc660905901f3973fb4809f000cac0563b3fc55c9f3e8861fc096785` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.3.8-win-x64.exe`            | `f8c5105cb916d8a7c0d279f7f41ef718af48a3b1a73582c3459c7c46014e0be4` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.8-win-x64.exe.blockmap`   | `f747583ccd28c33db3a79c51c930ae62db244aed7e98958b60e2929508c88ea4` |

## 1.3.7 - 2026-07-21

### 倍率对比 Stitch 高保真优化

- 按 Stitch Screen `227212f94b9b427e887875644935ab9e` 重做倍率对比：四平台固定为 OpenAI、Claude、Gemini、Grok，采用 32px 圆角、16px 内边距、24px 间距、40×40 品牌图标和统一推荐内容区。
- 四张平台卡片始终保持单行；窄窗口继续支持触控板、触屏、Shift+滚轮和键盘横向滚动，但 WebKit 与 Firefox 均不显示滚动条。
- OpenAI、Claude、Gemini、Grok 使用本地离线品牌图片和对应绿色、橙色、蓝色、黑灰色主题；加载、推荐、空态和刷新状态保持等高与稳定基线。
- `antigravity` 及分组名、说明、主模型、附加模型和结构化关系中的独立 Antigravity 统一归入 Gemini；Gemini 与 Antigravity 共用候选池，相似子字符串不误判。
- 继续复用现有倍率、充值比例、渠道状态、五分钟稳定门槛和缓存接口，不改变认证、IPC、Key、评分权重或渠道关系协议。

### 验证与发布

- TDD RED 首次确认 26 项倍率规则中 3 项失败，分别覆盖直接别名、文本证据和候选池合并；实现后倍率规则 26/26，完整 Vitest 28 文件/171 项通过。
- 开发 Electron E2E 6/6、最终 macOS ARM64 打包应用 Electron E2E 6/6 通过；1600px 与 720px 页面检查确认四卡单行、品牌图标清晰、无可见滚动条、无重叠或第二行。
- 13 张证据位于 `real-test-evidence/macos-1.3.7/`，新增倍率模块宽/窄截图为 `12-rate-comparison-stitch-wide.png` 和 `13-rate-comparison-stitch-narrow.png`。
- DMG 校验有效，macOS 主程序为 Mach-O ARM64；Windows NSIS 为 PE32、解包主程序为 PE32+ x86-64。macOS 应用仅 adhoc 签名、未公证；Windows 仅交叉构建与结构验证，未执行真机。

### 1.3.7 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.3.7-mac-arm64.dmg`          | `2d2e32994b70248c4e79eef9d724498e4ef94423d882017194207921e681f30a` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.7-mac-arm64.dmg.blockmap` | `f1fac2cb2dcb424e84b07741ce80677111793ab04f10468c0013b33dc37462b7` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.3.7-win-x64.exe`            | `df7a024b10dd603bdc5f069bde747a1312cbb0eb80258484e6a0e25f842a11fe` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.7-win-x64.exe.blockmap`   | `4b7a48ab10950b9b627231092d8e2b71dfea32b96cd80c19b4573bd077db82ba` |

## 1.3.6 - 2026-07-21

### 全部站点卡片布局

- 站点卡片底部改为固定三列单行网格，充值比例可安全收缩，查看倍率和查看渠道状态保持完整文字；所有支持窗口宽度下禁止换行、重叠和横向滚动。
- 当前渠道摘要改为固定 102px 槽位并承担正文后的自动剩余空间，加载、成功、无匹配、列表错误和详情错误外框等高且不裁切说明文字；同一网格行摘要与 footer 顶边误差不超过 1px。
- 长站点名改为单行省略并保留 `title`，状态徽标不再被挤成竖排；720px 窄窗口使用局部紧凑间距，充值比例值和两个查看按钮均保持可读。
- 本次不改变倍率推荐、渠道匹配、五分钟稳定门槛、评分、Key、接口、认证或刷新业务逻辑。

### 验证与发布

- TDD RED 复现了 footer 换行、摘要顶边相差 16px、摘要高度相差 14.5px 和长标题挤压状态徽标；Green E2E 覆盖五张临时站点卡片、1600px 四列首行、720px 单列及加载/成功/无匹配/错误状态。
- Prettier、ESLint、TypeScript、Vitest 28 文件/168 项、生产构建、开发 Electron E2E 6/6 和最终 macOS ARM64 打包应用 E2E 6/6 通过。
- macOS 页面样式检查确认宽/窄窗口 footer 单行、摘要基线、长内容截断、按钮文字和充值比例均无重叠或异常换行；11 张证据位于 `real-test-evidence/macos-1.3.6/`。
- DMG 校验有效，macOS 主程序为 Mach-O ARM64；Windows NSIS 为 PE32、解包主程序为 PE32+ x86-64；两端 Info.plist/asar 版本和 Renderer/main/preload 入口均为 1.3.6。Windows 未执行真机。

### 1.3.6 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.3.6-mac-arm64.dmg`          | `4faaf0ea901fa5d2ab8cd5951526eb02359d97ef81c7c7401bbfd53c8f4c0699` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.6-mac-arm64.dmg.blockmap` | `885beb7ca24468b3186738392d38c219bb762107c4deee6dd1435b78e7244690` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.3.6-win-x64.exe`            | `b0f3f4bfd121cc7930d72108d5703387966d231f8c06c54b38efb28b75620b74` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.6-win-x64.exe.blockmap`   | `b38fd9f137d03b22c43b1ca9a57a9ae2291b3ea6211cd52d205dcfb747f33025` |

## 1.3.5 - 2026-07-21

### 倍率推荐与当前渠道

- 全部站点卡片自动显示当前生效 Key 的唯一匹配渠道摘要；摘要从倍率推荐卡片移到站点 footer 上方，Key 切换会清除旧渠道数据并隔离迟到响应。
- 分组与渠道统一使用规范化完整名称精确匹配，零精确结果时才允许 `/channels/available` 唯一结构化回退；无匹配和歧义均不猜测、不借用兄弟分组。
- 倍率推荐新增五分钟全 normal 硬门槛，无渠道、异常、过期、未来、非法时间和请求失败全部排除；价格使用合格候选 min-max 归一化，综合分保持价格 60% + 稳定 40%，每个平台只显示第一名。
- 实际平台识别依次使用分组名称、渠道模型、分组说明、结构化关系和 provider/platform，修正 Grok 等分组被错误标为 OpenAI 的情况；倍率弹窗筛选与总览使用同一证据链。

### 渠道状态与界面

- 渠道页面和快捷弹窗为每个渠道增加独立折算倍率徽标，统一显示折算值、未设置倍率、倍率不可用和读取中状态，不再复制当前 Key 或同平台倍率。
- OpenAI、Claude、Gemini、Grok 固定为浅绿、浅橙、浅蓝、黑灰首四列，第五平台起保持单行横向滚动；站点卡片等高且充值比例、查看倍率、查看渠道状态固定底部。
- 倍率对比支持 1、3、5、10 分钟自动刷新，默认 5 分钟；手动和自动刷新共享 single-flight。渠道弹窗新增主动刷新，并修复父组件回调变化导致重复自动加载的问题。

### 验证与发布

- 三个授权站点只读验证登录、核心数据、使用记录筛选、倍率、渠道列表与详情全部受支持；敏感凭据仅运行时注入。
- Prettier、ESLint、TypeScript、Vitest 28 文件/168 项、生产构建、开发 Electron E2E 6/6 和 macOS ARM64 打包应用 E2E 6/6 通过。
- macOS 页面检查覆盖四平台单推荐、站点 footer 对齐、当前渠道摘要、渠道倍率徽标、完整渠道弹窗和悬浮窗自动切站；证据位于 `real-test-evidence/macos-1.3.5/`。
- 修复悬浮窗自动切换最近使用站点时继承旧站点 `refreshing`、导致刷新按钮持续禁用的问题，并增加站点级状态隔离回归测试。
- Windows 仅完成 x64 NSIS 交叉构建与 PE/asar 结构验证，不代表 Windows 真机通过；macOS 产物未签名、未公证。

### 1.3.5 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.3.5-mac-arm64.dmg`          | `fbf71daeb8d21a636dfee7a8acf586d5714c2e80c6aaf335053ab5dd8e1890fa` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.5-mac-arm64.dmg.blockmap` | `991c97e01afee9b20b83c301e051910f7eb2572ae854db124e032159463f0eca` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.3.5-win-x64.exe`            | `8e265a419d329b1a4d6c73380b833394a46aa5afe3b5f7ecb48375f2c9163237` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.5-win-x64.exe.blockmap`   | `0dead056763aa8e40fb53497df2052f0e71c033ea95fa41ef6912c9c684845dd` |

## 1.3.4 - 2026-07-20

### 倍率对比与渠道状态

- 倍率对比卡片改为自动加载并内联显示每个分组匹配到的渠道状态、7 天可用率和时间线；无渠道状态明确显示标签，分组之间不再互借渠道结果。
- 保留站点级“查看渠道状态”快捷入口，弹窗继续复用既有渠道列表/详情接口和缓存；内联列表与详情请求支持去重、并发上限、失败隔离、局部重试和陈旧响应保护。
- OpenAI、Claude、Gemini、Grok 固定为前四列并分别使用浅绿、浅橙、浅蓝和黑灰主题；超过四个平台继续单行横向滚动，卡片圆角、加载动画、错误态和无数据态与现有视觉方案对齐。
- 修复内联状态使总览变高后页面切换未滚动到真实 `.content-scroll` 的问题，并修复窄窗口使用记录统计卡片内容被挤成 0 宽的问题。

### 验证与发布

- Prettier、ESLint、TypeScript、Vitest 28 文件/154 项、开发 Electron E2E 6/6、macOS ARM64 打包应用 E2E 6/6 通过。
- macOS 真机检查覆盖默认窗口、窄窗口、加载/成功/失败重试、完整渠道弹窗、四平台配色与横向滚动，证据位于 `real-test-evidence/macos-1.3.4/`。
- Windows x64 仅完成 NSIS 交叉构建与 PE/asar 结构验证，不代表 Windows 真机通过。

### 1.3.4 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.3.4-mac-arm64.dmg`          | `76be6fef59edeff6e36897fe080d8ac7b02d0bf55e6c476623c962c25243ed12` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.4-mac-arm64.dmg.blockmap` | `f116a7c223f4f227ffdd808c833efbd68ee334cf330610fbae8f61f236c844ed` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.3.4-win-x64.exe`            | `cce46d6ebfd54ff28fadf8c7038ed4ad6cf6a6f1ffecd201329c1393a784a1f1` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.4-win-x64.exe.blockmap`   | `a42cfc896ebf4d189e649b2f8211286df8993154c9705ff6d8c9e30cefdcbbda` |

## 1.3.3 - 2026-07-20

### 可访问性与发布

- 倍率平台横向列表新增键盘焦点入口、可访问名称和局部焦点轮廓，保留鼠标与触控横向滚动；E2E 新增 `tabindex` 回归断言。
- Prettier、ESLint、TypeScript、Vitest 27 文件/147 项、生产构建、开发 Electron E2E 6/6 和 macOS `1.3.3` 打包应用 E2E 6/6 通过。
- 三个授权站点在 `1.3.3` 最终时点完成只读复验，登录、核心数据、使用记录、筛选、倍率、渠道列表与渠道详情均成功；倍率分组数为 18、8、22。
- macOS ARM64 打包应用页面证据位于 `real-test-evidence/macos-1.3.3/`；Windows x64 仅完成 NSIS 交叉构建、PE/asar/版本结构验证，不代表 Windows 真机通过。

### 1.3.3 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.3.3-mac-arm64.dmg`          | `d2c9f30d04cce12ead017072fde4d691666b3770f1cf774373c473b27db7d7a4` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.3-mac-arm64.dmg.blockmap` | `69f2b4cf7e1c64ce09de8d2b8723b70695c526cc210e45f2544d60b8260c1efe` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.3.3-win-x64.exe`            | `3487928ba7cff0ed5fc10759974bd8a4c23c2bb3c5ca2c3a43a574f9929b2948` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.3-win-x64.exe.blockmap`   | `2055a31b57a0208979e174897616b9a1e9bf764cffdadc293af06a2f3fbb4b97` |

## 1.3.2 - 2026-07-20

### 修复与验证

- 修复最近 5 分钟时间线包含 `unknown` 时仍可能被渠道汇总 `normal` 状态误判为“稳定”的问题；时间线中的 failed/degraded/unknown 现在分别严格映射为 0/5/3 分，存在新鲜时间点时也会保守校验当前渠道状态。
- 新增矛盾状态回归用例，完整 Vitest 更新为 27 个文件/147 项；Prettier、ESLint、TypeScript、生产构建、开发 Electron E2E 6/6 和 macOS 打包应用 E2E 6/6 通过。
- `1.3.2` macOS ARM64 打包应用重新生成倍率卡、整站渠道弹窗和悬浮窗证据，路径为 `real-test-evidence/macos-1.3.2/`；三个授权站点的既有只读接口验证结果不受本次纯 Renderer 评分修复影响。
- Windows x64 仅完成 NSIS 交叉构建、PE/asar/版本结构验证，不代表 Windows 真机通过。

### 1.3.2 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.3.2-mac-arm64.dmg`          | `fe938da4576e28092d6c52f6b24a4f3838105c3bfce8e9c5fd7c52f480af9d61` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.2-mac-arm64.dmg.blockmap` | `7a33ad5ee91963123d9ca255da119d42c73e0fd2642b0f108f193fa7facdd924` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.3.2-win-x64.exe`            | `98c0f95690f9e32d95ffcaa0876b32e3a7e418f39879fca5fce4615a381951af` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.2-win-x64.exe.blockmap`   | `38c9642ad88fa86a8b7f16299dd0aa18fb4609cd0381308d682fb0144f1079f7` |

## 1.3.1 - 2026-07-19

### 新增与优化

- 跨站倍率对比新增 10 分制评分：`综合分 = 价格分 × 0.6 + 稳定分 × 0.4`；价格分按同平台最低折算倍率归一化，稳定分按最近 5 分钟渠道时间线映射为 10/5/3/0，无渠道状态使用中性 5 分。
- 平台顺序固定为 OpenAI、Claude、Gemini、Grok，其他平台稳定追加；平台卡片始终单行横向滚动，OpenAI/Claude/Gemini/Grok 分别使用浅绿、浅橙、浅蓝和黑灰主题，全部候选按综合分及稳定规则排序并保留。
- 站点卡片新增“查看渠道状态”，仅在点击后复用既有渠道列表和详情接口；弹窗一次展示当前站点全部渠道状态，支持详情切换、加载、空态、不支持、错误、重试、Escape/外部关闭和页面会话缓存。
- 倍率评分只接受分组唯一匹配的渠道状态，多匹配或无匹配保持“无渠道状态”，不会借用站点整体状态或其他渠道结果。
- 悬浮窗复用现有使用记录接口，每 2 秒在可见且无重叠请求时比较各站最近一条记录；最新记录所属站点仅更新悬浮窗本地显示，不改写主窗口或持久化选站。

### 验证状态

- Prettier、ESLint、TypeScript、Vitest 27 文件/146 项、生产构建和 Electron E2E 6/6 通过。
- 三个授权站点完成只读验证：登录、核心数据、使用记录、筛选、倍率分组、渠道列表与渠道详情均成功；倍率分组分别为 18、8、22 个。
- macOS ARM64 未签名 `1.3.1` 打包应用完成完整 E2E 6/6 和页面检查；五个平台保持单行滚动、四种主题色、整站 7 渠道弹窗及悬浮窗自动切换通过，证据位于 `real-test-evidence/macos-1.3.1/`。
- Windows x64 仅完成 NSIS 交叉构建、PE/asar/版本结构验证，不代表 Windows 真机通过。

### 1.3.1 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.3.1-mac-arm64.dmg`          | `250449371f0411378e0d2f625bd31263d21ea4501c0351be410f2cef409ff70b` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.1-mac-arm64.dmg.blockmap` | `3dadb776e9b394c81fef0c4649ba0323b1a1f7c9168fad6022774896a861e970` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.3.1-win-x64.exe`            | `9c9f72890eb22cbba378c96c44c50ea23dbfbe56c8b06c4fa76ee94b716cd44d` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.1-win-x64.exe.blockmap`   | `1af677d905b2fd76a19ee00c6b34bae7507c794476d3fa3b51e164e097c0ac7a` |

## 1.3.0 - 2026-07-19

### 新增与优化

- 每张站点卡片新增充值比例设置，支持 `1:1`、`1:5`、`1:8`、`1:10` 和正数自定义比例；未设置时明确显示“待设置”，且不参与跨站最低价比较。
- 每张站点卡片新增“查看倍率”Popover，独立读取当前站点 `/groups/available?timezone=<IANA>`，展示各平台最低分组、并列最低、全部分组、原始倍率与按 `rate_multiplier / X` 计算的折算倍率。
- 倍率 Popover 支持动态平台筛选、名称/描述搜索、缓存时间、刷新、加载、空态、认证失败、错误与重试状态。
- “站点状态”上方新增跨站倍率对比，按平台汇总折算后的最低中转站和分组；相同最低价全部保留，倍率刷新与 Key/余额全站刷新相互独立。
- 新增站点后自动加载倍率上下文；充值比例和安全倍率缓存跨重启保持，完整 Key、Token、密码和上游任意字段不会进入 Renderer 或普通缓存。
- 修复批量添加最后一个进度事件迟到时覆盖“全部完成”文案的竞态，最后一项无论成功或失败都保持 100% 完成态。
- 修复手动 Key 切回自动选择后卡片仍暂时显示旧手动 Key 倍率的问题；自动候选和手动展示态现在独立维护。
- 倍率接口遇到过期访问 Token 时复用 refresh token 与账号密码重登恢复链路，恢复成功后更新安全倍率缓存。

### 验证状态

- Prettier、ESLint、TypeScript、Vitest 136 项、生产构建和 Electron E2E 6/6 通过。
- 三个授权站点完成只读倍率接口复测：分别返回 18、8、21 个可用分组，动态覆盖 OpenAI、Claude、Gemini、Grok 平台组合。
- macOS ARM64 未签名打包应用完成三站真实页面验收：比例跨重启保持、跨站四平台对比、Popover 搜索/筛选/折算、卡片操作区和视口边界通过；最终 DMG 内应用 E2E 6/6 通过，证据位于 `real-test-evidence/macos-1.3.0/`。
- Windows x64 仅执行交叉构建与结构验证，不代表 Windows 真机通过。

### 1.3.0 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.3.0-mac-arm64.dmg`          | `81b1a676bedc121509cd5b6fa93eed16bb40063c50fb2a57cb16aa6164cc4211` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.0-mac-arm64.dmg.blockmap` | `b8df45a0313314dd05373d1312984250601ce819716100d88e4f5fed843ae23c` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.3.0-win-x64.exe`            | `208a2d598b7e5fee2e8075f2f525a28a5b8719af9b7dd1452204cef642dd959d` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.3.0-win-x64.exe.blockmap`   | `b2a21aaf82a723bf3e0ec712e427a71ca5d0e4303136a5af4820194c72c57223` |

## 1.2.1 - 2026-07-19

### 修复与优化

- “全部站点”刷新改为调度器驱动的全站刷新：当前站点优先、受控并发、同批去重、单站失败隔离，并在每张卡片上独立显示刷新进度。
- Key 摘要按站点安全缓存并提前发布，手动 Key/分组偏好、倍率和额度卡片跨站切换及重启保持；升级时不会因首轮缓存尚未建立而清空旧偏好。
- 使用记录的 Key、分组和模型独立分阶段加载；慢模型接口不再阻塞分组下拉，按站点请求世代防止迟到结果串站。
- 使用记录移除独立“缓存 Token”列，在 Token 单元格组合显示输入、输出和缓存读取 Token；时间统一为 `YYYY/MM/DD HH:mm:ss`，保留首字三色阈值。
- 悬浮窗顶部优先显示站点备注；返回主页面与刷新按钮紧邻位于右下角；支持拖动、自定义坐标持久化、四角预设覆盖及多显示器越界回退。

### 验证状态

- Prettier、ESLint、TypeScript、Vitest 122 项、Electron E2E 6/6 和生产构建通过。
- macOS ARM64 打包应用完成真实站点全站刷新、使用记录、悬浮窗刷新/拖动/返回主页面和页面样式验收；DMG 通过 `hdiutil verify`。
- Windows x64 仅完成 NSIS 交叉构建、PE/asar/版本结构验证，不代表 Windows 真机通过。

### 1.2.1 产物校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.2.1-mac-arm64.dmg`          | `7539a3c1efdc6ba9c6002405896c7906a68ad7d9bc409bc5d26baaa1463d0cdb` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.2.1-mac-arm64.dmg.blockmap` | `d73a3c63def7d26c8e17b6467a66cfc91f5608dd7cb5ecdc12dfd86a4368fe6b` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.2.1-win-x64.exe`            | `2f2166565fc0715ab1a2ac77d1b330a7a1f1030ff18c0da212c22a29a1168e8d` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.2.1-win-x64.exe.blockmap`   | `9a98750815c932d5254f7a24fb33617ef3be68ca623551421ff6c62f09c53b8c` |

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
