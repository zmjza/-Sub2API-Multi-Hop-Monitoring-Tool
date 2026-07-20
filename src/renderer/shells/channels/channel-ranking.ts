type RankableChannel = {
  name: string;
  groupName?: string;
  platform?: string;
  primaryModel?: string;
  extraModels?: string[];
  availability7d?: number;
};

export type AvailableChannelRelationship = {
  name: string;
  platforms: Array<{
    platform: string;
    groupNames: string[];
    modelNames: string[];
  }>;
};

export function normalizeChannelIdentity(value?: string): string {
  return (value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/【|\[/g, '(')
    .replace(/】|\]/g, ')')
    .replace(/[\s._‐‑‒–—-]/g, '');
}

function normalized(value?: string): string {
  return normalizeChannelIdentity(value);
}

export type ChannelMatchResult<T extends RankableChannel> =
  | { status: 'matched'; channel: T; basis: 'name' | 'relationship' }
  | { status: 'unmatched' }
  | { status: 'ambiguous'; candidates: T[] };

export function matchGroupToChannel<T extends RankableChannel>(
  channels: T[],
  groupName?: string,
  relationships: AvailableChannelRelationship[] = [],
): ChannelMatchResult<T> {
  const group = normalized(groupName);
  if (!group) return { status: 'unmatched' };

  const exact = channels.filter((channel) => normalized(channel.name) === group);
  if (exact.length === 1) return { status: 'matched', channel: exact[0]!, basis: 'name' };
  if (exact.length > 1) return { status: 'ambiguous', candidates: exact };

  const relatedSections = relationships.flatMap((relationship) =>
    relationship.platforms.flatMap((section) =>
      section.groupNames.some((name) => normalized(name) === group)
        ? [{ relationshipName: relationship.name, section }]
        : [],
    ),
  );
  if (!relatedSections.length) return { status: 'unmatched' };

  const related = channels.filter((channel) =>
    relatedSections.some(({ relationshipName, section }) => {
      if (normalized(channel.name) === normalized(relationshipName)) return true;
      if (normalized(channel.platform) !== normalized(section.platform)) return false;
      const channelModels = [channel.primaryModel, ...(channel.extraModels ?? [])]
        .map((model) => normalized(model))
        .filter(Boolean);
      return section.modelNames.some((model) => channelModels.includes(normalized(model)));
    }),
  );
  if (related.length === 1)
    return { status: 'matched', channel: related[0]!, basis: 'relationship' };
  if (related.length > 1) return { status: 'ambiguous', candidates: related };
  return { status: 'unmatched' };
}

export function matchesKeyGroup(channel: RankableChannel, groupName?: string): boolean {
  return matchGroupToChannel([channel], groupName).status === 'matched';
}

export function resolveKeyGroupChannel<T extends RankableChannel>(
  channels: T[],
  groupName?: string,
  relationships: AvailableChannelRelationship[] = [],
  usageModels: string[] = [],
): T | undefined {
  void usageModels;
  const result = matchGroupToChannel(channels, groupName, relationships);
  return result.status === 'matched' ? result.channel : undefined;
}

export function rankChannels<T extends RankableChannel>(
  channels: T[],
  groupName?: string,
  relationships: AvailableChannelRelationship[] = [],
  usageModels: string[] = [],
): T[] {
  const preferred = resolveKeyGroupChannel(channels, groupName, relationships, usageModels);
  return [...channels].sort((a, b) => {
    const preferredDifference = Number(b === preferred) - Number(a === preferred);
    if (preferredDifference) return preferredDifference;
    return (b.availability7d ?? -1) - (a.availability7d ?? -1);
  });
}

export function selectDisplayedChannel<T extends RankableChannel & { id: string }>(
  channels: T[],
  selectedChannelId: string | undefined,
  groupName?: string,
  relationships: AvailableChannelRelationship[] = [],
  usageModels: string[] = [],
): T | undefined {
  return (
    resolveKeyGroupChannel(channels, groupName, relationships, usageModels) ??
    channels.find((channel) => channel.id === selectedChannelId) ??
    channels[0]
  );
}

