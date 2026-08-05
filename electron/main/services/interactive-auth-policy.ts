import { isIP } from 'node:net';

export interface InteractiveTokens {
  accessToken: string;
  refreshToken?: string;
}

export type InteractiveAuthProxyMode = 'system' | 'direct';

const directAccessKeys = ['auth_token', 'access_token', 'accessToken'] as const;
const directRefreshKeys = ['refresh_token', 'refreshToken'] as const;
const structuredStorageKeys = ['auth-storage', 'auth', 'token-storage'] as const;

export function interactiveAuthWindowOptions() {
  return {
    width: 520,
    height: 720,
    minWidth: 420,
    minHeight: 560,
    show: false,
    frame: true,
    modal: true,
    center: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  } as const;
}

export function isRecoverableInteractiveChallengeError(error: string): boolean {
  const normalized = error.trim().toUpperCase();
  return (
    normalized.startsWith('HTTP_5') ||
    [
      'NET::ERR_BLOCKED_BY_CLIENT',
      'NET::ERR_CONNECTION_CLOSED',
      'NET::ERR_CONNECTION_RESET',
      'NET::ERR_FAILED',
      'NET::ERR_INTERNET_DISCONNECTED',
      'NET::ERR_NAME_NOT_RESOLVED',
      'NET::ERR_NETWORK_CHANGED',
      'NET::ERR_PROXY_CONNECTION_FAILED',
      'NET::ERR_TIMED_OUT',
    ].includes(normalized)
  );
}

export function nextInteractiveAuthProxyMode(
  mode: InteractiveAuthProxyMode,
): InteractiveAuthProxyMode | undefined {
  return mode === 'system' ? 'direct' : undefined;
}

export function interactiveChallengeHostResolverRules(address: string): string | undefined {
  const hostAddress = publicResolverAddress(address);
  if (!hostAddress) return undefined;
  return `MAP challenges.cloudflare.com ${hostAddress}, MAP *.challenges.cloudflare.com ${hostAddress}`;
}

export function interactiveHostResolverRule(host: string, address: string): string | undefined {
  if (!/^[a-z0-9.-]+$/i.test(host)) return undefined;
  const hostAddress = publicResolverAddress(address);
  return hostAddress ? `MAP ${host} ${hostAddress}` : undefined;
}

function publicResolverAddress(address: string): string | undefined {
  const kind = isIP(address);
  if (kind === 4) {
    const octets = address.split('.').map((value) => Number(value));
    if (
      octets.length !== 4 ||
      octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
    )
      return undefined;
    const [first, second] = octets;
    if (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19)) ||
      first >= 224
    )
      return undefined;
  } else if (kind === 6) {
    const firstHextet = Number.parseInt(address.split(':')[0] || '0', 16);
    if (
      !Number.isInteger(firstHextet) ||
      firstHextet === 0 ||
      (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) ||
      (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) ||
      firstHextet >= 0xff00 ||
      address.toLowerCase().startsWith('2001:db8:')
    )
      return undefined;
  } else return undefined;

  return kind === 6 ? `[${address}]` : address;
}

export function isAllowedInteractiveNavigation(targetOrigin: string, targetUrl: string): boolean {
  try {
    return new URL(targetUrl).origin === new URL(targetOrigin).origin;
  } catch {
    return false;
  }
}

export function extractInteractiveTokens(
  storage: Record<string, unknown>,
): InteractiveTokens | undefined {
  const direct = tokenPair(storage);
  if (direct) return direct;
  for (const key of structuredStorageKeys) {
    const raw = storage[key];
    if (typeof raw !== 'string' || raw.length > 100_000) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const nested = findTokenPair(parsed, 0);
      if (nested) return nested;
    } catch {
      /* Ignore unrelated or malformed storage values. */
    }
  }
  return undefined;
}

function findTokenPair(value: unknown, depth: number): InteractiveTokens | undefined {
  if (depth > 3 || !isRecord(value)) return undefined;
  const direct = tokenPair(value);
  if (direct) return direct;
  for (const key of ['state', 'tokens', 'session', 'auth'] as const) {
    const nested = findTokenPair(value[key], depth + 1);
    if (nested) return nested;
  }
  return undefined;
}

function tokenPair(value: Record<string, unknown>): InteractiveTokens | undefined {
  const accessToken = firstToken(value, directAccessKeys);
  const refreshToken = firstToken(value, directRefreshKeys);
  return accessToken ? { accessToken, ...(refreshToken ? { refreshToken } : {}) } : undefined;
}

function firstToken(value: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const token = value[key];
    if (typeof token === 'string' && token.length > 0 && token.length <= 32_768) return token;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
