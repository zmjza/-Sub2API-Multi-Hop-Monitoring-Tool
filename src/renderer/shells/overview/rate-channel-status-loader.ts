import type {
  ChannelDetailPayload,
  ChannelViewPayload,
} from '../../../../electron/shared/contracts';

interface ChannelStatusApi {
  readChannels(siteId: string): Promise<ChannelViewPayload>;
  readDetail(siteId: string, channelId: string): Promise<ChannelDetailPayload>;
}

interface SeedCache {
  channels?: ChannelViewPayload;
  details: Record<string, ChannelDetailPayload>;
}

class TaskQueue {
  private active = 0;
  private readonly pending: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit)
      await new Promise<void>((resolve) => {
        this.pending.push(resolve);
      });
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.pending.shift()?.();
    }
  }
}

export class RateChannelStatusLoader {
  private readonly queue: TaskQueue;
  private readonly channelCache = new Map<string, ChannelViewPayload>();
  private readonly detailCache = new Map<string, ChannelDetailPayload>();
  private readonly channelRequests = new Map<string, Promise<ChannelViewPayload>>();
  private readonly detailRequests = new Map<string, Promise<ChannelDetailPayload>>();
  private readonly revisions = new Map<string, number>();

  constructor(
    private readonly api: ChannelStatusApi,
    concurrency = 4,
  ) {
    this.queue = new TaskQueue(Math.max(1, concurrency));
  }

  seed(siteId: string, cache: SeedCache): void {
    this.bumpRevision(`channels:${siteId}`);
    if (cache.channels) this.channelCache.set(siteId, cache.channels);
    for (const [channelId, detail] of Object.entries(cache.details)) {
      this.bumpRevision(this.detailKey(siteId, channelId));
      this.detailCache.set(this.detailKey(siteId, channelId), detail);
    }
  }

  async loadChannels(siteId: string, force = false): Promise<ChannelViewPayload> {
    if (!force) {
      const cached = this.channelCache.get(siteId);
      if (cached) return cached;
      const current = this.channelRequests.get(siteId);
      if (current) return current;
    }
    const revisionKey = `channels:${siteId}`;
    const revision = this.bumpRevision(revisionKey);
    const request = this.queue.run(() => this.api.readChannels(siteId));
    this.channelRequests.set(siteId, request);
    try {
      const value = await request;
      if (this.revisions.get(revisionKey) === revision) this.channelCache.set(siteId, value);
      return value;
    } finally {
      if (this.channelRequests.get(siteId) === request) this.channelRequests.delete(siteId);
    }
  }

  async loadDetail(
    siteId: string,
    channelId: string,
    force = false,
  ): Promise<ChannelDetailPayload> {
    const key = this.detailKey(siteId, channelId);
    if (!force) {
      const cached = this.detailCache.get(key);
      if (cached) return cached;
      const current = this.detailRequests.get(key);
      if (current) return current;
    }
    const revision = this.bumpRevision(key);
    const request = this.queue.run(() => this.api.readDetail(siteId, channelId));
    this.detailRequests.set(key, request);
    try {
      const value = await request;
      if (this.revisions.get(key) === revision) this.detailCache.set(key, value);
      return value;
    } finally {
      if (this.detailRequests.get(key) === request) this.detailRequests.delete(key);
    }
  }

  cacheForSite(siteId: string): SeedCache {
    const details: Record<string, ChannelDetailPayload> = {};
    for (const [key, value] of this.detailCache)
      if (key.startsWith(`${siteId}:`)) details[key.slice(siteId.length + 1)] = value;
    return { channels: this.channelCache.get(siteId), details };
  }

  private detailKey(siteId: string, channelId: string): string {
    return `${siteId}:${channelId}`;
  }

  private bumpRevision(key: string): number {
    const revision = (this.revisions.get(key) ?? 0) + 1;
    this.revisions.set(key, revision);
    return revision;
  }
}

let desktopLoader: RateChannelStatusLoader | undefined;

export function desktopRateChannelStatusLoader(): RateChannelStatusLoader {
  desktopLoader ??= new RateChannelStatusLoader({
    readChannels: async (siteId) => {
      const value = await window.sub2apiDesktop?.sites.channels(siteId);
      if (!value || typeof value !== 'object' || !('state' in value))
        throw new Error('Invalid channel list response');
      return value as ChannelViewPayload;
    },
    readDetail: async (siteId, channelId) => {
      const value = await window.sub2apiDesktop?.sites.channelStatus(siteId, channelId);
      if (!value || typeof value !== 'object' || !('state' in value))
        throw new Error('Invalid channel detail response');
      return value as ChannelDetailPayload;
    },
  });
  return desktopLoader;
}
