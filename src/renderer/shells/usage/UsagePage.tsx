import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Clock3,
  Columns3,
  DollarSign,
  Download,
  FileText,
  Gauge,
  Package,
  RotateCcw,
} from 'lucide-react';
import type { UsageProps } from './types';
import { usageRecords } from './data';
import { formatLocalTimestamp, formatTokenCount } from '../../lib/format';
import { UsageQueryController } from './usage-query-controller';
import { siteDisplayName } from '../../site-label';
import { calculateTokensPerSecond, formatTokensPerSecond, usageSpeedTier } from './usage-speed';
import { OpenCodexUsagePage } from './OpenCodexUsagePage';
import './usage.css';
export function Sub2ApiUsagePage(props: UsageProps) {
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'custom'>('today');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState({
    apiKeyId: '',
    model: '',
    groupId: '',
    requestType: '',
    billingType: '',
    billingMode: '',
    startDate: '',
    endDate: '',
  });
  const [showColumns, setShowColumns] = useState(false);
  const queryListenerRef = useRef(props.onUsageQuery);
  queryListenerRef.current = props.onUsageQuery;
  const queryControllerRef = useRef<UsageQueryController | undefined>(undefined);
  queryControllerRef.current ??= new UsageQueryController((query) =>
    queryListenerRef.current?.(query),
  );
  const [visibleColumns, setVisibleColumns] = useState(
    () =>
      new Set([
        '时间',
        'API Key',
        '模型',
        '思考等级',
        '分组',
        '请求类型',
        'Token',
        '首字',
        '耗时',
        '实际消费',
      ]),
  );
  const runtime = Boolean(window.sub2apiDesktop);
  const liveRecords = readUsageRecords(props.usageData);
  const isEmpty =
    props.state === 'empty' || (props.usageData !== undefined && liveRecords.length === 0);
  const records =
    props.usageData !== undefined
      ? liveRecords.slice(0, 20)
      : runtime
        ? []
        : usageRecords.concat([
            {
              ...usageRecords[0],
              time: '2026/07/19 14:12:00',
              model: 'gpt-5.4 · 长模型名称示例',
              groupName: '默认分组',
              requestType: 'Chat',
              inputTokens: '8,240',
              outputTokens: '1,205',
              cacheReadTokens: '—',
              actualCost: '$0.036',
            },
          ]);
  const pagination = readUsagePagination(
    props.usageData,
    page,
    runtime ? 0 : Math.max(1, Math.ceil(records.length / 20)),
  );
  const stats = readUsageStats(props.usageStats);
  const filterKey = JSON.stringify(compactFilters(filters));
  useEffect(() => {
    setPage(1);
    queryControllerRef.current?.schedule({
      period,
      page: 1,
      sort,
      ...compactFilters(filters),
    });
  }, [props.selectedSite?.id, period, sort, filterKey]);
  useEffect(() => () => queryControllerRef.current?.dispose(), []);
  return (
    <section className="usage-page">
      <div className="usage-summary">
        <article className="usage-stat requests">
          <div className="usage-stat-icon">
            <FileText size={24} />
          </div>
          <div>
            <span>总请求数</span>
            <b>{stats?.totalRequests.toLocaleString() ?? '—'}</b>
            <small>所选范围内</small>
          </div>
        </article>
        <article className="usage-stat tokens">
          <div className="usage-stat-icon">
            <Package size={24} />
          </div>
          <div>
            <span>总 Token</span>
            <b>{stats ? formatTokenCount(stats.totalTokens) : '—'}</b>
            <small>
              输入: {stats ? formatTokenCount(stats.totalInputTokens) : '—'} / 输出:{' '}
              {stats ? formatTokenCount(stats.totalOutputTokens) : '—'} / 缓存:{' '}
              {stats ? formatTokenCount(stats.totalCacheReadTokens) : '—'} / 创建:{' '}
              {stats ? formatTokenCount(stats.totalCacheCreationTokens) : '—'}
            </small>
          </div>
        </article>
        <article className="usage-stat cost-stat">
          <div className="usage-stat-icon">
            <DollarSign size={24} />
          </div>
          <div>
            <span>总消费</span>
            <b>{stats ? `$${stats.totalActualCost.toFixed(4)}` : '—'}</b>
            <small>标准 {stats ? `$${stats.totalCost.toFixed(4)}` : '—'}</small>
          </div>
        </article>
        <article className="usage-stat duration">
          <div className="usage-stat-icon">
            <Clock3 size={24} />
          </div>
          <div>
            <span>平均耗时</span>
            <b>{stats ? `${(stats.averageDurationMs / 1000).toFixed(2)}s` : '—'}</b>
          </div>
        </article>
      </div>
      <section className="usage-panel">
        <div className="usage-mode-header">
          <div className="usage-selected-site">
            当前选中中转站：<strong>{siteDisplayName(props.selectedSite)}</strong>
          </div>
          <button
            className="usage-mode-toggle"
            type="button"
            aria-pressed="false"
            onClick={props.onToggleUsageMode}
          >
            切换 opencodex 模式
          </button>
        </div>
        <div className="usage-tabs">
          {(
            [
              ['today', '今天'],
              ['7d', '近 7 天'],
              ['30d', '近 30 天'],
              ['custom', '自定义范围'],
            ] as const
          ).map(([value, label]) => (
            <button
              className={`usage-tab ${period === value ? 'active' : ''}`}
              key={value}
              onClick={() => {
                setPeriod(value);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="custom-date-range">
            <label>
              开始日期
              <input
                type="date"
                value={filters.startDate}
                onChange={(event) => setFilters({ ...filters, startDate: event.target.value })}
              />
            </label>
            <label>
              结束日期
              <input
                type="date"
                value={filters.endDate}
                onChange={(event) => setFilters({ ...filters, endDate: event.target.value })}
              />
            </label>
          </div>
        )}
        <div className="filter-grid">
          <UsageFilter
            label="API Key"
            value={filters.apiKeyId}
            options={props.keyOptions?.map((key) => [key.id, key.maskedLabel]) ?? []}
            onChange={(apiKeyId) => setFilters({ ...filters, apiKeyId })}
          />
          <UsageFilter
            label="模型"
            value={filters.model}
            options={props.usageFilterOptions?.models.map((model) => [model, model]) ?? []}
            onChange={(model) => setFilters({ ...filters, model })}
          />
          <UsageFilter
            label="分组"
            value={filters.groupId}
            options={props.usageFilterOptions?.groups.map((group) => [group.id, group.name]) ?? []}
            onChange={(groupId) => setFilters({ ...filters, groupId })}
          />
          <UsageFilter
            label="请求类型"
            value={filters.requestType}
            options={[
              ['sync', '同步'],
              ['stream', '流式'],
              ['ws_v2', 'WebSocket'],
            ]}
            onChange={(requestType) => setFilters({ ...filters, requestType })}
          />
          <UsageFilter
            label="计费类型"
            value={filters.billingType}
            options={[
              ['0', '余额'],
              ['1', '订阅'],
            ]}
            onChange={(billingType) => setFilters({ ...filters, billingType })}
          />
          <UsageFilter
            label="计费模式"
            value={filters.billingMode}
            options={[
              ['token', '按 Token'],
              ['per_request', '按请求'],
              ['image', '按图片'],
              ['video', '按视频'],
            ]}
            onChange={(billingMode) => setFilters({ ...filters, billingMode })}
          />
        </div>
        <div className="filter-actions">
          <button
            className="usage-action-button"
            onClick={() => {
              const cleared = {
                apiKeyId: '',
                model: '',
                groupId: '',
                requestType: '',
                billingType: '',
                billingMode: '',
                startDate: '',
                endDate: '',
              };
              const resetQuery = usageResetQuery();
              setFilters(cleared);
              setPeriod(resetQuery.period);
              setPage(resetQuery.page);
              setSort(resetQuery.sort);
              queryControllerRef.current?.flush(resetQuery);
            }}
          >
            <RotateCcw size={15} />
            重置
          </button>
          <button className="usage-action-button" onClick={() => setShowColumns((value) => !value)}>
            <Columns3 size={15} />
            列设置
          </button>
          <button
            className="usage-action-button"
            onClick={() => {
              setPage(1);
              queryControllerRef.current?.flush({
                period,
                page: 1,
                sort,
                ...compactFilters(filters),
              });
            }}
          >
            刷新
          </button>
          <button
            className="usage-action-button usage-action-primary"
            onClick={() => {
              if (!props.selectedSite) return;
              void window.sub2apiDesktop?.sites.usageCsv({
                siteId: props.selectedSite.id,
                period,
                page: 1,
                pageSize: 100,
                sort,
                ...compactFilters(filters),
              });
            }}
          >
            <Download size={15} />
            导出 CSV
          </button>
        </div>
        {showColumns && (
          <div className="column-settings" role="group" aria-label="列设置">
            {[
              '时间',
              'API Key',
              '模型',
              '思考等级',
              '分组',
              '请求类型',
              'Token',
              '首字',
              '耗时',
              '实际消费',
            ].map((column) => (
              <label key={column}>
                <input
                  type="checkbox"
                  checked={visibleColumns.has(column)}
                  onChange={() =>
                    setVisibleColumns((current) => {
                      const next = new Set(current);
                      if (next.has(column)) next.delete(column);
                      else next.add(column);
                      return next;
                    })
                  }
                />
                {column}
              </label>
            ))}
          </div>
        )}
      </section>
      <section className="usage-table-panel">
        <div className="table-caption">
          <strong>请求记录</strong>
          <span>
            共 {props.usageData !== undefined ? pagination.total : '待查询'} 条 · 按
            {sort === 'desc' ? '最新' : '最早'}时间{sort === 'desc' ? '倒序' : '正序'}
          </span>
        </div>
        {isEmpty ? (
          <div className="empty-state">
            <strong>今天还没有使用记录</strong>
            <span>调整时间范围或切换站点后重试。</span>
          </div>
        ) : (
          <div className="usage-table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    '时间',
                    'API Key',
                    '模型',
                    '思考等级',
                    '分组',
                    '请求类型',
                    'Token',
                    '首字',
                    '耗时',
                    '实际消费',
                  ]
                    .filter((column) => visibleColumns.has(column))
                    .map((x) => (
                      <th key={x}>
                        {x === '时间' ? (
                          <button
                            className="time-sort"
                            onClick={() => {
                              const next = sort === 'desc' ? 'asc' : 'desc';
                              setSort(next);
                              setPage(1);
                            }}
                          >
                            时间 {sort === 'desc' ? '↓' : '↑'}
                          </button>
                        ) : x === '耗时' ? (
                          '耗时 / t/s'
                        ) : (
                          x
                        )}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {records.map((row, i) => (
                  <tr key={`${row.time}-${i}`}>
                    {visibleColumns.has('时间') && <td>{row.time}</td>}
                    {visibleColumns.has('API Key') && <td className="muted">{row.keyLabel}</td>}
                    {visibleColumns.has('模型') && <td>{row.model}</td>}
                    {visibleColumns.has('思考等级') && (
                      <td>{reasoningLabel(row.reasoningEffort)}</td>
                    )}
                    {visibleColumns.has('分组') && <td>{row.groupName}</td>}
                    {visibleColumns.has('请求类型') && (
                      <td>
                        <span className="table-tag">{row.requestType}</span>
                      </td>
                    )}
                    {visibleColumns.has('Token') && (
                      <td>
                        <div className="usage-token-cell">
                          <div className="usage-token-flow">
                            <span
                              className="usage-token-input"
                              aria-label={`输入 Token ${row.inputTokens}`}
                              title="输入 Token"
                            >
                              <ArrowDown size={15} aria-hidden />
                              <b>{row.inputTokens}</b>
                            </span>
                            <span
                              className="usage-token-output"
                              aria-label={`输出 Token ${row.outputTokens}`}
                              title="输出 Token"
                            >
                              <ArrowUp size={15} aria-hidden />
                              <b>{row.outputTokens}</b>
                            </span>
                          </div>
                          <span
                            className="usage-token-cache"
                            aria-label={`缓存读取 Token ${row.cacheReadTokens}`}
                            title="缓存读取 Token"
                          >
                            <Archive size={15} aria-hidden />
                            <b>{row.cacheReadTokens}</b>
                          </span>
                        </div>
                      </td>
                    )}
                    {visibleColumns.has('首字') && (
                      <td className={firstTokenClass(row.firstTokenValue)}>
                        {row.firstTokenMs ?? '—'}
                      </td>
                    )}
                    {visibleColumns.has('耗时') && (
                      <td>
                        <div className="usage-speed-cell">
                          <span>{row.durationMs ?? '—'}</span>
                          <span
                            className={`usage-speed-badge is-${row.speedTier ?? 'unavailable'}`}
                            title={`生成速度：${row.tokensPerSecondLabel ?? '—'}`}
                          >
                            <Gauge size={13} aria-hidden />
                            {row.tokensPerSecondLabel ?? '—'}
                          </span>
                        </div>
                      </td>
                    )}
                    {visibleColumns.has('实际消费') && <td className="cost">{row.actualCost}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="table-footer">
          <span>
            显示 {pagination.rangeStart}–{pagination.rangeEnd} 条
          </span>
          <div>
            <button
              aria-label="上一页"
              disabled={pagination.page <= 1}
              onClick={() => {
                const next = Math.max(1, pagination.page - 1);
                setPage(next);
                props.onUsageQuery?.({ period, page: next, sort, ...compactFilters(filters) });
              }}
            >
              ‹
            </button>
            {pagination.pageButtons.map((value) => (
              <button
                className={pagination.page === value ? 'selected-page' : ''}
                key={value}
                onClick={() => {
                  setPage(value);
                  props.onUsageQuery?.({ period, page: value, sort, ...compactFilters(filters) });
                }}
              >
                {value}
              </button>
            ))}
            <button
              aria-label="下一页"
              disabled={pagination.pages === 0 || pagination.page >= pagination.pages}
              onClick={() => {
                const next = Math.min(pagination.pages, pagination.page + 1);
                setPage(next);
                props.onUsageQuery?.({ period, page: next, sort, ...compactFilters(filters) });
              }}
            >
              ›
            </button>
          </div>
        </footer>
      </section>
    </section>
  );
}

export function UsagePage(props: UsageProps) {
  if (props.usageMode === 'opencodex') {
    return (
      <section className="usage-page">
        <OpenCodexUsagePage onToggleUsageMode={props.onToggleUsageMode} />
      </section>
    );
  }
  return <Sub2ApiUsagePage {...props} />;
}

export function readUsageStats(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const keys = [
    'totalRequests',
    'totalTokens',
    'totalInputTokens',
    'totalOutputTokens',
    'totalCacheReadTokens',
    'totalCacheCreationTokens',
    'totalActualCost',
    'totalCost',
    'averageDurationMs',
  ] as const;
  if (keys.some((key) => typeof record[key] !== 'number' || !Number.isFinite(record[key])))
    return undefined;
  return Object.fromEntries(keys.map((key) => [key, record[key]])) as Record<
    (typeof keys)[number],
    number
  >;
}

export function readUsagePagination(value: unknown, fallbackPage = 1, fallbackPages = 0) {
  const record =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
  const rawPages = finiteInteger(record?.pages, fallbackPages, 0);
  const pages = Math.max(0, rawPages);
  const requestedPage = finiteInteger(record?.page, fallbackPage, 1);
  const page = pages === 0 ? 1 : Math.min(Math.max(1, requestedPage), pages);
  const pageSize = finiteInteger(record?.pageSize ?? record?.page_size, 20, 0);
  const total = finiteInteger(record?.total, 0, 0);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(total, rangeStart + pageSize - 1);
  const firstButton = Math.max(1, Math.min(page - 2, pages - 4));
  const pageButtons = Array.from({ length: Math.min(5, pages) }, (_, index) => firstButton + index);
  return { page, pageSize, pages, total, rangeStart, rangeEnd, pageButtons };
}

export function usageResetQuery() {
  return { period: 'today' as const, page: 1, sort: 'desc' as const };
}

function finiteInteger(value: unknown, fallback: number, minimum: number) {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.max(minimum, parsed);
}

function UsageFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange(value: string): void;
}) {
  return (
    <label>
      {label}
      <select
        className="select-field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">全部</option>
        {options.map(([id, text]) => (
          <option value={id} key={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function compactFilters(filters: {
  apiKeyId: string;
  model: string;
  groupId: string;
  requestType: string;
  billingType: string;
  billingMode: string;
  startDate: string;
  endDate: string;
}) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) as Partial<
    typeof filters
  >;
}

export function readUsageRecords(value: unknown): typeof usageRecords {
  if (Array.isArray(value)) return value as typeof usageRecords;
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  const rows = record.items ?? record.records ?? record.data;
  return Array.isArray(rows)
    ? rows.map((row) => {
        const item = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
        const tokensPerSecond = calculateTokensPerSecond(item.outputTokens, item.durationMs);
        return {
          time: formatLocalTimestamp(String(item.createdAt ?? '')),
          model: String(item.model ?? '未知模型'),
          groupName: String(item.groupName ?? '未分组'),
          requestType: String(item.requestType ?? 'unknown'),
          inputTokens: formatUsageToken(item.inputTokens),
          outputTokens: formatUsageToken(item.outputTokens),
          cacheReadTokens: formatUsageToken(item.cacheReadTokens),
          actualCost: formatOptionalCost(item.actualCost),
          keyLabel: String(item.apiKeyLabel ?? 'Key · 已脱敏'),
          reasoningEffort:
            typeof item.reasoningEffort === 'string' ? item.reasoningEffort : undefined,
          firstTokenValue: numericValue(item.firstTokenMs),
          firstTokenMs: formatOptionalDuration(item.firstTokenMs),
          durationMs: formatOptionalDuration(item.durationMs),
          tokensPerSecond,
          tokensPerSecondLabel: formatTokensPerSecond(tokensPerSecond),
          speedTier: usageSpeedTier(tokensPerSecond),
        };
      })
    : [];
}

function formatUsageToken(value: unknown): string {
  const number = numericValue(value);
  if (number === undefined) return '—';
  if (Math.abs(number) < 10_000) return Math.round(number).toLocaleString('en-US');
  return formatTokenCount(number);
}

function numericValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function formatOptionalCost(value: unknown): string {
  const number = numericValue(value);
  return number === undefined ? '—' : `$${number.toFixed(4)}`;
}

function formatOptionalDuration(value: unknown): string | undefined {
  const number = numericValue(value);
  return number === undefined || number < 0 ? undefined : `${(number / 1000).toFixed(2)}s`;
}

export function firstTokenClass(value: number | undefined): string {
  if (value === undefined || value < 0) return '';
  if (value < 10_000) return 'first-token-fast';
  if (value < 20_000) return 'first-token-medium';
  return 'first-token-slow';
}

function reasoningLabel(value: string | undefined) {
  return (
    {
      low: 'low',
      medium: 'medium',
      high: 'high',
      xhigh: 'xhigh',
      max: 'max',
    }[value ?? ''] ?? '—'
  );
}
