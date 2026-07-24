import { normalizeApiKey, upstreamApiKeySchema } from './schemas.js';
import type { ApiKeySummary } from '../domain/types.js';
import type {
  ApiKeyBatchUsage,
  ApiKeyDailyUsage,
  ApiKeyGroup,
  ApiKeyListPayload,
  ManagedApiKey,
  UsageStats,
  AvailableRateGroup,
} from '../../shared/contracts.js';

interface JsonClient {
  getJson(path: string, accessToken: string, capability: string): Promise<unknown>;
  postJson?(path: string, accessToken: string, capability: string, body: unknown): Promise<unknown>;
  putJson?(path: string, accessToken: string, capability: string, body: unknown): Promise<unknown>;
}

export interface NormalizedUsageToday {
  totalRequests: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalActualCost: number;
  totalCost: number;
  averageDurationMs: number;
}

export interface NormalizedUsageRecord {
  id: string;
  createdAt: string;
  apiKeyId?: string;
  apiKeyLabel: string;
  model: string;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  groupId?: string;
  groupName: string;
  requestType: string;
  billingType?: string;
  billingMode?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  totalTokens?: number;
  actualCost?: number;
  totalCost?: number;
  firstTokenMs?: number;
  durationMs?: number;
}

export interface NormalizedUsagePayload {
  items: NormalizedUsageRecord[];
  page: number;
  pageSize: number;
  pages: number;
  total: number;
}

export type NormalizedChannelStatus = 'normal' | 'degraded' | 'failed' | 'unknown';

export interface NormalizedChannelSummary {
  id: string;
  name: string;
  platform: string;
  groupName: string;
  primaryModel: string;
  extraModels: string[];
  status: NormalizedChannelStatus;
  latencyMs?: number;
  pingMs?: number;
  availability7d?: number;
  timeline: Array<{
    status: NormalizedChannelStatus;
    latencyMs?: number;
    pingMs?: number;
    checkedAt?: string;
  }>;
}

export interface NormalizedAvailableChannel {
  name: string;
  platforms: Array<{
    platform: string;
    groupIds: string[];
    groupNames: string[];
    modelNames: string[];
  }>;
}

export interface NormalizedChannelDetail {
  id: string;
  name: string;
  platform: string;
  groupName: string;
  models: Array<{
    model: string;
    status: NormalizedChannelStatus;
    latestLatencyMs?: number;
    availability7d?: number;
    availability15d?: number;
    availability30d?: number;
    averageLatency7dMs?: number;
  }>;
}

export class Sub2ApiAdapter {
  constructor(
    private readonly client: JsonClient,
    private readonly pause: () => Promise<void> = () =>
      new Promise((resolve) => setTimeout(resolve, 100 + Math.floor(Math.random() * 401))),
    private readonly onPhase: (
      phase: 'profile' | 'keys' | 'groups' | 'rates' | 'usage',
    ) => void = () => undefined,
    private readonly onKeys: (keys: ApiKeySummary[]) => void = () => undefined,
  ) {}

