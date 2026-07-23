import { describe, expect, it } from 'vitest';
import { formatSiteBalance, quotaForSite } from './OverviewPage';
import type { OverviewProps } from './types';

const props = (key: { quota?: number; quotaUsed?: number } | undefined): OverviewProps => ({
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
