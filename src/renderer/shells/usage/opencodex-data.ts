import type {
  OpenCodexLogEntry,
  OpenCodexLogsPayload,
} from '../../../../electron/shared/opencodex';
import { formatLocalTimestamp, formatTokenCount } from '../../lib/format';

export type OpenCodexReasoningLabel = '低' | '中' | '高' | '极高' | '最大' | '无' | '—';

export interface OpenCodexRow {
  time: string;
  provider: string;
  model: string;
  reasoning: OpenCodexReasoningLabel;
  requestType: string;
  inputTokens: string;
  outputTokens: string;
  cacheReadTokens: string;
  cacheWriteTokens: string;
  totalTokens: string;
  inputTokensValue?: number;
  outputTokensValue?: number;
  cacheReadTokensValue?: number;
  cacheWriteTokensValue?: number;
  totalTokensValue?: number;
  costValue?: number;
  durationMsValue?: number;
  firstTokenLabel: string;
  firstTokenMs?: number;
  durationLabel: string;
  tokensPerSecondLabel: string;
  costLabel: string;
  status: number;
  statusLabel: string;
  errorCode?: string;
  timestamp: number;
}

function reasoningLabel(value: string | undefined): OpenCodexReasoningLabel {
  switch (value) {
    case 'low':
      return '低';
    case 'medium':
      return '中';
    case 'high':
      return '高';
    case 'xhigh':
      return '极高';
    case 'max':
      return '最大';
    case 'none':
      return '无';
    default:
      return '—';
  }
}

function requestTypeLabel(value: string | undefined): string {
  switch (value) {
    case 'responses':
      return 'Responses';
    case 'chat':
      return 'Chat';
    case 'messages':
      return 'Messages';
    default:
      return value || '未知';
  }
}

function statusLabel(value: number): string {
  return String(value);
}

function formatToken(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 10_000) return Math.round(value).toLocaleString('en-US');
  return formatTokenCount(value);
}

function formatDuration(value: number | undefined): string {
  if (value === undefined || value < 0 || !Number.isFinite(value)) return '—';
  return (value / 1000).toFixed(2) + 's';
}

function formatCost(entry: OpenCodexLogEntry): string {
  const cost = entry.displayMetrics?.cost;
  if (cost?.kind !== 'value') return '—';
  const total = cost.estimate?.cost?.total;
  if (typeof total !== 'number' || !Number.isFinite(total)) return '—';
  return '$' + total.toFixed(4);
}

