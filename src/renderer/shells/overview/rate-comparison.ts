import type { AvailableRateGroup } from '../../../../electron/shared/contracts';
import {
  matchGroupToChannel,
  resolveFinalChannelAssociation,
  normalizeChannelIdentity,
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
  relationshipsState?: 'complete' | 'partial' | 'empty' | 'error';
  channelAssociations?: Array<{
    groupId: string;
    channelIds: string[];
    source: 'auto' | 'manual' | 'unmatched';
  }>;
}

export interface RateChannelSnapshot {
  id: string;
  name: string;
  groupName?: string;
  platform?: string;
  primaryModel?: string;
  extraModels?: string[];
  status: 'normal' | 'degraded' | 'failed' | 'unknown';
  availability7d?: number;
  timeline?: Array<{ status: 'normal' | 'degraded' | 'failed' | 'unknown'; checkedAt?: string }>;
}

export interface PlatformRateComparison {
  platformKey: string;
  platformLabel: string;
  state: 'ready' | 'checking' | 'empty';
  effectiveRate?: number;
  priceScore?: number;
  stabilityScore?: number;
  stabilityLabel: '稳定' | '无渠道状态' | '正在核验' | '暂无稳定渠道';
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
    stabilityLabel: '稳定' | '无渠道状态' | '状态未知' | '存在异常';
    channelId?: string;
    recommendationKind: 'with-status' | 'without-status';
  }>;
}

const RATE_EPSILON = 1e-9;
const disabledNoChannelKeywords = ['生图', '停用', '禁止', 'image2', '图片'];

export function isDisabledNoChannelGroup(group: AvailableRateGroup): boolean {
  const name = group.name.normalize('NFKC').toLocaleLowerCase();
  return disabledNoChannelKeywords.some((keyword) =>
    name.includes(keyword.normalize('NFKC').toLocaleLowerCase()),
  );
}

export function effectiveRate(rate: number, ratio?: number): number | undefined {
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(ratio) || (ratio ?? 0) <= 0)
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
  if (['google', 'gemini', 'antigravity'].includes(key)) return { key: 'gemini', label: 'Gemini' };
  if (['xai', 'x.ai', 'grok'].includes(key)) return { key: 'grok', label: 'Grok' };
  return { key, label: value };
}

type PlatformChannelEvidence = Pick<
  RateChannelSnapshot,
  'id' | 'name' | 'platform' | 'primaryModel' | 'extraModels' | 'status'
>;

function platformFromText(value?: string): { key: string; label: string } | undefined {
  const text = (value ?? '').normalize('NFKC').toLocaleLowerCase();
  const detected = new Set<string>();
  if (/(^|[^a-z0-9])(openai|chatgpt|codex|gpt(?:[-_. ]?\d+)?)(?=$|[^a-z0-9])/.test(text))
    detected.add('openai');
  if (/(^|[^a-z0-9])(claude|anthropic)(?=$|[^a-z0-9])/.test(text)) detected.add('claude');
  if (/(^|[^a-z0-9])(gemini|google[ ._-]*gemini|antigravity)(?=$|[^a-z0-9])/.test(text))
    detected.add('gemini');
  if (/(^|[^a-z0-9])(grok|xai|x\.ai)(?=$|[^a-z0-9])/.test(text)) detected.add('grok');
  return detected.size === 1 ? normalizePlatform([...detected][0]!) : undefined;
}

export function resolveActualPlatform(
  group: AvailableRateGroup,
  channel?: PlatformChannelEvidence,
  relationships: AvailableChannelRelationship[] = [],
): { key: string; label: string } {
  const evidence = [
    platformFromText(group.name),
    platformFromText([channel?.primaryModel, ...(channel?.extraModels ?? [])].join(' ')),
    platformFromText(group.description),
  ];
  for (const result of evidence) if (result) return result;

  const normalizedGroup = normalizeChannelIdentity(group.name);
  const relatedPlatforms = new Set(
    relationships.flatMap((relationship) =>
      relationship.platforms.flatMap((section) =>
        section.groupNames.some((name) => normalizeChannelIdentity(name) === normalizedGroup)
          ? [normalizePlatform(section.platform).key]
          : [],
      ),
    ),
  );
  if (relatedPlatforms.size === 1) return normalizePlatform([...relatedPlatforms][0]!);
  return normalizePlatform(channel?.platform || group.platform);
}

