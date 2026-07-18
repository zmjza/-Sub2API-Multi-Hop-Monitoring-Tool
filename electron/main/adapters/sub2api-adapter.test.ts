import { describe, expect, it } from 'vitest';
import { Sub2ApiAdapter } from './sub2api-adapter.js';

describe('Sub2ApiAdapter', () => {
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
                      groups: [{ name: 'g', secret: 'drop' }],
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
          platforms: [{ platform: 'openai', groupNames: ['g'], modelNames: ['m'] }],
        },
      ],
      channels: [{ timeline: [{ status: 'degraded' }, { status: 'normal' }] }],
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
              api_key: { id: 11, name: 'Daily Key', key: 'sk-must-not-leave-main' },
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
});
