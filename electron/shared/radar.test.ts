import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RADAR_ENTRIES,
  isAllowedRadarNavigation,
  isSafeRadarUrl,
  normalizeRadarUrl,
  radarEntriesSchema,
  radarEntryInputSchema,
  radarViewBounds,
} from './radar.js';

describe('radar embed boundary', () => {
  it('provides two stable default entries and normalizes URLs', () => {
    expect(DEFAULT_RADAR_ENTRIES.map((entry) => entry.id)).toEqual([
      'radar-codex',
      'radar-distributed',
    ]);
    expect(normalizeRadarUrl('  https://example.com/path  ')).toBe('https://example.com/path');
    expect(normalizeRadarUrl('https://example.com')).toBe('https://example.com/');
  });

  it('validates dynamic radar entry input without granting arbitrary URLs', () => {
    expect(
      radarEntryInputSchema.parse({ label: ' 测试雷达 ', url: 'https://example.com/a' }),
    ).toEqual({ label: '测试雷达', url: 'https://example.com/a' });
    expect(radarEntryInputSchema.safeParse({ label: 'x', url: 'http://example.com' }).success).toBe(
      false,
    );
    expect(
      radarEntryInputSchema.safeParse({ label: 'x', url: 'https://user:pass@example.com' }).success,
    ).toBe(false);
    expect(radarEntryInputSchema.safeParse({ label: '', url: 'https://example.com' }).success).toBe(
      false,
    );
    expect(isSafeRadarUrl('file:///tmp/radar.html')).toBe(false);
    expect(isSafeRadarUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects duplicate labels and URLs in persisted radar entries', () => {
    expect(
      radarEntriesSchema.safeParse([
        { id: 'a', label: 'A', url: 'https://example.com/' },
        { id: 'b', label: 'A', url: 'https://other.example/' },
      ]).success,
    ).toBe(false);
    expect(
      radarEntriesSchema.safeParse([
        { id: 'a', label: 'A', url: 'https://example.com/' },
        { id: 'b', label: 'B', url: 'https://example.com' },
      ]).success,
    ).toBe(false);
  });

  it('accepts safe HTTPS navigation across origins', () => {
    const origin = 'https://codexradar.com';
    expect(isAllowedRadarNavigation('https://codexradar.com/', origin)).toBe(true);
    expect(isAllowedRadarNavigation('https://codexradar.com/path#section', origin)).toBe(true);
    expect(isAllowedRadarNavigation('https://deng.codexradar.com/', origin)).toBe(true);
    expect(isAllowedRadarNavigation('https://codexradar.com:444/', origin)).toBe(true);
    expect(isAllowedRadarNavigation('https://user:pass@codexradar.com/', origin)).toBe(false);
    expect(isAllowedRadarNavigation('http://codexradar.com/', origin)).toBe(false);
    expect(isAllowedRadarNavigation('data:text/html,<h1>unsafe</h1>', origin)).toBe(false);
    expect(isAllowedRadarNavigation('not a url', origin)).toBe(false);
  });

  it('keeps the embedded page below the app toolbar and beside the sidebar', () => {
    expect(radarViewBounds({ width: 1200, height: 800 })).toEqual({
      x: 284,
      y: 80,
      width: 916,
      height: 720,
    });
    expect(radarViewBounds({ width: 720, height: 512 })).toEqual({
      x: 284,
      y: 80,
      width: 436,
      height: 432,
    });
  });
});
