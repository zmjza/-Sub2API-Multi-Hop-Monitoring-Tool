import {
  ArrowDownUp,
  CheckCircle2,
  Clock3,
  Edit3,
  RefreshCw,
  Sigma,
  WalletCards,
  X,
  Check,
} from 'lucide-react';
import { useState } from 'react';
import { formatTokenCount } from '../../lib/format';
import type { OverviewProps } from './types';
import { overviewSites } from './data';
import './overview.css';
export function OverviewPage(props: OverviewProps) {
  const [editingId, setEditingId] = useState<string>();
  const [draftNote, setDraftNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState('');
  const runtime = Boolean(window.sub2apiDesktop);
  const isEmpty =
    props.state === 'empty' || Boolean(props.dashboard && props.dashboard.sites.length === 0);
  const isLoading = props.state === 'loading' || (runtime && !props.dashboard);
  const liveSites =
    props.dashboard?.sites ??
    (runtime
      ? []
      : overviewSites.map((site, index) => ({
          id: `preview-${index}`,
          name: site.name,
          baseUrl: 'https://example.invalid',
          balance: Number(site.balance.replace('$', '')),
          todayTokens: 0,
          todayActualCost: 0,
          status: site.status === '正常' ? 'success' : 'stale',
          source: 'cache' as const,
          errors: [],
        })));
  const healthySites =
    props.dashboard?.sites.filter((site) => site.status === 'success').length ?? 0;
  return (
    <section className="overview-page">
      <div className="overview-metrics">
        {[
          [
            '总余额',
            props.dashboard ? `$${props.dashboard.totals.balance.toFixed(2)}` : '$12,450.80',
            WalletCards,
            'balance',
          ],
          [
            '今日消耗 Token',
            props.dashboard ? formatTokenCount(props.dashboard.totals.todayTokens) : '1.24M',
            Clock3,
            'tokens',
          ],
          [
            '今日消耗',
            props.dashboard ? `$${props.dashboard.totals.todayActualCost.toFixed(2)}` : '$45.20',
            ArrowDownUp,
            'cost',
          ],
          [
            '站点状态',
            props.dashboard ? `${healthySites} 正常` : '24 正常',
            CheckCircle2,
            'status',
          ],
          [
            '已统计',
            props.dashboard
              ? `${props.dashboard.totals.counted} / ${props.dashboard.totals.total}`
              : '24 / 28',
            Sigma,
            'counted',
          ],
        ].map(([label, value, Icon, kind]) => (
          <article className={`metric-card metric-${kind as string}`} key={label as string}>
            <div className="metric-icon">
              <Icon size={18} />
            </div>
            <span>{label as string}</span>
            {isLoading ? <div className="skeleton-value" /> : <strong>{value as string}</strong>}
          </article>
        ))}
      </div>
      <div className="overview-grid">
        <section className="data-panel site-panel">
          <div className="panel-heading">
            <div>
              <h2>站点状态</h2>
              <span>余额、Key 倍率和最近一次查询结果</span>
            </div>
            <div className="panel-actions">
              <button className="overview-sort-button">
                <ArrowDownUp size={15} />
                排序
              </button>
              <button
                className="overview-refresh-button"
                aria-label="刷新站点"
                onClick={props.onRefreshSite}
                disabled={!props.selectedSite || props.state === 'refreshing'}
              >
                <RefreshCw size={16} className={props.state === 'refreshing' ? 'spin' : ''} />
              </button>
            </div>
          </div>
          {isEmpty ? (
            <div className="empty-state">
              <WalletCards size={28} />
              <strong>还没有正式站点</strong>
              <span>添加一个中转站后，这里会显示实时概览。</span>
            </div>
          ) : (
            <div className="site-card-grid">
              {liveSites.map((site, index) => (
                <div
                  className={`site-card ${('id' in site && site.id === props.selectedSite?.id) || (index === 0 && props.state === 'selected') ? 'selected' : ''}`}
                  key={site.name}
                  onClick={() =>
                    'id' in site && typeof site.id === 'string'
                      ? props.onSelectSite?.(site.id)
                      : undefined
                  }
                  onDoubleClick={() => {
                    if (!('id' in site) || typeof site.id !== 'string') return;
                    setEditingId(site.id);
                    setDraftNote(siteNote(site));
                    setNoteError('');
                  }}
                >
                  <div className="site-card-header">
                    <span className="site-name">
                      <i
                        className={
                          site.status === 'success' || site.status === '正常'
                            ? 'status-dot good'
                            : 'status-dot warn'
                        }
                      />
                      {site.name}
                    </span>
                    <span className={`status-pill ${statusTone(site.status)}`}>
                      {statusLabel(site.status)}
                    </span>
                  </div>
                  <div className="site-card-key">
                    {'id' in site && site.id === props.selectedSite?.id && props.keyOptions ? (
                      <select
                        className="overview-key-select"
                        aria-label={`${site.name} 默认 Key`}
                        value={
                          props.keyPreference?.mode === 'manual'
                            ? props.keyPreference.keyId
                            : 'auto'
                        }
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          const keyId = event.target.value;
                          props.onKeyPreferenceChange?.(
                            keyId === 'auto' ? { mode: 'auto' } : { mode: 'manual', keyId },
                          );
                        }}
                      >
                        <option value="auto">自动选择</option>
                        {props.keyOptions
                          .filter((key) => key.status === 'active')
                          .map((key) => (
                            <option value={key.id} key={key.id}>
                              {key.maskedLabel}
                            </option>
                          ))}
                      </select>
                    ) : 'defaultKeyLabel' in site && typeof site.defaultKeyLabel === 'string' ? (
                      site.defaultKeyLabel
                    ) : (
                      '默认 Key · 已脱敏'
                    )}
                  </div>
                  <div className="site-card-meta">
                    <span>
                      {'rate' in site && typeof site.rate === 'number'
                        ? `${site.rate}x`
                        : '倍率不可用'}
                    </span>
                    <span className="site-card-balance">
                      <b>{formatSiteBalance(site, props)}</b>
                      {quotaForSite(site, props) ? (
                        <span className="quota-summary">
                          <span>
                            已用 ${quotaForSite(site, props)!.used.toFixed(2)} / 总额 $
                            {quotaForSite(site, props)!.total.toFixed(2)}
                          </span>
                          <span
                            className={`quota-progress ${quotaForSite(site, props)!.remaining <= 0 ? 'exhausted' : ''}`}
                            aria-label={`额度使用 ${quotaForSite(site, props)!.percent}%`}
                          >
                            <i style={{ width: `${quotaForSite(site, props)!.percent}%` }} />
                          </span>
                          <small>
                            {quotaForSite(site, props)!.remaining <= 0
                              ? '额度已用尽'
                              : `剩余 $${quotaForSite(site, props)!.remaining.toFixed(2)}`}
                          </small>
                        </span>
                      ) : (
                        <small>
                          {typeof site.todayActualCost === 'number'
                            ? `$${site.todayActualCost.toFixed(2)} 今日`
                            : '$0.45 今日'}
                        </small>
                      )}
                    </span>
                    <span className="muted">
                      {'fetchedAt' in site && typeof site.fetchedAt === 'number'
                        ? new Date(site.fetchedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '尚未更新'}
                    </span>
                  </div>
                  <div className="site-card-stats" aria-label={`${site.name} 今日统计`}>
                    <span>
                      <small>今日请求</small>
                      <b>
                        {'todayRequests' in site && typeof site.todayRequests === 'number'
                          ? site.todayRequests
                          : '—'}
                      </b>
                    </span>
                    <span>
                      <small>今日 Token</small>
                      <b>
                        {'todayTokens' in site && typeof site.todayTokens === 'number'
                          ? formatTokenCount(site.todayTokens)
                          : '—'}
                      </b>
                    </span>
                    <span>
                      <small>今日消费</small>
                      <b>
                        {'todayActualCost' in site && typeof site.todayActualCost === 'number'
                          ? `$${site.todayActualCost.toFixed(4)}`
                          : '—'}
                      </b>
                    </span>
                  </div>
                  <div className="site-card-note">
                    {editingId === ('id' in site ? site.id : '') ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          setSavingNote(true);
                          const request = props.onSiteNoteChange?.(draftNote);
                          if (request)
                            void request
                              .then(() => setEditingId(undefined))
                              .catch(() => setNoteError('备注保存失败，请重试'))
                              .finally(() => setSavingNote(false));
                          else setSavingNote(false);
                        }}
                      >
                        <input
                          autoFocus
                          maxLength={500}
                          value={draftNote}
                          onChange={(event) => setDraftNote(event.target.value)}
                          aria-label="站点备注"
                        />
                        <button type="submit" aria-label="保存备注" disabled={savingNote}>
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="取消备注"
                          onClick={() => setEditingId(undefined)}
                        >
                          <X size={14} />
                        </button>
                        {noteError && <small className="note-error">{noteError}</small>}
                      </form>
                    ) : (
                      <span>
                        {siteNote(site) || '双击添加备注'} <Edit3 size={13} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function statusLabel(status: string): string {
  return (
    (
      {
        success: '正常',
        'auth-required': '需登录',
        stale: '数据过期',
        partial: '部分可用',
        error: '查询失败',
        empty: '待查询',
      } as Record<string, string>
    )[status] ?? status
  );
}

function statusTone(status: string): string {
  return status === 'success'
    ? 'good'
    : status === 'error' || status === 'auth-required'
      ? 'bad'
      : 'warn';
}

export function quotaForSite(
  site: unknown,
  props: OverviewProps,
): { total: number; used: number; remaining: number; percent: number } | undefined {
  const value =
    typeof site === 'object' && site !== null ? (site as { id?: string; balance?: unknown }) : {};
  if (value.id !== props.selectedSite?.id || props.keyPreference?.mode !== 'manual')
    return undefined;
  const key = props.keyOptions?.find((candidate) => candidate.id === props.keyPreference?.keyId);
  if (!key || typeof key.quota !== 'number' || !Number.isFinite(key.quota) || key.quota <= 0)
    return undefined;
  const used =
    typeof key.quotaUsed === 'number' && Number.isFinite(key.quotaUsed)
      ? Math.max(0, key.quotaUsed)
      : 0;
  const remaining = Math.max(0, key.quota - used);
  return {
    total: key.quota,
    used,
    remaining,
    percent: Math.min(100, Math.max(0, (used / key.quota) * 100)),
  };
}

export function formatSiteBalance(site: unknown, props: OverviewProps): string {
  const quota = quotaForSite(site, props);
  if (quota) return `$${quota.remaining.toFixed(2)}`;
  const value =
    typeof site === 'object' && site !== null ? (site as { id?: string; balance?: unknown }) : {};
  return typeof value.balance === 'number'
    ? `$${value.balance.toFixed(2)}`
    : String(value.balance ?? '—');
}

function siteNote(site: unknown): string {
  return typeof site === 'object' &&
    site !== null &&
    'note' in site &&
    typeof site.note === 'string'
    ? site.note
    : '';
}
