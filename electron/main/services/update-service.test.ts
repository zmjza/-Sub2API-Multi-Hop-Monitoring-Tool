import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import {
  compareSemver,
  REMIND_LATER_DELAY_MS,
  selectAsset,
  UpdateService,
  updateManifestSchema,
  type UpdateManifest,
} from './update-service.js';

const manifest: UpdateManifest = {
  version: '1.4.6',
  channel: 'stable',
  publishedAt: '2026-07-25T00:00:00Z',
  releaseNotes: '真机更新测试专用\n本版本不包含业务功能变化',
  testOnly: true,
  macArm64: {
    url: 'https://github.com/zmjza/-Sub2API-Multi-Hop-Monitoring-Tool/releases/download/1.4.6/a.dmg',
    sha256: 'a'.repeat(64),
  },
  winX64: {
    url: 'https://github.com/zmjza/-Sub2API-Multi-Hop-Monitoring-Tool/releases/download/1.4.6/a.exe',
    sha256: 'b'.repeat(64),
  },
};

describe('update service', () => {
  it('compares strict semver and rejects downgrade', () => {
    expect(compareSemver('1.4.6', '1.4.5')).toBe(1);
    expect(compareSemver('1.4.5', '1.4.6')).toBe(-1);
    expect(compareSemver('1.4.5', '1.4.5')).toBe(0);
    expect(() => compareSemver('1.4', '1.4.5')).toThrow('INVALID_VERSION');
  });
  it('validates stable manifest and returns an available update', async () => {
    expect(updateManifestSchema.parse(manifest).testOnly).toBe(true);
    const fetchImpl = async (url: RequestInfo | URL) =>
      new Response(
        url.toString().includes('api.github.com')
          ? JSON.stringify({
              assets: [
                {
                  name: 'update-manifest.json',
                  browser_download_url:
                    'https://github.com/zmjza/-Sub2API-Multi-Hop-Monitoring-Tool/releases/download/1.4.6/update-manifest.json',
                },
              ],
            })
          : JSON.stringify(manifest),
        { status: 200 },
      );
    const service = new UpdateService(
      '1.4.5',
      { get: (_key, fallback) => fallback, set: () => undefined },
      fetchImpl,
    );
    await expect(service.check()).resolves.toMatchObject({ status: 'available', manifest });
  });
  it('recognizes the published 1.5.2 manifest from a 1.5.1 client', async () => {
    const published = { ...manifest, version: '1.5.2', testOnly: false };
    const fetchImpl = async (url: RequestInfo | URL) =>
      new Response(
        url.toString().includes('api.github.com')
          ? JSON.stringify({
              tag_name: '1.5.2',
              assets: [
                {
                  name: 'update-manifest.json',
                  browser_download_url:
                    'https://github.com/zmjza/-Sub2API-Multi-Hop-Monitoring-Tool/releases/download/1.5.2/update-manifest.json',
                },
              ],
            })
          : JSON.stringify(published),
        { status: 200 },
      );
    const service = new UpdateService(
      '1.5.1',
      { get: (_key, fallback) => fallback, set: () => undefined },
      fetchImpl,
    );
    await expect(service.check()).resolves.toMatchObject({
      status: 'available',
      manifest: published,
    });
  });
  it('bypasses cached GitHub latest release responses', async () => {
    const requestUrls: string[] = [];
    const fetchImpl = async (url: RequestInfo | URL) => {
      requestUrls.push(url.toString());
      return new Response(
        JSON.stringify({
          assets: [
            {
              name: 'update-manifest.json',
              browser_download_url:
                'https://github.com/zmjza/-Sub2API-Multi-Hop-Monitoring-Tool/releases/download/1.4.6/update-manifest.json',
            },
          ],
        }),
        { status: 200 },
      );
    };
    const service = new UpdateService(
      '1.4.5',
      { get: (_key, fallback) => fallback, set: () => undefined },
      fetchImpl,
    );
    await service.check();
    expect(requestUrls[0]).toMatch(/releases\/latest\?cacheBust=\d+/);
  });
  it('uses single-flight for concurrent checks', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response('[]');
    };
    const service = new UpdateService(
      '1.4.5',
      { get: (_key, fallback) => fallback, set: () => undefined },
      fetchImpl,
    );
    await Promise.all([service.check(), service.check()]);
    expect(calls).toBe(1);
  });
  it('rejects update assets outside the fixed GitHub HTTPS host', () => {
    expect(() =>
      selectAsset(
        { ...manifest, macArm64: { ...manifest.macArm64, url: 'https://example.com/update.dmg' } },
        'darwin',
        'arm64',
      ),
    ).toThrow('ASSET_HOST_NOT_ALLOWED');
  });
  it('suppresses a reminded version until its reminder time expires', async () => {
    const state = new Map<string, unknown>([
      ['update:remindVersion', '1.4.6'],
      ['update:remindAt', Date.now() + 60_000],
    ]);
    const fetchImpl = async (url: RequestInfo | URL) =>
      new Response(
        url.toString().includes('api.github.com')
          ? JSON.stringify({
              assets: [
                {
                  name: 'update-manifest.json',
                  browser_download_url:
                    'https://github.com/zmjza/-Sub2API-Multi-Hop-Monitoring-Tool/releases/download/1.4.6/update-manifest.json',
                },
              ],
            })
          : JSON.stringify(manifest),
      );
    const service = new UpdateService(
      '1.4.5',
      {
        get: (key, fallback) => (state.has(key) ? (state.get(key) as typeof fallback) : fallback),
        set: () => undefined,
      },
      fetchImpl,
    );
    await expect(service.check()).resolves.toMatchObject({ status: 'skipped' });
  });
  it('schedules a later reminder in the future', () => {
    const state = new Map<string, unknown>();
    const service = new UpdateService('1.4.5', {
      get: (key, fallback) => (state.has(key) ? (state.get(key) as typeof fallback) : fallback),
      set: (key, value) => state.set(key, value),
    });
    const before = Date.now();
    service.remindLater('1.4.6');
    expect(state.get('update:remindVersion')).toBe('1.4.6');
    expect(state.get('update:remindAt')).toBeGreaterThanOrEqual(before + REMIND_LATER_DELAY_MS);
  });
  it('downloads and verifies the selected platform asset', async () => {
    const payload = new TextEncoder().encode('update-bytes');
    const digest = createHash('sha256').update(payload).digest('hex');
    const downloadManifest: UpdateManifest = {
      ...manifest,
      macArm64: { ...manifest.macArm64, sha256: digest },
    };
    const fetchImpl = async (url: RequestInfo | URL) =>
      new Response(url.toString().includes('.dmg') ? payload : JSON.stringify([]));
    const service = new UpdateService(
      '1.4.5',
      { get: (_key, fallback) => fallback, set: () => undefined },
      fetchImpl,
      'darwin',
      'arm64',
    );
    const result = await service.download(downloadManifest);
    expect(result.filePath).toMatch(/sub2api-update-1\.4\.6\.dmg$/);
    await service.cleanup();
  });

  it('cleans up a partial file when the download stream fails', async () => {
    const fetchImpl = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('partial'));
            queueMicrotask(() => controller.error(new Error('CONNECTION_RESET')));
          },
        }),
        { status: 200 },
      );
    const service = new UpdateService(
      '1.4.5',
      { get: (_key, fallback) => fallback, set: () => undefined },
      fetchImpl,
      'darwin',
      'arm64',
    );
    const filePath = `/tmp/sub2api-update-${manifest.version}.dmg`;
    await expect(service.download(manifest)).rejects.toThrow('CONNECTION_RESET');
    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it('retries a transient download failure before returning an error', async () => {
    const payload = new TextEncoder().encode('retry-success');
    const digest = createHash('sha256').update(payload).digest('hex');
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('ECONNRESET');
      return new Response(payload, { status: 200 });
    };
    const service = new UpdateService(
      '1.4.5',
      { get: (_key, fallback) => fallback, set: () => undefined },
      fetchImpl,
      'darwin',
      'arm64',
    );
    const result = await service.download({
      ...manifest,
      macArm64: { ...manifest.macArm64, sha256: digest },
    });
    expect(attempts).toBe(2);
    await service.cleanup();
    expect(result.filePath).toMatch(/sub2api-update-1\.4\.6\.dmg$/);
  });
});
