export interface CurrentKeyLike {
  id: string;
  status: string;
  quota?: number;
  quotaUsed?: number;
  subscriptionType?: string;
}

export type AvailableCredit =
  { kind: 'amount'; value: number } | { kind: 'subscription' } | { kind: 'unknown' };

export type CurrentKeyStatsState =
  | { state: 'loading' | 'unknown'; keyId?: string }
  | { state: 'error'; keyId: string }
  | {
      state: 'success';
      keyId: string;
      totalRequests: number;
      totalTokens: number;
      totalActualCost: number;
      availableCredit: AvailableCredit;
    };

export function resolveEffectiveKey<T extends CurrentKeyLike>(
  keys: T[],
  preference: { mode: 'auto' | 'manual'; keyId?: string },
  effectiveKeyId?: string,
): T | undefined {
  const keyId = preference.mode === 'manual' ? preference.keyId : effectiveKeyId;
  if (!keyId) return undefined;
  return keys.find((key) => key.id === keyId && key.status === 'active');
}

export function availableCreditForKey(
  key: CurrentKeyLike | undefined,
  accountBalance: number | undefined,
): AvailableCredit {
  if (!key) return { kind: 'unknown' };
  if (key.subscriptionType?.trim()) return { kind: 'subscription' };
  if (typeof accountBalance !== 'number' || !Number.isFinite(accountBalance))
    return { kind: 'unknown' };
  const balance = Math.max(0, accountBalance);
  if (typeof key.quota !== 'number' || !Number.isFinite(key.quota) || key.quota <= 0)
    return { kind: 'amount', value: balance };
  const used =
    typeof key.quotaUsed === 'number' && Number.isFinite(key.quotaUsed)
      ? Math.max(0, key.quotaUsed)
      : 0;
  return { kind: 'amount', value: Math.max(0, Math.min(balance, key.quota - used)) };
}

export function aggregateCurrentKeyStats(states: CurrentKeyStatsState[]) {
  const confirmed = states.filter(
    (state): state is Extract<CurrentKeyStatsState, { state: 'success' }> =>
      state.state === 'success',
  );
  return confirmed.reduce(
    (totals, state) => {
      totals.totalRequests += state.totalRequests;
      totals.totalTokens += state.totalTokens;
      totals.totalActualCost += state.totalActualCost;
      totals.counted += 1;
      if (state.availableCredit.kind === 'amount')
        totals.availableCredit += state.availableCredit.value;
      if (state.availableCredit.kind === 'subscription') totals.subscriptionCount += 1;
      return totals;
    },
    {
      availableCredit: 0,
      totalRequests: 0,
      totalTokens: 0,
      totalActualCost: 0,
      counted: 0,
      total: states.length,
      subscriptionCount: 0,
    },
  );
}
