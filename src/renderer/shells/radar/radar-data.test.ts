import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RADAR_ENTRIES,
  isSafeRadarUrl,
  isAllowedRadarNavigation,
  normalizeRadarUrl,
} from './radar-data';

describe('Radar dynamic target configuration', () => {
  it('keeps the two legacy entries as defaults for first launch', () => {
    expect(DEFAULT_RADAR_ENTRIES).toEqual([
      { id: 'radar-codex', label: 'Codex 雷达', url: 'https://codexradar.com/' },
      {
        id: 'radar-distributed',
        label: '分布式雷达 Codex 站',
        url: 'https://deng.codexradar.com/',
      },
    ]);
  });

  it('normalizes and validates HTTPS-only radar URLs', () => {
    expect(normalizeRadarUrl('https://example.com')).toBe('https://example.com/');
    expect(isSafeRadarUrl('https://example.com/a')).toBe(true);
    expect(isSafeRadarUrl('http://example.com')).toBe(false);
    expect(isSafeRadarUrl('https://user:pass@example.com')).toBe(false);
  });

  it('allows safe HTTPS top-level navigation across pages', () => {
    expect(
      isAllowedRadarNavigation('https://codexradar.com/anything', 'https://codexradar.com'),
    ).toBe(true);
    expect(isAllowedRadarNavigation('https://www.codexradar.com/', 'https://codexradar.com')).toBe(
      true,
    );
    expect(
      isAllowedRadarNavigation('https://codexradar.com.evil.example/', 'https://codexradar.com'),
    ).toBe(true);
    expect(isAllowedRadarNavigation('file:///tmp/radar.html', 'https://codexradar.com')).toBe(
      false,
    );
  });
});
