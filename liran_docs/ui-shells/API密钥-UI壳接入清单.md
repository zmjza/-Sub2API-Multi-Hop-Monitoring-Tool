# API 密钥 UI 壳接入清单

## 路线与范围

- UI 路线：`Codex 在真实 Renderer 中直接完成 UI+业务接线`，不新增 Stitch Screen，不设独立 UI 壳阶段。
- 业务模块：M07、M16；需求 RQ-22、RQ-23、RQ-24、RQ-27；微观任务 AK-07、AK-08、AK-09 及 RV-03。
- 本清单约束合法文件、正式入口、接口/状态/事件边界和验收；实现与接线均在当前唯一 `/goal` 中完成，不创建脱离真实数据流的业务占位页面。
- 正式主导航顺序：全部站点、API 密钥、使用记录、渠道状态、站点管理、雷达。API 密钥使用 Lucide `KeyRound` 或项目已有等价 Key 图标。

## 计划文件与职责

| 文件                                                       | 计划新增或修改                                                 | 接口、状态或事件入口                                                                                                     | 允许编辑范围                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `src/renderer/shells/api-keys/ApiKeysPage.tsx`             | 新增页面、工具栏、筛选、表格、行级分组菜单、分页和稳定状态容器 | 仅调用预加载白名单中的 list/change/refresh 事件；管理站点请求序号、筛选、分页、行级 writing 状态                         | 仅 API 密钥视图和本页交互，不直接 fetch、不接触完整 Key |
| `src/renderer/shells/api-keys/types.ts`                    | 新增脱敏 ViewModel、分组选项、筛选、分页、用量和页面状态类型   | `ApiKeySummary` 不允许存在完整 key 字段；状态含 loading/empty/error/unsupported/auth-required/success/refreshing/partial | 仅 Renderer 展示契约，不复制主进程敏感 DTO              |
| `src/renderer/shells/api-keys/api-keys.css`                | 新增局部页面、表格、菜单、徽标、骨架和横向滚动样式             | 所有选择器以 `.api-keys-` 为前缀                                                                                         | 不修改全局 button/input/table/svg/reset                 |
| `src/renderer/shells/api-keys/ApiKeysPage.test.ts`         | 新增组件交互和脱敏断言                                         | 切站竞态、筛选重置、同组不写、单行禁用、失败回滚、六态、长文本                                                           | fixture 只能用明显无效的脱敏摘要，不得出现完整 Key      |
| `src/renderer/App.tsx`                                     | 增加导航项、页面挂载和共享当前站点传递                         | `page='api-keys'`；站点变更使用现有持久化入口                                                                            | 不改认证、窗口生命周期或其他页面业务数据流              |
| `src/renderer/preview/types.ts`                            | 扩展 API 密钥页面及受控状态枚举                                | 只供开发预览和自动化状态切换                                                                                             | 不把静态数据用于生产回退                                |
| `src/renderer/preview/PreviewControls.tsx`                 | 增加 API 密钥页开发预览选项                                    | 仅开发条件可见                                                                                                           | 不进入打包生产 UI                                       |
| `src/renderer/preview/preview.test.ts`                     | 增加导航顺序、页面枚举和固定浅色回归                           | 验证正式与预览路由边界                                                                                                   | 不降低现有预览断言                                      |
| `electron/main/adapters/sub2api-adapter.ts`                | 后续业务接线时增加 Key 详情、分组写入、批量/每日用量适配       | 固定普通用户 `/api/v1` 路径，完整 Key 在层内脱敏后丢弃                                                                   | UI 壳阶段不编辑；后续禁止原响应透传或 `/admin/*`        |
| `electron/main/services/site-service.ts`                   | 后续业务接线时增加按站分页、用量缓存、单 Key 写锁与回读        | siteId 分区、revision/AbortSignal、partial usage、auth/unsupported                                                       | UI 壳阶段不编辑；不落库完整 Key                         |
| `electron/shared/contracts.ts`                             | 后续业务接线时增加严格查询、脱敏输出和仅 groupId 写入 schema   | list/detail/updateGroup/usage 固定白名单，输入输出双向 Zod parse                                                         | UI 壳阶段不编辑；禁止 `unknown` 直通                    |
| `electron/main/index.ts`                                   | 后续业务接线时注册固定 API 密钥 IPC handler                    | 调用 site service，每个 handler 重新 parse 输入/输出                                                                     | UI 壳阶段不编辑；禁止任意 HTTP/IPC 转发                 |
| `electron/preload/index.ts`、`electron/preload/bridge.cts` | 后续业务接线时暴露最小 API 密钥桥接方法                        | 方法名与 `src/renderer/env.d.ts` 完全一致                                                                                | UI 壳阶段不编辑；禁止暴露 Token/完整 Key                |
| `src/renderer/env.d.ts`                                    | 声明固定白名单 preload 方法与脱敏结果                          | list/get/updateGroup/refresh 的既有命名风格                                                                              | 禁止声明任意 IPC 调用器或完整 Key 返回值                |
| `tests/e2e/electron-smoke.spec.ts`                         | 增加正式入口、切站、筛选、分组回读和安全回归                   | 使用本地 HTTP fixture；覆盖迟到响应                                                                                      | 不访问真实生产站、不在 trace/截图写敏感值               |

