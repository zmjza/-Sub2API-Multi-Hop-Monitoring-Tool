export interface LowBalanceRule {
  enabled: boolean;
  lowBalanceThreshold: number;
  cooldownMs: number;
}

export function evaluateNotification(
  rule: LowBalanceRule,
  balance: number,
  now: number,
  lastSentAt?: number,
): { send: boolean; fingerprint?: string } {
  if (!rule.enabled || balance >= rule.lowBalanceThreshold) return { send: false };
  if (lastSentAt !== undefined && now - lastSentAt < rule.cooldownMs) return { send: false };
  return { send: true, fingerprint: 'low-balance' };
}
