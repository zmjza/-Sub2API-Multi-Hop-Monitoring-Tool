import { BrowserWindow, session as electronSession } from 'electron';
import { randomUUID } from 'node:crypto';
import type { SiteInput } from '../../shared/contracts.js';
import {
  extractInteractiveTokens,
  interactiveAuthWindowOptions,
  isAllowedInteractiveNavigation,
  type InteractiveTokens,
} from './interactive-auth-policy.js';

const tokenStorageScript = `(() => {
  const keys = ['auth_token', 'access_token', 'accessToken', 'refresh_token', 'refreshToken', 'auth-storage', 'auth', 'token-storage'];
  const result = {};
  for (const key of keys) {
    const value = window.localStorage.getItem(key);
    if (value !== null) result[key] = value;
  }
  return result;
})()`;

export async function runInteractiveAuthentication<T>(
  parent: BrowserWindow,
  input: SiteInput,
  validate: (tokens: InteractiveTokens) => Promise<T>,
  timeoutMs = 5 * 60_000,
): Promise<T> {
  const origin = new URL(input.url).origin;
  const temporarySession = electronSession.fromPartition(`geetest-${randomUUID()}`, {
    cache: false,
  });
  const window = new BrowserWindow({
    ...interactiveAuthWindowOptions(),
    parent,
    webPreferences: {
      ...interactiveAuthWindowOptions().webPreferences,
      session: temporarySession,
    },
  });
  window.setTitle('安全验证');
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedInteractiveNavigation(origin, url)) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let validating = false;
    const finish = async (result: { value: T } | { error: Error }) => {
      if (settled) return;
      settled = true;
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
      try {
        await temporarySession.clearStorageData();
        await temporarySession.clearCache();
      } catch {
        /* The in-memory session is discarded with the window. */
      }
      if (!window.isDestroyed()) window.destroy();
      if ('value' in result) resolve(result.value);
      else reject(result.error);
    };
    const inspect = async () => {
      if (settled || validating || window.isDestroyed()) return;
      if (!isAllowedInteractiveNavigation(origin, window.webContents.getURL())) return;
      try {
        const storage = (await window.webContents.executeJavaScript(
          tokenStorageScript,
          true,
        )) as Record<string, unknown>;
        const tokens = extractInteractiveTokens(storage);
        if (!tokens) return;
        validating = true;
        window.setClosable(false);
        try {
          await finish({ value: await validate(tokens) });
        } catch {
          validating = false;
          if (!window.isDestroyed()) window.setClosable(true);
        }
      } catch {
        /* Navigation can invalidate an inspection; the next poll retries. */
      }
    };
    const autofill = async () => {
      if (!isAllowedInteractiveNavigation(origin, window.webContents.getURL())) return;
      const account = JSON.stringify(input.account);
      const password = JSON.stringify(input.password);
      const script = `(() => {
        const fill = (selectors, value) => {
          const element = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
          if (!(element instanceof HTMLInputElement)) return;
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(element, value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        };
        fill(['input[type="email"]', 'input[name="email"]', 'input[name="username"]', 'input[autocomplete="username"]'], ${account});
        fill(['input[type="password"]', 'input[name="password"]', 'input[autocomplete="current-password"]'], ${password});
      })()`;
      await window.webContents.executeJavaScript(script, true).catch(() => undefined);
    };
    const pollTimer = setInterval(() => void inspect(), 500);
    const timeoutTimer = setTimeout(
      () => void finish({ error: new Error('INTERACTIVE_AUTH_TIMEOUT') }),
      timeoutMs,
    );
    window.on('closed', () => {
      if (!settled) void finish({ error: new Error('INTERACTIVE_AUTH_CANCELLED') });
    });
    window.webContents.on('did-finish-load', () => {
      void autofill();
      void inspect();
    });
    void window
      .loadURL(`${origin}/login`)
      .then(() => {
        if (!settled) window.show();
      })
      .catch(() => void finish({ error: new Error('INTERACTIVE_AUTH_LOAD_FAILED') }));
  });
}
