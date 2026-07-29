import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  extractInteractiveTokens,
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
    expect(extractInteractiveTokens({ access_token: 'access-only' })).toBeUndefined();
  });

  it('prevents the verification window from reporting cancellation while saving', () => {
    const source = readFileSync('electron/main/services/interactive-auth-window.ts', 'utf8');
    const lock = source.indexOf('window.setClosable(false)');
    const validate = source.indexOf('await validate(tokens)');
    const unlock = source.indexOf('window.setClosable(true)');

    expect(lock).toBeGreaterThan(-1);
    expect(validate).toBeGreaterThan(lock);
    expect(unlock).toBeGreaterThan(validate);
  });
});
