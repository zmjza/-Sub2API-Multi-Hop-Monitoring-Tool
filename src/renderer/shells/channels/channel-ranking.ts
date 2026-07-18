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

function normalized(value?: string): string {
  return (value ?? '').replace(/[\s【】[\]（）()_-]/g, '').toLocaleLowerCase();
}

function semanticCore(value?: string): string {
  return normalized(value).replace(/限时|专用|分组|通道|池|监控/g, '');
}

export function matchesKeyGroup(channel: RankableChannel, groupName?: string): boolean {
  const group = normalized(groupName);
  if (!group) return false;
  const channelGroup = normalized(channel.groupName);
  const channelName = normalized(channel.name);
  return Boolean(channelGroup && channelGroup === group) || channelName.includes(group);
}

export function resolveKeyGroupChannel<T extends RankableChannel>(
  channels: T[],
  groupName?: string,
  relationships: AvailableChannelRelationship[] = [],
  usageModels: string[] = [],
): T | undefined {
  const group = normalized(groupName);
  if (!group) return undefined;

  const exact = channels.filter((channel) => {
    const channelGroup = normalized(channel.groupName);
    const channelName = normalized(channel.name);
    return channelGroup === group || channelName === group || channelName.includes(group);
  });
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;

  const groupCore = semanticCore(groupName);
  if (groupCore.length < 2) return undefined;
  const semantic = channels.filter((channel) => {
    const candidates = [semanticCore(channel.groupName), semanticCore(channel.name)].filter(
      (value) => value.length >= 2,
    );
    return candidates.some(
      (candidate) => candidate.includes(groupCore) || groupCore.includes(candidate),
    );
  });
  if (semantic.length === 1) return semantic[0];
  if (semantic.length > 1) return undefined;

  const relatedChannels = relationships.filter((relationship) =>
    relationship.platforms.some((section) =>
      section.groupNames.some((name) => normalized(name) === group),
    ),
  );
  const relatedCandidates = channels.filter((channel) =>
    relatedChannels.some((relationship) =>
      relationship.platforms.some((section) => {
        const relationshipName = normalized(relationship.name);
        const channelName = normalized(channel.name);
        const nameMatches =
          channelName === relationshipName ||
          channelName.includes(relationshipName) ||
          relationshipName.includes(channelName);
        const channelModels = [channel.primaryModel, ...(channel.extraModels ?? [])]
          .map((model) => normalized(model))
          .filter(Boolean);
        const modelMatches = section.modelNames.some((model) =>
          channelModels.includes(normalized(model)),
        );
        const platformMatches = normalized(channel.platform) === normalized(section.platform);
        return nameMatches || (platformMatches && modelMatches);
      }),
    ),
  );
  if (relatedCandidates.length === 1) return relatedCandidates[0];
  if (relatedCandidates.length > 1 && usageModels.length) {
    const normalizedUsageModels = new Set(usageModels.map((model) => normalized(model)));
    const usageCandidates = relatedCandidates.filter((channel) =>
      [channel.primaryModel, ...(channel.extraModels ?? [])].some((model) =>
        normalizedUsageModels.has(normalized(model)),
      ),
    );
    if (usageCandidates.length === 1) return usageCandidates[0];
  }
  return undefined;
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
  return rate === undefined ? undefined : `${Number(rate.toFixed(4))}x`;
}

export function groupRateForChannel(
  channel: RankableChannel,
  groups: Array<{ id?: string; name: string; rate?: number }>,
  channels: RankableChannel[] = [channel],
  relationships: AvailableChannelRelationship[] = [],
  usageModels: string[] = [],
): number | undefined {
  return groups.find(
    (group) => resolveKeyGroupChannel(channels, group.name, relationships, usageModels) === channel,
  )?.rate;
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
  const key =
    preference?.mode === 'manual'
      ? keys.find((item) => item.id === preference.keyId)
      : (keys.find((item) => item.maskedLabel === defaultKeyLabel) ?? keys[0]);
  return key?.groupName ?? groups.find((group) => group.id === key?.groupId)?.name;
}
