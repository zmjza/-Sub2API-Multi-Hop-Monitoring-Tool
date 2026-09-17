import { Activity, Boxes, Gem, Globe2, Orbit, Sparkles, Zap } from 'lucide-react';
import type { ChannelViewPayload } from '../../../../electron/shared/contracts';
import {
  channelPlatformFamilyLabel,
  channelTimelineSlotsForDisplay,
  normalizeChannelPlatformFamily,
  v2MatrixBuckets,
  type ChannelPlatformFamily,
  type V2MatrixRange,
} from './channel-ranking';

type ChannelCardItem = ChannelViewPayload['channels'][number];

const FAMILY_ICONS = {
  openai: Activity,
  anthropic: Sparkles,
  grok: Orbit,
  gemini: Gem,
  other: Boxes,
} as const;

export function ChannelFamilyHeader(props: {
  family: ChannelPlatformFamily;
  count: number;
  label?: string;
  compact?: boolean;
}) {
  const Icon = FAMILY_ICONS[props.family];
  return (
    <header
      className={`channel-family-header family-${props.family}${props.compact ? ' is-compact' : ''}`}
    >
      <span className={`channel-family-icon family-${props.family}`}>
        <Icon size={props.compact ? 14 : 18} aria-hidden />
      </span>
      <h2>{props.label ?? channelPlatformFamilyLabel(props.family)}</h2>
      <em>{props.count}</em>
    </header>
  );
}

