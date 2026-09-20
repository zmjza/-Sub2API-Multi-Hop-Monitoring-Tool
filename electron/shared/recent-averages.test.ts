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

  it('collects the first 30 valid samples for each metric independently', () => {
    const rows = Array.from({ length: 50 }, (_, index) =>
      row(index % 2 === 0 ? index * 100 : undefined, index % 3 === 0 ? index : undefined),
    );
    const result = averageRecentSamples(rows, {
      durationMs: (item) => item.durationMs,
      cacheRate: (item) => item.cacheRate,
    });
    expect(result.usedRows).toBe(50);
    expect(result.durationSamples).toBe(25);
    expect(result.cacheRateSamples).toBe(17);
    expect(result.averageDurationMs).toBe(2400);
    expect(result.averageCacheRate).toBe(24);
  });

  it('keeps scanning past invalid rows until it has 30 valid samples', () => {
    const rows = Array.from({ length: 50 }, (_, index) =>
      row(index < 20 ? undefined : 1000, index < 10 ? undefined : 80),
    );
    const result = averageRecentSamples(
      rows,
      { durationMs: (item) => item.durationMs, cacheRate: (item) => item.cacheRate },
      30,
    );
    expect(result.usedRows).toBe(50);
    expect(result.durationSamples).toBe(30);
    expect(result.cacheRateSamples).toBe(30);
    expect(result.averageDurationMs).toBe(1000);
    expect(result.averageCacheRate).toBe(80);
  });
});