  async readCore(accessToken: string, timezone: string) {
    this.onPhase('profile');
    const profileRaw = await this.client.getJson('/user/profile', accessToken, 'profile');
    await this.pause();
    this.onPhase('keys');
    const keysRaw = await this.readAllKeys(accessToken, timezone);
    const keyRecords = asArray(unwrapPayload(keysRaw)).map((item) => asRecord(item));
    const keys = keyRecords.map((item) => normalizeApiKey(item));
    this.onKeys(keys);
    await this.pause();
    this.onPhase('groups');
    const groupsRaw = await this.client.getJson('/groups/available', accessToken, 'groups');
    await this.pause();
    this.onPhase('rates');
    const ratesRaw = await this.client.getJson('/groups/rates', accessToken, 'groupRates');
    await this.pause();
    this.onPhase('usage');
    const usageRaw = await this.client.getJson(
      `/usage/stats?period=today&timezone=${encodeURIComponent(timezone)}`,
      accessToken,
      'usageStats',
    );
    const profile = asRecord(unwrapPayload(profileRaw));
    const groups = asArray(unwrapPayload(groupsRaw)).map((item) => asRecord(item));
    const rateMap = asRecord(unwrapPayload(ratesRaw));
    const rates = new Map<string, number | undefined>();
    for (const key of keyRecords) {
      const group = asRecord(key.group);
      const id = String(key.group_id ?? group.id ?? '');
      if (id) rates.set(id, numberOrUndefined(group.rate_multiplier));
    }
    for (const group of groups) {
      const id = String(group.group_id ?? group.id ?? '');
      const custom = numberOrUndefined(rateMap[id]);
      const embedded = rates.get(id);
      const defaultRate = numberOrUndefined(
        group.rate_multiplier ?? group.ratio ?? group.rate ?? group.default_ratio,
      );
      rates.set(id, custom ?? embedded ?? defaultRate);
    }
    for (const [id, value] of Object.entries(rateMap))
      rates.set(id, numberOrUndefined(value) ?? rates.get(id));
    return {
      profile: {
        balance: numberOrUndefined(profile.balance) ?? 0,
        status: String(profile.status ?? 'unknown'),
      },
      keys,
      rates,
      usage: normalizeUsage(asRecord(unwrapPayload(usageRaw))),
    };
  }

  async readOptionalChannels(accessToken: string) {
    try {
      const [raw, availableRaw] = await Promise.all([
        this.client.getJson('/channel-monitors', accessToken, 'channelMonitors'),
        this.client
          .getJson('/channels/available', accessToken, 'availableChannels')
          .catch(() => undefined),
      ]);
      const availableChannels = normalizeAvailableChannels(availableRaw);
      return {
        state: 'supported' as const,
        channels: asArray(unwrapPayload(raw)).map((item) =>
          normalizeChannelSummary(asRecord(item)),
        ),
        ...(availableChannels.length ? { availableChannels } : {}),
      };
    } catch (error) {
      if (isUnsupported(error)) return { state: 'unsupported' as const, channels: [] };
      throw error;
    }
  }

  private async readAllKeys(accessToken: string, timezone: string): Promise<unknown[]> {
    const items: unknown[] = [];
    let page = 1;
    let pages: number | undefined;
    do {
      const raw = await this.client.getJson(
        page === 1
          ? '/keys'
          : `/keys?page=${page}&page_size=100&sort_by=created_at&sort_order=desc&timezone=${encodeURIComponent(timezone)}`,
        accessToken,
        'keys',
      );
      const payload = unwrapPayload(raw);
      const record = asRecord(payload);
      const pageItems = asArray(payload);
      items.push(...pageItems);
      pages = Math.max(1, numberOrUndefined(record.pages) ?? 1);
      page += 1;
    } while (page <= (pages ?? 1) && page <= 100);
    return items;
  }

  async readApiKeyPage(
    accessToken: string,
    query: {
      page: number;
      pageSize: number;
      search?: string;
      groupId?: string;
      status?: string;
    },
  ): Promise<ApiKeyListPayload> {
    const params = new URLSearchParams();
    params.set('page', String(query.page));
    params.set('page_size', String(query.pageSize));
    if (query.search) params.set('search', query.search);
    if (query.groupId) params.set('group_id', query.groupId);
    if (query.status) params.set('status', query.status === 'disabled' ? 'inactive' : query.status);
    params.set('sort_by', 'created_at');
    params.set('sort_order', 'desc');
    const raw = await this.client.getJson(`/keys?${params.toString()}`, accessToken, 'keys');
    return normalizeApiKeyPage(unwrapPayload(raw), query.page, query.pageSize);
  }

  async readApiKeyDetail(accessToken: string, keyId: string): Promise<ManagedApiKey> {
    assertNumericId(keyId, 'API key');
    const raw = await this.client.getJson(
      `/keys/${encodeURIComponent(keyId)}`,
      accessToken,
      'apiKeyDetail',
    );
    return normalizeManagedApiKey(asRecord(unwrapPayload(raw)));
  }

