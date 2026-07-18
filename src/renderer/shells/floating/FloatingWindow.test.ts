import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
});
