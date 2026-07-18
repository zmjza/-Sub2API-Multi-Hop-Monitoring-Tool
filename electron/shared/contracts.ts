import { z } from 'zod';

export const siteInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().trim().url().max(500),
  account: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(512),
});
export type SiteInput = z.infer<typeof siteInputSchema>;
export const batchSiteInputSchema = z.object({
  urls: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  account: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(512),
});
export type BatchSiteInput = z.infer<typeof batchSiteInputSchema>;

export const siteIdSchema = z.string().min(1).max(128);
export const refreshRequestSchema = z.object({ siteId: siteIdSchema });
export const usageQuerySchema = z.object({
  siteId: siteIdSchema,
  period: z.enum(['today', '7d', '30d', 'custom']).default('today'),
  page: z.number().int().positive().max(10_000).default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  apiKeyId: z.string().max(128).optional(),
  model: z.string().max(200).optional(),
  groupId: z.string().max(128).optional(),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
  requestType: z.string().max(80).optional(),
  billingType: z.string().max(80).optional(),
  billingMode: z.string().max(80).optional(),
  sort: z.enum(['asc', 'desc']).default('desc'),
});
export type UsageQuery = z.input<typeof usageQuerySchema>;
export const keyPreferenceSchema = z
  .object({ mode: z.enum(['auto', 'manual']), keyId: z.string().min(1).max(128).optional() })
  .superRefine((value, context) => {
    if (value.mode === 'manual' && !value.keyId)
      context.addIssue({ code: 'custom', path: ['keyId'], message: '手动模式必须选择 Key' });
  });
export const notificationSettingsSchema = z.object({
  enabled: z.boolean(),
  threshold: z.number().finite().min(0),
  cooldownMs: z.number().int().min(0),
  siteFailures: z.boolean().default(true),
  channelFailures: z.boolean().default(true),
  recoveryNotifications: z.boolean().default(true),
  sites: z.record(
    z.string(),
    z.object({ enabled: z.boolean().optional(), threshold: z.number().finite().min(0).optional() }),
  ),
});
export const channelStatusRequestSchema = z.object({
  siteId: siteIdSchema,
  channelId: z.string().min(1).max(128),
});
export const startupSettingSchema = z.object({ enabled: z.boolean() });
export const floatingSettingsSchema = z
  .object({
    position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']),
    opacity: z.number().int().min(35).max(100).default(84),
  })
  .strict();
export const appSettingsSchema = z
  .object({
    refreshIntervalMinutes: z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(15)]),
    floatingEnabled: z.boolean(),
    staleAfterMinutes: z.union([z.literal(2), z.literal(5), z.literal(10), z.literal(30)]),
  })
  .strict();
