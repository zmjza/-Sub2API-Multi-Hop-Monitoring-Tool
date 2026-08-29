import { describe, expect, it } from 'vitest';
import type { OpenCodexLogsPayload } from '../../../../electron/shared/opencodex';
import {
  filterOpenCodexRows,
  normalizeOpenCodexLogs,
  OPENCODEX_COLUMNS,
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
      reasoning: 'max',
      requestType: 'Responses',
      status: 200,
      statusLabel: '200',
      firstTokenLabel: '1.23s',
      tokensPerSecondLabel: '18.55 t/s',
      speedTier: 'slow',
      costLabel: '$0.0006',
      totalTokens: '166.09K',
    });
    expect(rows[1]).toMatchObject({
      reasoning: '—',
      requestType: 'Chat',
      firstTokenLabel: '—',
      tokensPerSecondLabel: '—',
      speedTier: 'unavailable',
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
      filterOpenCodexRows(rows, { ...filters, reasoning: 'max' }).map((r) => r.provider),
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
    expect(options.reasonings).toEqual(['—', 'max']);
    expect(options.requestTypes).toEqual(['Chat', 'Responses']);
    expect(options.statuses).toEqual(['200', '401']);
  });
});

describe('OpenCodex column layout', () => {
  it('keeps provider, provider-model and status as the first three columns', () => {
    expect(OPENCODEX_COLUMNS).toEqual([
      '时间',
      '提供方',
      '提供方模型',
      '状态',
      '思考模式',
      '请求类型',
      'Token',
      '首字',
      '耗时 / t/s',
      '实际消费',
    ]);
  });

  it('does not include a cache-rate display field in OpenCodex rows', () => {
    const [row] = normalizeOpenCodexLogs(payload);
    expect(row).not.toHaveProperty('cacheRate');
    expect(row).not.toHaveProperty('cacheRateLabel');
    expect(row).not.toHaveProperty('cacheRateTone');
  });
});

describe('speed tier mapping', () => {
  it('derives is-slow, is-normal and is-fast tiers from tokPerSecond', () => {
    const rows = normalizeOpenCodexLogs({
      timeZone: 'UTC',
      total: 3,
      logs: [
        {
          timestamp: 1,
          provider: 'p',
          model: 'm1',
          status: 200,
          durationMs: 1000,
          displayMetrics: { tokPerSecond: { kind: 'value', value: 18, estimated: false } },
        },
        {
          timestamp: 2,
          provider: 'p',
          model: 'm2',
          status: 200,
          durationMs: 1000,
          displayMetrics: { tokPerSecond: { kind: 'value', value: 30, estimated: false } },
        },
        {
          timestamp: 3,
          provider: 'p',
          model: 'm3',
          status: 200,
          durationMs: 1000,
          displayMetrics: { tokPerSecond: { kind: 'value', value: 60, estimated: false } },
        },
      ],
    });
    expect(rows.map((row) => row.speedTier)).toEqual(['slow', 'normal', 'fast']);
  });

  it('marks missing metrics as unavailable', () => {
    const rows = normalizeOpenCodexLogs({
      timeZone: 'UTC',
      total: 1,
      logs: [
        {
          timestamp: 1,
          provider: 'p',
          model: 'm',
          status: 500,
          durationMs: 100,
          displayMetrics: {
            tokPerSecond: { kind: 'unavailable', reason: 'output_missing' },
          },
        },
      ],
    });
    expect(rows[0]?.speedTier).toBe('unavailable');
  });
});
