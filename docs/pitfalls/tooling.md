# 工具链避坑

## npm 项目中临时运行 pnpm 会改写依赖安装状态

**现象**

在以 `package-lock.json` 和 npm 安装的项目中执行 `pnpm exec vitest` 后，pnpm 创建了 `pnpm-lock.yaml`，并把部分现有依赖移入 `node_modules/.ignored`，随后因构建脚本审批要求以 `ERR_PNPM_IGNORED_BUILDS` 中止。

**根因**

pnpm 会按自身的锁文件、链接布局和依赖构建许可规则协调 `node_modules`。在 npm 已管理的工作区临时混用 pnpm，不是只执行一个二进制，而可能改变整个依赖目录状态。

**正确做法**

本项目以 `package-lock.json` 和 npm 脚本为依赖事实来源。需要绕过当前 shell 的 Node 路径时，显式把项目依赖使用的 Node runtime 加入 `PATH`，再运行 `npm run ...` 或 `./node_modules/.bin/...`；不要通过另一包管理器临时执行。

**验证方式**

使用项目锁文件对应的 Node/npm 环境运行格式、lint、typecheck、Vitest、构建和 E2E，确认依赖能被解析且没有再次发生包管理器迁移。检查最终状态时单独说明已产生的 `pnpm-lock.yaml`，不得把它当作项目正式锁文件依据。

**禁止事项**

不要在 npm 管理的工作区执行 `pnpm exec`、`pnpm install` 或反向混用；不要在未获删除许可时擅自清理事故产生的文件；不要把构建脚本审批失败误判为测试失败。

**相关文件或命令**

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `npm run test`
- `./node_modules/.bin/vitest`

**适用范围**

本项目本地依赖执行、CI、测试和打包环境。

## ESLint 核心包和配置包不能假设版本号同步

**现象**

首次安装依赖时，固定 `@eslint/js@10.7.0` 返回 `ETARGET`，提示该版本不存在；同一时间查询到的 `eslint` 版本为 `10.7.0`，但 `@eslint/js` 的实际可用版本为 `10.0.1`。

**根因**

`eslint` 与 `@eslint/js` 是分别发布的 npm 包，不能仅根据 `eslint` 的版本号推断 `@eslint/js` 存在同号版本。

**正确做法**

在锁定依赖前分别运行 `npm view eslint version` 和 `npm view @eslint/js version`，再使用真实发布且相互兼容的版本并生成锁文件。

**验证方式**

运行 `npm install`、`npm run lint` 和 `npm run typecheck`，确认安装成功且 ESLint 配置可以加载。

**禁止事项**

不要机械地给相关 npm 包填写相同版本号；不要在 `ETARGET` 后反复清理缓存而不先确认版本是否真实发布。

**相关文件或命令**

- `package.json`
- `package-lock.json`
- `npm view eslint version`
- `npm view @eslint/js version`
- `npm run lint`

**适用范围**

项目初始化、依赖升级、锁文件重建和 CI 安装。

## npm 镜像可能不实现安全审计接口

**现象**

使用当前 npm 镜像运行 `npm audit --omit=dev --audit-level=high` 时，镜像对安全公告批量接口返回 `404` 和 `NOT_IMPLEMENTED`，审计命令失败，但没有给出漏洞判断。

**根因**

当前配置的 npm 镜像未实现 npm Audit API。该失败表示审计服务不可用，不等于依赖存在漏洞，也不等于审计通过。

**正确做法**

保留用户和全局 Registry 配置不变，仅为本次审计命令显式指定 npm 官方 Registry：`npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org`。

**验证方式**

确认使用官方 Registry 的审计命令正常退出，并以其实际输出判断结果。本项目建立基线时该命令输出 `found 0 vulnerabilities`。

**禁止事项**

不要把镜像接口错误写成“发现漏洞”或“审计通过”；不要为了单次审计静默修改用户的全局 npm Registry。

**相关文件或命令**

- `package-lock.json`
- `npm audit --omit=dev --audit-level=high`
- `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org`

**适用范围**

本地依赖审计、CI 安全检查和使用不完整 npm 镜像的开发环境。

## Playwright 会清理默认 test-results 目录

