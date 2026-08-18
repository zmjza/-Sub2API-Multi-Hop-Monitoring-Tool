import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FloatingWindow, trapDialogTabFocus } from './FloatingWindow';

beforeAll(() => vi.stubGlobal('window', {}));
afterAll(() => vi.unstubAllGlobals());

describe('floating window transparency', () => {
  it('cycles keyboard focus inside the associated-channel dialog', () => {
    const first = { focus: vi.fn() };
    const last = { focus: vi.fn() };
    const dialog = {
      querySelectorAll: () => [first, last],
    } as unknown as HTMLElement;
    const preventDefault = vi.fn();

    expect(
      trapDialogTabFocus(
        { key: 'Tab', shiftKey: false, target: last, preventDefault } as unknown as KeyboardEvent,
        dialog,
      ),
    ).toBe(true);
    expect(first.focus).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();

    preventDefault.mockClear();
    expect(
      trapDialogTabFocus(
        { key: 'Tab', shiftKey: true, target: first, preventDefault } as unknown as KeyboardEvent,
        dialog,
      ),
    ).toBe(true);
    expect(last.focus).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('keeps a stable surface while the native window controls opacity', () => {
    const css = readFileSync(fileURLToPath(new URL('./floating.css', import.meta.url)), 'utf8');
    expect(css).toContain('background: rgba(255, 255, 255, 0.96)');
    expect(css).not.toContain('var(--floating-opacity)');
    expect(css).not.toMatch(/\.floating-window:(?:hover|focus-within)[^{]*\{[^}]*background:/s);
    expect(css).toContain('backdrop-filter: blur(18px)');
  });

  it('offers a live 35 to 100 percent opacity control', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./FloatingWindow.tsx', import.meta.url)),
      'utf8',
    );
    expect(source).toContain('aria-label="透明度"');
    expect(source).toContain('type="range"');
    expect(source).toContain('min="35"');
    expect(source).toContain('max="100"');
    expect(source).toContain('{props.floatingOpacity ?? 84}%');
  });

  it('prefers the current site note in the top title', () => {
    const html = renderToStaticMarkup(
      createElement(FloatingWindow, {
        state: 'success',
        theme: 'light',
        reducedTransparency: false,
        highContrast: false,
        onStateChange: () => undefined,
        selectedSite: {
          id: 'site-1',
          name: '默认站点名',
          note: '手动备注名',
          baseUrl: 'https://example.invalid',
          balance: 5,
          status: 'success',
          source: 'live',
          errors: [],
        },
      }),
    );

    expect(html).toContain('title="手动备注名"');
    expect(html).toContain('>手动备注名</strong>');
  });

  it('shows the effective key credit when the current key has a quota', () => {
    const html = renderToStaticMarkup(
      createElement(FloatingWindow, {
        state: 'success',
        theme: 'light',
        reducedTransparency: false,
        highContrast: false,
        onStateChange: () => undefined,
        selectedSite: {
          id: 'site-1',
          name: '站点',
          baseUrl: 'https://example.invalid',
          balance: 100,
          status: 'success',
          source: 'live',
          errors: [],
        },
        currentKeyStatsBySite: {
          'site-1': {
            state: 'success',
            keyId: 'key-1',
            totalRequests: 1,
            totalTokens: 2,
            totalActualCost: 0.1,
            availableCredit: { kind: 'amount', value: 7 },
          },
        },
      }),
    );
    expect(html).toContain('$7.00');
    expect(html).not.toContain('$100.00');
  });

  it('keeps the drag handle and bottom-right actions structurally isolated', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./FloatingWindow.tsx', import.meta.url)),
      'utf8',
    );
    const css = readFileSync(fileURLToPath(new URL('./floating.css', import.meta.url)), 'utf8');

    expect(source).toContain('className="floating-actions"');
    expect(css).toContain('-webkit-app-region: drag');
    expect(css).toContain('-webkit-app-region: no-drag');
  });

  it('renders twenty slots while keeping the latest-twelve percentage in the channel card', () => {
    const html = renderToStaticMarkup(
      createElement(FloatingWindow, {
        state: 'success',
        theme: 'light',
        reducedTransparency: false,
        highContrast: false,
        onStateChange: () => undefined,
        selectedSite: {
          id: 'site-1',
          name: '站点',
          baseUrl: 'https://example.invalid',
          status: 'success',
          source: 'live',
          errors: [],
        },
        keyOptions: [{ id: 'key-1', maskedLabel: 'sk-***', status: 'active', groupId: 'group-1' }],
        keyPreference: { mode: 'manual', keyId: 'key-1' },
        usageFilterOptions: { models: [], groups: [{ id: 'group-1', name: 'Plus 分组' }] },
        channelAssociations: [
          { siteId: 'site-1', groupId: 'group-1', channelIds: ['channel-1'], source: 'manual' },
        ],
        channelsData: {
          state: 'supported',
          channels: [
            {
              id: 'channel-1',
              name: 'Plus【特惠通道009】很长很长的渠道名称',
              status: 'normal',
              timeline: [
                { status: 'unknown', checkedAt: '2026-08-07T12:00:02.000Z' },
                { status: 'normal', checkedAt: '2026-08-07T12:00:00.000Z' },
                { status: 'failed', checkedAt: '2026-08-07T12:00:01.000Z' },
              ],
            },
          ],
          availableChannels: [
            {
              name: 'Plus【特惠通道009】很长很长的渠道名称',
              platforms: [
                {
                  platform: 'openai',
                  groupIds: ['group-1'],
                  groupNames: ['Plus 分组'],
                  modelNames: [],
                },
              ],
            },
          ],
          availableChannelsState: 'complete',
        },
      }),
    );

    expect(html).toContain('class="floating-channel-card');
    expect(html).toContain('近期可用率');
    expect(html).not.toContain('自动关联');
    expect(html).not.toContain('手动指定');
    expect(html).not.toContain('Plus【特惠通道009】很长很长的渠道名称</strong>');
    expect(html).not.toContain('floating-channel-heading');
    expect(html).toContain('aria-label="Plus【特惠通道009】很长很长的渠道名称，查看全部关联渠道"');
    expect(html.match(/<i [^>]*class=/g)).toHaveLength(20);
    expect(html.match(/<i [^>]*class="empty"/g)).toHaveLength(17);
    expect(html.indexOf('class="empty"')).toBeLessThan(html.indexOf('class="normal"'));
    expect(html.indexOf('class="normal"')).toBeLessThan(html.indexOf('class="failed"'));
    expect(html.indexOf('class="failed"')).toBeLessThan(html.indexOf('class="unknown"'));
    expect(html).toContain('title="暂无更早记录"');
    expect(html).toContain('aria-label="暂无更早记录"');
    const latestLabel = `${new Date('2026-08-07T12:00:02.000Z').toLocaleString('zh-CN', {
      hour12: false,
    })} 未知`;
    expect(html).toContain(`title="${latestLabel}"`);
    expect(html).toContain(`aria-label="${latestLabel}"`);
    expect(html).toContain('aria-label="最近 20 次渠道状态时间线"');
    expect(html).not.toContain('近 1 分钟');
    expect(html).not.toContain('floating-channels');
    expect(html).not.toContain('floating-channel-panel');
    expect(html.indexOf('floating-speed')).toBeGreaterThan(html.indexOf('<footer'));
  });

  it('shows a semantic empty state instead of a fabricated zero percentage', () => {
    const html = renderToStaticMarkup(
      createElement(FloatingWindow, {
        state: 'success',
        theme: 'light',
        reducedTransparency: false,
        highContrast: false,
        onStateChange: () => undefined,
        selectedSite: {
          id: 'site-1',
          name: '站点',
          baseUrl: 'https://example.invalid',
          status: 'success',
          source: 'live',
          errors: [],
        },
        keyOptions: [{ id: 'key-1', maskedLabel: 'sk-***', status: 'active', groupId: 'group-1' }],
        keyPreference: { mode: 'manual', keyId: 'key-1' },
        usageFilterOptions: { models: [], groups: [{ id: 'group-1', name: 'Plus 分组' }] },
        channelAssociations: [
          { siteId: 'site-1', groupId: 'group-1', channelIds: ['channel-1'], source: 'manual' },
        ],
        channelsData: {
          state: 'supported',
          channels: [{ id: 'channel-1', name: 'Plus 渠道', status: 'normal', timeline: [] }],
          availableChannels: [
            {
              name: 'Plus 渠道',
              platforms: [
                {
                  platform: 'openai',
                  groupIds: ['group-1'],
                  groupNames: ['Plus 分组'],
                  modelNames: [],
                },
              ],
            },
          ],
          availableChannelsState: 'complete',
        },
      }),
    );

    expect(html).toContain('暂无渠道记录');
    expect(html).not.toContain('0.00%');
    expect(html.match(/<i [^>]*class="empty"/g)).toHaveLength(20);
  });

  it('does not flash the site total balance when the current key credit is unavailable', () => {
    const html = renderToStaticMarkup(
      createElement(FloatingWindow, {
        state: 'success',
        theme: 'light',
        reducedTransparency: false,
        highContrast: false,
        onStateChange: () => undefined,
        selectedSite: {
          id: 'site-1',
          name: '站点',
          baseUrl: 'https://example.invalid',
          balance: 88,
          status: 'success',
          source: 'live',
          errors: [],
        },
        currentKeyStatsBySite: {
          'site-1': { state: 'loading', keyId: 'key-1' },
        },
      }),
    );
    expect(html).not.toContain('$88.00');
    expect(html).toContain('>—</span>');
  });

  it('keeps an unavailable channel state in the same compact slot without an empty dialog trigger', () => {
    const html = renderToStaticMarkup(
      createElement(FloatingWindow, {
        state: 'success',
        theme: 'light',
        reducedTransparency: false,
        highContrast: false,
        onStateChange: () => undefined,
        selectedSite: {
          id: 'site-1',
          name: '站点',
          baseUrl: 'https://example.invalid',
          status: 'success',
          source: 'live',
          errors: [],
        },
        keyOptions: [{ id: 'key-1', maskedLabel: 'sk-***', status: 'active', groupId: 'group-1' }],
        keyPreference: { mode: 'manual', keyId: 'key-1' },
        usageFilterOptions: { models: [], groups: [{ id: 'group-1', name: 'Plus 分组' }] },
        channelsData: { state: 'error' },
      }),
    );

    expect(html).toContain('class="floating-channel-card is-message"');
    expect(html).toContain('渠道查询失败');
    expect(html).not.toContain('aria-label="查看全部关联渠道"');
  });
});

