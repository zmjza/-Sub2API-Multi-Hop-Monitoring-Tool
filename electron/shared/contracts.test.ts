import { describe, expect, it } from 'vitest';
import {
  appSettingsSchema,
  channelDetailViewSchema,
  channelStatusRequestSchema,
  channelViewSchema,
  floatingSettingsSchema,
  keyPreferenceSchema,
  notificationSettingsSchema,
  siteInputSchema,
  usageRecordSchema,
  usageQuerySchema,
  usageFilterOptionsSchema,
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
});
