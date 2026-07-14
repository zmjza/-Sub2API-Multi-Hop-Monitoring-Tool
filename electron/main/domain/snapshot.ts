import type { SiteSnapshot } from './types.js';

export function isFreshSnapshot(snapshot: SiteSnapshot, now: number, ttlMs: number): boolean {
  return now - snapshot.fetchedAt <= ttlMs;
}

export function aggregateSnapshots(snapshots: SiteSnapshot[], now: number, ttlMs: number) {
  const fresh = snapshots.filter((snapshot) => isFreshSnapshot(snapshot, now, ttlMs));
  return {
    balance: fresh.reduce((sum, item) => sum + item.balance, 0),
    todayTokens: fresh.reduce((sum, item) => sum + item.todayTokens, 0),
    todayActualCost: fresh.reduce((sum, item) => sum + item.todayActualCost, 0),
    counted: fresh.length,
    total: snapshots.length,
  };
}
