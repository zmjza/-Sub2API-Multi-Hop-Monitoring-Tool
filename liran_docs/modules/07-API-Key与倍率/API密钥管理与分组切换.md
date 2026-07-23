# API 密钥管理与分组切换

上级：[[03-索引]]、[[_API-Key与倍率]]
依赖：M01、M06、M08、M14、M16
需求：RQ-22、RQ-27
状态：已完成；代码、自动化、两站可恢复分组写入和 macOS 打包应用宽窄页面检查通过

## 目标与边界

在主导航新增普通用户 API 密钥页面，完整分页展示脱敏 Key 并允许单 Key 切换到有权分组。完整 Key 只在适配器最内层短暂存在；首版不解绑、不批量、不创建、不删除、不修改其他属性。

## 微观任务

- **AK-01 上游形状契约**：目标是为 Key、分组、倍率、批量/每日用量建立失败优先 schema；输入为提交 `cb24522d` 与现有 adapter；文件为 `electron/main/adapters/schemas.ts`、`sub2api-adapter.test.ts`；边界是不透传未知字段；RED 为完整 Key 泄漏、倍率 0 丢失、状态未知用例先失败；步骤为补 fixture、schema、归一化断言；验证 `npm test -- --run electron/main/adapters/sub2api-adapter.test.ts`；完成条件是所有真实字段和缺失字段有明确结果；依赖无；禁止使用 `/admin/*` 或在 fixture 写可用密钥。
- **AK-02 脱敏适配器**：目标是读取分页 Key 后立即生成摘要并丢弃原值；输入为 `/keys` 分页响应；文件为 `electron/main/adapters/sub2api-adapter.ts` 及测试；边界是只返回 ViewModel 字段；RED 覆盖多页、空 key、短 key、异常响应和对象序列化搜索；步骤为先测试再最小实现；验证定向 Vitest 和敏感模式搜索；完成条件是返回树不含 `key` 原值；依赖 AK-01；禁止记录上游 body。
- **AK-03 共享 IPC 契约**：目标是定义分页查询、详情、分组写入、用量和状态契约；输入为 RQ-22 与归一化类型；文件为 `electron/shared/contracts.ts`、`contracts.test.ts`；边界为 ID 长度、页大小、搜索长度和严格对象；RED 覆盖负 ID、额外写字段、非法状态、100 以上批量；步骤为 schema 测试后实现；验证 contracts 定向测试；完成条件是 write payload 只能含 siteId/keyId/groupId；依赖 AK-01；禁止 `unknown` 直通 Renderer。
- **AK-04 主进程分页服务**：目标是按站点会话完整读取 Key 并返回分页 ViewModel；输入为 AK-02/03；文件为 `site-service.ts` 及集成测试；边界是按 siteId 分区、认证沿用现有协调器；RED 覆盖切站、末页、空页、401、unsupported；步骤为服务测试、实现、能力状态回写；验证 site-service 集成测试；完成条件是页码和 total 一致且旧站不串数据；依赖 AK-02、AK-03；禁止把完整 Key 写入 SQLite。
- **AK-05 Key 用量聚合**：目标是批量读取今日消费并受控并发汇总 30 天消费；输入为最多 100 ID 的批量接口与每日接口；文件为 adapter、site-service、相关测试；边界为拆批、并发 3、单站缓存和单项失败；RED 覆盖 101 个 ID、局部失败、取消、缺失 actual_cost；步骤为队列/缓存测试后实现；验证 adapter 与 service 测试；完成条件是失败项为 undefined、其他项照常返回；依赖 AK-02/04；禁止伪造 0。
- **AK-06 分组写入与回读**：目标是对单 Key 执行最小 PUT 并 GET 回读确认；输入为 siteId/keyId/groupId；文件为 adapter、site-service 及测试；边界为所有权由上游验证、相同组不写、每 Key 单飞；RED 覆盖 PUT 失败、回读不一致、并发双击和旧回读；步骤为失败测试、锁、写入、回读、缓存失效；验证定向测试；完成条件是仅一致回读返回 success；依赖 AK-03/04；禁止乐观成功或发送其他可写字段。
- **AK-07 IPC 与 preload 白名单**：目标是接通 `api-keys:list/detail/update-group` 等固定能力；输入为 AK-03/04/06；文件为 `electron/main/index.ts`、两个 preload 文件及测试；边界是所有输入输出双向 parse；RED 覆盖额外字段和非当前站点；步骤为 handler 测试后桥接；验证 contracts、preload、集成测试；完成条件是 Renderer 无任意 HTTP 能力；依赖 AK-03、AK-06；禁止暴露 Token。
- **AK-08 页面状态模型**：目标是定义 loading/empty/error/unsupported/auth-required/success、分页、筛选、行写入和部分用量状态；输入为 IPC ViewModel；文件计划为 `src/renderer/shells/api-keys/types.ts`、页面测试；边界是不创建全局 store；RED 覆盖切站清空、旧响应、局部写锁；步骤为 reducer/coordinator 测试再实现；验证定向 Vitest；完成条件是每种状态可独立重现；依赖 AK-03；禁止用单一全页 error 覆盖局部用量失败。
- **AK-09 页面 UI 壳**：目标是按现有工作台视觉创建站点选择、筛选栏、密集表格、分页和分组菜单；输入为 UI 壳清单；文件计划为 `ApiKeysPage.tsx`、`api-keys.css`、`types.ts`；边界为局部 CSS、40px 控件、8px 圆角、横向滚动；RED 为组件状态和无障碍测试；步骤是先合法文件与测试再实现；验证 Vitest 与页面截图；完成条件是所有状态稳定且无重叠；依赖 AK-08 与 UI 路线确认；禁止新增依赖和全局样式。
- **AK-10 导航与全局站点联动**：目标是把 API 密钥插入指定导航顺序并复用当前站点；输入为 App shell；文件为 `App.tsx`、preview types/tests；边界是不改变悬浮窗；RED 覆盖导航顺序、选中态、无站点入口和跨页站点同步；步骤为测试后接线；验证 App/preview 测试；完成条件是正式与预览入口一致；依赖 AK-09；禁止创建独立 demo。
- **AK-11 页面业务接线**：目标是接通分页、筛选、刷新、分阶段用量和分组写入；输入为 AK-07/09；文件为 App、ApiKeysPage 和协调器测试；边界为 revision、AbortSignal、per-row lock；RED 覆盖快速切站、连续选组、失败回滚、回读不一致；步骤为端到端组件测试后实现；验证 Renderer 与 Electron E2E；完成条件是远程网页刷新结果一致；依赖 AK-07、AK-10；禁止显示完整 Key 或复制按钮。
- **AK-12 安全与回归审计**：目标是证明 Key 不泄漏且旧 KeyPreference/倍率功能不回归；输入为最终 AK diff；文件为 adapter/contracts/service/Renderer/E2E 测试与文档；边界为仅审计本链；RED 覆盖序列化、日志和截图文本；步骤为搜索、测试、diff 审计、回写；验证 `npm test`、`npm run lint`、`npm run typecheck`；完成条件是无敏感值且既有自动/手动 Key 测试通过；依赖 AK-01..11；禁止以测试未发现代替边界检查。

