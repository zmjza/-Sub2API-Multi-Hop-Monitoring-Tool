import {
  ArrowDownUp,
  CheckCircle2,
  Clock3,
  Edit3,
  GripVertical,
  RefreshCw,
  Sigma,
  WalletCards,
  X,
  Check,
  BadgePercent,
  Activity,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatTokenCount } from '../../lib/format';
import openAiLogo from '../../assets/rate-platforms/openai-official.svg';
import claudeLogo from '../../assets/rate-platforms/claude-official.svg';
import geminiLogo from '../../assets/rate-platforms/gemini-official.svg';
import grokLogo from '../../assets/rate-platforms/grok-official.svg';
import type { OverviewProps } from './types';
import type { ChannelAssociation } from '../../../../electron/shared/contracts';
import { overviewSites } from './data';
import { RechargeRatioControl } from './RechargeRatioControl';
import { RatePopover } from './RatePopover';
import { ChannelStatusPopover } from './ChannelStatusPopover';
import type { ChannelStatusCache } from './ChannelStatusPopover';
import {
  resolveChannelPresentation,
  type AvailableChannelRelationship,
} from '../channels/channel-ranking';
import {
  desktopRateChannelStatusLoader,
  type RateChannelStatusLoader,
} from './rate-channel-status-loader';
import {
  RateChannelSummary,
  type InlineChannelDetailState,
  type InlineChannelListState,
} from './RateChannelSummary';
import {
  comparePlatformRates,
  formatRateMultiplier,
  rateRefreshIntervalMs,
  type RateRefreshMinutes,
  type RateChannelSnapshot,
} from './rate-comparison';
import {
  aggregateCurrentKeyStats,
  availableCreditForKey,
  resolveEffectiveKey,
  type CurrentKeyStatsState,
} from './current-key-stats';
import { randomPollingDelayMs } from '../../channel-polling';
import './overview.css';

const ratePlatformLogos: Record<string, string> = {
  openai: openAiLogo,
  claude: claudeLogo,
  gemini: geminiLogo,
  grok: grokLogo,
};

export type InlineChannelRefreshState = {
  state: InlineChannelListState;
  refreshing: boolean;
  stale: boolean;
  lastSuccessAt?: number;
  failureReason?: 'network' | 'auth';
};

type InlineChannelRefreshEvent =
  | { type: 'refresh-started'; now: number }
  | {
      type: 'refresh-succeeded';
      now: number;
      state: Exclude<InlineChannelListState, 'loading' | 'error'>;
    }
  | { type: 'refresh-failed'; now: number; reason: 'network' | 'auth' };

export function reduceInlineChannelRefreshState(
  current: Partial<InlineChannelRefreshState> | undefined,
  event: InlineChannelRefreshEvent,
): InlineChannelRefreshState {
  if (event.type === 'refresh-succeeded')
    return {
      state: event.state,
      refreshing: false,
      stale: false,
      lastSuccessAt: event.now,
    };
  if (event.type === 'refresh-started') {
    if (current?.lastSuccessAt)
      return {
        state: current.state ?? 'success',
        refreshing: true,
        stale: false,
        lastSuccessAt: current.lastSuccessAt,
      };
    return { state: 'loading', refreshing: true, stale: false };
  }
  if (current?.lastSuccessAt)
    return {
      state: current.state ?? 'success',
      refreshing: false,
      stale: true,
      failureReason: event.reason,
      lastSuccessAt: current.lastSuccessAt,
    };
  return {
    state: 'error',
    refreshing: false,
    stale: false,
    failureReason: event.reason,
  };
}

