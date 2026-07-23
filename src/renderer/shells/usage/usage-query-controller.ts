export interface UsageAutoQuery {
  period: 'today' | '7d' | '30d' | 'custom';
  page: number;
  apiKeyId?: string;
  model?: string;
  groupId?: string;
  startDate?: string;
  endDate?: string;
  requestType?: string;
  billingType?: string;
  billingMode?: string;
  sort?: 'asc' | 'desc';
}

export class UsageQueryController {
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly run: (query: UsageAutoQuery) => void,
    private readonly delayMs = 300,
  ) {}

  schedule(query: UsageAutoQuery): void {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.run(query);
    }, this.delayMs);
  }

  flush(query: UsageAutoQuery): void {
    this.cancel();
    this.run(query);
  }

  dispose(): void {
    this.cancel();
  }

  private cancel(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
