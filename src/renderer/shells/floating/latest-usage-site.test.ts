import { describe, expect, it } from 'vitest';
import type { PreviewState } from '../../preview/types';
import * as latestUsageSite from './latest-usage-site';
import { latestUsageTimestamp, selectLatestUsageSite } from './latest-usage-site';

describe('latest usage site selection', () => {
  it('reads the newest valid timestamp from a usage payload', () => {
    expect(
      latestUsageTimestamp({
        items: [
          { createdAt: '2026-07-19T10:00:00Z' },
          { createdAt: 'invalid' },
          { createdAt: '2026-07-19T10:00:02Z' },
        ],
      }),
    ).toBe(Date.parse('2026-07-19T10:00:02Z'));
    expect(latestUsageTimestamp({ items: [] })).toBeUndefined();
    expect(latestUsageTimestamp(undefined)).toBeUndefined();
  });

  it('selects the site with the globally latest usage record', () => {
    expect(
      selectLatestUsageSite([
        { siteId: 'site-a', payload: { items: [{ createdAt: '2026-07-19T10:00:01Z' }] } },
        { siteId: 'site-b', payload: { items: [{ createdAt: '2026-07-19T10:00:03Z' }] } },
        { siteId: 'site-c', payload: { items: [] } },
      ]),
    ).toEqual({
      siteId: 'site-b',
      usedAt: Date.parse('2026-07-19T10:00:03Z'),
      record: { createdAt: '2026-07-19T10:00:03Z' },
    });
  });

  it('uses a stable site id tie breaker and ignores invalid payloads', () => {
    expect(
      selectLatestUsageSite([
        { siteId: 'site-z', payload: { items: [{ createdAt: '2026-07-19T10:00:03Z' }] } },
        { siteId: 'site-a', payload: { items: [{ createdAt: '2026-07-19T10:00:03Z' }] } },
        { siteId: 'invalid', payload: { items: [{ createdAt: 'not-a-date' }] } },
      ]),
    ).toEqual({
      siteId: 'site-a',
      usedAt: Date.parse('2026-07-19T10:00:03Z'),
      record: { createdAt: '2026-07-19T10:00:03Z' },
    });
  });

  it('resolves refresh state for the site selected by the floating usage scan', () => {
    const resolve = (
      latestUsageSite as typeof latestUsageSite & {
        stateForSelectedUsageSite?: (
          siteId: string,
          runtimeState: string | undefined,
          refreshingSiteIds: ReadonlySet<string>,
        ) => PreviewState;
      }
    ).stateForSelectedUsageSite;

    expect(resolve).toBeTypeOf('function');
    expect(resolve?.('site-b', 'success', new Set(['site-a']))).toBe('success');
    expect(resolve?.('site-b', 'success', new Set(['site-b']))).toBe('refreshing');
    expect(resolve?.('site-b', 'auth-required', new Set())).toBe('auth-required');
    expect(resolve?.('site-b', 'unexpected', new Set())).toBe('success');
  });
});