## 页面结构与数据入口

1. 页左上复用使用记录和渠道状态的当前站点选择器；切站立即清空旧列表、错误和筛选，提升请求 epoch，并同步现有全局当前站点。
2. 顶部工具栏包含名称或脱敏摘要搜索、分组筛选、状态筛选和强制刷新。刷新保留筛选，切站重置筛选。
3. 表格字段依次为名称、脱敏 API 密钥、分组/平台/有效倍率、当前并发、今日实际消费、近 30 天实际消费、过期时间、状态、创建时间；创建时间默认倒序。
4. 分组菜单只展示 `/groups/available` 中当前用户可绑定项；相同分组不触发事件，写入时仅当前行禁用，远程回读成功后提交视图，失败恢复原值。
5. 分页数据来自主进程安全分页；今日用量允许部分成功，近 30 天用量显示独立待查询。缺失值显示“待查询”，不得伪造 `$0.0000`。

Renderer 只能收到 `sk-xxx...last4` 形式或等价不可逆脱敏摘要。IPC、SQLite、日志、截图、测试夹具和错误文案均不得包含完整 API Key；页面不提供复制完整 Key。

## 视觉与稳定状态

- 固定浅色；主色 `#4f46e5`；白色数据表面和灰紫边框；内容最大宽度 `1440px`。
- 控件约 `40px` 高、`8px` 圆角；表格容器 `8px` 圆角；字体密度和行高对齐使用记录页。
- 表格定义稳定最小宽度，窄窗口只横向滚动；名称和摘要单行省略并提供 tooltip，菜单不得改变行高。
- loading、empty、error、unsupported、auth-required、success 使用同一内容槽位；refreshing/partial 保留旧数据和表格尺寸；成功提示不推动表格跳动。
- 分组和状态使用现有语义色；图标按钮使用 Lucide 并提供 tooltip/focus-visible，禁止嵌套卡片、渐变装饰和全局样式污染。

## 禁止范围与完成门禁

- 禁止 Renderer 直接调用网络、使用 `/admin/*`、读取或复制完整 Key、创建/删除 Key、解绑、批量切换或修改名称、状态、额度、有效期和限速。
- 禁止修改密码、Token、safeStorage、认证续期、SQLite 安全方案、Electron 窗口生命周期、版本和构建配置。
- 不单独声明“UI 壳完成”；页面结构、样式和真实接线必须一起通过验收。
- 一体化完成条件：组件 RED→GREEN；导航和预览入口可达；真实白名单 IPC 已接通；六态、横向滚动、长文本、行级写入和失败回滚无重叠/跳动；`rg` 证明 Renderer/fixture 无完整 Key；AK/RV 的自动化、真机和发布门禁全部通过。
