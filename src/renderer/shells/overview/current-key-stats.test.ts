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
    expect(availableCreditForKey({ ...keys[0], quotaUsed: undefined }, 100)).toEqual({
      kind: 'amount',
      value: 80,
    });
    expect(availableCreditForKey({ ...keys[0], quotaUsed: 90 }, 100)).toEqual({
      kind: 'amount',
      value: 0,
    });
    expect(availableCreditForKey(keys[0], 20)).toEqual({ kind: 'amount', value: 20 });
  });

  it('ignores subscription metadata and uses finite quota or unlimited account balance', () => {
    expect(availableCreditForKey(keys[1], 12.5)).toEqual({ kind: 'amount', value: 12.5 });
    expect(availableCreditForKey({ ...keys[0], subscriptionType: 'monthly' }, 100)).toEqual({
      kind: 'amount',
      value: 50,
    });
    expect(availableCreditForKey({ ...keys[1], subscriptionType: 'monthly' }, 12.5)).toEqual({
      kind: 'amount',
      value: 12.5,
    });
    expect(availableCreditForKey(undefined, 12.5)).toEqual({ kind: 'unknown' });
    expect(availableCreditForKey(keys[1], undefined)).toEqual({ kind: 'unknown' });
  });
});

describe('overview current key totals', () => {
  it('sums finite and unlimited current-key amounts without counting unknown credit', () => {
    const states: CurrentKeyStatsState[] = [
      {
        state: 'success',
        keyId: 'finite',
        totalRequests: 1,
        totalTokens: 10,
        totalActualCost: 0.1,
        availableCredit: availableCreditForKey(keys[0], 100),
      },
      {
        state: 'success',
        keyId: 'unlimited',
        totalRequests: 1,
        totalTokens: 10,
        totalActualCost: 0.1,
        availableCredit: availableCreditForKey(keys[1], 12.5),
      },
      {
        state: 'success',
        keyId: 'missing-balance',
        totalRequests: 1,
        totalTokens: 10,
        totalActualCost: 0.1,
        availableCredit: availableCreditForKey(keys[1], undefined),
      },
      { state: 'unknown' },
    ];

    expect(aggregateCurrentKeyStats(states)).toMatchObject({
      availableCredit: 62.5,
      availableCreditCount: 2,
      counted: 3,
      total: 4,
    });
  });

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
        availableCredit: { kind: 'amount', value: 12.5 },
      },
      {
        state: 'success',
        keyId: '15',
        totalRequests: 1,
        totalTokens: 10,
        totalActualCost: 0.1,
        availableCredit: { kind: 'unknown' },
      },
    ];

    expect(aggregateCurrentKeyStats(states)).toEqual({
      availableCredit: 32.5,
      availableCreditCount: 2,
      totalRequests: 7,
      totalTokens: 150,
      totalActualCost: 0.85,
      counted: 3,
      total: 5,
    });
  });
});
