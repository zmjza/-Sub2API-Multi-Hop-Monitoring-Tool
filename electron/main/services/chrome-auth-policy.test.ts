import { describe, expect, it } from 'vitest';
import {
  buildChromeLaunchArgs,
  chromeExecutableCandidates,
  chromeStorageInspectionScript,
  extractChromeAuthTokens,
  isAllowedChromeTarget,
  isLoopbackAddress,
  type ChromeAuthStorage,
} from './chrome-auth-policy.js';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import {
  runChromeInteractiveAuthentication,
  type ChromeAuthDependencies,
} from './chrome-auth-window.js';

describe('chrome interactive authentication policy', () => {
  it('lists platform-specific Chrome candidates without using the daily profile', () => {
    expect(chromeExecutableCandidates('darwin', '/Users/tester')).toContain(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    );
    expect(chromeExecutableCandidates('win32', 'C:\\Users\\tester')).toContain(
      'C:\\Users\\tester\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
    );
  });

  it('builds a visible loopback CDP launch with an isolated profile', () => {
    const args = buildChromeLaunchArgs('https://ai.maok.shop', '/tmp/sub2api-chrome-unique', 43123);
    expect(args).toEqual([
      '--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=43123',
      '--user-data-dir=/tmp/sub2api-chrome-unique',
      '--no-first-run',
      '--no-default-browser-check',
      '--new-window',
      'https://ai.maok.shop/login',
    ]);
    expect(args.join(' ')).not.toContain('--headless');
    expect(args.join(' ')).not.toContain('AutomationControlled');
  });

  it('accepts only a loopback CDP address and same-origin page', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('::1')).toBe(true);
    expect(isLoopbackAddress('192.168.1.10')).toBe(false);
    expect(isAllowedChromeTarget('https://ai.maok.shop', 'https://ai.maok.shop/login')).toBe(true);
    expect(isAllowedChromeTarget('https://ai.maok.shop', 'https://evil.example/login')).toBe(false);
    expect(isAllowedChromeTarget('https://ai.maok.shop', 'https://ai.maok.shop.evil/login')).toBe(
      false,
    );
  });

  it('extracts only the approved bearer fields from storage', () => {
    const storage: ChromeAuthStorage = {
      origin: 'https://ai.maok.shop',
      localStorage: {
        access_token: 'access-value',
        refresh_token: 'refresh-value',
        password: 'must-not-read',
      },
      sessionStorage: { arbitrary: 'must-not-read' },
    };
    expect(extractChromeAuthTokens(storage, 'https://ai.maok.shop')).toEqual({
      accessToken: 'access-value',
      refreshToken: 'refresh-value',
    });
  });

  it('does not scan arbitrary storage values or accept another origin', () => {
    expect(
      extractChromeAuthTokens(
        {
          origin: 'https://evil.example',
          localStorage: { auth: JSON.stringify({ accessToken: 'must-not-read' }) },
          sessionStorage: {},
        },
        'https://ai.maok.shop',
      ),
    ).toBeUndefined();
    expect(
      extractChromeAuthTokens(
        {
          origin: 'https://ai.maok.shop',
          localStorage: { unrelated: JSON.stringify({ accessToken: 'must-not-read' }) },
          sessionStorage: {},
        },
        'https://ai.maok.shop',
      ),
    ).toBeUndefined();
  });

  it('does not inspect cookies when the site exposes no supported bearer token', () => {
    expect(
      extractChromeAuthTokens(
        {
          origin: 'https://ai.maok.shop',
          localStorage: {},
          sessionStorage: {},
        },
        'https://ai.maok.shop',
      ),
    ).toBeUndefined();
    const script = chromeStorageInspectionScript();
    expect(script).not.toContain('document.cookie');
    expect(script).not.toContain('Network.getAllCookies');
  });

  it('keeps the password out of Chrome arguments and removes the temporary profile', async () => {
    const child = new EventEmitter() as EventEmitter & { pid?: number; kill: () => void };
    child.pid = 9999;
    child.kill = () => {
      child.emit('exit', 0, null);
    };
    const removed: string[] = [];
    let launchedArgs: string[] = [];
    const connection = {
      send: async () => ({
        result: {
          value: {
            origin: 'https://ai.maok.shop',
            localStorage: { access_token: 'access-value' },
            sessionStorage: {},
          },
        },
      }),
      close: () => undefined,
    };
    const deps: ChromeAuthDependencies = {
      platform: 'darwin',
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      exists: async () => true,
      createProfile: async () => '/tmp/sub2api-chrome-test',
      allocatePort: async () => 43210,
      launch: (_path, args) => {
        launchedArgs = args;
        return child as unknown as ChildProcess;
      },
      fetchJson: async () => [
        {
          type: 'page',
          url: 'https://ai.maok.shop/login',
          webSocketDebuggerUrl: 'ws://127.0.0.1:43210/devtools/page/test',
        },
      ],
      connect: async () => connection,
      removeProfile: async (directory) => {
        removed.push(directory);
      },
      sleep: async () => undefined,
    };
    await expect(
      runChromeInteractiveAuthentication(
        {
          name: '站点',
          url: 'https://ai.maok.shop',
          account: 'account@example.com',
          password: 'runtime-password',
        },
        async (tokens) => tokens.accessToken,
        1_000,
        deps,
      ),
    ).resolves.toBe('access-value');
    expect(launchedArgs.join(' ')).not.toContain('runtime-password');
    expect(removed).toEqual(['/tmp/sub2api-chrome-test']);
  });

  it('reports missing Chrome and does not create a profile', async () => {
    let created = false;
    await expect(
      runChromeInteractiveAuthentication(
        { name: '站点', url: 'https://ai.maok.shop', account: 'a', password: 'p' },
        async () => undefined,
        500,
        {
          platform: 'darwin',
          exists: async () => false,
          createProfile: async () => {
            created = true;
            return '/tmp/unused';
          },
        },
      ),
    ).rejects.toMatchObject({ code: 'CHROME_NOT_INSTALLED' });
    expect(created).toBe(false);
  });

  it('cleans the profile after CDP failure and never saves a site', async () => {
    const child = new EventEmitter() as EventEmitter & { pid?: number; kill: () => void };
    child.pid = 10001;
    child.kill = () => child.emit('exit', 0, null);
    const removed: string[] = [];
    await expect(
      runChromeInteractiveAuthentication(
        { name: '站点', url: 'https://ai.maok.shop', account: 'a', password: 'p' },
        async () => {
          throw new Error('must not validate');
        },
        1_000,
        {
          platform: 'darwin',
          executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          exists: async () => true,
          createProfile: async () => '/tmp/cdp-failure',
          allocatePort: async () => 43211,
          launch: () => child as unknown as ChildProcess,
          fetchJson: async () => [
            {
              type: 'page',
              url: 'https://ai.maok.shop/login',
              webSocketDebuggerUrl: 'ws://127.0.0.1:43211/devtools/page/test',
            },
          ],
          connect: async () => Promise.reject(new Error('closed')),
          removeProfile: async (directory) => {
            removed.push(directory);
          },
          sleep: async () => undefined,
        },
      ),
    ).rejects.toMatchObject({ code: 'CHROME_CDP_UNAVAILABLE' });
    expect(removed).toEqual(['/tmp/cdp-failure']);
  });

  it('rejects a non-site CDP target before reading storage', async () => {
    const child = new EventEmitter() as EventEmitter & { pid?: number; kill: () => void };
    child.pid = 10002;
    child.kill = () => child.emit('exit', 0, null);
    await expect(
      runChromeInteractiveAuthentication(
        { name: '站点', url: 'https://ai.maok.shop', account: 'a', password: 'p' },
        async () => 'must not run',
        1_000,
        {
          platform: 'darwin',
          executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          exists: async () => true,
          createProfile: async () => '/tmp/origin-blocked',
          allocatePort: async () => 43212,
          launch: () => child as unknown as ChildProcess,
          fetchJson: async () => [
            { type: 'page', url: 'https://evil.example/login', webSocketDebuggerUrl: 'ws://evil' },
          ],
          removeProfile: async () => undefined,
          sleep: async () => undefined,
        },
      ),
    ).rejects.toMatchObject({ code: 'CHROME_AUTH_ORIGIN_BLOCKED' });
  });
});
