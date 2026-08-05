import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  extractInteractiveTokens,
  interactiveChallengeHostResolverRules,
  interactiveHostResolverRule,
  isRecoverableInteractiveChallengeError,
  nextInteractiveAuthProxyMode,
  interactiveAuthWindowOptions,
  isAllowedInteractiveNavigation,
} from './interactive-auth-policy.js';

describe('interactive authentication policy', () => {
  it('allows only exact-origin top-level navigation', () => {
    expect(
      isAllowedInteractiveNavigation('https://example.invalid', 'https://example.invalid/login'),
    ).toBe(true);
    expect(
      isAllowedInteractiveNavigation(
        'https://example.invalid',
        'https://example.invalid.evil.test',
      ),
    ).toBe(false);
    expect(
      isAllowedInteractiveNavigation('https://example.invalid', 'http://example.invalid/login'),
    ).toBe(false);
    expect(isAllowedInteractiveNavigation('https://example.invalid', 'javascript:alert(1)')).toBe(
      false,
    );
  });

  it('uses a framed sandboxed modal window without a preload or persistent partition', () => {
    expect(interactiveAuthWindowOptions()).toMatchObject({
      width: 520,
      height: 720,
      frame: true,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    expect(interactiveAuthWindowOptions().webPreferences).not.toHaveProperty('preload');
    expect(interactiveAuthWindowOptions().webPreferences).not.toHaveProperty('partition');
  });

  it('extracts tokens only from finite direct and structured storage keys', () => {
    expect(
      extractInteractiveTokens({
        auth_token: 'access-direct',
        refresh_token: 'refresh-direct',
        arbitrary_secret: 'must-not-read',
      }),
    ).toEqual({ accessToken: 'access-direct', refreshToken: 'refresh-direct' });
    expect(
      extractInteractiveTokens({
        'auth-storage': JSON.stringify({
          state: { accessToken: 'access-structured', refreshToken: 'refresh-structured' },
          privateProfile: 'must-not-return',
        }),
      }),
    ).toEqual({ accessToken: 'access-structured', refreshToken: 'refresh-structured' });
    expect(
      extractInteractiveTokens({ arbitrary: JSON.stringify({ accessToken: 'must-not-read' }) }),
    ).toBeUndefined();
    expect(extractInteractiveTokens({ access_token: 'access-only' })).toEqual({
      accessToken: 'access-only',
    });
  });

  it('prevents the verification window from reporting cancellation while saving', () => {
    const source = readFileSync('electron/main/services/interactive-auth-window.ts', 'utf8');
    expect(source).toContain("webContents.on('will-redirect'");
    expect(source).toContain("webContents.on('before-input-event'");
    expect(source).toContain("inputEvent.key === 'Escape'");
    expect(source).toContain('window.close()');
    expect(source).toContain("webContents.on('dom-ready'");
    expect(source).not.toContain('Page.addScriptToEvaluateOnNewDocument');
    expect(source).not.toContain('Network.setUserAgentOverride');
    expect(source).not.toContain('Target.attachToTarget');
    expect(source).not.toContain('navigator.webdriver');
    expect(source).not.toContain('setUserAgent');
    expect(source).not.toContain('userAgentData');
    const lock = source.indexOf('window.setClosable(false)');
    const validate = source.indexOf('await validate(tokens)');
    const unlock = source.indexOf('window.setClosable(true)');

    expect(lock).toBeGreaterThan(-1);
    expect(validate).toBeGreaterThan(lock);
    expect(unlock).toBeGreaterThan(validate);
  });

  it('routes Turnstile to the real Chrome session while keeping GeeTest in Electron', () => {
    const source = readFileSync('electron/main/services/interactive-auth-window.ts', 'utf8');
    expect(source).toContain("provider === 'turnstile'");
    expect(source).toContain('runChromeInteractiveAuthentication');
    expect(source).toContain("provider: InteractiveVerificationProvider = 'geetest'");
  });

  it('submits the official login form after the provider callback has enabled it', () => {
    const source = readFileSync('electron/main/services/interactive-auth-window.ts', 'utf8');
    expect(source).toContain('submitInteractiveLogin');
    expect(source).toContain('form.requestSubmit()');
    expect(source).toContain('login-submit-attempted');
    expect(source).toContain('turnstile_token');
  });

  it('retries credential autofill until the asynchronously rendered login form exists', () => {
    const source = readFileSync('electron/main/services/interactive-auth-window.ts', 'utf8');
    expect(source).toContain('let autofillCompleted = false');
    expect(source).toContain('autofillCompleted = await autofill()');
    expect(source).toContain('if (!autofillCompleted)');
  });

  it('uses the system proxy with a direct challenge fallback', () => {
    const source = readFileSync('electron/main/services/interactive-auth-window.ts', 'utf8');
    expect(source).toContain("let proxyMode: InteractiveAuthProxyMode = 'system'");
    expect(source).toContain('temporarySession.setProxy({ mode: proxyMode })');
    expect(source).toContain('temporarySession.setProxy({ mode: nextMode })');
    expect(source).toContain('window.webContents.reload()');
    expect(source).toContain('INTERACTIVE_AUTH_CHALLENGE_NETWORK');
  });

  it('keeps recoverable challenge transport errors inside the official window', () => {
    expect(isRecoverableInteractiveChallengeError('net::ERR_CONNECTION_CLOSED')).toBe(true);
    expect(isRecoverableInteractiveChallengeError('net::ERR_TIMED_OUT')).toBe(true);
    expect(isRecoverableInteractiveChallengeError('net::ERR_CONNECTION_RESET')).toBe(true);
    expect(isRecoverableInteractiveChallengeError('net::ERR_ABORTED')).toBe(false);
    expect(isRecoverableInteractiveChallengeError('net::ERR_CERT_AUTHORITY_INVALID')).toBe(false);
  });

  it('falls back from the system proxy to direct access once', () => {
    expect(nextInteractiveAuthProxyMode('system')).toBe('direct');
    expect(nextInteractiveAuthProxyMode('direct')).toBeUndefined();
  });

  it('creates challenge DNS rules for public IPv4 and IPv6 addresses', () => {
    expect(interactiveChallengeHostResolverRules('104.18.95.41')).toBe(
      'MAP challenges.cloudflare.com 104.18.95.41, MAP *.challenges.cloudflare.com 104.18.95.41',
    );
    expect(interactiveChallengeHostResolverRules('2606:4700::6812:1092')).toBe(
      'MAP challenges.cloudflare.com [2606:4700::6812:1092], MAP *.challenges.cloudflare.com [2606:4700::6812:1092]',
    );
    expect(interactiveChallengeHostResolverRules('198.18.0.111')).toBeUndefined();
    expect(interactiveChallengeHostResolverRules('fe80::1')).toBeUndefined();
    expect(interactiveChallengeHostResolverRules('not-an-ip')).toBeUndefined();
    expect(interactiveHostResolverRule('stun.cloudflare.com', '162.159.207.0')).toBe(
      'MAP stun.cloudflare.com 162.159.207.0',
    );
    expect(interactiveHostResolverRule('stun1.l.google.com', '2001:4860:4864:5:8000::1')).toBe(
      'MAP stun1.l.google.com [2001:4860:4864:5:8000::1]',
    );
    expect(interactiveHostResolverRule('stun.cloudflare.com', '198.18.0.108')).toBeUndefined();
    expect(interactiveHostResolverRule('stun.cloudflare.com;bad', '162.159.207.0')).toBeUndefined();
  });
});
