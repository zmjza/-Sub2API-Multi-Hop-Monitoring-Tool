export interface InteractiveTokens {
  accessToken: string;
  refreshToken: string;
}

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
  return accessToken && refreshToken ? { accessToken, refreshToken } : undefined;
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
