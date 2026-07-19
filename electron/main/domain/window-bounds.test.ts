import { describe, expect, it } from 'vitest';
import {
  floatingCornerBounds,
  floatingWindowPolicy,
  resolveFloatingBounds,
} from './window-bounds.js';

describe('floatingCornerBounds', () => {
  const workArea = { x: 10, y: 20, width: 1200, height: 800 };

  it('places the fixed floating window at every supported desktop corner', () => {
    expect(floatingCornerBounds('top-left', workArea)).toEqual({
      x: 22,
      y: 32,
      width: 380,
      height: 260,
    });
    expect(floatingCornerBounds('top-right', workArea)).toEqual({
      x: 818,
      y: 32,
      width: 380,
      height: 260,
    });
    expect(floatingCornerBounds('bottom-left', workArea)).toEqual({
      x: 22,
      y: 548,
      width: 380,
      height: 260,
    });
    expect(floatingCornerBounds('bottom-right', workArea)).toEqual({
      x: 818,
      y: 548,
      width: 380,
      height: 260,
    });
  });

  it('keeps the floating window pinned across apps on macOS and Windows', () => {
    expect(floatingWindowPolicy('darwin')).toEqual({
      alwaysOnTop: false,
      visibleOnAllWorkspaces: true,
      visibleOnFullScreen: false,
      activateOnShow: false,
    });
    expect(floatingWindowPolicy('win32')).toEqual({
      alwaysOnTop: false,
      visibleOnAllWorkspaces: false,
      visibleOnFullScreen: false,
      activateOnShow: false,
    });
  });

  it('restores custom coordinates on a negative display and clamps partial overflow', () => {
    const displays = [
      { x: -1920, y: 0, width: 1920, height: 1080 },
      { x: 0, y: 0, width: 1440, height: 900 },
    ];
    expect(
      resolveFloatingBounds({ position: 'custom', x: -1800, y: 100 }, displays, displays[1]),
    ).toEqual({ x: -1800, y: 100, width: 380, height: 260 });
    expect(
      resolveFloatingBounds({ position: 'custom', x: -2050, y: -40 }, displays, displays[1]),
    ).toEqual({ x: -1920, y: 0, width: 380, height: 260 });
  });

  it('falls back to the primary top-right corner when a saved display disappears', () => {
    const primary = { x: 0, y: 0, width: 1440, height: 900 };
    expect(
      resolveFloatingBounds({ position: 'custom', x: -5000, y: 200 }, [primary], primary),
    ).toEqual(floatingCornerBounds('top-right', primary));
  });
});
