export class UsageLoadCoordinator {
  private requestId = 0;

  async load<TList, TStats>(
    readList: () => Promise<TList>,
    readStats: () => Promise<TStats>,
    commit: (list: TList, stats: TStats) => void,
    reject?: () => void,
  ): Promise<void> {
    const requestId = ++this.requestId;
    try {
      const [list, stats] = await Promise.all([readList(), readStats()]);
      if (requestId === this.requestId) commit(list, stats);
    } catch {
      if (requestId === this.requestId) reject?.();
    }
  }

  invalidate(): void {
    this.requestId += 1;
  }
}
