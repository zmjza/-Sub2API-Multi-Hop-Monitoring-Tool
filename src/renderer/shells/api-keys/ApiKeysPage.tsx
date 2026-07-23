import { AlertCircle, KeyRound, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import type { ApiKeyPagination, ApiKeysPageProps, ApiKeysPageState, ApiKeyStatus } from './types';
import './api-keys.css';

const statusOptions: Array<{ value: '' | ApiKeyStatus; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'active', label: '活跃' },
  { value: 'disabled', label: '停用' },
  { value: 'exhausted', label: '额度耗尽' },
  { value: 'expired', label: '已过期' },
  { value: 'unknown', label: '未知' },
];

export function ApiKeysPage(props: ApiKeysPageProps) {
  const selectedSite = props.sites.find((site) => site.id === props.selectedSiteId);
  const pagination = normalizeApiKeyPagination(props.pagination);
  const hasRows = props.keys.length > 0;
  const blockingState = !hasRows && props.state !== 'success' && props.state !== 'refreshing';

  if (props.sites.length === 0) {
    return (
      <section className="api-keys-page">
        <div className="api-keys-state" role="status">
          <KeyRound size={30} aria-hidden="true" />
          <strong>还没有可用的中转站</strong>
          <span>添加站点后即可查看当前用户的 API 密钥。</span>
          <button type="button" onClick={props.onOpenSiteManagement}>
            前往站点管理
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="api-keys-page">
      <header className="api-keys-header">
        <div className="api-keys-title">
          <span className="api-keys-title-icon">
            <KeyRound size={20} aria-hidden="true" />
          </span>
          <div>
            <h1>API 密钥</h1>
            <p>管理当前用户的密钥与可用分组</p>
          </div>
        </div>
        <label className="api-keys-site-field">
          <span>当前中转站</span>
          <select
            aria-label="选择中转站"
            value={selectedSite?.id ?? ''}
            onChange={(event) => props.onSelectSite?.(event.target.value)}
          >
            {props.sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="api-keys-panel">
        <div className="api-keys-toolbar">
          <label className="api-keys-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="搜索名称或脱敏 Key 摘要"
              placeholder="搜索名称或脱敏 Key 摘要"
              value={props.search}
              onChange={(event) => props.onSearchChange?.(event.target.value)}
            />
          </label>
          <label className="api-keys-filter">
            <span className="api-keys-visually-hidden">按分组筛选</span>
            <select
              aria-label="按分组筛选"
              value={props.groupFilter}
              onChange={(event) => props.onGroupFilterChange?.(event.target.value)}
            >
              <option value="">全部分组</option>
              {props.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label className="api-keys-filter">
            <span className="api-keys-visually-hidden">按状态筛选</span>
            <select
              aria-label="按状态筛选"
              value={props.statusFilter}
              onChange={(event) =>
                props.onStatusFilterChange?.(event.target.value as '' | ApiKeyStatus)
              }
            >
              {statusOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="api-keys-refresh"
            type="button"
            title="强制刷新"
            aria-label="强制刷新 API 密钥"
            disabled={props.state === 'loading' || props.state === 'refreshing'}
            onClick={props.onRefresh}
          >
            <RefreshCw
              className={props.state === 'refreshing' ? 'api-keys-spin' : undefined}
              size={17}
              aria-hidden="true"
            />
            刷新
          </button>
        </div>

        <div className="api-keys-feedback" aria-live="polite">
          {apiKeyStateMessage(props.state) || props.successMessage || ''}
        </div>

        {blockingState ? (
          <ApiKeysState state={props.state} errorMessage={props.errorMessage} />
        ) : props.state === 'empty' || !hasRows ? (
          <ApiKeysState state="empty" />
        ) : (
          <>
            <div className="api-keys-table-wrap" tabIndex={0} aria-label="API 密钥列表">
              <table className="api-keys-table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>API 密钥</th>
                    <th>分组</th>
                    <th>平台</th>
                    <th>有效倍率</th>
                    <th>当前并发</th>
                    <th>今日实际消费</th>
                    <th>近30天实际消费</th>
                    <th>过期时间</th>
                    <th>状态</th>
                    <th>创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {props.keys.map((key) => {
                    const isWriting = props.writingKeyIds?.includes(key.id) ?? false;
                    const currentGroupInOptions = props.groups.some(
                      (group) => group.id === key.groupId,
                    );
                    return (
                      <tr key={key.id} className={isWriting ? 'api-keys-row-writing' : undefined}>
                        <td className="api-keys-truncate" title={key.name}>
                          {key.name}
                        </td>
                        <td>
                          <code className="api-keys-masked" title={key.maskedLabel}>
                            {key.maskedLabel}
                          </code>
                        </td>
                        <td>
                          <div className="api-keys-group-cell">
                            <select
                              aria-label={`切换${key.name}的分组`}
                              value={key.groupId ?? ''}
                              disabled={isWriting}
                              onChange={(event) => {
                                const nextGroupId = event.target.value;
                                if (shouldRequestGroupChange(key.groupId, nextGroupId, isWriting)) {
                                  props.onGroupChange?.(key.id, nextGroupId);
                                }
                              }}
                            >
                              {!key.groupId && <option value="">未分组</option>}
                              {key.groupId && !currentGroupInOptions && (
                                <option value={key.groupId}>{key.groupName ?? '当前分组'}</option>
                              )}
                              {props.groups.map((group) => (
                                <option key={group.id} value={group.id}>
                                  {group.name}
                                </option>
                              ))}
                            </select>
                            <small>
                              {isWriting ? '正在确认远程分组…' : (key.groupName ?? '待查询')}
                            </small>
                          </div>
                        </td>
                        <td>{key.platform || '待查询'}</td>
                        <td>{formatRate(key.effectiveRate)}</td>
                        <td>{formatOptionalNumber(key.currentConcurrency)}</td>
                        <td className="api-keys-cost">{formatCost(key.todayActualCost)}</td>
                        <td className="api-keys-cost">{formatCost(key.last30DaysActualCost)}</td>
                        <td>{key.expiresAt ? formatDateTime(key.expiresAt) : '永久有效'}</td>
                        <td>
                          <span className={`api-keys-status api-keys-status-${key.status}`}>
                            {statusLabel(key.status)}
                          </span>
                        </td>
                        <td>{formatDateTime(key.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <footer className="api-keys-pagination">
              <span>
                共 {pagination.total.toLocaleString()} 条，当前 {pagination.rangeStart}-
                {pagination.rangeEnd} 条
              </span>
              <div className="api-keys-page-buttons">
                {pageButtons(pagination.page, pagination.pages).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={page === pagination.page ? 'api-keys-page-selected' : undefined}
                    aria-label={`第 ${page} 页`}
                    aria-current={page === pagination.page ? 'page' : undefined}
                    onClick={() => props.onPageChange?.(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
            </footer>
          </>
        )}
      </section>
    </section>
  );
}

function ApiKeysState(props: { state: ApiKeysPageState; errorMessage?: string }) {
  const loading = props.state === 'loading';
  return (
    <div className={`api-keys-state api-keys-state-${props.state}`} role="status">
      {loading ? (
        <LoaderCircle className="api-keys-spin" size={30} aria-hidden="true" />
      ) : (
        <AlertCircle size={30} aria-hidden="true" />
      )}
      <strong>{apiKeyStateMessage(props.state) || '暂无 API 密钥'}</strong>
      {props.errorMessage && <span>{props.errorMessage}</span>}
    </div>
  );
}

export function shouldRequestGroupChange(
  currentGroupId: string | undefined,
  nextGroupId: string,
  isWriting: boolean,
): boolean {
  return !isWriting && Boolean(nextGroupId) && nextGroupId !== currentGroupId;
}

export function apiKeyStateMessage(state: ApiKeysPageState): string {
  return {
    loading: '正在读取 API 密钥…',
    empty: '当前站点暂无 API 密钥',
    error: 'API 密钥读取失败',
    unsupported: '当前站点不支持 API 密钥管理',
    'auth-required': '登录已失效，请重新登录',
    success: '',
    refreshing: '正在刷新，已保留当前数据',
    partial: '部分用量暂未读取，其他数据已可用',
  }[state];
}

export function normalizeApiKeyPagination(pagination: ApiKeyPagination) {
  const pages = Math.max(0, Math.trunc(pagination.pages));
  const pageSize = pagination.pageSize > 0 ? Math.trunc(pagination.pageSize) : 20;
  const page = pages === 0 ? 1 : Math.min(Math.max(1, Math.trunc(pagination.page)), pages);
  const total = Math.max(0, Math.trunc(pagination.total));
  return {
    page,
    pageSize,
    pages,
    total,
    rangeStart: total === 0 ? 0 : (page - 1) * pageSize + 1,
    rangeEnd: total === 0 ? 0 : Math.min(total, page * pageSize),
  };
}

function pageButtons(page: number, pages: number): number[] {
  if (pages <= 0) return [];
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const end = Math.min(pages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function formatCost(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `$${value.toFixed(4)}` : '待查询';
}

function formatRate(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)}x` : '待查询';
}

function formatOptionalNumber(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '待查询';
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '待查询' : date.toLocaleString();
}

function statusLabel(status: ApiKeyStatus): string {
  return {
    active: '活跃',
    disabled: '停用',
    exhausted: '额度耗尽',
    expired: '已过期',
    unknown: '未知',
  }[status];
}
