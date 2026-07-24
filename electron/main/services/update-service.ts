import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';

export const updateManifestSchema = z
  .object({
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    channel: z.literal('stable'),
    publishedAt: z.string().min(1),
    releaseNotes: z.string().max(20_000),
    testOnly: z.boolean(),
    macArm64: z.object({ url: z.string().url(), sha256: z.string().regex(/^[a-fA-F0-9]{64}$/) }),
    winX64: z.object({ url: z.string().url(), sha256: z.string().regex(/^[a-fA-F0-9]{64}$/) }),
    blockmap: z.string().url().optional(),
  })
  .strict();
export type UpdateManifest = z.infer<typeof updateManifestSchema>;

export type UpdateCheckResult =
  | { status: 'up-to-date'; currentVersion: string }
  | { status: 'available'; currentVersion: string; manifest: UpdateManifest }
  | { status: 'skipped'; currentVersion: string; manifest: UpdateManifest }
  | { status: 'error'; code: string; message: string };

export function compareSemver(a: string, b: string): number {
  const parse = (value: string) => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value);
    if (!match) throw new Error('INVALID_VERSION');
    return {
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3]),
      pre: match[4],
    };
  };
  const left = parse(a);
  const right = parse(b);
  for (const key of ['major', 'minor', 'patch'] as const)
    if (left[key] !== right[key]) return left[key] > right[key] ? 1 : -1;
  if (!left.pre && !right.pre) return 0;
  if (!left.pre) return 1;
  if (!right.pre) return -1;
  const l = left.pre.split('.');
  const r = right.pre.split('.');
  for (let i = 0; i < Math.max(l.length, r.length); i++) {
    if (l[i] === undefined) return -1;
    if (r[i] === undefined) return 1;
    if (l[i] === r[i]) continue;
    const ln = /^\d+$/.test(l[i]);
    const rn = /^\d+$/.test(r[i]);
    if (ln && rn) return Number(l[i]) > Number(r[i]) ? 1 : -1;
    if (ln !== rn) return ln ? -1 : 1;
    return l[i] > r[i] ? 1 : -1;
  }
  return 0;
}

export function selectAsset(manifest: UpdateManifest, platform: NodeJS.Platform, arch: string) {
  const asset =
    platform === 'darwin' && arch === 'arm64'
      ? manifest.macArm64
      : platform === 'win32' && arch === 'x64'
        ? manifest.winX64
        : undefined;
  if (asset) {
    const url = new URL(asset.url);
    if (url.protocol !== 'https:' || url.hostname !== 'gitee.com')
      throw new Error('ASSET_HOST_NOT_ALLOWED');
    return asset;
  }
  throw new Error('PLATFORM_UNSUPPORTED');
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const input = (await import('node:fs')).createReadStream(filePath);
  for await (const chunk of input) hash.update(chunk);
  return hash.digest('hex');
}

export class UpdateService {
  private inFlight?: Promise<UpdateCheckResult>;
  private tempFile?: string;
  constructor(
    private readonly currentVersion: string,
    private readonly state: {
      get<T>(key: string, fallback: T): T;
      set<T>(key: string, value: T): void;
    },
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly platform = process.platform,
    private readonly arch = process.arch,
    private readonly timeoutMs = 15_000,
  ) {}

  check(): Promise<UpdateCheckResult> {
    if (!this.inFlight)
      this.inFlight = this.checkInternal().finally(() => {
        this.inFlight = undefined;
      });
    return this.inFlight;
  }

  private async checkInternal(): Promise<UpdateCheckResult> {
    try {
      const response = await this.fetchWithTimeout(
        'https://gitee.com/api/v5/repos/zarq/Sub2API-Multi-Hub-Monitoring-Tool/releases?per_page=1',
        { headers: { Accept: 'application/json' } },
      );
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const releases = (await response.json()) as unknown;
      if (!Array.isArray(releases) || releases.length === 0)
        return { status: 'up-to-date', currentVersion: this.currentVersion };
      const release = releases[0] as {
        assets?: Array<{ name?: string; browser_download_url?: string }>;
      };
      const asset = release.assets?.find(
        (item) => item.name === 'update-manifest.json' && item.browser_download_url,
      );
      if (!asset?.browser_download_url) throw new Error('MANIFEST_NOT_FOUND');
      const manifestUrl = new URL(asset.browser_download_url);
      if (manifestUrl.protocol !== 'https:' || manifestUrl.hostname !== 'gitee.com')
        throw new Error('MANIFEST_HOST_NOT_ALLOWED');
      const manifestResponse = await this.fetchWithTimeout(manifestUrl);
      if (!manifestResponse.ok) throw new Error(`MANIFEST_HTTP_${manifestResponse.status}`);
      const manifest = updateManifestSchema.parse(await manifestResponse.json());
      if (compareSemver(manifest.version, this.currentVersion) <= 0)
        return { status: 'up-to-date', currentVersion: this.currentVersion };
      const skipped = this.state.get<string | undefined>('update:skippedVersion', undefined);
      const remindVersion = this.state.get<string | undefined>('update:remindVersion', undefined);
      const remindAt = this.state.get<number>('update:remindAt', 0);
      return skipped === manifest.version ||
        (remindVersion === manifest.version && remindAt > Date.now())
        ? { status: 'skipped', currentVersion: this.currentVersion, manifest }
        : { status: 'available', currentVersion: this.currentVersion, manifest };
    } catch (error) {
      return {
        status: 'error',
        code: error instanceof z.ZodError ? 'INVALID_MANIFEST' : 'CHECK_FAILED',
        message: error instanceof Error ? error.message : 'CHECK_FAILED',
      };
    }
  }

  private async fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  skip(version: string) {
    this.state.set('update:skippedVersion', version);
  }
  remindLater(version: string) {
    this.state.set('update:remindVersion', version);
    this.state.set('update:remindAt', Date.now());
  }

  async download(
    manifest: UpdateManifest,
    onProgress?: (value: { received: number; total?: number }) => void,
  ): Promise<{ filePath: string; platform: NodeJS.Platform }> {
    const asset = selectAsset(manifest, this.platform, this.arch);
    const response = await this.fetchWithTimeout(asset.url);
    if (!response.ok || !response.body) throw new Error(`DOWNLOAD_HTTP_${response.status}`);
    const suffix = this.platform === 'darwin' ? '.dmg' : '.exe';
    const filePath = path.join(os.tmpdir(), `sub2api-update-${manifest.version}${suffix}`);
    this.tempFile = filePath;
    let received = 0;
    const total = Number(response.headers.get('content-length') ?? 0) || undefined;
    const stream = new (await import('node:stream')).Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        onProgress?.({ received, total });
        callback(null, chunk);
      },
    });
    await pipeline(
      response.body as unknown as NodeJS.ReadableStream,
      stream,
      createWriteStream(filePath),
    );
    if ((await sha256File(filePath)).toLowerCase() !== asset.sha256.toLowerCase()) {
      await this.cleanup();
      throw new Error('SHA256_MISMATCH');
    }
    return { filePath, platform: this.platform };
  }

  async cleanup() {
    if (this.tempFile) await fs.rm(this.tempFile, { force: true }).catch(() => undefined);
    this.tempFile = undefined;
  }
}
