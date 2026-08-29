import { describe, expect, it } from 'vitest';
import {
  firstTokenClass,
  readUsagePagination,
  readUsageRecords,
  USAGE_COLUMNS,
  usageResetQuery,
} from './UsagePage';

describe('usage columns', () => {
  it('keeps cache rate in a dedicated column after Token', () => {
    expect(USAGE_COLUMNS.indexOf('缓存率')).toBe(USAGE_COLUMNS.indexOf('Token') + 1);
  });
});

describe('readUsagePagination', () => {
  it('restores the documented default query when filters are reset', () => {
    expect(usageResetQuery()).toEqual({ period: 'today', page: 1, sort: 'desc' });
  });

  it('uses the safe usage payload metadata for totals, ranges, and page buttons', () => {
    expect(
      readUsagePagination({
        items: Array.from({ length: 20 }, (_, index) => ({ id: String(index) })),
        page: 2,
        pageSize: 20,
        pages: 42,
        total: 840,
      }),
    ).toEqual({
      page: 2,
      pageSize: 20,
      pages: 42,
      total: 840,
      rangeStart: 21,
      rangeEnd: 40,
      pageButtons: [1, 2, 3, 4, 5],
    });
  });

  it('clamps malformed preview metadata without inventing records', () => {
    expect(readUsagePagination({ items: [], page: 9, pageSize: 20, pages: 0, total: 0 })).toEqual({
      page: 1,
      pageSize: 20,
      pages: 0,
      total: 0,
      rangeStart: 0,
      rangeEnd: 0,
      pageButtons: [],
    });
  });
});

describe('firstTokenClass', () => {
  it('keeps the requested latency boundaries', () => {
    expect(firstTokenClass(9999)).toBe('first-token-fast');
    expect(firstTokenClass(10000)).toBe('first-token-medium');
    expect(firstTokenClass(19999)).toBe('first-token-medium');
    expect(firstTokenClass(20000)).toBe('first-token-slow');
    expect(firstTokenClass(undefined)).toBe('');
    expect(firstTokenClass(-1)).toBe('');
  });
});

describe('readUsageRecords', () => {
  it('keeps input, output, and cache-read token values in one row model', () => {
    const [row] = readUsageRecords({
      items: [
        {
          createdAt: new Date(2026, 6, 19, 14, 54, 38).toISOString(),
          inputTokens: 2008,
          outputTokens: 1879,
          cacheReadTokens: 65_300,
        },
      ],
    });

    expect(row).toMatchObject({
      inputTokens: '2,008',
      outputTokens: '1,879',
      cacheReadTokens: '65.3K',
      cacheRate: expect.closeTo((65300 / (2008 + 65300)) * 100, 5),
    });
  });

  it('derives tokens per second from raw output tokens and duration milliseconds', () => {
    const [row] = readUsageRecords({
      items: [
        {
          createdAt: '2026-08-07T10:00:00.000Z',
          outputTokens: 50,
          durationMs: 2770,
        },
      ],
    });

    expect(row).toMatchObject({
      tokensPerSecond: 50_000 / 2770,
      tokensPerSecondLabel: '18.05 t/s',
      speedTier: 'slow',
    });
  });

  it('uses exact 20 and 50 t/s tier boundaries and rejects invalid durations', () => {
    const rows = readUsageRecords({
      items: [
        { createdAt: '2026-08-07T10:00:00Z', outputTokens: 20, durationMs: 1000 },
        { createdAt: '2026-08-07T10:00:01Z', outputTokens: 50, durationMs: 1000 },
        { createdAt: '2026-08-07T10:00:02Z', outputTokens: 10, durationMs: 0 },
      ],
    });

    expect(rows.map((row) => [row.tokensPerSecondLabel, row.speedTier])).toEqual([
      ['20.00 t/s', 'normal'],
      ['50.00 t/s', 'fast'],
      ['—', 'unavailable'],
    ]);
  });
});
