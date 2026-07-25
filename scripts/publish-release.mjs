/* global URL, console, fetch, process, setTimeout */

import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createReadStream, promises as fs } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = 'zmjza/-Sub2API-Multi-Hop-Monitoring-Tool';
const releaseDir = path.join(root, 'release');

export function validateVersion(value) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value))
    throw new Error(`版本必须是 SemVer，例如 1.4.7：${value}`);
  return value;
}

export function parseArgs(argv) {
  let notes = '';
  let testOnly = false;
  let dryRun = false;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--notes') {
      notes = argv[index + 1]?.trim() ?? '';
      index += 1;
    } else if (value === '--test-only') testOnly = true;
    else if (value === '--dry-run') dryRun = true;
    else throw new Error(`未知参数：${value}`);
  }
  if (!notes) throw new Error('必须提供 --notes "本次更新说明"');
  return { notes, testOnly, dryRun };
}

export function assetNames(version) {
  return [
    `Sub2API-Multi-Hub-Monitor-${version}-mac-arm64.dmg`,
    `Sub2API-Multi-Hub-Monitor-${version}-mac-arm64.dmg.blockmap`,
    `Sub2API-Multi-Hub-Monitor-${version}-win-x64.exe`,
    `Sub2API-Multi-Hub-Monitor-${version}-win-x64.exe.blockmap`,
    'update-manifest.json',
  ];
}

async function cleanupReleaseArtifacts() {
  const entries = await fs.readdir(releaseDir, { withFileTypes: true }).catch(() => []);
  const packagePattern = /^Sub2API-Multi-Hub-Monitor-.*\.(?:dmg|exe)(?:\.blockmap)?$/;
  const removable = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        (packagePattern.test(entry.name) || entry.name === 'update-manifest.json'),
    )
    .map((entry) => path.join(releaseDir, entry.name));
  await Promise.all(removable.map((filePath) => fs.rm(filePath, { force: true })));
  return removable.length;
}

async function run(command, args) {
  await execFileAsync(command, args, { cwd: root, env: process.env, maxBuffer: 10 * 1024 * 1024 });
}

async function ensureVersionTag(version) {
  let tagCommit;
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['rev-parse', '--verify', `refs/tags/${version}`],
      { cwd: root },
    );
    tagCommit = stdout.trim();
  } catch {
    await run('git', ['tag', version]);
    await run('git', ['push', 'github', version]);
    return;
  }
  const { stdout: headStdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root });
  if (tagCommit === headStdout.trim()) return;
  throw new Error(`版本标签 ${version} 已存在但不是当前提交，请递增版本号后再发布`);
}

async function ensureCleanTree() {
  const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: root });
  if (stdout.trim()) throw new Error('发布前工作区必须干净，请先提交源码、CHANGELOG 和版本变更');
}

async function readPackage() {
  return JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
}

async function readToken() {
  try {
    const { stdout } = await execFileAsync('security', [
      'find-generic-password',
      '-a',
      process.env.USER ?? '',
      '-s',
      'sub2api-github-release-token',
      '-w',
    ]);
    const token = stdout.trim();
    if (token) return token;
  } catch {
    // Convert the platform-specific keychain failure into an actionable message.
  }
  throw new Error('找不到 macOS Keychain 项 sub2api-github-release-token');
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  hash.update(await fs.readFile(filePath));
  return hash.digest('hex');
}

function githubUrl(version, fileName) {
  return `https://github.com/${repository}/releases/download/${version}/${encodeURIComponent(fileName)}`;
}

async function githubRequest(token, endpoint, init = {}) {
  const url = new URL(`https://api.github.com${endpoint}`);
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${data?.message ?? data}`);
  return data;
}

async function createRelease(token, version, notes) {
  const existing = await githubRequest(token, `/repos/${repository}/releases?per_page=100`);
  const found = Array.isArray(existing)
    ? existing.find((release) => release.tag_name === version)
    : undefined;
  if (found) {
    console.log(`复用已有 GitHub Release ${version}`);
    return found;
  }
  return githubRequest(token, `/repos/${repository}/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: version,
      target_commitish: 'main',
      name: `${version} ${notes.includes('真机更新测试专用') ? '真机更新测试专用' : '稳定版'}`,
      body: notes,
      draft: false,
      prerelease: false,
    }),
  });
}

