import type { UsageRecord } from './types';
// Static UI preview data only; it is not an API response.
export const usageRecords: UsageRecord[] = [
  {
    time: '今天 14:26',
    model: '示例模型',
    groupName: '默认分组',
    requestType: 'Chat',
    tokens: '18,420',
    actualCost: '$0.084',
    keyLabel: 'Codex 主力 · sk-••••7K2A',
  },
];
