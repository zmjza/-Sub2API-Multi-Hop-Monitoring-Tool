# Project Working Agreements

## Mandatory Pitfall Workflow

1. Before development, repair, testing, deployment, or troubleshooting, every Codex/AI agent must read this file, [`docs/pitfalls/README.md`](docs/pitfalls/README.md), and the pitfall files related to the modules it will touch.
2. Before closing a task, write newly confirmed pitfalls back to the relevant file under `docs/pitfalls/` and update its index when necessary.
3. If a task is interrupted, record confirmed findings and clearly label any unrefined or incomplete evidence so the next agent can continue safely.
4. Keep this file limited to workflow rules and indexes. Store concrete symptoms, causes, fixes, and verification steps in `docs/pitfalls/`.
5. Never record secrets, tokens, account credentials, private data, complete production configuration, or complete sensitive logs in this file or the pitfall knowledge base.
6. Do not invent a root cause or verification result. Mark incomplete evidence as `信息不全，待人工补充` or `以下为基于现有证据的推测`.

## Pitfall Index

- [Knowledge-base rules and full index](docs/pitfalls/README.md)
- [Electron build and renderer loading](docs/pitfalls/electron-build.md)
- [Dependency and tooling behavior](docs/pitfalls/tooling.md)
- [Rate comparison and channel stability](docs/pitfalls/rate-comparison.md)

## Release Rule

- 每次功能优化、Bug 修复或行为调整后，都必须递增 SemVer 版本，并重新生成最新 macOS ARM64 DMG 与 Windows x64 NSIS 安装包。
- 安装包文件名必须包含当前版本号，更新说明必须同步记录本次变更和 SHA-256；不得把旧产物冒充当前版本。
- `release/` 仅作为发布命令的临时构建目录；上传 GitHub Release 成功或失败后都清理 DMG、EXE、blockmap 和 `update-manifest.json`，不在本地长期保留安装包。
- 历史版本恢复必须以远端历史提交的完整代码树为基线，不能只修改 `package.json` 版本号。
- Windows 仍只做交叉构建和 CI 证据，不冒充 Windows 真机验收；macOS 真机状态必须单独记录。
- GitHub Release 必须同时上传并在说明中明确标注 macOS ARM64 DMG（`mac-arm64.dmg`）与 Windows x64 NSIS（`win-x64.exe`）；对应 blockmap 和 `update-manifest.json` 也必须同步上传，不能只发布单个平台。Gitee 只做源码镜像，不承载 Release 大文件。
- GitHub Release API 令牌只保存在本机 macOS Keychain 的 `sub2api-github-release-token` 项中；后续发布从 Keychain 读取，禁止写入仓库、`.env`、日志或文档。
- 统一发布命令为 `npm run release:publish -- --notes "本次更新说明"`；真机更新测试使用 `--test-only`，发布前可用 `--dry-run`。不要绕过该命令手动只上传单个平台。
