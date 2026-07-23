import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readChannelItems } from './ChannelsPage';

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
});