## 逐任务验证命令

下列命令均从项目根目录执行；计划中的测试文件由对应任务先以 RED 建立，再运行命令。

| 任务  | 可执行验证命令                                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| AK-01 | `npm test -- --run electron/main/adapters/sub2api-adapter.test.ts`                                                                            |
| AK-02 | `npm test -- --run electron/main/adapters/sub2api-adapter.test.ts electron/main/adapters/mock-integration.test.ts`                            |
| AK-03 | `npm test -- --run electron/shared/contracts.test.ts`                                                                                         |
| AK-04 | `npm test -- --run electron/main/services/site-service.integration.test.ts`                                                                   |
| AK-05 | `npm test -- --run electron/main/adapters/sub2api-adapter.test.ts electron/main/services/site-service.integration.test.ts`                    |
| AK-06 | `npm test -- --run electron/main/adapters/sub2api-adapter.test.ts electron/main/services/site-service.integration.test.ts`                    |
| AK-07 | `npm test -- --run electron/shared/contracts.test.ts electron/build-config.test.ts`                                                           |
| AK-08 | `npm test -- --run src/renderer/shells/api-keys/ApiKeysPage.test.ts`                                                                          |
| AK-09 | `npm test -- --run src/renderer/shells/api-keys/ApiKeysPage.test.ts src/renderer/preview/preview.test.ts`                                     |
| AK-10 | `npm test -- --run src/renderer/preview/preview.test.ts src/renderer/shells/api-keys/ApiKeysPage.test.ts`                                     |
| AK-11 | `npm run build && npm run test:e2e -- --grep "API 密钥"`                                                                                      |
| AK-12 | `npm run lint && npm run typecheck && npm test && ! rg -n "sk-[A-Za-z0-9_-]{20,}" src electron tests liran_docs --glob '!**/node_modules/**'` |

## 回滚点

共享契约、IPC、页面导航和远程写入分为独立提交边界。发生写入风险时首先禁用 update-group IPC，保留只读列表；不得通过回退用户远程分组数据实现代码回滚。
