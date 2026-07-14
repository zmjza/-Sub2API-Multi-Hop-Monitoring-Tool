import { describe, expect, it } from 'vitest';
import { formatLocalTimestamp, formatTokenCount } from './format.js';

describe('renderer formatters', () => {
  it('formats token counts with compact K and M units', () => {
    expect(formatTokenCount(0)).toBe('0');
    expect(formatTokenCount(999)).toBe('999');
    expect(formatTokenCount(1_000)).toBe('1K');
    expect(formatTokenCount(1_250)).toBe('1.25K');
    expect(formatTokenCount(12_500)).toBe('12.5K');
    expect(formatTokenCount(1_000_000)).toBe('1M');
    expect(formatTokenCount(1_234_567)).toBe('1.23M');
  });

  it('formats timestamps in the requested local Chinese layout', () => {
    const date = new Date(2026, 6, 14, 9, 8, 7);

    expect(formatLocalTimestamp(date)).toBe('07月 14日 09时 08分 07秒');
    expect(formatLocalTimestamp('invalid')).toBe('—');
  });
});
