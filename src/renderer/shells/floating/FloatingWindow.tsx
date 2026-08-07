import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Gauge,
  LoaderCircle,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { formatTokenCount } from '../../lib/format';
import type { FloatingProps } from './types';
import { floatingSnapshot as data } from './data';
import {
  calculateTokensPerSecond,
  formatTokensPerSecond,
  usageSpeedTier,
} from '../usage/usage-speed';
import { currentKeyGroup, resolveFinalChannelAssociation } from '../channels/channel-ranking';
import './floating.css';

export function FloatingWindow(props: FloatingProps) {
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
  const associatedChannels = keyGroup
    ? resolveFinalChannelAssociation(
        channelView.channels,
        keyGroup.groupName,
        channelView.availableChannels,
        keyGroup.groupId,
        manualChannelIds,
        channelView.availableChannelsState,
      )
    : undefined;
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
  return (
    <main className={`floating-window state-${props.state}`}>
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
      <div className={`floating-speed is-${speedTier}`} title="最近一条请求生成速度">
        <Gauge size={13} aria-hidden />
        <span>{formatTokensPerSecond(tokensPerSecond)}</span>
        <b>
          {speedTier === 'slow'
            ? '慢'
            : speedTier === 'normal'
              ? '正常'
              : speedTier === 'fast'
                ? '快'
                : '暂无'}
        </b>
      </div>
      <details className="floating-channels">
        <summary title="查看当前 Key 最近一分钟渠道状态">{channelSummary}</summary>
        <div className="floating-channel-panel">
          <strong>近 1 分钟渠道状态</strong>
          {associatedChannels?.status === 'matched' ? (
            associatedChannels.channels.map((channel) => {
              const recent = (channel.timeline ?? []).filter((point) => {
                const checkedAt = Date.parse(point.checkedAt ?? '');
                return Number.isFinite(checkedAt) && checkedAt >= Date.now() - 60_000;
              });
              return (
                <div className="floating-channel-row" key={channel.id}>
                  <span title={channel.name}>{channel.name}</span>
                  <b className={`is-${channel.status}`}>{channel.status}</b>
                  <small>{recent.length ? `${recent.length} 个检查点` : '近 1 分钟无数据'}</small>
                </div>
              );
            })
          ) : (
            <span className="floating-channel-empty">{channelSummary}</span>
          )}
        </div>
      </details>
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
    </main>
  );
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
