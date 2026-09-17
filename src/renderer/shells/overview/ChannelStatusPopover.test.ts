import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  ChannelDetailPayload,
  ChannelViewPayload,
} from '../../../../electron/shared/contracts';
import { restoreChannelPopoverCache } from './ChannelStatusPopover';

const channel = (id: string) => ({
  id,
  name: `Channel ${id}`,
  platform: 'openai',
  groupName: 'default',
  primaryModel: 'gpt-5',
  extraModels: [],
  status: 'normal' as const,
  timeline: [],
});

describe('ChannelStatusPopover cache fallback', () => {
  it('restores the last selected channel and detail after a forced refresh fails', () => {
    const first = channel('channel-a');
    const second = channel('channel-b');
    const channels: ChannelViewPayload = {
      state: 'supported',
      channels: [first, second],
    };
    const detail: ChannelDetailPayload = {
      state: 'supported',
      detail: {
        id: 'channel-b',
        name: 'Channel channel-b',
        platform: 'openai',
        groupName: 'default',
        models: [],
      },
    };

    expect(
      restoreChannelPopoverCache({ channels, details: { 'channel-b': detail } }, 'channel-b'),
    ).toEqual({
      channels: [first, second],
      selected: second,
      detail: detail.detail,
    });
  });
});

describe('channel popover family grouping', () => {
  it('groups the compact list by platform family without an all tab', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./ChannelStatusPopover.tsx', import.meta.url)),
      'utf8',
    );
    expect(source).toContain('groupChannelsByPlatformFamily');
    expect(source).toContain('ChannelFamilyHeader');
    expect(source).toContain('compact');
    expect(source).not.toContain('family-all');
  });
});
