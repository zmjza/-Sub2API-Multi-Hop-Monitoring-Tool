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
});
