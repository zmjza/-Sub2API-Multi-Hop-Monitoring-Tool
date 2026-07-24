type RankableChannel = {
  name: string;
  groupName?: string;
  platform?: string;
  primaryModel?: string;
  extraModels?: string[];
  availability7d?: number;
  status?: 'normal' | 'degraded' | 'failed' | 'unknown';
  timeline?: Array<{ checkedAt?: string }>;
};

export type AvailableChannelRelationship = {
  name: string;
  platforms: Array<{
    platform: string;
    groupIds?: string[];
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
  | { status: 'matched'; channel: T; basis: 'group-id' | 'name' | 'relationship' }
  | { status: 'unmatched'; basis: 'none' }
  | {
      status: 'ambiguous';
      candidates: T[];
      basis: 'group-id' | 'name' | 'relationship';
    };

type RelatedSection = {
  relationshipName: string;
  section: AvailableChannelRelationship['platforms'][number];
};

function matchRelatedChannels<T extends RankableChannel>(
  channels: T[],
  sections: RelatedSection[],
): T[] {
  return channels.filter((channel) =>
    sections.some(({ relationshipName, section }) => {
      if (normalized(channel.name) === normalized(relationshipName)) return true;
      if (normalized(channel.groupName) === normalized(relationshipName)) return true;
      if (normalized(channel.platform) !== normalized(section.platform)) return false;
      const channelModels = [channel.primaryModel, ...(channel.extraModels ?? [])]
        .map((model) => normalized(model))
        .filter(Boolean);
      return section.modelNames.some((model) => channelModels.includes(normalized(model)));
    }),
  );
}

function relationshipResult<T extends RankableChannel>(
  channels: T[],
  sections: RelatedSection[],
  basis: 'group-id' | 'relationship',
): ChannelMatchResult<T> | undefined {
  if (!sections.length) return undefined;
  const candidates = matchRelatedChannels(channels, sections);
  if (candidates.length === 1) return { status: 'matched', channel: candidates[0]!, basis };
  if (candidates.length > 1) return { status: 'ambiguous', candidates, basis };
  return undefined;
}

export function matchGroupToChannel<T extends RankableChannel>(
  channels: T[],
  groupName?: string,
  relationships: AvailableChannelRelationship[] = [],
  groupId?: string,
): ChannelMatchResult<T> {
  const normalizedGroupId = normalized(groupId);
  if (normalizedGroupId) {
    const idSections = relationships.flatMap((relationship) =>
      relationship.platforms.flatMap((section) =>
        section.groupIds?.some((id) => normalized(id) === normalizedGroupId)
          ? [{ relationshipName: relationship.name, section }]
          : [],
      ),
    );
    const idResult = relationshipResult(channels, idSections, 'group-id');
    if (idResult) return idResult;
  }

  const group = normalized(groupName);
  if (!group) return { status: 'unmatched', basis: 'none' };

  const exact = channels.filter(
    (channel) => normalized(channel.name) === group || normalized(channel.groupName) === group,
  );
  if (exact.length === 1) return { status: 'matched', channel: exact[0]!, basis: 'name' };
  if (exact.length > 1) return { status: 'ambiguous', candidates: exact, basis: 'name' };

  const relatedSections = relationships.flatMap((relationship) =>
    relationship.platforms.flatMap((section) =>
      section.groupNames.some((name) => normalized(name) === group)
        ? [{ relationshipName: relationship.name, section }]
        : [],
    ),
  );
  return (
    relationshipResult(channels, relatedSections, 'relationship') ?? {
      status: 'unmatched',
      basis: 'none',
    }
  );
}

function textSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left))
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  const pairs = (value: string) =>
    value.length < 2
      ? [value]
      : Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2));
  const rightPairs = pairs(right);
  const remaining = new Map<string, number>();
  for (const pair of rightPairs) remaining.set(pair, (remaining.get(pair) ?? 0) + 1);
  let overlap = 0;
  for (const pair of pairs(left)) {
    const count = remaining.get(pair) ?? 0;
    if (count <= 0) continue;
    overlap += 1;
    remaining.set(pair, count - 1);
  }
  return (2 * overlap) / (pairs(left).length + rightPairs.length);
}

function relevantRelationshipSections(
  relationships: AvailableChannelRelationship[],
  groupName?: string,
  groupId?: string,
): RelatedSection[] {
  const normalizedGroup = normalized(groupName);
  const normalizedGroupId = normalized(groupId);
  return relationships.flatMap((relationship) =>
    relationship.platforms.flatMap((section) => {
      const matchesId =
        normalizedGroupId &&
        section.groupIds?.some((candidate) => normalized(candidate) === normalizedGroupId);
      const matchesName =
        normalizedGroup &&
        section.groupNames.some((candidate) => normalized(candidate) === normalizedGroup);
      return matchesId || matchesName ? [{ relationshipName: relationship.name, section }] : [];
    }),
  );
}

