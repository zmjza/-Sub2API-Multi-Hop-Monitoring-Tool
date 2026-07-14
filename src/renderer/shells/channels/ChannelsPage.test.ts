import { describe, expect, it } from 'vitest';
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
});
