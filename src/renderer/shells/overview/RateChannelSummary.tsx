import { Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import type { ChannelDetailPayload } from '../../../../electron/shared/contracts';
import type { RateChannelSnapshot } from './rate-comparison';
import type { InlineChannelRefreshState } from './OverviewPage';
import { channelTimelineForDisplay } from '../channels/channel-ranking';
import { formatChannelFetchedAt } from './channel-time';

type Channel = RateChannelSnapshot;

export type InlineChannelListState = 'loading' | 'success' | 'no-data' | 'unsupported' | 'error';
export type InlineChannelMatchState = 'matched' | 'unmatched' | 'ambiguous' | 'no-key' | 'no-group';

export type InlineChannelDetailState =
  { state: 'loading' } | { state: 'success'; payload: ChannelDetailPayload } | { state: 'error' };

export function RateChannelSummary(props: {
  siteName: string;
  groupName: string;
  listState: InlineChannelListState;
  refreshState?: InlineChannelRefreshState;
  matchState: InlineChannelMatchState;
  channel?: Channel;
  channels?: Channel[];
  detailState?: InlineChannelDetailState;
  fetchedAt?: number;
  onRetry: () => void;
  onListRetry?: () => void;
}) {
  if (props.matchState === 'no-key') return <InlineMessage text="未确定当前生效 Key" />;
  if (props.matchState === 'no-group') return <InlineMessage text="当前 Key 未关联分组" />;
  if (props.listState === 'loading')
    return (
      <div className="rate-inline-channel is-loading" role="status">
        <RefreshCw size={14} className="spin" />
        <span>正在读取渠道状态…</span>
        <i />
      </div>
    );

  if (props.listState === 'unsupported') return <InlineMessage text="当前站点不支持渠道状态" />;
  if (props.listState === 'no-data') return <InlineMessage text="暂无渠道状态数据" />;
  if (props.listState === 'error')
    return (
      <InlineMessage
        alert
        text="渠道状态加载失败"
        retryLabel={`重试 ${props.siteName} ${props.groupName} 渠道状态`}
        onRetry={props.onRetry}
      />
    );
  if (props.matchState === 'ambiguous') return <InlineMessage text="当前分组匹配到多个渠道" />;
  if (props.matchState === 'unmatched' || !props.channel)
    return <InlineMessage text="暂未关联渠道" />;

  const detail =
    props.detailState?.state === 'success' && props.detailState.payload.state === 'supported'
      ? props.detailState.payload.detail
      : undefined;
  const model = detail?.models[0];
  const status = model?.status ?? props.channel.status;
  const availability = model?.availability7d ?? props.channel.availability7d;
  const detailFailed = props.detailState?.state === 'error';
  const timeline = channelTimelineForDisplay(props.channel.timeline ?? [], Date.now(), 20);

  return (
    <div className={`rate-inline-channel is-${status}`} aria-label={`${props.groupName} 当前渠道`}>
      {props.refreshState?.refreshing && (
        <small className="rate-inline-channel-refresh" role="status">
          <RefreshCw size={11} className="spin" /> 正在更新
        </small>
      )}
      {props.refreshState?.stale && (
        <small className="rate-inline-channel-stale" role="status">
          <AlertTriangle size={11} />
          {props.refreshState.failureReason === 'auth'
            ? '需要重新验证，显示上次数据'
            : '更新失败，显示上次数据'}
          {props.refreshState.lastSuccessAt && (
            <time dateTime={new Date(props.refreshState.lastSuccessAt).toISOString()}>
              {new Date(props.refreshState.lastSuccessAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          )}
          <button
            type="button"
            aria-label={`重试 ${props.siteName} ${props.groupName} 渠道状态`}
            title="重试渠道状态"
            onClick={props.onListRetry ?? props.onRetry}
          >
            <RefreshCw size={12} />
          </button>
        </small>
      )}
      {(props.channels ?? [props.channel]).length > 1 && (
        <div
          className="rate-inline-channel-associated"
          aria-label="全部关联渠道"
          data-count={(props.channels ?? [props.channel]).length}
        >
          {(props.channels ?? [props.channel]).map((item) => (
            <span key={item.id}>
              {item.name} · {statusLabel(item.status)}
            </span>
          ))}
        </div>
      )}
      <div className="rate-inline-channel-heading">
        <span>手动指定</span>
        <b title={detail?.name ?? props.channel.name}>{detail?.name ?? props.channel.name}</b>
        <em className={`rate-channel-status ${status}`}>{statusLabel(status)}</em>
      </div>
      <time dateTime={props.fetchedAt ? new Date(props.fetchedAt).toISOString() : undefined}>
        更新于 {formatChannelFetchedAt(props.fetchedAt)}
      </time>
      <div className="rate-inline-channel-metrics">
        <span>
          7 天可用 <b>{formatAvailability(availability)}</b>
        </span>
        {props.detailState?.state === 'loading' && <RefreshCw size={12} className="spin" />}
        {detailFailed && (
          <button
            type="button"
            aria-label={`重试 ${props.siteName} ${props.groupName} 渠道详情`}
            title="重试渠道详情"
            onClick={props.onRetry}
          >
            <RefreshCw size={13} />
          </button>
        )}
      </div>
      <div className="rate-inline-channel-timeline" aria-label="7 天渠道状态时间线">
        {timeline.length ? (
          timeline.map((point, index) => (
            <i className={point.status} key={`${point.checkedAt ?? 'unknown'}-${index}`} />
          ))
        ) : (
          <span>暂无状态记录</span>
        )}
      </div>
      {detailFailed && (
        <small className="rate-inline-channel-error" role="alert">
          详情加载失败
        </small>
      )}
    </div>
  );
}

function InlineMessage(props: {
  text: string;
  alert?: boolean;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div className={`rate-inline-channel is-message${props.alert ? ' is-error' : ''}`}>
      {props.alert ? <AlertTriangle size={14} /> : <Activity size={14} />}
      <span role={props.alert ? 'alert' : undefined}>{props.text}</span>
      {props.onRetry && (
        <button
          type="button"
          aria-label={props.retryLabel}
          title="重试渠道状态"
          onClick={props.onRetry}
        >
          <RefreshCw size={13} />
        </button>
      )}
    </div>
  );
}

function statusLabel(status: Channel['status']): string {
  if (status === 'normal') return '正常';
  if (status === 'degraded') return '降级';
  if (status === 'failed') return '异常';
  return '未知';
}

function formatAvailability(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) || value < 0 || value > 100
    ? '待查询'
    : `${value.toFixed(2)}%`;
}
