import { describe, expect, it } from 'vitest';
import {
  RADAR_TARGETS,
  RADAR_TARGET_IDS,
  isAllowedRadarNavigation,
  radarUrlForTarget,
} from './radar-data';

describe('Radar target configuration', () => {
  it('exposes exactly the two fixed entry points', () => {
    expect(RADAR_TARGET_IDS).toEqual(['codex', 'distributed']);
    expect(RADAR_TARGETS).toEqual({
      codex: { label: 'Codex 雷达', url: 'https://codexradar.com/' },
      distributed: {
        label: '分布式雷达 Codex 站',
        url: 'https://deng.codexradar.com/',
      },
    });
  });

  it('resolves only fixed target identifiers', () => {
    expect(radarUrlForTarget('codex')).toBe('https://codexradar.com/');
    expect(radarUrlForTarget('distributed')).toBe('https://deng.codexradar.com/');
    expect(radarUrlForTarget('https://example.com')).toBeUndefined();
    expect(radarUrlForTarget(undefined)).toBeUndefined();
  });

  it('allows only exact HTTPS radar origins for top-level navigation', () => {
    expect(isAllowedRadarNavigation('https://codexradar.com/')).toBe(true);
    expect(isAllowedRadarNavigation('https://codexradar.com/anything')).toBe(true);
    expect(isAllowedRadarNavigation('https://deng.codexradar.com/')).toBe(true);
    expect(isAllowedRadarNavigation('http://codexradar.com/')).toBe(false);
    expect(isAllowedRadarNavigation('https://www.codexradar.com/')).toBe(false);
    expect(isAllowedRadarNavigation('https://codexradar.com.evil.example/')).toBe(false);
    expect(isAllowedRadarNavigation('file:///tmp/radar.html')).toBe(false);
  });
});
