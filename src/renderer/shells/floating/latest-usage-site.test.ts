import { describe, expect, it } from 'vitest';
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
    ).toEqual({ siteId: 'site-b', usedAt: Date.parse('2026-07-19T10:00:03Z') });
  });

  it('uses a stable site id tie breaker and ignores invalid payloads', () => {
    expect(
      selectLatestUsageSite([
        { siteId: 'site-z', payload: { items: [{ createdAt: '2026-07-19T10:00:03Z' }] } },
        { siteId: 'site-a', payload: { items: [{ createdAt: '2026-07-19T10:00:03Z' }] } },
        { siteId: 'invalid', payload: { items: [{ createdAt: 'not-a-date' }] } },
      ]),
    ).toEqual({ siteId: 'site-a', usedAt: Date.parse('2026-07-19T10:00:03Z') });
  });
});
