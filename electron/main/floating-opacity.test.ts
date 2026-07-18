import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('floating window opacity wiring', () => {
  const source = readFileSync(fileURLToPath(new URL('./index.ts', import.meta.url)), 'utf8');

  it('restores the saved opacity when the floating window is created', () => {
    expect(source).toContain('floatingWindow.setOpacity(floatingSettings.opacity / 100)');
  });

  it('applies opacity immediately when floating settings change', () => {
    expect(source).toContain('floatingWindow?.setOpacity(settings.opacity / 100)');
  });
});