export function detailForDisplayedChannel<T extends { name: string }>(
  detail: T | undefined,
  displayedChannel: RankableChannel | undefined,
): T | undefined {
  return detail?.name === displayedChannel?.name ? detail : undefined;
}

export function formatRateLabel(rate?: number): string | undefined {
  if (rate === undefined || !Number.isFinite(rate) || rate < 0) return undefined;
  return `${Number(rate.toFixed(6))}x`;
}

export function groupRateForChannel(
  channel: RankableChannel,
  groups: Array<{ id?: string; name: string; rate?: number }>,
  channels: RankableChannel[] = [channel],
  relationships: AvailableChannelRelationship[] = [],
  usageModels: string[] = [],
): number | undefined {
  void usageModels;
  const matchedGroups = groups.filter((group) => {
    const result = matchGroupToChannel(channels, group.name, relationships);
    return result.status === 'matched' && result.channel === channel;
  });
  return matchedGroups.length === 1 ? matchedGroups[0]?.rate : undefined;
}

export type ChannelRatePresentation =
  | { state: 'loading'; label: '读取倍率中'; title: string }
  | { state: 'unset'; label: '未设置倍率'; title: string }
  | { state: 'unavailable'; label: '倍率不可用'; title: string }
  | {
      state: 'ready';
      label: string;
      title: string;
      rawRate: number;
      effectiveRate: number;
    };

export function channelRatePresentation<T extends RankableChannel>(
  channel: T,
  groups: Array<{ id?: string; name: string; rate?: number }> | undefined,
  ratio: number | undefined,
  channels: T[],
  relationships: AvailableChannelRelationship[] = [],
): ChannelRatePresentation {
  if (groups === undefined)
    return { state: 'loading', label: '读取倍率中', title: '正在读取当前站点倍率' };
  if (ratio === undefined)
    return { state: 'unset', label: '未设置倍率', title: '请在全部站点设置充值比例' };
  if (!Number.isFinite(ratio) || ratio <= 0)
    return { state: 'unavailable', label: '倍率不可用', title: '当前站点充值比例无效' };

  const mappings = groups.flatMap((group) => {
    const result = matchGroupToChannel(channels, group.name, relationships);
    if (result.status === 'ambiguous' && result.candidates.includes(channel))
      return [{ group, ambiguous: true }];
    if (result.status === 'matched' && result.channel === channel)
      return [{ group, ambiguous: false }];
    return [];
  });
  if (mappings.some((mapping) => mapping.ambiguous))
    return { state: 'unavailable', label: '倍率不可用', title: '渠道与分组关系存在歧义' };
  if (mappings.length !== 1)
    return {
      state: 'unavailable',
      label: '倍率不可用',
      title: mappings.length ? '渠道对应多个分组' : '未找到渠道对应的唯一分组',
    };
  const rawRate = mappings[0]?.group.rate;
  if (rawRate === undefined || !Number.isFinite(rawRate) || rawRate <= 0)
    return { state: 'unavailable', label: '倍率不可用', title: '分组倍率缺失或无效' };
  const effectiveRate = rawRate / ratio;
  const rawLabel = formatRateLabel(rawRate)!;
  const effectiveLabel = formatRateLabel(effectiveRate)!;
  return {
    state: 'ready',
    label: `折算 ${effectiveLabel}`,
    title: `原始倍率 ${rawLabel} · 充值比例 1:${ratio} · 折算结果 ${effectiveLabel}`,
    rawRate,
    effectiveRate,
  };
}

