import { isIP } from 'node:net';
import path from 'node:path';
import type { InteractiveTokens } from './interactive-auth-policy.js';

export interface ChromeAuthStorage {
  origin: string;
  localStorage: Record<string, unknown>;
  sessionStorage: Record<string, unknown>;
}

const accessKeys = ['accessToken', 'access_token', 'auth_token'] as const;
const refreshKeys = ['refreshToken', 'refresh_token'] as const;

export function chromeExecutableCandidates(
  platform: NodeJS.Platform,
  homeDir: string,
  environment: NodeJS.ProcessEnv = process.env,
): string[] {
  if (platform === 'darwin') {
    return unique([
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      path.posix.join(homeDir, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      path.posix.join(
        homeDir,
        'Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      ),
    ]);
  }
  if (platform === 'win32') {
    const localAppData = environment.LOCALAPPDATA ?? path.win32.join(homeDir, 'AppData', 'Local');
    const programFiles = environment.ProgramFiles ?? 'C:\\Program Files';
    const programFilesX86 = environment['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
    return unique([
      path.win32.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.win32.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.win32.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ]);
  }
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
}

export function buildChromeLaunchArgs(
  origin: string,
  profileDirectory: string,
  port: number,
): string[] {
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error('CHROME_CDP_PORT_INVALID');
  const loginUrl = new URL(origin);
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.hash = '';
  return [
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDirectory}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    loginUrl.toString(),
  ];
}

export function isLoopbackAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) {
    const first = Number(address.split('.')[0]);
    return first === 127;
  }
  return kind === 6 && address === '::1';
}

export function isAllowedChromeTarget(expectedOrigin: string, targetUrl: string): boolean {
  try {
    return new URL(expectedOrigin).origin === new URL(targetUrl).origin;
  } catch {
    return false;
  }
}

export function extractChromeAuthTokens(
  storage: ChromeAuthStorage,
  expectedOrigin: string,
): InteractiveTokens | undefined {
  if (!isAllowedChromeTarget(expectedOrigin, storage.origin)) return undefined;
  const accessToken =
    firstString(storage.localStorage, accessKeys) ??
    firstString(storage.sessionStorage, accessKeys);
  if (!accessToken) return undefined;
  const refreshToken =
    firstString(storage.localStorage, refreshKeys) ??
    firstString(storage.sessionStorage, refreshKeys);
  return refreshToken ? { accessToken, refreshToken } : { accessToken };
}

export function chromeStorageInspectionScript(): string {
  return `(() => {
    const allow = new Set(['accessToken', 'access_token', 'auth_token', 'refreshToken', 'refresh_token']);
    const read = (storage) => {
      const result = {};
      for (const key of allow) {
        const value = storage.getItem(key);
        if (value !== null) result[key] = value;
      }
      return result;
    };
    return {
      origin: window.location.origin,
      localStorage: read(window.localStorage),
      sessionStorage: read(window.sessionStorage),
    };
  })()`;
}

function firstString(value: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.length > 0 && candidate.length <= 32_768)
      return candidate;
  }
  return undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
