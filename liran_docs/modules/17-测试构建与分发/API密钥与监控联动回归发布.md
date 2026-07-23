# API 密钥与监控联动回归发布

上级：[[03-索引]]、[[_测试构建与分发]]
依赖：AK-01..12、UF-01..08、OK-01..08、CR-01..09、CM-01..10
需求：RQ-27
状态：已完成；`1.4.0` 全量门禁、macOS 打包应用、两站可恢复写入和双平台结构发布通过，Windows 非真机

## 微观任务

- **RV-01 定向 RED/Green 收口**：目标是逐链确认失败测试先红、最小实现后绿；输入为五链任务证据；文件为相关 tests 与开发追踪；边界为不接受只补 happy path；RED 覆盖安全、竞态、partial、auth、unsupported；步骤为按 AK→UF→OK→CR→CM 顺序复核；验证各定向 Vitest；完成条件是每项有真实命令输出；依赖全部业务任务；禁止事后伪写 RED。
- **RV-02 静态与全量测试**：目标是完成 format/lint/typecheck/full Vitest/audit；输入为最终源码；文件不预设修改，失败回到责任模块；边界为 npm 单一包管理器；RED 为现有失败必须定位；步骤为串行执行并修复；验证 `npm run format:check`、`npm run lint`、`npm run typecheck`、`npm test`、官方 registry audit；完成条件全部实际通过；依赖 RV-01；禁止把镜像 audit 错误写漏洞或通过。
- **RV-03 生产构建与 Electron E2E**：目标是验证真实生产 dist 与主/悬浮窗；输入为通过的静态测试；文件为 build/E2E及必要修复；边界为 build 完成后再运行 E2E，不能并行；RED 覆盖导航、Key 写入、自动筛选、当前 Key 总览、轮询暂停、去倍率；步骤为 build、E2E、失败修复重跑；验证 `npm run build` 后 `npm run test:e2e`；完成条件是所有场景通过；依赖 RV-02；禁止 firstWindow 假设。
- **RV-04 安全与敏感数据审计**：目标是证明 Renderer/IPC/SQLite/log/CSV/fixture/screenshot 无完整 Key；输入为源码、测试产物和运行数据；文件为安全测试与报告；边界为模式搜索不输出命中秘密全文；RED 为人工合成 canary；步骤为注入假密钥、扫描、验证摘要；验证 contracts/E2E/rg 安全脚本；完成条件是 canary 仅在适配器输入 fixture 的受控位置；依赖 RV-03；禁止使用真实凭据。
- **RV-05 macOS ARM64 打包与真机页面检查**：目标是在新版本 DMG/解包 App 验收主链和视觉；输入为正式版本构建；文件为 release、09真机、稳定证据目录；边界为 1600/720、固定浅色、截图脱敏；RED 为清单待实测；步骤为 dist:mac、hdiutil、架构/版本审计、真机操作、截图、问题修复重测；验证清单脚本；完成条件全部适用项真实 ✅；依赖 RV-03/04；禁止用开发服务器或旧包冒充。
- **RV-06 Windows x64 交叉构建与结构验证**：目标是生成当前版本 NSIS 并验证 PE/asar/版本/入口；输入为新版本源码；文件为 release、CHANGELOG、09真机；边界为无 Windows 真机；RED 为结构检查脚本；步骤 dist:win、解包、file/版本审计；验证构建输出与哈希；完成条件只记录交叉构建通过；依赖 RV-03/04；禁止写 Windows 真机通过。
- **RV-07 SemVer、文档与产物收口**：目标是递增版本并同步 README/CHANGELOG/坑点/SHA-256；输入为真实变更与产物；文件为 package files、docs、release metadata；边界为 `release/` 只保留当前版本且删除需遵守用户当前授权；RED 为 build-config/version tests；步骤先定版本、再构建、再哈希和文档；验证版本一致性测试与 sha256；完成条件文件名、内部版本、说明和哈希一致；依赖 RV-05/06；禁止旧产物冒充新版本。
- **RV-08 最终完成审计**：目标是逐 RQ-22..27 核对证据、最终 diff、状态和残余风险；输入为所有测试、真机、产物和文档；文件为 03/04/08/09/相关模块；边界为 Windows/签名/公证如实未验证；RED 为任何缺项保持未完成；步骤为需求逐条矩阵、diff、工作区无关修改保护、坑点回写；验证 `check_real_test_checklist.py --require-complete`；完成条件所有要求有权威证据且无必做遗留；依赖 RV-01..07；禁止以“未发现问题”代替完成证明。

## 逐任务验证命令

| 任务  | 可执行验证命令                                                                                                                                                                                                                                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RV-01 | `npm test -- --run electron/main/adapters/sub2api-adapter.test.ts electron/main/services/site-service.integration.test.ts src/renderer/shells/api-keys/ApiKeysPage.test.ts src/renderer/shells/usage/UsagePage.test.ts src/renderer/shells/overview/OverviewPage.test.ts src/renderer/shells/channels/ChannelsPage.test.ts` |
| RV-02 | `npm run format:check && npm run lint && npm run typecheck && npm test && npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org`                                                                                                                                                                    |
| RV-03 | `npm run build && npm run test:e2e`                                                                                                                                                                                                                                                                                         |
| RV-04 | `npm test -- --run electron/shared/contracts.test.ts electron/main/adapters/sub2api-adapter.test.ts && ! rg -n "sk-[A-Za-z0-9_-]{20,}" src electron tests liran_docs --glob '!**/node_modules/**'`                                                                                                                          |
| RV-05 | `npm run dist:mac && python3 scripts/check_real_test_checklist.py liran_docs/09-真机实测.md`                                                                                                                                                                                                                                |
| RV-06 | `npm run dist:win && file release/*.exe`                                                                                                                                                                                                                                                                                    |
| RV-07 | `npm test -- --run electron/build-config.test.ts && shasum -a 256 release/*`                                                                                                                                                                                                                                                |
| RV-08 | `python3 scripts/check_real_test_checklist.py liran_docs/09-真机实测.md --require-complete && git diff --check`                                                                                                                                                                                                             |

## 固定验证顺序

定向测试 → format/lint/typecheck/full test → npm audit → production build → Electron E2E → 安全扫描 → macOS/Windows 打包 → macOS 真机 → 产物与文档审计。生产 build 和 Electron E2E 必须串行；稳定真机证据放入 `real-test-evidence/<version>/`，不能放入 Playwright 会清理的 `test-results/`。