export const usageFilterOptionsSchema = z
  .object({
    models: z.array(z.string().min(1).max(200)).max(500),
    groups: z
      .array(
        z
          .object({
            id: z.string().min(1).max(128),
            name: z.string().min(1).max(200),
            rate: z.number().nonnegative().optional(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();
export type KeyPreference = z.infer<typeof keyPreferenceSchema>;
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
export type FloatingSettings = z.infer<typeof floatingSettingsSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type UsageFilterOptions = z.infer<typeof usageFilterOptionsSchema>;

export interface SiteSummary {
  id: string;
  name: string;
  baseUrl: string;
  balance?: number;
  todayTokens?: number;
  todayActualCost?: number;
  todayRequests?: number;
  todayInputTokens?: number;
  todayOutputTokens?: number;
  todayCacheReadTokens?: number;
  todayCacheCreationTokens?: number;
  todayTotalCost?: number;
  averageDurationMs?: number;
  status: string;
  source: 'live' | 'cache' | 'none';
  fetchedAt?: number;
  errors: string[];
  defaultKeyLabel?: string;
  rate?: number;
  capabilities?: Record<string, string>;
  estimatedDurationMs?: [number, number];
}

export interface DashboardSnapshot {
  sites: SiteSummary[];
  totals: {
    balance: number;
    todayTokens: number;
    todayActualCost: number;
    counted: number;
    total: number;
  };
  currentSiteId?: string;
}

export const siteSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  balance: z.number().optional(),
  todayTokens: z.number().optional(),
  todayActualCost: z.number().optional(),
  todayRequests: z.number().optional(),
  todayInputTokens: z.number().optional(),
  todayOutputTokens: z.number().optional(),
  todayCacheReadTokens: z.number().optional(),
  todayCacheCreationTokens: z.number().optional(),
  todayTotalCost: z.number().optional(),
  averageDurationMs: z.number().optional(),
  status: z.string(),
  source: z.enum(['live', 'cache', 'none']),
  fetchedAt: z.number().optional(),
  errors: z.array(z.string()),
  defaultKeyLabel: z.string().optional(),
  rate: z.number().optional(),
  capabilities: z.record(z.string(), z.string()).optional(),
  estimatedDurationMs: z.tuple([z.number(), z.number()]).optional(),
});
export const dashboardSnapshotSchema = z.object({
  sites: z.array(siteSummarySchema),
  totals: z.object({
    balance: z.number(),
    todayTokens: z.number(),
    todayActualCost: z.number(),
    counted: z.number(),
    total: z.number(),
  }),
  currentSiteId: z.string().optional(),
});
export const apiKeySummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  maskedLabel: z.string(),
  status: z.enum(['active', 'disabled']),
  groupId: z.string().optional(),
  groupName: z.string().optional(),
});
const normalizedChannelStatusSchema = z.enum(['normal', 'degraded', 'failed', 'unknown']);
const channelTimelinePointSchema = z
  .object({
    status: normalizedChannelStatusSchema,
    latencyMs: z.number().optional(),
    pingMs: z.number().optional(),
    checkedAt: z.string().optional(),
  })
  .strict();
export const channelSummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    platform: z.string(),
    groupName: z.string(),
    primaryModel: z.string(),
    extraModels: z.array(z.string()),
    status: normalizedChannelStatusSchema,
    latencyMs: z.number().optional(),
    pingMs: z.number().optional(),
    availability7d: z.number().optional(),
    timeline: z.array(channelTimelinePointSchema),
  })
  .strict();
const channelModelDetailSchema = z
  .object({
    model: z.string(),
    status: normalizedChannelStatusSchema,
    latestLatencyMs: z.number().optional(),
    availability7d: z.number().optional(),
    availability15d: z.number().optional(),
    availability30d: z.number().optional(),
    averageLatency7dMs: z.number().optional(),
  })
  .strict();
export const channelDetailSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    platform: z.string(),
    groupName: z.string(),
    models: z.array(channelModelDetailSchema),
  })
  .strict();
export const channelViewSchema = z
  .object({
    state: z.enum(['supported', 'unsupported']),
    channels: z.array(channelSummarySchema),
    availableChannels: z
      .array(
        z
          .object({
            name: z.string().min(1).max(200),
            platforms: z
              .array(
                z
                  .object({
                    platform: z.string().min(1).max(100),
                    groupNames: z.array(z.string().min(1).max(200)).max(500),
                    modelNames: z.array(z.string().min(1).max(200)).max(500),
                  })
                  .strict(),
              )
              .max(100),
          })
          .strict(),
      )
      .max(200)
      .optional(),
  })
  .strict();
export const channelDetailViewSchema = z
  .object({
    state: z.enum(['supported', 'unsupported']),
    detail: channelDetailSchema.optional(),
  })
  .strict();
export type ChannelViewPayload = z.infer<typeof channelViewSchema>;
export type ChannelDetailPayload = z.infer<typeof channelDetailViewSchema>;
export const usageRecordSchema = z
  .object({
    id: z.string(),
    createdAt: z.string(),
    apiKeyId: z.string().optional(),
    apiKeyLabel: z.string(),
    model: z.string(),
    reasoningEffort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(),
    groupId: z.string().optional(),
    groupName: z.string(),
    requestType: z.string(),
    billingType: z.string().optional(),
    billingMode: z.string().optional(),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    cacheReadTokens: z.number().optional(),
    cacheCreationTokens: z.number().optional(),
    totalTokens: z.number().optional(),
    actualCost: z.number().optional(),
    totalCost: z.number().optional(),
    durationMs: z.number().optional(),
  })
  .strict();
export const usagePayloadSchema = z
  .object({
    items: z.array(usageRecordSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
  .strict();
export type UsagePayload = z.infer<typeof usagePayloadSchema>;

export interface UsageView {
  siteId: string;
  data: unknown;
  source: 'live' | 'cache';
}

export interface ChannelView {
  state: 'supported' | 'unsupported' | 'error';
  channels: unknown[];
}
