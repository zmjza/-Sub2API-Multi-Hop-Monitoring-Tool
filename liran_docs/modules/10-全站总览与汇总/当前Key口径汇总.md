# 全部站点当前 Key 口径汇总

上级：[[03-索引]]、[[_全站总览与汇总]]
依赖：M07、M08、M09、M11、M14、M16
需求：RQ-24、RQ-27
状态：已完成；1.4.2 已统一自动/手动当前 Key 金额口径、顶部求和和总览页面检查

## 口径

每个站点只贡献一个实际当前 Key。有限额 Key 的可用额度为 `max(0, min(账号余额, quota - quota_used))`；quota 缺失、0 或无效代表无限额度并使用账号余额；`subscriptionType` 不覆盖金额语义。顶部把所有已确认金额相加，金额未知的站点不计入且不伪造为零。无法解析当前 Key 的站点不使用整站用量兜底。

## 微观任务

- **OK-01 当前 Key 解析契约**：目标是把自动/手动偏好解析成可审计结果；输入为 SiteKeyContext、默认 Key 规则；文件为 domain key-policy/contracts/tests；边界为 manual 失效时保留偏好并标 fallback；RED 覆盖无 Key、全停用、手动失效、自动未确定；步骤为领域测试后实现；验证 core/key-policy 测试；完成条件是结果含 keyId 与 basis；依赖 AK-03；禁止静默切 auto。
- **OK-02 可用额度领域函数**：目标是实现有限额、无限额和缺失值口径；输入为余额/quota/quotaUsed/subscriptionType；文件为 current-key-stats 及测试；边界为负数夹 0、货币精度、undefined，订阅元数据不改变金额；RED 覆盖 quota 0、quotaUsed 超额、余额更小、订阅元数据；步骤为纯函数 TDD；验证定向测试；完成条件是公式和展示态一致；依赖 AK-01；禁止把账号余额称分组余额或显示“按订阅规则”。
- **OK-03 单 Key 今日 stats 服务**：目标是每站按当前 keyId 读取请求、Token、消费；输入为 `/usage/stats?period=today&api_key_id`；文件为 adapter/site-service/tests；边界为 IANA 时区、并发与认证；RED 覆盖单站失败、0 值、切 Key；步骤为 adapter/helper 后服务；验证集成测试；完成条件是每个 snapshot 带 siteId/keyId/date；依赖 UF-02、OK-01；禁止用站点整体 stats 回退。
- **OK-04 跨站聚合与缓存**：目标是受控并发合并所选 Key 指标；输入为各站 SelectedKeySnapshot；文件为 site-service/domain snapshot/tests；边界为缓存键含 siteId/keyId/date/revision，单站失败隔离；RED 覆盖部分成功、重复站点、跨日、Key 变更；步骤为聚合测试、缓存、失效；验证 service/domain 测试；完成条件是 counted/total 与纳入站点明确；依赖 OK-02/03；禁止跨站共享 Token 或余额。
- **OK-05 Dashboard 契约与 IPC**：目标是扩展总览 ViewModel 为所选 Key 指标和口径状态；输入为 OK-04；文件为 contracts/main/preload/tests；边界为兼容悬浮窗现有站点快照，不向悬浮窗启用渠道轮询；RED 覆盖 extra fields、订阅态、未确定 Key；步骤为契约测试再 handler；验证 contracts/integration；完成条件是 Renderer 无需自行聚合；依赖 OK-04；禁止破坏旧窗口 API。
- **OK-06 顶部和站点卡片接线**：目标是替换顶部三指标并补每卡 Key/分组/用量/额度；输入为 OK-05；文件为 OverviewPage、types、overview.css/tests；边界为保留独立倍率比较和充值比例；RED 覆盖加载、partial、未确定、订阅、长文本；步骤为组件测试后 UI 接线；验证 OverviewPage 测试和截图；完成条件是页面不显示整站统计冒充当前 Key；依赖 OK-05 与 UI 清单；禁止嵌套卡片或全局样式。
- **OK-07 缓存失效与事件联动**：目标是 KeyPreference、分组回读、跨日、强刷触发正确重算；输入为 keys:changed、站点选择和刷新事件；文件为 site-service/main/App/tests；边界为合并事件、旧 revision 拒绝；RED 覆盖连续切组、快速切站和并行刷新；步骤为协调器测试、事件接线；验证 service/App 测试；完成条件是旧 Key 指标不会残留；依赖 AK-06/07、OK-04/06；禁止全量清空其他站缓存。
- **OK-08 总览回归与可访问性**：目标是验证宽窄窗口、排序、刷新、倍率、渠道摘要和悬浮窗不回归；输入为 OK 最终页面；文件为 Overview tests/E2E/真机清单；边界为 1600/720 视口和键盘横滑；RED 补充文本溢出与局部失败；步骤为自动化、截图、diff；验证 build 后串行 E2E；完成条件是指标口径、几何和旧功能均有证据；依赖 OK-01..07；禁止用历史 1.3.9 截图证明本轮。

## 逐任务验证命令

| 任务  | 可执行验证命令                                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| OK-01 | `npm test -- --run electron/main/domain/core.test.ts`                                                                         |
| OK-02 | `npm test -- --run electron/main/domain/core.test.ts`                                                                         |
| OK-03 | `npm test -- --run electron/main/adapters/sub2api-adapter.test.ts electron/main/services/site-service.integration.test.ts`    |
| OK-04 | `npm test -- --run electron/main/domain/core.test.ts electron/main/services/site-service.integration.test.ts`                 |
| OK-05 | `npm test -- --run electron/shared/contracts.test.ts electron/main/services/site-service.integration.test.ts`                 |
| OK-06 | `npm test -- --run src/renderer/shells/overview/OverviewPage.test.ts`                                                         |
| OK-07 | `npm test -- --run electron/main/services/site-service.integration.test.ts src/renderer/shells/overview/OverviewPage.test.ts` |
| OK-08 | `npm run build && npm run test:e2e -- --grep "全部站点                                                                        | 悬浮窗 | 倍率"` |

## 回滚点

保留旧快照字段供悬浮窗兼容，但主总览新组件只能读取 SelectedKeySnapshot。若新汇总暂时不可用，应显示不支持/待查询，不得切回整站数值冒充当前 Key。
