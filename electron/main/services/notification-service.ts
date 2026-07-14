import { evaluateNotification } from '../domain/notifications.js';

export interface NotificationSender {
  send(title: string, body: string): void;
}
export interface NotificationStateStore {
  get(siteId: string, fingerprint: string): number | undefined;
  set(siteId: string, fingerprint: string, timestamp: number): void;
}
export class NotificationService {
  private readonly lastSent = new Map<string, number>();
  private readonly activeFailures = new Set<string>();
  constructor(
    private readonly sender: NotificationSender,
    private readonly store?: NotificationStateStore,
  ) {}
  lowBalance(
    siteId: string,
    siteName: string,
    balance: number,
    enabled = false,
    threshold = 0.5,
    cooldownMs = 30 * 60_000,
  ): boolean {
    const now = Date.now();
    const result = evaluateNotification(
      { enabled, lowBalanceThreshold: threshold, cooldownMs },
      balance,
      now,
      this.lastSent.get(siteId) ?? this.store?.get(siteId, 'low-balance'),
    );
    if (!result.send) return false;
    this.lastSent.set(siteId, now);
    this.store?.set(siteId, result.fingerprint ?? 'low-balance', now);
    this.sender.send('Sub2API 余额提醒', `${siteName} 当前余额 $${balance.toFixed(2)}`);
    return true;
  }

  health(
    siteId: string,
    siteName: string,
    healthy: boolean,
    enabled: boolean,
    cooldownMs: number,
    recoveryEnabled = true,
  ): boolean {
    return this.healthEvent(
      siteId,
      siteName,
      healthy,
      enabled,
      cooldownMs,
      'site-failure',
      'Sub2API 站点异常',
      'Sub2API 站点恢复',
      recoveryEnabled,
    );
  }

  channelHealth(
    siteId: string,
    siteName: string,
    healthy: boolean,
    enabled: boolean,
    cooldownMs: number,
    recoveryEnabled = true,
  ): boolean {
    return this.healthEvent(
      siteId,
      siteName,
      healthy,
      enabled,
      cooldownMs,
      'channel-failure',
      'Sub2API 渠道异常',
      'Sub2API 渠道恢复',
      recoveryEnabled,
    );
  }

  private healthEvent(
    siteId: string,
    siteName: string,
    healthy: boolean,
    enabled: boolean,
    cooldownMs: number,
    fingerprint: string,
    failureTitle: string,
    recoveryTitle: string,
    recoveryEnabled: boolean,
  ): boolean {
    const key = `${siteId}:${fingerprint}`;
    if (!enabled) return false;
    if (healthy) {
      if (!this.activeFailures.delete(key)) return false;
      if (!recoveryEnabled) return false;
      this.sender.send(recoveryTitle, `${siteName} 已恢复正常`);
      return true;
    }
    this.activeFailures.add(key);
    const now = Date.now();
    const previous = this.lastSent.get(key) ?? this.store?.get(siteId, fingerprint);
    if (previous !== undefined && now - previous < cooldownMs) return false;
    this.lastSent.set(key, now);
    this.store?.set(siteId, fingerprint, now);
    this.sender.send(failureTitle, `${siteName} 当前不可用，已保留最后成功缓存`);
    return true;
  }
}
