import { describe, expect, it } from 'vitest';
import {
  computeBackoffMs,
  concurrencyForSiteCount,
  estimateDurationRange,
  intervalInRange,
} from './scheduler.js';
import { aggregateSnapshots, isFreshSnapshot } from './snapshot.js';
import { resolveRate, selectDefaultKey } from './key-policy.js';
import { dynamicTitle, nextLocalMidnight } from './time-and-title.js';
import { buildCsv } from './csv.js';
import { evaluateNotification } from './notifications.js';

describe('default key and rate policy', () => {
  const keys = [
    { id: 'a', name: '主力', maskedLabel: '主力 · ••••A', status: 'active' as const },
    { id: 'b', name: '备用', maskedLabel: '备用 · ••••B', status: 'active' as const },
  ];

  it('selects the active key with most local-today requests', () => {
    expect(selectDefaultKey(keys, { a: 2, b: 9 }, undefined)).toBe('b');
  });

  it('keeps history when all request counts are zero and falls back safely', () => {
    expect(selectDefaultKey(keys, { a: 0, b: 0 }, 'b')).toBe('b');
    expect(selectDefaultKey(keys, { a: 0, b: 0 }, undefined)).toBe('a');
  });

  it('prefers a defined custom rate including zero', () => {
    expect(resolveRate(1.5, 0)).toEqual({ available: true, value: 0, source: 'custom' });
    expect(resolveRate(1.5, undefined)).toEqual({ available: true, value: 1.5, source: 'default' });
    expect(resolveRate(undefined, undefined)).toEqual({ available: false, source: 'unavailable' });
  });
});

describe('scheduler, cache, and aggregation', () => {
  it('uses the documented concurrency and backoff limits', () => {
    expect([1, 4, 5, 10, 11, 20].map(concurrencyForSiteCount)).toEqual([1, 4, 4, 4, 6, 6]);
    expect([0, 1, 2, 3, 9].map((attempt) => computeBackoffMs(attempt, () => 0))).toEqual([
      30_000, 60_000, 120_000, 300_000, 300_000,
    ]);
    expect(intervalInRange(25_000, 40_000, () => 0)).toBe(25_000);
    expect(intervalInRange(25_000, 40_000, () => 0.9999)).toBeLessThanOrEqual(40_000);
  });

  it('estimates an honest range and excludes stale snapshots from totals', () => {
    expect(estimateDurationRange([])).toEqual([3_000, 5_000]);
    expect(estimateDurationRange([1_000, 2_000, 3_000])).toEqual([1_000, 3_000]);
    const now = 1_000_000;
    const fresh = {
      siteId: 'a',
      balance: 10,
      todayTokens: 100,
      todayActualCost: 1,
      fetchedAt: now - 1,
    };
    const stale = {
      siteId: 'b',
      balance: 20,
      todayTokens: 200,
      todayActualCost: 2,
      fetchedAt: now - 11_000,
    };
    expect(isFreshSnapshot(fresh, now, 10_000)).toBe(true);
    expect(aggregateSnapshots([fresh, stale], now, 10_000)).toEqual({
      balance: 10,
      todayTokens: 100,
      todayActualCost: 1,
      counted: 1,
      total: 2,
    });
  });
});

describe('time, titles, notification, and CSV safety', () => {
  it('uses the balance threshold and computes a future local midnight', () => {
    expect(dynamicTitle(2)).toContain('这么有钱');
    expect(dynamicTitle(1.999)).toContain('快没钱了');
    expect(dynamicTitle(undefined)).toContain('正在查余额');
    const next = nextLocalMidnight(new Date('2026-07-13T12:00:00+08:00'));
    expect(next.getTime()).toBeGreaterThan(new Date('2026-07-13T12:00:00+08:00').getTime());
  });

  it('keeps notifications disabled by default and honors cooldown', () => {
    const rule = { enabled: true, lowBalanceThreshold: 0.5, cooldownMs: 60_000 };
    expect(evaluateNotification({ ...rule, enabled: false }, 0.1, 10_000)).toEqual({ send: false });
    expect(evaluateNotification(rule, 0.1, 10_000)).toMatchObject({ send: true });
    expect(evaluateNotification(rule, 0.1, 10_000, 9_000)).toEqual({ send: false });
  });

  it('escapes CSV formulas and never needs full API keys', () => {
    const csv = buildCsv([
      { time: 'now', keyLabel: '=cmd', model: 'gpt', tokens: 1, actualCost: 0.1 },
    ]);
    expect(csv).toContain('\t=cmd');
    expect(csv).not.toContain('sk-live-secret');
  });
});
