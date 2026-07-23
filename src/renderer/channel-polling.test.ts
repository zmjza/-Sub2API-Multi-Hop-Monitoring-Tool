import { describe, expect, it } from 'vitest';
import {
  channelPollingDelay,
  normalizeChannelPollingSeconds,
  retryAfterSecondsFromError,
} from './channel-polling';

describe('channel polling policy', () => {
  it('allows only the documented low-frequency intervals', () => {
    expect(normalizeChannelPollingSeconds(10)).toBe(60);
    expect(normalizeChannelPollingSeconds(30)).toBe(30);
    expect(normalizeChannelPollingSeconds(60)).toBe(60);
    expect(normalizeChannelPollingSeconds(120)).toBe(120);
  });

  it('uses the documented retry ladder and honors a longer Retry-After', () => {
    expect(channelPollingDelay(0)).toBe(120_000);
    expect(channelPollingDelay(1)).toBe(240_000);
    expect(channelPollingDelay(2)).toBe(480_000);
    expect(channelPollingDelay(9)).toBe(900_000);
    expect(channelPollingDelay(0, 600)).toBe(600_000);
  });

  it('extracts only a bounded retry duration from the safe IPC error marker', () => {
    expect(retryAfterSecondsFromError(new Error('CHANNEL_REFRESH_FAILED RETRY_AFTER=600'))).toBe(
      600,
    );
    expect(retryAfterSecondsFromError(new Error('private response'))).toBeUndefined();
  });
});
