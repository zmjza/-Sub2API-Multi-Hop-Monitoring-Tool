export type CacheRateTone = 'red' | 'yellow' | 'green' | 'purple' | 'none';

export function calculateCacheRate(
  inputTokens: number | undefined,
  cacheReadTokens: number | undefined,
  cacheCreationTokens: number | undefined,
): number | undefined {
  const input = finiteNonNegative(inputTokens);
  const read = finiteNonNegative(cacheReadTokens);
  const creation = finiteNonNegative(cacheCreationTokens);
  if (input === undefined && read === undefined && creation === undefined) return undefined;
  const denominator = (input ?? 0) + (read ?? 0) + (creation ?? 0);
  if (denominator <= 0) return undefined;
  return Math.min(100, Math.max(0, ((read ?? 0) / denominator) * 100));
}

export function cacheRateTone(rate: number | undefined): CacheRateTone {
  if (rate === undefined || !Number.isFinite(rate)) return 'none';
  if (rate <= 30) return 'red';
  if (rate <= 60) return 'yellow';
  if (rate <= 85) return 'green';
  return 'purple';
}

export function formatCacheRate(rate: number | undefined): string {
  return rate === undefined ? '—' : `${rate.toFixed(1)}%`;
}

function finiteNonNegative(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
