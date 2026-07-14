export function concurrencyForSiteCount(count: number): number {
  if (count <= 4) return Math.max(1, count);
  if (count <= 10) return 4;
  return 6;
}

export function intervalInRange(min: number, max: number, random = Math.random): number {
  return Math.min(max, Math.floor(min + random() * (max - min + 1)));
}

export function computeBackoffMs(attempt: number, random = Math.random): number {
  const levels = [30_000, 60_000, 120_000, 300_000];
  const base = levels[Math.min(Math.max(attempt, 0), levels.length - 1)];
  return base + Math.floor(random() * Math.min(5_000, base * 0.1));
}

export function estimateDurationRange(samples: number[]): [number, number] {
  if (!samples.length) return [3_000, 5_000];
  const sorted = [...samples].sort((a, b) => a - b);
  return [Math.max(500, sorted[0]), Math.max(sorted[0], sorted[sorted.length - 1])];
}
