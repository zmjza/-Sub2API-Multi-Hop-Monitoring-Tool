import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RateChannelSummary } from './RateChannelSummary';

describe('RateChannelSummary', () => {
  it('shows the channel fetch time with seconds', () => {
    const html = renderToStaticMarkup(
      <RateChannelSummary
        siteName="站点"
        groupName="分组"
        listState="success"
        matchState="matched"
        fetchedAt={Date.UTC(2026, 7, 29, 11, 22, 33)}
        channel={{ id: 'channel-1', name: '渠道', status: 'normal', timeline: [] }}
        onRetry={() => undefined}
      />,
    );
    expect(html).toContain('更新于');
    expect(html).toMatch(/更新于 \d{2}:\d{2}:\d{2}/);
  });
});
