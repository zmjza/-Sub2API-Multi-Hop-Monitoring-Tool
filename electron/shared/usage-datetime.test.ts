import { describe, expect, it } from 'vitest';
import {
  customDateTimeBounds,
  filterItemsByCreatedAt,
  isInvertedDateTimeRange,
} from './usage-datetime.js';

describe('customDateTimeBounds', () => {
  it('defaults start hour to 00:00 and end hour to 23:59:59', () => {
    expect(customDateTimeBounds('2026-09-15', '2026-09-15')).toEqual({
      ok: true,
      startMs: new Date(2026, 8, 15, 0, 0, 0, 0).getTime(),
      endMs: new Date(2026, 8, 15, 23, 59, 59, 999).getTime(),
      startDate: '2026-09-15',
      endDate: '2026-09-15',
    });
    expect(customDateTimeBounds('2026-09-15', '2026-09-16', 8, 9)).toEqual({
      ok: true,
      startMs: new Date(2026, 8, 15, 8, 0, 0, 0).getTime(),
      endMs: new Date(2026, 8, 16, 9, 59, 59, 999).getTime(),
      startDate: '2026-09-15',
      endDate: '2026-09-16',
    });
  });

  it('rejects inverted ranges', () => {
    expect(isInvertedDateTimeRange('2026-09-16', '2026-09-15', 0, 23)).toBe(true);
    expect(customDateTimeBounds('2026-09-16', '2026-09-15').ok).toBe(false);
  });
});

describe('filterItemsByCreatedAt', () => {
  it('keeps records inside the local hour window', () => {
    const startMs = new Date(2026, 8, 15, 8, 0, 0, 0).getTime();
    const endMs = new Date(2026, 8, 15, 9, 59, 59, 999).getTime();
    const items = [
      { id: '1', createdAt: new Date(2026, 8, 15, 7, 59, 59).toISOString() },
      { id: '2', createdAt: new Date(2026, 8, 15, 8, 0, 0).toISOString() },
      { id: '3', createdAt: new Date(2026, 8, 15, 9, 30, 0).toISOString() },
      { id: '4', createdAt: new Date(2026, 8, 15, 10, 0, 0).toISOString() },
    ];
    expect(
      filterItemsByCreatedAt(items, startMs, endMs).map((item: { id: string }) => item.id),
    ).toEqual(['2', '3']);
  });
});
