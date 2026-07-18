import { describe, expect, it } from 'vitest';
import {
  channelSyncPresentation,
  currentKeyGroupName,
  detailForDisplayedChannel,
  formatRateLabel,
  groupRateForChannel,
  isChannelDataStale,
  latestChannelCheckedAt,
  latestTimelinePoint,
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

  it('matches a group embedded in the channel name', () => {
    expect(rankChannels(channels, '高并发-特惠通道')[0]?.id).toBe('b');
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

  it('resolves a uniquely related monitor name without a station-specific map', () => {
    const stationChannels = [
      { id: 'sale', name: '特价分组监控' },
      { id: 'plus', name: 'plus池监控' },
      { id: 'domestic', name: '国模' },
    ];

    expect(resolveKeyGroupChannel(stationChannels, '限时特价')?.id).toBe('sale');
    expect(selectDisplayedChannel(stationChannels, 'domestic', '限时特价')?.id).toBe('sale');
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

  it('uses matching usage records to disambiguate monitors in one available channel', () => {
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
      resolveKeyGroupChannel(stationChannels, '新站专属组', relationships, usageModels)?.id,
    ).toBe('fast');
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

  it('formats the current key group multiplier without duplicating the suffix', () => {
    expect(formatRateLabel(0.2)).toBe('0.2x');
    expect(formatRateLabel(undefined)).toBeUndefined();
  });

  it('maps a live group multiplier to its matching channel', () => {
    expect(
      groupRateForChannel({ name: 'ChatGPT-Plus【高并发-特惠通道】', groupName: '' }, [
        { id: '25', name: 'ChatGPT-Plus【高并发-特惠通道】', rate: 0.2 },
      ]),
    ).toBe(0.2);
  });

  it('maps the active group multiplier only to its uniquely related monitor', () => {
    const stationChannels = [
      { id: 'sale', name: '特价分组监控' },
      { id: 'plus', name: 'plus池监控' },
    ];
    const groups = [{ id: 'sale-group', name: '限时特价', rate: 0.025 }];

    expect(groupRateForChannel(stationChannels[0], groups, stationChannels)).toBe(0.025);
    expect(groupRateForChannel(stationChannels[1], groups, stationChannels)).toBeUndefined();
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
