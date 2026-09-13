import { describe, expect, it } from 'vitest';
import { averageRecentSamples } from './recent-averages.js';

function row(durationMs?: number, cacheRate?: number) {
  return { durationMs, cacheRate };
}

describe('averageRecentSamples', () => {
  it('returns empty placeholders for zero rows', () => {
    expect(
      averageRecentSamples([], { durationMs: () => undefined, cacheRate: () => undefined }),
    ).toEqual({
      usedRows: 0,
      durationSamples: 0,
      cacheRateSamples: 0,
    });
  });

  it('uses actual sample counts below 100 and ignores invalid values', () => {
    const rows = [row(1000, 50), row(undefined, 0), row(-8, undefined), row(3000, 100)];
    const result = averageRecentSamples(rows, {
      durationMs: (item) => item.durationMs,
      cacheRate: (item) => item.cacheRate,
    });
    expect(result.usedRows).toBe(4);
    expect(result.durationSamples).toBe(2);
    expect(result.cacheRateSamples).toBe(3);
    expect(result.averageDurationMs).toBe(2000);
    expect(result.averageCacheRate).toBeCloseTo(50);
  });

  it('only averages the first 100 rows in the given order', () => {
    const rows = Array.from({ length: 120 }, (_, index) => row(index < 100 ? 1000 : 5000, 10));
    const result = averageRecentSamples(rows, {
      durationMs: (item) => item.durationMs,
      cacheRate: (item) => item.cacheRate,
    });
    expect(result.usedRows).toBe(100);
    expect(result.durationSamples).toBe(100);
    expect(result.averageDurationMs).toBe(1000);
  });
});
