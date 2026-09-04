import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { fetchOpenCodexLogs } from './opencodex-service.js';

const originalToken = process.env.OPENCODEX_ADMIN_AUTH_TOKEN;
const originalHome = process.env.OPENCODEX_HOME;

afterEach(() => {
  if (originalToken === undefined) delete process.env.OPENCODEX_ADMIN_AUTH_TOKEN;
  else process.env.OPENCODEX_ADMIN_AUTH_TOKEN = originalToken;
  if (originalHome === undefined) delete process.env.OPENCODEX_HOME;
  else process.env.OPENCODEX_HOME = originalHome;
});

async function withServer(
  handler: (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
  ) => void,
  run: (baseUrl: string) => Promise<void>,
) {
  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test server has no port');
  const baseUrl = 'http://127.0.0.1:' + address.port;
  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

const samplePayload = {
  timeZone: 'Asia/Shanghai',
  total: 1,
  logs: [
    {
      requestId: 'req-1',
      timestamp: 1_786_700_915_575,
      provider: 'opencode-go',
      model: 'deepseek-v4-flash',
      status: 200,
      durationMs: 1245,
      firstOutputMs: 300,
      inboundProtocol: 'responses',
      usage: { inputTokens: 10, outputTokens: 20 },
      displayMetrics: {
        tokPerSecond: { kind: 'value', value: 16.06, estimated: false },
        cost: { kind: 'value', estimate: { cost: { total: 0.001 } } },
      },
    },
  ],
};

describe('fetchOpenCodexLogs', () => {
  it('paginates request history until every matching entry is loaded', async () => {
    process.env.OPENCODEX_ADMIN_AUTH_TOKEN = 'ocx_admin_testtoken1234567890abcdefghijklmnop';
    let calls = 0;
    await withServer(
      (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        calls += 1;
        expect(url.pathname).toBe('/api/request-history');
        expect(url.searchParams.get('from')).toBe('100');
        expect(url.searchParams.get('to')).toBe('200');
        res.setHeader('Content-Type', 'application/json');
        if (calls === 1) {
          res.end(
            JSON.stringify({
              entries: [{ timestamp: 150, provider: 'p', model: 'm', status: 200 }],
              nextCursor: 'next-page',
              hasMore: true,
            }),
          );
        } else {
          expect(url.searchParams.get('cursor')).toBe('next-page');
          res.end(
            JSON.stringify({
              entries: [{ timestamp: 120, provider: 'p', model: 'm', status: 200 }],
              hasMore: false,
            }),
          );
        }
      },
      async (baseUrl) => {
        const result = await fetchOpenCodexLogs({ from: 100, to: 200 }, { baseUrl });
        expect(calls).toBe(2);
        expect(result.total).toBe(2);
        expect(result.logs.map((entry) => entry.timestamp)).toEqual([150, 120]);
      },
    );
  });

  it('rejects a repeated pagination cursor instead of looping forever', async () => {
    process.env.OPENCODEX_ADMIN_AUTH_TOKEN = 'ocx_admin_testtoken1234567890abcdefghijklmnop';
    await withServer(
      (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ entries: [], nextCursor: 'same', hasMore: true }));
      },
      async (baseUrl) => {
        await expect(fetchOpenCodexLogs({}, { baseUrl })).rejects.toThrow('分页游标重复');
      },
    );
  });

  it('defaults to the 4000-record window', async () => {
    process.env.OPENCODEX_ADMIN_AUTH_TOKEN = 'ocx_admin_testtoken1234567890abcdefghijklmnop';
    await withServer(
      (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        expect(url.pathname).toBe('/api/request-history');
        expect(url.searchParams.get('limit')).toBe('100');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ entries: [], hasMore: false }));
      },
      async (baseUrl) => {
        await expect(fetchOpenCodexLogs({}, { baseUrl })).resolves.toMatchObject({ total: 0 });
      },
    );
  });

  it('sends the bearer token and returns a validated payload', async () => {
    process.env.OPENCODEX_ADMIN_AUTH_TOKEN = 'ocx_admin_testtoken1234567890abcdefghijklmnop';
    await withServer(
      (req, res) => {
        expect(req.headers.authorization).toBe(
          'Bearer ocx_admin_testtoken1234567890abcdefghijklmnop',
        );
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ entries: samplePayload.logs, hasMore: false }));
      },
      async (baseUrl) => {
        const result = await fetchOpenCodexLogs({ limit: 2000 }, { baseUrl });
        expect(result.total).toBe(1);
        expect(result.logs[0]?.model).toBe('deepseek-v4-flash');
      },
    );
  });

  it('passes provider and status query parameters', async () => {
    process.env.OPENCODEX_ADMIN_AUTH_TOKEN = 'ocx_admin_testtoken1234567890abcdefghijklmnop';
    await withServer(
      (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        expect(url.searchParams.get('provider')).toBe('opencode-go');
        expect(url.searchParams.get('status')).toBe('200');
        expect(url.pathname).toBe('/api/request-history');
        expect(url.searchParams.get('limit')).toBe('100');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ entries: [], hasMore: false }));
      },
      async (baseUrl) => {
        const result = await fetchOpenCodexLogs(
          { provider: 'opencode-go', status: '200', limit: 2000 },
          { baseUrl },
        );
        expect(result.logs).toEqual([]);
      },
    );
  });

  it('maps HTTP 401 to a clear unauthorized error without exposing the token', async () => {
    process.env.OPENCODEX_ADMIN_AUTH_TOKEN = 'ocx_admin_testtoken1234567890abcdefghijklmnop';
    await withServer(
      (_req, res) => {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'opencodex admin token required' }));
      },
      async (baseUrl) => {
        await expect(fetchOpenCodexLogs({}, { baseUrl })).rejects.toThrow('OPENCODEX_UNAUTHORIZED');
      },
    );
  });

  it('reports connection failures as unreachable', async () => {
    process.env.OPENCODEX_ADMIN_AUTH_TOKEN = 'ocx_admin_testtoken1234567890abcdefghijklmnop';
    await expect(
      fetchOpenCodexLogs({}, { baseUrl: 'http://127.0.0.1:1', timeoutMs: 1500 }),
    ).rejects.toThrow('OPENCODEX_UNREACHABLE');
  });

  it('rejects invalid JSON payloads', async () => {
    process.env.OPENCODEX_ADMIN_AUTH_TOKEN = 'ocx_admin_testtoken1234567890abcdefghijklmnop';
    await withServer(
      (_req, res) => {
        res.setHeader('Content-Type', 'text/plain');
        res.end('not-json');
      },
      async (baseUrl) => {
        await expect(fetchOpenCodexLogs({}, { baseUrl })).rejects.toThrow('OPENCODEX_INVALID_JSON');
      },
    );
  });

  it('rejects structurally invalid log entries', async () => {
    process.env.OPENCODEX_ADMIN_AUTH_TOKEN = 'ocx_admin_testtoken1234567890abcdefghijklmnop';
    await withServer(
      (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ entries: [{ timestamp: 'bad', model: 42 }], hasMore: false }));
      },
      async (baseUrl) => {
        await expect(fetchOpenCodexLogs({}, { baseUrl })).rejects.toThrow(
          'OPENCODEX_INVALID_PAYLOAD',
        );
      },
    );
  });
});
