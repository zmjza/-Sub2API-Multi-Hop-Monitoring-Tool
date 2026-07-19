# 倍率比较与渠道稳定性避坑

## 时间线 unknown 不能被汇总 normal 覆盖为稳定

**现象**

渠道最近五分钟时间线包含 `unknown`，但渠道汇总状态为 `normal` 时，倍率比较仍可能给出稳定 10 分。

**根因**

稳定性函数只优先处理时间线中的 `failed` 和 `degraded`，遗漏了 `unknown`；后续直接使用汇总状态得出稳定结果。

**正确做法**

先按最近五分钟时间线依次处理 `failed`、`degraded`、`unknown`，分别映射为 0、5、3 分。存在新鲜时间点后，再保守检查当前汇总状态；没有任何新鲜时间点时统一判为未知 3 分。

**验证方式**

运行 `npm test -- --run src/renderer/shells/overview/rate-comparison.test.ts`，确认 unknown 时间点以及当前 degraded/failed 与新鲜 normal 时间点矛盾的回归用例通过；再运行完整 Vitest。

**禁止事项**

不要仅凭渠道汇总 `normal` 判定最近五分钟稳定；不要把空时间线或过期时间线判为实时失败或实时稳定。

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
