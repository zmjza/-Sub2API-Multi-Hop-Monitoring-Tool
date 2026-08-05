import { describe, expect, it } from 'vitest';
import { Sub2ApiAdapter } from './sub2api-adapter.js';

describe('Sub2ApiAdapter', () => {
  const fixtureCompleteKey = ['fixture', 'complete', 'value'].join('-');
  const fixtureDetailKey = ['another', 'complete', 'fixture'].join('-');
  it('normalizes profile, keys, rates, and usage statistics', async () => {
    const adapter = new Sub2ApiAdapter({
      getJson: async (path: string) => {
        if (path === '/user/profile') return { balance: 3.2 };
        if (path === '/keys')
          return {
            data: [
              {
                id: 1,
                name: 'main',
                key: 'secret',
                status: 'active',
                group_id: 2,
                quota: 80.88,
                quota_used: 66.5,
              },
            ],
          };
        if (path === '/groups/available') return { data: [{ group_id: 2, ratio: 1.5 }] };
        if (path === '/groups/rates') return { data: { '2': 2 } };
        if (path.startsWith('/usage/stats'))
          return { total_requests: 4, total_tokens: 12, total_actual_cost: 0.2 };
        return {};
      },
    });
    const result = await adapter.readCore('access', 'Asia/Shanghai');
    expect(result.profile.balance).toBe(3.2);
    expect(result.keys[0].maskedLabel).toContain('••••');
    expect(result.keys[0]).toMatchObject({ quota: 80.88, quotaUsed: 66.5 });
    expect(result.rates.get('2')).toBe(2);
    expect(result.usage.totalTokens).toBe(12);
  });

  it('prefers a user-specific rate and falls back to the key embedded group rate', async () => {
    const adapter = new Sub2ApiAdapter({
      getJson: async (path: string) => {
        if (path === '/user/profile') return { data: { balance: 3.2 } };
        if (path === '/keys')
          return {
            data: {
              items: [
                {
                  id: 1,
                  name: 'custom',
                  status: 'active',
                  group_id: 2,
                  group: { id: 2, name: 'Custom', rate_multiplier: 0.2 },
                },
                {
                  id: 2,
                  name: 'default',
                  status: 'active',
                  group_id: 3,
                  group: { id: 3, name: 'Default', rate_multiplier: 0.35 },
                },
              ],
            },
          };
        if (path === '/groups/available')
          return {
            data: [
              { id: 2, rate_multiplier: 0.25 },
              { id: 3, rate_multiplier: 0.4 },
            ],
          };
        if (path === '/groups/rates') return { data: { '2': 0.15 } };
        if (path.startsWith('/usage/stats')) return { data: { total_requests: 1 } };
        return {};
      },
    });

    const result = await adapter.readCore('access', 'Asia/Shanghai');

    expect(result.rates.get('2')).toBe(0.15);
    expect(result.rates.get('3')).toBe(0.35);
  });

  it('marks a missing optional channel monitor as unsupported', async () => {
    const adapter = new Sub2ApiAdapter({
      getJson: async (path: string) => {
        if (path === '/channel-monitors')
          throw {
            code: 'UNSUPPORTED_CAPABILITY',
            message: '不支持',
            retryable: false,
            httpStatus: 404,
          };
        return {};
      },
    });
    await expect(adapter.readOptionalChannels('access')).resolves.toEqual({
      state: 'unsupported',
      channels: [],
    });
  });

  it('normalizes channel summaries without leaking arbitrary upstream fields', async () => {
    const adapter = new Sub2ApiAdapter({
      getJson: async () => ({
        data: {
          items: [
            {
              id: 7,
              name: 'Primary',
              provider: 'openai',
              group_name: 'Default',
              primary_model: 'test-model',
              primary_status: 'operational',
              primary_latency_ms: 820,
              primary_ping_latency_ms: 42,
              availability_7d: 99.82,
              extra_models: ['fallback-model'],
              timeline: [
                {
                  status: 'degraded',
                  latency_ms: 900,
                  ping_latency_ms: 50,
                  checked_at: '2026-07-13T00:00:00Z',
                  private_log: 'must-not-leave-main',
                },
              ],
              endpoint_token: 'must-not-leave-main',
            },
          ],
        },
      }),
    });

    const result = await adapter.readOptionalChannels('access');

    expect(result).toEqual({
      state: 'supported',
      availableChannelsState: 'empty',
      channels: [
        {
          id: '7',
          name: 'Primary',
          platform: 'openai',
          groupName: 'Default',
          primaryModel: 'test-model',
          extraModels: ['fallback-model'],
          status: 'normal',
          latencyMs: 820,
          pingMs: 42,
          availability7d: 99.82,
          timeline: [
            {
              status: 'degraded',
              latencyMs: 900,
              pingMs: 50,
              checkedAt: '2026-07-13T00:00:00Z',
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leave-main');
  });

  it('normalizes the three upstream channel states used for stability checks', async () => {
    const adapter = new Sub2ApiAdapter({
      getJson: async () => ({
        data: {
          items: [
            { id: 1, name: 'normal', primary_status: 'operational' },
            { id: 2, name: 'degraded', primary_status: 'degraded' },
            { id: 3, name: 'failed', primary_status: 'error' },
          ],
        },
      }),
    });

    await expect(adapter.readOptionalChannels('access')).resolves.toMatchObject({
      channels: [
        { name: 'normal', status: 'normal' },
        { name: 'degraded', status: 'degraded' },
        { name: 'failed', status: 'failed' },
      ],
    });
  });

  it('normalizes optional channel relationships and orders timeline by checked time', async () => {
    const adapter = new Sub2ApiAdapter({
      getJson: async (path: string) =>
        path === '/channels/available'
          ? {
              data: [
                {
                  name: 'codex',
                  platforms: [
                    {
                      platform: 'openai',
                      groups: [{ id: 9, name: 'g', secret: 'drop' }],
                      supported_models: [{ name: 'm', secret: 'drop' }],
                    },
                  ],
                },
              ],
            }
          : {
              data: {
                items: [
                  {
                    id: 1,
                    name: 'c',
                    provider: 'openai',
                    timeline: [
                      { status: 'operational', checked_at: '2026-01-02T00:00:00Z' },
                      { status: 'degraded', checked_at: '2026-01-01T00:00:00Z' },
                    ],
                  },
                ],
              },
            },
    });
    await expect(adapter.readOptionalChannels('access')).resolves.toMatchObject({
      availableChannels: [
        {
          name: 'codex',
          platforms: [
            { platform: 'openai', groupIds: ['9'], groupNames: ['g'], modelNames: ['m'] },
          ],
        },
      ],
      channels: [{ timeline: [{ status: 'degraded' }, { status: 'normal' }] }],
    });
  });

  it('marks available relationships partial when upstream omits group ids', async () => {
    const adapter = new Sub2ApiAdapter({
      getJson: async (path: string) =>
        path === '/channels/available'
          ? {
              data: [
                {
                  name: 'codex-pro',
                  platforms: [{ platform: 'openai', groups: [{ name: 'codex-plus' }] }],
                },
              ],
            }
          : { data: [] },
    });
    await expect(adapter.readOptionalChannels('access')).resolves.toMatchObject({
      state: 'supported',
      availableChannelsState: 'partial',
    });
  });

  it('reads per-key request counts for automatic default-key selection', async () => {
    const adapter = new Sub2ApiAdapter({
      getJson: async (path: string) => ({ total_requests: path.includes('api_key_id=a') ? 2 : 7 }),
    });
    await expect(
      adapter.readTodayRequestsByKey('access', [{ id: 'a' }, { id: 'b' }], 'Asia/Shanghai'),
    ).resolves.toEqual({ a: 2, b: 7 });
  });

  it('uses bounded concurrency for per-key request counts', async () => {
    let active = 0;
    let maximum = 0;
    const adapter = new Sub2ApiAdapter(
      {
        getJson: async (path: string) => {
          active += 1;
          maximum = Math.max(maximum, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active -= 1;
          return {
            total_requests: Number(new URL(path, 'https://local').searchParams.get('api_key_id')),
          };
        },
      },
      async () => undefined,
    );

    const result = await adapter.readTodayRequestsByKey(
      'access',
      Array.from({ length: 8 }, (_, index) => ({ id: String(index + 1) })),
      'Asia/Shanghai',
    );

    expect(maximum).toBeGreaterThan(1);
    expect(maximum).toBeLessThanOrEqual(4);
    expect(result).toMatchObject({ '1': 1, '8': 8 });
  });

  it('publishes normalized keys before later core requests finish', async () => {
    let releaseGroups: (() => void) | undefined;
    const groupsBlocked = new Promise<void>((resolve) => {
      releaseGroups = resolve;
    });
    const published: Array<Array<{ id: string }>> = [];
    const adapter = new Sub2ApiAdapter(
      {
        getJson: async (path: string) => {
          if (path === '/user/profile') return { data: { balance: 1 } };
          if (path === '/keys')
            return { data: { items: [{ id: 'early', name: 'Early', status: 'active' }] } };
          if (path === '/groups/available') {
            await groupsBlocked;
            return { data: [] };
          }
          if (path === '/groups/rates') return { data: {} };
          return { data: {} };
        },
      },
      async () => undefined,
      () => undefined,
      (keys) => published.push(keys),
    );

    const core = adapter.readCore('access', 'Asia/Shanghai');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(published[0]).toEqual([expect.objectContaining({ id: 'early' })]);
    releaseGroups?.();
    await core;
  });

  it('reads channel detail and keeps a missing detail endpoint local to the capability', async () => {
    const supported = new Sub2ApiAdapter({
      getJson: async () => ({
        data: {
          id: 7,
          name: 'Primary',
          provider: 'openai',
          group_name: 'Default',
          models: [
            {
              model: 'test-model',
              latest_status: 'degraded',
              latest_latency_ms: 700,
              availability_7d: 99.5,
              availability_15d: 98.5,
              availability_30d: 97.5,
              avg_latency_7d_ms: 650,
              private_log: 'must-not-leave-main',
            },
          ],
        },
      }),
    });
    await expect(supported.readChannelStatus('access', 'channel-a')).resolves.toEqual({
      state: 'supported',
      detail: {
        id: '7',
        name: 'Primary',
        platform: 'openai',
        groupName: 'Default',
        models: [
          {
            model: 'test-model',
            status: 'degraded',
            latestLatencyMs: 700,
            availability7d: 99.5,
            availability15d: 98.5,
            availability30d: 97.5,
            averageLatency7dMs: 650,
          },
        ],
      },
    });
    const unsupported = new Sub2ApiAdapter({
      getJson: async () => {
        throw { code: 'UNSUPPORTED_CAPABILITY' };
      },
    });
    await expect(unsupported.readChannelStatus('access', 'channel-a')).resolves.toEqual({
      state: 'unsupported',
      detail: undefined,
    });
  });

  it('normalizes usage records and strips nested secrets before returning them', async () => {
    const adapter = new Sub2ApiAdapter({
      getJson: async () => ({
        data: {
          items: [
            {
              id: 7,
              created_at: '2026-07-13T00:00:00Z',
              api_key_id: 11,
              api_key: { id: 11, name: 'Daily Key', key: 'fixture-must-not-leave-main' },
              user: { email: 'private@example.invalid' },
              ip_address: '192.0.2.1',
              user_agent: 'private-agent',
              group: { id: 3, name: 'Default' },
              model: 'test-model',
              reasoning_effort: 'xhigh',
              request_type: 'chat',
              billing_type: 1,
              billing_mode: 'standard',
              input_tokens: 10,
              output_tokens: 20,
              cache_read_tokens: 30,
              cache_creation_tokens: 40,
              image_output_tokens: 5,
              actual_cost: 0.2,
              total_cost: 0.5,
              duration_ms: 1234,
            },
          ],
          page: 1,
          page_size: 20,
          pages: 2,
          total: 21,
        },
      }),
    });

    const result = await adapter.readUsage('access', { page: 1 });

    expect(result).toEqual({
      items: [
        {
          id: '7',
          createdAt: '2026-07-13T00:00:00Z',
          apiKeyId: '11',
          apiKeyLabel: 'Daily Key',
          model: 'test-model',
          reasoningEffort: 'xhigh',
          groupId: '3',
          groupName: 'Default',
          requestType: 'chat',
          billingType: '1',
          billingMode: 'standard',
          inputTokens: 10,
          outputTokens: 20,
          cacheReadTokens: 30,
          cacheCreationTokens: 40,
          totalTokens: 105,
          actualCost: 0.2,
          totalCost: 0.5,
          durationMs: 1234,
        },
      ],
      page: 1,
      pageSize: 20,
      pages: 2,
      total: 21,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /sk-must|private@example|192\.0\.2\.1|private-agent/,
    );
  });

  it('reads safe model and group options from the upstream usage filter endpoints', async () => {
    const adapter = new Sub2ApiAdapter({
      getJson: async (path: string) => {
        if (path === '/groups/available')
          return {
            data: [{ id: 25, name: '高并发通道', rate_multiplier: 0.2, private_note: 'secret' }],
          };
        if (path.startsWith('/usage/dashboard/models'))
          return { data: { models: [{ model: 'gpt-5.4' }, { name: 'claude-sonnet-4' }] } };
        return {};
      },
    });

    await expect(adapter.readUsageFilters('access', 'Asia/Shanghai')).resolves.toEqual({
      models: ['gpt-5.4', 'claude-sonnet-4'],
      groups: [{ id: '25', name: '高并发通道', rate: 0.2 }],
    });
  });

  it('normalizes safe available rate groups with timezone without leaking upstream fields', async () => {
    let requestedPath = '';
    const adapter = new Sub2ApiAdapter({
      getJson: async (path: string) => {
        requestedPath = path;
        return {
          data: {
            data: [
              {
                id: 25,
                name: 'OpenAI 特惠',
                description: '公开说明',
                platform: 'openai',
                status: 'active',
                rate_multiplier: 0.4,
                private_note: 'must-not-pass',
                secret_config: { token: 'must-not-pass' },
              },
              {
                group_id: 26,
                group_name: 'Claude 免费',
                platform: 'anthropic',
                status: 'active',
                ratio: 0,
              },
              {
                id: 27,
                name: '停用分组',
                platform: 'gemini',
                status: 'disabled',
                rate_multiplier: 0.2,
              },
              { id: 28, name: '负数无效', platform: 'openai', rate_multiplier: -1 },
              { id: 29, name: '缺少倍率', platform: 'openai' },
            ],
          },
        };
      },
    });

    const result = await adapter.readAvailableRateGroups('access', 'Asia/Shanghai');

    expect(requestedPath).toBe('/groups/available?timezone=Asia%2FShanghai');
    expect(result).toEqual([
      {
        id: '25',
        name: 'OpenAI 特惠',
        description: '公开说明',
        platform: 'openai',
        status: 'active',
        rate: 0.4,
      },
      {
        id: '26',
        name: 'Claude 免费',
        platform: 'anthropic',
        status: 'active',
        rate: 0,
      },
      {
        id: '27',
        name: '停用分组',
        platform: 'gemini',
        status: 'disabled',
        rate: 0.2,
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/private|secret|token/i);
  });

  it('publishes groups without waiting for the slower model endpoint', async () => {
    let releaseModels: (() => void) | undefined;
    const modelsBlocked = new Promise<void>((resolve) => {
      releaseModels = resolve;
    });
    const adapter = new Sub2ApiAdapter({
      getJson: async (path: string) => {
        if (path === '/groups/available') return { data: [{ id: 25, name: '立即分组' }] };
        if (path.startsWith('/usage/dashboard/models')) {
          await modelsBlocked;
          return { data: { models: ['late-model'] } };
        }
        return {};
      },
    });

    const groups = adapter.readUsageGroups('access');
    const models = adapter.readUsageModels('access', 'Asia/Shanghai');

    await expect(groups).resolves.toEqual([{ id: '25', name: '立即分组' }]);
    let modelsSettled = false;
    void models.then(() => {
      modelsSettled = true;
    });
    await Promise.resolve();
    expect(modelsSettled).toBe(false);
    releaseModels?.();
    await expect(models).resolves.toEqual(['late-model']);
  });

  it('keeps absent usage metrics undefined instead of inventing zeroes', async () => {
    const adapter = new Sub2ApiAdapter({
      getJson: async () => ({ data: { items: [{ id: 'missing-metrics', model: 'test-model' }] } }),
    });
    const result = await adapter.readUsage('access', { page: 1 });
    expect(result.items[0]).toMatchObject({ id: 'missing-metrics', model: 'test-model' });
    expect(result.items[0].durationMs).toBeUndefined();
    expect(result.items[0].actualCost).toBeUndefined();
    expect(result.items[0].totalTokens).toBeUndefined();
  });

  it('normalizes first-token latency and reads additional key pages', async () => {
    const adapter = new Sub2ApiAdapter({
      getJson: async (path: string) => {
        if (path === '/keys') return { data: { items: [{ id: 1, name: 'first' }], pages: 2 } };
        if (path.startsWith('/keys?page=2'))
          return { data: { items: [{ id: 2, name: 'second' }], pages: 2 } };
        if (path.startsWith('/usage?'))
          return { data: { items: [{ id: 1, first_token_ms: 10000, duration_ms: 20000 }] } };
        return { data: [] };
      },
    });
    const core = await adapter.readCore('access', 'Asia/Shanghai');
    expect(core.keys).toHaveLength(2);
    const usage = await adapter.readUsage('access', { page: 1 });
    expect(usage.items[0]).toMatchObject({ firstTokenMs: 10000, durationMs: 20000 });
  });

  it('reads a filtered key page and strips the complete key and arbitrary upstream fields', async () => {
    let requestedPath = '';
    const adapter = new Sub2ApiAdapter({
      getJson: async (path: string) => {
        requestedPath = path;
        return {
          data: {
            items: [
              {
                id: 11,
                name: 'Daily',
                key: fixtureCompleteKey,
                status: 'active',
                group_id: 25,
                group: {
                  id: 25,
                  name: 'OpenAI',
                  platform: 'openai',
                  rate_multiplier: 0,
                  subscription_type: 'standard',
                },
                current_concurrency: 2,
                quota: 20,
                quota_used: 3,
                expires_at: '2099-08-01T00:00:00Z',
                created_at: '2026-07-01T00:00:00Z',
                private_note: 'must-not-pass',
              },
            ],
            page: 2,
            page_size: 20,
            pages: 3,
            total: 41,
          },
        };
      },
    });

    const result = await adapter.readApiKeyPage('access', {
      page: 2,
      pageSize: 20,
      search: 'Daily',
      groupId: '25',
      status: 'active',
    });

    expect(requestedPath).toBe(
      '/keys?page=2&page_size=20&search=Daily&group_id=25&status=active&sort_by=created_at&sort_order=desc',
    );
    expect(result).toEqual({
      items: [
        {
          id: '11',
          name: 'Daily',
          apiKey: fixtureCompleteKey,
          maskedLabel: 'sk-xxx...alue',
          status: 'active',
          groupId: '25',
          groupName: 'OpenAI',
          platform: 'openai',
          effectiveRate: 0,
          subscriptionType: 'standard',
          currentConcurrency: 2,
          quota: 20,
          quotaUsed: 3,
          expiresAt: '2099-08-01T00:00:00Z',
          createdAt: '2026-07-01T00:00:00Z',
        },
      ],
      page: 2,
      pageSize: 20,
      pages: 3,
      total: 41,
    });
    expect(JSON.stringify(result)).not.toMatch(/private_note|must-not-pass/);
  });

  it('does not expose an entire malformed short key in its masked summary', async () => {
    const adapter = new Sub2ApiAdapter({
      getJson: async () => ({
        data: { items: [{ id: 12, name: 'Short', key: 'abc', status: 'active' }] },
      }),
    });

    const result = await adapter.readApiKeyPage('access', { page: 1, pageSize: 20 });

    expect(result.items[0]?.maskedLabel).toBe('sk-xxx...xabc');
    expect(result.items[0]?.maskedLabel).not.toBe('sk-xxx...abc');
  });

  it('merges available groups with user rates while preserving a zero multiplier', async () => {
    const adapter = new Sub2ApiAdapter({
      getJson: async (path: string) =>
        path === '/groups/rates'
          ? { data: { '25': 0 } }
          : {
              data: [
                {
                  id: 25,
                  name: 'OpenAI',
                  platform: 'openai',
                  status: 'active',
                  rate_multiplier: 0.4,
                  subscription_type: 'standard',
                  private_note: 'must-not-pass',
                },
              ],
            },
    });

    await expect(adapter.readApiKeyGroups('access')).resolves.toEqual([
      {
        id: '25',
        name: 'OpenAI',
        platform: 'openai',
        status: 'active',
        defaultRate: 0.4,
        effectiveRate: 0,
        subscriptionType: 'standard',
      },
    ]);
    await expect(adapter.readApiKeyGroupRates('access')).resolves.toEqual({ '25': 0 });
  });

  it('reads key detail and writes only group_id before returning the complete key for transient display/copy', async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    const adapter = new Sub2ApiAdapter({
      getJson: async (path: string) => {
        calls.push({ method: 'GET', path });
        return {
          data: {
            id: 11,
            name: 'Daily',
            key: fixtureDetailKey,
            status: 'active',
            group_id: 25,
            group: { id: 25, name: 'OpenAI' },
          },
        };
      },
      putJson: async (path: string, _token: string, _capability: string, body: unknown) => {
        calls.push({ method: 'PUT', path, body });
        return { data: { ok: true } };
      },
      postJson: async () => ({}),
    });

    await adapter.updateApiKeyGroup('access', '11', '25');
    const detail = await adapter.readApiKeyDetail('access', '11');

    expect(calls).toEqual([
      { method: 'PUT', path: '/keys/11', body: { group_id: 25 } },
      { method: 'GET', path: '/keys/11' },
    ]);
    expect(detail).toMatchObject({ id: '11', groupId: '25', apiKey: fixtureDetailKey });
  });

  it('splits batch key usage into at most 100 ids and leaves missing metrics absent', async () => {
    const bodies: unknown[] = [];
    const adapter = new Sub2ApiAdapter({
      getJson: async () => ({}),
      putJson: async () => ({}),
      postJson: async (_path: string, _token: string, _capability: string, body: unknown) => {
        bodies.push(body);
        const ids = (body as { api_key_ids: number[] }).api_key_ids;
        return {
          data: {
            stats: Object.fromEntries(
              ids
                .slice(0, 1)
                .map((id) => [
                  String(id),
                  { api_key_id: id, today_actual_cost: id / 100, total_actual_cost: id / 10 },
                ]),
            ),
          },
        };
      },
    });

    const result = await adapter.readBatchApiKeyUsage(
      'access',
      Array.from({ length: 101 }, (_, index) => String(index + 1)),
    );

    expect(bodies).toHaveLength(2);
    expect((bodies[0] as { api_key_ids: number[] }).api_key_ids).toHaveLength(100);
    expect((bodies[1] as { api_key_ids: number[] }).api_key_ids).toEqual([101]);
    expect(result['1']).toEqual({ apiKeyId: '1', todayActualCost: 0.01, totalActualCost: 0.1 });
    expect(result['2']).toBeUndefined();
    expect(result['101']).toEqual({
      apiKeyId: '101',
      todayActualCost: 1.01,
      totalActualCost: 10.1,
    });
  });

  it('sums 30-day actual cost and keeps absent daily cost distinguishable', async () => {
    let requestedPath = '';
    const adapter = new Sub2ApiAdapter({
      getJson: async (path: string) => {
        requestedPath = path;
        return {
          data: {
            items: [
              { date: '2026-07-01', actual_cost: 0.2 },
              { date: '2026-07-02', actual_cost: 0.3 },
              { date: '2026-07-03' },
            ],
          },
        };
      },
    });

    await expect(adapter.readApiKeyDailyUsage('access', '11', 'Asia/Shanghai')).resolves.toEqual({
      apiKeyId: '11',
      actualCost30d: 0.5,
      days: [
        { date: '2026-07-01', actualCost: 0.2 },
        { date: '2026-07-02', actualCost: 0.3 },
        { date: '2026-07-03' },
      ],
    });
    expect(requestedPath).toBe('/user/api-keys/11/usage/daily?days=30&timezone=Asia%2FShanghai');
  });

  it('uses one normalized filter query for usage list and server statistics', async () => {
    const paths: string[] = [];
    const adapter = new Sub2ApiAdapter({
      getJson: async (path: string) => {
        paths.push(path);
        return path.startsWith('/usage/stats')
          ? {
              data: {
                total_requests: 4,
                total_tokens: 12,
                total_input_tokens: 7,
                total_output_tokens: 3,
                total_cache_read_tokens: 1,
                total_cache_creation_tokens: 1,
                total_actual_cost: 0.2,
                total_cost: 0.3,
                average_duration_ms: 350,
              },
            }
          : { data: { items: [], page: 1, page_size: 20, pages: 0, total: 0 } };
      },
    });
    const query = {
      page: 1,
      page_size: 20,
      api_key_id: '11',
      request_type: 'ws_v2',
      billing_type: '1',
      billing_mode: 'per_request',
      start_date: '2026-07-01',
      end_date: '2026-07-02',
      timezone: 'Asia/Shanghai',
      sort_by: 'created_at',
      sort_order: 'desc',
    };

    await adapter.readUsage('access', query);
    await expect(adapter.readUsageStats('access', query)).resolves.toMatchObject({
      totalRequests: 4,
      totalTokens: 12,
      totalInputTokens: 7,
      totalOutputTokens: 3,
      totalCacheReadTokens: 1,
      totalCacheCreationTokens: 1,
      totalActualCost: 0.2,
      totalCost: 0.3,
      averageDurationMs: 350,
    });

    const listParams = new URL(paths[0]!, 'https://local').searchParams;
    const statsParams = new URL(paths[1]!, 'https://local').searchParams;
    for (const key of [
      'api_key_id',
      'request_type',
      'billing_type',
      'billing_mode',
      'start_date',
      'end_date',
      'timezone',
    ]) {
      expect(statsParams.get(key)).toBe(listParams.get(key));
    }
    expect(statsParams.has('page')).toBe(false);
    expect(statsParams.has('page_size')).toBe(false);
    expect(statsParams.has('sort_by')).toBe(false);
    expect(statsParams.has('sort_order')).toBe(false);
  });
});
