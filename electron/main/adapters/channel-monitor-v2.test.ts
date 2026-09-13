import { describe, expect, it } from 'vitest';
import { classifyV2Failure, normalizeV2Matrix } from './channel-monitor-v2.js';

const coverage = {
  requested_start: '2026-09-13T10:40:00Z',
  requested_end: '2026-09-13T12:10:00Z',
  coverage_start: '2026-09-13T10:40:00Z',
  data_through: '2026-09-13T12:05:00Z',
  computed_at: '2026-09-13T12:05:07.527495Z',
  coverage_complete: true,
  bucket_seconds: 300,
};

function item(overrides: Record<string, unknown> = {}) {
  return {
    platform: 'anthropic',
    group_id: 130,
    group_name: 'Claude-Aws【稳定】',
    metrics: {
      success_requests: 10,
      error_requests: 2,
      request_count: 12,
      has_requests: true,
      success_rate: 0.8,
      error_rate: 0.2,
      cache_rate: 0.5,
      ttft: { avg_ms: 2100, trimmed_avg_ms: 1500 },
      duration: { avg_ms: 7000 },
    },
    health: { overall: 'warning', score: 70 },
    buckets: [
      {
        bucket_start: '2026-09-13T10:40:00Z',
        metrics: { has_requests: true, request_count: 4, ttft: { avg_ms: 1200 } },
        health: { overall: 'healthy' },
      },
      {
        bucket_start: '2026-09-13T12:10:00Z',
        metrics: { has_requests: true, request_count: 1, ttft: { avg_ms: 9999 } },
        health: { overall: 'critical' },
      },
    ],
    ...overrides,
  };
}

describe('classifyV2Failure', () => {
  it('treats 404/405/unsupported as missing capability', () => {
    expect(classifyV2Failure({ code: 'UNSUPPORTED_CAPABILITY', httpStatus: 404 })).toBe('missing');
    expect(classifyV2Failure({ code: 'SERVER_ERROR', httpStatus: 405 })).toBe('missing');
    expect(classifyV2Failure({ code: 'INCOMPATIBLE_RESPONSE' })).toBe('missing');
  });

  it('treats 401/403 as auth', () => {
    expect(classifyV2Failure({ code: 'AUTH_REQUIRED', httpStatus: 401 })).toBe('auth');
    expect(classifyV2Failure({ code: 'AUTH_REQUIRED', httpStatus: 403 })).toBe('auth');
  });

  it('treats 429/5xx/timeout as temporary', () => {
    expect(classifyV2Failure({ code: 'RATE_LIMITED', httpStatus: 429 })).toBe('temporary');
    expect(classifyV2Failure({ code: 'SERVER_ERROR', httpStatus: 503 })).toBe('temporary');
    expect(classifyV2Failure({ code: 'NETWORK_TIMEOUT' })).toBe('temporary');
  });
});

describe('normalizeV2Matrix', () => {
  it('maps health grades and drops future buckets after data_through', () => {
    const result = normalizeV2Matrix({
      code: 0,
      data: { group_by: 'platform_group', coverage, items: [item()] },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.channels).toHaveLength(1);
    expect(result.channels[0]).toMatchObject({
      id: '130',
      name: 'Claude-Aws【稳定】',
      platform: 'anthropic',
      groupName: 'Claude-Aws【稳定】',
      status: 'degraded',
      latencyMs: 1500,
    });
    expect(result.channels[0].timeline.map((point) => point.checkedAt)).toEqual([
      '2026-09-13T10:40:00Z',
    ]);
    expect(result.details['130']?.models[0]).toMatchObject({
      status: 'degraded',
      latestLatencyMs: 1500,
    });
  });

  it('uses unknown for no-traffic groups instead of healthy', () => {
    const result = normalizeV2Matrix({
      code: 0,
      data: {
        coverage,
        items: [
          item({
            metrics: { request_count: 0, has_requests: false, success_rate: 1 },
            health: { overall: 'healthy' },
          }),
        ],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.channels[0].status).toBe('unknown');
  });

  it('maps critical to failed and empty items to supported empty list', () => {
    const critical = normalizeV2Matrix({
      code: 0,
      data: { coverage, items: [item({ health: { overall: 'critical' } })] },
    });
    expect(critical.ok && critical.channels[0].status).toBe('failed');
    const empty = normalizeV2Matrix({ code: 0, data: { coverage, items: [] } });
    expect(empty.ok && empty.channels).toEqual([]);
  });

  it('rejects illegal contracts', () => {
    expect(normalizeV2Matrix({ code: 0, data: { items: 'nope' } }).ok).toBe(false);
    expect(normalizeV2Matrix(null).ok).toBe(false);
    expect(normalizeV2Matrix({ message: 'missing data' }).ok).toBe(false);
  });
});
