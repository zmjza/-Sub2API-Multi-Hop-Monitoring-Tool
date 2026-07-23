export type ChannelPollingSeconds = 30 | 60 | 120;

export function normalizeChannelPollingSeconds(value: number): ChannelPollingSeconds {
  return value === 30 || value === 120 ? value : 60;
}

export function channelPollingDelay(failureCount: number, retryAfterSeconds?: number): number {
  const ladder = [120_000, 240_000, 480_000, 900_000] as const;
  const backoff = ladder[Math.min(Math.max(0, Math.trunc(failureCount)), ladder.length - 1)];
  const retryAfter =
    typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds)
      ? Math.max(0, retryAfterSeconds * 1_000)
      : 0;
  return Math.max(backoff, retryAfter);
}

export function retryAfterSecondsFromError(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const match = /(?:^|\s)RETRY_AFTER=(\d{1,6})(?:\s|$)/.exec(message);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? Math.min(86_400, value) : undefined;
}
