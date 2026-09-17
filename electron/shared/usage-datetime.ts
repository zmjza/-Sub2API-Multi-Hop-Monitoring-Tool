function parseLocalDate(value: string): { year: number; month: number; day: number } | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day))
    return undefined;
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return { year, month, day };
}

function clampHour(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const hour = Number(value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return Number.NaN;
  return hour;
}

export function isInvertedDateTimeRange(
  startDate: string,
  endDate: string,
  startHour = 0,
  endHour = 23,
): boolean {
  const bounds = customDateTimeBounds(startDate, endDate, startHour, endHour);
  return !bounds.ok;
}

export function customDateTimeBounds(
  startDate: string,
  endDate: string,
  startHour?: number,
  endHour?: number,
):
  { ok: true; startMs: number; endMs: number; startDate: string; endDate: string } | { ok: false } {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const hourStart = clampHour(startHour, 0);
  const hourEnd = clampHour(endHour, 23);
  if (!start || !end || Number.isNaN(hourStart) || Number.isNaN(hourEnd)) return { ok: false };
  const startMs = new Date(start.year, start.month - 1, start.day, hourStart, 0, 0, 0).getTime();
  const endMs = new Date(end.year, end.month - 1, end.day, hourEnd, 59, 59, 999).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) return { ok: false };
  return { ok: true, startMs, endMs, startDate, endDate };
}

export function filterItemsByCreatedAt<T extends { createdAt?: string }>(
  items: T[],
  startMs: number,
  endMs: number,
): T[] {
  return items.filter((item) => {
    const createdAt = Date.parse(item.createdAt ?? '');
    return Number.isFinite(createdAt) && createdAt >= startMs && createdAt <= endMs;
  });
}
