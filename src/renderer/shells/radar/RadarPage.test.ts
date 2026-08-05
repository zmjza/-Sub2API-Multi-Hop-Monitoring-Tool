import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('Radar embedded entry page', () => {
  it('keeps the renderer free of the retired public data fetch', () => {
    const source = readFileSync(fileURLToPath(new URL('./RadarPage.tsx', import.meta.url)), 'utf8');

    expect(source).not.toContain('current.json');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('model_iq');
    expect(source).toContain('RADAR_TARGET_IDS');
    expect(source).toContain('RADAR_TARGETS');
    expect(source).toContain('onOpen(targetId)');
  });

  it('uses an app-owned close action for the embedded page', () => {
    const appSource = readFileSync(
      fileURLToPath(new URL('../../App.tsx', import.meta.url)),
      'utf8',
    );

    expect(appSource).toContain('关闭雷达网页');
    expect(appSource).toContain('window.sub2apiDesktop?.radar');
    expect(appSource).toContain('radar.open(targetId)');
    expect(appSource).toContain('radar.close()');
    expect(appSource).toContain("event.key === 'Escape'");
  });

  it('does not grant the renderer a wildcard external connection policy', () => {
    const html = readFileSync(
      fileURLToPath(new URL('../../../../index.html', import.meta.url)),
      'utf8',
    );

    expect(html).not.toContain('connect-src *');
    expect(html).not.toContain('https://codexradar.com');
  });
});
