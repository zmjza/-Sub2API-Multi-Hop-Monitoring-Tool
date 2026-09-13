export const RECENT_USAGE_SAMPLE_LIMIT = 100;

export interface RecentAverageResult {
  usedRows: number;
  durationSamples: number;
  cacheRateSamples: number;
  averageDurationMs?: number;
  averageCacheRate?: number;
}

export function averageRecentSamples<T>(
  rows: T[],
  read: {
    durationMs: (row: T) => number | undefined;
    cacheRate: (row: T) => number | undefined;
  },
  limit = RECENT_USAGE_SAMPLE_LIMIT,
): RecentAverageResult {
  const recent = rows.slice(0, Math.max(0, limit));
  let durationSum = 0;
  let durationSamples = 0;
  let cacheSum = 0;
  let cacheRateSamples = 0;
  for (const row of recent) {
    const duration = finiteNonNegative(read.durationMs(row));
    if (duration !== undefined) {
      durationSum += duration;
      durationSamples += 1;
    }
    const cacheRate = finiteNonNegative(read.cacheRate(row));
    if (cacheRate !== undefined) {
      cacheSum += cacheRate;
      cacheRateSamples += 1;
    }
  }
  return {
    usedRows: recent.length,
    durationSamples,
    cacheRateSamples,
    ...(durationSamples ? { averageDurationMs: durationSum / durationSamples } : {}),
    ...(cacheRateSamples ? { averageCacheRate: cacheSum / cacheRateSamples } : {}),
  };
}

function finiteNonNegative(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function cacheRateFromTokens(
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
