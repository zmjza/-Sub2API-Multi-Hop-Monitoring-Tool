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
