import { describe, expect, it } from 'vitest';
import { floatingCornerBounds } from './window-bounds.js';

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
});
