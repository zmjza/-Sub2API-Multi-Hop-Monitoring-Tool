import { loginResponseSchema, normalizeError, refreshResponseSchema } from './schemas.js';

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class Sub2ApiClient {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 15_000,
  ) {}

  async login(email: string, password: string) {
    const raw = await this.request(
      '/auth/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ email, password }),
      },
      'authLogin',
    );
    const parsed = loginResponseSchema.parse(raw);
    return {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token,
      expiresAt: Date.now() + parsed.data.expires_in * 1_000,
      user: parsed.data.user,
    };
  }

  async refresh(refreshToken: string) {
    const raw = await this.request(
      '/auth/refresh',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
      'authRefresh',
    );
    const parsed = refreshResponseSchema.parse(raw);
    return {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token ?? refreshToken,
      expiresAt: Date.now() + parsed.data.expires_in * 1_000,
    };
  }

  async getJson(path: string, accessToken: string, capability: string): Promise<unknown> {
    return this.request(
      path,
      {
        method: 'GET',
        headers: { accept: 'application/json', authorization: `Bearer ${accessToken}` },
      },
      capability,
    );
  }

  private async request(path: string, init: RequestInit, capability: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(`${this.apiBaseUrl}${path}`, {
        ...init,
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response.ok) throw normalizeError(undefined, capability, response.status);
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw {
          code: 'INCOMPATIBLE_RESPONSE',
          message: '响应格式不兼容',
          capability,
          retryable: false,
        };
      }
      return await response.json();
    } catch (error) {
      if (isSafeError(error)) throw error;
      throw normalizeError(error, capability);
    } finally {
      clearTimeout(timer);
    }
  }
}

function isSafeError(
  value: unknown,
): value is { code: string; message: string; retryable: boolean } {
  return typeof value === 'object' && value !== null && 'code' in value && 'retryable' in value;
}
