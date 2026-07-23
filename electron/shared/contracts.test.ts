import { describe, expect, it } from 'vitest';
import {
  appSettingsSchema,
  channelDetailViewSchema,
  channelStatusRequestSchema,
  channelViewSchema,
  floatingSettingsSchema,
  keyPreferenceSchema,
  notificationSettingsSchema,
  availableRateGroupSchema,
  rateContextsSchema,
  rechargeRatioRequestSchema,
  siteInputSchema,
  usageRecordSchema,
  usageQuerySchema,
  usageFilterOptionsSchema,
  apiKeyListQuerySchema,
  apiKeyGroupUpdateRequestSchema,
  apiKeyListPayloadSchema,
  apiKeyBatchUsageRequestSchema,
  apiKeySummarySchema,
  siteSummarySchema,
  usageStatsSchema,
} from './contracts.js';

describe('IPC boundary schemas', () => {
  it('rejects arbitrary channel fields at the IPC boundary', () => {
    expect(() =>
      channelViewSchema.parse({
        state: 'supported',
        channels: [
          {
            id: '1',
            name: 'safe',
            platform: 'openai',
            groupName: 'default',
            primaryModel: 'model',
            extraModels: [],
            status: 'normal',
            timeline: [],
            secretConfig: 'must-not-pass',
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      channelDetailViewSchema.parse({
        state: 'supported',
        detail: {
          id: '1',
          name: 'safe',
          platform: 'openai',
          groupName: 'default',
          models: [],
          privateLog: 'must-not-pass',
        },
      }),
    ).toThrow();
  });

  it('rejects malformed identifiers, unsafe settings, and oversized queries', () => {
    expect(() =>
      channelStatusRequestSchema.parse({ siteId: '', channelId: '../secret' }),
    ).toThrow();
    expect(() => keyPreferenceSchema.parse({ mode: 'manual' })).toThrow();
    expect(() =>
      notificationSettingsSchema.parse({ enabled: true, threshold: -1, cooldownMs: 0, sites: {} }),
    ).toThrow();
    expect(() => usageQuerySchema.parse({ siteId: 'a', page: 1, pageSize: 1000 })).toThrow();
    expect(() =>
      siteInputSchema.parse({ name: '', url: 'file:///tmp/a', account: 'x', password: 'x' }),
    ).toThrow();
  });

  it('allows only the safe reasoning effort field on usage records', () => {
    const record = {
      id: '1',
      createdAt: '2026-07-14T00:00:00Z',
      apiKeyLabel: 'Key · 1234',
      model: 'test-model',
      reasoningEffort: 'high',
      groupName: 'Default',
      requestType: 'chat',
      inputTokens: 1,
      outputTokens: 2,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: 3,
      actualCost: 0.01,
      totalCost: 0.01,
      durationMs: 100,
    };

    expect(usageRecordSchema.parse(record).reasoningEffort).toBe('high');
    expect(() => usageRecordSchema.parse({ ...record, ipAddress: '192.0.2.1' })).toThrow();
  });

  it('keeps usage filters and floating position settings strict', () => {
    expect(
      usageFilterOptionsSchema.parse({
        models: ['gpt-5.4'],
        groups: [{ id: '25', name: '高并发通道' }],
      }),
    ).toEqual({ models: ['gpt-5.4'], groups: [{ id: '25', name: '高并发通道' }] });
    expect(() =>
      usageFilterOptionsSchema.parse({ models: [], groups: [], accessToken: 'secret' }),
    ).toThrow();
    expect(floatingSettingsSchema.parse({ position: 'top-right' })).toEqual({
      position: 'top-right',
      opacity: 84,
    });
    expect(floatingSettingsSchema.parse({ position: 'bottom-left', opacity: 35 })).toEqual({
      position: 'bottom-left',
      opacity: 35,
    });
    expect(
      floatingSettingsSchema.parse({
        position: 'custom',
        x: -420,
        y: 120,
        opacity: 84,
      }),
    ).toEqual({ position: 'custom', x: -420, y: 120, opacity: 84 });
    expect(() => floatingSettingsSchema.parse({ position: 'custom', x: 10 })).toThrow();
    expect(() => floatingSettingsSchema.parse({ position: 'top-right', opacity: 34 })).toThrow();
    expect(() => floatingSettingsSchema.parse({ position: 'top-right', opacity: 101 })).toThrow();
    expect(() => floatingSettingsSchema.parse({ position: 'center' })).toThrow();
  });

  it('accepts only supported persisted application settings', () => {
    expect(
      appSettingsSchema.parse({
        refreshIntervalMinutes: 5,
        floatingEnabled: true,
        staleAfterMinutes: 10,
      }),
    ).toEqual({ refreshIntervalMinutes: 5, floatingEnabled: true, staleAfterMinutes: 10 });
    expect(() =>
      appSettingsSchema.parse({
        refreshIntervalMinutes: 3,
        floatingEnabled: true,
        staleAfterMinutes: 10,
      }),
    ).toThrow();
  });

  it('keeps available rate groups and recharge ratios strict', () => {
    expect(
      availableRateGroupSchema.parse({
        id: '25',
        name: '特惠通道',
        description: '公开说明',
        platform: 'openai',
        status: 'active',
        rate: 0,
      }),
    ).toEqual({
      id: '25',
      name: '特惠通道',
      description: '公开说明',
      platform: 'openai',
      status: 'active',
      rate: 0,
    });
    expect(() =>
      availableRateGroupSchema.parse({
        id: '25',
        name: '特惠通道',
        platform: 'openai',
        rate: 0.4,
        accessToken: 'must-not-pass',
      }),
    ).toThrow();
    expect(rechargeRatioRequestSchema.parse({ siteId: 'site-a', ratio: 10 })).toEqual({
      siteId: 'site-a',
      ratio: 10,
    });
    for (const ratio of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => rechargeRatioRequestSchema.parse({ siteId: 'site-a', ratio })).toThrow();
  });

  it('rejects secret fields from cached rate contexts', () => {
    const context = {
      sites: {
        'site-a': {
          siteId: 'site-a',
          groups: [{ id: '25', name: '特惠通道', platform: 'openai', status: 'active', rate: 0.4 }],
          fetchedAt: 1_721_000_000_000,
          source: 'cache',
          state: 'success',
        },
      },
      ratios: { 'site-a': 10 },
    };
    expect(rateContextsSchema.parse(context)).toEqual(context);
    expect(() =>
      rateContextsSchema.parse({
        ...context,
        sites: {
          'site-a': { ...context.sites['site-a'], password: 'must-not-pass' },
        },
      }),
    ).toThrow();
  });

  it('keeps API key list, update, and usage contracts strict and secret-free', () => {
    expect(
      apiKeyListQuerySchema.parse({
        siteId: 'site-a',
        page: 2,
        pageSize: 100,
        search: 'daily',
        groupId: '25',
        status: 'active',
      }),
    ).toMatchObject({ page: 2, pageSize: 100, status: 'active' });
    expect(() =>
      apiKeyListQuerySchema.parse({ siteId: 'site-a', page: 1, pageSize: 101 }),
    ).toThrow();
    expect(() =>
      apiKeyGroupUpdateRequestSchema.parse({
        siteId: 'site-a',
        keyId: '11',
        groupId: '25',
        name: 'must-not-pass',
      }),
    ).toThrow();
    expect(() =>
      apiKeyBatchUsageRequestSchema.parse({
        siteId: 'site-a',
        keyIds: Array.from({ length: 101 }, (_, index) => String(index + 1)),
      }),
    ).toThrow();

    const payload = apiKeyListPayloadSchema.parse({
      items: [
        {
          id: '11',
          name: 'Daily',
          maskedLabel: 'sk-xxx...A1B2',
          status: 'active',
          groupId: '25',
          groupName: 'OpenAI',
          platform: 'openai',
          effectiveRate: 0,
          currentConcurrency: 2,
          quota: 20,
          quotaUsed: 3,
          expiresAt: '2026-08-01T00:00:00Z',
          createdAt: '2026-07-01T00:00:00Z',
        },
      ],
      page: 1,
      pageSize: 20,
      pages: 1,
      total: 1,
    });
    expect(payload.items[0].effectiveRate).toBe(0);
    expect(() =>
      apiKeyListPayloadSchema.parse({
        ...payload,
        items: [{ ...payload.items[0], key: 'not-allowed-at-ipc-boundary' }],
      }),
    ).toThrow();
  });

  it('keeps only safe effective-key identity and subscription metadata in overview contracts', () => {
    expect(
      siteSummarySchema.parse({
        id: 'site-a',
        name: 'A',
        baseUrl: 'https://example.invalid',
        status: 'success',
        source: 'live',
        errors: [],
        defaultKeyId: '11',
      }).defaultKeyId,
    ).toBe('11');
    expect(
      apiKeySummarySchema.parse({
        id: '11',
        name: 'Subscription',
        maskedLabel: 'sk-xxx...0011',
        status: 'active',
        subscriptionType: 'monthly',
      }).subscriptionType,
    ).toBe('monthly');
  });

  it('allows only confirmed usage filter enums and safe server statistics', () => {
    expect(
      usageQuerySchema.parse({
        siteId: 'site-a',
        requestType: 'ws_v2',
        billingType: '1',
        billingMode: 'per_request',
      }),
    ).toMatchObject({ requestType: 'ws_v2', billingType: '1', billingMode: 'per_request' });
    expect(() => usageQuerySchema.parse({ siteId: 'site-a', requestType: 'chat' })).toThrow();
    expect(() => usageQuerySchema.parse({ siteId: 'site-a', billingType: '2' })).toThrow();
    expect(() => usageQuerySchema.parse({ siteId: 'site-a', billingMode: 'standard' })).toThrow();
    expect(
      usageStatsSchema.parse({
        totalRequests: 4,
        totalTokens: 12,
        totalInputTokens: 7,
        totalOutputTokens: 3,
        totalCacheReadTokens: 1,
        totalCacheCreationTokens: 1,
        totalActualCost: 0.2,
        totalCost: 0.3,
        averageDurationMs: 350,
      }),
    ).toEqual({
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
    expect(() =>
      usageStatsSchema.parse({
        totalRequests: 4,
        totalTokens: 12,
        totalActualCost: 0.2,
        averageDurationMs: 350,
      }),
    ).toThrow();
  });
});
