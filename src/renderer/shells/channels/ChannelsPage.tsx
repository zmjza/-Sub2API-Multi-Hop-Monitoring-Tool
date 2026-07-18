import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Globe2,
  RefreshCw,
  Zap,
} from 'lucide-react';
import type {
  ChannelDetailPayload,
  ChannelViewPayload,
} from '../../../../electron/shared/contracts';
import type { ChannelsProps } from './types';
import {
  channelSyncPresentation,
  currentKeyGroupName,
  isChannelDataStale,
  rankChannels,
  usageModelsForGroup,
} from './channel-ranking';
import { channels } from './data';
import './channels.css';
export function ChannelsPage(props: ChannelsProps) {
  const runtime = Boolean(window.sub2apiDesktop);
  const [period, setPeriod] = useState<7 | 15 | 30>(7);
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
  const keyGroupName = currentKeyGroupName(
    props.keyOptions ?? [],
    props.usageFilterOptions?.groups ?? [],
    props.keyPreference,
    props.selectedSite?.defaultKeyLabel,
  );
  const usageModels = usageModelsForGroup(props.usageData, keyGroupName);
  const rankedChannels = rankChannels(
    channelItems,
    keyGroupName,
    liveChannels?.availableChannels ?? [],
    usageModels,
  );
  const selectedItem =
    rankedChannels.find((item) => item.id === props.selectedChannelId) ?? rankedChannels[0];
  const detail = readChannelDetail(props.channelDetail);
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
    <section className="channels-page">
      <div className="channel-toolbar">
        <button className="channel-refresh" aria-label="刷新渠道" onClick={props.onRefreshChannels}>
          <RefreshCw size={16} />
        </button>
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
            {statusLabel(detailStatus)} · 最近一次检查 {formatCheckedAt(lastChecked)}
          </span>
        </div>
        <div className="period-tabs">
          {[7, 15, 30].map((days) => (
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
          <span>
            <Clock3 size={16} />
            平均延迟 <b>{formatMilliseconds(detailLatency)}</b>
          </span>
          <span>
            <Activity size={16} />
            可用率 <b>{formatAvailability(detailAvailability)}</b>
          </span>
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
        <div className="channel-cards">
          {rankedChannels.map((item) => (
            <article
              className={`channel-card ${item.status} ${item.id === props.selectedChannelId ? 'selected' : ''}`}
              key={item.id}
              onClick={() => props.onSelectChannel?.(item.id)}
            >
              <div className="channel-card-head">
                <div className="channel-title">
                  <div className="channel-icon">
                    <Activity size={20} />
                  </div>
                  <div>
                    <h3 title={item.name}>{item.name}</h3>
                    <span>
                      <b>{item.platform || '平台待查询'}</b> · {item.primaryModel || '模型待查询'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="channel-metrics">
                <div>
                  <span>
                    <Zap size={14} />
                    对话延迟
                  </span>
                  <strong>{formatMilliseconds(item.latencyMs)}</strong>
                </div>
                <div>
                  <span>
                    <Globe2 size={14} />
                    端点 PING
                    <em className={`status-pill ${statusClass(item.status)}`}>
                      {statusLabel(item.status)}
                    </em>
                  </span>
                  <strong>{formatMilliseconds(item.pingMs)}</strong>
                </div>
              </div>
              <div className="availability">
                <div>
                  <span>可用性 · 7 天</span>
                  <strong>{formatAvailability(item.availability7d)}</strong>
                </div>
                {item.timeline.length ? (
                  <div className="sparkline">
                    {item.timeline.map((point, index) => (
                      <i
                        className={statusClass(point.status)}
                        key={`${point.checkedAt}-${index}`}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="timeline-empty">暂无状态记录</div>
                )}
                <small>
                  近 {item.timeline.length} 次记录{' '}
                  <em>{formatCheckedAt(item.timeline.at(-1)?.checkedAt)}</em>
                </small>
                <div className="timeline-label">
                  <span>PAST</span>
                  <span>NOW</span>
                </div>
              </div>
            </article>
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

function statusLabel(status: ChannelViewPayload['channels'][number]['status']) {
  if (status === 'normal') return '运行正常';
  if (status === 'degraded') return '降级';
  if (status === 'failed') return '失败';
  return '状态待查询';
}

function statusClass(status: ChannelViewPayload['channels'][number]['status']) {
  if (status === 'normal') return 'good';
  if (status === 'degraded') return 'warn';
  if (status === 'failed') return 'bad';
  return 'unknown';
}

function formatMilliseconds(value: number | undefined) {
  return value === undefined ? '待查询' : `${value.toLocaleString()} ms`;
}

function formatAvailability(value: number | undefined) {
  return value === undefined ? '待查询' : `${value.toFixed(2)}%`;
}

function formatCheckedAt(value: string | undefined) {
  if (!value) return '待查询';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '待查询'
    : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
