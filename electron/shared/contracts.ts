import { z } from 'zod';

export const siteInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().trim().url().max(500),
  account: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(512),
});
export type SiteInput = z.infer<typeof siteInputSchema>;
export const interactiveVerificationProviderSchema = z.enum(['geetest', 'turnstile']);
export type InteractiveVerificationProvider = z.infer<typeof interactiveVerificationProviderSchema>;
export const interactiveVerificationRequestSchema = siteInputSchema.extend({
  provider: interactiveVerificationProviderSchema,
});
export type InteractiveVerificationRequest = z.infer<typeof interactiveVerificationRequestSchema>;
export const batchSiteInputSchema = z.object({
  urls: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  account: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(512),
});
export type BatchSiteInput = z.infer<typeof batchSiteInputSchema>;

export const siteIdSchema = z.string().min(1).max(128);
export const siteOrderRequestSchema = z
  .object({ siteIds: z.array(siteIdSchema).max(1_000) })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.siteIds).size !== value.siteIds.length)
      context.addIssue({ code: 'custom', path: ['siteIds'], message: '站点顺序不能包含重复 ID' });
  });
export type SiteOrderRequest = z.infer<typeof siteOrderRequestSchema>;
export const refreshRequestSchema = z.object({ siteId: siteIdSchema });
export const siteNoteSchema = z.object({ siteId: siteIdSchema, note: z.string().trim().max(500) });
export const usageQuerySchema = z
  .object({
    siteId: siteIdSchema,
    period: z.enum(['today', '7d', '30d', 'custom']).default('today'),
    page: z.number().int().positive().max(10_000).default(1),
    pageSize: z.number().int().positive().max(100).default(20),
    apiKeyId: z.string().max(128).optional(),
    model: z.string().max(200).optional(),
    groupId: z.string().max(128).optional(),
    startDate: z.string().max(40).optional(),
    endDate: z.string().max(40).optional(),
    requestType: z.enum(['unknown', 'sync', 'stream', 'ws_v2', 'cyber']).optional(),
    billingType: z.enum(['0', '1']).optional(),
    billingMode: z.enum(['token', 'per_request', 'image', 'video']).optional(),
    sort: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();
type ParsedUsageQuery = z.input<typeof usageQuerySchema>;
export type UsageQuery = Omit<ParsedUsageQuery, 'requestType' | 'billingType' | 'billingMode'> & {
  requestType?: string;
  billingType?: string;
  billingMode?: string;
};
export type SiteNoteInput = z.infer<typeof siteNoteSchema>;
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
const floatingOpacitySchema = z.number().int().min(35).max(100).default(84);
export const floatingSettingsSchema = z.discriminatedUnion('position', [
  z
    .object({
      position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']),
      opacity: floatingOpacitySchema,
    })
    .strict(),
  z
    .object({
      position: z.literal('custom'),
      x: z.number().int().min(-1_000_000).max(1_000_000),
      y: z.number().int().min(-1_000_000).max(1_000_000),
      opacity: floatingOpacitySchema,
    })
    .strict(),
]);
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

export const availableRateGroupSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(300),
    description: z.string().max(4_000).optional(),
    platform: z.string().min(1).max(100),
    status: z.string().min(1).max(80).optional(),
    rate: z.number().finite().nonnegative(),
  })
  .strict();
export const rateSiteContextSchema = z
  .object({
    siteId: siteIdSchema,
    groups: availableRateGroupSchema.array().max(1_000),
    fetchedAt: z.number().int().nonnegative().optional(),
    source: z.enum(['live', 'cache', 'none']),
    state: z.enum(['success', 'empty', 'error', 'auth-required']),
    error: z.string().max(500).optional(),
  })
  .strict();
export const rateContextsSchema = z
  .object({
    sites: z.record(z.string(), rateSiteContextSchema),
    ratios: z.record(z.string(), z.number().finite().positive()),
  })
  .strict();
export const rechargeRatioRequestSchema = z
  .object({ siteId: siteIdSchema, ratio: z.number().finite().positive() })
  .strict();
export type AvailableRateGroup = z.infer<typeof availableRateGroupSchema>;
export type RateSiteContext = z.infer<typeof rateSiteContextSchema>;
export type RateContexts = z.infer<typeof rateContextsSchema>;

