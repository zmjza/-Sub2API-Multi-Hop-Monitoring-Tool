# 倍率比较与渠道稳定性避坑

## 并列最低分组必须独立匹配渠道

**现象**

同一平台存在多个并列最低分组时，若只用第一个分组查渠道，其他分组会错误显示兄弟分组的渠道状态。

**根因**

倍率候选生成把并列分组数组当成一个候选，导致渠道关系和稳定分只能归属到数组第一个分组。

**正确做法**

为每个分组单独生成候选并调用统一的唯一关系解析；无匹配分组不借用同站其他分组，并直接排除在推荐评分池之外。

**验证方式**

运行 `npm test -- --run src/renderer/shells/overview/rate-comparison.test.ts`，确认并列 A/B 分组各自绑定不同渠道，未匹配分组不产生推荐和分数。

**禁止事项**

不要用 `minimum.groups[0]` 代表所有并列分组；不要以站点整体状态填充缺失渠道；不要让排序结果改变平台固定顺序。

**相关文件或命令**

- `src/renderer/shells/overview/rate-comparison.ts`
- `src/renderer/shells/overview/rate-comparison.test.ts`
- `src/renderer/shells/channels/channel-ranking.ts`

**适用范围**

跨站倍率比较、分组稳定性评分和总览内联渠道状态。

## 内联渠道加载必须共享缓存并隔离失败

**现象**

总览自动显示当前 Key 渠道后，如果每个卡片各自请求，打开完整渠道弹窗会重复请求；某个详情失败还可能阻塞其他分组。

**根因**

列表和详情请求没有按站点/渠道去重，也没有对局部请求维护独立状态和响应世代。

**正确做法**

使用按站点列表、按 `siteId:channelId` 详情的单飞缓存，详情并发上限 4；失败只影响对应卡片，force retry 递增 revision，旧响应不得覆盖新结果；弹窗缓存 seed 到 loader。

**验证方式**

运行 `rate-channel-status-loader.test.ts` 与 Electron E2E，确认自动请求、局部失败/重试、弹窗打开不增加计数。

**禁止事项**

不要在卡片渲染期间直接发请求；不要用一个全局 error 覆盖所有站点；不要让旧请求回写强制刷新后的详情。

**相关文件或命令**

- `src/renderer/shells/overview/rate-channel-status-loader.ts`
- `src/renderer/shells/overview/OverviewPage.tsx`
- `tests/e2e/electron-smoke.spec.ts`

**适用范围**

站点卡片当前 Key 渠道摘要、倍率稳定性核验、渠道状态页面和完整渠道状态弹窗。

## 时间线 unknown 不能被汇总 normal 覆盖为稳定

**现象**

渠道最近五分钟时间线包含 `unknown`，但渠道汇总状态为 `normal` 时，倍率比较仍可能给出稳定 10 分。

**根因**

稳定性函数只优先处理时间线中的 `failed` 和 `degraded`，遗漏了 `unknown`；后续直接使用汇总状态得出稳定结果。

**正确做法**

倍率推荐使用硬门槛而不是异常状态降分：当前汇总必须为 `normal`，最近五分钟至少有一条可解析且非未来记录，窗口内每条记录都必须为 `normal`。任意 `failed`、`degraded`、`unknown`、空窗口、过期、未来或非法时间戳均直接排除；无渠道状态也不计算分数。

**验证方式**

运行 `npm test -- --run src/renderer/shells/overview/rate-comparison.test.ts`，确认 unknown、degraded、failed、空时间线、过期、未来、非法时间以及当前状态矛盾的回归用例均被排除；再运行完整 Vitest。

**禁止事项**

不要仅凭渠道汇总 `normal` 判定最近五分钟稳定；不要为无状态或异常候选设置中性分；不要让被排除候选影响价格 min/max。

**相关文件或命令**

- `src/renderer/shells/overview/rate-comparison.ts`
- `src/renderer/shells/overview/rate-comparison.test.ts`
- `npm test -- --run src/renderer/shells/overview/rate-comparison.test.ts`

