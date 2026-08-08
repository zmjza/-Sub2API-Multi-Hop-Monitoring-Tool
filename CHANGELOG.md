# 更新说明

## 1.9.3 - 2026-08-09

### Radar 动态站点列表

- 将 Radar 从两个固定入口改为 SQLite 持久化的站点列表，支持新增、打开和删除，不提供编辑、排序、搜索、导入导出或恢复默认。
- 首次启动仍返回 `Codex 雷达 / https://codexradar.com/` 与 `分布式雷达 Codex 站 / https://deng.codexradar.com/`；默认项允许删除，空列表保持为空。
- 新增弹窗只接受名称和完整 HTTPS 网址，校验必填、长度、URL 格式、名称重复、规范化 URL 重复和 50 项上限；失败保留用户输入并显示行内错误。
- 删除必须通过应用内二次确认，显示名称和网址，支持取消、确认删除、Esc、遮罩关闭、焦点陷阱、提交防重复和关闭后焦点恢复。
- 列表支持 loading、读取失败重试、空态新增入口；打开按站点 ID 由主进程重新读取持久化 URL，不把任意 URL 直接暴露给打开路径。

### 安全与嵌入边界

- Renderer 通过 `radar:list`、`radar:create`、`radar:delete`、`radar:open`、`radar:close` 与状态订阅操作，主进程校验发送者、条目 ID、URL、重复项和数量上限。
- `WebContentsView` 继续使用 sandbox、contextIsolation、nodeIntegration=false、独立内存 partition，并只允许当前目标 HTTPS origin 内导航；跨 origin、新窗口和额外 webview 继续阻止。
- 删除正在打开的条目时先关闭嵌入视图；顶部关闭图标与 Esc 返回最新动态列表；主窗口 resize 和退出清理保持不变。

### 验证边界

- 格式检查、ESLint、TypeScript、全量 Vitest（46 个文件、345 项）、生产构建和完整 Electron E2E（7 项通过、1 项按配置跳过）已通过。
- 新增 Electron E2E 覆盖默认项、无效 HTTP、重复网址、新增持久化、重启保留、删除取消、确认删除、重启消失和删除全部空态。
- 将传递依赖 `nanoid` 固定到 `3.3.18`，官方 npm Registry 审计为 0 漏洞。
- macOS ARM64 DMG `hdiutil verify` 为 `VALID`，只读挂载打包应用完整 E2E 为 7 项通过、1 项跳过，打包应用真实 Radar 网络用例 1/1 通过；DMG SHA-256 为 `f4fceec23647542264e038547f804d2be916c9569fa496d835707e2e6d3ded90`，blockmap 为 `f8d2939d923b20bc8691fedf065c0c97c7c40bf1ffe2a143158f31091e67ec41`。
- Windows x64 NSIS 为交叉构建证据，主程序为 PE32+ x86-64；EXE SHA-256 为 `7d22d6a2edfb886592986e3a34567312df7a540cb258a2db1b7f3a07172493ed`，blockmap 为 `4ed882c8d2c24956f23044aaf8887b077fcbc42b3bb563a3c2fd2e14b18a2785`，不代表 Windows 真机通过。
- 版本提交 `bab1d77` 已推送 GitHub 与 Gitee；GitHub stable Release `1.9.3` 为非草稿、非预发布，DMG、EXE、两个 blockmap 与 `update-manifest.json` 五项资产均为 uploaded。远端 manifest SHA-256：`35e93977a7f98376e81b022551d257cabfc3c04308b5d2b3916946b436d0efc2`。

## 1.9.2 - 2026-08-07

### 悬浮窗渠道历史

- 将悬浮窗渠道摘要从“最近 1 分钟”改为接口 `GET /channel-monitors` 返回的最近 12 次真实检测；有效记录按 `checked_at` 从旧到新排序，最新记录固定在最右侧，刷新出现新记录时自然左移并移除最旧记录，不新增本地历史。
- 主卡删除“手动指定/自动关联、渠道名称、状态徽标”标题行，只保留“近 12 次可用”与 12 个状态格；按钮仍可打开全部关联渠道，访问名称包含当前主渠道。
- 少于 12 条时仅在左侧补“暂无更早记录”浅灰空槽，空槽不进入可用率分母且与未知状态区分；零记录显示“暂无渠道记录”。每条真实记录提供本地检查时间与中文状态 tooltip/ARIA。
- 全部关联渠道弹框同步采用最近 12 次语义；一分钟稳定性函数继续只服务倍率推荐等既有流程，30–60 秒随机刷新、手动全刷新、缓存、退避、旧响应保护和跨站隔离保持不变。

### 验证边界

- 格式检查、ESLint、TypeScript、全量 Vitest（46 个文件、340 项）、生产构建、开发态 Electron E2E（6 项通过、1 项按配置跳过）和官方 npm Registry 0 漏洞审计已通过。
- macOS ARM64 DMG 完整 Electron E2E 为 6 项通过、1 项按配置跳过；12 条满状态、刷新右移、弹框和 `380×260` 视觉证据来自只读挂载应用。少于 12 条的左侧空槽由同源打包目录应用补充验证通过；证据位于 `real-test-evidence/macos-1.9.2/`。
- DMG `hdiutil verify` 为 `VALID`，严格签名结构、arm64、bundle/asar `1.9.2` 和入口通过；DMG SHA-256：`b8e52c97c42f5fc4d229aeec84690cca4057c05755d03c7af092ca513fe167c7`；DMG blockmap：`fc579687906bb5348677506bd4bb5e66421e117646bb995c74ba53ad8b50c0d9`。
- Windows x64 NSIS、PE32+ 主程序和 asar `1.9.2` 版本/入口交叉检查通过；EXE SHA-256：`e327240541533466f28cbda8d1642ee4672af74660a9bb653fdfa661502fa8ec`；EXE blockmap：`8fe877311aae25a18bd5cfba1ad29066c8106075e1d75282cef54fc215501fa5`。Windows 不代表 Windows 真机通过。
- 版本提交 `13dfdf3` 已推送 GitHub 与 Gitee，标签 `1.9.2` 指向该提交。GitHub stable Release 为非草稿、非预发布，五项资产全部 uploaded；远端 manifest SHA-256：`f0c38b5c44ea301ca8a56c9132892433de945d58c4458af9e671d43a82eba5a2`。

## 1.9.1 - 2026-08-07

### 悬浮窗渠道状态

