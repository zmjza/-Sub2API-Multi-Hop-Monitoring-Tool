import { describe, expect, it } from 'vitest';
import type { OpenCodexLogsPayload } from '../../../../electron/shared/opencodex';
import {
  filterOpenCodexRows,
  normalizeOpenCodexLogs,
  openCodexOptions,
  openCodexStatTotals,
  type OpenCodexFilters,
} from './opencodex-data';

const payload: OpenCodexLogsPayload = {
  timeZone: 'Asia/Shanghai',
  total: 2,
  logs: [
    {
      requestId: 'req-1',
      timestamp: 1_786_700_915_575,
      provider: 'opencode-go',
      model: 'deepseek-v4-flash',
      status: 200,
      durationMs: 12_454,
      firstOutputMs: 1_230,
      requestedEffort: 'max',
      effectiveEffort: 'max',
      inboundProtocol: 'responses',
      usageStatus: 'reported',
      usage: { inputTokens: 231, outputTokens: 231, cachedInputTokens: 165_632 },
      totalTokens: 166_094,
      displayMetrics: {
        tokPerSecond: { kind: 'value', value: 18.55, estimated: false },
        cost: {
          kind: 'value',
          estimate: {
            cost: { total: 0.0005607896 },
          },
        },
      },
    },
    {
      requestId: 'req-2',
      timestamp: 1_786_700_000_000,
      provider: 'openai',
      model: 'gpt-5.2',
      status: 401,
      durationMs: 800,
      inboundProtocol: 'chat',
      usage: { inputTokens: 10, outputTokens: 0 },
      displayMetrics: {
        tokPerSecond: { kind: 'unavailable', reason: 'output_missing' },
        cost: { kind: 'unavailable', reason: 'usage_missing' },
      },
    },
  ],
};

const filters: OpenCodexFilters = {
  period: '30d',
  provider: '',
  model: '',
  reasoning: '',
  requestType: '',
  status: '',
  startDate: '',
  endDate: '',
  sort: 'desc',
};

describe('normalizeOpenCodexLogs', () => {
  it('maps OpenCodex fields into display rows without leaking raw secrets', () => {
    const rows = normalizeOpenCodexLogs(payload);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      provider: 'opencode-go',
      model: 'deepseek-v4-flash',
      reasoning: '最大',
      requestType: 'Responses',
      status: 200,
      statusLabel: '200',
      firstTokenLabel: '1.23s',
      tokensPerSecondLabel: '18.55 t/s',
      costLabel: '$0.0006',
      totalTokens: '166.09K',
    });
    expect(rows[1]).toMatchObject({
      reasoning: '—',
      requestType: 'Chat',
      firstTokenLabel: '—',
      tokensPerSecondLabel: '—',
      costLabel: '—',
      status: 401,
    });
  });

  it('keeps missing usage and metrics stable', () => {
    const rows = normalizeOpenCodexLogs({ timeZone: 'UTC', total: 1, logs: [] });
    expect(rows).toEqual([]);
  });
});

describe('filterOpenCodexRows', () => {
  it('filters by provider, model, reasoning, request type and status', () => {
    const rows = normalizeOpenCodexLogs(payload);
    expect(filterOpenCodexRows(rows, { ...filters, provider: 'opencode-go' })).toHaveLength(1);
    expect(filterOpenCodexRows(rows, { ...filters, status: '401' })).toHaveLength(1);
    expect(
      filterOpenCodexRows(rows, { ...filters, reasoning: '最大' }).map((r) => r.provider),
    ).toEqual(['opencode-go']);
    expect(filterOpenCodexRows(rows, { ...filters, requestType: 'Chat' })).toHaveLength(1);
    expect(filterOpenCodexRows(rows, { ...filters, model: '不存在' })).toHaveLength(0);
  });

  it('applies sort direction by timestamp', () => {
    const rows = normalizeOpenCodexLogs(payload);
    expect(filterOpenCodexRows(rows, filters)[0]?.model).toBe('deepseek-v4-flash');
    expect(filterOpenCodexRows(rows, { ...filters, sort: 'asc' })[0]?.model).toBe('gpt-5.2');
  });

  it('excludes rows outside custom date range', () => {
    const rows = normalizeOpenCodexLogs(payload);
    expect(
      filterOpenCodexRows(rows, {
        ...filters,
        period: 'custom',
        startDate: '2026-08-13',
        endDate: '2026-08-14',
      }),
    ).toHaveLength(2);
    expect(
      filterOpenCodexRows(rows, {
        ...filters,
        period: 'custom',
        startDate: '2026-08-13',
        endDate: '2026-08-13',
      }),
    ).toHaveLength(0);
  });
});

describe('openCodexStatTotals', () => {
  it('computes token and cost totals from raw values', () => {
    const rows = normalizeOpenCodexLogs(payload);
    const totals = openCodexStatTotals(rows);
    expect(totals.totalRequests).toBe(2);
    expect(totals.totalTokens).toBe(166_104);
    expect(totals.totalInputTokens).toBe(241);
    expect(totals.totalOutputTokens).toBe(231);
    expect(totals.totalCacheReadTokens).toBe(165_632);
    expect(totals.totalCost).toBeCloseTo(0.0005607896);
    expect(totals.averageDurationSeconds).toBeCloseTo(6.627);
  });
});

describe('openCodexOptions', () => {
  it('derives filter option lists from loaded rows', () => {
    const rows = normalizeOpenCodexLogs(payload);
    const options = openCodexOptions(rows);
    expect(options.providers).toEqual(['openai', 'opencode-go']);
    expect(options.models).toEqual(['deepseek-v4-flash', 'gpt-5.2']);
    expect(options.reasonings).toEqual(['—', '最大']);
    expect(options.requestTypes).toEqual(['Chat', 'Responses']);
    expect(options.statuses).toEqual(['200', '401']);
  });
});