  async updateApiKeyGroup(accessToken: string, keyId: string, groupId: string) {
    assertNumericId(keyId, 'API key');
    assertNumericId(groupId, 'group');
    const putJson = requireJsonMethod(this.client.putJson, 'PUT');
    const raw = await putJson.call(
      this.client,
      `/keys/${encodeURIComponent(keyId)}`,
      accessToken,
      'apiKeyUpdate',
      { group_id: Number(groupId) },
    );
    const record = asRecord(unwrapPayload(raw));
    return record.id === undefined ? undefined : normalizeManagedApiKey(record);
  }

  async readApiKeyGroups(accessToken: string): Promise<ApiKeyGroup[]> {
    const [groupsRaw, ratesRaw] = await Promise.all([
      this.client.getJson('/groups/available', accessToken, 'groups'),
      this.client.getJson('/groups/rates', accessToken, 'groupRates').catch(() => ({})),
    ]);
    const rates = normalizeGroupRates(ratesRaw);
    return asArray(unwrapPayload(groupsRaw)).flatMap((group) => {
      const id = stringOrUndefined(group.id ?? group.group_id);
      const name = stringOrUndefined(group.name ?? group.group_name);
      if (!id || !name || !isSafeNumericId(id)) return [];
      const defaultRate = numberOrUndefined(
        group.rate_multiplier ?? group.ratio ?? group.rate ?? group.default_ratio,
      );
      const platform = stringOrUndefined(group.platform);
      const status = stringOrUndefined(group.status);
      const subscriptionType = stringOrUndefined(group.subscription_type);
      return [
        {
          id,
          name,
          ...(platform ? { platform } : {}),
          ...(status ? { status } : {}),
          ...(defaultRate !== undefined && defaultRate >= 0 ? { defaultRate } : {}),
          ...(rates[id] !== undefined
            ? { effectiveRate: rates[id] }
            : defaultRate !== undefined && defaultRate >= 0
              ? { effectiveRate: defaultRate }
              : {}),
          ...(subscriptionType ? { subscriptionType } : {}),
        },
      ];
    });
  }

  async readApiKeyGroupRates(accessToken: string): Promise<Record<string, number>> {
    return normalizeGroupRates(
      await this.client.getJson('/groups/rates', accessToken, 'groupRates'),
    );
  }

  async readBatchApiKeyUsage(accessToken: string, keyIds: string[]): Promise<ApiKeyBatchUsage> {
    const normalizedIds = [...new Set(keyIds)];
    normalizedIds.forEach((id) => assertNumericId(id, 'API key'));
    const postJson = requireJsonMethod(this.client.postJson, 'POST');
    const result: ApiKeyBatchUsage = {};
    for (let start = 0; start < normalizedIds.length; start += 100) {
      const batch = normalizedIds.slice(start, start + 100);
      const raw = await postJson.call(
        this.client,
        '/usage/dashboard/api-keys-usage',
        accessToken,
        'apiKeyBatchUsage',
        { api_key_ids: batch.map(Number) },
      );
      const stats = asRecord(asRecord(unwrapPayload(raw)).stats);
      for (const value of Object.values(stats)) {
        const item = asRecord(value);
        const apiKeyId = stringOrUndefined(item.api_key_id);
        if (!apiKeyId || !isSafeNumericId(apiKeyId)) continue;
        const todayActualCost = nonnegativeNumberOrUndefined(item.today_actual_cost);
        const totalActualCost = nonnegativeNumberOrUndefined(item.total_actual_cost);
        result[apiKeyId] = {
          apiKeyId,
          ...(todayActualCost !== undefined ? { todayActualCost } : {}),
          ...(totalActualCost !== undefined ? { totalActualCost } : {}),
        };
      }
    }
    return result;
  }

