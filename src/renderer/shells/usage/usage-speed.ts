export type UsageSpeedTier = 'slow' | 'normal' | 'fast' | 'unavailable';

export function calculateTokensPerSecond(
  outputTokens: unknown,
  durationMs: unknown,
): number | undefined {
  if (
    typeof outputTokens !== 'number' ||
    !Number.isFinite(outputTokens) ||
    outputTokens < 0 ||
    typeof durationMs !== 'number' ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0
  )
    return undefined;
  return (outputTokens * 1000) / durationMs;
}

export function usageSpeedTier(value: number | undefined): UsageSpeedTier {
  if (value === undefined || !Number.isFinite(value) || value < 0) return 'unavailable';
  if (value < 20) return 'slow';
  if (value < 50) return 'normal';
  return 'fast';
}

export function formatTokensPerSecond(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '—' : `${value.toFixed(2)} t/s`;
}
