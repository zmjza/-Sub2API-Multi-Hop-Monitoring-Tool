import type {
  NormalizedChannelDetail,
  NormalizedChannelStatus,
  NormalizedChannelSummary,
} from './sub2api-adapter.js';

export type V2FailureKind = 'missing' | 'auth' | 'temporary';
export interface V2SnapshotMeta {
  dataThrough?: string;
  coverageComplete?: boolean;
  refreshIntervalSeconds?: number;
  bootstrapActive?: boolean;
  bootstrapProgressPercent?: number;
  successRate?: number;
  cacheRate?: number;
}

export type V2NormalizeResult =
  | {
      ok: true;
      channels: NormalizedChannelSummary[];
      details: Record<string, NormalizedChannelDetail>;
      coveragePartial: boolean;
      dataThrough?: string;
      meta: V2SnapshotMeta;
    }
  | { ok: false };

export function classifyV2Failure(error: unknown): V2FailureKind {
  const record = asRecord(error);
  const status = numberOrUndefined(record?.httpStatus);
  const code = String(record?.code ?? '');
  if (status === 401 || status === 403 || code === 'AUTH_REQUIRED') return 'auth';
  if (
    status === 404 ||
    status === 405 ||
    code === 'UNSUPPORTED_CAPABILITY' ||
    code === 'INCOMPATIBLE_RESPONSE'
  )
    return 'missing';
  return 'temporary';
}

