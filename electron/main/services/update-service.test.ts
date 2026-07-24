import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  compareSemver,
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
  macArm64: { url: 'https://gitee.com/a.dmg', sha256: 'a'.repeat(64) },
  winX64: { url: 'https://gitee.com/a.exe', sha256: 'b'.repeat(64) },
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
        url.toString().includes('releases?')
          ? JSON.stringify([
              {
                assets: [
                  {
                    name: 'update-manifest.json',
                    browser_download_url: 'https://gitee.com/manifest.json',
                  },
                ],
              },
            ])
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
  it('rejects update assets outside the fixed Gitee HTTPS host', () => {
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
        url.toString().includes('releases?')
          ? JSON.stringify([
              {
                assets: [
                  {
                    name: 'update-manifest.json',
                    browser_download_url: 'https://gitee.com/manifest.json',
                  },
                ],
              },
            ])
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
});
