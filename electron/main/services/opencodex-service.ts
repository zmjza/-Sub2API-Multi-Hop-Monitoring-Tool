import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import {
  opencodexLogsPayloadSchema,
  type OpenCodexLogsPayload,
  type OpenCodexLogsQuery,
} from '../../shared/opencodex.js';

export const OPENCODEX_BASE_URL = 'http://localhost:10100';
export const OPENCODEX_LOGS_ENDPOINT = '/api/logs';

function adminTokenPath(): string {
  const opencodexHome = process.env.OPENCODEX_HOME?.trim();
  const configDir = opencodexHome
    ? path.resolve(opencodexHome)
    : path.join(homedir(), '.opencodex');
  return path.join(configDir, 'admin-api-token');
}

function readAdminToken(): string | null {
  const fromEnv = process.env.OPENCODEX_ADMIN_AUTH_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    const stat = statSync(adminTokenPath());
    if (!stat.isFile() || stat.size > 512) return null;
    const token = readFileSync(adminTokenPath(), 'utf8').trim();
    return token || null;
  } catch {
    return null;
  }
}

export interface OpenCodexFetchOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

function queryString(query: OpenCodexLogsQuery): string {
  const params = new URLSearchParams();
  if (query.provider) params.set('provider', query.provider);
  if (query.status) params.set('status', query.status);
  params.set('limit', String(query.limit ?? 4000));
  return params.toString();
}

export async function fetchOpenCodexLogs(
  query: OpenCodexLogsQuery,
  options: OpenCodexFetchOptions = {},
): Promise<OpenCodexLogsPayload> {
  const baseUrl = options.baseUrl ?? OPENCODEX_BASE_URL;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const token = readAdminToken();
  if (!token) {
    throw new Error(
      'OPENCODEX_TOKEN_MISSING：未找到 OpenCodex 管理员令牌（~/.opencodex/admin-api-token），请先启动 opencodex 服务',
    );
  }
  const url = baseUrl + OPENCODEX_LOGS_ENDPOINT + '?' + queryString(query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OPENCODEX_TIMEOUT：OpenCodex 服务响应超时，请稍后重试', {
        cause: error,
      });
    }
    throw new Error(
      'OPENCODEX_UNREACHABLE：无法连接 OpenCodex 服务，请确认 opencodex 已在 localhost:10100 启动',
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const status = response.status;
    const label =
      status === 401
        ? 'OPENCODEX_UNAUTHORIZED：OpenCodex 管理员令牌无效或已过期'
        : status === 403
          ? 'OPENCODEX_FORBIDDEN：OpenCodex 拒绝访问，请检查令牌权限'
          : 'OPENCODEX_HTTP_' + status + '：OpenCodex 服务返回 HTTP ' + status;
    throw new Error(label);
  }
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('OPENCODEX_INVALID_JSON：OpenCodex 返回的不是有效 JSON');
  }
  const result = opencodexLogsPayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('OPENCODEX_INVALID_PAYLOAD：OpenCodex 日志数据结构不符合预期');
  }
  return result.data;
}
