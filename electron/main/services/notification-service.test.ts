import { describe, expect, it, vi } from 'vitest';
import { NotificationService } from './notification-service.js';

describe('NotificationService', () => {
  it('persists cooldown fingerprints across service instances', () => {
    vi.spyOn(Date, 'now').mockReturnValue(100_000);
    const timestamps = new Map<string, number>();
    const store = {
      get: (siteId: string, fingerprint: string) => timestamps.get(`${siteId}:${fingerprint}`),
      set: (siteId: string, fingerprint: string, value: number) => {
        timestamps.set(`${siteId}:${fingerprint}`, value);
      },
    };
    const send = vi.fn();
    expect(
      new NotificationService({ send }, store).lowBalance('a', 'A', 0.1, true, 0.5, 60_000),
    ).toBe(true);
    expect(
      new NotificationService({ send }, store).lowBalance('a', 'A', 0.1, true, 0.5, 60_000),
    ).toBe(false);
    expect(send).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it('notifies a channel failure once and then announces recovery', () => {
    const send = vi.fn();
    const service = new NotificationService({ send });
    expect(service.channelHealth('a', 'A 渠道', false, true, 60_000)).toBe(true);
    expect(service.channelHealth('a', 'A 渠道', false, true, 60_000)).toBe(false);
    expect(service.channelHealth('a', 'A 渠道', true, true, 60_000)).toBe(true);
    expect(send.mock.calls.map(([title]) => title)).toEqual([
      'Sub2API 渠道异常',
      'Sub2API 渠道恢复',
    ]);
  });

  it('can suppress recovery while retaining failure notifications', () => {
    const send = vi.fn();
    const service = new NotificationService({ send });
    expect(service.health('a', 'A', false, true, 60_000, false)).toBe(true);
    expect(service.health('a', 'A', true, true, 60_000, false)).toBe(false);
    expect(send.mock.calls.map(([title]) => title)).toEqual(['Sub2API 站点异常']);
  });

  it('sends two cache-rate notifications two seconds apart and persists the event', () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const timestamps = new Map<string, number>();
    const store = {
      get: (siteId: string, fingerprint: string) => timestamps.get(`${siteId}:${fingerprint}`),
      set: (siteId: string, fingerprint: string, value: number) =>
        timestamps.set(`${siteId}:${fingerprint}`, value),
      remove: (siteId: string, fingerprint: string) =>
        timestamps.delete(`${siteId}:${fingerprint}`),
    };
    const send = vi.fn();
    const service = new NotificationService({ send }, store);

    expect(service.cacheRate('site-a', '青蛙', 'group-1', '特价分组', 79.99, 30, true)).toBe(true);
    expect(send).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1_999);
    expect(send).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls).toEqual([
      ['Sub2API 缓存率提醒', '你现在使用的「青蛙」中「特价分组」缓存率持续下降，请注意。'],
      ['Sub2API 缓存率提醒', '你现在使用的「青蛙」中「特价分组」缓存率持续下降，请注意。'],
    ]);

    expect(service.cacheRate('site-a', '青蛙', 'group-1', '特价分组', 79.99, 30, true)).toBe(false);
    expect(
      new NotificationService({ send }, store).cacheRate(
        'site-a',
        '青蛙',
        'group-1',
        '特价分组',
        79.99,
        30,
        true,
      ),
    ).toBe(false);
    vi.runOnlyPendingTimers();
    expect(send).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('requires 30 fresh samples, uses a strict 80 percent threshold, and rearms after recovery', () => {
    vi.useFakeTimers();
    const timestamps = new Map<string, number>();
    const store = {
      get: (siteId: string, fingerprint: string) => timestamps.get(`${siteId}:${fingerprint}`),
      set: (siteId: string, fingerprint: string, value: number) =>
        timestamps.set(`${siteId}:${fingerprint}`, value),
      remove: (siteId: string, fingerprint: string) =>
        timestamps.delete(`${siteId}:${fingerprint}`),
    };
    const send = vi.fn();
    const service = new NotificationService({ send }, store);

    expect(service.cacheRate('a', 'A', 'g', 'G', 79.99, 29, true)).toBe(false);
    expect(service.cacheRate('a', 'A', 'g', 'G', 79.99, 30, true, false)).toBe(false);
    expect(service.cacheRate('a', 'A', 'g', 'G', 80, 30, true)).toBe(false);
    expect(service.cacheRate('a', 'A', 'g', 'G', 79.99, 30, true)).toBe(true);
    vi.runAllTimers();
    expect(send).toHaveBeenCalledTimes(2);

    expect(service.cacheRate('a', 'A', 'g', 'G', 80, 30, true)).toBe(false);
    expect(service.cacheRate('a', 'A', 'g', 'G', 79.99, 30, true)).toBe(true);
    vi.runAllTimers();
    expect(send).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it('cancels the pending cache-rate repeat when disabled, removed, or shutting down', () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const service = new NotificationService({ send });

    service.cacheRate('a', 'A', 'g1', 'G1', 70, 30, true);
    service.cacheRate('a', 'A', 'g1', 'G1', 70, 30, false);
    vi.runOnlyPendingTimers();
    expect(send).toHaveBeenCalledTimes(1);

    service.cacheRate('a', 'A', 'g2', 'G2', 70, 30, true);
    service.cancelSite('a');
    vi.runOnlyPendingTimers();
    expect(send).toHaveBeenCalledTimes(2);

    service.cacheRate('b', 'B', 'g3', 'G3', 70, 30, true);
    service.cancelAllCacheRate();
    vi.runOnlyPendingTimers();
    expect(send).toHaveBeenCalledTimes(3);

    service.cacheRate('c', 'C', 'g4', 'G4', 70, 30, true);
    service.retainCacheRateGroups('c', []);
    vi.runOnlyPendingTimers();
    expect(send).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it('swallows notification sender failures without retrying forever', () => {
    vi.useFakeTimers();
    const service = new NotificationService({
      send: vi.fn(() => {
        throw new Error('permission denied');
      }),
    });
    expect(() => service.cacheRate('a', 'A', 'g', 'G', 70, 30, true)).not.toThrow();
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