- 将最近请求 t/s 徽标移动到悬浮窗底栏，在运行状态与扩大/刷新操作之间显示，保留 Gauge 图标、两位小数和慢/正常/快/暂无分级。
- 删除“X 个关联渠道”摘要和覆盖今日统计的旧 `<details>` 面板，主体右侧直接显示当前渠道短卡；短卡包含手动/自动来源、中文状态、最近 1 分钟可用率和 12 段稳定时间线，无有效检查点时明确显示无数据。
- 全部站点与悬浮窗复用同一最终关联和主展示渠道选择函数；多渠道按稳定 ID 选取，不受 API 返回顺序影响。最近一分钟只统计当前时间以内的有效时间点，`failed/error/down/unavailable` 视为明确失败，`degraded/unknown/空状态` 不误写为失败。
- 点击短卡可在固定 `380×260` 窗口内查看当前 Key 的全部关联渠道；弹框内容区独立滚动，标记当前展示渠道，并支持关闭图标、Escape、遮罩关闭、焦点循环与关闭后归还。刷新导致关联失效时会主动关闭，不会在数据恢复后自行重开。
- 将 `brace-expansion`、`fast-uri`、`js-yaml` 和 `undici` 更新到已修复的兼容补丁版本，官方 npm Registry 审计为 0 漏洞。

### 验证边界

- 格式检查、ESLint、TypeScript、全量 Vitest（46 个文件、332 项）、生产构建、开发态和 macOS ARM64 DMG 挂载态 Electron E2E（各 6 项通过、1 项按配置跳过）以及官方 Registry 全依赖审计已通过。
- macOS ARM64 DMG `hdiutil verify` 为 `VALID`，挂载应用的严格签名结构、arm64、包内 `1.9.1` 版本和入口通过；DMG SHA-256：`295361ce2509ae610ee5ff47f39efbc4111e010a3fc6df8c52e7c5ca7aebde14`；DMG blockmap：`dc5b3ec14309738608ed0d69b6d129d032dc31bf47469027a950bec091c73d8d`。
- Windows x64 NSIS、PE32+ 主程序和 asar `1.9.1` 版本/入口交叉检查通过；EXE SHA-256：`3a2cb17d9c1762d1532027967f5d7e852a204cc5f0874e731210165e02835c21`；EXE blockmap：`f0b366283c7c32aad5ba2000b19720de119da7b163bab177b65c23fcb6518046`。Windows 不代表 Windows 真机通过。
- 版本提交 `af88fd8` 已推送 GitHub 与 Gitee；标签 `1.9.1` 指向同一提交。GitHub stable Release 为非草稿、非预发布，DMG、EXE、两个 blockmap 和 `update-manifest.json` 五项资产均为 uploaded；远端 manifest SHA-256：`8d52e9823debb7e01b5776b792be4de2b8fcc6c85fefc019cab8290befc00ac3`。

## 1.9.0 - 2026-08-07

### 请求速度与渠道刷新

- 使用记录将耗时列升级为“耗时 / t/s”，按 `output_tokens * 1000 / duration_ms` 显示最近请求生成速度；`<20 t/s` 标记为慢、`20–<50 t/s` 标记为正常、`>=50 t/s` 标记为快，无效数据不参与分级。
- 悬浮窗实时跟随最近一条使用记录显示 t/s 徽标，并展示当前 Key 对应渠道的最近 1 分钟状态；右下角手动刷新同时更新站点、Key、额度、最新用量和渠道。
- 全部站点卡片渠道状态与悬浮窗额度/渠道改为每轮随机 30–60 秒刷新，可见时运行、隐藏时暂停；渠道稳定窗口从 3 分钟收紧为 1 分钟，保留明确失败状态与退避语义。

### 站点管理与设置

- 全部站点卡片支持拖动排序和键盘方向键调整，顺序持久化；充值比例移除常驻下拉框，改由计算器图标打开预设或自定义比例弹层。
- 批量验证任务改为响应式站点卡片，显示站点 icon、自动抓取的网站名称、URL、账号、核心能力和状态；卡片可打开详情，并保留重新验证与删除入口。元数据抓取限制同源重定向、响应 MIME 和体积，失败时降级为域名。
- 站点管理不再内嵌设置；左下角“通知”打开独立通用设置页面，左下角“设置”打开独立通知规则设置页面，原有配置和持久化协议保持兼容。

### 验证边界

- 格式检查、ESLint、TypeScript、全量 Vitest（46 个文件、317 项）、生产构建、开发态和 macOS ARM64 打包态 Electron E2E（各 6 项通过、1 项按配置跳过）已执行；页面检查覆盖 1600px 宽屏、720px 窄屏和 380×260 悬浮窗。
- macOS ARM64 DMG `hdiutil verify` 为 `VALID`，应用包签名结构、ARM64、包内 `1.9.0` 版本和入口通过；DMG SHA-256：`f5abe3e02071e867aea65d24a847056aca998cc2410af1c655b6b0ed422b2c80`；DMG blockmap：`df56259e1ff7ec8b8767e2b44731ce8da2de23810538bcbf085c74eea873a421`。
- Windows x64 NSIS、PE32+ 主程序和 asar `1.9.0` 版本/入口交叉检查通过；EXE SHA-256：`db2024fb511ebd3d2feae0754f025951881668517d9d5658512f1d71bf4e0580`；EXE blockmap：`926bae1f0045175a87df34f65d2af486ccc61b567725e4e32df972cd59e3f9e1`。Windows 不代表 Windows 真机通过。
- 统一发布命令已基于上述已审计资产生成并上传 `update-manifest.json`；远端 manifest SHA-256：`7b42a44dd0ac359ba2c0e1bd26fc1fdc8994631c78610a504bf87240f478bb08`。标签 `1.9.0` 指向版本提交 `af67152`，GitHub stable Release 为非草稿、非预发布，五项远程资产均已验证。

## 1.8.1 - 2026-08-05

### Radar 嵌入入口

- 将 Radar 自建数据页面改为两个固定入口卡片：`Codex 雷达` 打开 `https://codexradar.com/`，`分布式雷达 Codex 站` 打开 `https://deng.codexradar.com/`。
- 使用 Electron `WebContentsView` 在当前主窗口内容区内嵌网页，不创建新 `BrowserWindow`，不调用系统默认浏览器；保留应用顶部控制区和独立的“关闭雷达网页”图标。
- 支持关闭图标和 `Esc` 关闭嵌入网页并恢复两个入口；加载失败时保留返回入口，主窗口、悬浮窗、站点监控、使用记录、渠道状态和数据库链路不受影响。

