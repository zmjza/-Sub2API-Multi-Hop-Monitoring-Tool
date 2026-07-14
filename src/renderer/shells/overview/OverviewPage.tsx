import { ArrowDownUp, CheckCircle2, Clock3, RefreshCw, Sigma, WalletCards } from 'lucide-react';
import { formatTokenCount } from '../../lib/format';
import type { OverviewProps } from './types';
import { overviewSites } from './data';
import './overview.css';
export function OverviewPage(props: OverviewProps) {
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
            <div className="site-table" role="table">
              <div className="site-row site-head" role="row">
                <span>站点</span>
                <span>默认 Key</span>
                <span>倍率</span>
                <span>余额 / 消耗</span>
                <span>状态</span>
                <span>更新时间</span>
              </div>
              {liveSites.map((site, index) => (
                <div
                  className={`site-row ${('id' in site && site.id === props.selectedSite?.id) || (index === 0 && props.state === 'selected') ? 'selected' : ''}`}
                  role="row"
                  key={site.name}
                  onClick={() =>
                    'id' in site && typeof site.id === 'string'
                      ? props.onSelectSite?.(site.id)
                      : undefined
                  }
                >
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
                  <span className="muted truncate">
                    {'id' in site &&
                    site.id === props.selectedSite?.id &&
                    props.keyOptions?.length ? (
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
                  </span>
                  <span>
                    {'rate' in site && typeof site.rate === 'number'
                      ? `${site.rate}x`
                      : '倍率不可用'}
                  </span>
                  <span>
                    <b>
                      {typeof site.balance === 'number'
                        ? `$${site.balance.toFixed(2)}`
                        : site.balance}
                    </b>
                    <small>
                      {typeof site.todayActualCost === 'number'
                        ? `$${site.todayActualCost.toFixed(2)} 今日`
                        : '$0.45 今日'}
                    </small>
                  </span>
                  <span
                    className={
                      site.status === 'success'
                        ? 'status-pill good'
                        : site.status === 'error' || site.status === 'auth-required'
                          ? 'status-pill bad'
                          : 'status-pill warn'
                    }
                  >
                    {site.status === 'success'
                      ? '正常'
                      : site.status === 'auth-required'
                        ? '需登录'
                        : site.status === 'stale'
                          ? '数据过期'
                          : site.status === 'partial'
                            ? '部分可用'
                            : site.status === 'error'
                              ? '查询失败'
                              : site.status}
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
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
