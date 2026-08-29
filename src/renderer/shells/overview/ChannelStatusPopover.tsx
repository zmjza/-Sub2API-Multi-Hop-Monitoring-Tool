import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Globe2,
  RefreshCw,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  ChannelDetailPayload,
  ChannelViewPayload,
} from '../../../../electron/shared/contracts';
import type { RateChannelSnapshot } from './rate-comparison';
import { channelTimelineForDisplay, toggleChannelAssociation } from '../channels/channel-ranking';

type Channel = ChannelViewPayload['channels'][number];

export interface ChannelStatusCache {
  channels?: ChannelViewPayload;
  details: Record<string, ChannelDetailPayload>;
}

export function restoreChannelPopoverCache(
  cache: ChannelStatusCache | undefined,
  selectedId?: string,
):
  { channels: Channel[]; selected?: Channel; detail?: ChannelDetailPayload['detail'] } | undefined {
  const envelope = cache?.channels;
  if (!envelope || envelope.state !== 'supported') return undefined;
  const channels = envelope.channels;
  const selected = channels.find((item) => item.id === selectedId) ?? channels[0];
  const detailEnvelope = selected ? cache.details[selected.id] : undefined;
  return {
    channels,
    selected,
    detail: detailEnvelope?.state === 'supported' ? detailEnvelope.detail : undefined,
  };
}

