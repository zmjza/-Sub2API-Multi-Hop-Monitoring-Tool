import { describe, expect, it } from 'vitest';
import {
  channelSyncPresentation,
  currentKeyGroup,
  currentKeyGroupName,
  detailForDisplayedChannel,
  isChannelDataStale,
  latestChannelCheckedAt,
  latestTimelinePoint,
  matchGroupToChannel,
  normalizeChannelIdentity,
  resolveKeyGroupChannel,
  rankChannels,
  selectDisplayedChannel,
  usageModelsForGroup,
} from './channel-ranking';

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
