import { describe, expect, it, vi } from 'vitest';
import { CurrentKeyStatsLoader } from './current-key-stats-loader';

describe('CurrentKeyStatsLoader', () => {
  it('limits cross-site requests to two and isolates one site failure', async () => {
    let active = 0;
    let maximum = 0;
    const fetchStats = vi.fn(async (_siteId: string, keyId: string) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      if (keyId === '2') throw new Error('temporary');
      return {
        totalRequests: Number(keyId),
        totalTokens: Number(keyId) * 10,
        totalActualCost: Number(keyId) / 10,
      };
    });
    const loader = new CurrentKeyStatsLoader(fetchStats, { concurrency: 2 });

    const result = await loader.load([
      { siteId: 'a', keyId: '1', availableCredit: { kind: 'amount', value: 2 } },
      { siteId: 'b', keyId: '2', availableCredit: { kind: 'amount', value: 3 } },
      { siteId: 'c', keyId: '3', availableCredit: { kind: 'amount', value: 4 } },
    ]);

    expect(maximum).toBe(2);
    expect(result.a).toMatchObject({ state: 'success', totalTokens: 10 });
    expect(result.b).toEqual({ state: 'error', keyId: '2' });
    expect(result.c).toMatchObject({ state: 'success', totalTokens: 30 });
  });

  it('caches by site and effective key while force refresh bypasses the cache', async () => {
    let now = 1_000;
    const fetchStats = vi.fn(async () => ({
      totalRequests: 1,
      totalTokens: 10,
      totalActualCost: 0.1,
    }));
    const loader = new CurrentKeyStatsLoader(fetchStats, { now: () => now, ttlMs: 60_000 });
    const input = [
      { siteId: 'a', keyId: '1', availableCredit: { kind: 'amount' as const, value: 2 } },
    ];

    await loader.load(input);
    await loader.load(input);
    expect(fetchStats).toHaveBeenCalledTimes(1);

    await loader.load(input, true);
    expect(fetchStats).toHaveBeenCalledTimes(2);

    now += 60_001;
    await loader.load(input);
    expect(fetchStats).toHaveBeenCalledTimes(3);

    await loader.load([{ ...input[0], keyId: '9' }]);
    expect(fetchStats).toHaveBeenCalledTimes(4);
  });

  it('returns unknown without making a request when the current key is unresolved', async () => {
    const fetchStats = vi.fn();
    const loader = new CurrentKeyStatsLoader(fetchStats);

    await expect(
      loader.load([{ siteId: 'a', availableCredit: { kind: 'unknown' } }]),
    ).resolves.toEqual({ a: { state: 'unknown' } });
    expect(fetchStats).not.toHaveBeenCalled();
  });
});
