import { describe, expect, it } from 'vitest';
import { cacheRateTone, calculateCacheRate, formatCacheRate } from './cache-rate';

describe('cache rate', () => {
  it('uses input, cache read and cache creation tokens only', () => {
    expect(calculateCacheRate(100, 50, 50)).toBe(25);
  });

  it('returns undefined for missing or zero denominator', () => {
    expect(calculateCacheRate(undefined, undefined, undefined)).toBeUndefined();
    expect(calculateCacheRate(0, 0, 0)).toBeUndefined();
  });

  it('clamps malformed rates and applies confirmed color boundaries', () => {
    expect(calculateCacheRate(0, 10, 0)).toBe(100);
    expect(cacheRateTone(30)).toBe('red');
    expect(cacheRateTone(31)).toBe('yellow');
    expect(cacheRateTone(60)).toBe('yellow');
    expect(cacheRateTone(61)).toBe('green');
    expect(cacheRateTone(85)).toBe('green');
    expect(cacheRateTone(86)).toBe('purple');
    expect(formatCacheRate(undefined)).toBe('—');
  });
});