**现象**

真机截图和日志保存到 `test-results/real-device/` 后，再次运行 Electron E2E，真机证据目录被 Playwright 启动时清空。

**根因**

Playwright 将 `test-results/` 视为自己的输出目录，会在新测试运行前清理旧结果；该目录不适合保存跨轮次真机证据。

**正确做法**

自动化临时截图继续放在 `test-results/`；需要跨命令保留的真机证据使用独立的 `real-test-evidence/<platform-date>/` 目录，并在文档中引用稳定路径。

**验证方式**

运行一次 `npm run test:e2e` 后确认稳定证据目录仍存在，且最新自动化截图在 `test-results/` 中重新生成。

**禁止事项**

不要把唯一真机证据放在 Playwright 管理目录；不要在证据丢失后沿用旧路径宣称文件仍存在。

**相关文件或命令**

- `playwright.config.ts`
- `real-test-evidence/`
- `npm run test:e2e`

**适用范围**

macOS 真机验收证据、Playwright E2E 和后续 CI 产物归档。

## 回退版本号不等于恢复历史代码树

**现象**

应用和安装包显示为 `1.0.0`，但界面仍包含 `1.1.0` 才加入的使用记录“延迟”列。

**根因**

此前只把 `package.json`、锁文件和构建配置中的版本号从 `1.1.0` 改回 `1.0.0`，业务代码仍沿用 `1.1.0` 的代码树。

**正确做法**

恢复历史版本时先从 Gitee 提交历史确认该版本最后一个真实提交，再以该提交的完整代码树为基线；本次已确认 `0dd640c` 是发布 `1.1.0` 前最后一个 `1.0.0` 提交。恢复后重新执行完整验证和双平台打包。

**验证方式**

检查 `package.json` 为 `1.0.0`，并确认 Usage Renderer 中不存在“延迟”列、`latencyMs` 或 `formatUsageLatency`；运行完整测试、构建和产物审计。

**禁止事项**

不要只修改版本字段后宣称已恢复历史版本；不要把新版本代码打包成旧版本文件名。

**相关文件或命令**

- `git log --all -- package.json`
- `git diff <历史提交>..HEAD`
- `src/renderer/shells/usage/UsagePage.tsx`
- `npm run dist:mac`
- `npm run dist:win`

**适用范围**

所有历史版本恢复、重新打包和 Gitee 发布操作。

## Electron E2E 不得与 Renderer 生产构建并行运行

**现象**

完整 E2E 的预览导航出现 `ERR_FILE_NOT_FOUND`，目标是项目内正常存在的 `dist/index.html`；同一轮生产构建随后成功，其余测试仍通过。

**根因**

Vite 生产构建会清理并重建 `dist/`。若 `npm run build` 与 `npm run test:e2e` 并行，Playwright 可能在输出目录已清理、首页尚未重新写入的窗口期执行 `file://` 导航。

**正确做法**

先完整执行 `npm run build` 并确认成功，再单独执行 `npm run test:e2e`。任何会创建、清理或替换 E2E 输入产物的命令必须与消费方串行。

**验证方式**

构建完成后不再改写 `dist/`，单独重跑 `npm run test:e2e`；6 项全部通过且不再出现 `ERR_FILE_NOT_FOUND`。

**禁止事项**

不要把产物生产命令与依赖该产物的测试放入同一个并行批次；不要把该文件竞态误判为 Renderer 路由缺失并修改业务代码。

**相关文件或命令**