### 安全边界

- Renderer 只能发送固定 Radar 目标枚举；远程视图使用独立内存 partition、sandbox、contextIsolation 和 nodeIntegration=false，不注入项目 preload 或 IPC。
- 顶层导航仅允许两个固定 HTTPS origin，跨域跳转和新窗口请求均阻止；远程页面不获得站点凭据、本地文件或数据库能力。

### 验证边界

- Radar 单测、共享目标/白名单测试、全量 Vitest、格式检查、ESLint、TypeScript、生产构建和 Electron E2E 已执行；macOS 真实 Electron 两站点嵌入、关闭、Esc、resize 和截图验收已执行。
- macOS ARM64 DMG `hdiutil verify` 为 `VALID`；SHA-256：`483a46931dd9b0c358060e36ccfa0314aaa0043b9ed5bb9215f2c4b1961eb5f6`；DMG blockmap SHA-256：`30a6a8c9661822f95ea1fd41eda33749784f90f82afef8cda3d4e7da8a73257c`。
- Windows x64 NSIS、PE/asar/版本/入口结构交叉构建通过；EXE SHA-256：`dc636da23268ba3ac63eeb422ddf7174cdafeb1e27ccfcdee45b71caa54dabc7`；EXE blockmap SHA-256：`d86c3e10770ded07561db41085fb2f94fbf2bcbcbf2b3d82604fd9cc00e9ce8f`。Windows 不代表 Windows 真机通过。
- 本地 `release/update-manifest.json` 已按发布脚本 schema 生成并校验，包含两个平台下载 URL 和安装包 SHA-256；本地 manifest SHA-256：`e123a2b8635ba851f404b62bedd857e6c76c039f95f5404f5bcd464c736c695d`。
- 已完成 GitHub 与 Gitee 当前分支推送，GitHub Release `1.8.1` 已验证为 stable、非草稿、非预发布，包含四个安装包/增量资产和 `update-manifest.json`；远端 manifest SHA-256：`3f9bb1d6ae22af3df83ef926f639d8154fc9a2169e3814eaa1c92e442ce715ad`。

## 1.8.0 - 2026-08-05

### 真实 Chrome Turnstile 登录

- Cloudflare Turnstile 站点选择“开始登录”后启动当前系统可用的 Google Chrome，并使用独立临时 Profile 和随机回环 CDP 端口；不读取或复制用户日常 Chrome Profile、Cookie、验证码结果或完整页面存储。
- 支持 macOS 与 Windows 的 Chrome 路径发现、启动失败、窗口关闭、超时、跨站跳转和临时 Profile 清理；登录成功后仅读取同源、固定白名单中的认证字段，并校验登录账号与站点用户名一致。
- GeeTest 继续使用官方 Electron 登录窗口，保留临时隔离会话、同源导航、异步填充、Escape/关闭、网络重试和失败不落盘边界。

### 站点添加与状态体验

- 统一“需要完成安全验证”对话框和消息通知，支持右上角关闭、Escape、窄窗口换行、焦点管理、失败重试，以及“暂不添加/开始登录”操作。
- 同一站点地址允许不同用户名独立添加；同地址同用户名仍拒绝重复添加。站点凭据、Token、Key 缓存、统计、渠道关系、通知和删除行为继续按 `siteId` 隔离。
- 渠道状态采用 stale-while-revalidate：轮询或刷新失败时保留最近一次成功数据、选中项和详情，显示更新失败提示并支持局部重试，不再因缓存过期短暂清空。
- 应用退出时等待 Chrome 认证进程和临时 Profile 清理完成，避免残留认证进程或临时数据。

### 验证边界

- `npm run format:check`、`npm run lint`、`npm run typecheck`、`npm test -- --run`（44 个文件/301 项）、`npm run build` 和开发态 Electron E2E（6/6）均通过；macOS ARM64 与 Windows x64 发布产物均已重新生成并审计。
- macOS ARM64 DMG `hdiutil verify` 为 `VALID`；DMG SHA-256：`39c511e7ba4dd3cd3a2fe19bb0de2a82494aa9e2ba96ebe7b041e39184b4c294`；DMG blockmap SHA-256：`dc87e49677c53351f9d776f5dbf308b37561fe98a362347adafab70232a29d42`。
- Windows x64 NSIS、PE/asar/版本/入口结构检查通过；EXE SHA-256：`64c9251f8e7b383111b6cef5af2b9cb61e0860379e8356a0fd22ce3d987628da`；EXE blockmap SHA-256：`494f1622b56dd40e52f84f3b89fa13d2c0777fae301e60c3ad97978eb3f48c76`。Windows 不代表真机通过。
- 由于 macOS DMG 的 `hdiutil` 生成结果包含非确定性元数据，本次先完成产物审计，再由 `npm run release:publish -- --notes "..." --reuse-artifacts` 复用同一组文件上传，确保 Release 与本条目 SHA-256 一致。
- macOS 真机已由用户确认真实 Cloudflare 人机验证、账号登录、核心接口校验和站点添加成功；应用不绕过、破解或伪造任何人机验证。

## 1.7.12 - 2026-08-05

### 交互认证浏览器边界收口

- 移除 GeeTest Electron 官方窗口中的 User-Agent、UA-CH 和 CDP iframe 目标注入；窗口保留 Electron 原生浏览器标识，不再伪装成 Google Chrome 或改写 `navigator`。
- Cloudflare Turnstile 继续只通过系统 Google Chrome 独立临时 Profile 完成真实人机验证；主进程仅读取同源、有限 Token 白名单，未复制日常 Chrome 会话或验证码结果。
- 保留 GeeTest 官方窗口的临时 session、同源导航、异步表单填充、Escape/关闭、网络重试、核心能力校验和失败不落盘边界。

### 验证边界