export function resolveGroupPlatform(
  group: AvailableRateGroup,
  channels: RateChannelSnapshot[] = [],
  relationships: AvailableChannelRelationship[] = [],
): { key: string; label: string } {
  const match = matchGroupToChannel(channels, group.name, relationships, group.id);
  return resolveActualPlatform(
    group,
    match.status === 'matched' ? match.channel : undefined,
    relationships,
  );
}

export type RateRefreshMinutes = 1 | 3 | 5 | 10;

export function rateRefreshIntervalMs(value: number): number {
  return ([1, 3, 5, 10].includes(value) ? value : 5) * 60_000;
}

export function parseRechargeRatio(value: string): number | undefined {
  const ratio = Number(value.trim());
  return value.trim() && Number.isFinite(ratio) && ratio > 0 ? ratio : undefined;
}

export function filterRateGroups(
  groups: AvailableRateGroup[],
  platformKey: string,
  search: string,
  channels: RateChannelSnapshot[] = [],
  relationships: AvailableChannelRelationship[] = [],
): AvailableRateGroup[] {
  const query = search.trim().toLocaleLowerCase();
  return groups.filter((group) => {
    if (
      platformKey !== 'all' &&
      resolveGroupPlatform(group, channels, relationships).key !== platformKey
    )
      return false;
    if (!query) return true;
    return `${group.name}\n${group.description ?? ''}`.toLocaleLowerCase().includes(query);
  });
}

