# macOS 1.4.3 真机证据

日期：2026-07-24

## 安装副本

- 应用：`/Applications/看看你还有💰吗？.app`
- 版本：`1.4.3`
- 结果：应用可启动，API 密钥页面可打开。

## API 密钥页面

- 真实安装副本读取到当前站点 Key 列表：2 条（maok）、14 条（walkai 缓存/站点上下文）、3 条（panel.hanhegufei.online）。
- 分组选项在下拉菜单中同时显示名称、平台和倍率；实测包含 `Claude`、`OpenAI` 和倍率数值。
- 点击 API Key 单元格后主进程剪贴板返回非空值；完整值未写入本证据截图。
- 宽窗口截图：`api-keys-wide-masked.png`。
- 窄窗口截图：`api-keys-narrow-masked.png`。
- 窄窗口表格保持横向滚动：`scrollWidth=1260`、`clientWidth=439`、`overflow-x=auto`。

## 悬浮窗

- 安装副本切换到悬浮窗后显示“今日 Token”和“今日消费”。
- 当前实测文本为 `今日 Token 17.21M`、`今日消费 $1.2970`，来自当前有效 Key 统计链路。

## 真实站点接口验证

- `walkai.top`：登录成功；核心资料、用量、分组倍率和渠道接口可用；普通用户 API Key 管理端点返回不支持，未伪造成功。
- `panel.hanhegufei.online`：登录成功；Key 列表、今日/30 天用量、分组倍率、渠道和详情可用；首个 Key 分组切换、回读和恢复通过。
- `ai.maok.shop`：本次登录返回 HTTP 400，消息为 Turnstile verification failed；无法完成本轮远程写入验收，保留为真实阻塞，不冒充通过。

## 证据边界

- 截图中的 API Key 已在截图前替换为脱敏占位值。
- 不记录账号、密码、完整 Key、Token 或完整响应。
