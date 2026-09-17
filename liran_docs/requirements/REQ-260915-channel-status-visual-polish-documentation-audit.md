# REQ-260915-channel-status-visual-polish documentation 审计

任务 ID：REQ-260915-channel-status-visual-polish
阶段：documentation 1/2
状态：已完成，待开发

## 已完成产物

- 微观任务：SEC-2614、TL-2601、PLAT-2603、CARD-2605、CARD-2606、TL-2602、PLAT-2604、KEY-2607、KEY-2608、USAGE-2609、USAGE-2610、MOT-2611、MOT-2612、FLT-2613、TEST-2615、PAY-2616、OPEN-2617、QA-2618。字段含 REQ/AC、依赖、主要文件、测试方式、完成条件和真机影响。见 task-breakdown 与 04-开发追踪.md。
- 测试矩阵：TC-260915-01～24，状态全部待执行。见 08-测试用例.md。
- 真机清单：RT-01～10 对应 AC-01～AC-10，跑通列留空，状态待执行。见 09-真机实测.md。
- UI 接线：现有渠道/API 密钥/使用记录/悬浮窗/全部站点/雷达服务器常用网站增量，无独立 UI 目标。见 10-UI壳接入清单.md。
- 长期事实：09 渠道 18 格与分类、07 API 密钥渠道区、08 小时筛选、02 悬浮窗双击、10 测试动效与快捷充值、01 切页与外开、14 凭据边界已写入；06/11 强调不改探测顺序/调度。
- pitfalls：时间线槽位不一致写入 rate-comparison.md；内嵌页一律 deny 写入 electron-build.md。

## 覆盖核对

| PRD    | 来源         | 微观任务               | AC        | 08        | 09        |
| ------ | ------------ | ---------------------- | --------- | --------- | --------- |
| REQ-01 | REQ-1、REQ-2 | TL-2601、TL-2602       | AC-01     | TC-01～04 | RT-01     |
| REQ-02 | REQ-3、REQ-4 | PLAT-2603、PLAT-2604   | AC-02     | TC-05～06 | RT-02     |
| REQ-03 | REQ-2        | CARD-2605、CARD-2606   | AC-02     | TC-07～09 | RT-02     |
| REQ-04 | REQ-6、REQ-7 | KEY-2607、KEY-2608     | AC-03     | TC-10～13 | RT-03     |
| REQ-05 | REQ-5        | USAGE-2609、USAGE-2610 | AC-04     | TC-14～16 | RT-04     |
| REQ-06 | REQ-8        | MOT-2611、MOT-2612     | AC-05     | TC-17～18 | RT-05     |
| REQ-07 | REQ-9        | FLT-2613               | AC-06     | TC-19     | RT-06     |
| REQ-08 | 共享安全     | SEC-2614               | AC-07     | TC-20     | RT-07     |
| REQ-09 | REQ-10       | TEST-2615              | AC-08     | TC-21     | RT-08     |
| REQ-10 | REQ-11       | PAY-2616               | AC-09     | TC-22     | RT-09     |
| REQ-11 | REQ-12       | OPEN-2617              | AC-10     | TC-23     | RT-10     |
| 全部   | 验收         | QA-2618                | AC-01～10 | TC-24     | RT-01～10 |

## 开发前调用方结论

- channelTimelineForDisplay 默认 limit=20，只裁剪不左补空槽；V2_MATRIX_LENGTH 为 90m=18、24h=24、7d=14、30d=30。
- 悬浮窗 aria-label 仍写最近 20 次。
- 使用记录两种模式自定义范围仍是 type=date。
- API 密钥分组下拉下方仍有重复分组名；表格 min-width 1260px；主窗最小宽 720px。
- 雷达 / Sub2API / 常用网站 setWindowOpenHandler 一律 deny；认证窗口继续全部拒绝，不纳入本任务。
- 探测顺序以 PRD 为准：V1 优先、V2 回退。Chrome 打开复用 chromeExecutableCandidates，禁止认证调试 Chrome。快捷充值 = origin + /purchase。

## 验证

- rg 已确认 REQ-260915 贯穿 03/04/08/09/10、PRD、task-breakdown 和受影响模块文档。
- src/ 与 electron/ 无本轮实现 diff。
- 测试和真机新条目未填写通过、已完成或已归档。
- 下一阶段解锁：本审计已通过，development-and-acceptance 2/2 提示词已生成，待执行。