- `package.json`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run build`
- `npm run test:e2e`

**适用范围**

本项目所有基于 `dist/`、`dist-electron/` 或打包目录的 Electron E2E 与发布验证。

## 全站刷新 E2E 不应把 inflight 复用误判为漏刷新

**现象**

两个站点执行全站刷新时，E2E 偶发只观察到一次新的 `/keys` 请求，按“站点数等于新增请求数”断言会超时，但两个站点最终都完成刷新。

**根因**

应用启动后的错峰自动刷新可能已经为当前站点创建了 inflight。手动全站刷新按设计复用该 Promise，并只为其余站点创建新请求；请求计数无法区分“漏刷新”和“复用正在运行的刷新”。

**正确做法**

调度器单测直接证明全站任务复用当前站点 inflight 后仍访问其余站点。Electron E2E 断言点击后所有站点卡片立即进入刷新态、至少发生一个新请求、按钮等待整批任务完成，并比较每个站点刷新前后的 `fetchedAt`。

**验证方式**

先运行 `npm test -- --run electron/main/services/refresh-scheduler.test.ts`，再串行执行构建和本地集成 Electron E2E；确认调度器访问全部 site ID，且两个站点的 `fetchedAt` 都推进。

**禁止事项**

不要取消 inflight 去重来满足请求计数；不要只把超时时间加长；不要仅断言按钮动画而不验证每站点结果。

**相关文件或命令**

- `electron/main/services/refresh-scheduler.ts`
- `electron/main/services/refresh-scheduler.test.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run build`
- `npm run test:e2e`

**适用范围**

启动错峰刷新、手动全站刷新、自动刷新重叠和 Electron 本地集成测试。

## 同站多入口刷新 E2E 必须显式处理手动冷却窗口

**现象**

同一条 E2E 先点击使用记录顶栏刷新，随后很快点击悬浮窗刷新；第二个按钮保持可用且没有新请求，测试误报悬浮窗刷新失效。

**根因**

顶栏和悬浮窗都调用同站 `manualRefresh`，共享 5 秒防连点。第二次操作落在冷却窗口内时按产品规则立即返回，Renderer 的临时刷新态可能短于 Playwright 观察间隔。

**正确做法**

需要分别验证两个入口时记录第一次手动刷新的开始时间，在第二次操作前只等待剩余冷却时间；防连点本身由调度器单测独立验证。

**验证方式**

完整 Electron E2E 中先验证使用记录刷新期间的模型补齐，再跨过 5 秒边界点击悬浮窗刷新，断言按钮禁用、新请求产生和最终恢复。

**禁止事项**

不要删除或缩短生产冷却来迁就 E2E；不要固定无条件长等待；不要把冷却命中写成网络失败。

**相关文件或命令**

- `electron/main/services/refresh-scheduler.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

顶栏、总览、悬浮窗等共享同站手动刷新入口的串行端到端测试。

## 延迟加载控件的 E2E 要先证明请求发生

**现象**

完整 Electron E2E 中，点击使用记录刷新后，模型下拉框偶发未在 3 秒内出现延迟返回的选项；隔离运行同一场景可以通过。

**根因**

本地 mock 明确把模型接口延迟 1.2 秒，完整套件还包含 Electron 调度、刷新和 IPC 往返。只等待 DOM 选项无法区分“请求未触发”“响应被请求世代丢弃”和“已请求但完整套件调度超出过紧等待预算”。

**正确做法**

在本地 E2E 服务端记录目标接口请求次数。操作前保存基线，点击后先轮询确认请求次数增长，再使用覆盖已知网络延迟和 Electron 调度余量的有限超时等待控件更新。

**验证方式**

隔离运行本地集成场景，再运行完整 `npm run test:e2e`；两次都必须先观察到新的模型请求，最终模型下拉框包含延迟返回的选项。本次完整套件 6 项全部通过。

**禁止事项**

不要在没有请求证据时盲目增大 DOM 超时；不要因测试调度余量删除生产请求世代保护；不要用无限等待掩盖真实漏请求。

**相关文件或命令**

- `tests/e2e/electron-smoke.spec.ts`
- `src/renderer/App.tsx`
- `npm run test:e2e -- --grep "connects site entry"`
- `npm run test:e2e`

**适用范围**

Electron IPC 后异步补齐下拉选项、搜索建议或其他已知延迟数据的端到端测试。

## 高危传递依赖可用精确 overrides 修复但必须跑完整工具链

**现象**

官方 Registry 审计报告 `fast-uri@3.1.3` 和 `shell-quote@1.8.4` 为高危，但直接依赖 `electron-builder` 与 `concurrently` 当时均未发布携带修复版本的新版本。

**根因**

漏洞位于传递依赖；盲目执行 `npm audit fix --force` 会降级或跨主版本修改直接依赖，扩大工具链风险。

**正确做法**

