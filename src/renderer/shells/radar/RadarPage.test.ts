import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('Radar public data access', () => {
  it('allows only the Codex Radar HTTPS origin through the renderer CSP', () => {
    const html = readFileSync(
      fileURLToPath(new URL('../../../../index.html', import.meta.url)),
      'utf8',
    );

    expect(html).toContain(
      "connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:* https://codexradar.com",
    );
    expect(html).not.toContain('connect-src *');
  });
});
