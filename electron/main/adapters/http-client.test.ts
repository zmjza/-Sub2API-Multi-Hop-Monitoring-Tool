import { describe, expect, it, vi } from 'vitest';
import { Sub2ApiClient } from './http-client.js';
import { AuthCoordinator } from '../services/auth-coordinator.js';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Sub2ApiClient', () => {
  it('logs in with the confirmed JSON contract and returns normalized session data', async () => {
    const fetcher = vi.fn<(...args: [string | URL | Request, RequestInit?]) => Promise<Response>>(
      async () =>
        jsonResponse({
          code: 0,
          message: 'success',
          data: {
            access_token: 'access-value',
            refresh_token: 'refresh-value',
            expires_in: 86400,
            token_type: 'Bearer',
            user: {
              id: 1,
              email: 'safe@example.invalid',
              role: 'user',
              balance: 3,
              status: 'active',
            },
          },
        }),
    );
    const client = new Sub2ApiClient('https://example.invalid/api/v1', fetcher);

    const result = await client.login('safe@example.invalid', 'runtime-secret');

    expect(result.user.balance).toBe(3);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://example.invalid/api/v1/auth/login');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'safe@example.invalid',
      password: 'runtime-secret',
    });
  });

  it('detects GeeTest from public settings without exposing unrelated settings', async () => {
    const client = new Sub2ApiClient(
      'https://example.invalid/api/v1',
      vi.fn(async () =>
        jsonResponse({
          data: {
            geetest_enabled: true,
            geetest_captcha_id: 'public-captcha-id',
            unrelated_private_value: 'must-not-leave-adapter',
          },
        }),
      ),
    );

    await expect(client.authenticationMode()).resolves.toEqual({
      interactiveVerification: { required: true, provider: 'geetest' },
    });
  });

  it('detects Cloudflare Turnstile from public settings without exposing unrelated settings', async () => {
    const client = new Sub2ApiClient(
      'https://example.invalid/api/v1',
      vi.fn(async () =>
        jsonResponse({
          data: {
            turnstile_enabled: true,
            turnstile_site_key: 'public-site-key',
            unrelated_private_value: 'must-not-leave-adapter',
          },
        }),
      ),
    );

    await expect(client.authenticationMode()).resolves.toEqual({
      interactiveVerification: { required: true, provider: 'turnstile' },
    });
  });

  it('classifies a GeeTest login rejection without leaking the upstream response', async () => {
    const client = new Sub2ApiClient(
      'https://example.invalid/api/v1',
      vi.fn(async () =>
        jsonResponse(
          {
            code: 'GEETEST_VERIFICATION_FAILED',
            message: 'private upstream response',
          },
          400,
        ),
      ),
    );

    await expect(client.login('safe@example.invalid', 'runtime-secret')).rejects.toMatchObject({
      code: 'INTERACTIVE_VERIFICATION_REQUIRED',
      message: '需要完成安全验证',
      provider: 'geetest',
      retryable: false,
    });
  });

  it('classifies a Turnstile login rejection without leaking the upstream response', async () => {
    const client = new Sub2ApiClient(
      'https://example.invalid/api/v1',
      vi.fn(async () =>
        jsonResponse(
          {
            code: 'TURNSTILE_VERIFICATION_FAILED',
            message: 'private upstream response',
          },
          400,
        ),
      ),
    );

    await expect(client.login('safe@example.invalid', 'runtime-secret')).rejects.toMatchObject({
      code: 'INTERACTIVE_VERIFICATION_REQUIRED',
      message: '需要完成安全验证',
      provider: 'turnstile',
      retryable: false,
    });
  });

  it('classifies an interactive login rejection even when the provider responds with 401', async () => {
    const client = new Sub2ApiClient(
      'https://example.invalid/api/v1',
      vi.fn(async () =>
        jsonResponse(
          {
            data: {
              code: 'TURNSTILE_REQUIRED',
              message: 'complete challenge',
              private_token: 'must-not-leave-adapter',
            },
          },
          401,
        ),
      ),
    );

    await expect(client.login('safe@example.invalid', 'runtime-secret')).rejects.toMatchObject({
      code: 'INTERACTIVE_VERIFICATION_REQUIRED',
      provider: 'turnstile',
      retryable: false,
      httpStatus: 401,
    });
  });

  it('classifies an interactive login envelope even when the HTTP response is 2xx', async () => {
    const client = new Sub2ApiClient(
      'https://example.invalid/api/v1',
      vi.fn(async () =>
        jsonResponse({
          code: 'TURNSTILE_REQUIRED',
          message: 'complete challenge',
          data: { private_token: 'must-not-leave-adapter' },
        }),
      ),
    );

    await expect(client.login('safe@example.invalid', 'runtime-secret')).rejects.toMatchObject({
      code: 'INTERACTIVE_VERIFICATION_REQUIRED',
      message: '需要完成安全验证',
      provider: 'turnstile',
      retryable: false,
    });
  });

  it('classifies optional 404 capabilities without leaking response content', async () => {
    const client = new Sub2ApiClient(
      'https://example.invalid/api/v1',
      vi.fn(async () => jsonResponse({ message: 'Authorization Bearer private' }, 404)),
    );
    await expect(
      client.getJson('/channel-monitors', 'access-value', 'channelMonitors'),
    ).rejects.toMatchObject({
      code: 'UNSUPPORTED_CAPABILITY',
      capability: 'channelMonitors',
      httpStatus: 404,
    });
  });

  it('preserves only a safe Retry-After duration for rate limiting', async () => {
    const client = new Sub2ApiClient(
      'https://example.invalid/api/v1',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'private upstream detail' }), {
            status: 429,
            headers: { 'content-type': 'application/json', 'retry-after': '600' },
          }),
      ),
    );

    await expect(
      client.getJson('/channel-monitors', 'access-value', 'channelMonitors'),
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 600,
      message: '请求失败',
    });
  });

  it('sends authenticated JSON POST and PUT requests without widening their bodies', async () => {
    const fetcher = vi.fn<(...args: [string | URL | Request, RequestInit?]) => Promise<Response>>(
      async () => jsonResponse({ data: { ok: true } }),
    );
    const client = new Sub2ApiClient('https://example.invalid/api/v1', fetcher);

    await client.postJson('/usage/dashboard/api-keys-usage', 'access-value', 'keyUsage', {
      api_key_ids: [1, 2],
    });
    await client.putJson('/keys/1', 'access-value', 'apiKeyUpdate', { group_id: 25 });

    expect(
      fetcher.mock.calls.map(([url, init]) => [url, init?.method, JSON.parse(String(init?.body))]),
    ).toEqual([
      [
        'https://example.invalid/api/v1/usage/dashboard/api-keys-usage',
        'POST',
        { api_key_ids: [1, 2] },
      ],
      ['https://example.invalid/api/v1/keys/1', 'PUT', { group_id: 25 }],
    ]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.headers).toMatchObject({
        accept: 'application/json',
        authorization: 'Bearer access-value',
        'content-type': 'application/json',
      });
    }
  });
});

describe('AuthCoordinator', () => {
  it('coalesces concurrent refresh attempts for the same site', async () => {
    let calls = 0;
    const coordinator = new AuthCoordinator(async () => {
      calls += 1;
      await Promise.resolve();
      return { accessToken: 'new-access', refreshToken: 'new-refresh', expiresAt: 20 };
    });
    const [first, second] = await Promise.all([
      coordinator.refresh('site-a', 'old-refresh'),
      coordinator.refresh('site-a', 'old-refresh'),
    ]);
    expect(first).toEqual(second);
    expect(calls).toBe(1);
  });
});
