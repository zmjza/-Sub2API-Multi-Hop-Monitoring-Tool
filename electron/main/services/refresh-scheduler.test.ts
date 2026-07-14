import { describe, expect, it, vi } from 'vitest';
import { RefreshScheduler } from './refresh-scheduler.js';

describe('RefreshScheduler', () => {
  it('deduplicates a site and prioritizes the current site', async () => {
    const order: string[] = [];
    const scheduler = new RefreshScheduler(async (siteId) => {
      order.push(siteId);
    });
    scheduler.setSites(['a', 'b']);
    scheduler.setCurrentSite('b');
    await scheduler.refreshAll();
    expect(order).toEqual(['b', 'a']);
    scheduler.stop();
  });

  it('enforces a five-second manual refresh guard', async () => {
    vi.useFakeTimers();
    let count = 0;
    const scheduler = new RefreshScheduler(async () => {
      count += 1;
    });
    scheduler.setSites(['a']);
    await scheduler.manualRefresh('a');
    await scheduler.manualRefresh('a');
    expect(count).toBe(1);
    vi.useRealTimers();
  });

  it('caps twenty-site concurrency and isolates a failed site', async () => {
    let active = 0;
    let maximum = 0;
    const visited: string[] = [];
    const scheduler = new RefreshScheduler(async (siteId) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      visited.push(siteId);
      active -= 1;
      if (siteId === 'site-3') throw new Error('isolated');
    });
    scheduler.setSites(Array.from({ length: 20 }, (_, index) => `site-${index}`));
    await scheduler.refreshAll();
    expect(maximum).toBeLessThanOrEqual(6);
    expect(visited).toHaveLength(20);
  });

  it('applies failure backoff and lets a manual retry bypass it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    let calls = 0;
    const scheduler = new RefreshScheduler(async () => {
      calls += 1;
      throw new Error('offline');
    });
    await expect(scheduler.refreshNow('a')).rejects.toThrow('offline');
    await scheduler.refreshNow('a');
    expect(calls).toBe(1);
    await expect(scheduler.manualRefresh('a')).rejects.toThrow('offline');
    expect(calls).toBe(2);
    vi.useRealTimers();
  });
});