export function ChannelStatusPopover(props: {
  anchor: HTMLElement;
  siteId: string;
  siteName: string;
  cache?: ChannelStatusCache;
  loadChannels?: (force?: boolean) => Promise<ChannelViewPayload>;
  loadDetail?: (channelId: string, force?: boolean) => Promise<ChannelDetailPayload>;
  onCacheChange?: (cache: ChannelStatusCache) => void;
  onLoaded?: (channels: RateChannelSnapshot[]) => void;
  onStateChange?: (state: 'supported' | 'unsupported' | 'error') => void;
  associationGroupId?: string;
  associatedChannelIds?: string[];
  onAssociationSave?: (groupId: string, channelIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onLoadedRef = useRef(props.onLoaded);
  const onCacheChangeRef = useRef(props.onCacheChange);
  const onStateChangeRef = useRef(props.onStateChange);
  const loadChannelsRef = useRef(props.loadChannels);
  const loadDetailRef = useRef(props.loadDetail);
  const siteIdRef = useRef(props.siteId);
  const cacheRef = useRef(props.cache);
  const selectedIdRef = useRef<string | undefined>(undefined);
  onLoadedRef.current = props.onLoaded;
  onCacheChangeRef.current = props.onCacheChange;
  onStateChangeRef.current = props.onStateChange;
  loadChannelsRef.current = props.loadChannels;
  loadDetailRef.current = props.loadDetail;
  siteIdRef.current = props.siteId;
  cacheRef.current = props.cache;
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [state, setState] = useState<'loading' | 'success' | 'unsupported' | 'no-data' | 'error'>(
    'loading',
  );
  const [channels, setChannels] = useState<Channel[]>([]);
  const [detail, setDetail] = useState<ChannelDetailPayload['detail']>();
  const [selected, setSelected] = useState<Channel>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [associatedChannelIds, setAssociatedChannelIds] = useState<string[]>(
    props.associatedChannelIds ?? [],
  );
  const [associationBusyId, setAssociationBusyId] = useState<string>();
  const [associationMessage, setAssociationMessage] = useState('');
  const detailRequestRef = useRef(0);

  useEffect(() => {
    setAssociatedChannelIds(props.associatedChannelIds ?? []);
  }, [props.associatedChannelIds?.join(','), props.associationGroupId]);

  const publishCache = useCallback((cache: ChannelStatusCache) => {
    cacheRef.current = cache;
    onCacheChangeRef.current?.(cache);
  }, []);

  const loadDetail = useCallback(
    async (channel: Channel, envelope: ChannelViewPayload, force = false) => {
      const requestId = ++detailRequestRef.current;
      setSelected(channel);
      setDetailLoading(true);
      setDetailError(false);
      try {
        const cached = force ? undefined : cacheRef.current?.details[channel.id];
        const value =
          cached ??
          (loadDetailRef.current
            ? await loadDetailRef.current(channel.id, force)
            : await window.sub2apiDesktop?.sites.channelStatus(siteIdRef.current, channel.id));
        if (requestId !== detailRequestRef.current) return;
        if (!value || typeof value !== 'object' || !('state' in value)) {
          setDetailError(true);
          return;
        }
        const detailEnvelope = value as ChannelDetailPayload;
        publishCache({
          channels: envelope,
          details: { ...cacheRef.current?.details, [channel.id]: detailEnvelope },
        });
        setDetail(detailEnvelope.state === 'supported' ? detailEnvelope.detail : undefined);
      } catch {
        if (requestId === detailRequestRef.current) setDetailError(true);
      } finally {
        if (requestId === detailRequestRef.current) setDetailLoading(false);
      }
    },
    [publishCache],
  );

  const load = useCallback(
    async (force = false) => {
      const existingCache = cacheRef.current;
      const previous = force
        ? restoreChannelPopoverCache(existingCache, selectedIdRef.current)
        : undefined;
      if (previous) {
        setChannels(previous.channels);
        setSelected(previous.selected);
        setDetail(previous.detail);
        setDetailError(false);
        setState(previous.channels.length ? 'success' : 'no-data');
        setRefreshing(true);
        setStale(false);
      } else {
        setState('loading');
        setDetail(undefined);
        setRefreshing(false);
        setStale(false);
      }
      try {
        let value: unknown;
        if (!force && existingCache?.channels) value = existingCache.channels;
        else
          value = loadChannelsRef.current
            ? await loadChannelsRef.current(force)
            : await window.sub2apiDesktop?.sites.channels(siteIdRef.current);
        if (!value || typeof value !== 'object' || !('state' in value)) {
          onStateChangeRef.current?.('error');
          setState('error');
          setRefreshing(false);
          return;
        }
        const envelope = value as ChannelViewPayload;
        setRefreshing(false);
        setStale(envelope.stale === true);
        if (envelope.state !== 'supported') {
          setChannels([]);
          publishCache({ channels: envelope, details: existingCache?.details ?? {} });
          onStateChangeRef.current?.('unsupported');
          setState('unsupported');
          return;
        }
        const items = Array.isArray(envelope.channels) ? envelope.channels : [];
        setChannels(items);
        onLoadedRef.current?.(items);
        onStateChangeRef.current?.('supported');
        const nextCache = { channels: envelope, details: existingCache?.details ?? {} };
        publishCache(nextCache);
        if (items.length === 0) {
          setState('no-data');
          return;
        }
        setState('success');
        await loadDetail(items[0]!, envelope, force);
      } catch {
        setRefreshing(false);
        if (previous) {
          setChannels(previous.channels);
          setSelected(previous.selected);
          setDetail(previous.detail);
          setDetailError(false);
          setStale(true);
          onStateChangeRef.current?.('supported');
          return;
        }
        onStateChangeRef.current?.('error');
        setState('error');
      }
    },
    [loadDetail, publishCache],
  );

  useEffect(() => {
    selectedIdRef.current = selected?.id;
  }, [selected?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useLayoutEffect(() => {
    const update = () => {
      const rect = props.anchor.getBoundingClientRect();
      const width = Math.max(300, Math.min(720, window.innerWidth - 32));
      const left = Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16));
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const maxHeight = Math.max(
        280,
        Math.min(680, window.innerHeight - 32, Math.max(below, above)),
      );
      const top = below >= 420 ? rect.bottom + 8 : Math.max(16, rect.top - maxHeight - 8);
      setStyle({ width, left, top, maxHeight });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [props.anchor]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !props.anchor.contains(target)) props.onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [props.anchor, props.onClose]);

  const status = detail?.models[0]?.status ?? selected?.status ?? 'unknown';
  const model = detail?.models[0];
  const displayTimeline = selected
    ? channelTimelineForDisplay(selected.timeline ?? [], Date.now(), 20)
    : [];
  const displayChannelTimeline = (channel: Channel) =>
    channelTimelineForDisplay(channel.timeline ?? [], Date.now(), 20);
  const checkedAt = displayTimeline.at(-1)?.checkedAt;
  const toggleAssociation = async (channelId: string) => {
    const groupId = props.associationGroupId;
    if (!groupId || !props.onAssociationSave || associationBusyId) return;
    const previous = associatedChannelIds;
    const next = toggleChannelAssociation(previous, channelId);
    setAssociatedChannelIds(next);
    setAssociationBusyId(channelId);
    setAssociationMessage('');
    try {
      await props.onAssociationSave(groupId, next);
      setAssociationMessage(next.includes(channelId) ? '已关联渠道' : '已取消关联');
    } catch {
      setAssociatedChannelIds(previous);
      setAssociationMessage('关联保存失败，已恢复原状态');
    } finally {
      setAssociationBusyId(undefined);
    }
  };
  return createPortal(
    <div
      ref={panelRef}
      className="rate-channel-popover"
      style={style}
      role="dialog"
      aria-label={`${props.siteName} 渠道状态`}
    >
      <header className="rate-popover-header">
        <div>
          <span>渠道状态</span>
          <strong>{props.siteName}</strong>
        </div>
        <div>
          <button
            type="button"
            aria-label="刷新渠道状态"
            title="刷新渠道状态"
            disabled={state === 'loading' || refreshing}
            onClick={() => void load(true)}
          >
            <RefreshCw
              size={16}
              className={state === 'loading' || refreshing ? 'spin' : undefined}
            />
          </button>
          <button type="button" aria-label="关闭渠道状态弹窗" title="关闭" onClick={props.onClose}>
            <X size={17} />
          </button>
        </div>
      </header>
      {stale && (
        <div className="rate-channel-stale" role="status">
          <AlertTriangle size={14} />
          <span>更新失败，显示上次数据</span>
          <button
            type="button"
            aria-label="重试渠道状态"
            title="重试渠道状态"
            onClick={() => void load(true)}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      )}
      {state === 'loading' ? (
        <div className="rate-channel-state" role="status">
          <RefreshCw size={24} className="spin" />
          <strong>正在读取渠道状态…</strong>
          <span>正在同步当前站点的渠道列表</span>
        </div>
      ) : state === 'error' ? (
        <div className="rate-channel-state" role="alert">
          <AlertTriangle size={24} />
          <strong>渠道状态读取失败</strong>
          <button type="button" onClick={() => void load(true)}>
            重试
          </button>
        </div>
      ) : state === 'unsupported' ? (
        <div className="rate-channel-state">
          <Activity size={24} />
          <strong>该站点不支持渠道状态</strong>
          <span>渠道能力缺失不会影响余额和用量查询</span>
        </div>
      ) : state === 'no-data' ? (
        <div className="rate-channel-state">
          <Activity size={24} />
          <strong>暂无对应渠道状态</strong>
          <span>该站点暂时没有可用的渠道监控记录</span>
        </div>
      ) : !selected ? (
        <div className="rate-channel-state">
          <Activity size={24} />
          <strong>暂无对应渠道状态</strong>
        </div>
      ) : (
        <div className="rate-channel-content">
          <div className="rate-channel-hero">
            <div className="rate-channel-icon">
              <Activity size={20} />
            </div>
            <div>
              <span className="eyebrow">当前关联渠道</span>
              <h3>{detail?.name ?? selected.name}</h3>
              <p>
                {(detail?.groupName ?? selected.groupName) || '分组待查询'} ·{' '}
                {(detail?.platform ?? selected.platform) || '平台待查询'}
              </p>
            </div>
            <div className="rate-channel-hero-status">
              <span className={`rate-channel-status ${status}`}>{statusLabel(status)}</span>
            </div>
          </div>
          {detailLoading ? (
            <div className="rate-channel-detail-progress" role="status">
              <RefreshCw size={14} className="spin" /> 正在读取渠道详情…
            </div>
          ) : detailError ? (
            <div className="rate-channel-detail-progress error" role="alert">
              <AlertTriangle size={14} /> 渠道详情读取失败
              <button
                type="button"
                onClick={() =>
                  selected &&
                  cacheRef.current?.channels &&
                  void loadDetail(selected, cacheRef.current.channels, true)
                }
              >
                重试
              </button>
            </div>
          ) : null}
          <div className="rate-channel-metrics">
            <span>
              <Zap size={14} />
              对话延迟 <b>{formatMilliseconds(selected.latencyMs)}</b>
            </span>
            <span>
              <Globe2 size={14} />
              端点 PING <b>{formatMilliseconds(selected.pingMs)}</b>
            </span>
            <span>
              <Clock3 size={14} />7 天可用率{' '}
              <b>{formatAvailability(model?.availability7d ?? selected.availability7d)}</b>
            </span>
            <span>
              <CheckCircle2 size={14} />
              最近检查 <b>{formatCheckedAt(checkedAt)}</b>
            </span>
          </div>
          <div className="rate-channel-timeline">
            <div>
              <span>状态时间线</span>
              <small>近 {displayTimeline.length} 次记录</small>
            </div>
            {displayTimeline.length ? (
              <div className="rate-channel-sparkline">
                {displayTimeline.map((point, index) => (
                  <i className={point.status} key={`${point.checkedAt}-${index}`} />
                ))}
              </div>
            ) : (
              <div className="rate-channel-timeline-empty">暂无状态记录</div>
            )}
            <div className="rate-channel-timeline-label">
              <span>PAST</span>
              <span>NOW</span>
            </div>
          </div>
          <div className="rate-channel-list" aria-label="全部渠道状态">
            {channels.map((channel) => {
              const associated = associatedChannelIds.includes(channel.id);
              return (
                <article
                  className={`rate-channel-list-card ${channel.id === selected.id ? 'selected' : ''}`}
                  key={channel.id}
                >
                  <button
                    type="button"
                    className="rate-channel-list-select"
                    aria-label={`查看 ${channel.name} 渠道详情`}
                    onClick={() =>
                      cacheRef.current?.channels &&
                      void loadDetail(channel, cacheRef.current.channels)
                    }
                  >
                    <span className="rate-channel-list-head">
                      <b title={channel.name}>{channel.name}</b>
                      <em className={`rate-channel-status ${channel.status}`}>
                        {statusLabel(channel.status)}
                      </em>
                    </span>
                    <small>
                      {channel.groupName || '分组待查询'} · {channel.platform || '平台待查询'}
                    </small>
                    <small title={[channel.primaryModel, ...channel.extraModels].join('、')}>
                      {[channel.primaryModel, ...channel.extraModels].filter(Boolean).join('、') ||
                        '模型待查询'}
                    </small>
                    <span className="rate-channel-list-metrics">
                      <small>延迟 {formatMilliseconds(channel.latencyMs)}</small>
                      <small>Ping {formatMilliseconds(channel.pingMs)}</small>
                      <small>可用率 {formatAvailability(channel.availability7d)}</small>
                    </span>
                    <span className="rate-channel-sparkline" aria-label="渠道状态时间线">
                      {displayChannelTimeline(channel).length ? (
                        displayChannelTimeline(channel).map((point, index) => (
                          <i className={point.status} key={`${point.checkedAt}-${index}`} />
                        ))
                      ) : (
                        <small>暂无状态记录</small>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`rate-channel-association-button ${associated ? 'associated' : ''}`}
                    aria-label={`${associated ? '取消关联' : '关联'} ${channel.name}`}
                    aria-pressed={associated}
                    disabled={
                      !props.associationGroupId ||
                      !props.onAssociationSave ||
                      associationBusyId !== undefined
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggleAssociation(channel.id);
                    }}
                  >
                    {associationBusyId === channel.id ? '保存中…' : associated ? '已关联' : '关联'}
                  </button>
                </article>
              );
            })}
          </div>
          {associationMessage && (
            <div className="rate-channel-association-message" role="status">
              {associationMessage}
            </div>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

function statusLabel(status: Channel['status']) {
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

function formatCheckedAt(value: string | undefined) {
  if (!value) return '待查询';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '待查询'
    : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