先用 `npm ls` 确认依赖来源，再在 `package.json` 使用精确 `overrides` 锁定 `fast-uri@3.1.4` 与 `shell-quote@1.10.0`。更新锁文件后运行 lint、typecheck、完整测试、构建、Electron E2E 和双平台打包。

**验证方式**

`npm ls fast-uri shell-quote` 显示两个 override 生效；官方 Registry 高危审计输出 `found 0 vulnerabilities`，完整工具链与发布构建通过。

**禁止事项**

不要使用 `npm audit fix --force` 代替依赖分析；不要只看审计归零而跳过构建和打包兼容验证。

**相关文件或命令**

- `package.json`
- `package-lock.json`
- `npm ls fast-uri shell-quote`
- `npm audit --registry=https://registry.npmjs.org --audit-level=high`

**适用范围**

本项目 npm 传递依赖漏洞修复、CI 安全门禁和发布工具链升级。

## GitHub 双平台发布必须由统一命令生成并绑定已推送标签

**现象**

只手动上传一个安装包，或创建 Release 时使用尚未存在的版本标签，会导致更新 manifest 与 Release 资产不完整，旧版本客户端无法稳定判断和下载更新。

**根因**

GitHub Release 需要可解析的版本标签；本项目更新服务还要求固定 manifest、平台匹配的安装包、SHA-256 和对应 blockmap 同时存在。Gitee 只同步源码，不承载 Release 附件。

**正确做法**

使用 `npm run release:publish -- --notes "..."`。命令要求工作区干净，读取 `package.json`/`CHANGELOG.md`，构建 macOS ARM64 与 Windows x64，校验五个资产，自动推送同名 Git 标签，从 Keychain 读取令牌并上传后复核远端资产。GitHub Release 使用单文件上传，不需要分片。

**验证方式**

先运行 `node scripts/publish-release.mjs --notes "检查" --dry-run`，再运行发布命令；发布完成后检查 GitHub Release 同时包含 `mac-arm64.dmg`、`win-x64.exe`、两个 blockmap 和 `update-manifest.json`。

**禁止事项**

不要把 Token 写入仓库、`.env`、日志或文档；不要只上传单平台资产；不要复用旧版本文件冒充当前版本；不要在未提交源码时创建版本标签。

**相关文件或命令**

- `scripts/publish-release.mjs`
- `package.json`
- `npm run release:publish -- --notes "本次更新说明"`
- `security find-generic-password -s sub2api-github-release-token -w`

**适用范围**

所有 GitHub 稳定版发布和真机更新测试 patch 发布。

## GitHub Release 承载大文件，Gitee 只做源码镜像

**现象**

Gitee Release API 对单个附件存在约 100 MB 上传限制；当前 macOS DMG 构建可能超过该限制，而 GitHub Release 支持更大的单文件安装包。

**根因**

Gitee 镜像同步的是 Git 提交、分支和标签，不会同步 Release 附件；把安装包继续上传 Gitee 会让发布命令在大版本时失败。

**正确做法**

GitHub `zmjza/-Sub2API-Multi-Hop-Monitoring-Tool` 是源码与 Release 主站，Gitee `zarq/Sub2API-Multi-Hub-Monitoring-Tool` 配置 Pull 镜像。`npm run release:publish -- --notes "..."` 从 Keychain 读取 `sub2api-github-release-token`，上传五个单文件资产；更新服务固定校验 GitHub HTTPS manifest。

**验证方式**

检查 `git ls-remote github` 存在 `main` 与版本标签，GitHub Release 同时包含 DMG、EXE、两个 blockmap 和 manifest；运行发布命令的 `--dry-run` 后再执行完整发布。

**禁止事项**

不要把 GitHub Token 写入仓库、`.env`、日志或文档；不要把 Gitee 镜像误当成 Release 附件镜像；不要重新引入针对 Gitee 100 MB 限制的分片逻辑。

**相关文件或命令**

- `scripts/publish-release.mjs`
- `electron/main/services/update-service.ts`
- `git push github master:main`
- `npm run release:publish -- --notes "本次更新说明"`

**适用范围**

所有后续稳定版发布和真机更新测试 patch 发布。
