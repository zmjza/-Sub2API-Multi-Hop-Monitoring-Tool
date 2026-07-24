# 倍率比较与渠道稳定性避坑

## 官网品牌图标要验证来源、打包形态和最终清晰度

**现象**

从原型截图裁切出的几十像素 PNG 在 Retina 屏幕上发虚；替换成 SVG 后，开发 E2E 仍可能加载旧 `dist/`，或因 Vite 把小 SVG 内联而误判资源没有打包。

**根因**

截图资源分辨率不足；Electron E2E 默认读取生产 `dist/` 而不是实时源码；Vite 会按体积把 SVG 输出为独立文件或 `data:image/svg+xml`。

**正确做法**

从品牌官网或官网页面明确声明的资源地址下载 SVG，保存到 Renderer 本地目录并记录来源。改完先执行生产构建，再运行 Electron E2E；资源断言同时接受本地 `.svg` URL 和 SVG data URL，并检查 `complete`、`naturalWidth`、最终 40×40 几何及打包应用截图。

**验证方式**

检查构建输出包含独立或内联 SVG；在 macOS 打包应用 1600px 和 720px 截图中人工确认图标边缘清晰、无裁切、无加载失败，且运行时不依赖远程地址。

**禁止事项**

不要继续放大低分辨率截图 PNG；不要从非官方聚合站点冒充官网下载；不要在未重建 `dist/` 时用 Electron E2E 判断新 Renderer；不要强制要求所有 SVG 都以独立文件输出。

**相关文件或命令**

- `src/renderer/assets/rate-platforms/`
- `src/renderer/shells/overview/OverviewPage.tsx`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run build`

**适用范围**

倍率平台品牌图标及其他需要随 Electron 离线分发的官网 SVG 资源。

## 平台别名与隐藏滚动条必须覆盖完整证据链

**现象**

Antigravity 被渲染成第五个平台，或只在直接平台字段中归入 Gemini，但分组说明、主模型和附加模型仍被漏掉；隐藏倍率卡片滚动条后又可能同时失去横向滚动能力。

**根因**

平台别名只接入单一归一化入口，没有覆盖文本与结构化关系证据；滚动条隐藏被误实现为移除 `overflow-x`。窄屏验证若没有固定视口，也无法证明卡片确实保持单行且可横滑。

**正确做法**

让 `antigravity` 同时进入直接平台归一化、带单词边界的文本识别和结构化关系链，并与 Gemini 合并候选池。横向容器保留原生 `overflow-x: auto`、焦点语义和滚动行为，仅使用局部 WebKit/Firefox CSS 隐藏滚动条；宽屏和窄屏断言绑定明确视口。

**验证方式**

倍率单测覆盖直接别名、分组名、说明、主模型、附加模型、候选池合并及相似子字符串；Electron E2E 分别在 1600px 与 720px 验证单行、实际溢出、无可见滚动条和键盘可聚焦，并人工查看打包应用截图。

**禁止事项**

不要只修改 `normalizePlatform` 而遗漏其他证据入口；不要使用无边界的子字符串匹配；不要以 `overflow: hidden` 或删除 overflow 的方式隐藏滚动条；不要用未固定宽度的截图证明响应式行为。

**相关文件或命令**

- `src/renderer/shells/overview/rate-comparison.ts`
- `src/renderer/shells/overview/rate-comparison.test.ts`
- `src/renderer/shells/overview/OverviewPage.tsx`
- `src/renderer/shells/overview/overview.css`
- `tests/e2e/electron-smoke.spec.ts`

**适用范围**

倍率平台分类、模型别名、单行横向卡片和其他隐藏原生滚动条但必须保留可操作性的容器。

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

主关系使用 `key.group.name` 与 `monitor.name` 经 NFKC、大小写、括号和无语义分隔符规范化后的完整相等。零个精确结果时才使用 `/channels/available` 的渠道、平台、分组和模型结构化关系。共享严格 matcher 必须返回 `matched/unmatched/ambiguous`，倍率比较只接受 matched。总览若业务明确要求从多个结构化候选中显示一个渠道，应在 strict result 之后单独处理，只能在 `ambiguous.candidates` 内依次比较完整名称、文本相似度、关系平台、模型、健康、新鲜度、可用率和稳定 ID；卡片、详情请求和重试必须复用同一最终 ID。

**验证方式**

运行 `channel-ranking.test.ts`，并用 Electron E2E 的真实形状 Key 夹具验证嵌套 `group`、空 `monitor.group_name`、精确匹配、歧义和缓存路径。

**禁止事项**

禁止 `group_id === monitor.id`、在共享严格 matcher 内用 `includes`/前后缀/相似度消除歧义、删除语义词、按 provider 取第一个或借用兄弟分组。总览候选择优不得从 `ambiguous.candidates` 外取值，不得让健康度压过更强的名称、平台或模型证据，也不得改变倍率比较的严格语义。

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

## 卡片底部对齐必须由固定槽位承担

**现象**

站点卡片的充值比例、查看倍率和查看渠道状态会掉成两行；正文、额度或摘要状态不同还会让当前渠道摘要上下漂移。

**根因**

操作区使用 `flex-wrap: wrap`，且 `margin-top: auto` 放在操作区上，导致渠道摘要仍跟随正文高度；摘要只有 `min-height` 时，详情错误文案还会继续撑高外框。

**正确做法**

操作区使用 `minmax(0, 1fr) max-content max-content` 三列网格，充值比例列和 select 允许收缩，两个文字按钮保持内容宽度。把自动剩余空间放到渠道摘要之前，并为摘要设置稳定高度和受控溢出。

**验证方式**

Electron E2E 读取每个 footer 的计算样式、三个子控件坐标、scroll/client 尺寸和卡片边界；按网格行校验摘要与 footer 顶边误差不超过 1px，并覆盖五卡四列、720px 单列、加载、成功、无匹配和错误摘要。

**禁止事项**

不要用整卡固定高度掩盖内容差异；不要隐藏按钮文字、改为纯图标、允许 footer 横向滚动或只搜索 CSS 字符串代替几何验证。

**相关文件或命令**

- `src/renderer/shells/overview/overview.css`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e -- --grep "connects site entry"`

**适用范围**

全部站点卡片底部操作区、当前渠道摘要及其他等高网格卡片的固定 footer。

## 2026-07-24 API Key 页面倍率展示

- API Key 分组下拉项必须同时显示分组名称、平台和有效倍率，倍率 `0` 是有效值，不能使用 truthy 判断隐藏。
- 页面倍率图标仅表达 Key 当前有效倍率；不要复用渠道状态页已删除的“折算”文案或 BadgePercent。

## 2026-07-24 无渠道状态参与推荐

**现象**

站点没有可用渠道监控状态时，倍率比较会把有效分组全部排除，导致平台看起来没有推荐。

**正确做法**

当站点渠道状态为未提供或明确不支持时，仍可把有效分组作为候选，但候选稳定分数必须为 0，并显示“无渠道状态 · 待核验”；支持状态下的匹配歧义、请求失败、异常或过期记录不能借用其他渠道参与推荐。

**验证方式**

覆盖未提供状态、unsupported、支持但多渠道歧义和明确异常四类测试，确认只有前两类以待核验候选参与，且不会标记为稳定。