export function normalizeV2Matrix(raw: unknown): V2NormalizeResult {
  const root = asRecord(raw);
  const data = asRecord(root?.data) ?? (Array.isArray(asRecord(root)?.items) ? root : undefined);
  if (!data || !Array.isArray(data.items) || !isV2Contract(data)) return { ok: false };
  const coverage = asRecord(data.coverage);
  const dataThrough = stringOrUndefined(coverage?.data_through);
  const coveragePartial =
    coverage?.coverage_complete === false || asRecord(coverage?.bootstrap)?.active === true;
  const channels: NormalizedChannelSummary[] = [];
  const details: Record<string, NormalizedChannelDetail> = {};
  for (const entry of data.items) {
    const item = asRecord(entry);
    if (!item) continue;
    const id = stringOrUndefined(item.group_id) ?? stringOrUndefined(item.id);
    if (!id) continue;
    const metrics = asRecord(item.metrics) ?? {};
    const health = asRecord(item.health) ?? {};
    const ttft = asRecord(metrics.ttft) ?? {};
    const noTraffic =
      metrics.has_requests === false ||
      (numberOrUndefined(metrics.request_count) === 0 && metrics.has_requests !== true);
    const status = noTraffic ? 'unknown' : mapHealth(health.overall ?? metrics.status);
    const latencyMs =
      numberOrUndefined(ttft.trimmed_avg_ms) ??
      numberOrUndefined(ttft.avg_ms) ??
      numberOrUndefined(asRecord(metrics.duration)?.avg_ms);
    const name = stringOrUndefined(item.group_name) ?? stringOrUndefined(item.name) ?? id;
    const platform = stringOrUndefined(item.platform) ?? '';
    const timeline = normalizeBuckets(item.buckets, dataThrough);
    const successRate = numberOrUndefined(metrics.success_rate);
    const cacheRate = numberOrUndefined(metrics.cache_rate);
    const durationMs = numberOrUndefined(asRecord(metrics.duration)?.avg_ms);
    const v2Buckets = normalizeV2Buckets(item.buckets, dataThrough);
    const channel: NormalizedChannelSummary = {
      id,
      name,
      platform,
      groupName: name,
      primaryModel: '',
      extraModels: [],
      status,
      ...(latencyMs !== undefined ? { latencyMs } : {}),
      ...(successRate !== undefined ? { availability7d: successRate * 100 } : {}),
      timeline,
      v2: {
        ...(cacheRate !== undefined ? { cacheRate } : {}),
        ...(successRate !== undefined ? { successRate } : {}),
        ...(latencyMs !== undefined ? { ttftMs: latencyMs } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
        ...(numberOrUndefined(metrics.request_count) !== undefined
          ? { requestCount: numberOrUndefined(metrics.request_count) }
          : {}),
        coveragePartial,
        ...(dataThrough ? { dataThrough } : {}),
        buckets: v2Buckets,
      },
    };
    channels.push(channel);
    details[id] = {
      id,
      name,
      platform,
      groupName: name,
      models: [
        {
          model: name,
          status,
          ...(latencyMs !== undefined ? { latestLatencyMs: latencyMs } : {}),
        },
      ],
      v2: {
        ...(cacheRate !== undefined ? { cacheRate } : {}),
        ...(successRate !== undefined ? { successRate } : {}),
        ...(latencyMs !== undefined ? { ttftMs: latencyMs } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
        ...(numberOrUndefined(metrics.request_count) !== undefined
          ? { requestCount: numberOrUndefined(metrics.request_count) }
          : {}),
        coveragePartial,
        ...(dataThrough ? { dataThrough } : {}),
        buckets: v2Buckets,
      },
    };
  }
  return {
    ok: true,
    channels,
    details,
    coveragePartial,
    ...(dataThrough ? { dataThrough } : {}),
    meta: normalizeV2SnapshotMeta(data),
  };
}

export function normalizeV2SnapshotMeta(raw: unknown): V2SnapshotMeta {
  const root = asRecord(raw);
  const data = asRecord(root?.data) ?? root ?? {};
  const coverage = asRecord(data.coverage) ?? {};
  const bootstrap = asRecord(coverage.bootstrap) ?? {};
  const trend = Array.isArray(data.trend) ? data.trend : [];
  const latestTrend = [...trend]
    .reverse()
    .map(asRecord)
    .find((entry) => asRecord(entry?.metrics));
  const metrics = asRecord(latestTrend?.metrics) ?? asRecord(data.metrics) ?? {};
  return {
    ...(stringOrUndefined(coverage.data_through)
      ? { dataThrough: stringOrUndefined(coverage.data_through) }
      : {}),
    ...(typeof coverage.coverage_complete === 'boolean'
      ? { coverageComplete: coverage.coverage_complete }
      : {}),
    ...(numberOrUndefined(data.refresh_interval_seconds) !== undefined
      ? { refreshIntervalSeconds: numberOrUndefined(data.refresh_interval_seconds) }
      : {}),
    ...(typeof bootstrap.active === 'boolean' ? { bootstrapActive: bootstrap.active } : {}),
    ...(numberOrUndefined(bootstrap.progress_percent) !== undefined
      ? { bootstrapProgressPercent: numberOrUndefined(bootstrap.progress_percent) }
      : {}),
    ...(numberOrUndefined(metrics.success_rate) !== undefined
      ? { successRate: numberOrUndefined(metrics.success_rate) }
      : {}),
    ...(numberOrUndefined(metrics.cache_rate) !== undefined
      ? { cacheRate: numberOrUndefined(metrics.cache_rate) }
      : {}),
  };
}

function normalizeV2Buckets(value: unknown, dataThrough?: string) {
  if (!Array.isArray(value)) return [];
  const ceiling = dataThrough ? Date.parse(dataThrough) : Number.NaN;
  return value.flatMap((entry) => {
    const bucket = asRecord(entry);
    const checkedAt = stringOrUndefined(bucket?.bucket_start);
    if (!bucket || !checkedAt) return [];
    const start = Date.parse(checkedAt);
    if (Number.isFinite(ceiling) && Number.isFinite(start) && start > ceiling) return [];
    const metrics = asRecord(bucket.metrics) ?? {};
    const health = asRecord(bucket.health) ?? {};
    const ttft = asRecord(metrics.ttft) ?? {};
    const requestCount = numberOrUndefined(metrics.request_count);
    const noTraffic = metrics.has_requests === false || requestCount === 0;
    return [
      {
        checkedAt,
        status: noTraffic ? 'unknown' : mapHealth(health.overall),
        ...(numberOrUndefined(metrics.cache_rate) !== undefined
          ? { cacheRate: numberOrUndefined(metrics.cache_rate) }
          : {}),
        ...(numberOrUndefined(metrics.success_rate) !== undefined
          ? { successRate: numberOrUndefined(metrics.success_rate) }
          : {}),
        ...((numberOrUndefined(ttft.trimmed_avg_ms) ?? numberOrUndefined(ttft.avg_ms)) !== undefined
          ? { ttftMs: numberOrUndefined(ttft.trimmed_avg_ms) ?? numberOrUndefined(ttft.avg_ms) }
          : {}),
        ...(requestCount !== undefined ? { requestCount } : {}),
      },
    ];
  });
}

function isV2Contract(data: Record<string, unknown>): boolean {
  if (data.group_by !== undefined || data.coverage !== undefined) return true;
  return (Array.isArray(data.items) ? data.items : []).some((entry) => {
    const item = asRecord(entry);
    return Boolean(item && (item.metrics || item.health || item.group_id !== undefined));
  });
}

function normalizeBuckets(
  value: unknown,
  dataThrough?: string,
): NormalizedChannelSummary['timeline'] {
  if (!Array.isArray(value)) return [];
  const ceiling = dataThrough ? Date.parse(dataThrough) : Number.NaN;
  return value.flatMap((entry) => {
    const bucket = asRecord(entry);
    if (!bucket) return [];
    const checkedAt = stringOrUndefined(bucket.bucket_start);
    if (!checkedAt) return [];
    const start = Date.parse(checkedAt);
    if (Number.isFinite(ceiling) && Number.isFinite(start) && start > ceiling) return [];
    const metrics = asRecord(bucket.metrics) ?? {};
    const health = asRecord(bucket.health) ?? {};
    const ttft = asRecord(metrics.ttft) ?? {};
    const noTraffic =
      metrics.has_requests === false || numberOrUndefined(metrics.request_count) === 0;
    return [
      {
        status: noTraffic ? 'unknown' : mapHealth(health.overall),
        ...((numberOrUndefined(ttft.trimmed_avg_ms) ?? numberOrUndefined(ttft.avg_ms))
          ? { latencyMs: numberOrUndefined(ttft.trimmed_avg_ms) ?? numberOrUndefined(ttft.avg_ms) }
          : {}),
        checkedAt,
      },
    ];
  });
}

export function mapHealth(value: unknown): NormalizedChannelStatus {
  const status = String(value ?? '').toLowerCase();
  if (['operational', 'normal', 'healthy', 'success', 'ok'].includes(status)) return 'normal';
  if (['degraded', 'warning', 'partial'].includes(status)) return 'degraded';
  if (['failed', 'error', 'down', 'unavailable', 'critical'].includes(status)) return 'failed';
  return 'unknown';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
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
