import type { AvailableRateGroup } from '../../../../electron/shared/contracts';
import {
  resolveKeyGroupChannel,
  type AvailableChannelRelationship,
} from '../channels/channel-ranking';

export interface PlatformMinimum {
  platformKey: string;
  platformLabel: string;
  comparisonRate: number;
  effectiveRate?: number;
  groups: AvailableRateGroup[];
}

export interface ComparableRateSite {
  siteId: string;
  siteName: string;
  ratio?: number;
  groups: AvailableRateGroup[];
  channels?: RateChannelSnapshot[];
  relationships?: AvailableChannelRelationship[];
  channelState?: 'supported' | 'unsupported' | 'error';
}

export interface RateChannelSnapshot {
  id: string;
  name: string;
  groupName?: string;
  platform?: string;
  status: 'normal' | 'degraded' | 'failed' | 'unknown';
  availability7d?: number;
  timeline?: Array<{ status: 'normal' | 'degraded' | 'failed' | 'unknown'; checkedAt?: string }>;
}

export interface PlatformRateComparison {
  platformKey: string;
  platformLabel: string;
  effectiveRate: number;
  priceScore: number;
  stabilityScore: number;
  stabilityLabel: '稳定' | '存在异常' | '状态未知' | '无渠道状态';
  sites: Array<{
    siteId: string;
    siteName: string;
    ratio: number;
    rawRate: number;
    effectiveRate: number;
    groups: AvailableRateGroup[];
    priceScore: number;
    stabilityScore: number;
    totalScore: number;
    stabilityLabel: '稳定' | '存在异常' | '状态未知' | '无渠道状态';
    channelId?: string;
  }>;
}

const RATE_EPSILON = 1e-9;

export function effectiveRate(rate: number, ratio?: number): number | undefined {
  if (!Number.isFinite(rate) || rate < 0 || !Number.isFinite(ratio) || (ratio ?? 0) <= 0)
    return undefined;
  return rate / ratio!;
}

export function formatRateMultiplier(rate: number | undefined): string {
  if (rate === undefined || !Number.isFinite(rate) || rate < 0) return '—';
  const rounded = Math.round((rate + Number.EPSILON) * 1_000_000) / 1_000_000;
  return `${rounded.toFixed(6).replace(/\.?0+$/, '')}x`;
}

export function normalizePlatform(platform: string): { key: string; label: string } {
  const value = platform.trim();
  const key = value.toLocaleLowerCase();
  if (['openai', 'chatgpt'].includes(key)) return { key: 'openai', label: 'OpenAI' };
  if (['anthropic', 'claude'].includes(key)) return { key: 'claude', label: 'Claude' };
  if (['google', 'gemini'].includes(key)) return { key: 'gemini', label: 'Gemini' };
  if (['xai', 'x.ai', 'grok'].includes(key)) return { key: 'grok', label: 'Grok' };
  return { key, label: value };
}

export function parseRechargeRatio(value: string): number | undefined {
  const ratio = Number(value.trim());
  return value.trim() && Number.isFinite(ratio) && ratio > 0 ? ratio : undefined;
}

export function filterRateGroups(
  groups: AvailableRateGroup[],
  platformKey: string,
  search: string,
): AvailableRateGroup[] {
  const query = search.trim().toLocaleLowerCase();
  return groups.filter((group) => {
    if (platformKey !== 'all' && normalizePlatform(group.platform).key !== platformKey)
      return false;
    if (!query) return true;
    return `${group.name}\n${group.description ?? ''}`.toLocaleLowerCase().includes(query);
  });
}

export function findPlatformMinima(
  groups: AvailableRateGroup[],
  ratio?: number,
): PlatformMinimum[] {
  const results = new Map<string, PlatformMinimum>();
  const hasRatio = Number.isFinite(ratio) && (ratio ?? 0) > 0;
  for (const group of groups) {
    if (group.status && group.status !== 'active') continue;
    if (!Number.isFinite(group.rate) || group.rate < 0) continue;
    const platform = normalizePlatform(group.platform);
    const normalized = effectiveRate(group.rate, ratio);
    const comparisonRate = normalized ?? group.rate;
    const current = results.get(platform.key);
    if (!current || comparisonRate < current.comparisonRate - RATE_EPSILON) {
      results.set(platform.key, {
        platformKey: platform.key,
        platformLabel: platform.label,
        comparisonRate,
        effectiveRate: hasRatio ? comparisonRate : undefined,
        groups: [group],
      });
    } else if (Math.abs(comparisonRate - current.comparisonRate) <= RATE_EPSILON) {
      current.groups.push(group);
    }
  }
  return [...results.values()]
    .map((item) => ({
      ...item,
      groups: [...item.groups].sort(
        (left, right) =>
          left.name.localeCompare(right.name, 'zh-CN') || left.id.localeCompare(right.id),
      ),
    }))
    .sort((left, right) => left.platformLabel.localeCompare(right.platformLabel, 'zh-CN'));
}

const STABILITY_SCORES = {
  normal: 10,
  degraded: 5,
  failed: 0,
  unknown: 3,
  none: 5,
} as const;

