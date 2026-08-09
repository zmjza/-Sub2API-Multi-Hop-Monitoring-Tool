import { describe, expect, it } from 'vitest';
import {
  channelSyncPresentation,
  channelTimelineForDisplay,
  currentKeyGroup,
  currentKeyGroupName,
  detailForDisplayedChannel,
  isChannelDataStale,
  latestChannelCheckedAt,
  latestTimelinePoint,
  matchGroupToChannel,
  matchGroupToChannels,
  normalizeChannelIdentity,
  resolveOverviewChannelMatch,
  resolveChannelPresentation,
  resolveFinalChannelAssociation,
  resolveKeyGroupChannel,
  rankChannels,
  selectDisplayedChannel,
  usageModelsForGroup,
  toggleChannelAssociation,
  summarizeLatestChannelChecks,
  summarizeRecentChannelHealth,
} from './channel-ranking';

describe('summarizeLatestChannelChecks', () => {
  it('sorts real checks, keeps twenty for display and the latest twelve for percentage', () => {
    const timeline = Array.from({ length: 22 }, (_, index) => ({
      status: index === 0 || index === 13 ? 'failed' : 'normal',
      checkedAt: new Date(Date.parse('2026-08-07T12:00:00.000Z') + index * 1_000).toISOString(),
    })).reverse();

    const summary = summarizeLatestChannelChecks(timeline);

    expect(summary.points).toHaveLength(20);
    expect(summary.points[0]?.checkedAt).toBe(Date.parse('2026-08-07T12:00:02.000Z'));
    expect(summary.points.at(-1)).toEqual({
      status: 'normal',
      checkedAt: Date.parse('2026-08-07T12:00:21.000Z'),
    });
    expect(summary.availabilityPercent).toBeCloseTo((11 / 12) * 100);
  });

  it('ignores invalid timestamps without fabricating checks', () => {
    expect(
      summarizeLatestChannelChecks([
        { status: 'failed', checkedAt: 'invalid' },
        { status: 'normal' },
        { status: 'degraded', checkedAt: '2026-08-07T12:00:00.000Z' },
      ]),
    ).toEqual({
      availabilityPercent: 100,
      points: [{ status: 'degraded', checkedAt: Date.parse('2026-08-07T12:00:00.000Z') }],
    });
  });

  it.each(['failed', 'error', 'down', 'unavailable'])(
    'normalizes %s as an explicit failure while preserving the other status colors',
    (status) => {
      const summary = summarizeLatestChannelChecks([
        { status, checkedAt: '2026-08-07T12:00:00.000Z' },
        { status: 'normal', checkedAt: '2026-08-07T12:00:01.000Z' },
        { status: 'degraded', checkedAt: '2026-08-07T12:00:02.000Z' },
        { status: 'unknown', checkedAt: '2026-08-07T12:00:03.000Z' },
      ]);

      expect(summary.points.map((point) => point.status)).toEqual([
        'failed',
        'normal',
        'degraded',
        'unknown',
      ]);
      expect(summary.availabilityPercent).toBe(75);
    },
  );

  it('returns an undefined percentage for zero real records', () => {
    expect(summarizeLatestChannelChecks([])).toEqual({
      availabilityPercent: undefined,
      points: [],
    });
  });
});

describe('channelTimelineForDisplay', () => {
  it('filters invalid and future points, sorts ascending and keeps the latest segment', () => {
    const now = Date.parse('2026-07-20T10:00:00Z');
    const points = [
      { status: 'normal' as const, checkedAt: 'bad' },
      { status: 'normal' as const, checkedAt: '2026-07-20T10:01:00Z' },
      { status: 'failed' as const, checkedAt: '2026-07-20T09:58:00Z' },
      { status: 'normal' as const, checkedAt: '2026-07-20T09:59:00Z' },
    ];
    expect(channelTimelineForDisplay(points, now, 3)).toEqual([points[2], points[3]]);
  });
});

