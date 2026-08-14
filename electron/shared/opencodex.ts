import { z } from 'zod';

export const opencodexLogsQuerySchema = z
  .object({
    provider: z.string().trim().min(1).max(120).optional(),
    status: z.string().trim().min(1).max(16).optional(),
    limit: z.number().int().positive().max(2000).optional(),
  })
  .strict();

export type OpenCodexLogsQuery = z.infer<typeof opencodexLogsQuerySchema>;

export const opencodexUsageSchema = z
  .object({
    inputTokens: z.number().finite().nonnegative().optional(),
    outputTokens: z.number().finite().nonnegative().optional(),
    cachedInputTokens: z.number().finite().nonnegative().optional(),
    reasoningOutputTokens: z.number().finite().nonnegative().optional(),
  })
  .passthrough();

export type OpenCodexUsage = z.infer<typeof opencodexUsageSchema>;

const opencodexTokPerSecondSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('value'), value: z.number().finite(), estimated: z.boolean() })
    .passthrough(),
  z.object({ kind: z.literal('unavailable'), reason: z.string() }).passthrough(),
]);

const opencodexCostEstimateSchema = z
  .object({
    tokens: z
      .object({
        input: z.number().finite().nonnegative().optional(),
        output: z.number().finite().nonnegative().optional(),
        cacheRead: z.number().finite().nonnegative().optional(),
        cacheWrite: z.number().finite().nonnegative().optional(),
      })
      .passthrough()
      .optional(),
    cost: z
      .object({
        input: z.number().finite().nonnegative().optional(),
        output: z.number().finite().nonnegative().optional(),
        cacheRead: z.number().finite().nonnegative().optional(),
        cacheWrite: z.number().finite().nonnegative().optional(),
        total: z.number().finite().optional(),
      })
      .passthrough()
      .optional(),
    estimated: z.boolean().optional(),
  })
  .passthrough();

const opencodexCostResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('value'), estimate: opencodexCostEstimateSchema }).passthrough(),
  z.object({ kind: z.literal('unavailable'), reason: z.string() }).passthrough(),
]);

const opencodexDisplayMetricsSchema = z
  .object({
    tokPerSecond: opencodexTokPerSecondSchema.optional(),
    cost: opencodexCostResultSchema.optional(),
  })
  .passthrough();

const opencodexAttemptSchema = z
  .object({
    displayMetrics: opencodexDisplayMetricsSchema.optional(),
  })
  .passthrough();

export const opencodexLogEntrySchema = z
  .object({
    requestId: z.string().optional(),
    timestamp: z.number().finite().nonnegative(),
    model: z.string().default('未知模型'),
    provider: z.string().default('未知提供方'),
    firstOutputMs: z.number().finite().nonnegative().optional(),
    surface: z.string().optional(),
    inboundProtocol: z.string().optional(),
    conversationId: z.string().optional(),
    requestedModel: z.string().optional(),
    requestedEffort: z.string().optional(),
    effectiveEffort: z.string().optional(),
    reasoningWireField: z.string().optional(),
    reasoningWireValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
    requestedServiceTier: z.string().optional(),
    requestedSpeedLabel: z.string().optional(),
    configuredServiceTier: z.string().optional(),
    configuredSpeedLabel: z.string().optional(),
    responseServiceTier: z.string().optional(),
    resolvedModel: z.string().optional(),
    status: z.number().int().nonnegative(),
    durationMs: z.number().finite().nonnegative(),
    errorCode: z.string().optional(),
    terminalStatus: z.string().optional(),
    closeReason: z.string().optional(),
    upstreamError: z.string().optional(),
    usageStatus: z.string().optional(),
    usage: opencodexUsageSchema.optional(),
    totalTokens: z.number().finite().nonnegative().optional(),
    attempts: z.array(opencodexAttemptSchema).max(100).optional(),
    displayMetrics: opencodexDisplayMetricsSchema.optional(),
  })
  .passthrough();

export type OpenCodexLogEntry = z.infer<typeof opencodexLogEntrySchema>;

export const opencodexLogsPayloadSchema = z
  .object({
    timeZone: z.string().optional(),
    total: z.number().int().nonnegative(),
    logs: z.array(opencodexLogEntrySchema).max(2000),
  })
  .passthrough();

export type OpenCodexLogsPayload = z.infer<typeof opencodexLogsPayloadSchema>;
