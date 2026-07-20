import { describe, expect, it } from 'vitest';
import type { AvailableRateGroup } from '../../../../electron/shared/contracts';
import {
  comparePlatformRates,
  channelStability,
  effectiveRate,
  filterRateGroups,
  findPlatformMinima,
  formatRateMultiplier,
  normalizePlatform,
  parseRechargeRatio,
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

describe('rate comparison rules', () => {
  it('normalizes recharge value and formats without meaningless zeroes', () => {
    expect(effectiveRate(0.4, 10)).toBeCloseTo(0.04, 12);
    expect(effectiveRate(0, 8)).toBe(0);
    expect(effectiveRate(0.4, undefined)).toBeUndefined();
    expect(effectiveRate(0.4, 0)).toBeUndefined();
    expect(formatRateMultiplier(0.0150001)).toBe('0.015x');
    expect(formatRateMultiplier(0)).toBe('0x');
  });

  it('uses known platform aliases and preserves unknown platforms', () => {
    expect(normalizePlatform('openai')).toEqual({ key: 'openai', label: 'OpenAI' });
    expect(normalizePlatform('anthropic')).toEqual({ key: 'claude', label: 'Claude' });
    expect(normalizePlatform('google')).toEqual({ key: 'gemini', label: 'Gemini' });
    expect(normalizePlatform('xai')).toEqual({ key: 'grok', label: 'Grok' });
    expect(normalizePlatform('Local-Lab')).toEqual({ key: 'local-lab', label: 'Local-Lab' });
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

  it('uses raw rates for one site without a ratio but excludes it cross-site', () => {
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
      },
      {
        siteId: 'shark',
        siteName: '鲨鱼',
        ratio: 1,
        groups: [group('shark-cheap', 'openai', 0.04)],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ platformKey: 'openai', effectiveRate: 0.04 });
    expect(result[0]?.sites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ siteId: 'maok' }),
        expect.objectContaining({ siteId: 'shark' }),
      ]),
    );
  });

  it('scores price relative to the cheapest candidate and stability at 40 percent', () => {
    const result = comparePlatformRates([
      {
        siteId: 'cheap-unstable',
        siteName: '便宜但异常',
        ratio: 1,
        groups: [group('cheap', 'openai', 0.2)],
        channels: [
          {
            id: 'cheap-channel',
            name: '便宜分组',
            groupName: '分组 cheap',
            status: 'failed',
            timeline: [{ status: 'failed', checkedAt: new Date().toISOString() }],
          },
        ],
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
      },
    ]);
    expect(result[0]).toMatchObject({ platformKey: 'openai', priceScore: 8 });
    expect(result[0]?.sites[0]).toMatchObject({
      siteId: 'stable',
      effectiveRate: 0.25,
      priceScore: 8,
      stabilityScore: 10,
      totalScore: 8.8,
      stabilityLabel: '稳定',
    });
    expect(result[0]?.sites[1]).toMatchObject({
      siteId: 'cheap-unstable',
      effectiveRate: 0.2,
      priceScore: 10,
      stabilityScore: 0,
      totalScore: 6,
    });
  });

  it('keeps every candidate and applies all stable tie breakers', () => {
    const result = comparePlatformRates([
      {
        siteId: 'z-site',
        siteName: '同名站点',
        ratio: 1,
        groups: [group('z-group', 'openai', 0.2, { name: '乙分组' })],
      },
      {
        siteId: 'a-site',
        siteName: '同名站点',
        ratio: 1,
        groups: [group('a-group', 'openai', 0.2, { name: '甲分组' })],
      },
    ]);

    expect(result[0]?.sites.map((site) => site.siteId)).toEqual(['a-site', 'z-site']);
  });

  it('does not borrow a channel status when a group has multiple matches', () => {
    const result = comparePlatformRates([
      {
        siteId: 'ambiguous',
        siteName: '多渠道站点',
        ratio: 1,
        groups: [group('shared', 'openai', 0.2, { name: '共享分组' })],
        channels: [
          {
            id: 'one',
            name: '共享分组线路一',
            groupName: '共享分组',
            status: 'normal',
            timeline: [{ status: 'normal', checkedAt: new Date().toISOString() }],
          },
          {
            id: 'two',
            name: '共享分组线路二',
            groupName: '共享分组',
            status: 'normal',
            timeline: [{ status: 'normal', checkedAt: new Date().toISOString() }],
          },
        ],
      },
    ]);

    expect(result[0]?.sites[0]).toMatchObject({
      stabilityScore: 5,
      stabilityLabel: '无渠道状态',
    });
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
            name: '高速渠道',
            groupName: '高速分组',
            status: 'failed',
            timeline: [{ status: 'failed', checkedAt }],
          },
          {
            id: 'stable-channel',
            name: '稳定渠道',
            groupName: '稳定分组',
            status: 'normal',
            timeline: [{ status: 'normal', checkedAt }],
          },
        ],
      },
    ]);

    expect(result[0]?.sites).toHaveLength(2);
    expect(result[0]?.sites).toEqual([
      expect.objectContaining({
        siteId: 'tied-site',
        groups: [expect.objectContaining({ id: 'stable' })],
        channelId: 'stable-channel',
        stabilityScore: 10,
      }),
      expect.objectContaining({
        siteId: 'tied-site',
        groups: [expect.objectContaining({ id: 'fast' })],
        channelId: 'fast-channel',
        stabilityScore: 0,
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
            name: '已匹配渠道',
            groupName: '已匹配分组',
            status: 'normal',
            timeline: [{ status: 'normal', checkedAt: new Date().toISOString() }],
          },
        ],
      },
    ]);

    const missing = result[0]?.sites.find((site) => site.groups[0]?.id === 'missing');
    expect(missing).toMatchObject({
      stabilityLabel: '无渠道状态',
      stabilityScore: 5,
    });
    expect(missing).not.toHaveProperty('channelId');
  });

  it('uses a neutral score for a candidate without channel status', () => {
    const result = comparePlatformRates([
      {
        siteId: 'no-status',
        siteName: '无状态站点',
        ratio: 1,
        groups: [group('no-status', 'claude', 0.4)],
      },
    ]);
    expect(result[0]?.sites[0]).toMatchObject({
      stabilityScore: 5,
      stabilityLabel: '无渠道状态',
    });
  });

  it('distinguishes a channel request failure from unsupported or missing status', () => {
    expect(channelStability(undefined, Date.now(), 'error')).toEqual({
      score: 3,
      label: '状态未知',
    });
    expect(channelStability(undefined, Date.now(), 'unsupported')).toEqual({
      score: 5,
      label: '无渠道状态',
    });
  });

  it('classifies only recent channel timeline points', () => {
    const old = new Date(Date.now() - 6 * 60_000).toISOString();
    expect(
      channelStability({
        id: 'old',
        name: '旧记录',
        status: 'failed',
        timeline: [{ status: 'failed', checkedAt: old }],
      }),
    ).toEqual({ score: 3, label: '状态未知' });
    expect(
      channelStability({
        id: 'fresh',
        name: '新记录',
        status: 'normal',
        timeline: [{ status: 'normal', checkedAt: new Date().toISOString() }],
      }),
    ).toEqual({ score: 10, label: '稳定' });
  });

  it('never marks a recent unknown or contradictory current status as stable', () => {
    const checkedAt = new Date().toISOString();
    expect(
      channelStability({
        id: 'unknown',
        name: '未知记录',
        status: 'normal',
        timeline: [{ status: 'unknown', checkedAt }],
      }),
    ).toEqual({ score: 3, label: '状态未知' });
    expect(
      channelStability({
        id: 'degraded',
        name: '当前降级',
        status: 'degraded',
        timeline: [{ status: 'normal', checkedAt }],
      }),
    ).toEqual({ score: 5, label: '存在异常' });
    expect(
      channelStability({
        id: 'failed',
        name: '当前失败',
        status: 'failed',
        timeline: [{ status: 'normal', checkedAt }],
      }),
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
});