export function ChannelStatusCard(props: {
  item: ChannelCardItem;
  selected?: boolean;
  monitorSource: string;
  v2Range?: V2MatrixRange;
  onSelect?: (id: string) => void;
}) {
  const family = normalizeChannelPlatformFamily(props.item.platform);
  const Icon = FAMILY_ICONS[family];
  const v2Range = props.v2Range ?? '90m';
  const slots = channelTimelineSlotsForDisplay(props.item.timeline ?? []);
  const matrix = v2MatrixBuckets(props.item.v2?.buckets ?? [], v2Range);
  const v2 = props.monitorSource === 'v2';
  const lastSlot = slots.filter((slot) => !slot.empty).at(-1);
  const lastCheckedAt =
    lastSlot && !lastSlot.empty ? String(lastSlot.point.checkedAt ?? '') : undefined;
  return (
    <article
      className={`channel-card ${props.item.status} ${props.selected ? 'selected' : ''}`}
      onClick={() => props.onSelect?.(props.item.id)}
    >
      <div className="channel-card-head">
        <div className="channel-title">
          <div className={`channel-icon family-${family}`}>
            <Icon size={20} />
          </div>
          <div>
            <h3 title={props.item.name}>{props.item.name}</h3>
            <span>
              <b>{props.item.platform || '平台待查询'}</b>
              {v2 ? '' : ' · ' + (props.item.primaryModel || '模型待查询')}
            </span>
          </div>
        </div>
        <div className="channel-card-status-stack">
          <span className={`status-pill ${statusClass(props.item.status)}`}>
            {statusLabel(props.item.status, props.monitorSource)}
          </span>
        </div>
      </div>
      <div className={`channel-metrics ${v2 ? 'metrics-3' : ''}`}>
        {v2 ? (
          <>
            <div>
              <span>
                <Activity size={14} /> 缓存率
              </span>
              <strong>{formatRate(props.item.v2?.cacheRate)}</strong>
            </div>
            <div>
              <span>
                <Zap size={14} /> 首 Token
              </span>
              <strong className={ttftTone(props.item.v2?.ttftMs)}>
                {formatHoverTtft(props.item.v2?.ttftMs)}
              </strong>
            </div>
            <div>
              <span>
                <Activity size={14} /> 可用率
              </span>
              <strong className={rateTone(props.item.v2?.successRate)}>
                {formatRate(props.item.v2?.successRate)}
              </strong>
            </div>
          </>
        ) : (
          <>
            <div>
              <span>
                <Zap size={14} /> 对话延迟
              </span>
              <strong>{formatMilliseconds(props.item.latencyMs)}</strong>
            </div>
            <div>
              <span>
                <Globe2 size={14} /> 端点 PING
              </span>
              <strong>{formatMilliseconds(props.item.pingMs)}</strong>
            </div>
          </>
        )}
      </div>
      <div className="availability">
        {v2 ? (
          <>
            <div>
              <span>近 18 次记录</span>
              <span>{props.item.v2?.coveragePartial ? '部分覆盖' : `矩阵 · ${v2Range}`}</span>
            </div>
            <div className="sparkline" aria-label="近 18 次记录">
              {matrix.map((point, index) => (
                <i
                  className={statusClass(point.status)}
                  key={`${point.checkedAt}-${index}`}
                  title={formatV2BucketTip(point)}
                />
              ))}
            </div>
            <div className="timeline-label">
              <span>PAST</span>
              <span>NOW</span>
            </div>
          </>
        ) : (
          <>
            <div>
              <span>可用性 · 7 天</span>
              <strong>{formatAvailability(props.item.availability7d)}</strong>
            </div>
            <div className="sparkline" aria-label="近 18 次记录">
              {slots.map((slot, index) => (
                <i
                  className={slot.empty ? 'empty' : statusClass(slot.point.status)}
                  key={slot.empty ? `empty-${index}` : `${slot.point.checkedAt}-${index}`}
                />
              ))}
            </div>
            <small>
              近 18 次记录 <em>{formatCheckedAt(lastCheckedAt)}</em>
            </small>
            <div className="timeline-label">
              <span>PAST</span>
              <span>NOW</span>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

export function statusClass(status: string | undefined) {
  if (status === 'normal') return 'good';
  if (status === 'degraded') return 'warn';
  if (status === 'failed') return 'bad';
  if (status === 'empty') return 'empty';
  return 'unknown';
}

export function ChannelSparkline(props: {
  timeline?: Array<{ checkedAt?: unknown; status?: string }>;
  className?: string;
  ariaLabel?: string;
  rawStatus?: boolean;
}) {
  const slots = channelTimelineSlotsForDisplay(props.timeline ?? []);
  return (
    <span className={props.className ?? 'sparkline'} aria-label={props.ariaLabel ?? '近 18 次记录'}>
      {slots.map((slot, index) => (
        <i
          className={
            slot.empty
              ? 'empty'
              : props.rawStatus
                ? String(slot.point.status ?? 'unknown')
                : statusClass(String(slot.point.status ?? ''))
          }
          key={slot.empty ? `empty-${index}` : `${String(slot.point.checkedAt)}-${index}`}
        />
      ))}
    </span>
  );
}

export function formatV2BucketTip(point: {
  checkedAt?: string;
  successRate?: number;
  cacheRate?: number;
  ttftMs?: number;
}) {
  const when = formatCheckedAt(point.checkedAt);
  const prefix = when === '待查询' ? '当前' : when;
  return `${prefix} · 可用率 ${formatHoverRate(point.successRate)} · 缓存率 ${formatHoverRate(point.cacheRate)} · 首 Token ${formatHoverTtft(point.ttftMs)}`;
}

function statusLabel(status: string | undefined, monitorSource: string) {
  if (monitorSource === 'v2') {
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

function formatHoverRate(value: number | undefined) {
  return value === undefined ? '—' : (value * 100).toFixed(1) + '%';
}

function formatHoverTtft(value: number | undefined) {
  return value === undefined ? '—' : (value / 1000).toFixed(1) + 's';
}

function rateTone(value: number | undefined) {
  if (value === undefined) return 'unknown';
  if (value < 0.3) return 'bad';
  if (value < 0.7) return 'warn';
  return 'good';
}

function ttftTone(value: number | undefined) {
  if (value === undefined) return 'unknown';
  if (value >= 30_000) return 'bad';
  if (value >= 10_000) return 'warn';
  return 'good';
}

function formatCheckedAt(value: string | undefined) {
  if (!value) return '待查询';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '待查询'
    : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
