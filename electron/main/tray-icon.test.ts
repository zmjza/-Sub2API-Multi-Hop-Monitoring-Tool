import { describe, expect, it } from 'vitest';
import { createTrayMenuTemplate, TRAY_ICON_SVG, trayIconDataUrl } from './tray-icon.js';

describe('tray icon asset', () => {
  it('uses a visible monochrome template glyph instead of a transparent pixel', () => {
    expect(TRAY_ICON_SVG).toContain('<svg');
    expect(TRAY_ICON_SVG).toContain('fill="black"');
    expect(TRAY_ICON_SVG).not.toContain('opacity="0"');
    expect(TRAY_ICON_SVG.length).toBeGreaterThan(100);
  });

  it('provides a nonempty PNG data URL that Electron nativeImage can decode', () => {
    const dataUrl = trayIconDataUrl();
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(png.length).toBeGreaterThan(100);
  });

  it('binds restore, floating toggle, and quit actions to the native tray menu', () => {
    const actions: string[] = [];
    const template = createTrayMenuTemplate({
      showMain: () => actions.push('show-main'),
      toggleFloating: () => actions.push('toggle-floating'),
      quit: () => actions.push('quit'),
    });

    expect(template.map((item) => item.label ?? item.type)).toEqual([
      '打开主面板',
      '显示/隐藏悬浮窗',
      'separator',
      '退出',
    ]);
    template[0]?.click?.({} as never, undefined as never, {} as never);
    template[1]?.click?.({} as never, undefined as never, {} as never);
    template[3]?.click?.({} as never, undefined as never, {} as never);
    expect(actions).toEqual(['show-main', 'toggle-floating', 'quit']);
  });
});
