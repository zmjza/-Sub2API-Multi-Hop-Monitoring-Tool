# IPC、安全与日志脱敏

> 2026-07-14 真机回写：`sandbox`、`contextIsolation`、禁用 Node integration、CommonJS preload 白名单桥、输入/输出 Zod 校验和敏感字段扫描已落地。Electron E2E 已断言桥对象并完成业务 IPC 流；打包应用数据、SQLite、凭据后端、CSV 和稳定截图扫描未发现秘密泄漏。

上级：[[03-索引]]
下级：preload 契约、IPC 校验、Electron 安全、日志
依赖：[[02-架构文档]]、[[06-数据字典]]

## 职责

建立 Renderer 与主进程的最小可信边界。覆盖 RQ-15、RQ-18。

## 规则

- contextIsolation 开启、Node integration 关闭、sandbox 可行性在初始化时验证。
- preload 只暴露站点、查询、设置、窗口和通知等命名方法。
- 每个 channel 有请求/响应 schema、调用权限和安全错误格式。
- 拒绝任意导航、任意新窗口和任意 shell 打开；外部 URL 使用协议/域名策略。
- CSP 限制脚本、样式、连接和资源；开发与生产策略分开。
- 日志 redactor 处理 password、token、authorization、apiKey、secretRef 和敏感嵌套字段。

## 验收

- 非法 IPC、超大输入、原型污染、导航、CSP、日志嵌套脱敏和错误响应均有安全测试。

## 当前实现证据

preload 已只暴露 `sites.list/addAndVerify/refresh/usage/channels` 命名 API，主进程使用 Zod 校验站点、站点 ID 和使用记录查询；Renderer 未获得 Node、密码、Token 或任意 HTTP 权限。非法 channel、CSP、日志嵌套脱敏和导航负面测试仍待补齐。

## 任务范围

TASK-01-03、TASK-01-04、TASK-12-07 至 TASK-12-09。