**适用范围**

跨站倍率排行、渠道状态时间窗评分及以后复用相同稳定性结论的页面。

## 横向溢出不能代替键盘可访问入口

**现象**

倍率平台卡片能通过鼠标和触控横向滚动，但列表没有可聚焦元素，键盘用户无法把焦点移动到滚动区域。

**根因**

实现只设置了 `overflow-x: auto` 和单行 flex 布局，遗漏滚动容器的焦点语义、可访问名称和焦点可视反馈。

**正确做法**

为横向滚动容器设置 `tabIndex={0}` 和明确的 `aria-label`，并使用局部 `:focus-visible` 轮廓。保持原有 overflow、触控惯性和单行尺寸约束不变。

**验证方式**

Electron E2E 断言倍率横向列表具有 `tabindex="0"`，并在 macOS 打包应用中确认焦点样式不会造成卡片重排或遮挡。

**禁止事项**

不要把“出现滚动条”当成键盘可操作的证明；不要通过修改全局 focus 样式补救局部组件。

**相关文件或命令**

- `src/renderer/shells/overview/OverviewPage.tsx`
- `src/renderer/shells/overview/overview.css`
- `tests/e2e/electron-smoke.spec.ts`

**适用范围**

倍率平台横向列表及其他没有内部可聚焦控件的横向滚动容器。

## Key 分组与监控渠道不能比较 ID 或做模糊包含

**现象**

Key 能读到 `group_id`，渠道监控也有 `id`，直接比较或用名称包含关系时会把错误渠道显示到站点摘要、倍率徽标和推荐中。

**根因**

分组 ID 与监控 ID 属于不同实体；真实站点的 `monitor.group_name` 还可能为空。名称包含、删除平台词和“取第一个”会在相似分组中产生静默误配。

**正确做法**

主关系使用 `key.group.name` 与 `monitor.name` 经 NFKC、大小写、括号和无语义分隔符规范化后的完整相等。零个精确结果时才使用 `/channels/available` 的渠道、平台、分组和模型结构化关系，且必须得到唯一结果。统一返回 `matched/unmatched/ambiguous`。

**验证方式**

运行 `channel-ranking.test.ts`，并用 Electron E2E 的真实形状 Key 夹具验证嵌套 `group`、空 `monitor.group_name`、精确匹配、歧义和缓存路径。

**禁止事项**

禁止 `group_id === monitor.id`、`includes`、前后缀、相似度、删除语义词、按 provider 取第一个、按可用率消除歧义或借用兄弟分组。

**相关文件或命令**

- `src/renderer/shells/channels/channel-ranking.ts`
- `src/renderer/shells/channels/channel-ranking.test.ts`
- `tests/e2e/electron-smoke.spec.ts`

**适用范围**

全部站点当前 Key 摘要、渠道倍率徽标、渠道弹窗和倍率推荐。

## 弹窗自动加载不能依赖父组件每次新建的回调

**现象**

渠道弹窗内容短暂出现后又进入加载态，刷新按钮持续不可用，网络请求反复执行。

**根因**

弹窗的自动加载 `useEffect` 依赖父组件内联创建的加载回调；加载完成更新父状态后回调引用变化，导致 effect 再次执行。

**正确做法**

把外部加载器、状态通知和站点 ID 保存到 ref，自动加载 effect 只依赖稳定的内部 `load`；主动刷新显式调用 `load(true)`，加载中禁用刷新按钮。

**验证方式**

Electron E2E 连续打开两个站点渠道弹窗，确认缓存打开不增加请求、主动刷新只触发一次、失败态可局部重试恢复。

**禁止事项**

不要把不稳定父回调直接放进自动加载 effect 依赖；不要用强制点击或无限提高测试超时掩盖重复加载。

**相关文件或命令**

- `src/renderer/shells/overview/ChannelStatusPopover.tsx`
- `tests/e2e/electron-smoke.spec.ts`

**适用范围**

所有通过父组件内联回调加载数据的弹窗和浮层。
