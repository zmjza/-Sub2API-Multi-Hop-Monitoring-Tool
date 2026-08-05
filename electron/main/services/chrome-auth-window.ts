import { spawn, type ChildProcess } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SiteInput } from '../../shared/contracts.js';
import type { InteractiveTokens } from './interactive-auth-policy.js';
import {
  buildChromeLaunchArgs,
  chromeExecutableCandidates,
  chromeStorageInspectionScript,
  extractChromeAuthTokens,
  isAllowedChromeTarget,
  isLoopbackAddress,
  type ChromeAuthStorage,
} from './chrome-auth-policy.js';

const DEFAULT_TIMEOUT_MS = 5 * 60_000;
const CDP_READY_TIMEOUT_MS = 20_000;
const execFileAsync = promisify(execFile);

interface ChromePageTarget {
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
}

interface ChromeProcess extends ChildProcess {
  pid?: number;
}

interface CdpConnection {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  close(): void;
}

export interface ChromeAuthDependencies {
  platform?: NodeJS.Platform;
  homeDir?: string;
  environment?: NodeJS.ProcessEnv;
  executablePath?: string;
  exists?: (filePath: string) => Promise<boolean>;
  createProfile?: () => Promise<string>;
  allocatePort?: () => Promise<number>;
  launch?: (executablePath: string, args: string[]) => ChromeProcess;
  fetchJson?: (url: string) => Promise<unknown>;
  connect?: (url: string) => Promise<CdpConnection>;
  removeProfile?: (directory: string) => Promise<void>;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}

const activeSessions = new Set<ChromeSessionCleanup>();
let activeAuthentication: Promise<unknown> | undefined;

export class ChromeAuthenticationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ChromeAuthenticationError';
  }
}

/**
 * Opens a real, visible Chrome process with an isolated profile. The browser
 * owns credential entry and the Cloudflare challenge; CDP is only used to
 * read the small authentication allow-list after the user has logged in.
 */
export async function runChromeInteractiveAuthentication<T>(
  input: SiteInput,
  validate: (tokens: InteractiveTokens) => Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  dependencies: ChromeAuthDependencies = {},
): Promise<T> {
  if (activeAuthentication) throw new ChromeAuthenticationError('CHROME_AUTH_ALREADY_RUNNING');
  const run = performChromeInteractiveAuthentication(input, validate, timeoutMs, dependencies);
  activeAuthentication = run;
  try {
    return await run;
  } finally {
    if (activeAuthentication === run) activeAuthentication = undefined;
  }
}