  async readApiKeyDailyUsage(
    accessToken: string,
    keyId: string,
    timezone: string,
  ): Promise<ApiKeyDailyUsage> {
    assertNumericId(keyId, 'API key');
    const raw = await this.client.getJson(
      `/user/api-keys/${encodeURIComponent(keyId)}/usage/daily?days=30&timezone=${encodeURIComponent(timezone)}`,
      accessToken,
      'apiKeyDailyUsage',
    );
    const days = asArray(asRecord(unwrapPayload(raw)).items).flatMap((item) => {
      const date = stringOrUndefined(item.date);
      if (!date) return [];
      const actualCost = nonnegativeNumberOrUndefined(item.actual_cost);
      return [{ date, ...(actualCost !== undefined ? { actualCost } : {}) }];
    });
    const costs = days.flatMap((day) => (day.actualCost === undefined ? [] : [day.actualCost]));
    return {
      apiKeyId: keyId,
      ...(costs.length ? { actualCost30d: costs.reduce((sum, cost) => sum + cost, 0) } : {}),
      days,
    };
  }

  async readChannelStatus(accessToken: string, channelId: string) {
    try {
      const raw = await this.client.getJson(
        `/channel-monitors/${encodeURIComponent(channelId)}/status`,
        accessToken,
        'channelMonitorStatus',
      );
      return {
        state: 'supported' as const,
        detail: normalizeChannelDetail(asRecord(unwrapPayload(raw))),
      };
    } catch (error) {
      if (isUnsupported(error)) return { state: 'unsupported' as const, detail: undefined };
      throw error;
    }
  }

  async readUsage(accessToken: string, query: Record<string, string | number | undefined>) {
    const params = buildUsageParams(query, true);
    const raw = await this.client.getJson(`/usage?${params.toString()}`, accessToken, 'usageList');
    return normalizeUsagePayload(unwrapPayload(raw));
  }

  async readUsageStats(
    accessToken: string,
    query: Record<string, string | number | undefined>,
  ): Promise<UsageStats> {
    const params = buildUsageParams(query, false);
    const raw = await this.client.getJson(
      `/usage/stats?${params.toString()}`,
      accessToken,
      'usageStats',
    );
    const stats = asRecord(unwrapPayload(raw));
    return {
      totalRequests: nonnegativeNumberOrUndefined(stats.total_requests) ?? 0,
      totalTokens: nonnegativeNumberOrUndefined(stats.total_tokens) ?? 0,
      totalInputTokens: nonnegativeNumberOrUndefined(stats.total_input_tokens) ?? 0,
      totalOutputTokens: nonnegativeNumberOrUndefined(stats.total_output_tokens) ?? 0,
      totalCacheReadTokens: nonnegativeNumberOrUndefined(stats.total_cache_read_tokens) ?? 0,
      totalCacheCreationTokens:
        nonnegativeNumberOrUndefined(stats.total_cache_creation_tokens) ?? 0,
      totalActualCost: nonnegativeNumberOrUndefined(stats.total_actual_cost) ?? 0,
      totalCost: nonnegativeNumberOrUndefined(stats.total_cost) ?? 0,
      averageDurationMs: nonnegativeNumberOrUndefined(stats.average_duration_ms) ?? 0,
    };
  }

  async readUsageFilters(accessToken: string, timezone: string) {
    const [groups, models, ratesRaw] = await Promise.all([
      this.readUsageGroups(accessToken),
      this.readUsageModels(accessToken, timezone),
      this.client.getJson('/groups/rates', accessToken, 'groupRates').catch(() => ({})),
    ]);
    const rateMap = asRecord(unwrapPayload(ratesRaw));
    const groupsWithRates = groups.map((group) => ({
      ...group,
      rate: numberOrUndefined(rateMap[group.id] ?? group.rate),
    }));
    return { models, groups: groupsWithRates };
  }

  async readUsageGroups(accessToken: string) {
    const groupsRaw = await this.client.getJson('/groups/available', accessToken, 'groups');
    return asArray(unwrapPayload(groupsRaw)).flatMap((item) => {
      const id = stringOrUndefined(item.id ?? item.group_id);
      const name = stringOrUndefined(item.name ?? item.group_name);
      const rate = numberOrUndefined(item.rate_multiplier ?? item.ratio ?? item.rate);
      return id && name ? [{ id, name, rate }] : [];
    });
  }