function latestTimelineTimestamp(channel: RankableChannel): number {
  return Math.max(
    -1,
    ...(channel.timeline ?? []).map((point) => {
      const parsed = Date.parse(point.checkedAt ?? '');
      return Number.isNaN(parsed) ? -1 : parsed;
    }),
  );
}

/** Resolves only strict-match ambiguity for the Overview card and its detail request. */
export function resolveOverviewChannelMatch<T extends RankableChannel & { id: string }>(
  result: ChannelMatchResult<T>,
  groupName?: string,
  relationships: AvailableChannelRelationship[] = [],
  groupId?: string,
): ChannelMatchResult<T> {
  if (result.status !== 'ambiguous') return result;
  const sections = relevantRelationshipSections(relationships, groupName, groupId);
  const targetNames = [groupName, ...sections.map((section) => section.relationshipName)]
    .map((name) => normalized(name))
    .filter(Boolean);
  const healthRank = { normal: 3, degraded: 2, unknown: 1, failed: 0 } as const;
  const ranked = [...result.candidates].sort((left, right) => {
    const score = (channel: T) => {
      const channelNames = [channel.name, channel.groupName]
        .map((name) => normalized(name))
        .filter(Boolean);
      const exactName = Number(
        channelNames.some((name) => targetNames.some((target) => name === target)),
      );
      const similarity = Math.max(
        0,
        ...channelNames.flatMap((name) =>
          targetNames.map((target) => textSimilarity(name, target)),
        ),
      );
      const relevantPlatform = Number(
        sections.some(
          ({ section }) => normalized(section.platform) === normalized(channel.platform),
        ),
      );
      const channelModels = [channel.primaryModel, ...(channel.extraModels ?? [])]
        .map((model) => normalized(model))
        .filter(Boolean);
      const modelOverlap = sections.reduce(
        (count, { section }) =>
          count +
          section.modelNames.filter((model) => channelModels.includes(normalized(model))).length,
        0,
      );
      return [
        exactName,
        similarity,
        relevantPlatform,
        modelOverlap,
        healthRank[channel.status ?? 'unknown'],
        latestTimelineTimestamp(channel),
        channel.availability7d ?? -1,
      ];
    };
    const leftScore = score(left);
    const rightScore = score(right);
    for (let index = 0; index < leftScore.length; index += 1) {
      const difference = rightScore[index]! - leftScore[index]!;
      if (difference) return difference;
    }
    return left.id.localeCompare(right.id);
  });
  return { status: 'matched', channel: ranked[0]!, basis: result.basis };
}

export function matchesKeyGroup(channel: RankableChannel, groupName?: string): boolean {
  return matchGroupToChannel([channel], groupName).status === 'matched';
}

export function resolveKeyGroupChannel<T extends RankableChannel>(
  channels: T[],
  groupName?: string,
  relationships: AvailableChannelRelationship[] = [],
  usageModels: string[] = [],
  groupId?: string,
): T | undefined {
  void usageModels;
  const result = matchGroupToChannel(channels, groupName, relationships, groupId);
  return result.status === 'matched' ? result.channel : undefined;
}

export function rankChannels<T extends RankableChannel>(
  channels: T[],
  groupName?: string,
  relationships: AvailableChannelRelationship[] = [],
  usageModels: string[] = [],
  groupId?: string,
): T[] {
  const preferred = resolveKeyGroupChannel(
    channels,
    groupName,
    relationships,
    usageModels,
    groupId,
  );
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
  groupId?: string,
): T | undefined {
  return (
    resolveKeyGroupChannel(channels, groupName, relationships, usageModels, groupId) ??
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
  return currentKeyGroup(keys, groups, preference, defaultKeyLabel)?.groupName;
}

export function currentKeyGroup(
  keys: Array<{ id: string; maskedLabel: string; groupId?: string; groupName?: string }>,
  groups: Array<{ id: string; name: string }>,
  preference: { mode: 'auto' | 'manual'; keyId?: string } | undefined,
  defaultKeyLabel?: string,
): { groupId?: string; groupName?: string } | undefined {
  const key = resolveCurrentKey(keys, preference, defaultKeyLabel);
  if (!key) return undefined;
  return {
    ...(key.groupId ? { groupId: key.groupId } : {}),
    ...(key.groupName || groups.find((group) => group.id === key.groupId)?.name
      ? { groupName: key.groupName ?? groups.find((group) => group.id === key.groupId)?.name }
      : {}),
  };
}

export function resolveCurrentKey<T extends { id: string; maskedLabel: string }>(
  keys: T[],
  preference: { mode: 'auto' | 'manual'; keyId?: string } | undefined,
  defaultKeyLabel?: string,
): T | undefined {
  if (preference?.mode === 'manual') return keys.find((item) => item.id === preference.keyId);
  return defaultKeyLabel ? keys.find((item) => item.maskedLabel === defaultKeyLabel) : undefined;
}
