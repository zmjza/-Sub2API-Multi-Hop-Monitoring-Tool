import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Gauge,
  LoaderCircle,
  RefreshCw,
  Settings,
  Check,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatTokenCount } from '../../lib/format';
import type { FloatingProps } from './types';
import { floatingSnapshot as data } from './data';
import {
  calculateTokensPerSecond,
  formatTokensPerSecond,
  usageSpeedTier,
} from '../usage/usage-speed';
import {
  currentKeyGroup,
  resolveChannelPresentation,
  summarizeRecentChannelHealth,
} from '../channels/channel-ranking';
import './floating.css';

export function FloatingWindow(props: FloatingProps) {
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const windowRef = useRef<HTMLElement>(null);
  const channelTriggerRef = useRef<HTMLButtonElement>(null);
  const channelCloseRef = useRef<HTMLButtonElement>(null);
  const channelDialogRef = useRef<HTMLElement>(null);
  const channelDialogWasOpenRef = useRef(false);
  const runtime = Boolean(window.sub2apiDesktop);
  const busy = props.state === 'loading' || props.state === 'refreshing';
  const failed =
    props.state === 'error' || props.state === 'auth-required' || props.state === 'unsupported';
  const liveBalance = props.selectedSite?.balance;
  const currentKeyStats = props.selectedSite
    ? props.currentKeyStatsBySite?.[props.selectedSite.id]
    : undefined;
  const keyTodayTokens =
    currentKeyStats?.state === 'success' ? currentKeyStats.totalTokens : undefined;
  const keyTodayCost =
    currentKeyStats?.state === 'success' ? currentKeyStats.totalActualCost : undefined;
  const keyAvailableCredit =
    currentKeyStats?.state === 'success' && currentKeyStats.availableCredit.kind === 'amount'
      ? currentKeyStats.availableCredit.value
      : undefined;
  const displayedBalance = keyAvailableCredit ?? liveBalance;
  const tokensPerSecond = calculateTokensPerSecond(
    props.latestUsageRecord?.outputTokens,
    props.latestUsageRecord?.durationMs,
  );
  const speedTier = usageSpeedTier(tokensPerSecond);
  const channelView = readFloatingChannels(props.channelsData);
  const keyGroup = currentKeyGroup(
    props.keyOptions ?? [],
    props.usageFilterOptions?.groups ?? [],
    props.keyPreference ?? { mode: 'auto' },
    props.selectedSite?.defaultKeyLabel,
  );
  const manualChannelIds = keyGroup?.groupId
    ? (props.channelAssociations?.find((item) => item.groupId === keyGroup.groupId)?.channelIds ??
      [])
    : [];
  const channelPresentation = keyGroup
    ? resolveChannelPresentation(
        channelView.channels,
        keyGroup.groupName,
        channelView.availableChannels,
        keyGroup.groupId,
        manualChannelIds,
        channelView.availableChannelsState,
      )
    : undefined;
  const associatedChannels = channelPresentation?.association;
  const primaryChannel = channelPresentation?.primary;
  const channelSummary = !props.selectedSite
    ? '未选择站点'
    : !keyGroup
      ? '当前 Key 无分组'
      : channelView.state === 'loading'
        ? '渠道加载中'
        : channelView.state === 'unsupported'
          ? '站点不支持渠道状态'
          : channelView.state === 'error'
            ? '渠道查询失败'
            : associatedChannels?.status === 'matched'
              ? `${associatedChannels.channels.length} 个关联渠道`
              : '当前 Key 无关联渠道';
  const canOpenChannelDialog = associatedChannels?.status === 'matched' && Boolean(primaryChannel);
  const primaryChannelHealth = summarizeRecentChannelHealth(primaryChannel?.timeline ?? []);
  const estimate = props.selectedSite?.estimatedDurationMs ?? [3000, 5000];
  const phaseLabel =
    (
      {
        profile: '余额',
        keys: 'API Key',
        groups: '分组',
        rates: '倍率',
        usage: '今日统计',
      } as Record<string, string>
    )[props.queryPhase ?? ''] ?? '站点数据';
  const title = busy
    ? '正在查余额，先让 Codex 蹬一会儿… ⏳'
    : displayedBalance === undefined
      ? '尚无余额数据'
      : displayedBalance >= 2
        ? '这么有钱，就使劲蹬 Codex，别浪费！💸'
        : '快没钱了，赶紧充钱，别让天才程序员陨落！🥲';
  const siteTitle = props.selectedSite?.note?.trim() || props.selectedSite?.name || data.siteName;

  useEffect(() => {
    if (!channelDialogOpen) {
      if (channelDialogWasOpenRef.current)
        (channelTriggerRef.current ?? windowRef.current)?.focus();
      channelDialogWasOpenRef.current = false;
      return;
    }
    channelDialogWasOpenRef.current = true;
    channelCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setChannelDialogOpen(false);
        return;
      }
      if (channelDialogRef.current) trapDialogTabFocus(event, channelDialogRef.current);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [channelDialogOpen]);

  useEffect(() => setChannelDialogOpen(false), [props.selectedSite?.id, keyGroup?.groupId]);

  useEffect(() => {
    if (!canOpenChannelDialog) setChannelDialogOpen(false);
  }, [canOpenChannelDialog]);

  return (
    <main ref={windowRef} tabIndex={-1} className={`floating-window state-${props.state}`}>
      <header className="floating-header">
        <button aria-label="上一个站点" onClick={props.onPreviousSite}>
          <ArrowLeft size={16} />
        </button>
        <strong title={siteTitle}>{siteTitle}</strong>
        <button aria-label="下一个站点" onClick={props.onNextSite}>
          <ArrowRight size={16} />
        </button>
      </header>
      <div className="floating-title" title={title}>
        {title}
      </div>
      {busy && (
        <div className="query-status">
          <LoaderCircle size={15} className="spin" />
          正在查询{phaseLabel} · 预计 {Math.max(1, Math.round(estimate[0] / 1000))}–
          {Math.max(1, Math.round(estimate[1] / 1000))} 秒
        </div>
      )}
      {failed && (
        <div className="query-status error">
          <RefreshCw size={15} />
          保留上次成功数据 · {props.state}
        </div>
      )}
      <section className="floating-balance">
        <span>
          {displayedBalance !== undefined
            ? `$${displayedBalance.toFixed(2)}`
            : runtime
              ? '—'
              : data.balance}
        </span>
        <em>
          {props.selectedSite?.rate !== undefined
            ? `${props.selectedSite.rate}x`
            : runtime
              ? '倍率不可用'
              : data.rate}
        </em>
      </section>
      <small className="floating-key">
        {props.selectedSite?.defaultKeyLabel ?? (runtime ? '尚未选择站点' : data.keyLabel)}
      </small>
      {primaryChannel && canOpenChannelDialog ? (
        <button
          type="button"
          ref={channelTriggerRef}
          className={`floating-channel-card is-${primaryChannel.status}`}
          aria-label="查看全部关联渠道"
          aria-haspopup="dialog"
          aria-expanded={channelDialogOpen}
          onClick={() => setChannelDialogOpen(true)}
        >
          <ChannelHealthContent
            channel={primaryChannel}
            health={primaryChannelHealth}
            source={associatedChannels.source}
          />
        </button>
      ) : (
        <div className="floating-channel-card is-message" aria-label="当前渠道状态">
          <span>{channelSummary}</span>
          <small>近 1 分钟渠道状态</small>
        </div>
      )}
      <div className="floating-metrics">
        <span>
          今日 Token
          <b>
            {keyTodayTokens !== undefined
              ? formatTokenCount(keyTodayTokens)
              : runtime
                ? '—'
                : data.todayTokens}
          </b>
        </span>
        <span>
          今日消费
          <b>
            {keyTodayCost !== undefined
              ? `$${keyTodayCost.toFixed(4)}`
              : runtime
                ? '—'
                : data.todayCost}
          </b>
        </span>
      </div>
      <footer>
        <details className="floating-settings">
          <summary aria-label="悬浮窗设置">
            <Settings size={15} />
          </summary>
          <div className="floating-settings-panel">
            <label>
              固定位置
              <select
                value={props.floatingPosition ?? 'top-right'}
                onChange={(event) =>
                  props.onFloatingPositionChange?.(
                    event.target.value as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
                  )
                }
              >
                {props.floatingPosition === 'custom' && (
                  <option value="custom" disabled>
                    自定义位置
                  </option>
                )}
                <option value="top-left">左上角</option>
                <option value="top-right">右上角</option>
                <option value="bottom-left">左下角</option>
                <option value="bottom-right">右下角</option>
              </select>
            </label>
            <label>
              透明度
              <input
                aria-label="透明度"
                type="range"
                min="35"
                max="100"
                step={1}
                value={props.floatingOpacity ?? 84}
                onChange={(event) => props.onFloatingOpacityChange?.(Number(event.target.value))}
              />
              <output>{props.floatingOpacity ?? 84}%</output>
            </label>
          </div>
        </details>
        <span className={`floating-live-state state-${props.state}`}>
          <i />
          {props.state === 'success'
            ? '正常'
            : props.state === 'stale'
              ? '缓存数据 · 过期'
              : props.state === 'refreshing' || props.state === 'loading'
                ? '更新中'
                : props.state === 'error'
                  ? '查询失败'
                  : props.state}
          {props.selectedSite?.fetchedAt
            ? ` · ${new Date(props.selectedSite.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : ''}
        </span>
        <div className={`floating-speed is-${speedTier}`} title="最近一条请求生成速度">
          <Gauge size={13} aria-hidden />
          <span>{formatTokensPerSecond(tokensPerSecond)}</span>
          <b>{speedTierLabel(speedTier)}</b>
        </div>
        <div className="floating-actions">
          <button aria-label="打开主页面" title="返回主页面" onClick={props.onOpenSite}>
            <ExternalLink size={15} />
          </button>
          <button
            aria-label="刷新悬浮窗"
            title="刷新当前站点"
            onClick={props.onRefreshFloating}
            disabled={!props.selectedSite || busy}
          >
            <RefreshCw size={15} className={busy ? 'spin' : ''} />
          </button>
        </div>
      </footer>
      {channelDialogOpen && associatedChannels?.status === 'matched' && (
        <div
          className="floating-channel-dialog-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setChannelDialogOpen(false);
          }}
        >
          <section
            ref={channelDialogRef}
            className="floating-channel-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="floating-channel-dialog-title"
          >
            <header>
              <div>
                <strong id="floating-channel-dialog-title">关联渠道</strong>
                <small>最近 1 分钟</small>
              </div>
              <button
                type="button"
                ref={channelCloseRef}
                aria-label="关闭关联渠道弹框"
                title="关闭"
                onClick={() => setChannelDialogOpen(false)}
              >
                <X size={15} />
              </button>
            </header>
            <div className="floating-channel-dialog-list">
              {associatedChannels.channels.map((channel) => {
                const health = summarizeRecentChannelHealth(channel.timeline ?? []);
                const selected = channel.id === primaryChannel?.id;
                return (
                  <article
                    className={`floating-channel-dialog-row is-${channel.status}${selected ? ' is-selected' : ''}`}
                    key={channel.id}
                  >
                    <div className="floating-channel-dialog-row-heading">
                      <strong title={channel.name}>{channel.name}</strong>
                      {selected && (
                        <span className="floating-channel-selected">
                          <Check size={10} /> 当前展示
                        </span>
                      )}
                      <em>{channelStatusLabel(channel.status)}</em>
                    </div>
                    <ChannelTimeline health={health} />
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export function trapDialogTabFocus(event: KeyboardEvent, dialog: HTMLElement): boolean {
  if (event.key !== 'Tab') return false;
  const focusable = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
  if (!focusable.length) {
    event.preventDefault();
    return true;
  }
  const first = focusable[0]!;
  const last = focusable.at(-1)!;
  if (event.shiftKey && event.target === first) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && event.target === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

type FloatingChannel = ReturnType<typeof readFloatingChannels>['channels'][number];
type RecentHealth = ReturnType<typeof summarizeRecentChannelHealth>;

function ChannelHealthContent(props: {
  channel: FloatingChannel;
  health: RecentHealth;
  source: 'auto' | 'manual';
}) {
  return (
    <>
      <span className="floating-channel-heading">
        <small>{props.source === 'manual' ? '手动指定' : '自动关联'}</small>
        <strong title={props.channel.name}>{props.channel.name}</strong>
        <em>{channelStatusLabel(props.channel.status)}</em>
      </span>
      <ChannelTimeline health={props.health} />
    </>
  );
}

function ChannelTimeline({ health }: { health: RecentHealth }) {
  return (
    <span className="floating-channel-health">
      <small>
        {health.availabilityPercent === undefined ? (
          '近 1 分钟无数据'
        ) : (
          <>
            近 1 分钟可用 <b>{health.availabilityPercent.toFixed(2)}%</b>
          </>
        )}
      </small>
      <span className="floating-channel-timeline" aria-label="最近 1 分钟渠道状态时间线">
        {Array.from({ length: 12 }, (_, index) => {
          const point = health.points[index];
          return (
            <i
              className={point?.status ?? 'empty'}
              key={point ? `${point.checkedAt}-${index}` : `empty-${index}`}
            />
          );
        })}
      </span>
    </span>
  );
}

function channelStatusLabel(status: FloatingChannel['status']): string {
  if (status === 'normal') return '正常';
  if (status === 'degraded') return '降级';
  if (status === 'failed') return '异常';
  return '未知';
}

function speedTierLabel(tier: ReturnType<typeof usageSpeedTier>): string {
  if (tier === 'slow') return '慢';
  if (tier === 'normal') return '正常';
  if (tier === 'fast') return '快';
  return '暂无';
}

function readFloatingChannels(value: unknown): {
  state: 'loading' | 'supported' | 'unsupported' | 'error';
  channels: Array<{
    id: string;
    name: string;
    status: 'normal' | 'degraded' | 'failed' | 'unknown';
    timeline?: Array<{
      status: 'normal' | 'degraded' | 'failed' | 'unknown';
      checkedAt?: string;
    }>;
  }>;
  availableChannels: Array<{
    name: string;
    platforms: Array<{
      platform: string;
      groupIds: string[];
      groupNames: string[];
      modelNames: string[];
    }>;
  }>;
  availableChannelsState?: 'complete' | 'empty' | 'partial' | 'error';
} {
  if (!value || typeof value !== 'object')
    return { state: 'loading', channels: [], availableChannels: [] };
  const record = value as Record<string, unknown>;
  if (record.state === 'unsupported')
    return { state: 'unsupported', channels: [], availableChannels: [] };
  if (record.state === 'error') return { state: 'error', channels: [], availableChannels: [] };
  return {
    state: 'supported',
    channels: Array.isArray(record.channels) ? (record.channels as never[]) : [],
    availableChannels: Array.isArray(record.availableChannels)
      ? (record.availableChannels as never[])
      : [],
    availableChannelsState:
      record.availableChannelsState === 'complete' ||
      record.availableChannelsState === 'empty' ||
      record.availableChannelsState === 'partial' ||
      record.availableChannelsState === 'error'
        ? record.availableChannelsState
        : undefined,
  };
}
