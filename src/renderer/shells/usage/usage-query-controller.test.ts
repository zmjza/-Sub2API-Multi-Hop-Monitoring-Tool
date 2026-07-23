import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsageQueryController, type UsageAutoQuery } from './usage-query-controller';

afterEach(() => vi.useRealTimers());

describe('UsageQueryController', () => {
  it('debounces filter changes and keeps only the newest query', () => {
    vi.useFakeTimers();
    const calls: UsageAutoQuery[] = [];
    const controller = new UsageQueryController((query) => calls.push(query), 300);

    controller.schedule({ period: 'today', page: 1, sort: 'desc', model: 'gpt-4o' });
    vi.advanceTimersByTime(200);
    controller.schedule({ period: 'today', page: 1, sort: 'desc', model: 'gpt-5' });
    vi.advanceTimersByTime(299);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(1);

    expect(calls).toEqual([{ period: 'today', page: 1, sort: 'desc', model: 'gpt-5' }]);
  });

  it('can flush a forced refresh and cancel work on unmount', () => {
    vi.useFakeTimers();
    const calls: UsageAutoQuery[] = [];
    const controller = new UsageQueryController((query) => calls.push(query), 300);
    const query = { period: '30d' as const, page: 1, sort: 'desc' as const, groupId: 'group-a' };

    controller.schedule(query);
    controller.flush(query);
    controller.schedule({ ...query, groupId: 'group-b' });
    controller.dispose();
    vi.runAllTimers();

    expect(calls).toEqual([query]);
  });
});