  async readAvailableRateGroups(
    accessToken: string,
    timezone: string,
  ): Promise<AvailableRateGroup[]> {
    const raw = await this.client.getJson(
      `/groups/available?timezone=${encodeURIComponent(timezone)}`,
      accessToken,
      'groups',
    );
    return asArray(unwrapPayload(raw)).flatMap((item) => {
      const id = stringOrUndefined(item.id ?? item.group_id);
      const name = stringOrUndefined(item.name ?? item.group_name);
      const rate = numberOrUndefined(
        item.rate_multiplier ?? item.ratio ?? item.rate ?? item.default_ratio,
      );
      if (!id || !name || rate === undefined || rate < 0) return [];
      const description = stringOrUndefined(item.description);
      const platform = stringOrUndefined(item.platform) ?? 'unknown';
      const status = stringOrUndefined(item.status);
      return [
        {
          id,
          name,
          ...(description ? { description } : {}),
          platform,
          ...(status ? { status } : {}),
          rate,
        },
      ];
    });
  }

  async readUsageModels(accessToken: string, timezone: string) {
    const modelsRaw = await this.client.getJson(
      `/usage/dashboard/models?timezone=${encodeURIComponent(timezone)}`,
      accessToken,
      'usageModels',
    );
    const modelContainer = unwrapPayload(modelsRaw);
    const rawModels = Array.isArray(modelContainer)
      ? modelContainer
      : asRecord(modelContainer).models;
    const models = Array.isArray(rawModels)
      ? rawModels.flatMap((item) => {
          const value =
            typeof item === 'string'
              ? stringOrUndefined(item)
              : stringOrUndefined(asRecord(item).model ?? asRecord(item).name);
          return value ? [value] : [];
        })
      : [];
    return [...new Set(models)];
  }

  async readTodayRequestsByKey(accessToken: string, keys: Array<{ id: string }>, timezone: string) {
    const entries: Array<readonly [string, number]> = [];
    let cursor = 0;
    const worker = async () => {
      while (cursor < keys.length) {
        const key = keys[cursor++];
        if (!key) return;
        const raw = await this.client.getJson(
          `/usage/stats?period=today&timezone=${encodeURIComponent(timezone)}&api_key_id=${encodeURIComponent(key.id)}`,
          accessToken,
          'usageStats',
        );
        const stats = asRecord(unwrapPayload(raw));
        entries.push([key.id, numberOrUndefined(stats.total_requests) ?? 0] as const);
        await this.pause();
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, keys.length) }, worker));
    return Object.fromEntries(entries);
  }
}

function normalizeAvailableChannels(value: unknown): NormalizedAvailableChannel[] {
  return asArray(unwrapPayload(value)).flatMap((entry) => {
    const channel = asRecord(entry);
    const name = stringOrUndefined(channel.name ?? channel.channel_name);
    if (!name || !Array.isArray(channel.platforms)) return [];
    const platforms = channel.platforms.flatMap((platformEntry) => {
      const section = asRecord(platformEntry);
      const platform = stringOrUndefined(section.platform);
      if (!platform) return [];
      return [
        {
          platform,
          groupIds: asArray(section.groups).flatMap((groupEntry) => {
            const group = asRecord(groupEntry);
            const groupId = stringOrUndefined(group.id ?? group.group_id);
            return groupId && isSafeNumericId(groupId) ? [groupId] : [];
          }),
          groupNames: asArray(section.groups).flatMap((groupEntry) => {
            const group = asRecord(groupEntry);
            const groupName = stringOrUndefined(group.name ?? group.group_name);
            return groupName ? [groupName] : [];
          }),
          modelNames: asArray(section.supported_models).flatMap((modelEntry) => {
            const model = asRecord(modelEntry);
            const modelName = stringOrUndefined(model.name ?? model.model);
            return modelName ? [modelName] : [];
          }),
        },
      ];
    });
    return platforms.length ? [{ name, platforms }] : [];
  });
}

