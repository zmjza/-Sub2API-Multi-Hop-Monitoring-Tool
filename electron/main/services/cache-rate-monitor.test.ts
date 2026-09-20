import { describe, expect, it, vi } from 'vitest';
import { checkCacheRateAlerts } from './cache-rate-monitor.js';

describe('checkCacheRateAlerts', () => {
  it('checks sites serially, limits each site to two groups, and isolates group failures', async () => {
    let active = 0;
    let maxActive = 0;
    let completedA = 0;
    const notify = vi.fn();
    const retain = vi.fn();

    await checkCacheRateAlerts({
      sites: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      enabled: true,
      groups: async (siteId) =>
        [1, 2, 3].map((value) => ({ id: `${siteId}-${value}`, name: `G${value}` })),
      stats: async (query) => {
        if (query.siteId === 'b') expect(completedA).toBe(2);
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        if (query.siteId === 'a' && query.groupId !== 'a-2') completedA += 1;
        if (query.groupId === 'a-2') throw new Error('one group failed');
        return { averageCacheRate: 79, averageCacheRateSampleCount: 30 };
      },
      notify,
      retainGroups: retain,
    });

    expect(maxActive).toBe(2);
    expect(retain).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledTimes(5);
    expect(notify.mock.calls[0]?.slice(0, 4)).toEqual(['a', 'A', 'a-1', 'G1']);
    expect(notify.mock.calls[0]?.slice(4)).toEqual([79, 30, true, true]);
  });

  it('does not turn group-list failures into recovery or alert events', async () => {
    const notify = vi.fn();
    const retain = vi.fn();
    await checkCacheRateAlerts({
      sites: [{ id: 'a', name: 'A' }],
      enabled: true,
      groups: async () => {
        throw new Error('auth failed');
      },
      stats: vi.fn(),
      notify,
      retainGroups: retain,
    });
    expect(notify).not.toHaveBeenCalled();
    expect(retain).not.toHaveBeenCalled();
  });
});
