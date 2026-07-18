import { normalizeApiKey } from './schemas.js';
import type { ApiKeySummary } from '../domain/types.js';

interface JsonClient {
  getJson(path: string, accessToken: string, capability: string): Promise<unknown>;
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
  ) {}

  async readCore(accessToken: string, timezone: string) {
    this.onPhase('profile');
    const profileRaw = await this.client.getJson('/user/profile', accessToken, 'profile');
    await this.pause();
    this.onPhase('keys');
    const keysRaw = await this.client.getJson('/keys', accessToken, 'keys');
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
    const keyRecords = asArray(unwrapPayload(keysRaw)).map((item) => asRecord(item));
    const keys = keyRecords.map((item) => normalizeApiKey(item));
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
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    const raw = await this.client.getJson(`/usage?${params.toString()}`, accessToken, 'usageList');
    return normalizeUsagePayload(unwrapPayload(raw));
  }

  async readUsageFilters(accessToken: string, timezone: string) {
    const [groupsRaw, modelsRaw, ratesRaw] = await Promise.all([
      this.client.getJson('/groups/available', accessToken, 'groups'),
      this.client.getJson(
        `/usage/dashboard/models?timezone=${encodeURIComponent(timezone)}`,
        accessToken,
        'usageModels',
      ),
      this.client.getJson('/groups/rates', accessToken, 'groupRates').catch(() => ({})),
    ]);
    const rateMap = asRecord(unwrapPayload(ratesRaw));
    const groups = asArray(unwrapPayload(groupsRaw)).flatMap((item) => {
      const id = stringOrUndefined(item.id ?? item.group_id);
      const name = stringOrUndefined(item.name ?? item.group_name);
      const rate = id
        ? numberOrUndefined(rateMap[id] ?? item.rate_multiplier ?? item.ratio ?? item.rate)
        : undefined;
      return id && name ? [{ id, name, rate }] : [];
    });
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
    return { models: [...new Set(models)], groups };
  }

  async readTodayRequestsByKey(accessToken: string, keys: Array<{ id: string }>, timezone: string) {
    const entries: Array<readonly [string, number]> = [];
    for (const key of keys) {
      const raw = await this.client.getJson(
        `/usage/stats?period=today&timezone=${encodeURIComponent(timezone)}&api_key_id=${encodeURIComponent(key.id)}`,
        accessToken,
        'usageStats',
      );
      const stats = asRecord(unwrapPayload(raw));
      entries.push([key.id, numberOrUndefined(stats.total_requests) ?? 0] as const);
      await this.pause();
    }
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