export interface SiteSummary {
  id: string;
  name: string;
  baseUrl: string;
  accountLabel?: string;
  interactiveVerificationProvider?: InteractiveVerificationProvider;
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
  defaultKeyId?: string;
  defaultKeyLabel?: string;
  note?: string;
  iconDataUrl?: string;
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
  accountLabel: z.string().max(320).optional(),
  interactiveVerificationProvider: interactiveVerificationProviderSchema.optional(),
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
  defaultKeyId: z.string().optional(),
  defaultKeyLabel: z.string().optional(),
  note: z.string().max(500).optional(),
  iconDataUrl: z
    .string()
    .max(200_000)
    .regex(/^data:image\/[a-z0-9.+-]+;base64,/i)
    .optional(),
  rate: z.number().optional(),
  capabilities: z.record(z.string(), z.string()).optional(),
  estimatedDurationMs: z.tuple([z.number(), z.number()]).optional(),
});
export const siteAddResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('added'), site: siteSummarySchema }).strict(),
  z
    .object({
      status: z.literal('verification-required'),
      provider: interactiveVerificationProviderSchema,
    })
    .strict(),
]);
export type SiteAddResult = z.infer<typeof siteAddResultSchema>;
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
  quota: z.number().finite().optional(),
  quotaUsed: z.number().finite().optional(),
  subscriptionType: z.string().max(100).optional(),
  rate: z.number().nonnegative().optional(),
});
export const siteKeyContextSchema = z
  .object({
    keys: apiKeySummarySchema.array().max(500),
    preference: keyPreferenceSchema,
  })
  .strict();
export const siteKeyContextsSchema = z.record(z.string(), siteKeyContextSchema);
export type ApiKeySummaryView = z.infer<typeof apiKeySummarySchema>;
export type SiteKeyContext = z.infer<typeof siteKeyContextSchema>;
export type SiteKeyContexts = z.infer<typeof siteKeyContextsSchema>;

const numericEntityIdSchema = z
  .string()
  .regex(/^\d+$/)
  .min(1)
  .max(128)
  .refine((value) => Number.isSafeInteger(Number(value)) && Number(value) > 0, 'ID 超出安全范围');
const channelGroupIdSchema = z.string().trim().min(1).max(128);
export const channelAssociationRequestSchema = z
  .object({
    siteId: siteIdSchema,
    groupId: channelGroupIdSchema,
    channelIds: z.array(z.string().min(1).max(128)).max(200),
  })
  .strict();
export const channelAssociationClearRequestSchema = z
  .object({ siteId: siteIdSchema, groupId: channelGroupIdSchema })
  .strict();
export const channelAssociationSchema = z
  .object({
    siteId: siteIdSchema,
    groupId: channelGroupIdSchema,
    channelIds: z.array(z.string().min(1).max(128)).max(200),
    source: z.enum(['auto', 'manual', 'unmatched']),
  })
  .strict();
export type ChannelAssociation = z.infer<typeof channelAssociationSchema>;
export const apiKeyListQuerySchema = z
  .object({
    siteId: siteIdSchema,
    page: z.number().int().positive().max(10_000).default(1),
    pageSize: z.number().int().positive().max(100).default(20),
    search: z.string().trim().max(100).optional(),
    groupId: numericEntityIdSchema.optional(),
    status: z.enum(['active', 'disabled', 'quota-exhausted', 'expired', 'unknown']).optional(),
    force: z.boolean().default(false),
  })
  .strict();
export const apiKeyDetailRequestSchema = z
  .object({ siteId: siteIdSchema, keyId: numericEntityIdSchema })
  .strict();
export const apiKeyGroupUpdateRequestSchema = z
  .object({
    siteId: siteIdSchema,
    keyId: numericEntityIdSchema,
    groupId: numericEntityIdSchema,
  })
  .strict();
export const apiKeyBatchUsageRequestSchema = z
  .object({
    siteId: siteIdSchema,
    keyIds: z.array(numericEntityIdSchema).min(1).max(100),
  })
  .strict();