describe('summarizeRecentChannelHealth', () => {
  const now = Date.parse('2026-08-07T12:00:00.000Z');

  it('includes the exact one-minute boundary and ignores invalid or older timestamps', () => {
    expect(
      summarizeRecentChannelHealth(
        [
          { status: 'normal', checkedAt: '2026-08-07T11:59:00.000Z' },
          { status: 'failed', checkedAt: '2026-08-07T11:58:59.999Z' },
          { status: 'failed', checkedAt: 'not-a-date' },
        ],
        now,
      ),
    ).toEqual({
      availabilityPercent: 100,
      points: [{ status: 'normal', checkedAt: now - 60_000 }],
    });
  });

  it('ignores future timestamps outside the current one-minute window', () => {
    expect(
      summarizeRecentChannelHealth(
        [
          { status: 'failed', checkedAt: '2026-08-07T12:00:00.001Z' },
          { status: 'normal', checkedAt: '2026-08-07T11:59:30.000Z' },
        ],
        now,
      ),
    ).toEqual({
      availabilityPercent: 100,
      points: [{ status: 'normal', checkedAt: now - 30_000 }],
    });
  });

  it.each(['failed', 'error', 'down', 'unavailable'])(
    'treats %s as an explicit failure',
    (status) => {
      const summary = summarizeRecentChannelHealth(
        [
          { status, checkedAt: '2026-08-07T11:59:30.000Z' },
          { status: 'degraded', checkedAt: '2026-08-07T11:59:40.000Z' },
          { status: 'unknown', checkedAt: '2026-08-07T11:59:50.000Z' },
          { status: '', checkedAt: '2026-08-07T12:00:00.000Z' },
        ],
        now,
      );

      expect(summary.availabilityPercent).toBeCloseTo(75);
      expect(summary.points.map((point) => point.status)).toEqual([
        'failed',
        'degraded',
        'unknown',
        'unknown',
      ]);
    },
  );

  it('returns no percentage or fabricated segments when there are no valid points', () => {
    expect(summarizeRecentChannelHealth([], now)).toEqual({
      availabilityPercent: undefined,
      points: [],
    });
  });

  it('sorts valid points and keeps only the latest twelve compact segments', () => {
    const timeline = Array.from({ length: 16 }, (_, index) => ({
      status: index === 15 ? 'failed' : 'normal',
      checkedAt: new Date(now - index * 1_000).toISOString(),
    })).reverse();

    const summary = summarizeRecentChannelHealth(timeline, now, 12);

    expect(summary.points).toHaveLength(12);
    expect(summary.points[0]?.checkedAt).toBe(now - 11_000);
    expect(summary.points.at(-1)).toEqual({ status: 'normal', checkedAt: now });
    expect(summary.availabilityPercent).toBeCloseTo(93.75);
  });
});

describe('resolveChannelPresentation', () => {
  const relationships = [
    {
      name: '自动渠道 A',
      platforms: [{ platform: 'openai', groupIds: ['group-1'], groupNames: [], modelNames: [] }],
    },
    {
      name: '自动渠道 B',
      platforms: [{ platform: 'openai', groupIds: ['group-1'], groupNames: [], modelNames: [] }],
    },
  ];
  const channels = [
    { id: 'a', name: '自动渠道 A', status: 'degraded' as const },
    { id: 'b', name: '自动渠道 B', status: 'normal' as const },
    { id: 'manual', name: '手动渠道', status: 'failed' as const },
  ];

  it('returns the same primary result for complete automatic associations', () => {
    const presentation = resolveChannelPresentation(
      channels,
      '当前分组',
      relationships,
      'group-1',
      [],
      'complete',
    );
    expect(presentation.association).toMatchObject({ status: 'matched', source: 'auto' });
    expect(presentation.primary?.id).toBe('a');
  });

  it('keeps the same primary channel when the API reverses a manual multi-select list', () => {
    expect(
      resolveChannelPresentation(channels, '当前分组', [], 'group-1', ['manual', 'b'], 'partial')
        .primary?.id,
    ).toBe('b');
    expect(
      resolveChannelPresentation(
        [...channels].reverse(),
        '当前分组',
        [],
        'group-1',
        ['manual', 'b'],
        'partial',
      ).primary?.id,
    ).toBe('b');
  });

  it('keeps the same primary channel when the API reverses an automatic association list', () => {
    expect(
      resolveChannelPresentation(channels, '当前分组', relationships, 'group-1', [], 'complete')
        .primary?.id,
    ).toBe('a');
    expect(
      resolveChannelPresentation(
        [...channels].reverse(),
        '当前分组',
        [...relationships].reverse(),
        'group-1',
        [],
        'complete',
      ).primary?.id,
    ).toBe('a');
  });

  it('handles one channel and no association without inventing a primary', () => {
    expect(
      resolveChannelPresentation(
        [channels[0]!],
        '当前分组',
        [relationships[0]!],
        'group-1',
        [],
        'complete',
      ).primary?.id,
    ).toBe('a');
    expect(resolveChannelPresentation(channels, '当前分组', [], 'group-1').primary).toBeUndefined();
  });
});