- `npm run format:check`、`npm run lint`、`npm run typecheck`、`npm test -- --run`（44 个文件/300 项）、`npm run build` 和开发态/打包态 Electron E2E（均 6/6）均通过。
- macOS ARM64 DMG `hdiutil verify` 为 `VALID`；DMG SHA-256：`d0ceca5777ff258528663d162f539f13d78abeb3bc937488001f95d10732c8d9`；DMG blockmap SHA-256：`c7e710d47d5248db0c1c0ad471db58e2721d0ec0fa86df61b7fe068e6f03edce`。
- Windows x64 NSIS、PE/asar/版本/入口结构检查通过；EXE SHA-256：`e1647481ad6ef2bf81d1b9b0b9de078703b0ef7cddf0cf124961157da27bc93a`；EXE blockmap：`be3d1dd37415b10332ade094f0a38d45ef8d06ab6d31938e36620d122d75edef`。Windows 不代表真机通过。
- macOS Chrome 烟测按 4 秒超时返回 `CHROME_AUTH_TIMEOUT`，本次 Chrome 进程和独立临时 Profile 均清理；页面视觉检查覆盖宽/窄窗口、统一通知、安全验证弹窗和渠道状态弹窗。未执行双远端推送或 GitHub Release。
- 用户随后确认真实 Cloudflare CAPTCHA、账号登录、核心接口校验和站点添加成功；该验收结论不包含任何账号、密码、Token、Cookie 或完整响应。
- Windows 仅记录 x64 交叉构建，不代表 Windows 真机通过；本版本未执行双远端推送或 GitHub Release。

## 1.7.11 - 2026-08-05

### Chrome 会话退出清理

- 修复应用退出时未等待真实 Chrome 认证会话清理的问题；退出流程现在会先阻止默认退出，等待 Chrome 进程和独立临时 Profile 清理完成后再结束 Electron。
- 保留 Cloudflare Turnstile 使用系统 Chrome、GeeTest 使用官方 Electron 窗口、失败直接重试、账号归属校验、同地址不同用户名可重复添加、统一安全通知和渠道状态 stale 展示。

### 验证边界

- `npm run format:check`、`npm run lint`、`npm run typecheck`、`npm test -- --run`（44 个文件/302 项）、`npm run build` 和开发态/打包态 Electron E2E（均 6/6）均通过。
- macOS ARM64 DMG 通过 `hdiutil verify`（`VALID`）；DMG SHA-256：`d9d36685d4d2337c01b57401b2f9362f3c57ba35585ce198e89c88a31bae2d2d`；DMG blockmap SHA-256：`d06486ae1b498ea8cebdfeaf8a5fbf259a2e3d0f73294810aabd6131afec9ad7`。
- Windows x64 NSIS 交叉构建、PE、asar、版本和入口结构检查通过；EXE SHA-256：`e09c752059d514c010c325ee399a75c32fc5653dcc0cca2600a7fadeaedfb1b3`；EXE blockmap SHA-256：`7be7ca9cdb0ac3acf065256072a6509b9334c61c3c369e67a924369cc6d830db`。Windows 不代表真机通过。
- macOS 真实 Chrome 烟测按 4 秒超时返回 `CHROME_AUTH_TIMEOUT`，本次 Chrome 进程和独立临时 Profile 均清理；页面视觉检查覆盖宽/窄窗口、统一通知、安全验证弹窗和渠道状态弹窗。未执行双远端推送或 GitHub Release。
- 真实 Cloudflare CAPTCHA、账号登录、核心接口校验和站点最终保存仍需用户本人完成。

## 1.7.10 - 2026-08-05

### Chrome 登录失败后的直接重试

- Cloudflare Turnstile 的 Google Chrome 登录失败、Chrome 未安装、窗口关闭、来源被拦截或登录结果缺失时，保留安全验证弹窗和“开始登录”入口，用户可以直接重试；所有失败状态仍不会保存站点或覆盖凭据。
- 新增 Renderer 回归测试覆盖上述 Chrome 错误状态，并保留统一安全通知、账号归属校验、重复站点隔离和渠道 stale 展示。

### 验证边界

- 真实系统 Chrome 只使用独立临时 Profile 和回环 CDP；真实 Cloudflare CAPTCHA、账号登录、核心接口校验和站点保存仍需用户本人完成，不能将超时烟测写成验证成功。
- 本版本重新执行格式、Lint、类型检查、全量测试（43 个文件/301 项）、构建、开发态/打包态 Electron E2E（均 6/6）、macOS ARM64 DMG 和 Windows x64 NSIS 交叉构建；打包态还完成了真实 Chrome 启动/独立 Profile 清理烟测；未执行双远端推送或 GitHub Release。
- macOS ARM64 DMG `hdiutil verify` 为 `VALID`；DMG SHA-256：`6e49114b72fed6ce55fa08e41e17e158e75aa013366da6a389db9d10796c246b`；DMG blockmap：`3044782621163ac16f13aeace1edb04b97e687ae8d4d243eba110021cb1d5bd0`。
- Windows x64 NSIS、PE/asar/版本/入口结构检查通过；EXE SHA-256：`1a52f9e20074c79c6b5ff9cc7b3242844b418517390a487496d42068ffe996e9`；EXE blockmap：`79d787b084387f00a12f86576296c79026bd9fab7ec1ef2c17d6e44994d58619`。Windows 不代表真机通过。

## 1.7.9 - 2026-08-05

### Chrome Turnstile 登录、账号归属校验与窄窗口体验

- Cloudflare Turnstile 站点点击“开始登录”后启动当前系统可用的 Google Chrome 独立临时 Profile；用户在真实 Chrome 中完成人机验证和登录，应用仅通过本机 CDP 读取同源、有限白名单登录令牌，不读取或复制现有 Chrome Profile、Cookie、验证码结果或完整页面存储。支持 macOS 和 Windows 的 Chrome 路径发现、启动失败、窗口关闭、超时、跨站跳转和临时 Profile 清理提示。
- 重新验证已有站点时新增 profile 账号归属校验；Chrome 登录的用户名与站点保存用户名不一致时拒绝覆盖旧令牌并提示“登录账号与添加站点用户名不一致”。同一地址允许不同用户名重复添加，同地址同用户名仍拒绝。
- 统一安全验证弹窗与消息通知：固定“需要完成安全验证”文案、右上角关闭图标、`Esc`、焦点循环、暂不添加/开始登录按钮；窄窗口下长文案自动换行、按钮自动布局、弹窗内部滚动且不遮挡主要内容。
- 渠道状态强制刷新失败时继续保留最近一次成功的渠道、选中项和详情，显示 stale 提示并提供重试，不再出现数分钟后状态消失、必须手动重新查看才恢复的问题。

### 验证边界

