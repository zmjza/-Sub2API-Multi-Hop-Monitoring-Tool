import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { Sub2ApiClient } from './http-client.js';
import { Sub2ApiAdapter } from './sub2api-adapter.js';

const servers: Array<ReturnType<typeof createServer>> = [];
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

describe('local mock sub2api integration', () => {
  it('runs login and normalized core reads through a real local HTTP boundary', async () => {
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      const path = request.url ?? '';
      if (path === '/api/v1/auth/login')
        return response.end(
          JSON.stringify({
            code: 0,
            data: {
              access_token: 'mock-access',
              refresh_token: 'mock-refresh',
              expires_in: 60,
              token_type: 'Bearer',
              user: { id: 1, role: 'user', balance: 5, status: 'active' },
            },
          }),
        );
      if (path === '/api/v1/user/profile')
        return response.end(JSON.stringify({ data: { balance: 5 } }));
      if (path === '/api/v1/keys')
        return response.end(
          JSON.stringify({
            data: [{ id: 'key-a', name: '测试 Key', status: 'active', group_id: 'group-a' }],
          }),
        );
      if (path === '/api/v1/groups/available')
        return response.end(JSON.stringify({ data: [{ id: 'group-a', ratio: 1.5 }] }));
      if (path === '/api/v1/groups/rates')
        return response.end(JSON.stringify({ data: { 'group-a': 2 } }));
      if (path.startsWith('/api/v1/usage/stats'))
        return response.end(
          JSON.stringify({ data: { total_requests: 2, total_tokens: 12, total_actual_cost: 0.2 } }),
        );
      response.statusCode = 404;
      response.end(JSON.stringify({ message: 'missing' }));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('mock server unavailable');
    const client = new Sub2ApiClient(`http://127.0.0.1:${address.port}/api/v1`);
    const session = await client.login('mock@example.invalid', 'runtime-only');
    const adapter = new Sub2ApiAdapter(client, async () => undefined);
    const core = await adapter.readCore(session.accessToken, 'Asia/Shanghai');
    expect(core).toMatchObject({
      profile: { balance: 5 },
      usage: { totalRequests: 2, totalTokens: 12 },
    });
    expect(core.rates.get('group-a')).toBe(2);
    await expect(adapter.readOptionalChannels(session.accessToken)).resolves.toEqual({
      state: 'unsupported',
      channels: [],
    });
  });
});
