import { describe, expect, it } from 'vitest';
import type { AvailableRateGroup } from '../../../../electron/shared/contracts';
import {
  channelEligibility,
  comparePlatformRates,
  channelStability,
  effectiveRate,
  filterRateGroups,
  findPlatformMinima,
  formatRateMultiplier,
  normalizePlatform,
  normalizedPriceScore,
  parseRechargeRatio,
  rateRefreshIntervalMs,
  resolveActualPlatform,
} from './rate-comparison';

const group = (
  id: string,
  platform: string,
  rate: number,
  overrides: Partial<AvailableRateGroup> = {},
): AvailableRateGroup => ({
  id,
  name: `分组 ${id}`,
  platform,
  status: 'active',
  rate,
  ...overrides,
});

const relationship = (groupId: string, channelName: string, platform = 'openai') => [
  {
    name: channelName,
    platforms: [{ platform, groupIds: [groupId], groupNames: [], modelNames: [] }],
  },
];

describe('rate comparison rules', () => {
  it('uses the last minute and only excludes explicit failure statuses', () => {
    const now = Date.parse('2026-07-20T10:00:00Z');
    const stable = {
      id: 'stable',
      name: '稳定分组',
      status: 'normal' as const,
      timeline: [
        { status: 'normal' as const, checkedAt: '2026-07-20T09:56:00Z' },
        { status: 'normal' as const, checkedAt: '2026-07-20T09:59:00Z' },
      ],
    };
    expect(channelEligibility(stable, now, 'supported')).toMatchObject({
      eligible: true,
      score: 10,
      label: '稳定',
    });
    expect(
      channelEligibility(
        {
          ...stable,
          timeline: [...stable.timeline, { status: 'degraded', checkedAt: '2026-07-20T09:59:30Z' }],
        },
        now,
        'supported',
      ),
    ).toMatchObject({ eligible: true, score: 10 });
    for (const status of ['unknown', '']) {
      expect(
        channelEligibility(
          {
            ...stable,
            status: status as 'unknown',
            timeline: [{ status: status as 'unknown', checkedAt: '2026-07-20T09:59:30Z' }],
          },
          now,
          'supported',
        ),
      ).toMatchObject({ eligible: true, score: 10 });
    }
    expect(
      channelEligibility(
        {
          ...stable,
          status: 'unknown',
          timeline: [],
        },
        now,
        'supported',
      ),
    ).toMatchObject({ eligible: true, score: 10 });
    expect(
      channelEligibility(
        { ...stable, timeline: [{ status: 'normal', checkedAt: '2026-07-20T09:58:59Z' }] },
        now,
        'supported',
      ),
    ).toMatchObject({ eligible: false, reason: 'no-recent-record' });
    expect(
      channelEligibility(
        { ...stable, timeline: [{ status: 'normal', checkedAt: '2026-07-20T10:00:01Z' }] },
        now,
        'supported',
      ),
    ).toMatchObject({ eligible: false, reason: 'future-record' });
    expect(channelEligibility(undefined, now, 'unsupported')).toMatchObject({
      eligible: false,
      reason: 'unsupported',
    });
    for (const status of ['failed', 'error', 'down', 'unavailable']) {
      expect(
        channelEligibility(
          {
            ...stable,
            status: status as 'failed',
            timeline: [{ status: status as 'failed', checkedAt: '2026-07-20T09:59:30Z' }],
          },
          now,
          'supported',
        ),
      ).toMatchObject({ eligible: false, reason: 'current-issue' });
    }
  });

  it('classifies a misleading OpenAI group as Grok from stronger evidence', () => {
    expect(
      resolveActualPlatform(group('grok-free', 'openai', 0.3, { name: 'Grok Free 高速组' })),
    ).toEqual({ key: 'grok', label: 'Grok' });
    expect(
      resolveActualPlatform(group('opaque', 'openai', 0.3, { name: '高速组' }), {
        id: 'monitor',
        name: '高速组',
        status: 'normal',
        primaryModel: 'claude-opus-4',
      }),
    ).toEqual({ key: 'claude', label: 'Claude' });
  });

  it('uses min-max price normalization only across eligible candidates', () => {
    expect(normalizedPriceScore(0.1, 0.1, 0.3)).toBe(10);
    expect(normalizedPriceScore(0.2, 0.1, 0.3)).toBeCloseTo(5, 12);
    expect(normalizedPriceScore(0.3, 0.1, 0.3)).toBe(0);
    expect(normalizedPriceScore(0.2, 0.2, 0.2)).toBe(10);
    const checkedAt = new Date().toISOString();
    const stableSite = (id: string, rate: number) => ({
      siteId: id,
      siteName: id,
      ratio: 1,
      groups: [group(id, 'openai', rate, { name: `${id} 分组` })],
      channels: [
        {
          id: `${id}-channel`,
          name: `${id} 分组`,
          status: 'normal' as const,
          availability7d: 99,
          timeline: [{ status: 'normal' as const, checkedAt }],
        },
      ],
      channelState: 'supported' as const,
      relationships: relationship(id, `${id} 分组`),
    });
    const result = comparePlatformRates([
      stableSite('cheap', 0.1),
      stableSite('middle', 0.2),
      stableSite('expensive', 0.3),
      {
        ...stableSite('failed-cheaper', 0.01),
        channels: [
          {
            id: 'failed',
            name: 'failed-cheaper 分组',
            status: 'failed' as const,
            timeline: [{ status: 'failed' as const, checkedAt }],
          },
        ],
      },
    ]);
    expect(result[0]?.sites.map((site) => [site.siteId, site.priceScore])).toEqual([['cheap', 10]]);
    expect(result[0]).toMatchObject({
      platformKey: 'openai',
      priceScore: 10,
      stabilityScore: 10,
      effectiveRate: 0.1,
    });
  });

  it('returns checking and empty platform states instead of unsafe fallback recommendations', () => {
    const pending = comparePlatformRates([
      { siteId: 'pending', siteName: '待核验', ratio: 1, groups: [group('p', 'openai', 0.2)] },
    ]);
    expect(pending[0]).toMatchObject({
      platformKey: 'openai',
      state: 'ready',
      stabilityLabel: '无渠道状态',
    });

    const unsupported = comparePlatformRates([
      {
        siteId: 'unsupported',
        siteName: '不支持',
        ratio: 1,
        groups: [group('u', 'openai', 0.2)],
        channelState: 'unsupported',
        channels: [],
      },
    ]);
    expect(unsupported[0]).toMatchObject({
      platformKey: 'openai',
      state: 'ready',
      stabilityLabel: '无渠道状态',
    });
  });

  it('uses persisted manual channels while automatic relationship data is partial', () => {
    const result = comparePlatformRates([
      {
        siteId: 'manual-site',
        siteName: '手动站点',
        ratio: 1,
        groups: [group('120', 'openai', 0.2, { name: 'codex-plus' })],
        channels: [
          {
            id: 'codex-pro',
            name: 'codex-pro',
            status: 'normal',
            timeline: [{ status: 'normal', checkedAt: new Date().toISOString() }],
          },
        ],
        relationships: [
          {
            name: 'codex-pro',
            platforms: [{ platform: 'openai', groupIds: ['120'], groupNames: [], modelNames: [] }],
          },
        ],
        relationshipsState: 'partial',
        channelState: 'supported',
        channelAssociations: [{ groupId: '120', channelIds: ['codex-pro'], source: 'manual' }],
      },
    ]);
    expect(result[0]?.sites[0]).toMatchObject({ channelId: 'codex-pro', stabilityLabel: '稳定' });
  });

  it('maps only the supported automatic refresh periods', () => {
    expect(rateRefreshIntervalMs(1)).toBe(60_000);
    expect(rateRefreshIntervalMs(3)).toBe(180_000);
    expect(rateRefreshIntervalMs(5)).toBe(300_000);
    expect(rateRefreshIntervalMs(10)).toBe(600_000);
    expect(rateRefreshIntervalMs(2)).toBe(300_000);
  });
  it('normalizes recharge value and formats without meaningless zeroes', () => {
    expect(effectiveRate(0.4, 10)).toBeCloseTo(0.04, 12);
    expect(effectiveRate(0, 8)).toBeUndefined();
    expect(effectiveRate(0.4, undefined)).toBeUndefined();
    expect(effectiveRate(0.4, 0)).toBeUndefined();
    expect(formatRateMultiplier(0.0150001)).toBe('0.015x');
    expect(formatRateMultiplier(0)).toBe('0x');
  });

  it('uses known platform aliases and preserves unknown platforms', () => {
    expect(normalizePlatform('openai')).toEqual({ key: 'openai', label: 'OpenAI' });
    expect(normalizePlatform('anthropic')).toEqual({ key: 'claude', label: 'Claude' });
    expect(normalizePlatform('google')).toEqual({ key: 'gemini', label: 'Gemini' });
    expect(normalizePlatform('antigravity')).toEqual({ key: 'gemini', label: 'Gemini' });
    expect(normalizePlatform('xai')).toEqual({ key: 'grok', label: 'Grok' });
    expect(normalizePlatform('Local-Lab')).toEqual({ key: 'local-lab', label: 'Local-Lab' });
  });

  it('uses Antigravity group and channel evidence as Gemini', () => {
    expect(
      resolveActualPlatform(
        group('group-name', 'openai', 0.4, {
          name: 'Antigravity 高速线路',
        }),
      ),
    ).toEqual({ key: 'gemini', label: 'Gemini' });
    expect(
      resolveActualPlatform(
        group('description', 'openai', 0.4, {
          name: '高速线路',
          description: 'Antigravity 专用',
        }),
      ),
    ).toEqual({ key: 'gemini', label: 'Gemini' });
    expect(
      resolveActualPlatform(group('primary-model', 'openai', 0.4, { name: '高速线路' }), {
        id: 'primary-model-channel',
        name: '高速线路',
        status: 'normal',
        primaryModel: 'antigravity-pro',
      }),
    ).toEqual({ key: 'gemini', label: 'Gemini' });
    expect(
      resolveActualPlatform(group('extra-model', 'openai', 0.4, { name: '高速线路' }), {
        id: 'extra-model-channel',
        name: '高速线路',
        status: 'normal',
        extraModels: ['gemini-2.5', 'antigravity'],
      }),
    ).toEqual({ key: 'gemini', label: 'Gemini' });
    expect(
      resolveActualPlatform(
        group('structured-relationship', 'openai', 0.4, {
          name: '结构化线路',
        }),
        undefined,
        [
          {
            name: 'relationship-channel',
            platforms: [{ platform: 'antigravity', groupNames: ['结构化线路'], modelNames: [] }],
          },
        ],
      ),
    ).toEqual({ key: 'gemini', label: 'Gemini' });
  });

  it('does not treat similar Antigravity substrings as Gemini evidence', () => {
    expect(
      resolveActualPlatform(
        group('similar-name', 'openai', 0.4, {
          name: 'AntigravityLabs 高速线路',
        }),
      ),
    ).toEqual({ key: 'openai', label: 'OpenAI' });
  });

  it('merges Gemini and Antigravity groups into one platform minimum', () => {
    expect(
      findPlatformMinima([
        group('gemini', 'gemini', 0.4, { name: '常规线路' }),
        group('antigravity', 'antigravity', 0.4, { name: '实验线路' }),
      ]),
    ).toEqual([
      expect.objectContaining({
        platformKey: 'gemini',
        platformLabel: 'Gemini',
        groups: [
          expect.objectContaining({ id: 'gemini' }),
          expect.objectContaining({ id: 'antigravity' }),
        ],
      }),
    ]);
  });

  it('parses only positive finite recharge ratios', () => {
    expect(parseRechargeRatio('10')).toBe(10);
    expect(parseRechargeRatio('2.5')).toBe(2.5);
    for (const value of ['', '0', '-1', 'abc', 'Infinity'])
      expect(parseRechargeRatio(value)).toBeUndefined();
  });

  it('filters groups by normalized platform and name or description', () => {
    const groups = [
      group('a', 'openai', 0.4, { name: '高速通道', description: '适合 Codex' }),
      group('b', 'anthropic', 0.8, { name: 'Claude Max', description: '稳定' }),
      group('c', 'Local-Lab', 0.2, { name: '实验通道' }),
    ];
    expect(filterRateGroups(groups, 'openai', 'codex').map((item) => item.id)).toEqual(['a']);
    expect(filterRateGroups(groups, 'claude', 'MAX').map((item) => item.id)).toEqual(['b']);
    expect(filterRateGroups(groups, 'local-lab', '').map((item) => item.id)).toEqual(['c']);
    expect(filterRateGroups(groups, 'all', '不存在')).toEqual([]);
  });

  it('uses matched channel model evidence in rate-popover filtering and minima', () => {
    const misleading = group('misleading', 'openai', 0.4, { name: '高速专线' });
    const channels = [
      {
        id: 'grok-channel',
        name: '高速专线',
        primaryModel: 'grok-4',
        status: 'normal' as const,
      },
    ];

    expect(filterRateGroups([misleading], 'grok', '', channels)).toEqual([misleading]);
    expect(filterRateGroups([misleading], 'openai', '', channels)).toEqual([]);
    expect(findPlatformMinima([misleading], 10, channels)[0]).toMatchObject({
      platformKey: 'grok',
      platformLabel: 'Grok',
    });
  });

  it('finds every tied minimum per platform and excludes unusable groups', () => {
    const minima = findPlatformMinima(
      [
        group('a', 'openai', 0.4),
        group('b', 'openai', 0.4),
        group('c', 'openai', 0.7),
        group('d', 'anthropic', 0.8),
        group('e', 'anthropic', 0.1, { status: 'disabled' }),
      ],
      10,
    );

    expect(minima).toHaveLength(2);
    expect(minima.find((item) => item.platformKey === 'openai')).toMatchObject({
      platformLabel: 'OpenAI',
      comparisonRate: 0.04,
      groups: [{ id: 'a' }, { id: 'b' }],
    });
    expect(minima.find((item) => item.platformKey === 'claude')).toMatchObject({
      comparisonRate: 0.08,
      groups: [{ id: 'd' }],
    });
  });

  it('uses raw rates for one-site display but excludes missing ratios cross-site', () => {
    expect(findPlatformMinima([group('raw', 'openai', 0.4)], undefined)[0]).toMatchObject({
      comparisonRate: 0.4,
      effectiveRate: undefined,
    });

    const result = comparePlatformRates([
      {
        siteId: 'unset',
        siteName: '未设置站点',
        groups: [group('raw', 'openai', 0.01)],
      },
      {
        siteId: 'maok',
        siteName: 'maok',
        ratio: 10,
        groups: [group('maok-cheap', 'openai', 0.4)],
        channelState: 'supported',
        relationships: relationship('cheap', '分组 cheap'),
        channels: [
          {
            id: 'maok-channel',
            name: '分组 maok-cheap',
            status: 'normal',
            timeline: [{ status: 'normal', checkedAt: new Date().toISOString() }],
          },
        ],
      },
      {
        siteId: 'shark',
        siteName: '鲨鱼',
        ratio: 1,
        groups: [group('shark-cheap', 'openai', 0.04)],
        channelState: 'supported',
        relationships: relationship('stable', '分组 stable'),
        channels: [
          {
            id: 'shark-channel',
            name: '分组 shark-cheap',
            status: 'normal',
            timeline: [{ status: 'normal', checkedAt: new Date().toISOString() }],
          },
        ],
      },
    ]);

    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({ platformKey: 'openai', effectiveRate: 0.04 });
    expect(result[0]?.sites).toHaveLength(1);
    expect(['maok', 'shark']).toContain(result[0]?.sites[0]?.siteId);
  });

  it('excludes an unstable cheaper candidate before scoring', () => {
    const result = comparePlatformRates([
      {
        siteId: 'cheap-unstable',
        siteName: '便宜但异常',
        ratio: 1,
        groups: [group('cheap', 'openai', 0.2)],
        channels: [
          {
            id: 'cheap-channel',
            name: '分组 cheap',
            groupName: '分组 cheap',
            status: 'failed',
            timeline: [{ status: 'failed', checkedAt: new Date().toISOString() }],
          },
        ],
        channelState: 'supported',
        relationships: relationship('cheap', '分组 cheap'),
      },
      {
        siteId: 'stable',
        siteName: '稳定但稍贵',
        ratio: 1,
        groups: [group('stable', 'openai', 0.25)],
        channels: [
          {
            id: 'stable-channel',
            name: '分组 stable',
            groupName: '分组 stable',
            status: 'normal',
            timeline: [{ status: 'normal', checkedAt: new Date().toISOString() }],
          },
        ],
        channelState: 'supported',
        relationships: relationship('stable', '分组 stable'),
      },
    ]);
    expect(result[0]).toMatchObject({ platformKey: 'openai', priceScore: 10 });
    expect(result[0]?.sites[0]).toMatchObject({
      siteId: 'stable',
      effectiveRate: 0.25,
      priceScore: 10,
      stabilityScore: 10,
      totalScore: 10,
      stabilityLabel: '稳定',
    });
    expect(result[0]?.sites).toHaveLength(1);
  });

  it('returns only the winner after applying stable tie breakers', () => {
    const result = comparePlatformRates([
      {
        siteId: 'z-site',
        siteName: '同名站点',
        ratio: 1,
        groups: [group('z-group', 'openai', 0.2, { name: '乙分组' })],
        channelState: 'supported',
        relationships: relationship('z-group', '乙分组'),
        channels: [
          {
            id: 'z',
            name: '乙分组',
            status: 'normal',
            timeline: [{ status: 'normal', checkedAt: new Date().toISOString() }],
          },
        ],
      },
      {
        siteId: 'a-site',
        siteName: '同名站点',
        ratio: 1,
        groups: [group('a-group', 'openai', 0.2, { name: '甲分组' })],
        channelState: 'supported',
        relationships: relationship('a-group', '甲分组'),
        channels: [
          {
            id: 'a',
            name: '甲分组',
            status: 'normal',
            timeline: [{ status: 'normal', checkedAt: new Date().toISOString() }],
          },
        ],
      },
    ]);

    expect(result[0]?.sites.map((site) => site.siteId)).toEqual(['a-site']);
  });

  it('scores every channel when one group has multiple matches', () => {
    const result = comparePlatformRates([
      {
        siteId: 'ambiguous',
        siteName: '多渠道站点',
        ratio: 1,
        groups: [group('shared', 'openai', 0.2, { name: '共享分组' })],
        channels: [
          {
            id: 'one',
            name: '共享分组',
            groupName: '共享分组',
            status: 'normal',
            timeline: [{ status: 'normal', checkedAt: new Date().toISOString() }],
          },
          {
            id: 'two',
            name: '共享分组',
            groupName: '共享分组',
            status: 'normal',
            timeline: [{ status: 'normal', checkedAt: new Date().toISOString() }],
          },
        ],
        channelState: 'supported',
        relationships: relationship('shared', '共享分组'),
      },
    ]);

    expect(result[0]?.sites).toHaveLength(1);
    expect(result[0]?.sites[0]?.channelId).toBe('one');
  });

  it('ranks tied minimum groups independently with their own matched channels', () => {
    const checkedAt = new Date().toISOString();
    const result = comparePlatformRates([
      {
        siteId: 'tied-site',
        siteName: '并列站点',
        ratio: 1,
        groups: [
          group('fast', 'openai', 0.2, { name: '高速分组' }),
          group('stable', 'openai', 0.2, { name: '稳定分组' }),
        ],
        channels: [
          {
            id: 'fast-channel',
            name: '高速分组',
            groupName: '高速分组',
            status: 'failed',
            timeline: [{ status: 'failed', checkedAt }],
          },
          {
            id: 'stable-channel',
            name: '稳定分组',
            groupName: '稳定分组',
            status: 'normal',
            timeline: [{ status: 'normal', checkedAt }],
          },
        ],
        channelState: 'supported',
        relationships: [...relationship('fast', '高速分组'), ...relationship('stable', '稳定分组')],
      },
    ]);

    expect(result[0]?.sites).toHaveLength(1);
    expect(result[0]?.sites).toEqual([
      expect.objectContaining({
        siteId: 'tied-site',
        groups: [expect.objectContaining({ id: 'stable' })],
        channelId: 'stable-channel',
        stabilityScore: 10,
      }),
    ]);
  });

  it('does not borrow a sibling channel for an unmatched tied group', () => {
    const result = comparePlatformRates([
      {
        siteId: 'partial-match',
        siteName: '部分匹配站点',
        ratio: 1,
        groups: [
          group('matched', 'openai', 0.2, { name: '已匹配分组' }),
          group('missing', 'openai', 0.2, { name: '未匹配分组' }),
        ],
        channels: [
          {
            id: 'matched-channel',
            name: '已匹配分组',
            groupName: '已匹配分组',
            status: 'normal',
            timeline: [{ status: 'normal', checkedAt: new Date().toISOString() }],
          },
        ],
        channelState: 'supported',
        relationships: relationship('matched', '已匹配分组'),
      },
    ]);

    expect(result[0]?.sites.map((site) => site.groups[0]?.id)).toEqual(['matched', 'missing']);
    expect(result[0]?.sites[1]).toMatchObject({
      recommendationKind: 'without-status',
      stabilityLabel: '无渠道状态',
    });
  });

  it('keeps a candidate pending while channel status is unavailable', () => {
    const result = comparePlatformRates([
      {
        siteId: 'no-status',
        siteName: '无状态站点',
        ratio: 1,
        groups: [group('no-status', 'claude', 0.4)],
      },
    ]);
    expect(result.find((item) => item.platformKey === 'claude')).toMatchObject({
      state: 'ready',
      sites: [
        expect.objectContaining({
          siteId: 'no-status',
          stabilityLabel: '无渠道状态',
          stabilityScore: 0,
          channelId: undefined,
        }),
      ],
    });
  });

  it('includes an unsupported site in price recommendations without calling it stable', () => {
    const result = comparePlatformRates([
      {
        siteId: 'unsupported',
        siteName: '无渠道接口',
        ratio: 1,
        groups: [group('unsupported-group', 'openai', 0.2)],
        channels: [],
        channelState: 'unsupported',
      },
    ]);
    expect(result.find((item) => item.platformKey === 'openai')).toMatchObject({
      state: 'ready',
      stabilityLabel: '无渠道状态',
      sites: [expect.objectContaining({ stabilityLabel: '无渠道状态', stabilityScore: 0 })],
    });
  });

  it('distinguishes a channel request failure from unsupported or missing status', () => {
    expect(channelStability(undefined, Date.now(), 'error')).toEqual({
      score: 0,
      label: '状态未知',
    });
    expect(channelStability(undefined, Date.now(), 'unsupported')).toEqual({
      score: 0,
      label: '无渠道状态',
    });
  });

  it('classifies only recent channel timeline points', () => {
    const old = new Date(Date.now() - 6 * 60_000).toISOString();
    expect(
      channelStability(
        {
          id: 'old',
          name: '旧记录',
          status: 'failed',
          timeline: [{ status: 'failed', checkedAt: old }],
        },
        Date.now(),
        'supported',
      ),
    ).toEqual({ score: 0, label: '存在异常' });
    expect(
      channelStability(
        {
          id: 'fresh',
          name: '新记录',
          status: 'normal',
          timeline: [{ status: 'normal', checkedAt: new Date().toISOString() }],
        },
        Date.now(),
        'supported',
      ),
    ).toEqual({ score: 10, label: '稳定' });
  });

  it('treats unknown and degraded values as stable, but failures as unstable', () => {
    const checkedAt = new Date().toISOString();
    expect(
      channelStability(
        {
          id: 'unknown',
          name: '未知记录',
          status: 'normal',
          timeline: [{ status: 'unknown', checkedAt }],
        },
        Date.now(),
        'supported',
      ),
    ).toEqual({ score: 10, label: '稳定' });
    expect(
      channelStability(
        {
          id: 'degraded',
          name: '当前降级',
          status: 'degraded',
          timeline: [{ status: 'normal', checkedAt }],
        },
        Date.now(),
        'supported',
      ),
    ).toEqual({ score: 10, label: '稳定' });
    expect(
      channelStability(
        {
          id: 'failed',
          name: '当前失败',
          status: 'failed',
          timeline: [{ status: 'normal', checkedAt }],
        },
        Date.now(),
        'supported',
      ),
    ).toEqual({ score: 0, label: '存在异常' });
  });

  it('keeps the requested platform order regardless of labels', () => {
    const result = comparePlatformRates([
      { siteId: 'g', siteName: 'G', ratio: 1, groups: [group('g', 'grok', 1)] },
      { siteId: 'o', siteName: 'O', ratio: 1, groups: [group('o', 'openai', 1)] },
      { siteId: 'c', siteName: 'C', ratio: 1, groups: [group('c', 'claude', 1)] },
      { siteId: 'm', siteName: 'M', ratio: 1, groups: [group('m', 'gemini', 1)] },
    ]);
    expect(result.map((item) => item.platformKey)).toEqual(['openai', 'claude', 'gemini', 'grok']);
  });

  it('keeps the first four platform columns fixed when data is missing', () => {
    const result = comparePlatformRates([]);
    expect(result.map((item) => [item.platformKey, item.state])).toEqual([
      ['openai', 'empty'],
      ['claude', 'empty'],
      ['gemini', 'empty'],
      ['grok', 'empty'],
    ]);
  });
});
