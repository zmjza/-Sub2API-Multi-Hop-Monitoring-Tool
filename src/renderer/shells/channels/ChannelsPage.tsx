import { useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCw } from 'lucide-react';
import type {
  ChannelDetailPayload,
  ChannelViewPayload,
} from '../../../../electron/shared/contracts';
import type { ChannelsProps } from './types';
import {
  channelSyncPresentation,
  currentKeyGroup,
  groupChannelsByPlatformFamily,
  isChannelDataStale,
  rankChannels,
  usageModelsForGroup,
} from './channel-ranking';
import { ChannelFamilyHeader, ChannelStatusCard } from './ChannelStatusCard';
export { formatV2BucketTip } from './ChannelStatusCard';
import { channels } from './data';
import './channels.css';
export function ChannelsPage(props: ChannelsProps) {
  const runtime = Boolean(window.sub2apiDesktop);
  const [period, setPeriod] = useState<7 | 15 | 30>(7);
  const [v2Range, setV2Range] = useState<'90m' | '24h' | '7d' | '30d'>('90m');
  const refreshListenerRef = useRef(props.onRefreshChannels);
  const pollingRunningRef = useRef(false);
  refreshListenerRef.current = props.onRefreshChannels;
  const performRefresh = async () => {
    if (pollingRunningRef.current) return;
    pollingRunningRef.current = true;
    try {
      const result = await refreshListenerRef.current?.();
      void result;
    } finally {
      pollingRunningRef.current = false;
    }
  };
  const liveChannels = readChannelEnvelope(props.channelsData);
  const unsupported = props.state === 'unsupported' || liveChannels?.state === 'unsupported';
  const channelItems = liveChannels
    ? readChannelItems(liveChannels)
    : runtime
      ? []
      : channels.map((item, index) => ({
          id: `preview-${index}`,
          name: item.name,
          platform: item.platform,
          groupName: '示例分组',
          primaryModel: '示例模型',
          extraModels: [],
          status: 'normal' as const,
          latencyMs: Number.parseFloat(item.latency),
          pingMs: Number.parseFloat(item.ping),
          availability7d: Number.parseFloat(item.availability),
          timeline: [],
        }));
  const keyGroup = currentKeyGroup(
    props.keyOptions ?? [],
    props.usageFilterOptions?.groups ?? [],
    props.keyPreference,
    props.selectedSite?.defaultKeyLabel,
  );
  const keyGroupName = keyGroup?.groupName;
  const usageModels = usageModelsForGroup(props.usageData, keyGroupName);
  const relationships = liveChannels?.availableChannels ?? [];
  const rankedChannels = rankChannels(
    channelItems,
    keyGroupName,
    relationships,
    usageModels,
    keyGroup?.groupId,
  );
  const selectedItem =
    rankedChannels.find((item) => item.id === props.selectedChannelId) ?? rankedChannels[0];
  const detail = readChannelDetail(props.channelDetail);
  const monitorSource = liveChannels?.monitorSource ?? 'v1';
  const detailModel =
    detail?.models.find((model) => model.model === selectedItem?.primaryModel) ?? detail?.models[0];
  const detailStatus = detailModel?.status ?? selectedItem?.status ?? 'unknown';
  const detailAvailability =
    period === 7
      ? (detailModel?.availability7d ?? selectedItem?.availability7d)
      : period === 15
        ? detailModel?.availability15d
        : detailModel?.availability30d;
  const detailLatency = period === 7 ? detailModel?.averageLatency7dMs : undefined;
  const lastChecked = selectedItem?.timeline.at(-1)?.checkedAt;
  const sync = channelSyncPresentation(props.state, props.channelsData);
  const stale = isChannelDataStale(props.channelsData);
  return (
    <section className={`channels-page monitor-${monitorSource}`}>
      <div className="channel-toolbar">
        <button
          className="channel-refresh"
          aria-label="刷新渠道"
          onClick={() => {
            void performRefresh();
          }}
        >
          <RefreshCw size={16} />
        </button>
        <span className="channel-polling-countdown">全局自动刷新：10–20 秒</span>
        {(stale ||
          ['failed', 'loading', 'stale', 'partial', 'unsupported'].includes(sync.kind)) && (
          <span className="channel-sync-state">
            {sync.kind === 'loading'
              ? '渠道数据更新中'
              : sync.kind === 'failed'
                ? '渠道数据读取失败，保留最近结果'
                : sync.kind === 'unsupported'
                  ? '该站未开放渠道监控'
                  : sync.kind === 'partial'
                    ? '渠道数据部分可用'
                    : '渠道数据可能已过期'}
          </span>
        )}
      </div>
      <div className="channel-detail channel-detail-top">
        <div>
          <span className="eyebrow">当前选中渠道</span>
          <h2>{detail?.name ?? selectedItem?.name ?? '尚未选择渠道'}</h2>
          <span className={`detail-sub status-${detailStatus}`}>
            {detailStatus === 'normal' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {statusLabel(detailStatus, monitorSource)} · 最近一次检查 {formatCheckedAt(lastChecked)}
          </span>
        </div>
        <div className="period-tabs">
          {monitorSource === 'v2'
            ? (['90m', '24h', '7d', '30d'] as const).map((range) => (
                <button
                  className={v2Range === range ? 'active' : ''}
                  key={range}
                  onClick={() => setV2Range(range)}
                >
                  {range}
                </button>
              ))
            : [7, 15, 30].map((days) => (
                <button
                  className={period === days ? 'active' : ''}
                  key={days}
                  onClick={() => setPeriod(days as 7 | 15 | 30)}
                >
                  {days} 天
                </button>
              ))}
        </div>
        <div className="detail-stats">
          {monitorSource === 'v2' ? (
            <>
              <span>
                <Activity size={16} /> 可用率 <b>{formatRate(selectedItem?.v2?.successRate)}</b>
              </span>
              <span>
                <Activity size={16} /> 缓存率 <b>{formatRate(selectedItem?.v2?.cacheRate)}</b>
              </span>
              <span>
                <Clock3 size={16} /> 首 Token <b>{formatHoverTtft(selectedItem?.v2?.ttftMs)}</b>
              </span>
            </>
          ) : (
            <>
              <span>
                <Clock3 size={16} /> 平均延迟 <b>{formatMilliseconds(detailLatency)}</b>
              </span>
              <span>
                <Activity size={16} /> 可用率 <b>{formatAvailability(detailAvailability)}</b>
              </span>
            </>
          )}
        </div>
      </div>
      {unsupported ? (
        <div className="unsupported-panel">
          <AlertTriangle size={28} />
          <strong>该站未开放渠道监控</strong>
          <span>渠道能力缺失不会影响余额和用量查询。</span>
        </div>
      ) : channelItems.length === 0 ? (
        <div className="unsupported-panel">
          <Activity size={28} />
          <strong>该站暂无渠道数据</strong>
          <span>余额和用量查询仍可正常使用。</span>
        </div>
      ) : (
        <div className="channel-family-list">
          {groupChannelsByPlatformFamily(rankedChannels)
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <section
                className={`channel-family-section family-${group.family}`}
                key={group.family}
              >
                <ChannelFamilyHeader
                  family={group.family}
                  count={group.items.length}
                  label={group.label}
                />
                <div className="channel-cards">
                  {group.items.map((item) => (
                    <ChannelStatusCard
                      key={item.id}
                      item={item}
                      selected={item.id === props.selectedChannelId}
                      monitorSource={monitorSource}
                      v2Range={v2Range}
                      onSelect={props.onSelectChannel}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </section>
  );
}

export function readChannelItems(value: unknown): ChannelViewPayload['channels'] {
  const envelope = readChannelEnvelope(value);
  return envelope?.state === 'supported' ? envelope.channels : [];
}

function readChannelEnvelope(value: unknown): ChannelViewPayload | undefined {
  if (typeof value !== 'object' || value === null || !('state' in value)) return undefined;
  const envelope = value as ChannelViewPayload;
  return Array.isArray(envelope.channels) ? envelope : undefined;
}

function readChannelDetail(value: unknown): ChannelDetailPayload['detail'] {
  if (typeof value !== 'object' || value === null || !('state' in value)) return undefined;
  return (value as ChannelDetailPayload).detail;
}

function statusLabel(
  status: ChannelViewPayload['channels'][number]['status'],
  source: ChannelViewPayload['monitorSource'] = 'v1',
) {
  if (source === 'v2') {
    if (status === 'normal') return '健康';
    if (status === 'degraded') return '需关注';
    if (status === 'failed') return '异常';
    return '未知';
  }
  if (status === 'normal') return '运行正常';
  if (status === 'degraded') return '降级';
  if (status === 'failed') return '失败';
  return '状态待查询';
}

function formatMilliseconds(value: number | undefined) {
  return value === undefined ? '待查询' : `${value.toLocaleString()} ms`;
}

function formatAvailability(value: number | undefined) {
  return value === undefined ? '待查询' : `${value.toFixed(2)}%`;
}

function formatRate(value: number | undefined) {
  return value === undefined ? '未知' : (value * 100).toFixed(2) + '%';
}

function formatHoverTtft(value: number | undefined) {
  return value === undefined ? '—' : (value / 1000).toFixed(1) + 's';
}

function formatCheckedAt(value: string | undefined) {
  if (!value) return '待查询';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '待查询'
    : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
