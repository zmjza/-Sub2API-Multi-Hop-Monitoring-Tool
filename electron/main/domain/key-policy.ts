import type { ApiKeySummary } from './types.js';

export function selectDefaultKey(
  keys: ApiKeySummary[],
  todayRequests: Record<string, number>,
  previousId?: string,
): string | undefined {
  const active = keys.filter((key) => key.status === 'active');
  if (!active.length) return undefined;
  const highest = Math.max(...active.map((key) => todayRequests[key.id] ?? 0));
  if (highest === 0) {
    if (previousId && active.some((key) => key.id === previousId)) return previousId;
    return active[0].id;
  }
  const candidates = active.filter((key) => (todayRequests[key.id] ?? 0) === highest);
  if (previousId && candidates.some((key) => key.id === previousId)) return previousId;
  return candidates[0].id;
}

export type RateResult =
  | { available: true; value: number; source: 'custom' | 'default' }
  | { available: false; source: 'unavailable' };

export function resolveRate(defaultRate?: number, customRate?: number): RateResult {
  if (customRate !== undefined) return { available: true, value: customRate, source: 'custom' };
  if (defaultRate !== undefined) return { available: true, value: defaultRate, source: 'default' };
  return { available: false, source: 'unavailable' };
}