async function performChromeInteractiveAuthentication<T>(
  input: SiteInput,
  validate: (tokens: InteractiveTokens) => Promise<T>,
  timeoutMs: number,
  dependencies: ChromeAuthDependencies,
): Promise<T> {
  const deps = withDefaults(dependencies);
  const origin = new URL(input.url).origin;
  const executablePath = await resolveChromeExecutable(deps);
  if (!executablePath) throw new ChromeAuthenticationError('CHROME_NOT_INSTALLED');

  const profileDirectory = await deps.createProfile!();
  let child: ChromeProcess | undefined;
  let connection: CdpConnection | undefined;
  let exited = false;
  let cleaned = false;
  let sawPostLoginPage = false;
  let launchError: Error | undefined;
  let resolveExit: (() => void) | undefined;
  const exitPromise = new Promise<void>((resolve) => {
    resolveExit = resolve;
  });
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    if (connection) connection.close();
    if (child && !exited) {
      await terminateChromeProcess(child);
      await Promise.race([exitPromise, deps.sleep!(1_000)]);
      if (!exited && child.pid) child.kill('SIGKILL');
    }
    await deps.removeProfile!(profileDirectory);
    activeSessions.delete(cleanup);
  };
  activeSessions.add(cleanup);

  try {
    const port = await deps.allocatePort!();
    const args = buildChromeLaunchArgs(origin, profileDirectory, port);
    child = deps.launch!(executablePath, args);
    child.once('error', (error) => {
      launchError = error instanceof Error ? error : new Error(String(error));
      exited = true;
      resolveExit?.();
    });
    child.once('exit', () => {
      exited = true;
      resolveExit?.();
    });

    const deadline = deps.now!() + timeoutMs;
    const target = await waitForPageTarget(port, origin, deadline, deps, () => exited);
    if (exited)
      throw new ChromeAuthenticationError(launchError ? 'CHROME_START_FAILED' : 'CHROME_CLOSED');
    if (!target.webSocketDebuggerUrl) throw new ChromeAuthenticationError('CHROME_CDP_UNAVAILABLE');
    connection = await deps.connect!(target.webSocketDebuggerUrl).catch(() => {
      throw new ChromeAuthenticationError('CHROME_CDP_UNAVAILABLE');
    });

    while (deps.now!() < deadline) {
      if (exited) throw new ChromeAuthenticationError('CHROME_CLOSED');
      const currentTarget = await findPageTarget(port, origin, deps);
      if (!currentTarget) {
        await deps.sleep!(250);
        continue;
      }
      if (!isAllowedChromeTarget(origin, currentTarget.url ?? ''))
        throw new ChromeAuthenticationError('CHROME_AUTH_ORIGIN_BLOCKED');
      const currentPath = new URL(currentTarget.url ?? origin).pathname;
      if (currentPath !== '/login') sawPostLoginPage = true;
      const result = await connection.send('Runtime.evaluate', {
        expression: chromeStorageInspectionScript(),
        awaitPromise: true,
        returnByValue: true,
      });
      const storage = readEvaluationValue(result);
      const tokens = isChromeAuthStorage(storage)
        ? extractChromeAuthTokens(storage, origin)
        : undefined;
      if (tokens) return await validate(tokens);
      await deps.sleep!(500);
    }
    throw new ChromeAuthenticationError(
      sawPostLoginPage ? 'CHROME_AUTH_TOKEN_NOT_FOUND' : 'CHROME_AUTH_TIMEOUT',
    );
  } catch (error) {
    if (error instanceof ChromeAuthenticationError) throw error;
    if (launchError) throw new ChromeAuthenticationError('CHROME_START_FAILED');
    throw new ChromeAuthenticationError('CHROME_AUTH_FAILED');
  } finally {
    await cleanup();
  }
}

export async function closeAllChromeAuthenticationSessions(): Promise<void> {
  await Promise.all([...activeSessions].map((cleanup) => cleanup()));
}

async function resolveChromeExecutable(deps: ChromeAuthDependencies): Promise<string | undefined> {
  if (deps.executablePath) {
    return (await deps.exists!(deps.executablePath)) ? deps.executablePath : undefined;
  }
  for (const candidate of chromeExecutableCandidates(
    deps.platform!,
    deps.homeDir!,
    deps.environment!,
  )) {
    if (await deps.exists!(candidate)) return candidate;
  }
  return undefined;
}

async function waitForPageTarget(
  port: number,
  origin: string,
  deadline: number,
  deps: ChromeAuthDependencies,
  isExited: () => boolean,
): Promise<ChromePageTarget> {
  const readyDeadline = Math.min(deadline, deps.now!() + CDP_READY_TIMEOUT_MS);
  while (deps.now!() < readyDeadline) {
    if (isExited()) throw new ChromeAuthenticationError('CHROME_CLOSED');
    const target = await findPageTarget(port, origin, deps);
    if (target?.webSocketDebuggerUrl) return target;
    await deps.sleep!(250);
  }
  throw new ChromeAuthenticationError('CHROME_CDP_UNAVAILABLE');
}

async function findPageTarget(
  port: number,
  origin: string,
  deps: ChromeAuthDependencies,
): Promise<ChromePageTarget | undefined> {
  const payload = await deps.fetchJson!(`http://127.0.0.1:${port}/json/list`).catch(
    () => undefined,
  );
  if (!Array.isArray(payload)) return undefined;
  const pages = payload.filter((item): item is ChromePageTarget => {
    if (!item || typeof item !== 'object') return false;
    const target = item as ChromePageTarget;
    return target.type === 'page' && typeof target.url === 'string';
  });
  const sameOrigin = pages.find((page) => isAllowedChromeTarget(origin, page.url ?? ''));
  if (sameOrigin) return sameOrigin;
  if (pages.some((page) => isHttpUrl(page.url) && page.url !== 'about:blank')) {
    const foreign = pages.find(
      (page) => page.url && isHttpUrl(page.url) && !isAllowedChromeTarget(origin, page.url),
    );
    if (foreign) throw new ChromeAuthenticationError('CHROME_AUTH_ORIGIN_BLOCKED');
  }
  return undefined;
}

