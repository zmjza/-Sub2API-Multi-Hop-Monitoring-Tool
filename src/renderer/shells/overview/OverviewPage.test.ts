import { describe, expect, it } from 'vitest';
import * as overviewPage from './OverviewPage';
import { formatSiteBalance, quotaForSite, reduceInlineChannelRefreshState } from './OverviewPage';
import type { OverviewProps } from './types';

const props = (
  key: { quota?: number; quotaUsed?: number; subscriptionType?: string } | undefined,
): OverviewProps => ({
  state: 'success',
  theme: 'light',
  reducedTransparency: false,
  highContrast: false,
  selectedSite: {
    id: 'site-1',
    name: '站点',
    baseUrl: 'https://example.com',
    status: 'success',
    source: 'live',
    errors: [],
    balance: 12,
  },
  keyPreference: key ? { mode: 'manual', keyId: 'key-1' } : { mode: 'auto' },
  keyOptions: key ? [{ id: 'key-1', maskedLabel: 'Key', status: 'active', ...key }] : [],
});

const site = { id: 'site-1', balance: 12 };

describe('overview quota display', () => {
  it('uses quota and clamps overuse at zero', () => {
    const result = quotaForSite(site, props({ quota: 80.88, quotaUsed: 66.5265 }));
    expect(result).toBeDefined();
    expect(result).toMatchObject({ total: 80.88, used: 66.5265 });
    expect(result?.remaining).toBe(12);
    expect(result?.percent).toBeCloseTo(82.2533, 3);
    expect(formatSiteBalance(site, props({ quota: 10, quotaUsed: 12 }))).toBe('$0.00');
  });

  it('uses user balance for an unlimited resolved key but not an unresolved key', () => {
    expect(quotaForSite(site, props({ quota: 0, quotaUsed: 4 }))).toBeUndefined();
    expect(quotaForSite(site, props({ quota: Number.NaN, quotaUsed: 4 }))).toBeUndefined();
    expect(formatSiteBalance(site, props({ quota: 0 }))).toBe('$12.00');
    expect(formatSiteBalance(site, props(undefined))).toBe('待查询');
  });

  it('does not let subscription metadata replace the finite or unlimited amount display', () => {
    expect(
      quotaForSite(site, props({ quota: 20, quotaUsed: 5, subscriptionType: 'monthly' })),
    ).toMatchObject({ total: 20, used: 5, remaining: 12 });
    expect(
      formatSiteBalance(site, props({ quota: 20, quotaUsed: 5, subscriptionType: 'monthly' })),
    ).toBe('$12.00');
    expect(formatSiteBalance(site, props({ subscriptionType: 'monthly' }))).toBe('$12.00');
  });

  it('resolves the actual effective key in automatic mode', () => {
    const autoProps = {
      ...props(undefined),
      keyPreference: { mode: 'auto' as const },
      keyOptions: [
        {
          id: 'key-auto',
          maskedLabel: 'Auto',
          status: 'active',
          quota: 10,
          quotaUsed: 3,
        },
      ],
      selectedSite: { ...props(undefined).selectedSite!, defaultKeyId: 'key-auto', balance: 20 },
    };
    expect(formatSiteBalance({ ...site, balance: 20 }, autoProps)).toBe('$7.00');
  });

  it('uses the manual key context owned by a non-selected site', () => {
    const multiSiteProps = {
      ...props(undefined),
      selectedSite: { ...props(undefined).selectedSite!, id: 'site-2' },
      keyContexts: {
        'site-1': {
          preference: { mode: 'manual', keyId: 'key-1' },
          keys: [
            {
              id: 'key-1',
              maskedLabel: 'Key',
              status: 'active',
              quota: 80.88,
              quotaUsed: 66.5265,
            },
          ],
        },
        'site-2': { preference: { mode: 'auto' }, keys: [] },
      },
    } as unknown as OverviewProps;

    expect(quotaForSite(site, multiSiteProps)?.remaining).toBe(12);
    expect(formatSiteBalance(site, multiSiteProps)).toBe('$12.00');
  });
});

describe('site card ordering', () => {
  it('moves one site before another without losing IDs', () => {
    const moveSite = (
      overviewPage as unknown as {
        moveSiteBefore(ids: string[], movingId: string, targetId: string): string[];
      }
    ).moveSiteBefore;

    expect(moveSite(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(moveSite(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'a', 'c']);
    expect(moveSite(['a', 'b', 'c'], 'missing', 'b')).toEqual(['a', 'b', 'c']);
  });
});

describe('overview channel refresh state', () => {
  it('keeps the last successful channel list visible while polling and after a failure', () => {
    const successful = {
      state: 'success' as const,
      lastSuccessAt: Date.parse('2026-07-29T10:00:00Z'),
    };

    const refreshing = reduceInlineChannelRefreshState(successful, {
      type: 'refresh-started',
      now: Date.parse('2026-07-29T10:01:00Z'),
    });
    const failed = reduceInlineChannelRefreshState(refreshing, {
      type: 'refresh-failed',
      now: Date.parse('2026-07-29T10:01:01Z'),
      reason: 'network',
    });

    expect(refreshing).toMatchObject({ state: 'success', refreshing: true });
    expect(failed).toEqual({
      state: 'success',
      refreshing: false,
      stale: true,
      failureReason: 'network',
      lastSuccessAt: successful.lastSuccessAt,
    });
  });

  it('uses the full error state only when no successful channel list exists', () => {
    expect(
      reduceInlineChannelRefreshState(undefined, {
        type: 'refresh-failed',
        now: Date.parse('2026-07-29T10:01:01Z'),
        reason: 'network',
      }),
    ).toEqual({
      state: 'error',
      refreshing: false,
      stale: false,
      failureReason: 'network',
    });
  });
});
