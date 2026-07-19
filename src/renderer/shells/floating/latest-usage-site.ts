export interface UsageSiteResult {
  siteId: string;
  payload: unknown;
}

export function latestUsageTimestamp(payload: unknown): number | undefined {
  if (!payload || typeof payload !== 'object' || !('items' in payload)) return undefined;
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) return undefined;
  const timestamps = items.flatMap((item) => {
    if (!item || typeof item !== 'object' || !('createdAt' in item)) return [];
    const timestamp = Date.parse(String((item as { createdAt?: unknown }).createdAt ?? ''));
    return Number.isFinite(timestamp) ? [timestamp] : [];
  });
  return timestamps.length ? Math.max(...timestamps) : undefined;
}

export function selectLatestUsageSite(
  results: UsageSiteResult[],
): { siteId: string; usedAt: number } | undefined {
  return results
    .flatMap((result) => {
      const usedAt = latestUsageTimestamp(result.payload);
      return usedAt === undefined ? [] : [{ siteId: result.siteId, usedAt }];
    })
    .sort(
      (left, right) => right.usedAt - left.usedAt || left.siteId.localeCompare(right.siteId, 'en'),
    )[0];
}