describe('toggleChannelAssociation', () => {
  it('toggles one channel while preserving other manual associations', () => {
    expect(toggleChannelAssociation(['a', 'b'], 'b')).toEqual(['a']);
    expect(toggleChannelAssociation(['a'], 'b')).toEqual(['a', 'b']);
  });
});

const channels = [
  { id: 'a', name: 'ClaudeCode-Kiro【高并发】', groupName: 'Claude', availability7d: 99 },
  {
    id: 'b',
    name: 'ChatGPT-Plus【高并发-特惠通道】',
    groupName: 'ChatGPT-Plus【高并发-特惠通道】',
    availability7d: 95,
  },
  { id: 'c', name: 'ChatGPT-Pro20', groupName: 'Pro', availability7d: 97 },
];

describe('rankChannels', () => {
  it('returns every monitor attached to the same group id', () => {
    const relationships = [
      {
        name: 'codex-plus',
        platforms: [{ platform: 'openai', groupIds: ['120'], groupNames: [], modelNames: [] }],
      },
      {
        name: 'codex-pro',
        platforms: [{ platform: 'openai', groupIds: ['120'], groupNames: [], modelNames: [] }],
      },
    ];
    expect(
      matchGroupToChannels(
        [
          { id: 'plus', name: 'codex-plus' },
          { id: 'pro', name: 'codex-pro' },
          { id: 'other', name: 'codex-other' },
        ],
        'unrelated display name',
        relationships,
        '120',
      ),
    ).toEqual({
      status: 'matched',
      channels: [
        { id: 'plus', name: 'codex-plus' },
        { id: 'pro', name: 'codex-pro' },
      ],
      basis: 'group-id',
    });
  });

  it('does not guess by name when a group id has no available relationship', () => {
    expect(
      matchGroupToChannels([{ id: 'same', name: 'codex-plus' }], 'codex-plus', [], '120'),
    ).toEqual({
      status: 'unmatched',
      basis: 'none',
    });
  });

  it('keeps manual channels when automatic relationships are partial', () => {
    const result = resolveFinalChannelAssociation(
      [
        { id: 'auto', name: 'codex-pro' },
        { id: 'manual', name: '0.045' },
      ],
      'codex-plus',
      [
        {
          name: 'codex-pro',
          platforms: [{ platform: 'openai', groupIds: ['120'], groupNames: [], modelNames: [] }],
        },
      ],
      '120',
      ['manual'],
      'partial',
    );
    expect(result).toMatchObject({
      status: 'matched',
      source: 'manual',
      channels: [{ id: 'manual' }],
    });
  });

  it('lets a complete automatic relationship take over a stale manual mapping', () => {
    const result = resolveFinalChannelAssociation(
      [
        { id: 'auto', name: 'codex-pro' },
        { id: 'manual', name: '旧渠道' },
      ],
      'codex-plus',
      [
        {
          name: 'codex-pro',
          platforms: [{ platform: 'openai', groupIds: ['120'], groupNames: [], modelNames: [] }],
        },
      ],
      '120',
      ['manual'],
      'complete',
    );
    expect(result).toMatchObject({ status: 'matched', source: 'auto', channels: [{ id: 'auto' }] });
  });
  it('normalizes monitor identities without weakening full-name equality', () => {
    expect(normalizeChannelIdentity('  ChatGPT.Plus【高并发_特惠-通道】 ')).toBe(
      normalizeChannelIdentity('chatgpt plus（高并发特惠通道）'),
    );
  });

  it('returns a discriminated strict match result', () => {
    expect(
      matchGroupToChannel(
        [
          { id: 'exact', name: 'ChatGPT Plus【高并发-特惠通道】' },
          { id: 'contains', name: 'ChatGPT Plus【高并发-特惠通道】备用' },
        ],
        'chatgpt.plus（高并发 特惠通道）',
      ),
    ).toMatchObject({ status: 'matched', channel: { id: 'exact' }, basis: 'name' });
    expect(matchGroupToChannel([{ id: 'contains', name: '高速目标分组备用' }], '目标分组')).toEqual(
      { status: 'unmatched', basis: 'none' },
    );
  });

  it('reports duplicate exact and structural matches as ambiguous', () => {
    expect(
      matchGroupToChannel(
        [
          { id: 'one', name: '共享分组' },
          { id: 'two', name: '共享 分组' },
        ],
        '共享分组',
      ),
    ).toMatchObject({ status: 'ambiguous', candidates: [{ id: 'one' }, { id: 'two' }] });

    const relationships = [
      {
        name: 'codex',
        platforms: [{ platform: 'openai', groupNames: ['新站分组'], modelNames: ['gpt-5.4'] }],
      },
    ];
    expect(
      matchGroupToChannel(
        [
          { id: 'one', name: 'one', platform: 'openai', primaryModel: 'gpt-5.4' },
          { id: 'two', name: 'two', platform: 'openai', primaryModel: 'gpt-5.4' },
        ],
        '新站分组',
        relationships,
      ),
    ).toMatchObject({ status: 'ambiguous' });
  });

  it('uses a unique available-channel relationship only after name matching fails', () => {
    expect(
      matchGroupToChannel(
        [
          { id: 'codex', name: 'codex', platform: 'openai', primaryModel: 'gpt-5.4' },
          { id: 'claude', name: 'claude', platform: 'anthropic', primaryModel: 'claude-opus-4' },
        ],
        '新站专属组',
        [
          {
            name: 'codex',
            platforms: [
              { platform: 'openai', groupNames: ['新站专属组'], modelNames: ['gpt-5.4'] },
            ],
          },
        ],
      ),
    ).toMatchObject({ status: 'matched', channel: { id: 'codex' }, basis: 'relationship' });
  });

  it('uses the key group id relationship before a misleading exact monitor name', () => {
    const result = matchGroupToChannel(
      [
        { id: 'legacy', name: '同名分组', platform: 'anthropic', primaryModel: 'claude-opus-4' },
        { id: 'linked', name: 'codex', platform: 'openai', primaryModel: 'gpt-5.4' },
      ],
      '同名分组',
      [
        {
          name: 'codex',
          platforms: [
            {
              platform: 'openai',
              groupIds: ['group-42'],
              groupNames: ['另一个显示名'],
              modelNames: ['gpt-5.4'],
            },
          ],
        },
      ],
      'group-42',
    );

    expect(result).toMatchObject({
      status: 'matched',
      channel: { id: 'linked' },
      basis: 'group-id',
    });
  });

  it('reports group-id relationship ambiguity instead of selecting the first monitor', () => {
    const result = matchGroupToChannel(
      [
        { id: 'one', name: 'one', platform: 'openai', primaryModel: 'gpt-5.4' },
        { id: 'two', name: 'two', platform: 'openai', primaryModel: 'gpt-5.4' },
      ],
      '新站分组',
      [
        {
          name: 'codex',
          platforms: [
            {
              platform: 'openai',
              groupIds: ['group-42'],
              groupNames: ['新站分组'],
              modelNames: ['gpt-5.4'],
            },
          ],
        },
      ],
      'group-42',
    );

    expect(result).toMatchObject({ status: 'ambiguous', basis: 'group-id' });
  });

  it('resolves overview ambiguity only inside the structured candidate set by closest name', () => {
    const outsider = {
      id: 'outside',
      name: 'Codex 高速专线',
      platform: 'openai',
      primaryModel: 'gpt-5.4',
      status: 'normal' as const,
      availability7d: 100,
    };
    const candidates = [
      {
        id: 'near',
        name: 'Codex 高速专线 A',
        platform: 'openai',
        primaryModel: 'gpt-5.4',
        status: 'normal' as const,
        availability7d: 98,
      },
      {
        id: 'far',
        name: 'Codex 普通备用池',
        platform: 'openai',
        primaryModel: 'gpt-5.4',
        status: 'normal' as const,
        availability7d: 99,
      },
    ];
    const result = resolveOverviewChannelMatch(
      { status: 'ambiguous', candidates, basis: 'group-id' },
      'Codex 高速专线',
      [],
      '42',
    );

    expect(result).toMatchObject({ status: 'matched', channel: { id: 'near' } });
    expect(result.status === 'matched' && result.channel).not.toBe(outsider);
  });

  it('uses relationship platform and models after equal names', () => {
    const candidates = [
      {
        id: 'claude',
        name: '共享池',
        platform: 'anthropic',
        primaryModel: 'claude-opus-4',
        status: 'normal' as const,
      },
      {
        id: 'openai',
        name: '共享池',
        platform: 'openai',
        primaryModel: 'gpt-5.4',
        status: 'degraded' as const,
      },
    ];
    const result = resolveOverviewChannelMatch(
      { status: 'ambiguous', candidates, basis: 'group-id' },
      '共享分组',
      [
        {
          name: '共享池',
          platforms: [
            {
              platform: 'openai',
              groupIds: ['42'],
              groupNames: ['共享分组'],
              modelNames: ['gpt-5.4'],
            },
          ],
        },
      ],
      '42',
    );

    expect(result).toMatchObject({ status: 'matched', channel: { id: 'openai' } });
  });

  it('uses health, freshness, availability, and stable id as deterministic late tie-breakers', () => {
    const candidates = [
      {
        id: 'z-stale',
        name: '共享池',
        platform: 'openai',
        primaryModel: 'gpt-5.4',
        status: 'normal' as const,
        availability7d: 99.9,
        timeline: [{ status: 'normal' as const, checkedAt: '2026-07-20T00:00:00Z' }],
      },
      {
        id: 'b-fresh',
        name: '共享池',
        platform: 'openai',
        primaryModel: 'gpt-5.4',
        status: 'normal' as const,
        availability7d: 99.5,
        timeline: [{ status: 'normal' as const, checkedAt: '2026-07-21T00:00:00Z' }],
      },
      {
        id: 'a-degraded',
        name: '共享池',
        platform: 'openai',
        primaryModel: 'gpt-5.4',
        status: 'degraded' as const,
        availability7d: 100,
        timeline: [{ status: 'normal' as const, checkedAt: '2026-07-22T00:00:00Z' }],
      },
    ];
    const resolve = (items: typeof candidates) =>
      resolveOverviewChannelMatch(
        { status: 'ambiguous', candidates: items, basis: 'relationship' },
        '共享分组',
        [],
      );

    expect(resolve(candidates)).toMatchObject({ status: 'matched', channel: { id: 'b-fresh' } });
    expect(resolve([...candidates].reverse())).toMatchObject({
      status: 'matched',
      channel: { id: 'b-fresh' },
    });

    const stableIdTie = candidates.slice(0, 2).map((candidate) => ({
      ...candidate,
      availability7d: 99,
      timeline: [{ status: 'normal' as const, checkedAt: '2026-07-21T00:00:00Z' }],
    }));
    expect(resolve(stableIdTie)).toMatchObject({
      status: 'matched',
      channel: { id: 'b-fresh' },
    });
  });

  it('does not invent an automatic current key when the default label is absent', () => {
    expect(
      currentKeyGroupName(
        [{ id: 'first', maskedLabel: '第一把 Key', groupId: 'group-1' }],
        [{ id: 'group-1', name: '第一分组' }],
        { mode: 'auto' },
      ),
    ).toBeUndefined();
  });

  it('reports app synchronization success even when the relay reports a failed channel', () => {
    const payload = {
      state: 'supported',
      channels: [
        {
          status: 'failed',
          timeline: [{ checkedAt: '2026-07-15T01:38:00Z', status: 'failed' }],
        },
      ],
    };

    expect(channelSyncPresentation('success', payload)).toEqual({
      kind: 'success',
      checkedAt: Date.parse('2026-07-15T01:38:00Z'),
    });
  });

  it('does not classify an old relay monitor record as synchronization delay', () => {
    const payload = {
      state: 'supported',
      channels: [{ timeline: [{ checkedAt: '2026-07-15T01:30:00Z' }] }],
    };

    expect(channelSyncPresentation('refreshing', payload).kind).toBe('loading');
    expect(channelSyncPresentation('error', payload).kind).toBe('failed');
    expect(channelSyncPresentation('success', payload).kind).toBe('success');
  });

  it('puts channels matching the current key group first', () => {
    expect(
      rankChannels(channels, 'ChatGPT-Plus【高并发-特惠通道】').map((item) => item.id),
    ).toEqual(['b', 'a', 'c']);
  });

  it('sorts unmatched channels by seven-day availability', () => {
    expect(rankChannels(channels, undefined).map((item) => item.id)).toEqual(['a', 'c', 'b']);
  });

  it('displays the key-matched channel instead of a previously selected channel', () => {
    expect(selectDisplayedChannel(channels, 'a', 'ChatGPT-Plus【高并发-特惠通道】')?.id).toBe('b');
  });

  it('ignores stale detail data from a different channel', () => {
    expect(
      detailForDisplayedChannel(
        { name: 'ClaudeCode-Max20', status: 'normal' },
        { name: 'ChatGPT-Plus【高并发-特惠通道】' },
      ),
    ).toBeUndefined();
  });

  it('does not treat a group embedded in a longer monitor name as an exact match', () => {
    expect(resolveKeyGroupChannel(channels, '高并发-特惠通道')).toBeUndefined();
  });

  it('resolves exact monitor names used by compatible stations', () => {
    expect(resolveKeyGroupChannel([{ id: 'team', name: 'team' }], 'team')?.id).toBe('team');
    expect(
      resolveKeyGroupChannel(
        [{ id: 'maok', name: 'ChatGPT-Plus【高并发-特惠通道】' }],
        'ChatGPT-Plus【高并发-特惠通道】',
      )?.id,
    ).toBe('maok');
  });

  it('does not use semantic word removal without structured relationship evidence', () => {
    const stationChannels = [
      { id: 'sale', name: '特价分组监控' },
      { id: 'plus', name: 'plus池监控' },
      { id: 'domestic', name: '国模' },
    ];

    expect(resolveKeyGroupChannel(stationChannels, '限时特价')).toBeUndefined();
    expect(selectDisplayedChannel(stationChannels, 'domestic', '限时特价')?.id).toBe('domestic');
  });

  it('does not guess when semantic evidence matches multiple monitors', () => {
    expect(
      resolveKeyGroupChannel(
        [
          { id: 'a', name: '特价A分组监控' },
          { id: 'b', name: '特价B分组监控' },
        ],
        '限时特价',
      ),
    ).toBeUndefined();
  });

  it('uses available-channel membership to resolve a new compatible station', () => {
    const stationChannels = [
      { id: 'codex', name: 'codex', platform: 'openai', primaryModel: 'gpt-5.4' },
      { id: 'claude', name: 'claude', platform: 'anthropic', primaryModel: 'claude-opus-4' },
    ];
    const relationships = [
      {
        name: 'codex',
        platforms: [
          {
            platform: 'openai',
            groupNames: ['新站专属组'],
            modelNames: ['gpt-5.4'],
          },
        ],
      },
    ];

    expect(resolveKeyGroupChannel(stationChannels, '新站专属组', relationships)?.id).toBe('codex');
  });

  it('does not use usage records to guess between structurally ambiguous monitors', () => {
    const stationChannels = [
      { id: 'fast', name: 'codex-fast', platform: 'openai', primaryModel: 'gpt-5.4' },
      { id: 'mini', name: 'codex-mini', platform: 'openai', primaryModel: 'gpt-5-mini' },
    ];
    const relationships = [
      {
        name: 'codex',
        platforms: [
          {
            platform: 'openai',
            groupNames: ['新站专属组'],
            modelNames: ['gpt-5.4', 'gpt-5-mini'],
          },
        ],
      },
    ];
    const usage = {
      items: [
        { groupName: '其他组', model: 'gpt-5-mini' },
        { groupName: '新站专属组', model: 'gpt-5.4' },
      ],
    };
    const usageModels = usageModelsForGroup(usage, '新站专属组');

    expect(usageModels).toEqual(['gpt-5.4']);
    expect(
      resolveKeyGroupChannel(stationChannels, '新站专属组', relationships, usageModels),
    ).toBeUndefined();
  });

  it('resolves the automatic current key to its group name', () => {
    expect(
      currentKeyGroupName(
        [{ id: 'key-1', maskedLabel: 'sk-...0baf', groupId: 'group-1' }],
        [{ id: 'group-1', name: 'ChatGPT-Plus【高并发-特惠通道】' }],
        { mode: 'auto' },
        'sk-...0baf',
      ),
    ).toBe('ChatGPT-Plus【高并发-特惠通道】');
  });

  it('keeps the current key group id together with its display name', () => {
    expect(
      currentKeyGroup(
        [{ id: 'key-1', maskedLabel: 'key-one', groupId: 'group-1' }],
        [{ id: 'group-1', name: '结构化分组' }],
        { mode: 'manual', keyId: 'key-1' },
      ),
    ).toEqual({ groupId: 'group-1', groupName: '结构化分组' });
  });

  it('uses the group name embedded in the current key when group filters are unavailable', () => {
    expect(
      currentKeyGroupName(
        [
          {
            id: 'key-1',
            maskedLabel: 'maok · ••••',
            groupId: 'group-1',
            groupName: 'ChatGPT-Plus【高并发-特惠通道】',
          },
        ],
        [],
        { mode: 'auto' },
        'maok · ••••',
      ),
    ).toBe('ChatGPT-Plus【高并发-特惠通道】');
  });

  it('uses channel monitor timestamps instead of the site balance refresh time', () => {
    const payload = {
      state: 'supported',
      channels: [
        { timeline: [{ checkedAt: '2026-07-14T12:00:00Z' }] },
        { timeline: [{ checkedAt: '2026-07-14T12:01:00Z' }] },
      ],
    };
    expect(latestChannelCheckedAt(payload)).toBe(Date.parse('2026-07-14T12:01:00Z'));
    expect(isChannelDataStale(payload, Date.parse('2026-07-14T12:04:00Z'))).toBe(true);
  });

  it('finds the latest timeline point regardless of upstream ordering', () => {
    const latest = latestTimelinePoint([
      { checkedAt: '2026-07-14T12:01:00Z', status: 'normal' },
      { checkedAt: '2026-07-14T12:00:00Z', status: 'failed' },
    ]);

    expect(latest?.status).toBe('normal');
  });
});