function numericOrUndefined(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function formatTokensPerSecond(entry: OpenCodexLogEntry): string {
  const metric = entry.displayMetrics?.tokPerSecond;
  if (metric?.kind !== 'value') return '—';
  return metric.value.toFixed(2) + ' t/s';
}

export function normalizeOpenCodexLogs(payload: OpenCodexLogsPayload): OpenCodexRow[] {
  return payload.logs.map((entry) => ({
    time: formatLocalTimestamp(entry.timestamp),
    provider: entry.provider,
    model: entry.model,
    reasoning: reasoningLabel(entry.effectiveEffort ?? entry.requestedEffort),
    requestType: requestTypeLabel(entry.inboundProtocol),
    inputTokens: formatToken(entry.usage?.inputTokens),
    outputTokens: formatToken(entry.usage?.outputTokens),
    cacheReadTokens: formatToken(entry.usage?.cachedInputTokens),
    cacheWriteTokens: '—',
    totalTokens: formatToken(entry.totalTokens),
    inputTokensValue: numericOrUndefined(entry.usage?.inputTokens),
    outputTokensValue: numericOrUndefined(entry.usage?.outputTokens),
    cacheReadTokensValue: numericOrUndefined(entry.usage?.cachedInputTokens),
    totalTokensValue: numericOrUndefined(entry.totalTokens),
    costValue: openCodexCostValue(entry),
    durationMsValue: numericOrUndefined(entry.durationMs),
    firstTokenLabel: entry.firstOutputMs === undefined ? '—' : formatDuration(entry.firstOutputMs),
    firstTokenMs: entry.firstOutputMs,
    durationLabel: formatDuration(entry.durationMs),
    tokensPerSecondLabel: formatTokensPerSecond(entry),
    costLabel: formatCost(entry),
    status: entry.status,
    statusLabel: statusLabel(entry.status),
    errorCode: entry.errorCode,
    timestamp: entry.timestamp,
  }));
}

function openCodexCostValue(entry: OpenCodexLogEntry): number | undefined {
  const cost = entry.displayMetrics?.cost;
  if (cost?.kind !== 'value') return undefined;
  const total = cost.estimate?.cost?.total;
  return numericOrUndefined(total);
}

export type OpenCodexPeriod = 'today' | '7d' | '30d' | 'custom';

export interface OpenCodexFilters {
  period: OpenCodexPeriod;
  provider: string;
  model: string;
  reasoning: string;
  requestType: string;
  status: string;
  startDate: string;
  endDate: string;
  sort: 'asc' | 'desc';
}

function dayRange(period: OpenCodexPeriod, startDate: string, endDate: string): [number, number] {
  const now = Date.now();
  const dayMs = 86_400_000;
  if (period === 'custom') {
    const start = startDate
      ? new Date(startDate + 'T00:00:00').getTime()
      : Number.NEGATIVE_INFINITY;
    const end = endDate ? new Date(endDate + 'T23:59:59.999').getTime() : Number.POSITIVE_INFINITY;
    return [
      Number.isFinite(start) ? start : Number.NEGATIVE_INFINITY,
      Number.isFinite(end) ? end : Number.POSITIVE_INFINITY,
    ];
  }
  const days = period === 'today' ? 1 : period === '7d' ? 7 : 30;
  return [now - days * dayMs, Number.POSITIVE_INFINITY];
}

export function filterOpenCodexRows(
  rows: OpenCodexRow[],
  filters: OpenCodexFilters,
): OpenCodexRow[] {
  const [start, end] = dayRange(filters.period, filters.startDate, filters.endDate);
  const filtered = rows.filter((row) => {
    if (row.timestamp < start || row.timestamp > end) return false;
    if (filters.provider && row.provider !== filters.provider) return false;
    if (filters.model && row.model !== filters.model) return false;
    if (filters.reasoning && row.reasoning !== filters.reasoning) return false;
    if (filters.requestType && row.requestType !== filters.requestType) return false;
    if (filters.status && row.statusLabel !== filters.status) return false;
    return true;
  });
  filtered.sort((left, right) =>
    filters.sort === 'desc' ? right.timestamp - left.timestamp : left.timestamp - right.timestamp,
  );
  return filtered;
}

export function openCodexStatTotals(rows: OpenCodexRow[]) {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCost = 0;
  let durationSumMs = 0;
  let durationCount = 0;
  for (const row of rows) {
    totalInputTokens += row.inputTokensValue ?? 0;
    totalOutputTokens += row.outputTokensValue ?? 0;
    totalCacheReadTokens += row.cacheReadTokensValue ?? 0;
    totalCost += row.costValue ?? 0;
    if (row.durationMsValue !== undefined) {
      durationSumMs += row.durationMsValue;
      durationCount += 1;
    }
  }
  return {
    totalRequests: rows.length,
    totalTokens: totalInputTokens + totalOutputTokens + totalCacheReadTokens,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadTokens,
    totalCost,
    averageDurationSeconds: durationCount ? durationSumMs / durationCount / 1000 : undefined,
  };
}

export function openCodexOptions(rows: OpenCodexRow[]) {
  return {
    providers: [...new Set(rows.map((row) => row.provider))].sort((a, b) => a.localeCompare(b)),
    models: [...new Set(rows.map((row) => row.model))].sort((a, b) => a.localeCompare(b)),
    reasonings: [...new Set(rows.map((row) => row.reasoning))].sort((a, b) => a.localeCompare(b)),
    requestTypes: [...new Set(rows.map((row) => row.requestType))].sort((a, b) =>
      a.localeCompare(b),
    ),
    statuses: [...new Set(rows.map((row) => row.statusLabel))].sort(
      (a, b) => Number(a) - Number(b),
    ),
  };
}
