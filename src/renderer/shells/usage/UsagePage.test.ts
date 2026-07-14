import { describe, expect, it } from 'vitest';
import { readUsagePagination, usageResetQuery } from './UsagePage';

describe('readUsagePagination', () => {
  it('restores the documented default query when filters are reset', () => {
    expect(usageResetQuery()).toEqual({ period: 'today', page: 1, sort: 'desc' });
  });

  it('uses the safe usage payload metadata for totals, ranges, and page buttons', () => {
    expect(
      readUsagePagination({
        items: Array.from({ length: 20 }, (_, index) => ({ id: String(index) })),
        page: 2,
        pageSize: 20,
        pages: 42,
        total: 840,
      }),
    ).toEqual({
      page: 2,
      pageSize: 20,
      pages: 42,
      total: 840,
      rangeStart: 21,
      rangeEnd: 40,
      pageButtons: [1, 2, 3, 4, 5],
    });
  });

  it('clamps malformed preview metadata without inventing records', () => {
    expect(readUsagePagination({ items: [], page: 9, pageSize: 20, pages: 0, total: 0 })).toEqual({
      page: 1,
      pageSize: 20,
      pages: 0,
      total: 0,
      rangeStart: 0,
      rangeEnd: 0,
      pageButtons: [],
    });
  });
});
