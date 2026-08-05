import { BrowserWindow, session as electronSession } from 'electron';
import { randomUUID } from 'node:crypto';
import type { InteractiveVerificationProvider, SiteInput } from '../../shared/contracts.js';
import { runChromeInteractiveAuthentication } from './chrome-auth-window.js';
import {
  extractInteractiveTokens,
  isRecoverableInteractiveChallengeError,
  interactiveAuthWindowOptions,
  isAllowedInteractiveNavigation,
  nextInteractiveAuthProxyMode,
  type InteractiveAuthProxyMode,
  type InteractiveTokens,
} from './interactive-auth-policy.js';

const tokenStorageScript = `(() => {
  const keys = ['auth_token', 'access_token', 'accessToken', 'refresh_token', 'refreshToken', 'auth-storage', 'auth', 'token-storage'];
  const result = {};
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of keys) {
      const value = storage.getItem(key);
      if (value !== null && !(key in result)) result[key] = value;
    }
  }
  return result;
})()`;

// The official login page owns the provider callback and its reactive form state.
// Submit only after that page has produced a non-empty challenge response.
const submitInteractiveLoginScript = `(() => {
  const challengeSelectors = [
    'input[name="cf-turnstile-response"]',
    'textarea[name="cf-turnstile-response"]',
    'input[name="turnstile_token"]',
    'input[name="turnstile"]',
    'input[name="geetest_challenge"]',
    'input[name="geetest_validate"]',
    'input[name="geetest_seccode"]',
  ];
  const forms = Array.from(document.forms);
  const form =
    forms.find((candidate) =>
      candidate.querySelector(
        'input[type="password"], input[autocomplete="current-password"]',
      ) &&
      challengeSelectors.some((selector) => candidate.querySelector(selector)),
    ) ?? forms[0];
  if (!(form instanceof HTMLFormElement)) return false;

  const challengeFields = challengeSelectors
    .flatMap((selector) => Array.from(form.querySelectorAll(selector)))
    .filter((field): field is HTMLInputElement | HTMLTextAreaElement =>
      field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement,
    );
  const hasChallengeResponse = challengeFields.some((field) => field.value.trim().length > 0);
  if (!hasChallengeResponse) {
    form.removeAttribute('data-login-submit-attempted');
    return false;
  }

  const submitter = form.querySelector('button[type="submit"], input[type="submit"]');
  if (
    !submitter ||
    ((submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) &&
      (submitter.disabled || submitter.getAttribute('aria-disabled') === 'true'))
  )
    return false;
  if (form.getAttribute('data-login-submit-attempted') === 'true') return false;

  form.setAttribute('data-login-submit-attempted', 'true');
  form.requestSubmit();
  return true;
})()`;

const escapeCloseScript = `(() => {
  if (window.__sub2apiEscapeCloseInstalled) return;
  window.__sub2apiEscapeCloseInstalled = true;
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      window.close();
    },
    true,
  );
})()`;

