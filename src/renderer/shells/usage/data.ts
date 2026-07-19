import type { UsageRecord } from './types';
// Static UI preview data only; it is not an API response.
export const usageRecords: UsageRecord[] = [
  {
    time: '2026/07/19 14:26:00',
    model: '示例模型',
    groupName: '默认分组',
    requestType: 'Chat',
    inputTokens: '2,008',
    outputTokens: '1,879',
    cacheReadTokens: '65.3K',
    actualCost: '$0.084',
    keyLabel: 'Codex 主力 · sk-••••7K2A',
  },
];
