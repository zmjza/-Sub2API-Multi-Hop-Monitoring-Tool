import { z } from 'zod';
import type { ApiKeySummary, SafeError } from '../domain/types.js';

const sessionDataSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive(),
  token_type: z.string(),
});

export const loginResponseSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  data: sessionDataSchema.extend({
    user: z
      .object({
        id: z.union([z.number(), z.string()]),
        email: z.string().optional(),
        username: z.string().optional().nullable(),
        role: z.string(),
        balance: z.number(),
        status: z.string(),
      })
      .passthrough(),
  }),
});

export const refreshResponseSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  data: sessionDataSchema,
});

export function normalizeApiKey(input: Record<string, unknown>): ApiKeySummary {
  const name = typeof input.name === 'string' && input.name ? input.name : '未命名 Key';
  const rawStatus = String(input.status ?? 'active').toLowerCase();
  return {
    id: String(input.id ?? ''),
    name,
    maskedLabel: `${name} · ••••`,
    status: rawStatus === 'active' || rawStatus === 'enabled' ? 'active' : 'disabled',
    groupId:
      input.group_id === undefined || input.group_id === null ? undefined : String(input.group_id),
  };
}

export function normalizeError(
  error: unknown,
  capability?: string,
  httpStatus?: number,
): SafeError {
  let code = 'SERVER_ERROR';
  let retryable = true;
  if (httpStatus === 401 || httpStatus === 403) {
    code = capability === 'authLogin' ? 'AUTH_INVALID_CREDENTIALS' : 'AUTH_REQUIRED';
    retryable = false;
  } else if (httpStatus === 404) {
    code = 'UNSUPPORTED_CAPABILITY';
    retryable = false;
  } else if (httpStatus === 429) code = 'RATE_LIMITED';
  else if (error instanceof DOMException && error.name === 'AbortError') code = 'NETWORK_TIMEOUT';
  return { code, message: '请求失败', capability, httpStatus, retryable };
}