- `npm run format:check`、`npm run lint`、`npm run typecheck`、`npm test -- --run`（43 个文件/301 项）、`npm run build` 和开发态/打包态 Electron E2E（均 6/6）已通过。
- macOS ARM64 DMG 通过 `hdiutil verify`（`VALID`）；DMG SHA-256：`d3faa8a6d35beeb4afccdf07ccd63d06579fdf13194fa7233349fd7fe95b9255`；DMG blockmap SHA-256：`60ce13bda1867ad895398b19d0adc86031ec93c8194079bce492c965652d308e`。
- Windows x64 NSIS 交叉构建、PE/asar/版本/入口结构检查通过；EXE SHA-256：`c4105b4f16aadebfcc98c3153c80d85a1ab138780bb6722ea139cc6886aed25e`；EXE blockmap SHA-256：`ba59997c10f29f7a65d46986f3fc3192c514f09b8ca142eb1146bdf73c2b77b0`。Windows 不代表真机通过。
- 真实 Cloudflare CAPTCHA、账号登录和站点核心接口保存仍必须由用户本人完成，不能将控件显示或网络恢复写成验证码成功；未执行双远端推送或 GitHub Release。

## 1.7.8 - 2026-08-04

### Turnstile 挑战网络与官方窗口退出修复

- 修复部分网络将 `brunhild.challenges.cloudflare.com` 解析到 RFC 2544 假地址，导致 Cloudflare Turnstile challenge 请求 `ERR_CONNECTION_CLOSED`、用户始终无法完成验证的问题；启动 Chromium 前使用 Cloudflare 公布的 IPv6 HTTPS 边缘提示解析挑战域，官方 challenge 请求恢复后仍由 Cloudflare 完成真实人机判断。
- 交互登录窗口同时支持原生关闭按钮、窗口级 `Esc` 和官方页面级 `Esc`；退出、取消、超时或网络失败均只结束临时验证会话，不保存站点或凭据。
- 保留系统代理到直连的可恢复网络重试、纯 Chrome User-Agent、临时隔离 session、同源顶层导航和有限 Token 白名单；不复制 Chrome 会话、不伪造或绕过 CAPTCHA。

### 验证边界

- 已通过交互认证策略定向测试、Electron TypeScript 编译和真实 macOS ARM64 Electron 窗口 challenge 网络复核；官方窗口已自动填入脱敏测试字段，challenge 请求不再出现 `ERR_CONNECTION_CLOSED`，退出后不保存站点。
- 真实 Turnstile checkbox 的点击、挑战结果、登录、profile/Key/分组/倍率/统计核心校验和站点保存仍需用户本人完成；Windows 仅执行 x64 交叉构建，不作为真机验收。

## 1.7.7 - 2026-08-04

### Turnstile 官方窗口自动填充修复

- 修复 SPA 登录页异步渲染导致官方登录窗口首次找不到邮箱/密码输入框的问题；窗口会在表单出现前持续重试安全填充，字段已有内容时不覆盖用户输入。
- 真实 `ai.maok.shop` 复测确认官方窗口显示 Cloudflare Turnstile 且账号、密码已填入，登录按钮继续由站点在用户完成挑战后启用；应用不代做 CAPTCHA、不复制浏览器会话。
- 取消安全验证后将添加流程阶段恢复为“等待开始”，右上角关闭图标、`Esc` 和“暂不添加”继续复用统一通知并保证不保存半成品。

### 验证边界

- 本轮新增回归覆盖异步凭据填充和取消后阶段复位；完整测试、构建、macOS 打包交互和 Windows 交叉构建结果在本轮验证后补录。
- macOS 真实 Turnstile 控件已加载，但 CAPTCHA、登录、profile/Key/分组/倍率/统计核心校验和站点保存仍需用户本人在官方窗口完成；Windows 仍不作为真机验收。

## 1.7.6 - 2026-08-04

### Turnstile 挑战网络恢复与验证窗口退出

- 在 Electron 启动阶段仅为 Cloudflare challenge 域设置公开边缘解析规则，规避部分系统代理/DNS 将 `brunhild.challenges.cloudflare.com` 解析到 RFC 2544 假 IP 后导致的 TLS 关闭；官方登录页仍在原站点和临时隔离 session 中加载。
- 交互窗口首次遇到可恢复的 challenge 传输错误时自动切换直连并重载官方登录页；无法恢复时保留安全验证流程，不伪造 Turnstile 结果、不复制 Chrome 会话。
- 安全验证弹窗保留右上角关闭图标、`Esc` 和焦点循环；关闭、取消或失败均不保存站点，成功后才继续 profile、Key、分组、倍率和统计核心校验。

### 验证边界

- 当前自动化回归为 42 个 Vitest 文件、286 项测试；已通过 `npm run format:check`、`npm run lint`、`npm run typecheck`、`npm run build` 和开发态 Electron E2E（待本轮最终产物复核后补充打包命令与哈希）。
- macOS ARM64 隔离打包应用已真实打开 `ai.maok.shop/login` 并显示 Turnstile “Verify you are human” 控件，说明 challenge 域不再立即 TLS 关闭；尚未代用户点击或完成 CAPTCHA，真实登录、核心接口校验和站点保存继续标记为“待用户介入/受阻”。
- Windows 仅执行 x64 NSIS 交叉构建与结构检查，不表述为 Windows 真机通过；本轮未执行双远端推送、`release:publish` 或正式 GitHub Release。

## 1.7.5 - 2026-08-04

### Turnstile 验证重试与退出体验

- 官方登录窗口遇到 Turnstile 挑战网络失败、加载失败或超时后保留安全验证弹窗，用户修复系统代理或网络后可以直接重试，不需要重新填写站点信息。
- 安全验证弹窗增加右上角关闭图标；点击关闭图标、点击“暂不添加”或按 `Esc` 都会退出当前验证流程，且不会保存站点或覆盖已有凭据。
- 交互登录 Token 读取继续限制在固定白名单，并兼容官方页面写入 `localStorage` 或 `sessionStorage` 的站点。

### 验证边界