export const managedApiKeySchema = z
  .object({
    id: numericEntityIdSchema,
    name: z.string().min(1).max(200),
    maskedLabel: z.string().min(1).max(80),
    apiKey: z.string().min(1).max(512).optional(),
    status: z.enum(['active', 'disabled', 'quota-exhausted', 'expired', 'unknown']),
    groupId: numericEntityIdSchema.optional(),
    groupName: z.string().max(300).optional(),
    platform: z.string().max(100).optional(),
    effectiveRate: z.number().finite().nonnegative().optional(),
    subscriptionType: z.string().max(100).optional(),
    currentConcurrency: z.number().int().nonnegative().optional(),
    quota: z.number().finite().nonnegative().optional(),
    quotaUsed: z.number().finite().nonnegative().optional(),
    expiresAt: z.string().max(80).optional(),
    createdAt: z.string().max(80).optional(),
    todayActualCost: z.number().finite().nonnegative().optional(),
    last30DaysActualCost: z.number().finite().nonnegative().optional(),
  })
  .strict();
export const apiKeyListPayloadSchema = z
  .object({
    items: managedApiKeySchema.array().max(100),
    page: z.number().int().positive(),
    pageSize: z.number().int().nonnegative().max(100),
    pages: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
  .strict();
export const apiKeyGroupSchema = z
  .object({
    id: numericEntityIdSchema,
    name: z.string().min(1).max(300),
    platform: z.string().max(100).optional(),
    status: z.string().max(80).optional(),
    defaultRate: z.number().finite().nonnegative().optional(),
    effectiveRate: z.number().finite().nonnegative().optional(),
    subscriptionType: z.string().max(100).optional(),
  })
  .strict();
export const apiKeyGroupsSchema = apiKeyGroupSchema.array().max(1_000);
export const apiKeyManagementPayloadSchema = z
  .object({
    items: managedApiKeySchema.array().max(100),
    groups: apiKeyGroupsSchema,
    page: apiKeyListPayloadSchema.omit({ items: true }),
    state: z.enum(['success', 'partial']),
  })
  .strict();
export const apiKeyBatchUsageItemSchema = z
  .object({
    apiKeyId: numericEntityIdSchema,
    todayActualCost: z.number().finite().nonnegative().optional(),
    totalActualCost: z.number().finite().nonnegative().optional(),
  })
  .strict();
export const apiKeyBatchUsageSchema = z.record(numericEntityIdSchema, apiKeyBatchUsageItemSchema);
export const apiKeyDailyUsageSchema = z
  .object({
    apiKeyId: numericEntityIdSchema,
    actualCost30d: z.number().finite().nonnegative().optional(),
    days: z
      .array(
        z
          .object({
            date: z.string().min(1).max(40),
            actualCost: z.number().finite().nonnegative().optional(),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();
export const usageStatsSchema = z
  .object({
    totalRequests: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    totalInputTokens: z.number().int().nonnegative(),
    totalOutputTokens: z.number().int().nonnegative(),
    totalCacheReadTokens: z.number().int().nonnegative(),
    totalCacheCreationTokens: z.number().int().nonnegative(),
    totalActualCost: z.number().finite().nonnegative(),
    totalCost: z.number().finite().nonnegative(),
    averageDurationMs: z.number().finite().nonnegative(),
  })
  .strict();
export type ApiKeyListQuery = z.input<typeof apiKeyListQuerySchema>;
export type ApiKeyDetailRequest = z.infer<typeof apiKeyDetailRequestSchema>;
export type ApiKeyGroupUpdateRequest = z.infer<typeof apiKeyGroupUpdateRequestSchema>;
export type ManagedApiKey = z.infer<typeof managedApiKeySchema>;
export type ApiKeyListPayload = z.infer<typeof apiKeyListPayloadSchema>;
export type ApiKeyGroup = z.infer<typeof apiKeyGroupSchema>;
export type ApiKeyManagementPayload = z.infer<typeof apiKeyManagementPayloadSchema>;
export type ApiKeyBatchUsage = z.infer<typeof apiKeyBatchUsageSchema>;
export type ApiKeyDailyUsage = z.infer<typeof apiKeyDailyUsageSchema>;
export type UsageStats = z.infer<typeof usageStatsSchema>;
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
    fetchedAt: z.number().int().nonnegative().optional(),
    stale: z.boolean().optional(),
    error: z.string().max(500).optional(),
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
                    groupIds: z.array(channelGroupIdSchema).max(500),
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
    availableChannelsState: z.enum(['complete', 'empty', 'partial', 'error']).optional(),
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
    firstTokenMs: z.number().optional(),
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
