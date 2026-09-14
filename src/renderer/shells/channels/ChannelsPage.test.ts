import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatV2BucketTip, readChannelItems } from './ChannelsPage';

describe('readChannelItems', () => {
  it('keeps normalized live metrics and never merges static preview values', () => {
    expect(
      readChannelItems({
        state: 'supported',
        channels: [
          {
            id: '7',
            name: 'Live channel',
            platform: 'openai',
            groupName: 'Default',
            primaryModel: 'live-model',
            extraModels: [],
            status: 'degraded',
            latencyMs: 123,
            pingMs: 45,
            availability7d: 98.7,
            timeline: [],
          },
        ],
      }),
    ).toEqual([
      {
        id: '7',
        name: 'Live channel',
        platform: 'openai',
        groupName: 'Default',
        primaryModel: 'live-model',
        extraModels: [],
        status: 'degraded',
        latencyMs: 123,
        pingMs: 45,
        availability7d: 98.7,
        timeline: [],
      },
    ]);
  });

  it('returns no fabricated records when runtime data is absent', () => {
    expect(readChannelItems(undefined)).toEqual([]);
  });

  it('preserves the V2-only metric payload for the renderer', () => {
    const v2 = {
      cacheRate: 0.42,
      successRate: 0.91,
      ttftMs: 1200,
      buckets: [{ checkedAt: '2026-09-14T01:00:00Z', status: 'normal' as const }],
    };
    expect(
      readChannelItems({
        state: 'supported',
        monitorSource: 'v2',
        channels: [
          {
            id: 'v2-1',
            name: 'V2 channel',
            platform: 'openai',
            groupName: 'V2',
            primaryModel: '',
            extraModels: [],
            status: 'normal',
            timeline: [],
            v2,
          },
        ],
      })[0]?.v2,
    ).toEqual(v2);
  });

  it('keeps channel health surfaces free of multiplier conversion UI', () => {
    const page = readFileSync(
      fileURLToPath(new URL('./ChannelsPage.tsx', import.meta.url)),
      'utf8',
    );
    const popover = readFileSync(
      fileURLToPath(new URL('../overview/ChannelStatusPopover.tsx', import.meta.url)),
      'utf8',
    );
    const styles = readFileSync(fileURLToPath(new URL('./channels.css', import.meta.url)), 'utf8');

    for (const source of [page, popover]) {
      expect(source).not.toContain('BadgePercent');
      expect(source).not.toContain('channelRatePresentation');
      expect(source).not.toContain('channel-rate-badge');
      expect(source).not.toMatch(/倍率|折算/);
    }
    expect(styles).not.toContain('.channel-rate-badge');
  });

  it('moves manual association controls into the channel status popover', () => {
    const page = readFileSync(
      fileURLToPath(new URL('./ChannelsPage.tsx', import.meta.url)),
      'utf8',
    );
    const popover = readFileSync(
      fileURLToPath(new URL('../overview/ChannelStatusPopover.tsx', import.meta.url)),
      'utf8',
    );
    expect(page).not.toContain('channel-association-panel');
    expect(page).not.toContain('保存关联');
    expect(popover).toContain('rate-channel-association-button');
    expect(popover).toContain('已关联');
    expect(popover).toContain('toggleChannelAssociation');
  });

  it('formats V2 matrix hover with availability, cache rate and first token', () => {
    expect(
      formatV2BucketTip({
        checkedAt: '2026-09-14T07:10:00Z',
        successRate: 0.624,
        cacheRate: 0.786,
        ttftMs: 13500,
      }),
    ).toMatch(/可用率 62.4% · 缓存率 78.6% · 首 Token 13.5s$/);
  });
});