describe('floating manual-only channel association', () => {
  it('shows a manual-only empty state instead of automatic channels', () => {
    const html = renderToStaticMarkup(
      createElement(FloatingWindow, {
        state: 'success',
        theme: 'light',
        reducedTransparency: false,
        highContrast: false,
        onStateChange: () => undefined,
        selectedSite: {
          id: 'site-1',
          name: '站点',
          baseUrl: 'https://example.invalid',
          status: 'success',
          source: 'live',
          errors: [],
        },
        keyOptions: [{ id: 'key-1', maskedLabel: 'sk-***', status: 'active', groupId: 'group-1' }],
        keyPreference: { mode: 'manual', keyId: 'key-1' },
        usageFilterOptions: { models: [], groups: [{ id: 'group-1', name: 'Plus 分组' }] },
        channelsData: {
          state: 'supported',
          channels: [
            {
              id: 'channel-1',
              name: '自动匹配到的渠道',
              status: 'normal',
              timeline: [{ status: 'normal', checkedAt: new Date().toISOString() }],
            },
          ],
          availableChannels: [
            {
              name: '自动匹配到的渠道',
              platforms: [
                {
                  platform: 'openai',
                  groupIds: ['group-1'],
                  groupNames: ['Plus 分组'],
                  modelNames: [],
                },
              ],
            },
          ],
          availableChannelsState: 'complete',
        },
      }),
    );
    expect(html).toContain('class="floating-channel-card is-message"');
    expect(html).toContain('暂未关联渠道');
    expect(html).not.toContain('自动匹配到的渠道');
    expect(html).not.toContain('aria-label="查看全部关联渠道"');
  });
});