function normalizeApiKeyPage(
  value: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
): ApiKeyListPayload {
  const container = asRecord(value);
  const items = asArray(value).map(normalizeManagedApiKey);
  return {
    items,
    page: Math.max(1, Math.trunc(numberOrUndefined(container.page) ?? fallbackPage)),
    pageSize: Math.max(
      0,
      Math.trunc(numberOrUndefined(container.page_size ?? container.pageSize) ?? fallbackPageSize),
    ),
    pages: Math.max(0, Math.trunc(numberOrUndefined(container.pages) ?? (items.length ? 1 : 0))),
    total: Math.max(0, Math.trunc(numberOrUndefined(container.total) ?? items.length)),
  };
}

function normalizeManagedApiKey(value: unknown): ManagedApiKey {
  const parsed = upstreamApiKeySchema.parse(value);
  const group = asRecord(parsed.group);
  const id = String(parsed.id);
  assertNumericId(id, 'API key');
  const rawKey = parsed.key ?? '';
  const groupId = stringOrUndefined(parsed.group_id ?? group.id);
  const quota = nonnegativeNumberOrUndefined(parsed.quota);
  const quotaUsed = nonnegativeNumberOrUndefined(parsed.quota_used);
  const expiresAt = stringOrUndefined(parsed.expires_at);
  const embeddedRate = nonnegativeNumberOrUndefined(group.rate_multiplier);
  const rawStatus = String(parsed.status ?? '').toLowerCase();
  const expiredAt = Date.parse(expiresAt ?? '');
  const status: ManagedApiKey['status'] =
    Number.isFinite(expiredAt) && expiredAt <= Date.now()
      ? 'expired'
      : quota !== undefined && quota > 0 && quotaUsed !== undefined && quotaUsed >= quota
        ? 'quota-exhausted'
        : rawStatus === 'active' || rawStatus === 'enabled'
          ? 'active'
          : rawStatus === 'inactive' || rawStatus === 'disabled'
            ? 'disabled'
            : 'unknown';
  return {
    id,
    name: (parsed.name?.trim() || '未命名 Key').slice(0, 200),
    maskedLabel: `sk-xxx...${(rawKey ? rawKey.slice(-4) : id.slice(-4)).padStart(4, 'x')}`,
    ...(rawKey ? { apiKey: rawKey } : {}),
    status,
    ...(groupId && isSafeNumericId(groupId) ? { groupId } : {}),
    ...(stringOrUndefined(group.name) ? { groupName: stringOrUndefined(group.name) } : {}),
    ...(stringOrUndefined(group.platform) ? { platform: stringOrUndefined(group.platform) } : {}),
    ...(embeddedRate !== undefined ? { effectiveRate: embeddedRate } : {}),
    ...(stringOrUndefined(group.subscription_type)
      ? { subscriptionType: stringOrUndefined(group.subscription_type) }
      : {}),
    ...(nonnegativeNumberOrUndefined(parsed.current_concurrency) !== undefined
      ? { currentConcurrency: nonnegativeNumberOrUndefined(parsed.current_concurrency) }
      : {}),
    ...(quota !== undefined ? { quota } : {}),
    ...(quotaUsed !== undefined ? { quotaUsed } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(stringOrUndefined(parsed.created_at) ? { createdAt: parsed.created_at } : {}),
  };
}

function normalizeGroupRates(value: unknown): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const [id, rawRate] of Object.entries(asRecord(unwrapPayload(value)))) {
    const rate = nonnegativeNumberOrUndefined(rawRate);
    if (isSafeNumericId(id) && rate !== undefined) rates[id] = rate;
  }
  return rates;
}

const usageFilterKeys = [
  'api_key_id',
  'model',
  'group_id',
  'request_type',
  'billing_type',
  'billing_mode',
  'start_date',
  'end_date',
  'period',
  'timezone',
] as const;

function buildUsageParams(
  query: Record<string, string | number | undefined>,
  includePagination: boolean,
): URLSearchParams {
  const params = new URLSearchParams();
  if (includePagination) {
    for (const key of ['page', 'page_size', 'sort_by', 'sort_order'] as const) {
      const value = query[key];
      if (value !== undefined) params.set(key, String(value));
    }
  }
  for (const key of usageFilterKeys) {
    const value = query[key];
    if (value !== undefined && String(value).trim()) params.set(key, String(value));
  }
  return params;
}

