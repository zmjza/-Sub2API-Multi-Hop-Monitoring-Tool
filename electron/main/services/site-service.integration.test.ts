import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDatabase } from '../storage/database.js';
import { CredentialVault } from '../storage/credential-vault.js';
import { SiteService, usageDateRange } from './site-service.js';

const servers: Array<ReturnType<typeof createServer>> = [];
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

describe('SiteService authentication recovery', () => {
  it('maps preset usage periods to inclusive local calendar dates', () => {
    const now = new Date(2026, 6, 13, 13, 30, 0);
    expect(usageDateRange('today', undefined, undefined, now)).toEqual({
      startDate: '2026-07-13',
      endDate: '2026-07-13',
    });
    expect(usageDateRange('7d', undefined, undefined, now)).toEqual({
      startDate: '2026-07-07',
      endDate: '2026-07-13',
    });
    expect(usageDateRange('30d', undefined, undefined, now)).toEqual({
      startDate: '2026-06-14',
      endDate: '2026-07-13',
    });
    expect(usageDateRange('custom', '2026-07-01', '2026-07-03', now)).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-03',
    });
  });

  it('maps the usage time direction to the upstream sort fields', async () => {
    let usageUrl = '';
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      usageUrl = request.url ?? '';
      response.end(
        JSON.stringify({ data: { items: [], page: 1, page_size: 20, pages: 0, total: 0 } }),
      );
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server unavailable');
    const values = new Map<string, string>();
    const vault = new CredentialVault(
      {
        isAvailable: () => true,
        encrypt: (value) => Buffer.from(value),
        decrypt: (value) => value.toString(),
      },
      {
        read: (key) => values.get(key),
        write: (key, value) => values.set(key, value),
        remove: (key) => values.delete(key),
      },
    );
    const db = new AppDatabase(new DatabaseSync(':memory:'));
    db.migrate();
    db.saveSite({
      id: 'usage-site',
      name: 'usage',
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiPrefix: '/api/v1',
    });
    vault.write('usage-site', {
      account: 'safe@example.invalid',
      password: 'runtime-only',
      accessToken: 'safe-access',
    });
    const service = new SiteService(db, vault);

    await service.usage({
      siteId: 'usage-site',
      period: 'today',
      page: 1,
      pageSize: 20,
      sort: 'asc',
    });

    const params = new URL(usageUrl, 'http://local.invalid').searchParams;
    const today = new Date();
    const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(params.get('start_date')).toBe(expectedDate);
    expect(params.get('end_date')).toBe(expectedDate);
    expect(params.has('period')).toBe(false);
    expect(params.get('sort_by')).toBe('created_at');
    expect(params.get('sort_order')).toBe('asc');
    expect(params.has('sort')).toBe(false);
  });

  it('refreshes, falls back to password login, and only then rotates the stored session', async () => {
    let loginCount = 0;
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      const url = request.url ?? '';
      if (url === '/api/v1/auth/login') {
        loginCount += 1;
        const token = loginCount === 1 ? 'initial-access' : 'renewed-access';
        return response.end(
          JSON.stringify({
            code: 0,
            data: {
              access_token: token,
              refresh_token: `${token}-refresh`,
              expires_in: 60,
              token_type: 'Bearer',
              user: { id: 1, role: 'user', balance: 4, status: 'active' },
            },
          }),
        );
      }
      if (url === '/api/v1/auth/refresh') {
        response.statusCode = 401;
        return response.end(JSON.stringify({ message: 'expired' }));
      }
      if (request.headers.authorization === 'Bearer expired-access') {
        response.statusCode = 401;
        return response.end(JSON.stringify({ message: 'expired' }));
      }
      if (url === '/api/v1/user/profile')
        return response.end(JSON.stringify({ data: { balance: 4 } }));
      if (url === '/api/v1/keys')
        return response.end(
          JSON.stringify({ data: [{ id: 'key-a', name: 'A', status: 'active' }] }),
        );
      if (url === '/api/v1/groups/available') return response.end(JSON.stringify({ data: [] }));
      if (url === '/api/v1/groups/rates') return response.end(JSON.stringify({ data: {} }));
      if (url.startsWith('/api/v1/usage/stats'))
        return response.end(
          JSON.stringify({ data: { total_requests: 1, total_tokens: 2, total_actual_cost: 0.1 } }),
        );
      if (url === '/api/v1/channel-monitors') {
        response.statusCode = 404;
        return response.end(JSON.stringify({ message: 'unsupported' }));
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ message: 'missing' }));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server unavailable');
    const values = new Map<string, string>();
    const vault = new CredentialVault(
      {
        isAvailable: () => true,
        encrypt: (value) => Buffer.from(value),
        decrypt: (value) => value.toString(),
      },
      {
        read: (key) => values.get(key),
        write: (key, value) => values.set(key, value),
        remove: (key) => values.delete(key),
      },
    );
    const db = new AppDatabase(new DatabaseSync(':memory:'));
    db.migrate();
    const service = new SiteService(db, vault);
    const added = await service.addAndVerify({
      name: 'local',
      url: `http://127.0.0.1:${address.port}`,
      account: 'safe@example.invalid',
      password: 'runtime-only',
    });
    vault.write(added.id, {
      account: 'safe@example.invalid',
      password: 'runtime-only',
      accessToken: 'expired-access',
      refreshToken: 'expired-refresh',
    });
    const refreshed = await service.refresh(added.id);
    expect(refreshed.status).toBe('success');
    expect(vault.read(added.id)?.accessToken).toBe('renewed-access');
    expect(loginCount).toBe(2);
  }, 20_000);

  it('keeps successful batch sites when another URL fails', async () => {
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      const url = request.url ?? '';
      if (url === '/api/v1/auth/login')
        return response.end(
          JSON.stringify({
            code: 0,
            data: {
              access_token: 'batch-access',
              refresh_token: 'batch-refresh',
              expires_in: 60,
              token_type: 'Bearer',
              user: { id: 1, role: 'user', balance: 2, status: 'active' },
            },
          }),
        );
      if (url === '/api/v1/user/profile')
        return response.end(JSON.stringify({ data: { balance: 2 } }));
      if (url === '/api/v1/keys' || url === '/api/v1/groups/available')
        return response.end(JSON.stringify({ data: [] }));
      if (url === '/api/v1/groups/rates') return response.end(JSON.stringify({ data: {} }));
      if (url.startsWith('/api/v1/usage/stats'))
        return response.end(
          JSON.stringify({ data: { total_requests: 0, total_tokens: 0, total_actual_cost: 0 } }),
        );
      response.statusCode = 404;
      response.end(JSON.stringify({ message: 'unsupported' }));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server unavailable');
    const values = new Map<string, string>();
    const vault = new CredentialVault(
      {
        isAvailable: () => true,
        encrypt: (value) => Buffer.from(value),
        decrypt: (value) => value.toString(),
      },
      {
        read: (key) => values.get(key),
        write: (key, value) => values.set(key, value),
        remove: (key) => values.delete(key),
      },
    );
    const db = new AppDatabase(new DatabaseSync(':memory:'));
    db.migrate();
    const service = new SiteService(db, vault);
    const progress: Array<{ current: number; total: number; status: string }> = [];
    const result = await service.addBatch(
      {
        urls: [`http://127.0.0.1:${address.port}`, 'http://127.0.0.1:1'],
        account: 'safe@example.invalid',
        password: 'runtime-only',
      },
      (value) =>
        progress.push({ current: value.current, total: value.total, status: value.status }),
    );
    expect(result.successes).toHaveLength(1);
    expect(result.failures).toEqual([
      { url: 'http://127.0.0.1:1', error: '站点地址无效、网络不可用或服务异常' },
    ]);
    expect(service.listSites().sites).toHaveLength(1);
    expect(progress).toEqual([
      { current: 1, total: 2, status: 'success' },
      { current: 2, total: 2, status: 'failed' },
    ]);
  }, 20_000);
});
