import { describe, expect, it } from 'vitest';
import { formatChannelFetchedAt } from './channel-time';

describe('channel timestamp formatting', () => {
  it('formats a fetched timestamp with hour, minute, and second', () => {
    const value = formatChannelFetchedAt(Date.UTC(2026, 7, 29, 11, 22, 33));
    expect(value).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('returns an explicit placeholder when no successful fetch exists', () => {
    expect(formatChannelFetchedAt(undefined)).toBe('尚未更新');
  });
});
