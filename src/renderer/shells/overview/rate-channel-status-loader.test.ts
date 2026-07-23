import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ChannelDetailPayload,
  ChannelViewPayload,
} from '../../../../electron/shared/contracts';
import { RateChannelStatusLoader } from './rate-channel-status-loader';

afterEach(() => vi.useRealTimers());

const channels = (siteId: string): ChannelViewPayload => ({
  state: 'supported',
  channels: [
    {
      id: `${siteId}-channel`,
      name: `${siteId} 渠道`,
      platform: 'openai',
      groupName: `${siteId} 分组`,
      primaryModel: 'gpt-5',
      extraModels: [],
      status: 'normal',
      availability7d: 99.9,
      timeline: [],
    },
  ],
});

const detail = (channelId: string, availability7d = 99.9): ChannelDetailPayload => ({
  state: 'supported',
  detail: {
    id: channelId,
    name: `${channelId} 详情`,
    platform: 'openai',
    groupName: '测试分组',
    models: [{ model: 'gpt-5', status: 'normal', availability7d }],
  },
});

describe('RateChannelStatusLoader', () => {
  it('deduplicates channel-list and channel-detail requests', async () => {
    const readChannels = vi.fn(async (siteId: string) => channels(siteId));
    const readDetail = vi.fn(async (_siteId: string, channelId: string) => detail(channelId));
    const loader = new RateChannelStatusLoader({ readChannels, readDetail });

    const [firstList, secondList] = await Promise.all([
      loader.loadChannels('site-a'),
      loader.loadChannels('site-a'),
    ]);
    const [firstDetail, secondDetail] = await Promise.all([
      loader.loadDetail('site-a', 'site-a-channel'),
      loader.loadDetail('site-a', 'site-a-channel'),
    ]);

    expect(firstList).toBe(secondList);
    expect(firstDetail).toBe(secondDetail);
    expect(readChannels).toHaveBeenCalledTimes(1);
    expect(readDetail).toHaveBeenCalledTimes(1);
  });

  it('limits channel-detail concurrency to four and isolates a failed channel', async () => {
    let active = 0;
    let maximum = 0;
    const readDetail = vi.fn(async (_siteId: string, channelId: string) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      if (channelId === 'channel-2') throw new Error('detail failed');
      return detail(channelId);
    });
    const loader = new RateChannelStatusLoader({
      readChannels: async (siteId) => channels(siteId),
      readDetail,
    });

    const results = await Promise.allSettled(
      Array.from({ length: 7 }, (_, index) => loader.loadDetail('site-a', `channel-${index}`)),
    );

    expect(maximum).toBe(4);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(6);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('force-retries a failed detail and keeps the successful value in cache', async () => {
    const readDetail = vi
      .fn<(siteId: string, channelId: string) => Promise<ChannelDetailPayload>>()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(detail('channel-a', 98.5));
    const loader = new RateChannelStatusLoader({
      readChannels: async (siteId) => channels(siteId),
      readDetail,
    });

    await expect(loader.loadDetail('site-a', 'channel-a')).rejects.toThrow('temporary failure');
    await expect(loader.loadDetail('site-a', 'channel-a', true)).resolves.toEqual(
      detail('channel-a', 98.5),
    );
    await expect(loader.loadDetail('site-a', 'channel-a')).resolves.toEqual(
      detail('channel-a', 98.5),
    );
    expect(readDetail).toHaveBeenCalledTimes(2);
  });

  it('accepts existing popover cache without another network request', async () => {
    const readChannels = vi.fn(async (siteId: string) => channels(siteId));
    const readDetail = vi.fn(async (_siteId: string, channelId: string) => detail(channelId));
    const loader = new RateChannelStatusLoader({ readChannels, readDetail });
    loader.seed('site-a', {
      channels: channels('site-a'),
      details: { 'site-a-channel': detail('site-a-channel') },
    });

    await expect(loader.loadChannels('site-a')).resolves.toEqual(channels('site-a'));
    await expect(loader.loadDetail('site-a', 'site-a-channel')).resolves.toEqual(
      detail('site-a-channel'),
    );
    expect(readChannels).not.toHaveBeenCalled();
    expect(readDetail).not.toHaveBeenCalled();
  });

  it('does not let an older detail response replace a forced refresh', async () => {
    let resolveOlder!: (value: ChannelDetailPayload) => void;
    let resolveNewer!: (value: ChannelDetailPayload) => void;
    const readDetail = vi
      .fn<(siteId: string, channelId: string) => Promise<ChannelDetailPayload>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOlder = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNewer = resolve;
          }),
      );
    const loader = new RateChannelStatusLoader({
      readChannels: async (siteId) => channels(siteId),
      readDetail,
    });

    const older = loader.loadDetail('site-a', 'channel-a');
    const newer = loader.loadDetail('site-a', 'channel-a', true);
    resolveNewer(detail('channel-a', 99.5));
    await newer;
    resolveOlder(detail('channel-a', 75));
    await older;

    expect(loader.cacheForSite('site-a').details['channel-a']).toEqual(detail('channel-a', 99.5));
  });

  it('keeps cached channels and suppresses forced polling during rate-limit backoff', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-24T00:00:00Z'));
    const readChannels = vi
      .fn<(siteId: string) => Promise<ChannelViewPayload>>()
      .mockResolvedValueOnce(channels('site-a'))
      .mockRejectedValueOnce(new Error('CHANNEL_REFRESH_FAILED RETRY_AFTER=600'))
      .mockResolvedValueOnce(channels('site-a'));
    const loader = new RateChannelStatusLoader({
      readChannels,
      readDetail: async (_siteId, channelId) => detail(channelId),
    });

    await loader.loadChannels('site-a');
    await expect(loader.loadChannels('site-a', true)).rejects.toThrow('RETRY_AFTER=600');
    await expect(loader.loadChannels('site-a', true)).resolves.toEqual(channels('site-a'));
    expect(readChannels).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(600_000);
    await loader.loadChannels('site-a', true);
    expect(readChannels).toHaveBeenCalledTimes(3);
  });
});
