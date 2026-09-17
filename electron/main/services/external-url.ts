export function isSafeExternalHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    return Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function purchaseUrlFromBase(
  value: string,
): { ok: true; url: string } | { ok: false; error: string } {
  if (!isSafeExternalHttpUrl(value)) return { ok: false, error: 'UNSAFE_URL' };
  const url = new URL(value);
  url.pathname = '/purchase';
  url.search = '';
  url.hash = '';
  return { ok: true, url: url.toString().replace(/\/$/, '') };
}

const USER_GESTURE_DISPOSITIONS = new Set(['new-window', 'foreground-tab', 'background-tab']);

export function decideEmbeddedWindowOpen(input: { url: string; disposition?: string }): {
  action: 'deny';
  openExternal?: string;
  error?: string;
} {
  if (!USER_GESTURE_DISPOSITIONS.has(input.disposition ?? '')) return { action: 'deny' };
  try {
    const url = new URL(input.url);
    if (url.username || url.password) return { action: 'deny', error: 'CREDENTIALS' };
    if (!isSafeExternalHttpUrl(input.url)) return { action: 'deny' };
    return { action: 'deny', openExternal: input.url };
  } catch {
    return { action: 'deny' };
  }
}

export function chromeLaunchArgsForUrl(url: string): string[] {
  return ['--new-window', url];
}