async function terminateChromeProcess(child: ChromeProcess): Promise<void> {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    await execFileAsync('taskkill', ['/PID', String(child.pid), '/T', '/F']).catch(() => undefined);
    return;
  }
  child.kill('SIGTERM');
}

function isHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function readEvaluationValue(result: unknown): unknown {
  if (!result || typeof result !== 'object') return undefined;
  const outer = result as { result?: unknown };
  if (!outer.result || typeof outer.result !== 'object') return undefined;
  return (outer.result as { value?: unknown }).value;
}

function isChromeAuthStorage(value: unknown): value is ChromeAuthStorage {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.origin === 'string' &&
    isRecord(record.localStorage) &&
    isRecord(record.sessionStorage)
  );
}

function withDefaults(input: ChromeAuthDependencies): Required<ChromeAuthDependencies> {
  return {
    platform: input.platform ?? process.platform,
    homeDir: input.homeDir ?? os.homedir(),
    environment: input.environment ?? process.env,
    executablePath: input.executablePath ?? '',
    exists:
      input.exists ??
      (async (filePath) =>
        access(filePath, constants.X_OK)
          .then(() => true)
          .catch(() => false)),
    createProfile:
      input.createProfile ?? (() => mkdtemp(path.join(os.tmpdir(), 'sub2api-chrome-'))),
    allocatePort: input.allocatePort ?? allocateLoopbackPort,
    launch:
      input.launch ??
      ((executablePath, args) =>
        spawn(executablePath, args, {
          stdio: 'ignore',
          windowsHide: false,
        })),
    fetchJson:
      input.fetchJson ??
      (async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`CDP_HTTP_${response.status}`);
        return response.json();
      }),
    connect: input.connect ?? connectWebSocket,
    removeProfile:
      input.removeProfile ?? ((directory) => rm(directory, { recursive: true, force: true })),
    sleep:
      input.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))),
    now: input.now ?? (() => Date.now()),
  };
}

async function allocateLoopbackPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string' || !isLoopbackAddress(address.address))
      throw new ChromeAuthenticationError('CHROME_CDP_PORT_INVALID');
    return address.port;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

interface NativeWebSocketLike {
  addEventListener(
    type: string,
    listener: (event: { data?: unknown; error?: unknown }) => void,
  ): void;
  send(data: string): void;
  close(): void;
}

async function connectWebSocket(url: string): Promise<CdpConnection> {
  const WebSocketConstructor = (
    globalThis as unknown as {
      WebSocket?: new (target: string) => NativeWebSocketLike;
    }
  ).WebSocket;
  if (!WebSocketConstructor) throw new Error('WEBSOCKET_UNAVAILABLE');
  const socket = new WebSocketConstructor(url);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve());
    socket.addEventListener('error', () => reject(new Error('CDP_WEBSOCKET_ERROR')));
  });
  let nextId = 0;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  socket.addEventListener('message', (event) => {
    const raw = typeof event.data === 'string' ? event.data : String(event.data ?? '');
    try {
      const message = JSON.parse(raw) as {
        id?: number;
        result?: unknown;
        error?: { message?: string };
      };
      if (typeof message.id !== 'number') return;
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message ?? 'CDP_COMMAND_FAILED'));
      else request.resolve(message.result);
    } catch {
      /* Ignore protocol events that are not command responses. */
    }
  });
  const fail = () => {
    for (const request of pending.values()) request.reject(new Error('CDP_CONNECTION_CLOSED'));
    pending.clear();
  };
  socket.addEventListener('close', fail);
  socket.addEventListener('error', fail);
  return {
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      fail();
      socket.close();
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type ChromeSessionCleanup = () => Promise<void>;