export function OverviewPage(props: OverviewProps) {
  const [editingId, setEditingId] = useState<string>();
  const [draftNote, setDraftNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [draggingSiteId, setDraggingSiteId] = useState<string>();
  const [dropSiteId, setDropSiteId] = useState<string>();
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
  const [manualAssociationsBySite, setManualAssociationsBySite] = useState<
    Record<string, ChannelAssociation[]>
  >({});
  const [inlineChannelListStateBySite, setInlineChannelListStateBySite] = useState<
    Record<string, InlineChannelRefreshState>
  >({});
  const [inlineChannelDetailStateByKey, setInlineChannelDetailStateByKey] = useState<
    Record<string, InlineChannelDetailState>
  >({});
  const [rateRefreshMinutes, setRateRefreshMinutes] = useState<RateRefreshMinutes>(5);
  const inlineChannelRequestBySiteRef = useRef(new Map<string, number>());
  const inlineDetailRequestByKeyRef = useRef(new Map<string, number>());
  const inlineRequestIdRef = useRef(0);
  const channelStatusLoaderRef = useRef<RateChannelStatusLoader | null>(null);
  const comparisonRefreshPromiseRef = useRef<Promise<void> | undefined>(undefined);
  const channelPollingLastRunRef = useRef(Date.now());
  const refreshAllRatesRef = useRef(props.onRefreshAllRates);
  refreshAllRatesRef.current = props.onRefreshAllRates;
  if (!channelStatusLoaderRef.current)
    channelStatusLoaderRef.current = desktopRateChannelStatusLoader();
  const runtime = Boolean(window.sub2apiDesktop);
  const associationsBySite = { ...props.channelAssociationsBySite, ...manualAssociationsBySite };
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
  const currentKeyTotals = aggregateCurrentKeyStats(
    liveSites.map((site) => props.currentKeyStatsBySite?.[site.id] ?? { state: 'unknown' }),
  );
  const currentKeyCreditLabel =
    currentKeyTotals.availableCreditCount === 0
      ? '待查询'
      : `$${currentKeyTotals.availableCredit.toFixed(2)}`;
  const rateComparisons = comparePlatformRates(
    liveSites.map((site) => ({
      siteId: site.id,
      siteName: siteNote(site) || site.name,
      ratio: props.rateContexts?.ratios[site.id],
      groups: props.rateContexts?.sites[site.id]?.groups ?? [],
      channels: rateChannelsBySite[site.id],
      relationships: rateChannelRelationshipsBySite[site.id],
      channelState: rateChannelStateBySite[site.id],
      relationshipsState: channelStatusCacheBySite[site.id]?.channels?.availableChannelsState,
      channelAssociations: associationsBySite[site.id],
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
  const currentChannelContextBySite = Object.fromEntries(
    liveSites.map((site) => {
      const keyContext = keyContextForSite(site.id, props);
      const currentKey = resolveEffectiveKey(
        keyContext.keys,
        keyContext.preference,
        'defaultKeyId' in site ? site.defaultKeyId : undefined,
      );
      const groups = props.rateContexts?.sites[site.id]?.groups ?? [];
      const groupName =
        currentKey?.groupName ?? groups.find((group) => group.id === currentKey?.groupId)?.name;
      const manual = currentKey?.groupId
        ? associationsBySite[site.id]?.find(
            (item) => item.groupId === currentKey.groupId && item.source === 'manual',
          )
        : undefined;
      const channelPresentation = groupName
        ? resolveChannelPresentation(
            rateChannelsBySite[site.id] ?? [],
            groupName,
            rateChannelRelationshipsBySite[site.id] ?? [],
            currentKey?.groupId,
            manual?.channelIds ?? [],
            channelStatusCacheBySite[site.id]?.channels?.availableChannelsState,
            true,
          )
        : undefined;
      return [
        site.id,
        {
          currentKey,
          groupName,
          match: channelPresentation?.match,
          allMatches: channelPresentation?.association,
        },
      ] as const;
    }),
  );
  const channelSiteIdsKey = JSON.stringify(
    [
      ...new Set([
        ...(JSON.parse(comparableSiteIdsKey) as string[]),
        ...liveSites.flatMap((site) =>
          currentChannelContextBySite[site.id]?.groupName ? [site.id] : [],
        ),
      ]),
    ].sort((left, right) => left.localeCompare(right)),
  );
  const currentChannelDetailKeys = JSON.stringify(
    [
      ...new Set(
        liveSites.flatMap((site) => {
          const match = currentChannelContextBySite[site.id]?.match;
          return match?.status === 'matched' ? [`${site.id}:${match.channel.id}`] : [];
        }),
      ),
    ].sort((left, right) => left.localeCompare(right)),
  );

  const loadInlineChannels = useCallback(async (siteId: string, force = false, manual = false) => {
    const requestId = ++inlineRequestIdRef.current;
    inlineChannelRequestBySiteRef.current.set(siteId, requestId);
    setInlineChannelListStateBySite((current) => ({
      ...current,
      [siteId]: reduceInlineChannelRefreshState(current[siteId], {
        type: 'refresh-started',
        now: Date.now(),
      }),
    }));
    try {
      const envelope = await channelStatusLoaderRef.current!.loadChannels(siteId, force, manual);
      if (inlineChannelRequestBySiteRef.current.get(siteId) !== requestId) return;
      const storedAssociations = await window.sub2apiDesktop?.sites.channelAssociations(siteId);
      if (storedAssociations)
        setManualAssociationsBySite((current) => ({ ...current, [siteId]: storedAssociations }));
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
        [siteId]: reduceInlineChannelRefreshState(current[siteId], {
          type: 'refresh-succeeded',
          now: Date.now(),
          state:
            envelope.state === 'unsupported'
              ? 'unsupported'
              : channels.length === 0
                ? 'no-data'
                : 'success',
        }),
      }));
      setChannelStatusCacheBySite((current) => ({
        ...current,
        [siteId]: channelStatusLoaderRef.current!.cacheForSite(siteId),
      }));
    } catch (error) {
      if (inlineChannelRequestBySiteRef.current.get(siteId) !== requestId) return;
      const cached = channelStatusLoaderRef.current!.cacheForSite(siteId).channels;
      if (!cached) setRateChannelStateBySite((current) => ({ ...current, [siteId]: 'error' }));
      const reason =
        error instanceof Error && error.message.includes('CHANNEL_AUTH_REQUIRED')
          ? 'auth'
          : 'network';
      setInlineChannelListStateBySite((current) => ({
        ...current,
        [siteId]: reduceInlineChannelRefreshState(current[siteId], {
          type: 'refresh-failed',
          now: Date.now(),
          reason,
        }),
      }));
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
        [siteId]: reduceInlineChannelRefreshState(current[siteId], {
          type: 'refresh-succeeded',
          now: Date.now(),
          state: cache.channels?.channels.length ? 'success' : 'no-data',
        }),
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
    const siteIds = JSON.parse(channelSiteIdsKey) as string[];
    for (const siteId of siteIds) void loadInlineChannels(siteId);
  }, [channelSiteIdsKey, loadInlineChannels]);

  useEffect(() => {
    if (!window.sub2apiDesktop) return;
    const keys = JSON.parse(currentChannelDetailKeys) as string[];
    for (const key of keys) {
      const separator = key.indexOf(':');
      void loadInlineDetail(key.slice(0, separator), key.slice(separator + 1));
    }
  }, [currentChannelDetailKeys, loadInlineDetail]);

  useEffect(() => {
    if (!window.sub2apiDesktop) return;
    let active = true;
    const run = async () => {
      if (!active || document.visibilityState === 'hidden') return;
      channelPollingLastRunRef.current = Date.now();
      const siteIds = JSON.parse(channelSiteIdsKey) as string[];
      await Promise.allSettled(
        siteIds.map(
          (siteId, index) =>
            new Promise<void>((resolve) => {
              window.setTimeout(
                () => {
                  if (!active || document.visibilityState === 'hidden') {
                    resolve();
                    return;
                  }
                  void loadInlineChannels(siteId, true).finally(resolve);
                },
                index * 250 + Math.floor(Math.random() * 201),
              );
            }),
        ),
      );
      if (!active) return;
      const detailKeys = JSON.parse(currentChannelDetailKeys) as string[];
      await Promise.allSettled(
        detailKeys.map((key) => {
          const separator = key.indexOf(':');
          return loadInlineDetail(key.slice(0, separator), key.slice(separator + 1), true);
        }),
      );
    };
    let timer: number | undefined;
    const schedule = () => {
      if (!active) return;
      timer = window.setTimeout(async () => {
        await run();
        schedule();
      }, randomPollingDelayMs());
    };
    schedule();
    const onVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - channelPollingLastRunRef.current >= 30_000
      )
        void run();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [channelSiteIdsKey, currentChannelDetailKeys, loadInlineChannels, loadInlineDetail]);

  const refreshRateComparison = useCallback(() => {
    if (comparisonRefreshPromiseRef.current) return comparisonRefreshPromiseRef.current;
    const siteIds = JSON.parse(comparableSiteIdsKey) as string[];
    const request = (async () => {
      await refreshAllRatesRef.current?.();
      await Promise.all(siteIds.map((siteId) => loadInlineChannels(siteId, true)));
    })().finally(() => {
      if (comparisonRefreshPromiseRef.current === request)
        comparisonRefreshPromiseRef.current = undefined;
    });
    comparisonRefreshPromiseRef.current = request;
    return request;
  }, [comparableSiteIdsKey, loadInlineChannels]);

  useEffect(() => {
    if (!window.sub2apiDesktop || liveSites.length === 0) return;
    const interval = window.setInterval(
      () => void refreshRateComparison(),
      rateRefreshIntervalMs(rateRefreshMinutes),
    );
    return () => window.clearInterval(interval);
  }, [liveSites.length, rateRefreshMinutes, refreshRateComparison]);
  return (
    <section className="overview-page">
      <div className="overview-metrics">
        {[
          [
            '所选 Key 可用额度',
            props.dashboard ? currentKeyCreditLabel : '$12,450.80',
            WalletCards,
            'balance',
          ],
          [
            '今日消耗 Token',
            props.dashboard
              ? currentKeyTotals.counted
                ? formatTokenCount(currentKeyTotals.totalTokens)
                : '待查询'
              : '1.24M',
            Clock3,
            'tokens',
          ],
          [
            '今日消耗',
            props.dashboard
              ? currentKeyTotals.counted
                ? `$${currentKeyTotals.totalActualCost.toFixed(2)}`
                : '待查询'
              : '$45.20',
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
            props.dashboard ? `${currentKeyTotals.counted} / ${currentKeyTotals.total}` : '24 / 28',
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
          <div className="rate-comparison-controls">
            <label>
              <select
                aria-label="倍率对比自动刷新周期"
                value={rateRefreshMinutes}
                onChange={(event) =>
                  setRateRefreshMinutes(Number(event.target.value) as RateRefreshMinutes)
                }
              >
                <option value={1}>1 分钟</option>
                <option value={3}>3 分钟</option>
                <option value={5}>5 分钟</option>
                <option value={10}>10 分钟</option>
              </select>
            </label>
            <button
              type="button"
              aria-label="刷新全部站点倍率"
              title="刷新全部站点倍率"
              onClick={() => void refreshRateComparison()}
              disabled={props.isRefreshingRates || liveSites.length === 0}
            >
              <RefreshCw size={16} className={props.isRefreshingRates ? 'spin' : ''} />
            </button>
          </div>
        </div>
        {rateComparisons.length > 0 ? (
          <div className="rate-comparison-list" tabIndex={0} aria-label="倍率平台横向列表">
            {rateComparisons.map((comparison) => {
              const recommendation =
                comparison.state === 'ready'
                  ? comparison.sites.find((site) => site.recommendationKind === 'with-status')
                  : undefined;
              const secondaryRecommendation =
                comparison.state === 'ready'
                  ? comparison.sites.find((site) => site.recommendationKind === 'without-status')
                  : undefined;
              const leadingRecommendation = recommendation ?? secondaryRecommendation;
              const logo = ratePlatformLogos[comparison.platformKey];
              const multiplier = leadingRecommendation
                ? formatRateMultiplier(leadingRecommendation.effectiveRate).replace(/x$/, '')
                : '—';
              const stateLabel = recommendation
                ? recommendation.stabilityLabel
                : secondaryRecommendation
                  ? '无渠道状态'
                  : comparison.state === 'checking'
                    ? '核验中'
                    : '待推荐';

              return (
                <article
                  key={comparison.platformKey}
                  className={`rate-platform-card rate-platform-${comparison.platformKey}`}
                  data-platform={comparison.platformKey}
                  tabIndex={0}
                  aria-label={`${comparison.platformLabel} 倍率推荐`}
                >
                  <header className="rate-platform-header">
                    <div className="rate-platform-brand">
                      {logo ? (
                        <img
                          className="rate-platform-logo"
                          src={logo}
                          alt={`${comparison.platformLabel} 图标`}
                        />
                      ) : (
                        <span className="rate-platform-logo-fallback" aria-hidden="true">
                          <BadgePercent size={22} />
                        </span>
                      )}
                      <div className="rate-platform-identity">
                        <h3>{comparison.platformLabel}</h3>
                        <span className={`rate-platform-badge is-${comparison.state}`}>
                          {stateLabel}
                        </span>
                      </div>
                    </div>
                    <div className="rate-platform-multiplier">
                      <strong>
                        {multiplier}
                        {leadingRecommendation ? <small>x</small> : null}
                      </strong>
                      <span>倍率</span>
                    </div>
                  </header>

                  <div
                    className={`rate-platform-content is-${comparison.state}`}
                    role={recommendation || secondaryRecommendation ? undefined : 'status'}
                  >
                    {recommendation ? (
                      <>
                        <span className="rate-platform-state-icon" aria-hidden="true">
                          {recommendation.stabilityLabel === '稳定' ? (
                            <CheckCircle2 size={26} />
                          ) : (
                            <Activity size={26} />
                          )}
                        </span>
                        <p className="rate-platform-recommendation">
                          推荐渠道：
                          <b title={recommendation.siteName}>{recommendation.siteName}</b>
                        </p>
                        <div className="rate-platform-site">
                          <span title={recommendation.groups[0]?.name}>
                            {recommendation.groups[0]?.name ?? '未命名分组'}
                          </span>
                          <small>
                            原始 {formatRateMultiplier(recommendation.rawRate)} · 充值比例 1:
                            {recommendation.ratio}
                          </small>
                        </div>
                        <div className="rate-platform-score-row">
                          <span>
                            价格 <b>{recommendation.priceScore.toFixed(1)}</b>
                          </span>
                          <span>
                            稳定 <b>{recommendation.stabilityScore.toFixed(1)}</b>
                          </span>
                        </div>
                        <span
                          className={`rate-status-label ${recommendation.stabilityLabel === '稳定' ? '稳定' : '待核验'}`}
                        >
                          {recommendation.stabilityLabel === '稳定'
                            ? '近 1 分钟稳定'
                            : recommendation.recommendationKind === 'without-status'
                              ? '无渠道状态 · 价格优先'
                              : '待核验'}
                        </span>
                        {secondaryRecommendation && (
                          <div
                            className="rate-platform-secondary"
                            aria-label="无渠道状态最低价推荐"
                          >
                            <span>无渠道状态最低价</span>
                            <b title={secondaryRecommendation.siteName}>
                              {secondaryRecommendation.siteName}
                            </b>
                            <small>
                              {secondaryRecommendation.groups[0]?.name ?? '未命名分组'} ·{' '}
                              {formatRateMultiplier(secondaryRecommendation.effectiveRate)}
                            </small>
                          </div>
                        )}
                      </>
                    ) : secondaryRecommendation ? (
                      <>
                        <span className="rate-platform-state-icon" aria-hidden="true">
                          <Activity size={25} />
                        </span>
                        <strong>暂无有渠道状态</strong>
                        <small>以下为无渠道状态最低价推荐</small>
                        <div className="rate-platform-secondary" aria-label="无渠道状态最低价推荐">
                          <span>无渠道状态最低价</span>
                          <b title={secondaryRecommendation.siteName}>
                            {secondaryRecommendation.siteName}
                          </b>
                          <small>
                            {secondaryRecommendation.groups[0]?.name ?? '未命名分组'} ·{' '}
                            {formatRateMultiplier(secondaryRecommendation.effectiveRate)}
                          </small>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="rate-platform-state-icon" aria-hidden="true">
                          {comparison.state === 'checking' ? (
                            <RefreshCw size={25} className="spin" />
                          ) : (
                            <Activity size={25} />
                          )}
                        </span>
                        <strong>
                          {comparison.state === 'checking' ? '正在核验渠道稳定性' : '暂无稳定渠道'}
                        </strong>
                        <small>
                          {comparison.state === 'checking' ? '请稍候' : '正在持续核验中'}
                        </small>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
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
              {liveSites.map((site, index) => {
                const keyStats = props.currentKeyStatsBySite?.[site.id];
                const channelContext = currentChannelContextBySite[site.id];
                const matchedChannel =
                  channelContext?.match?.status === 'matched'
                    ? channelContext.match.channel
                    : undefined;
                const matchedChannels =
                  channelContext?.allMatches?.status === 'matched'
                    ? channelContext.allMatches.channels
                    : matchedChannel
                      ? [matchedChannel]
                      : [];
                const detailKey = matchedChannel ? `${site.id}:${matchedChannel.id}` : undefined;
                const matchState = !channelContext?.currentKey
                  ? 'no-key'
                  : !channelContext.groupName
                    ? 'no-group'
                    : (channelContext.match?.status ?? 'unmatched');
                return (
                  <div
                    className={`site-card ${('id' in site && site.id === props.selectedSite?.id) || (index === 0 && props.state === 'selected') ? 'selected' : ''} ${draggingSiteId === site.id ? 'is-dragging' : ''} ${dropSiteId === site.id ? 'is-drop-target' : ''}`}
                    key={site.id}
                    onDragOver={(event) => {
                      if (!draggingSiteId || draggingSiteId === site.id) return;
                      event.preventDefault();
                      setDropSiteId(site.id);
                    }}
                    onDragLeave={() =>
                      setDropSiteId((current) => (current === site.id ? undefined : current))
                    }
                    onDrop={(event) => {
                      event.preventDefault();
                      if (!draggingSiteId || draggingSiteId === site.id) return;
                      const order = moveSiteBefore(
                        liveSites.map((item) => item.id),
                        draggingSiteId,
                        site.id,
                      );
                      setDraggingSiteId(undefined);
                      setDropSiteId(undefined);
                      void props.onReorderSites?.(order);
                    }}
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
                      <button
                        type="button"
                        className="site-drag-handle"
                        draggable
                        aria-label={`调整 ${site.name} 顺序`}
                        title="拖动排序；方向键可移动"
                        onClick={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => event.stopPropagation()}
                        onDragStart={(event) => {
                          event.stopPropagation();
                          setDraggingSiteId(site.id);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', site.id);
                        }}
                        onDragEnd={() => {
                          setDraggingSiteId(undefined);
                          setDropSiteId(undefined);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                          event.preventDefault();
                          event.stopPropagation();
                          const order = moveSiteByOffset(
                            liveSites.map((item) => item.id),
                            site.id,
                            event.key === 'ArrowUp' ? -1 : 1,
                          );
                          void props.onReorderSites?.(order);
                        }}
                      >
                        <GripVertical size={16} aria-hidden />
                      </button>
                      <span className="site-name" title={site.name}>
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
                      <small className="site-card-group">
                        {channelContext?.currentKey?.groupName ?? '分组待查询'}
                      </small>
                    </div>
                    <div className="site-card-meta">
                      <span className="site-rate-badge" title="当前 Key 倍率">
                        <BadgePercent size={13} />
                        {'rate' in site && typeof site.rate === 'number'
                          ? formatRateMultiplier(site.rate)
                          : '—'}
                      </span>
                      <span className="site-card-balance">
                        <b>{formatCurrentKeyCredit(keyStats, site, props)}</b>
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
                          <small>{currentKeyStatsLabel(keyStats)}</small>
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
                          {keyStats?.state === 'success'
                            ? keyStats.totalRequests
                            : keyStatValue(keyStats)}
                        </b>
                      </span>
                      <span>
                        <small>今日 Token</small>
                        <b>
                          {keyStats?.state === 'success'
                            ? formatTokenCount(keyStats.totalTokens)
                            : keyStatValue(keyStats)}
                        </b>
                      </span>
                      <span>
                        <small>今日消费</small>
                        <b>
                          {keyStats?.state === 'success'
                            ? `$${keyStats.totalActualCost.toFixed(4)}`
                            : keyStatValue(keyStats)}
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
                    <RateChannelSummary
                      siteName={site.name}
                      groupName={channelContext?.groupName ?? '当前分组'}
                      listState={inlineChannelListStateBySite[site.id]?.state ?? 'loading'}
                      refreshState={inlineChannelListStateBySite[site.id]}
                      matchState={matchState}
                      channel={matchedChannel}
                      channels={matchedChannels}
                      detailState={detailKey ? inlineChannelDetailStateByKey[detailKey] : undefined}
                      onRetry={() =>
                        matchedChannel
                          ? void loadInlineDetail(site.id, matchedChannel.id, true)
                          : void loadInlineChannels(site.id, true)
                      }
                      onListRetry={() => void loadInlineChannels(site.id, true, true)}
                    />
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
                );
              })}
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
          channels={rateChannelsBySite[ratePopover.siteId]}
          relationships={rateChannelRelationshipsBySite[ratePopover.siteId]}
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
          loadChannels={(force) =>
            channelStatusLoaderRef.current!.loadChannels(channelPopover.siteId, force, force)
          }
          loadDetail={(channelId, force) =>
            channelStatusLoaderRef.current!.loadDetail(channelPopover.siteId, channelId, force)
          }
          associationGroupId={
            currentChannelContextBySite[channelPopover.siteId]?.currentKey?.groupId
          }
          associatedChannelIds={
            associationsBySite[channelPopover.siteId]?.find(
              (item) =>
                item.groupId ===
                  currentChannelContextBySite[channelPopover.siteId]?.currentKey?.groupId &&
                item.source === 'manual',
            )?.channelIds ?? []
          }
          onAssociationSave={async (groupId, channelIds) => {
            await props.onChannelAssociationSaveForSite?.(
              channelPopover.siteId,
              groupId,
              channelIds,
            );
            setManualAssociationsBySite((current) => {
              const previous = current[channelPopover.siteId] ?? [];
              const retained = previous.filter((item) => item.groupId !== groupId);
              const next = channelIds.length
                ? [
                    ...retained,
                    {
                      siteId: channelPopover.siteId,
                      groupId,
                      channelIds,
                      source: 'manual' as const,
                    },
                  ]
                : retained;
              return { ...current, [channelPopover.siteId]: next };
            });
          }}
          onCacheChange={(cache) => syncChannelStatusCache(channelPopover.siteId, cache)}
          onLoaded={(channels) => {
            setRateChannelsBySite((current) => ({
              ...current,
              [channelPopover.siteId]: channels,
            }));
            setInlineChannelListStateBySite((current) => ({
              ...current,
              [channelPopover.siteId]: reduceInlineChannelRefreshState(
                current[channelPopover.siteId],
                {
                  type: 'refresh-succeeded',
                  now: Date.now(),
                  state: channels.length ? 'success' : 'no-data',
                },
              ),
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
                [channelPopover.siteId]:
                  state === 'unsupported'
                    ? reduceInlineChannelRefreshState(current[channelPopover.siteId], {
                        type: 'refresh-succeeded',
                        now: Date.now(),
                        state: 'unsupported',
                      })
                    : reduceInlineChannelRefreshState(current[channelPopover.siteId], {
                        type: 'refresh-failed',
                        now: Date.now(),
                        reason: 'network',
                      }),
              }));
          }}
          onClose={() => setChannelPopover(undefined)}
        />
      )}
    </section>
  );
}

export function moveSiteBefore(ids: string[], movingId: string, targetId: string): string[] {
  const from = ids.indexOf(movingId);
  const target = ids.indexOf(targetId);
  if (from < 0 || target < 0 || from === target) return [...ids];
  const next = ids.filter((id) => id !== movingId);
  const insertion = next.indexOf(targetId);
  next.splice(insertion, 0, movingId);
  return next;
}

export function moveSiteByOffset(ids: string[], siteId: string, offset: -1 | 1): string[] {
  const index = ids.indexOf(siteId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
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

function keyStatValue(state: CurrentKeyStatsState | undefined): string {
  return state?.state === 'loading' ? '查询中' : state?.state === 'error' ? '刷新失败' : '待查询';
}

function currentKeyStatsLabel(state: CurrentKeyStatsState | undefined): string {
  return state?.state === 'success' ? '当前 Key 今日' : keyStatValue(state);
}

function formatCurrentKeyCredit(
  state: CurrentKeyStatsState | undefined,
  site: unknown,
  props: OverviewProps,
): string {
  if (state?.state !== 'success') return keyStatValue(state);
  return state.availableCredit.kind === 'amount'
    ? `$${state.availableCredit.value.toFixed(2)}`
    : formatSiteBalance(site, props);
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
  const key = resolveEffectiveKey(
    context.keys,
    context.preference,
    effectiveKeyIdForSite(value.id, props),
  );
  if (!key || typeof key.quota !== 'number' || !Number.isFinite(key.quota) || key.quota <= 0)
    return undefined;
  const used =
    typeof key.quotaUsed === 'number' && Number.isFinite(key.quotaUsed)
      ? Math.max(0, key.quotaUsed)
      : 0;
  const quotaRemaining = Math.max(0, key.quota - used);
  const remaining =
    typeof value.balance === 'number' && Number.isFinite(value.balance)
      ? Math.min(Math.max(0, value.balance), quotaRemaining)
      : quotaRemaining;
  return {
    total: key.quota,
    used,
    remaining,
    percent: Math.min(100, Math.max(0, (used / key.quota) * 100)),
  };
}

function effectiveKeyIdForSite(siteId: string, props: OverviewProps): string | undefined {
  const site =
    props.dashboard?.sites.find((candidate) => candidate.id === siteId) ??
    (props.selectedSite?.id === siteId ? props.selectedSite : undefined);
  return site?.defaultKeyId;
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
  const value =
    typeof site === 'object' && site !== null ? (site as { id?: string; balance?: unknown }) : {};
  if (!value.id) return '待查询';
  const context = keyContextForSite(value.id, props);
  const key = resolveEffectiveKey(
    context.keys,
    context.preference,
    effectiveKeyIdForSite(value.id, props),
  );
  const credit = availableCreditForKey(
    key,
    typeof value.balance === 'number' ? value.balance : undefined,
  );
  return credit.kind === 'amount' ? `$${credit.value.toFixed(2)}` : '待查询';
}

function siteNote(site: unknown): string {
  return typeof site === 'object' &&
    site !== null &&
    'note' in site &&
    typeof site.note === 'string'
    ? site.note
    : '';
}