async function uploadAsset(token, releaseId, filePath) {
  const fileName = path.basename(filePath);
  const stat = await fs.stat(filePath);
  const url = new URL(
    `https://uploads.github.com/repos/${repository}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`,
  );
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await new Promise((resolve, reject) => {
        const request = httpsRequest(
          url,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
              'Content-Type': 'application/octet-stream',
              'Content-Length': stat.size,
              'User-Agent': 'sub2api-release-publisher',
            },
          },
          (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
              const text = Buffer.concat(chunks).toString('utf8');
              let data;
              try {
                data = text ? JSON.parse(text) : undefined;
              } catch {
                data = text;
              }
              if ((response.statusCode ?? 500) >= 400)
                reject(
                  new Error(
                    `上传 ${fileName} 失败：${data?.message ?? response.statusCode ?? '未知错误'}`,
                  ),
                );
              else resolve(data);
            });
          },
        );
        request.on('error', reject);
        createReadStream(filePath)
          .on('error', (error) => request.destroy(error))
          .pipe(request);
      });
    } catch (error) {
      if (attempt === 3) throw error;
      console.log(`上传 ${fileName} 失败，正在重试（${attempt}/3）`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  throw new Error(`上传 ${fileName} 失败`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const packageJson = await readPackage();
  const version = validateVersion(packageJson.version);
  const changelog = await fs.readFile(path.join(root, 'CHANGELOG.md'), 'utf8');
  if (!changelog.includes(`## ${version}`))
    throw new Error(`CHANGELOG.md 缺少 ## ${version} 条目，先补充更新说明再发布`);
  if (args.dryRun) {
    console.log(`发布检查通过：${version}，将上传 macOS ARM64 + Windows x64 双平台资产`);
    return;
  }

  await ensureCleanTree();
  const token = await readToken();
  await run('npm', ['run', 'dist:mac']);
  await run('npm', ['run', 'dist:win']);
  const names = assetNames(version);
  const binaryFiles = names.slice(0, 4).map((name) => path.join(releaseDir, name));
  for (const filePath of binaryFiles) {
    const stat = await fs.stat(filePath).catch(() => undefined);
    if (!stat?.isFile()) throw new Error(`缺少发布文件：${path.relative(root, filePath)}`);
  }
  const notes = args.testOnly
    ? `${args.notes}\n\n真机更新测试专用\n本版本不包含业务功能变化。`
    : args.notes;
  const macName = names[0];
  const winName = names[2];
  const manifest = {
    version,
    channel: 'stable',
    publishedAt: new Date().toISOString(),
    releaseNotes: notes,
    testOnly: args.testOnly,
    macArm64: {
      url: githubUrl(version, macName),
      sha256: await sha256(path.join(releaseDir, macName)),
    },
    winX64: {
      url: githubUrl(version, winName),
      sha256: await sha256(path.join(releaseDir, winName)),
    },
    blockmap: githubUrl(version, names[1]),
  };
  await fs.writeFile(
    path.join(releaseDir, 'update-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  const files = names.map((name) => path.join(releaseDir, name));
  await ensureVersionTag(version);
  const release = await createRelease(token, version, notes);
  const existingNames = new Set((release.assets ?? []).map((asset) => asset.name));
  for (const filePath of files) {
    if (existingNames.has(path.basename(filePath))) {
      console.log(`已存在，跳过 ${path.basename(filePath)}`);
      continue;
    }
    const uploaded = await uploadAsset(token, release.id, filePath);
    console.log(`已上传 ${uploaded.name ?? path.basename(filePath)}`);
  }
  const remote = await githubRequest(token, `/repos/${repository}/releases/${release.id}`);
  const remoteNames = new Set((remote.assets ?? []).map((asset) => asset.name));
  for (const filePath of files) {
    const name = path.basename(filePath);
    if (!remoteNames.has(name)) throw new Error(`远程 Release 缺少 ${name}`);
  }
  const cleaned = await cleanupReleaseArtifacts();
  console.log(`已清理本地发布产物：${cleaned} 个文件`);
  console.log(`发布完成：https://github.com/${repository}/releases/tag/${version}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(async (error) => {
    await cleanupReleaseArtifacts().catch(() => undefined);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
