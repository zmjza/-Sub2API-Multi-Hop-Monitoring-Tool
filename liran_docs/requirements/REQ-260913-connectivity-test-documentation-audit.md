# REQ-260913-connectivity-test documentation 审计

任务 ID：REQ-260913-connectivity-test
阶段：documentation 1/2
状态：已完成，待开发

## 已完成产物

- 微观任务：CT-01 到 CT-05，含 CT-01-A 至 CT-05-C，字段包括依赖、主要文件、测试方式、完成条件和真机影响。见 liran_docs/04-开发追踪.md。
- 测试矩阵：CT-STAT/CT-V2/CT-CONN/CT-REG/CT-BUILD，状态全部为待执行。见 liran_docs/08-测试用例.md。
- 真机清单：入口、步骤、成功/失败标准已写，跑通列留空。见 liran_docs/09-真机实测.md。
- UI 接线：现有总览、使用记录、渠道状态壳增量，无独立 UI 目标。见 liran_docs/10-UI壳接入清单.md 与对应 ui-shells 清单。
- 长期事实：06 适配器、08 使用记录、09 渠道状态、10 全站总览已写入 V2 先探测、最近 100 条统计、Key/模型选择和完整 Key 安全边界。

## 开发前调用方结论

- 渠道当前只有 V1 /channel-monitors；V2 matrix 需新增适配，归一化进现有 normal/degraded/failed/unknown。
- 中转站平均耗时来自 usage/stats，列表每页 20 条，不能直接当最近 100 条。
- OpenCodex 当前对全部筛选结果求平均，需改为最近 100 条有效样本。
- 测试连通性尚无 IPC；Renderer 只传 siteId、keyId、model、prompt。

## 验证

- rg 已确认 REQ-260913 贯穿 03/04/08/09/10、PRD 和模块文档。
- src/ 与 electron/ 无本轮实现 diff。
- 测试和真机新条目未填写通过。
