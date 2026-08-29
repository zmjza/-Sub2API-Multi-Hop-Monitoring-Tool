import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Clock3,
  Columns3,
  DollarSign,
  FileText,
  Package,
  RefreshCw,
} from 'lucide-react';
import type { OpenCodexLogsPayload } from '../../../../electron/shared/opencodex';
import { formatTokenCount } from '../../lib/format';
import {
  filterOpenCodexRows,
  normalizeOpenCodexLogs,
  OPENCODEX_COLUMNS,
  openCodexOptions,
  openCodexStatTotals,
  type OpenCodexFilters,
  type OpenCodexPeriod,
  type OpenCodexRow,
} from './opencodex-data';
import { firstTokenClass } from './UsagePage';
import './usage.css';

const PAGE_SIZE = 20;

type OpenCodexLoadState =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; payload: OpenCodexLogsPayload; rows: OpenCodexRow[] }
  | { status: 'error'; message: string };

const EMPTY_FILTERS: OpenCodexFilters = {
  period: 'today',
  provider: '',
  model: '',
  reasoning: '',
  requestType: '',
  status: '',
  startDate: '',
  endDate: '',
  sort: 'desc',
};

export function OpenCodexUsagePage(props: { onToggleUsageMode?: () => void }) {
  const propsOnToggle = props.onToggleUsageMode;
  const [state, setState] = useState<OpenCodexLoadState>({ status: 'idle' });
  const [filters, setFilters] = useState<OpenCodexFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [showColumns, setShowColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => new Set(OPENCODEX_COLUMNS));
  const requestSeqRef = useRef(0);

  const load = () => {
    const desktop = window.sub2apiDesktop?.sites;
    if (!desktop) {
      setState({
        status: 'error',
        message: '当前预览环境没有桌面桥接，无法读取 OpenCodex 日志',
      });
      return;
    }
    const requestId = ++requestSeqRef.current;
    setState({ status: 'loading' });
    void desktop
      .opencodexLogs({ limit: 2000 })
      .then((payload) => {
        if (requestId !== requestSeqRef.current) return;
        setState({ status: 'success', payload, rows: normalizeOpenCodexLogs(payload) });
        setPage(1);
      })
      .catch((error: unknown) => {
        if (requestId !== requestSeqRef.current) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'OpenCodex 日志加载失败',
        });
      });
  };

  useEffect(() => {
    load();
    return () => {
      requestSeqRef.current += 1;
    };
  }, []);

  const rows = state.status === 'success' ? state.rows : [];
  const options = useMemo(() => openCodexOptions(rows), [rows]);
  const filtered = useMemo(() => filterOpenCodexRows(rows, filters), [rows, filters]);
  const stats = useMemo(() => openCodexStatTotals(filtered), [filtered]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const totalLoaded = state.status === 'success' ? state.payload.total : 0;
  const truncated = state.status === 'success' && totalLoaded > rows.length;

  const changeFilters = (patch: Partial<OpenCodexFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const setPeriod = (period: OpenCodexPeriod) => changeFilters({ period });

  const filterControls = [
    {
      label: '提供方',
      value: filters.provider,
      options: options.providers,
      onChange: (provider: string) => changeFilters({ provider }),
    },
    {
      label: '模型',
      value: filters.model,
      options: options.models,
      onChange: (model: string) => changeFilters({ model }),
    },
    {
      label: '思考模式',
      value: filters.reasoning,
      options: options.reasonings,
      onChange: (reasoning: string) => changeFilters({ reasoning }),
    },
    {
      label: '请求类型',
      value: filters.requestType,
      options: options.requestTypes,
      onChange: (requestType: string) => changeFilters({ requestType }),
    },
    {
      label: '状态',
      value: filters.status,
      options: options.statuses,
      onChange: (status: string) => changeFilters({ status }),
    },
  ];

  return (
    <section className="usage-page" data-opencodex-page>
      <div className="usage-mode-header">
        <div className="usage-selected-site">
          当前数据来源：<strong>OpenCodex 本地日志</strong>
          <span className="opencodex-source-hint">localhost:10100 · 最近 2000 条</span>
        </div>
        <button
          className="usage-mode-toggle active"
          type="button"
          aria-pressed="true"
          onClick={propsOnToggle}
        >
          切回中转站模式
        </button>
      </div>
      <div className="usage-summary">
        <article className="usage-stat requests">
          <div className="usage-stat-icon">
            <FileText size={24} />
          </div>
          <div>
            <span>请求数</span>
            <b>{state.status === 'success' ? stats.totalRequests.toLocaleString() : '—'}</b>
            <small>筛选后</small>
          </div>
        </article>
        <article className="usage-stat tokens">
          <div className="usage-stat-icon">
            <Package size={24} />
          </div>
          <div>
            <span>总 Token</span>
            <b>{state.status === 'success' ? formatTokenCount(stats.totalTokens) : '—'}</b>
            <small>
              输入: {state.status === 'success' ? formatTokenCount(stats.totalInputTokens) : '—'} /
              输出: {state.status === 'success' ? formatTokenCount(stats.totalOutputTokens) : '—'} /
              缓存:{' '}
              {state.status === 'success' ? formatTokenCount(stats.totalCacheReadTokens) : '—'}
            </small>
          </div>
        </article>
        <article className="usage-stat cost-stat">
          <div className="usage-stat-icon">
            <DollarSign size={24} />
          </div>
          <div>
            <span>总消费</span>
            <b>{state.status === 'success' ? '$' + stats.totalCost.toFixed(4) : '—'}</b>
            <small>OpenCodex 估算</small>
          </div>
        </article>
        <article className="usage-stat duration">
          <div className="usage-stat-icon">
            <Clock3 size={24} />
          </div>
          <div>
            <span>平均耗时</span>
            <b>
              {state.status === 'success' && stats.averageDurationSeconds !== undefined
                ? stats.averageDurationSeconds.toFixed(2) + 's'
                : '—'}
            </b>
            <small>筛选后</small>
          </div>
        </article>
      </div>

      <section className="usage-panel">
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
              className={'usage-tab ' + (filters.period === value ? 'active' : '')}
              key={value}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {filters.period === 'custom' && (
          <div className="custom-date-range">
            <label>
              开始日期
              <input
                type="date"
                value={filters.startDate}
                onChange={(event) => changeFilters({ startDate: event.target.value })}
              />
            </label>
            <label>
              结束日期
              <input
                type="date"
                value={filters.endDate}
                onChange={(event) => changeFilters({ endDate: event.target.value })}
              />
            </label>
          </div>
        )}
        <div className="filter-grid">
          {filterControls.map((control) => (
            <label key={control.label}>
              {control.label}
              <select
                className="select-field"
                value={control.value}
                onChange={(event) => control.onChange(event.target.value)}
              >
                <option value="">全部</option>
                {control.options.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="filter-actions">
          <button
            className="usage-action-button"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
          >
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
              load();
            }}
          >
            <RefreshCw size={15} />
            刷新
          </button>
        </div>
        {showColumns && (
          <div className="column-settings" role="group" aria-label="列设置">
            {OPENCODEX_COLUMNS.map((column) => (
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
          <strong>OpenCodex 请求记录</strong>
          <span>
            {'共 ' + (state.status === 'success' ? filtered.length : '待查询') + ' 条 · 按'}
            {filters.sort === 'desc' ? '最新' : '最早'}时间
            {filters.sort === 'desc' ? '倒序' : '正序'}
            {truncated ? ' · 已加载最近 2000 条' : ''}
          </span>
        </div>
        {state.status === 'error' && (
          <div className="empty-state opencodex-error" data-opencodex-error>
            <strong>OpenCodex 日志加载失败</strong>
            <span>{state.message}</span>
            <button className="usage-action-button" onClick={load}>
              重试
            </button>
          </div>
        )}
        {state.status === 'loading' && (
          <div className="empty-state" data-opencodex-loading>
            <strong>正在加载 OpenCodex 日志…</strong>
          </div>
        )}
        {state.status === 'success' && filtered.length === 0 && (
          <div className="empty-state" data-opencodex-empty>
            <strong>当前范围没有 OpenCodex 请求记录</strong>
            <span>调整时间范围或筛选条件后重试。</span>
          </div>
        )}
        {state.status === 'success' && filtered.length > 0 && (
          <>
            <div className="usage-table-wrap">
              <table>
                <thead>
                  <tr>
                    {OPENCODEX_COLUMNS.filter((column) => visibleColumns.has(column)).map(
                      (column) => (
                        <th key={column}>
                          {column === '时间' ? (
                            <button
                              className="time-sort"
                              onClick={() => {
                                const next = filters.sort === 'desc' ? 'asc' : 'desc';
                                changeFilters({ sort: next });
                              }}
                            >
                              时间 {filters.sort === 'desc' ? '↓' : '↑'}
                            </button>
                          ) : (
                            column
                          )}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, index) => (
                    <tr key={row.time + '-' + row.provider + '-' + row.model + '-' + index}>
                      {visibleColumns.has('时间') && <td>{row.time}</td>}
                      {visibleColumns.has('提供方') && (
                        <td>
                          <span className="table-tag">{row.provider}</span>
                        </td>
                      )}
                      {visibleColumns.has('提供方模型') && (
                        <td>
                          <span className="opencodex-provider-model">{row.model}</span>
                        </td>
                      )}
                      {visibleColumns.has('状态') && (
                        <td>
                          <span
                            className={'opencodex-status is-' + openCodexStatusTone(row.status)}
                            title={row.errorCode ?? ''}
                          >
                            {row.statusLabel}
                          </span>
                        </td>
                      )}
                      {visibleColumns.has('思考模式') && <td>{row.reasoning}</td>}
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
                                aria-label={'输入 Token ' + row.inputTokens}
                                title="输入 Token"
                              >
                                <ArrowDown size={15} aria-hidden />
                                <b>{row.inputTokens}</b>
                              </span>
                              <span
                                className="usage-token-output"
                                aria-label={'输出 Token ' + row.outputTokens}
                                title="输出 Token"
                              >
                                <ArrowUp size={15} aria-hidden />
                                <b>{row.outputTokens}</b>
                              </span>
                            </div>
                            <span
                              className="usage-token-cache"
                              aria-label={'缓存读取 Token ' + row.cacheReadTokens}
                              title="缓存读取 Token"
                            >
                              <Archive size={15} aria-hidden />
                              <b>{row.cacheReadTokens}</b>
                            </span>
                            <span
                              className={'usage-cache-rate-badge is-' + row.cacheRateTone}
                              aria-label={'缓存率 ' + row.cacheRateLabel}
                              title="缓存率"
                            >
                              {row.cacheRateLabel}
                            </span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.has('首字') && (
                        <td className={firstTokenClass(row.firstTokenMs)}>{row.firstTokenLabel}</td>
                      )}
                      {visibleColumns.has('耗时 / t/s') && (
                        <td>
                          <div className="usage-speed-cell">
                            <span>{row.durationLabel}</span>
                            <span
                              className={'usage-speed-badge is-' + (row.speedTier ?? 'unavailable')}
                              title={row.tokensPerSecondLabel}
                            >
                              {row.tokensPerSecondLabel}
                            </span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.has('实际消费') && <td className="cost">{row.costLabel}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="table-footer">
              <span>
                显示 {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filtered.length)} 条
              </span>
              <div>
                <button
                  aria-label="上一页"
                  disabled={safePage <= 1}
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                >
                  ‹
                </button>
                {pageButtons(safePage, pages).map((value) => (
                  <button
                    className={safePage === value ? 'selected-page' : ''}
                    key={value}
                    onClick={() => setPage(value)}
                  >
                    {value}
                  </button>
                ))}
                <button
                  aria-label="下一页"
                  disabled={safePage >= pages}
                  onClick={() => setPage(Math.min(pages, safePage + 1))}
                >
                  ›
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </section>
  );
}

function pageButtons(page: number, pages: number): number[] {
  const first = Math.max(1, Math.min(page - 2, pages - 4));
  return Array.from({ length: Math.min(5, pages) }, (_, index) => first + index);
}

function openCodexStatusTone(status: number): string {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 400) return 'error';
  return 'neutral';
}