- 已通过 `npm test -- --run`（42 个文件/283 项）、`npm run format:check`、`npm run lint`、`npm run typecheck`、`npm run build` 和开发态 Electron E2E（6/6）。
- macOS ARM64 DMG `hdiutil verify` 为 `VALID`；DMG SHA-256：`3c13ae31b54dce57d4919970eacb01d3944e57c93da6200d829d181379fb76b3`；DMG blockmap：`db873b189d6084c68090f1152080d23cf710abb8a994f22d051dbac9f2cc7e9f`。Windows x64 NSIS 交叉构建完成；EXE SHA-256：`17ce8051656184cd0eb40379658881dc473675b579bc173a15e69fddf360e2a6`；EXE blockmap：`4273c3717092451d83cc6fe9aff8e9d0f5f0ce5a4690e64916485993a64d1706`。Windows 不代表真机通过。
- 当前机器到 `brunhild.challenges.cloudflare.com` 的 DNS 被解析为 `198.18.0.111`，TLS 连接失败；通过公网 Cloudflare IPv6 复核可建立连接，但本地 Electron 真实 Turnstile 仍未完成。该限制需要用户网络或系统代理恢复，应用不会绕过或伪造人机验证。
- 本轮未执行双远端推送、`release:publish` 或正式 GitHub Release。

## 1.7.4 - 2026-08-04

### 批量站点验证安全门禁修复

- 批量添加每个站点先读取公开 GeeTest/Cloudflare Turnstile 开关；检测到交互验证时按单项报告“需要单独完成安全验证”，继续处理其他 URL，不再尝试密码登录。
- 新增回归测试覆盖“公开设置要求 Turnstile 但登录接口暂时返回成功”的场景，确保不会绕过官方登录窗口或保存站点。

### 验证边界

- 当前自动化回归：`npm run format:check`、`npm run lint`、`npm run typecheck`、42 个 Vitest 文件/281 项测试、开发态 Electron E2E 6/6、macOS ARM64 打包应用 E2E 6/6、`npm run build` 和 `npm run pack` 均通过。
- macOS ARM64 DMG 通过 `hdiutil verify`（`VALID`）；DMG SHA-256：`78a7c6e8095153463cf40e530aaab136ef626e091e706628f2fb37c77f57a87c`；DMG blockmap SHA-256：`f78d31a48b5e811df7aff4ed56075f0aa9a27fb0892325f54060d63f2a74b3cb`。主程序为 Mach-O ARM64，Info.plist 版本为 `1.7.4`。
- Windows x64 NSIS 交叉构建完成；`dist:win`、PE/asar/版本/入口检查通过。EXE SHA-256：`9653364c70a6f13158e3f7bebb524043bc3714215e44b5c2570d00a110502494`；EXE blockmap SHA-256：`0ee79977a7b8652f7e6670c3f4b4348e5e4abf138f196de67ca1c35828b1b912`。Windows 不代表真机通过。
- 版本测试断言已改为读取当前 `package.json` 并校验 CHANGELOG 首个版本标题，避免 SemVer 递增后残留旧版本硬编码。
- 真实 Turnstile challenge 仍受外部挑战域网络阻塞，macOS 真实账号登录和核心接口保存继续记录为“受阻”；不复制 Chrome 会话、不绕过或伪造验证码结果。
- 本版本仅完成源码和本地构建收口，未经授权不执行双远端推送、`release:publish` 或 GitHub Release。

## 1.7.3 - 2026-08-04

### 交互认证、保存回滚与站点隔离收口

- 交互认证 Token 支持只有 access token 的站点；refresh token 缺失时仍按官方窗口验证并完成核心能力校验。
- 官方交互窗口新增同源顶层 `will-redirect` 拦截，继续保持临时 session、sandbox、contextIsolation、无 preload、新窗口拒绝和有限 Token 白名单。
- 重新验证失败时原子恢复旧凭据、快照、Key 缓存、Key 偏好、运行态、错误和耗时；保存或删除站点时同步清理快照、通知规则、进行中的刷新和 Key 用量缓存。
- 同地址不同用户名继续允许独立站点；同地址同用户名仍拒绝，所有站点级凭据、Token、缓存、统计、渠道关系、通知和删除行为按 `siteId` 隔离。

### 验证边界

- 已通过 `npm run format:check`、`npm run lint`、`npm run typecheck`、`npm test -- --run`（42 个文件/280 项）、`npm run test:e2e`（6/6）、`npm run build`、`npm run pack`、`npm run dist:mac` 和 `npm run dist:win`。
- macOS ARM64 DMG `hdiutil verify` 为 `VALID`；本次重建 DMG SHA-256：`5838392816557565d03ad99d124408185f16b3ef87c0a3525445aa8e847543d1`；DMG blockmap SHA-256：`f9886a61a160ca5b1abe08c9b6e979784fec9f5ab40f04d6f00c6ff119b5d780`。
- Windows x64 NSIS 交叉构建完成；本次重建 EXE SHA-256：`9a99ca3051777826ec253de5a65e79e8b4cdb771c81086b49501e3daf1edc189`；EXE blockmap SHA-256：`77d4b7595eae39cbba43807f4bde53dbd25f095511cd987646906570cd6ca195`；PE、asar、版本和入口检查通过。Windows 不代表真机通过。
- 最新 macOS ARM64 打包应用 E2E 为 6/6；真实站点添加流程已打开官方登录窗口并显示动态安全验证提示，但 Turnstile 挑战资源仍未建立连接，未保存站点。
- 本版本的页面样式结果沿用 `real-test-evidence/macos-1.7.2/` 受控验证证据；真实 GeeTest/Cloudflare Turnstile challenge 仍必须由用户本人在官方登录窗口完成。
- 新增公开只读证据 `real-test-evidence/macos-1.7.3/README.md`：Chrome 页面检测到 Turnstile iframe 和响应字段，但挑战域返回 `net::ERR_CONNECTION_CLOSED`；未提交账号，真实登录仍受阻。
- macOS ARM64 真实 Turnstile challenge 仍可能受挑战域网络阻断；Windows 仅记录 x64 NSIS 交叉构建，不代表 Windows 真机通过。

## 1.7.2 - 2026-08-04

### 渠道状态缓存回退与交互认证错误分类

- 修复渠道状态弹窗强制刷新失败后进入完整错误态的问题：保留最近一次成功的渠道、当前选中项和已读取详情，显示“更新失败，显示上次数据”并提供局部重试入口。
- 修复弹窗选中渠道变化导致自动加载 effect 重新执行的问题；选中渠道通过稳定 ref 保存，刷新按钮不会因组件状态更新而重复请求或清空内容。
- 统一识别登录接口在 2xx、401、400 等 HTTP 状态下返回的 GeeTest/Cloudflare Turnstile 验证要求，Renderer 只收到安全的 provider 和固定错误文案。
- 站点正式保存增加串行化和失败回滚，安全存储或数据库写入失败时不留下站点、凭据、缓存或运行态半成品。