export function usageModelsForGroup(value: unknown, groupName?: string): string[] {
  if (!value || typeof value !== 'object' || !('items' in value)) return [];
  const items = (value as { items?: unknown }).items;
  const group = normalized(groupName);
  if (!group || !Array.isArray(items)) return [];
  const models = items.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as { groupName?: unknown; model?: unknown };
    if (normalized(String(record.groupName ?? '')) !== group) return [];
    const model = String(record.model ?? '').trim();
    return model ? [model] : [];
  });
  return [...new Set(models)];
}

export function latestChannelCheckedAt(value: unknown): number | undefined {
  if (!value || typeof value !== 'object' || !('channels' in value)) return undefined;
  const channels = (value as { channels?: unknown }).channels;
  if (!Array.isArray(channels)) return undefined;
  const timestamps = channels.flatMap((channel) => {
    if (!channel || typeof channel !== 'object' || !('timeline' in channel)) return [];
    const timeline = (channel as { timeline?: unknown }).timeline;
    if (!Array.isArray(timeline)) return [];
    return timeline.flatMap((point) => {
      if (!point || typeof point !== 'object' || !('checkedAt' in point)) return [];
      const parsed = Date.parse(String((point as { checkedAt?: unknown }).checkedAt ?? ''));
      return Number.isNaN(parsed) ? [] : [parsed];
    });
  });
  return timestamps.length ? Math.max(...timestamps) : undefined;
}

export function channelSyncPresentation(
  state: string | undefined,
  value: unknown,
): {
  kind: 'success' | 'loading' | 'failed' | 'stale' | 'partial' | 'unsupported' | 'idle';
  checkedAt?: number;
} {
  const checkedAt = latestChannelCheckedAt(value);
  if (state === 'error' || state === 'auth-required') return { kind: 'failed', checkedAt };
  if (state === 'loading' || state === 'refreshing') return { kind: 'loading', checkedAt };
  if (state === 'stale') return { kind: 'stale', checkedAt };
  if (state === 'partial') return { kind: 'partial', checkedAt };
  if (
    state === 'unsupported' ||
    (value && typeof value === 'object' && 'state' in value && value.state === 'unsupported')
  )
    return { kind: 'unsupported', checkedAt };
  if (value && typeof value === 'object' && 'state' in value && value.state === 'supported')
    return { kind: 'success', checkedAt };
  return { kind: 'idle', checkedAt };
}

export function latestTimelinePoint<T extends { checkedAt?: string }>(
  timeline: T[],
): T | undefined {
  return timeline.reduce<T | undefined>((latest, point) => {
    const pointTime = Date.parse(point.checkedAt ?? '');
    if (Number.isNaN(pointTime)) return latest;
    const latestTime = Date.parse(latest?.checkedAt ?? '');
    return !latest || Number.isNaN(latestTime) || pointTime > latestTime ? point : latest;
  }, undefined);
}

export function isChannelDataStale(value: unknown, now = Date.now()): boolean {
  const checkedAt = latestChannelCheckedAt(value);
  return checkedAt !== undefined && now - checkedAt > 120_000;
}

export function currentKeyGroupName(
  keys: Array<{ id: string; maskedLabel: string; groupId?: string; groupName?: string }>,
  groups: Array<{ id: string; name: string }>,
  preference: { mode: 'auto' | 'manual'; keyId?: string } | undefined,
  defaultKeyLabel?: string,
): string | undefined {
  const key = resolveCurrentKey(keys, preference, defaultKeyLabel);
  return key?.groupName ?? groups.find((group) => group.id === key?.groupId)?.name;
}

export function resolveCurrentKey<T extends { id: string; maskedLabel: string }>(
  keys: T[],
  preference: { mode: 'auto' | 'manual'; keyId?: string } | undefined,
  defaultKeyLabel?: string,
): T | undefined {
  if (preference?.mode === 'manual') return keys.find((item) => item.id === preference.keyId);
  return defaultKeyLabel ? keys.find((item) => item.maskedLabel === defaultKeyLabel) : undefined;
}
