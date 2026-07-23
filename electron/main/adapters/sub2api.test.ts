import { describe, expect, it } from 'vitest';
import { normalizeSiteUrl } from './url.js';
import { loginResponseSchema, normalizeApiKey, normalizeError } from './schemas.js';

describe('sub2api boundary contracts', () => {
  it('normalizes a login URL to the finite API prefix', () => {
    expect(normalizeSiteUrl('https://example.com/api/v1/auth/login')).toEqual({
      baseUrl: 'https://example.com',
      apiPrefix: '/api/v1',
      apiBaseUrl: 'https://example.com/api/v1',
    });
  });

  it('rejects credentials in URLs and unsafe schemes', () => {
    expect(() => normalizeSiteUrl('file:///tmp/a')).toThrow('INVALID_URL');
    expect(() => normalizeSiteUrl('https://user:pass@example.com')).toThrow('INVALID_URL');
  });

  it('validates login responses without accepting incomplete tokens', () => {
    const parsed = loginResponseSchema.parse({
      code: 0,
      message: 'success',
      data: {
        access_token: 'temporary-access',
        refresh_token: 'temporary-refresh',
        expires_in: 86400,
        token_type: 'Bearer',
        user: { id: 1, email: 'safe@example.invalid', role: 'user', balance: 2, status: 'active' },
      },
    });
    expect(parsed.data.expires_in).toBe(86400);
    expect(() => loginResponseSchema.parse({ code: 0, data: {} })).toThrow();
  });

  it('drops complete API key material and standardizes safe errors', () => {
    expect(normalizeApiKey({ id: 1, name: 'Codex', key: 'x', status: 'active' })).toEqual({
      id: '1',
      name: 'Codex',
      maskedLabel: 'Codex · ••••',
      status: 'active',
      groupId: undefined,
    });
    const error = normalizeError(new Error('Authorization: Bearer secret-token'), 'profile');
    expect(error.message).toBe('请求失败');
    expect(JSON.stringify(error)).not.toContain('secret-token');
  });
});
