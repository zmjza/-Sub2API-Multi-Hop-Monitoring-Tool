/* global Blob, FormData, URL, URLSearchParams, console, fetch, process */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = 'zarq/Sub2API-Multi-Hub-Monitoring-Tool';
const releaseDir = path.join(root, 'release');
const maxGiteeAssetBytes = 100_000_000;

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

async function run(command, args) {
  await execFileAsync(command, args, { cwd: root, env: process.env, maxBuffer: 10 * 1024 * 1024 });
}

async function ensureVersionTag(version) {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['rev-parse', '--verify', `refs/tags/${version}`],
      { cwd: root },
    );
    if (stdout.trim()) return;
  } catch {
    await run('git', ['tag', version]);
    await run('git', ['push', 'origin', version]);
    return;
  }
  throw new Error(`本地已存在版本标签 ${version}，请递增 package.json 版本后再发布`);
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
      'sub2api-gitee-release-token',
      '-w',
    ]);
    const token = stdout.trim();
    if (token) return token;
  } catch {
    // Convert the platform-specific keychain failure into an actionable message.
  }
  throw new Error('找不到 macOS Keychain 项 sub2api-gitee-release-token');
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  hash.update(await fs.readFile(filePath));
  return hash.digest('hex');
}

function giteeUrl(version, fileName) {
  return `https://gitee.com/${repository}/releases/download/${version}/${encodeURIComponent(fileName)}`;
}

async function giteeRequest(token, endpoint, init = {}) {
  const url = new URL(`https://gitee.com/api/v5${endpoint}`);
  url.searchParams.set('access_token', token);
  const response = await fetch(url, init);
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!response.ok) throw new Error(`Gitee API ${response.status}: ${data?.message ?? data}`);
  return data;
}

async function createRelease(token, version, notes) {
  const existing = await giteeRequest(token, `/repos/${repository}/releases?per_page=100`);
  const found = Array.isArray(existing)
    ? existing.find((release) => release.tag_name === version)
    : undefined;
  if (found) throw new Error(`Gitee Release ${version} 已存在，请递增版本号后再发布`);
  const body = new URLSearchParams({
    tag_name: version,
    target_commitish: version,
    name: `${version} ${notes.includes('真机更新测试专用') ? '真机更新测试专用' : '稳定版'}`,
    body: notes,
  });
  return giteeRequest(token, `/repos/${repository}/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

async function uploadAsset(token, releaseId, filePath) {
  const form = new FormData();
  form.set('access_token', token);
  form.set('file', new Blob([await fs.readFile(filePath)]), path.basename(filePath));
  const response = await fetch(
    `https://gitee.com/api/v5/repos/${repository}/releases/${releaseId}/attach_files`,
    { method: 'POST', body: form },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(`上传 ${path.basename(filePath)} 失败：${data?.message ?? response.status}`);
  return data;
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
    if (stat.size > maxGiteeAssetBytes)
      throw new Error(
        `${path.basename(filePath)} 为 ${stat.size} bytes，超过 Gitee 100,000,000 bytes 限制`,
      );
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
      url: giteeUrl(version, macName),
      sha256: await sha256(path.join(releaseDir, macName)),
    },
    winX64: {
      url: giteeUrl(version, winName),
      sha256: await sha256(path.join(releaseDir, winName)),
    },
    blockmap: giteeUrl(version, names[1]),
  };
  await fs.writeFile(
    path.join(releaseDir, 'update-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  const files = names.map((name) => path.join(releaseDir, name));
  await ensureVersionTag(version);
  const release = await createRelease(token, version, notes);
  for (const filePath of files) {
    const uploaded = await uploadAsset(token, release.id, filePath);
    console.log(`已上传 ${uploaded.name ?? path.basename(filePath)}`);
  }
  const remote = await giteeRequest(token, `/repos/${repository}/releases/${release.id}`);
  const remoteNames = new Set((remote.assets ?? []).map((asset) => asset.name));
  for (const name of names)
    if (!remoteNames.has(name)) throw new Error(`远程 Release 缺少 ${name}`);
  console.log(`发布完成：https://gitee.com/${repository}/releases/tag/${version}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
