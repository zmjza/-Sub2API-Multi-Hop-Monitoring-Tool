import { computeBackoffMs, concurrencyForSiteCount } from '../domain/scheduler.js';

export class RefreshScheduler {
  private sites: string[] = [];
  private currentSite?: string;
  private running = new Map<string, Promise<void>>();
  private lastManual = new Map<string, number>();
  private stopped = false;
  private failures = new Map<string, number>();
  private nextAllowed = new Map<string, number>();
  private allRun?: Promise<void>;

  constructor(private readonly refresh: (siteId: string) => Promise<unknown>) {}

  setSites(siteIds: string[]): void {
    this.sites = [...new Set(siteIds)];
  }
  setCurrentSite(siteId: string): void {
    this.currentSite = siteId;
  }
  start(): void {
    this.stopped = false;
  }
  stop(): void {
    this.stopped = true;
  }

  async manualRefresh(siteId: string): Promise<void> {
    const now = Date.now();
    const previous = this.lastManual.get(siteId);
    if (previous !== undefined && previous + 5_000 > now) return;
    this.lastManual.set(siteId, now);
    this.nextAllowed.delete(siteId);
    await this.refreshNow(siteId);
  }

  manualRefreshAll(): Promise<void> {
    for (const siteId of this.sites) this.nextAllowed.delete(siteId);
    return this.refreshAll();
  }

  async refreshNow(siteId: string): Promise<void> {
    if (this.stopped || (this.nextAllowed.get(siteId) ?? 0) > Date.now()) return;
    const existing = this.running.get(siteId);
    if (existing) return existing;
    const run = this.runSite(siteId).finally(() => {
      if (this.running.get(siteId) === run) this.running.delete(siteId);
    });
    this.running.set(siteId, run);
    return run;
  }

  private async runSite(siteId: string): Promise<void> {
    try {
      await this.refresh(siteId);
      this.failures.delete(siteId);
      this.nextAllowed.delete(siteId);
    } catch (error) {
      const attempt = this.failures.get(siteId) ?? 0;
      this.failures.set(siteId, attempt + 1);
      this.nextAllowed.set(siteId, Date.now() + computeBackoffMs(attempt));
      throw error;
    }
  }

  refreshAll(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.allRun) return this.allRun;
    const run = this.runAll().finally(() => {
      if (this.allRun === run) this.allRun = undefined;
    });
    this.allRun = run;
    return run;
  }

  private async runAll(): Promise<void> {
    const ordered = [...this.sites].sort((a, b) =>
      a === this.currentSite ? -1 : b === this.currentSite ? 1 : 0,
    );
    const limit = concurrencyForSiteCount(ordered.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < ordered.length) {
        const siteId = ordered[cursor++];
        try {
          await this.refreshNow(siteId);
        } catch {
          /* isolate one site from the remaining queue */
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, ordered.length) }, worker));
  }
}