### 验证边界

- 已通过 `npm run format:check`、`npm run lint`、`npm run typecheck`、`npm test -- --run`（42 个文件/278 项）、`npm run test:e2e`（6/6）、`npm run build`、`npm run pack`、`npm run dist:mac` 和 `npm run dist:win`。
- macOS ARM64 DMG `hdiutil verify` 为 `VALID`；DMG SHA-256：`c3076c0824f20025fe6047a61208521cbc3d1f7addaddd4054f0269b3ed22fe`；DMG blockmap SHA-256：`592275b50e2e77c6e2498fc9179d7aac71e4a291bc211598eab96f09bb24e798`。
- Windows x64 NSIS 交叉构建完成；EXE SHA-256：`8075bf5dc76394ecdd1bb2800e3266368ec38ed29ac3cdb05bcc34e2eefb5e91`；EXE blockmap SHA-256：`bf90f3f816934d11fea7b6465b5ef8aa26285b74726772758a4ca0d8e95f379f`；同时确认 PE、asar、版本 `1.7.2` 和入口文件存在。Windows 仅代表 x64 交叉构建，不代表 Windows 真机通过。
- macOS ARM64 打包应用受控页面检查：弹窗宽屏与窄屏均为 `440×198`，动态显示 `Cloudflare Turnstile`，Escape 取消后站点数为 `0`；截图位于 `real-test-evidence/macos-1.7.2/`。
- 真实 GeeTest/Cloudflare Turnstile challenge 仍必须由用户本人在官方登录窗口完成；若挑战域受网络阻断，保留受阻证据，不绕过或伪造验证结果。

## 1.7.1 - 2026-08-03

### 官方登录窗口的 Turnstile 兼容性修复

- 官方登录窗口加载前移除 Electron User-Agent 标记，保留 Chromium/Chrome 内核信息，避免 Cloudflare Turnstile 将 Electron 页面判定为不兼容并关闭 challenge 请求。
- 保留临时 session、sandbox、contextIsolation、同源顶层导航和有限 Token 白名单；不复制 Chrome Cookie、验证码令牌或完整页面存储。
- 新增 User-Agent 策略单测；真实站点只读公开设置确认继续识别为 Turnstile，真实挑战仍必须由用户本人在官方窗口完成。
- 1.7.1 macOS ARM64 隔离打包复测已确认对话框动态显示 `Cloudflare Turnstile`，官方窗口 UA 已还原为纯 Chrome 形态；challenge iframe 仍为 0，`brunhild.challenges.cloudflare.com` 返回 `ERR_CONNECTION_CLOSED`，记录为外部 Cloudflare/Electron 网络阻塞，不绕过或伪造挑战。
- 受控本地公开设置场景的 macOS 打包应用页面检查通过：对话框 `440×198`、按钮 `88×36`、默认焦点和 Escape 行为稳定，取消后没有保存站点；该结果不替代真实验证码挑战。

### 验证与产物

- `npm run format:check`、`npm run lint`、`npm run typecheck`、`npm test -- --run`（41 个文件/273 项）、`npm run test:e2e`（6/6）和 `npm run build` 已通过；macOS ARM64 新包的 Turnstile 真实 challenge 仍受外部网络阻塞。
- macOS ARM64 DMG `hdiutil verify` 为 `VALID`。DMG SHA-256：`61b51459e1d7451e51ce6b7811809d682d73429bf62884469050f04f7d2cbca4`；DMG blockmap SHA-256：`1086869b2dc5ec512f486d464f78758b3432e6b6c76cc6390ce963526ffad71e`。
- Windows x64 NSIS 已完成交叉构建、PE/asar 版本与入口检查。EXE SHA-256：`dae9236eebf3e8312d8f8d985f20dac6990f36e4bba72d263717c0f8e74a3c9a`；EXE blockmap SHA-256：`98638d885171c1a32b808506a79e31075cb5d424138440a8e0505da80a4c6dd7`。Windows 不表述为真机通过。
- 未执行发布授权、双远端推送或 `release:publish`，因此没有生成或验证正式 `update-manifest.json`；当前 release 产物仅作本地构建证据。

## 1.7.0 - 2026-08-03

### GeeTest 与 Cloudflare Turnstile 统一登录验证

- 站点添加先读取公开设置并识别 GeeTest 或 Cloudflare Turnstile；统一弹出“需要完成安全验证”对话框，验证必须在官方登录窗口完成，成功后继续核心接口校验并原子保存。
- 交互认证使用通用 `interactive` 会话，兼容历史 GeeTest 凭据；Token 失效时进入 `auth-required`，不再静默密码重登，并提供主动重新验证入口。
- 扩展 IPC 与安全存储字段只传递固定 provider 白名单；不向 Renderer 暴露密码、Token、Cookie、验证码令牌或原始响应。

### 同站多账号与批量添加

- 同一规范化站点地址仅拦截相同账号身份；邮箱比较忽略大小写，其他用户名保留大小写，去除首尾空格。
- 相同地址的不同账号拥有独立 siteId、凭据、Token、Key 缓存、统计、刷新状态、通知状态和删除行为；站点列表显示安全脱敏账号标签。
- 批量添加遇到交互验证按单项报告“需要单独完成安全验证”，继续处理其他地址，不连续弹出验证窗口。

### 验证状态通知与渠道稳定性

- 安全验证等待、成功、取消、超时、失败和重新验证全部复用现有消息通知系统；保留当前浅色视觉、焦点回收、Escape、窄窗口换行和跨平台尺寸约束。
- 保留并回归渠道状态 stale-while-revalidate 行为，手动选择的渠道在轮询和刷新期间持续显示，不因缓存过期误显示为空。

### 验证结果与已知限制

- 自动化验证：`npm run format:check`、`npm run lint`、`npm run typecheck`、`npm test -- --run`（41 个文件/271 项）、`npm run test:e2e`（6/6）和 `npm run build` 已通过；本轮 macOS ARM64 打包应用 E2E 也为 6/6。
- 本轮 macOS ARM64 DMG 已通过 `hdiutil verify`，页面证据位于 `real-test-evidence/macos-1.7.0/`；Windows 仅执行 x64 NSIS 交叉构建、PE/asar/版本/入口结构检查，不表述为 Windows 真机通过。真实 GeeTest/Turnstile 挑战仍必须由用户在官方登录窗口完成，未以自动化代做。
- 外部站点的真实人机验证仍必须由用户在官方登录窗口完成；应用不绕过、破解或复制验证码令牌。

