import { describe, expect, it } from 'vitest';
import {
  aggregateCurrentKeyStats,
  availableCreditForKey,
  resolveEffectiveKey,
  type CurrentKeyStatsState,
} from './current-key-stats';

const keys = [
  {
    id: '11',
    name: '主要 Key',
    maskedLabel: 'sk-xxx...0011',
    status: 'active' as const,
    quota: 80,
    quotaUsed: 30,
  },
  {
    id: '12',
    name: '备用 Key',
    maskedLabel: 'sk-xxx...0012',
    status: 'active' as const,
  },
];

describe('overview current key resolution', () => {
  it('uses the explicit key in manual mode and the effective runtime id in auto mode', () => {
    expect(resolveEffectiveKey(keys, { mode: 'manual', keyId: '12' }, '11')?.id).toBe('12');
    expect(resolveEffectiveKey(keys, { mode: 'auto' }, '11')?.id).toBe('11');
  });

  it('keeps unresolved auto mode unknown instead of selecting the first key', () => {
    expect(resolveEffectiveKey(keys, { mode: 'auto' }, undefined)).toBeUndefined();
    expect(resolveEffectiveKey(keys, { mode: 'auto' }, '99')).toBeUndefined();
  });
});

describe('overview current key credit', () => {
  it('uses the smaller of account balance and finite key quota remaining', () => {
    expect(availableCreditForKey(keys[0], 100)).toEqual({ kind: 'amount', value: 50 });
    expect(availableCreditForKey({ ...keys[0], quotaUsed: 90 }, 100)).toEqual({
      kind: 'amount',
      value: 0,
    });
    expect(availableCreditForKey(keys[0], 20)).toEqual({ kind: 'amount', value: 20 });
  });

  it('uses account balance for unlimited keys and labels subscription groups honestly', () => {
    expect(availableCreditForKey(keys[1], 12.5)).toEqual({ kind: 'amount', value: 12.5 });
    expect(availableCreditForKey({ ...keys[1], subscriptionType: 'monthly' }, 12.5)).toEqual({
      kind: 'subscription',
    });
    expect(availableCreditForKey(undefined, 12.5)).toEqual({ kind: 'unknown' });
  });
});

describe('overview current key totals', () => {
  it('aggregates only confirmed current-key stats and reports the counted denominator', () => {
    const states: CurrentKeyStatsState[] = [
      {
        state: 'success',
        keyId: '11',
        totalRequests: 4,
        totalTokens: 100,
        totalActualCost: 0.5,
        availableCredit: { kind: 'amount', value: 20 },
      },
      { state: 'unknown' },
      { state: 'error', keyId: '13' },
      {
        state: 'success',
        keyId: '14',
        totalRequests: 2,
        totalTokens: 40,
        totalActualCost: 0.25,
        availableCredit: { kind: 'subscription' },
      },
    ];

    expect(aggregateCurrentKeyStats(states)).toEqual({
      availableCredit: 20,
      totalRequests: 6,
      totalTokens: 140,
      totalActualCost: 0.75,
      counted: 2,
      total: 4,
      subscriptionCount: 1,
    });
  });
});