function assertNumericId(value: string, label: string): void {
  if (!isSafeNumericId(value)) throw new Error(`Invalid ${label} ID`);
}

function isSafeNumericId(value: string): boolean {
  return (
    /^\d+$/.test(value) &&
    value.length <= 128 &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0
  );
}

function requireJsonMethod<T extends (...args: never[]) => Promise<unknown>>(
  method: T | undefined,
  verb: string,
): T {
  if (!method) throw new Error(`${verb} JSON is not supported by this client`);
  return method;
}

function normalizeChannelSummary(input: Record<string, unknown>): NormalizedChannelSummary {
  return {
    id: String(input.id ?? input.monitor_id ?? ''),
    name: String(input.name ?? input.channel_name ?? ''),
    platform: String(input.provider ?? input.platform ?? ''),
    groupName: String(input.group_name ?? ''),
    primaryModel: String(input.primary_model ?? ''),
    extraModels: Array.isArray(input.extra_models)
      ? input.extra_models.map((item) => String(item))
      : [],
    status: normalizeChannelStatus(input.primary_status ?? input.status),
    latencyMs: numberOrUndefined(input.primary_latency_ms ?? input.latency_ms),
    pingMs: numberOrUndefined(input.primary_ping_latency_ms ?? input.ping_latency_ms),
    availability7d: numberOrUndefined(input.availability_7d),
    timeline: Array.isArray(input.timeline)
      ? input.timeline
          .map((entry) => {
            const point = asRecord(entry);
            return {
              status: normalizeChannelStatus(point.status),
              latencyMs: numberOrUndefined(point.latency_ms),
              pingMs: numberOrUndefined(point.ping_latency_ms),
              checkedAt: stringOrUndefined(point.checked_at),
            };
          })
          .sort((a, b) => timelineTime(a.checkedAt) - timelineTime(b.checkedAt))
      : [],
  };
}