export async function runInteractiveAuthentication<T>(
  parent: BrowserWindow,
  input: SiteInput,
  validate: (tokens: InteractiveTokens) => Promise<T>,
  timeoutMs = 5 * 60_000,
  provider: InteractiveVerificationProvider = 'geetest',
): Promise<T> {
  if (provider === 'turnstile')
    return runChromeInteractiveAuthentication(input, validate, timeoutMs);
  const origin = new URL(input.url).origin;
  const temporarySession = electronSession.fromPartition(`interactive-auth-${randomUUID()}`, {
    cache: false,
  });
  let proxyMode: InteractiveAuthProxyMode = 'system';
  await temporarySession.setProxy({ mode: proxyMode }).catch(() => undefined);
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
  window.webContents.on('will-redirect', (event, url) => {
    if (!isAllowedInteractiveNavigation(origin, url)) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let validating = false;
    let autofillCompleted = false;
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
    const submitInteractiveLogin = async () => {
      if (settled || window.isDestroyed()) return;
      if (!isAllowedInteractiveNavigation(origin, window.webContents.getURL())) return;
      await window.webContents
        .executeJavaScript(submitInteractiveLoginScript, true)
        .catch(() => false);
    };
    const autofill = async (): Promise<boolean> => {
      if (!isAllowedInteractiveNavigation(origin, window.webContents.getURL())) return false;
      const account = JSON.stringify(input.account);
      const password = JSON.stringify(input.password);
      const script = `(() => {
        const fill = (selectors, value) => {
          const element = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
          if (!(element instanceof HTMLInputElement)) return false;
          if (!element.value) {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            setter?.call(element, value);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return element.value.length > 0;
        };
        return fill(['input[type="email"]', 'input[name="email"]', 'input[name="username"]', 'input[autocomplete="username"]'], ${account}) &&
          fill(['input[type="password"]', 'input[name="password"]', 'input[autocomplete="current-password"]'], ${password});
      })()`;
      return Boolean(await window.webContents.executeJavaScript(script, true).catch(() => false));
    };
    const inspect = async () => {
      if (settled || validating || window.isDestroyed()) return;
      if (!isAllowedInteractiveNavigation(origin, window.webContents.getURL())) return;
      try {
        if (!autofillCompleted) autofillCompleted = await autofill();
        await submitInteractiveLogin();
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
    window.webContents.on('before-input-event', (event, inputEvent) => {
      if (
        inputEvent.type === 'keyDown' &&
        (inputEvent.key === 'Escape' || inputEvent.code === 'Escape') &&
        !validating
      ) {
        event.preventDefault();
        void finish({ error: new Error('INTERACTIVE_AUTH_CANCELLED') });
      }
    });
    window.webContents.on('dom-ready', () => {
      autofillCompleted = false;
      void window.webContents.executeJavaScript(escapeCloseScript, true).catch(() => undefined);
    });
    const pollTimer = setInterval(() => void inspect(), 500);
    const timeoutTimer = setTimeout(
      () => void finish({ error: new Error('INTERACTIVE_AUTH_TIMEOUT') }),
      timeoutMs,
    );
    const challengeFilter = {
      urls: ['https://challenges.cloudflare.com/*', 'https://*.challenges.cloudflare.com/*'],
    };
    let proxyFallbackPromise: Promise<boolean> | undefined;
    const retryWithFallbackProxy = (): Promise<boolean> => {
      if (proxyFallbackPromise) return proxyFallbackPromise;
      const nextMode = nextInteractiveAuthProxyMode(proxyMode);
      if (!nextMode) return Promise.resolve(false);
      proxyFallbackPromise = (async () => {
        try {
          await temporarySession.setProxy({ mode: nextMode });
          proxyMode = nextMode;
          if (!settled && !window.isDestroyed()) window.webContents.reload();
          return true;
        } catch {
          return false;
        }
      })().finally(() => {
        proxyFallbackPromise = undefined;
      });
      return proxyFallbackPromise;
    };
    const finishForChallengeNetwork = async (errorCode: string) => {
      // Retry the same official page over direct access before surfacing a network error.
      if (isRecoverableInteractiveChallengeError(errorCode)) {
        await retryWithFallbackProxy();
        return;
      }
      void finish({ error: new Error('INTERACTIVE_AUTH_CHALLENGE_NETWORK') });
    };
    temporarySession.webRequest.onErrorOccurred(challengeFilter, (details) => {
      if (details.error !== 'net::ERR_ABORTED') void finishForChallengeNetwork(details.error);
    });
    temporarySession.webRequest.onCompleted(challengeFilter, (details) => {
      if (details.statusCode >= 500) void finishForChallengeNetwork(`HTTP_${details.statusCode}`);
    });
    window.on('closed', () => {
      if (!settled) void finish({ error: new Error('INTERACTIVE_AUTH_CANCELLED') });
    });
    window.webContents.on('did-finish-load', () => {
      void window.webContents.executeJavaScript(escapeCloseScript, true).catch(() => undefined);
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