## 1.6.0 - 2026-07-29

### GeeTest 安全验证与统一状态通知

- 添加站点时先读取公开设置；启用 GeeTest 的站点显示应用内安全验证对话框，由用户在官方登录窗口亲自完成人机验证，验证成功后自动继续添加。
- 交互登录窗口使用临时 Electron session、sandbox、contextIsolation、严格同源顶层导航和有限 Token 白名单；Token 经核心接口验证后才保存，取消、超时或验证失败不会留下半成品。
- GeeTest 站点优先使用 refresh token；refresh 失效后标记为需要重新验证，不再后台使用密码重登或自动弹出验证窗口。
- 将更新专用提示升级为共享应用内状态通知，支持 loading、success、info、warning、error、稳定任务原位更新、最多三条、自动关闭、键盘和无障碍语义，并统一清理原始 Electron IPC 错误前缀。
- 站点添加、批量结果、更新检查、API Key 复制/分组保存、充值比例、备注、渠道关联、手动刷新和删除反馈已复用统一通知；字段错误、批量进度、下载百分比和长期渠道状态仍保留在上下文内。

### 渠道状态持续展示修复

- 总览渠道状态改为 stale-while-revalidate：自动刷新期间继续展示最近一次成功数据，失败时显示“更新失败，显示上次数据”、最后成功时间和重试入口。
- 只有从未成功读取过渠道列表时才显示完整错误；详情失败保持局部，单站失败不污染其他站点，手动多渠道关联不会被轮询清除。
- 保持可见时默认 60 秒低频轮询、隐藏暂停、恢复且数据超过 30 秒立即刷新，以及 Retry-After 和 2/4/8/15 分钟退避；退避期间不伪装为刷新成功，也不产生后台 Toast。

### 验证与产物

- Prettier、ESLint、TypeScript、40 个 Vitest 文件/261 项、生产构建和 Electron E2E 6/6 通过；macOS 真机完成 GeeTest 添加、通知视觉、两个渠道轮询周期和重启恢复。
- macOS ARM64 DMG 通过镜像和 ad-hoc 签名校验，Release SHA-256 为 `a913239d462b6db46d77c66e7e0cef77f50a33fbf25cee01661d9e0bbeba7a97`；Windows x64 NSIS 完成交叉构建、PE/asar/版本/入口检查，Release SHA-256 为 `35cd3ad40bb031084217bb02032c182c5bbc1ed3e93b505ea7d3a413be92f74f`。
- 依赖审计已应用所有非破坏性补丁；仍报告 16 个仅位于 `electron-builder` 打包工具链的高危传递依赖。npm 的唯一自动方案会破坏性降级打包器，因此本版不采用；应用运行时不加载该工具链。
- Windows 无可用真机时只记录交叉构建与结构校验证据，不表述为 Windows 真机通过。

## 1.5.3 - 2026-07-27

### 在线更新版本识别修复

- 修复版本徽标在 `1.5.2` 仍显示 `v1.5.1` 的问题，改为从 Electron 主进程读取真实 `app.getVersion()`。
- 更新检查请求增加缓存绕过参数和 `Cache-Control: no-cache`，避免 GitHub `releases/latest` CDN 返回旧 Release。
- 更新服务的实际版本比较逻辑保持不变：`1.5.1` 检测到 `1.5.2` 时返回可用更新，当前版本不会被错误标记为最新。

### 1.5.3 远程 Release 资产校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.5.3-mac-arm64.dmg`          | `4b15c4f77c30162b7708a100950f8a06688f57e6df1f3b93217697870727809f` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.5.3-mac-arm64.dmg.blockmap` | `736c82bae7a0191d519c66569ab78a58bb13c53205f3984daace74bfcf56f9b0` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.5.3-win-x64.exe`            | `677343a0da2172efc524ab2e2b978747ad64cca0994ef5fd72cc6f8e1ee353eb` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.5.3-win-x64.exe.blockmap`   | `eb28b5bcbdfcf2923f55ac333ed01a2a64067b1a09ef13aa94134f56e1e657d9` |
| 更新清单             | `update-manifest.json`                                   | `3c9d1e3334c8507d3a2193792cdc160b6fd54e0b413653a1205bb575b369ec4c` |

## 1.5.2 - 2026-07-27

### 渠道关联入口与交互优化

- 移除渠道状态页面顶部独立的 Key 分组渠道关联面板，避免在错误的页面上下文中进行关联。
- 将关联入口移动到“全部站点”页面的“查看渠道状态”弹层；每个渠道卡片右上角提供独立的“关联/已关联”按钮。
- 支持同一 Key 分组关联多个渠道、逐个取消关联、保存中反馈、保存失败回滚和成功状态同步；点击关联按钮不会切换渠道详情。
- 保留 `group_id` 精确匹配、自动关联优先级、手动关系持久化、IPC 白名单和缓存刷新规则。

### 1.5.2 远程 Release 资产校验

| 平台                 | 文件                                                     | SHA-256                                                            |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| macOS ARM64          | `Sub2API-Multi-Hub-Monitor-1.5.2-mac-arm64.dmg`          | `99e9a4158ba0f1d64ae01f127ee71baf44530264b0c10014b87a7a6e2e87e9bc` |
| macOS ARM64 blockmap | `Sub2API-Multi-Hub-Monitor-1.5.2-mac-arm64.dmg.blockmap` | `092a6bccbc6c10d18f0ac8475004b5648229eea6df5765fe4088eba7cdba2081` |
| Windows x64 NSIS     | `Sub2API-Multi-Hub-Monitor-1.5.2-win-x64.exe`            | `d93b7c48b43622324852c5646cd971a8952bf29881266eab156a95025234c62b` |
| Windows x64 blockmap | `Sub2API-Multi-Hub-Monitor-1.5.2-win-x64.exe.blockmap`   | `429b0fb1e3a6a5cbfc51f2938fdef07f1a7f8e342afa02144eeb1159546b1d41` |
| 更新清单             | `update-manifest.json`                                   | `c5fff7c08d0891cc735ebbe079a61386b941ae85b0212c1026dc1e348cb52562` |

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
