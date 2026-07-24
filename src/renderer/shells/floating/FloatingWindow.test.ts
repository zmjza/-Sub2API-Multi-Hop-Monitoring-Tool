import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FloatingWindow } from './FloatingWindow';

beforeAll(() => vi.stubGlobal('window', {}));
afterAll(() => vi.unstubAllGlobals());

describe('floating window transparency', () => {
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
      FloatingWindow({
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
      FloatingWindow({
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
});
