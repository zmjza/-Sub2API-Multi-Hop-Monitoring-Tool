# REQ-260915 测试连通性按所选 Key 加载模型 · 合并说明

## 任务信息

- 任务 ID：REQ-260915-connectivity-test-models
- 任务类型：老项目 Bug 修复
- 创建日期：2026-09-14
- 当前状态：已合并至 REQ-260914，停止单独推进
- 关联功能：REQ-260913-connectivity-test

## 合并结果

本需求已完整并入：

liran_docs/requirements/REQ-260914-channel-status-dual-ui-需求整理.md

合并后的正式 PRD 为：

liran_docs/requirements/REQ-260914-channel-status-dual-ui-PRD.md

后续开发、测试、真机验收、版本发布和归档只使用 REQ-260914，不再创建或执行独立的 REQ-260915 Goal。

## 原始用户问题

在全部站点卡片打开“测试连通性”后，选择 API Key，模型下拉不会自动回显该 Key 实际拥有的模型，导致模型列表为空、无法选择模型，也无法开始测试。

## 已确认根因

1. `src/renderer/shells/overview/ConnectivityTestModal.tsx` 当前调用 `desktop.sites.usageModels(siteId)`。该调用读取站点登录态下的 `/usage/dashboard/models`，不是当前选中 API Key 的模型权限列表。
2. 模型加载 effect 只依赖 `siteId`，切换 `keyId` 后不会重新请求。
3. `electron/preload/index.ts`、`electron/preload/bridge.cts` 和 `electron/main/index.ts` 当前没有按 `siteId + keyId` 获取模型列表的安全 IPC。
4. 模型为空时 Renderer 直接禁用“开始测试”，所以错误被表现为无法测试。
5. 当前连接测试请求使用站点根地址的 `/v1/chat/completions`，这是正确的 OpenAI 兼容测试入口；问题不在连接测试 URL。

## 修复方案

- 新增按站点和 Key 获取模型的主进程能力，Renderer 只传 `siteId` 和 `keyId`。
- 主进程重新校验站点存在、Key 存在且为 active，再读取该 Key secret。
- 使用该 Key 请求 `GET {site.baseUrl}/v1/models`，不把管理端 `/api/v1` 前缀拼到上游模型地址。
- 兼容 OpenAI 常见模型响应：`{ data: [{ id }] }`、`{ data: { models: [...] } }`、`{ models: [...] }`，同时兼容数组对象中的 `id`、`model`、`name` 字段。
- 过滤空值、去重并限制返回数量；完整 Key 不进入 Renderer、IPC 返回、日志、截图或持久化。
- 弹窗打开时按默认 Key 加载一次；用户切换 Key 时立即取消/忽略旧请求并重新加载新 Key 模型。
- 加载成功后自动选中第一个可用模型，并允许用户手动切换。
- 加载失败显示明确错误和重试入口；没有模型时显示“没有可用模型”并继续禁止开始测试。
- 保持现有普通文本测试、真实用量提示、取消、超时、重试和 Key 脱敏行为。

## 验收标准

- 打开弹窗后，默认 Key 的模型列表来自该 Key 的 `/v1/models` 响应，并自动选中第一项。
- 切换到另一个 active Key 后，模型下拉内容随新 Key 更新，不能保留旧 Key 模型。
- 选中模型后“开始测试”可用，并将同一个 `keyId` 和 `model` 发送到主进程测试链路。
- `/v1/models` 返回 401、403、404、429、5xx、超时、非法 JSON 或空列表时，界面显示可理解错误/空态，不伪造模型。
- 非数字 Key ID 仍可正常读取 secret 和加载模型。
- 完整 API Key 不出现在 Renderer、IPC 返回值、日志、截图和测试夹具。

## 当前范围

- 只修复普通文本连通性测试的模型加载。
- 不实现图片、音频、视频、生图、语音、搜索或实时模式。
- 不修改渠道状态 V1/V2 双界面需求。

## 进入下一阶段

根因和修复方案已确认，下一步进入正式 PRD 转换前的需求确认。