export function channelStability(
  channel: RateChannelSnapshot | undefined,
  now = Date.now(),
  channelState?: ComparableRateSite['channelState'],
): {
  score: number;
  label: '稳定' | '存在异常' | '状态未知' | '无渠道状态';
} {
  if (!channel)
    return channelState === 'error'
      ? { score: STABILITY_SCORES.unknown, label: '状态未知' }
      : { score: STABILITY_SCORES.none, label: '无渠道状态' };
  const recent = (channel.timeline ?? []).filter((point) => {
    const checkedAt = Date.parse(point.checkedAt ?? '');
    return Number.isFinite(checkedAt) && now - checkedAt <= 5 * 60_000 && now >= checkedAt;
  });
  if (recent.some((point) => point.status === 'failed'))
    return { score: STABILITY_SCORES.failed, label: '存在异常' };
  if (recent.some((point) => point.status === 'degraded'))
    return { score: STABILITY_SCORES.degraded, label: '存在异常' };
  if (recent.some((point) => point.status === 'unknown'))
    return { score: STABILITY_SCORES.unknown, label: '状态未知' };
  if (recent.length === 0) return { score: STABILITY_SCORES.unknown, label: '状态未知' };
  if (channel.status === 'failed') return { score: STABILITY_SCORES.failed, label: '存在异常' };
  if (channel.status === 'degraded') return { score: STABILITY_SCORES.degraded, label: '存在异常' };
  if (channel.status === 'unknown') return { score: STABILITY_SCORES.unknown, label: '状态未知' };
  return { score: STABILITY_SCORES.normal, label: '稳定' };
}

function scoreCandidate(
  effective: number,
  minimum: number,
  stability: ReturnType<typeof channelStability>,
) {
  const priceScore =
    effective <= RATE_EPSILON ? 10 : Math.min(10, Math.max(0, (minimum / effective) * 10));
  return {
    priceScore,
    stabilityScore: stability.score,
    totalScore: priceScore * 0.6 + stability.score * 0.4,
  };
}

export function comparePlatformRates(sites: ComparableRateSite[]): PlatformRateComparison[] {
  const now = Date.now();
  const candidates = new Map<
    string,
    Array<{
      siteId: string;
      siteName: string;
      ratio: number;
      rawRate: number;
      effectiveRate: number;
      groups: AvailableRateGroup[];
      stability: ReturnType<typeof channelStability>;
      channelId?: string;
    }>
  >();
  for (const site of sites) {
    if (!Number.isFinite(site.ratio) || (site.ratio ?? 0) <= 0) continue;
    const ratio = site.ratio!;
    for (const minimum of findPlatformMinima(site.groups, ratio)) {
      if (minimum.effectiveRate === undefined) continue;
      for (const group of minimum.groups) {
        const channel = resolveKeyGroupChannel(
          site.channels ?? [],
          group.name,
          site.relationships ?? [],
        );
        const stability = channelStability(channel, now, site.channelState);
        const candidate = {
          siteId: site.siteId,
          siteName: site.siteName,
          ratio,
          rawRate: group.rate,
          effectiveRate: minimum.effectiveRate,
          groups: [group],
          stability,
          ...(channel?.id ? { channelId: channel.id } : {}),
        };
        const current = candidates.get(minimum.platformKey) ?? [];
        current.push(candidate);
        candidates.set(minimum.platformKey, current);
      }
    }
  }
  const order = ['openai', 'claude', 'gemini', 'grok'];
  return [...candidates.entries()]
    .map(([platformKey, items]) => {
      const minimum = Math.min(...items.map((item) => item.effectiveRate));
      const scored = items.map((item) => ({
        ...item,
        ...scoreCandidate(item.effectiveRate, minimum, item.stability),
      }));
      const ranked = scored.sort(
        (left, right) =>
          right.totalScore - left.totalScore ||
          right.stabilityScore - left.stabilityScore ||
          right.priceScore - left.priceScore ||
          left.siteName.localeCompare(right.siteName, 'zh-CN') ||
          (left.groups[0]?.name ?? '').localeCompare(right.groups[0]?.name ?? '', 'zh-CN') ||
          left.siteId.localeCompare(right.siteId),
      );
      const first = ranked[0]!;
      return {
        platformKey,
        platformLabel: normalizePlatform(platformKey).label,
        effectiveRate: first.effectiveRate,
        priceScore: first.priceScore,
        stabilityScore: first.stabilityScore,
        stabilityLabel: first.stability.label,
        sites: ranked.map((item) => ({
          siteId: item.siteId,
          siteName: item.siteName,
          ratio: item.ratio,
          rawRate: item.rawRate,
          effectiveRate: item.effectiveRate,
          groups: item.groups,
          priceScore: item.priceScore,
          stabilityScore: item.stabilityScore,
          totalScore: item.totalScore,
          stabilityLabel: item.stability.label,
          ...(item.channelId ? { channelId: item.channelId } : {}),
        })),
      };
    })
    .sort(
      (left, right) =>
        (order.indexOf(left.platformKey) === -1 ? 99 : order.indexOf(left.platformKey)) -
          (order.indexOf(right.platformKey) === -1 ? 99 : order.indexOf(right.platformKey)) ||
        left.platformLabel.localeCompare(right.platformLabel, 'zh-CN'),
    );
}