function timelineTime(value?: string): number {
  const parsed = Date.parse(value ?? '');
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function normalizeChannelDetail(input: Record<string, unknown>): NormalizedChannelDetail {
  return {
    id: String(input.id ?? input.monitor_id ?? ''),
    name: String(input.name ?? input.channel_name ?? ''),
    platform: String(input.provider ?? input.platform ?? ''),
    groupName: String(input.group_name ?? ''),
    models: Array.isArray(input.models)
      ? input.models.map((entry) => {
          const model = asRecord(entry);
          return {
            model: String(model.model ?? ''),
            status: normalizeChannelStatus(model.latest_status ?? model.status),
            latestLatencyMs: numberOrUndefined(model.latest_latency_ms),
            availability7d: numberOrUndefined(model.availability_7d),
            availability15d: numberOrUndefined(model.availability_15d),
            availability30d: numberOrUndefined(model.availability_30d),
            averageLatency7dMs: numberOrUndefined(model.avg_latency_7d_ms),
          };
        })
      : [],
  };
}

function normalizeChannelStatus(value: unknown): NormalizedChannelStatus {
  const status = String(value ?? '').toLowerCase();
  if (['operational', 'normal', 'healthy', 'success', 'ok'].includes(status)) return 'normal';
  if (['degraded', 'warning', 'partial'].includes(status)) return 'degraded';
  if (['failed', 'error', 'down', 'unavailable'].includes(status)) return 'failed';
  return 'unknown';
}

function normalizeUsagePayload(value: unknown): NormalizedUsagePayload {
  const container = asRecord(value);
  const rows = Array.isArray(value) ? value.map(asRecord) : asArray(container);
  return {
    items: rows.map(normalizeUsageRecord),
    page: numberOrUndefined(container.page) ?? 1,
    pageSize: numberOrUndefined(container.page_size ?? container.pageSize) ?? rows.length,
    pages: numberOrUndefined(container.pages) ?? 1,
    total: numberOrUndefined(container.total) ?? rows.length,
  };
}

function normalizeUsageRecord(input: Record<string, unknown>): NormalizedUsageRecord {
  const apiKey = asRecord(input.api_key);
  const group = asRecord(input.group);
  const apiKeyId = stringOrUndefined(input.api_key_id ?? apiKey.id);
  const inputTokens = numberOrUndefined(input.input_tokens);
  const outputTokens = numberOrUndefined(input.output_tokens);
  const cacheReadTokens = numberOrUndefined(input.cache_read_tokens);
  const cacheCreationTokens = numberOrUndefined(input.cache_creation_tokens);
  const imageOutputTokens = numberOrUndefined(input.image_output_tokens);
  const componentTokens = [
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    imageOutputTokens,
  ];
  const totalTokens =
    numberOrUndefined(input.total_tokens) ??
    (componentTokens.some((value) => value !== undefined)
      ? componentTokens.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : undefined);
  return {
    id: String(input.id ?? input.request_id ?? ''),
    createdAt: String(input.created_at ?? input.time ?? ''),
    apiKeyId,
    apiKeyLabel:
      stringOrUndefined(input.api_key_name ?? apiKey.name) ??
      (apiKeyId ? `Key · ${apiKeyId.slice(-4)}` : 'Key · 已脱敏'),
    model: String(input.model ?? ''),
    reasoningEffort: normalizeReasoningEffort(input.reasoning_effort),
    groupId: stringOrUndefined(input.group_id ?? group.id),
    groupName: stringOrUndefined(input.group_name ?? group.name) ?? '未分组',
    requestType: String(input.request_type ?? 'unknown'),
    billingType: stringOrUndefined(input.billing_type),
    billingMode: stringOrUndefined(input.billing_mode),
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    totalTokens,
    actualCost: numberOrUndefined(input.actual_cost ?? input.cost),
    totalCost: numberOrUndefined(input.total_cost),
    firstTokenMs: numberOrUndefined(input.first_token_ms),
    durationMs: numberOrUndefined(input.duration_ms),
  };
}

function normalizeReasoningEffort(
  value: unknown,
): 'low' | 'medium' | 'high' | 'xhigh' | 'max' | undefined {
  const normalized = String(value ?? '').toLowerCase();
  return ['low', 'medium', 'high', 'xhigh', 'max'].includes(normalized)
    ? (normalized as 'low' | 'medium' | 'high' | 'xhigh' | 'max')
    : undefined;
}

function normalizeUsage(input: Record<string, unknown>): NormalizedUsageToday {
  return {
    totalRequests: numberOrUndefined(input.total_requests) ?? 0,
    totalTokens: numberOrUndefined(input.total_tokens) ?? 0,
    totalInputTokens: numberOrUndefined(input.total_input_tokens) ?? 0,
    totalOutputTokens: numberOrUndefined(input.total_output_tokens) ?? 0,
    totalCacheReadTokens:
      numberOrUndefined(input.total_cache_read_tokens ?? input.total_cache_tokens) ?? 0,
    totalCacheCreationTokens: numberOrUndefined(input.total_cache_creation_tokens) ?? 0,
    totalActualCost: numberOrUndefined(input.total_actual_cost) ?? 0,
    totalCost: numberOrUndefined(input.total_cost) ?? 0,
    averageDurationMs: numberOrUndefined(input.average_duration_ms) ?? 0,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map(asRecord);
  const record = asRecord(value);
  const list = record.items ?? record.results ?? record.data;
  return Array.isArray(list) ? list.map(asRecord) : [];
}

function unwrapPayload(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 3; depth += 1) {
    const record = asRecord(current);
    if (!('data' in record) || record.data === undefined) break;
    current = record.data;
  }
  return current;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'string' && value.trim() && Number.isFinite(Number(value))
      ? Number(value)
      : undefined;
}

function nonnegativeNumberOrUndefined(value: unknown): number | undefined {
  const number = numberOrUndefined(value);
  return number !== undefined && number >= 0 ? number : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function isUnsupported(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'UNSUPPORTED_CAPABILITY'
  );
}

export type { ApiKeySummary };
