import { describe, expect, it } from 'vitest';
import { isAllowedRadarNavigation, radarUrlForTarget, radarViewBounds } from './radar.js';

describe('radar embed boundary', () => {
  it('rejects arbitrary renderer input while resolving fixed targets', () => {
    expect(radarUrlForTarget('codex')).toBe('https://codexradar.com/');
    expect(radarUrlForTarget('distributed')).toBe('https://deng.codexradar.com/');
    expect(radarUrlForTarget('https://evil.example')).toBeUndefined();
    expect(radarUrlForTarget({ id: 'codex' })).toBeUndefined();
  });

  it('accepts only the two exact HTTPS origins', () => {
    expect(isAllowedRadarNavigation('https://codexradar.com/')).toBe(true);
    expect(isAllowedRadarNavigation('https://codexradar.com/path#section')).toBe(true);
    expect(isAllowedRadarNavigation('https://deng.codexradar.com/')).toBe(true);
    expect(isAllowedRadarNavigation('https://deng.codexradar.com:444/')).toBe(false);
    expect(isAllowedRadarNavigation('https://www.codexradar.com/')).toBe(false);
    expect(isAllowedRadarNavigation('https://user:pass@codexradar.com/')).toBe(false);
    expect(isAllowedRadarNavigation('http://codexradar.com/')).toBe(false);
    expect(isAllowedRadarNavigation('data:text/html,<h1>unsafe</h1>')).toBe(false);
    expect(isAllowedRadarNavigation('not a url')).toBe(false);
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