export function findPlatformMinima(
  groups: AvailableRateGroup[],
  ratio?: number,
  channels: RateChannelSnapshot[] = [],
  relationships: AvailableChannelRelationship[] = [],
): PlatformMinimum[] {
  const results = new Map<string, PlatformMinimum>();
  const hasRatio = Number.isFinite(ratio) && (ratio ?? 0) > 0;
  for (const group of groups) {
    if (group.status && group.status !== 'active') continue;
    if (!Number.isFinite(group.rate) || group.rate <= 0) continue;
    const platform = resolveGroupPlatform(group, channels, relationships);
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

export type ChannelEligibility =
  | { eligible: true; score: 10; label: '稳定' }
  | {
      eligible: false;
      reason:
        | 'pending'
        | 'unsupported'
        | 'request-error'
        | 'unmatched'
        | 'current-issue'
        | 'invalid-record'
        | 'future-record'
        | 'no-recent-record'
        | 'recent-issue';
    };

export function channelEligibility(
  channel: RateChannelSnapshot | undefined,
  now = Date.now(),
  channelState?: ComparableRateSite['channelState'],
): ChannelEligibility {
  if (channelState === undefined) return { eligible: false, reason: 'pending' };
  if (channelState === 'unsupported') return { eligible: false, reason: 'unsupported' };
  if (channelState === 'error') return { eligible: false, reason: 'request-error' };
  if (!channel) return { eligible: false, reason: 'unmatched' };

  const parsed = (channel.timeline ?? []).map((point) => ({
    point,
    checkedAt: Date.parse(point.checkedAt ?? ''),
  }));
  if (parsed.some((item) => !Number.isFinite(item.checkedAt)))
    return { eligible: false, reason: 'invalid-record' };
  if (parsed.some((item) => item.checkedAt > now))
    return { eligible: false, reason: 'future-record' };
  const windowStart = now - 60_000;
  const recent = parsed.filter((item) => item.checkedAt >= windowStart && item.checkedAt <= now);
  if (!recent.length) {
    // An explicitly unknown/empty current status is still an allowed stable value.
    // Other statuses require a fresh timeline point to prove the one-minute window.
    if (channel.status === 'unknown') return { eligible: true, score: 10, label: '稳定' };
    if (isUnstableChannelStatus(channel.status))
      return { eligible: false, reason: 'current-issue' };
    return { eligible: false, reason: 'no-recent-record' };
  }
  if (recent.some((item) => isUnstableChannelStatus(item.point.status)))
    return {
      eligible: false,
      reason: isUnstableChannelStatus(channel.status) ? 'current-issue' : 'recent-issue',
    };
  return { eligible: true, score: 10, label: '稳定' };
}

function isUnstableChannelStatus(status?: string): boolean {
  return ['failed', 'error', 'down', 'unavailable'].includes((status ?? '').trim().toLowerCase());
}

export function channelStability(
  channel: RateChannelSnapshot | undefined,
  now = Date.now(),
  channelState?: ComparableRateSite['channelState'],
): { score: number; label: '稳定' | '存在异常' | '状态未知' | '无渠道状态' } {
  const eligibility = channelEligibility(channel, now, channelState);
  if (eligibility.eligible) return { score: 10, label: '稳定' };
  if (eligibility.reason === 'unmatched' || eligibility.reason === 'unsupported')
    return { score: 0, label: '无渠道状态' };
  if (eligibility.reason === 'current-issue' || eligibility.reason === 'recent-issue')
    return { score: 0, label: '存在异常' };
  return { score: 0, label: '状态未知' };
}

type EligibleCandidate = {
  siteId: string;
  siteName: string;
  ratio: number;
  rawRate: number;
  effectiveRate: number;
  groups: [AvailableRateGroup];
  availability7d: number;
  channelId?: string;
  stabilityScore: number;
  stabilityLabel: '稳定' | '无渠道状态';
  recommendationKind: 'with-status' | 'without-status';
};

type PlatformPool = {
  platformLabel: string;
  checking: boolean;
  candidates: EligibleCandidate[];
};

function channelsForRateGroup(
  site: ComparableRateSite,
  group: AvailableRateGroup,
): RateChannelSnapshot[] {
  const association = resolveFinalChannelAssociation(
    site.channels ?? [],
    group.name,
    site.relationships ?? [],
    group.id,
    site.channelAssociations?.find((item) => item.groupId === group.id && item.source === 'manual')
      ?.channelIds ?? [],
    site.relationshipsState,
  );
  return association.status === 'matched' ? association.channels : [];
}

export function normalizedPriceScore(effective: number, minimum: number, maximum: number): number {
  if (Math.abs(maximum - minimum) <= RATE_EPSILON) return 10;
  return Math.min(10, Math.max(0, (10 * (maximum - effective)) / (maximum - minimum)));
}

export function comparePlatformRates(
  sites: ComparableRateSite[],
  now = Date.now(),
): PlatformRateComparison[] {
  const order = ['openai', 'claude', 'gemini', 'grok'];
  const pools = new Map<string, PlatformPool>(
    order.map((platformKey) => [
      platformKey,
      {
        platformLabel: normalizePlatform(platformKey).label,
        checking: false,
        candidates: [],
      },
    ]),
  );
  for (const site of sites) {
    if (!Number.isFinite(site.ratio) || (site.ratio ?? 0) <= 0) continue;
    const ratio = site.ratio!;
    for (const group of site.groups) {
      if (group.status !== 'active') continue;
      const normalizedRate = effectiveRate(group.rate, ratio);
      if (normalizedRate === undefined) continue;

      const matchedChannels = channelsForRateGroup(site, group);
      const channel = matchedChannels[0];
      const platform = resolveActualPlatform(group, channel, site.relationships);
      const pool = pools.get(platform.key) ?? {
        platformLabel: platform.label,
        checking: false,
        candidates: [],
      };
      const noChannelStatus = site.channelState !== 'supported' || matchedChannels.length === 0;
      if (noChannelStatus) {
        if (isDisabledNoChannelGroup(group)) continue;
        pool.candidates.push({
          siteId: site.siteId,
          siteName: site.siteName,
          ratio,
          rawRate: group.rate,
          effectiveRate: normalizedRate,
          groups: [group],
          availability7d: -1,
          stabilityScore: 0,
          stabilityLabel: '无渠道状态',
          recommendationKind: 'without-status',
        });
      } else {
        for (const matchedChannel of matchedChannels) {
          const eligibility = channelEligibility(matchedChannel, now, site.channelState);
          if (!eligibility.eligible) continue;
          pool.candidates.push({
            siteId: site.siteId,
            siteName: site.siteName,
            ratio,
            rawRate: group.rate,
            effectiveRate: normalizedRate,
            groups: [group],
            availability7d: matchedChannel.availability7d ?? -1,
            channelId: matchedChannel.id,
            stabilityScore: eligibility.score,
            stabilityLabel: eligibility.label,
            recommendationKind: 'with-status',
          });
        }
      }
      pools.set(platform.key, pool);
    }
  }

  return [...pools.entries()]
    .map(([platformKey, pool]): PlatformRateComparison => {
      if (!pool.candidates.length)
        return {
          platformKey,
          platformLabel: pool.platformLabel,
          state: pool.checking ? 'checking' : 'empty',
          stabilityLabel: pool.checking ? '正在核验' : '暂无稳定渠道',
          sites: [],
        };

      const scoreCandidates = (items: EligibleCandidate[], withStatus: boolean) => {
        if (!items.length) return [];
        const minimum = Math.min(...items.map((item) => item.effectiveRate));
        const maximum = Math.max(...items.map((item) => item.effectiveRate));
        return items.map((item) => {
          const priceScore = normalizedPriceScore(item.effectiveRate, minimum, maximum);
          return {
            ...item,
            priceScore,
            totalScore: withStatus ? priceScore * 0.6 + item.stabilityScore * 0.4 : priceScore,
          };
        });
      };
      const scored = [
        ...scoreCandidates(
          pool.candidates.filter((item) => item.recommendationKind === 'with-status'),
          true,
        ),
        ...scoreCandidates(
          pool.candidates.filter((item) => item.recommendationKind === 'without-status'),
          false,
        ),
      ];
      scored.sort(
        (left, right) =>
          right.totalScore - left.totalScore ||
          right.priceScore - left.priceScore ||
          left.effectiveRate - right.effectiveRate ||
          right.availability7d - left.availability7d ||
          left.siteName.localeCompare(right.siteName, 'zh-CN') ||
          left.groups[0].name.localeCompare(right.groups[0].name, 'zh-CN') ||
          left.siteId.localeCompare(right.siteId) ||
          left.groups[0].id.localeCompare(right.groups[0].id),
      );
      const first = scored.find((item) => item.recommendationKind === 'with-status');
      const second = scored.find((item) => item.recommendationKind === 'without-status');
      const leading = first ?? second;
      if (!leading)
        return {
          platformKey,
          platformLabel: pool.platformLabel,
          state: pool.checking ? 'checking' : 'empty',
          stabilityLabel: pool.checking ? '正在核验' : '暂无稳定渠道',
          sites: [],
        };
      const recommendations = [first, second].filter((item): item is NonNullable<typeof item> =>
        Boolean(item),
      );
      return {
        platformKey,
        platformLabel: pool.platformLabel,
        state: 'ready',
        effectiveRate: leading.effectiveRate,
        priceScore: leading.priceScore,
        stabilityScore: leading.stabilityScore,
        stabilityLabel: leading.stabilityLabel,
        sites: recommendations.map((item) => ({
          siteId: item.siteId,
          siteName: item.siteName,
          ratio: item.ratio,
          rawRate: item.rawRate,
          effectiveRate: item.effectiveRate,
          groups: item.groups,
          priceScore: item.priceScore,
          stabilityScore: item.stabilityScore,
          totalScore: item.totalScore,
          stabilityLabel: item.stabilityLabel,
          channelId: item.channelId,
          recommendationKind: item.recommendationKind,
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
