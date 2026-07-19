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

  it('keeps duplicate all-site refresh callers attached to the active run', async () => {
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const scheduler = new RefreshScheduler(async () => blocked);
    scheduler.setSites(['a']);

    const first = scheduler.refreshAll();
    let secondSettled = false;
    const second = scheduler.refreshAll().then(() => {
      secondSettled = true;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(secondSettled).toBe(false);
    release?.();
    await Promise.all([first, second]);
  });

  it('reuses an active site refresh while still visiting the remaining sites', async () => {
    let releaseCurrent: (() => void) | undefined;
    const currentBlocked = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    const visits: string[] = [];
    const scheduler = new RefreshScheduler(async (siteId) => {
      visits.push(siteId);
      if (siteId === 'current') await currentBlocked;
    });
    scheduler.setSites(['current', 'other']);
    scheduler.setCurrentSite('current');

    const automatic = scheduler.refreshNow('current');
    const manualAll = scheduler.manualRefreshAll();
    await Promise.resolve();
    await Promise.resolve();

    expect(visits).toEqual(['current', 'other']);
    releaseCurrent?.();
    await Promise.all([automatic, manualAll]);
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

  it('lets a manual all-site refresh bypass per-site failure backoff', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    let calls = 0;
    const scheduler = new RefreshScheduler(async () => {
      calls += 1;
      if (calls === 1) throw new Error('offline');
    });
    scheduler.setSites(['a']);
    await expect(scheduler.refreshNow('a')).rejects.toThrow('offline');

    await scheduler.manualRefreshAll();

    expect(calls).toBe(2);
    vi.useRealTimers();
  });
});
