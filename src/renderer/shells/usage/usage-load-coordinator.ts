export class UsageLoadCoordinator {
  private requestId = 0;

  async load<TList, TStats>(
    readList: () => Promise<TList>,
    readStats: () => Promise<TStats>,
    commit: (list: TList, stats: TStats | undefined) => void,
    reject?: () => void,
  ): Promise<void> {
    const requestId = ++this.requestId;
    try {
      const [list, stats] = await Promise.allSettled([readList(), readStats()]);
      if (requestId !== this.requestId) return;
      if (list.status === 'rejected') throw list.reason;
      commit(list.value, stats.status === 'fulfilled' ? stats.value : undefined);
    } catch {
      if (requestId === this.requestId) reject?.();
    }
  }

  invalidate(): void {
    this.requestId += 1;
  }
}
