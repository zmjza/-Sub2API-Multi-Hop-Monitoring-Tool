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
  BadgePercent,
  Activity,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChannelDetailPayload,
  ChannelViewPayload,
} from '../../../../electron/shared/contracts';
import { formatTokenCount } from '../../lib/format';
import type { OverviewProps } from './types';
import { overviewSites } from './data';
import { RechargeRatioControl } from './RechargeRatioControl';
import { RatePopover } from './RatePopover';
import { ChannelStatusPopover } from './ChannelStatusPopover';
import type { ChannelStatusCache } from './ChannelStatusPopover';
import type { AvailableChannelRelationship } from '../channels/channel-ranking';
import { RateChannelStatusLoader } from './rate-channel-status-loader';
import {
  RateChannelSummary,
  type InlineChannelDetailState,
  type InlineChannelListState,
} from './RateChannelSummary';
import {
  comparePlatformRates,
  formatRateMultiplier,
  type RateChannelSnapshot,
} from './rate-comparison';
import './overview.css';
export function OverviewPage(props: OverviewProps) {
  const [editingId, setEditingId] = useState<string>();
  const [draftNote, setDraftNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [ratePopover, setRatePopover] = useState<{ siteId: string; anchor: HTMLElement }>();
  const [channelPopover, setChannelPopover] = useState<{
    siteId: string;
    anchor: HTMLElement;
  }>();
  const [channelStatusCacheBySite, setChannelStatusCacheBySite] = useState<
    Record<string, ChannelStatusCache>
  >({});
  const [rateChannelsBySite, setRateChannelsBySite] = useState<
    Record<string, RateChannelSnapshot[]>
  >({});
  const [rateChannelRelationshipsBySite, setRateChannelRelationshipsBySite] = useState<
    Record<string, AvailableChannelRelationship[]>
  >({});
  const [rateChannelStateBySite, setRateChannelStateBySite] = useState<
    Record<string, 'supported' | 'unsupported' | 'error'>
  >({});
  const [inlineChannelListStateBySite, setInlineChannelListStateBySite] = useState<
    Record<string, InlineChannelListState>
  >({});
  const [inlineChannelDetailStateByKey, setInlineChannelDetailStateByKey] = useState<
    Record<string, InlineChannelDetailState>
  >({});
  const inlineChannelRequestBySiteRef = useRef(new Map<string, number>());
  const inlineDetailRequestByKeyRef = useRef(new Map<string, number>());
  const inlineRequestIdRef = useRef(0);
  const channelStatusLoaderRef = useRef<RateChannelStatusLoader | null>(null);
  if (!channelStatusLoaderRef.current)
    channelStatusLoaderRef.current = new RateChannelStatusLoader({
      readChannels: async (siteId) => {
        const value = await window.sub2apiDesktop?.sites.channels(siteId);
        if (!value || typeof value !== 'object' || !('state' in value))
          throw new Error('Invalid channel list response');
        return value as ChannelViewPayload;
      },
      readDetail: async (siteId, channelId) => {
        const value = await window.sub2apiDesktop?.sites.channelStatus(siteId, channelId);
        if (!value || typeof value !== 'object' || !('state' in value))
          throw new Error('Invalid channel detail response');
        return value as ChannelDetailPayload;
      },
    });
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
  const rateComparisons = comparePlatformRates(
    liveSites.map((site) => ({
      siteId: site.id,
      siteName: siteNote(site) || site.name,
      ratio: props.rateContexts?.ratios[site.id],
      groups: props.rateContexts?.sites[site.id]?.groups ?? [],
      channels: rateChannelsBySite[site.id],
      relationships: rateChannelRelationshipsBySite[site.id],
      channelState: rateChannelStateBySite[site.id],
    })),
  );
  const pendingRatioCount = liveSites.filter(
    (site) => props.rateContexts?.ratios[site.id] === undefined,
  ).length;
  const comparableSiteIdsKey = JSON.stringify(
    liveSites
      .filter(
        (site) =>
          props.rateContexts?.ratios[site.id] !== undefined &&
          (props.rateContexts?.sites[site.id]?.groups.length ?? 0) > 0,
      )
      .map((site) => site.id)
      .sort((left, right) => left.localeCompare(right)),
  );
  const matchedChannelKeys = JSON.stringify(
    [
      ...new Set(
        rateComparisons.flatMap((comparison) =>
          comparison.sites.flatMap((site) =>
            site.channelId ? [`${site.siteId}:${site.channelId}`] : [],
          ),
        ),
      ),
    ].sort((left, right) => left.localeCompare(right)),
  );

  const loadInlineChannels = useCallback(async (siteId: string, force = false) => {
    const requestId = ++inlineRequestIdRef.current;
    inlineChannelRequestBySiteRef.current.set(siteId, requestId);
    setInlineChannelListStateBySite((current) => ({ ...current, [siteId]: 'loading' }));
    try {
      const envelope = await channelStatusLoaderRef.current!.loadChannels(siteId, force);
      if (inlineChannelRequestBySiteRef.current.get(siteId) !== requestId) return;
      const channels = envelope.state === 'supported' ? envelope.channels : [];
      setRateChannelsBySite((current) => ({ ...current, [siteId]: channels }));
      setRateChannelRelationshipsBySite((current) => ({
        ...current,
        [siteId]: envelope.availableChannels ?? [],
      }));
      setRateChannelStateBySite((current) => ({
        ...current,
        [siteId]: envelope.state === 'supported' ? 'supported' : 'unsupported',
      }));
      setInlineChannelListStateBySite((current) => ({
        ...current,
        [siteId]:
          envelope.state === 'unsupported'
            ? 'unsupported'
            : channels.length === 0
              ? 'no-data'
              : 'success',
      }));
      setChannelStatusCacheBySite((current) => ({
        ...current,
        [siteId]: channelStatusLoaderRef.current!.cacheForSite(siteId),
      }));
    } catch {
      if (inlineChannelRequestBySiteRef.current.get(siteId) !== requestId) return;
      setRateChannelStateBySite((current) => ({ ...current, [siteId]: 'error' }));
      setInlineChannelListStateBySite((current) => ({ ...current, [siteId]: 'error' }));
    }
  }, []);

  const loadInlineDetail = useCallback(async (siteId: string, channelId: string, force = false) => {
    const key = `${siteId}:${channelId}`;
    const requestId = ++inlineRequestIdRef.current;
    inlineDetailRequestByKeyRef.current.set(key, requestId);
    setInlineChannelDetailStateByKey((current) => ({
      ...current,
      [key]: { state: 'loading' },
    }));
    try {
      const payload = await channelStatusLoaderRef.current!.loadDetail(siteId, channelId, force);
      if (inlineDetailRequestByKeyRef.current.get(key) !== requestId) return;
      setInlineChannelDetailStateByKey((current) => ({
        ...current,
        [key]: { state: 'success', payload },
      }));
      setChannelStatusCacheBySite((current) => ({
        ...current,
        [siteId]: channelStatusLoaderRef.current!.cacheForSite(siteId),
      }));
    } catch {
      if (inlineDetailRequestByKeyRef.current.get(key) !== requestId) return;
      setInlineChannelDetailStateByKey((current) => ({
        ...current,
        [key]: { state: 'error' },
      }));
    }
  }, []);

  const syncChannelStatusCache = useCallback((siteId: string, cache: ChannelStatusCache) => {
    channelStatusLoaderRef.current?.seed(siteId, cache);
    setChannelStatusCacheBySite((current) => ({ ...current, [siteId]: cache }));
    if (cache.channels?.state === 'supported') {
      setRateChannelRelationshipsBySite((current) => ({
        ...current,
        [siteId]: cache.channels?.availableChannels ?? [],
      }));
      setInlineChannelListStateBySite((current) => ({
        ...current,
        [siteId]: cache.channels?.channels.length ? 'success' : 'no-data',
      }));
    }
    setInlineChannelDetailStateByKey((current) => {
      const next = { ...current };
      for (const [channelId, payload] of Object.entries(cache.details))
        next[`${siteId}:${channelId}`] = { state: 'success', payload };
      return next;
    });
  }, []);

  useEffect(() => {
    if (!window.sub2apiDesktop) return;
    const siteIds = JSON.parse(comparableSiteIdsKey) as string[];
    for (const siteId of siteIds) void loadInlineChannels(siteId);
  }, [comparableSiteIdsKey, loadInlineChannels]);

  useEffect(() => {
    if (!window.sub2apiDesktop) return;
    const keys = JSON.parse(matchedChannelKeys) as string[];
    for (const key of keys) {
      const separator = key.indexOf(':');
      void loadInlineDetail(key.slice(0, separator), key.slice(separator + 1));
    }
  }, [loadInlineDetail, matchedChannelKeys]);
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
      <section className="rate-comparison-band" aria-label="跨站倍率对比">
        <div className="rate-comparison-heading">
          <div>
            <h2>倍率对比</h2>
            <span>按充值比例折算后，比较各平台最低分组</span>
          </div>
          <button
            type="button"
            aria-label="刷新全部站点倍率"
            title="刷新全部站点倍率"
            onClick={() => void props.onRefreshAllRates?.()}
            disabled={props.isRefreshingRates || liveSites.length === 0}
          >
            <RefreshCw size={16} className={props.isRefreshingRates ? 'spin' : ''} />
          </button>
        </div>
        {rateComparisons.length > 0 ? (
          <div className="rate-comparison-list" tabIndex={0} aria-label="倍率平台横向列表">
            {rateComparisons.map((comparison) => (
              <article
                key={comparison.platformKey}
                className={`rate-platform-card rate-platform-${comparison.platformKey}`}
                data-platform={comparison.platformKey}
              >
                <header>
                  <div>
                    <span>{comparison.platformLabel}</span>
                    <small>综合推荐</small>
                  </div>
                  <strong>
                    {comparison.stabilityScore * 0.4 + comparison.priceScore * 0.6 >= 0
                      ? `${(comparison.stabilityScore * 0.4 + comparison.priceScore * 0.6).toFixed(1)} 分`
                      : '—'}
                  </strong>
                </header>
                <div className="rate-platform-score-row">
                  <span>
                    价格 <b>{comparison.priceScore.toFixed(1)}</b>
                  </span>
                  <span>
                    稳定 <b>{comparison.stabilityScore.toFixed(1)}</b>
                  </span>
                  <span className={`rate-status-label ${comparison.stabilityLabel}`}>
                    {comparison.stabilityLabel}
                  </span>
                </div>
                <div className="rate-platform-rate">
                  {formatRateMultiplier(comparison.effectiveRate)}
                </div>
                <div className="rate-platform-sites">
                  {comparison.sites.map((site, index) => {
                    const group = site.groups[0];
                    const channel = site.channelId
                      ? rateChannelsBySite[site.siteId]?.find(
                          (candidate) => candidate.id === site.channelId,
                        )
                      : undefined;
                    const detailKey = site.channelId
                      ? `${site.siteId}:${site.channelId}`
                      : undefined;
                    return (
                      <article
                        className="rate-platform-site"
                        key={`${site.siteId}:${group?.id ?? index}`}
                      >
                        <b title={site.siteName}>
                          <i>{index + 1}</i>
                          {site.siteName}
                        </b>
                        <span title={group?.name}>{group?.name ?? '未命名分组'}</span>
                        <em className={`rate-status-label ${site.stabilityLabel}`}>
                          {site.stabilityLabel}
                        </em>
                        <small>
                          综合 {site.totalScore.toFixed(1)} · 折算{' '}
                          {formatRateMultiplier(site.effectiveRate)} · 原始{' '}
                          {formatRateMultiplier(site.rawRate)} · 1:{site.ratio} · 价格{' '}
                          {site.priceScore.toFixed(1)} · 稳定 {site.stabilityScore.toFixed(1)}
                        </small>
                        <RateChannelSummary
                          siteName={site.siteName}
                          groupName={group?.name ?? '未命名分组'}
                          listState={inlineChannelListStateBySite[site.siteId] ?? 'loading'}
                          channel={channel}
                          detailState={
                            detailKey ? inlineChannelDetailStateByKey[detailKey] : undefined
                          }
                          onRetry={() =>
                            site.channelId
                              ? void loadInlineDetail(site.siteId, site.channelId, true)
                              : void loadInlineChannels(site.siteId, true)
                          }
                        />
                      </article>
                    );
                  })}
                </div>
                {comparison.sites.filter(
                  (site) => Math.abs(site.totalScore - comparison.sites[0]!.totalScore) < 1e-9,
                ).length > 1 && <i>并列推荐</i>}
              </article>
            ))}
          </div>
        ) : (
          <div className="rate-comparison-empty" role="status">
            <BadgePercent size={19} className={props.isRefreshingRates ? 'spin' : ''} />
            <span>
              {props.isRefreshingRates
                ? '正在比较各站点倍率…'
                : pendingRatioCount > 0
                  ? `暂无可比较站点 · ${pendingRatioCount} 个站点待设置充值比例`
                  : '暂无可比较站点'}
            </span>
          </div>
        )}
      </section>
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
                disabled={!props.selectedSite || props.isRefreshingAll}
              >
                <RefreshCw size={16} className={props.isRefreshingAll ? 'spin' : ''} />
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
                  key={site.id}
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
                    <span
                      className={`status-pill ${props.refreshingSiteIds?.includes(site.id) ? 'refreshing' : statusTone(site.status)}`}
                    >
                      {props.refreshingSiteIds?.includes(site.id)
                        ? '刷新中'
                        : statusLabel(site.status)}
                    </span>
                  </div>
                  <div className="site-card-key">
                    {'id' in site && shouldShowKeySelect(site.id, props) ? (
                      <select
                        className="overview-key-select"
                        aria-label={`${site.name} 默认 Key`}
                        value={
                          keyContextForSite(site.id, props).preference.mode === 'manual'
                            ? keyContextForSite(site.id, props).preference.keyId
                            : 'auto'
                        }
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          const keyId = event.target.value;
                          props.onKeyPreferenceChange?.(
                            site.id,
                            keyId === 'auto' ? { mode: 'auto' } : { mode: 'manual', keyId },
                          );
                        }}
                      >
                        <option value="auto">自动选择</option>
                        {keyContextForSite(site.id, props)
                          .keys.filter((key) => key.status === 'active')
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
                          const siteId = 'id' in site ? site.id : '';
                          const request = props.onSiteNoteChange?.(siteId, draftNote);
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
                  <div className="site-card-actions">
                    <RechargeRatioControl
                      siteName={site.name}
                      ratio={props.rateContexts?.ratios[site.id]}
                      onChange={(ratio) =>
                        props.onRechargeRatioChange?.(site.id, ratio) ?? Promise.resolve()
                      }
                    />
                    <button
                      type="button"
                      className="view-rates-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setRatePopover({ siteId: site.id, anchor: event.currentTarget });
                        const context = props.rateContexts?.sites[site.id];
                        if ((!context || context.source === 'none') && props.onRefreshSiteRates)
                          void props.onRefreshSiteRates(site.id);
                      }}
                      onDoubleClick={(event) => event.stopPropagation()}
                    >
                      <BadgePercent size={14} />
                      查看倍率
                    </button>
                    <button
                      type="button"
                      className="view-channel-status-button"
                      aria-label={`查看 ${site.name} 渠道状态`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setChannelPopover({
                          siteId: site.id,
                          anchor: event.currentTarget,
                        });
                      }}
                      onDoubleClick={(event) => event.stopPropagation()}
                    >
                      <Activity size={14} />
                      查看渠道状态
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {ratePopover && (
        <RatePopover
          anchor={ratePopover.anchor}
          siteName={liveSites.find((site) => site.id === ratePopover.siteId)?.name ?? '当前站点'}
          context={props.rateContexts?.sites[ratePopover.siteId]}
          ratio={props.rateContexts?.ratios[ratePopover.siteId]}
          refreshing={Boolean(props.refreshingRateSiteIds?.includes(ratePopover.siteId))}
          onRefresh={() => props.onRefreshSiteRates?.(ratePopover.siteId) ?? Promise.resolve()}
          onClose={() => setRatePopover(undefined)}
        />
      )}
      {channelPopover && (
        <ChannelStatusPopover
          anchor={channelPopover.anchor}
          siteId={channelPopover.siteId}
          siteName={liveSites.find((site) => site.id === channelPopover.siteId)?.name ?? '当前站点'}
          cache={channelStatusCacheBySite[channelPopover.siteId]}
          onCacheChange={(cache) => syncChannelStatusCache(channelPopover.siteId, cache)}
          onLoaded={(channels) => {
            setRateChannelsBySite((current) => ({
              ...current,
              [channelPopover.siteId]: channels,
            }));
            setInlineChannelListStateBySite((current) => ({
              ...current,
              [channelPopover.siteId]: channels.length ? 'success' : 'no-data',
            }));
          }}
          onStateChange={(state) => {
            setRateChannelStateBySite((current) => ({
              ...current,
              [channelPopover.siteId]: state,
            }));
            if (state !== 'supported')
              setInlineChannelListStateBySite((current) => ({
                ...current,
                [channelPopover.siteId]: state === 'unsupported' ? 'unsupported' : 'error',
              }));
          }}
          onClose={() => setChannelPopover(undefined)}
        />
      )}
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
  if (!value.id) return undefined;
  const context = keyContextForSite(value.id, props);
  if (context.preference.mode !== 'manual') return undefined;
  const key = context.keys.find((candidate) => candidate.id === context.preference.keyId);
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

function keyContextForSite(siteId: string, props: OverviewProps) {
  return (
    props.keyContexts?.[siteId] ?? {
      keys: siteId === props.selectedSite?.id ? (props.keyOptions ?? []) : [],
      preference:
        siteId === props.selectedSite?.id
          ? (props.keyPreference ?? { mode: 'auto' as const })
          : { mode: 'auto' as const },
    }
  );
}

function shouldShowKeySelect(siteId: string, props: OverviewProps): boolean {
  const context = keyContextForSite(siteId, props);
  return siteId === props.selectedSite?.id || context.preference.mode === 'manual';
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
