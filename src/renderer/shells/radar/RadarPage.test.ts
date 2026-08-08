import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('Radar embedded entry page', () => {
  it('keeps the renderer free of the retired public data fetch', () => {
    const source = readFileSync(fileURLToPath(new URL('./RadarPage.tsx', import.meta.url)), 'utf8');

    expect(source).not.toContain('current.json');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('model_iq');
    expect(source).not.toContain('RADAR_TARGET_IDS');
    expect(source).not.toContain('RADAR_TARGETS');
    expect(source).toContain('onOpen(entry)');
    expect(source).toContain('radar.list()');
    expect(source).toContain('radar.create(');
    expect(source).toContain('radar.delete(');
    expect(source).toContain('radar-target-open');
    expect(source).toContain('radar-target-delete');
    expect(source).not.toContain('window.confirm');
  });

  it('uses an app-owned close action for the embedded page', () => {
    const appSource = readFileSync(
      fileURLToPath(new URL('../../App.tsx', import.meta.url)),
      'utf8',
    );

    expect(appSource).toContain('关闭雷达网页');
    expect(appSource).toContain('window.sub2apiDesktop?.radar');
    expect(appSource).toContain('radar.open(entry.id)');
    expect(appSource).toContain('radar.close()');
    expect(appSource).toContain("event.key === 'Escape'");
  });

  it('keeps add and delete interactions in app-owned dialogs', () => {
    const source = readFileSync(fileURLToPath(new URL('./RadarPage.tsx', import.meta.url)), 'utf8');

    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('新增雷达站点');
    expect(source).toContain('确认删除');
    expect(source).toContain('radar-danger-action');
    expect(source).toContain('radar-dialog-backdrop');
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
