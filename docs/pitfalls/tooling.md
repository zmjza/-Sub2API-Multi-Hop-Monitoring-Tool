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
