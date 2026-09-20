import type { UsageQuery, UsageStats } from '../../shared/contracts.js';

interface CacheRateSite {
  id: string;
  name: string;
}

interface CacheRateGroup {
  id?: string;
  name: string;
}

interface CacheRateMonitorDependencies {
  sites: readonly CacheRateSite[];
  enabled: boolean;
  groups(siteId: string): Promise<readonly CacheRateGroup[]>;
  stats(
    query: UsageQuery,
  ): Promise<Pick<UsageStats, 'averageCacheRate' | 'averageCacheRateSampleCount'>>;
  notify(
    siteId: string,
    siteName: string,
    groupIdentity: string,
    groupName: string,
    averageRate: number,
    sampleCount: number,
    enabled: boolean,
    fresh: boolean,
  ): boolean;
  retainGroups(siteId: string, groupIdentities: readonly string[]): void;
}

export async function checkCacheRateAlerts(input: CacheRateMonitorDependencies): Promise<void> {
  for (const site of input.sites) {
    let groups: readonly CacheRateGroup[];
    try {
      groups = await input.groups(site.id);
    } catch {
      continue;
    }
    const identities = groups.map((group) => group.id || normalizeGroupName(group.name));
    input.retainGroups(site.id, identities);
    let cursor = 0;
    const worker = async () => {
      while (cursor < groups.length) {
        const group = groups[cursor++];
        if (!group) continue;
        const identity = group.id || normalizeGroupName(group.name);
        try {
          const stats = await input.stats({
            siteId: site.id,
            period: '30d',
            page: 1,
            pageSize: 20,
            groupId: group.id,
            sort: 'desc',
          });
          input.notify(
            site.id,
            site.name,
            identity,
            group.name,
            stats.averageCacheRate ?? Number.NaN,
            stats.averageCacheRateSampleCount ?? 0,
            input.enabled,
            true,
          );
        } catch {
          /* one group must not block the remaining checks */
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, groups.length) }, worker));
  }
}

function normalizeGroupName(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}
