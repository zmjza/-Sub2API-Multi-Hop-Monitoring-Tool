# 更新说明

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
