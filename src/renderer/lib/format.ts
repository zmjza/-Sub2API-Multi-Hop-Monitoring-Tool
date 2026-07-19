export function formatTokenCount(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const absolute = Math.abs(value);
  if (absolute < 1_000) return String(Math.round(value));
  if (absolute < 1_000_000) return `${trimDecimals(value / 1_000)}K`;
  return `${trimDecimals(value / 1_000_000)}M`;
}

export function formatLocalTimestamp(value: string | number | Date | undefined): string {
  if (value === undefined) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function trimDecimals(value: number): string {
  return value.toFixed(2).replace(/\.0+$|(?<=\.[0-9])0$/, '');
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
