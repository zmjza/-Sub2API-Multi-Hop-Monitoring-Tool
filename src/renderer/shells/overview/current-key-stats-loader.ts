import type { AvailableCredit, CurrentKeyStatsState } from './current-key-stats';

interface CurrentKeyStatsInput {
  siteId: string;
  keyId?: string;
  availableCredit: AvailableCredit;
}

interface UsageStatsResult {
  totalRequests: number;
  totalTokens: number;
  totalActualCost: number;
}

interface LoaderOptions {
  concurrency?: number;
  ttlMs?: number;
  now?: () => number;
}

export class CurrentKeyStatsLoader {
  private readonly cache = new Map<string, { value: CurrentKeyStatsState; fetchedAt: number }>();
  private readonly concurrency: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(
    private readonly fetchStats: (siteId: string, keyId: string) => Promise<UsageStatsResult>,
    options: LoaderOptions = {},
  ) {
    this.concurrency = Math.max(1, Math.floor(options.concurrency ?? 2));
    this.ttlMs = Math.max(0, options.ttlMs ?? 60_000);
    this.now = options.now ?? Date.now;
  }

  async load(inputs: CurrentKeyStatsInput[], force = false) {
    const result: Record<string, CurrentKeyStatsState> = {};
    let cursor = 0;
    const worker = async () => {
      while (cursor < inputs.length) {
        const input = inputs[cursor++];
        if (!input) return;
        if (!input.keyId) {
          result[input.siteId] = { state: 'unknown' };
          continue;
        }
        const cacheKey = `${input.siteId}:${input.keyId}`;
        const cached = this.cache.get(cacheKey);
        if (!force && cached && this.now() - cached.fetchedAt <= this.ttlMs) {
          result[input.siteId] =
            cached.value.state === 'success'
              ? { ...cached.value, availableCredit: input.availableCredit }
              : cached.value;
          continue;
        }
        try {
          const stats = await this.fetchStats(input.siteId, input.keyId);
          const value: CurrentKeyStatsState = {
            state: 'success',
            keyId: input.keyId,
            totalRequests: stats.totalRequests,
            totalTokens: stats.totalTokens,
            totalActualCost: stats.totalActualCost,
            availableCredit: input.availableCredit,
          };
          this.cache.set(cacheKey, { value, fetchedAt: this.now() });
          result[input.siteId] = value;
        } catch {
          result[input.siteId] = { state: 'error', keyId: input.keyId };
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(this.concurrency, Math.max(1, inputs.length)) }, worker),
    );
    return result;
  }
}
