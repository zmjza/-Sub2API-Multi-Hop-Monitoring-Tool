import { evaluateNotification } from '../domain/notifications.js';

export interface NotificationSender {
  send(title: string, body: string): void;
}
export interface NotificationStateStore {
  get(siteId: string, fingerprint: string): number | undefined;
  set(siteId: string, fingerprint: string, timestamp: number): void;
  remove?(siteId: string, fingerprint: string): void;
  retain?(siteId: string, prefix: string, fingerprints: readonly string[]): void;
}
export class NotificationService {
  private readonly lastSent = new Map<string, number>();
  private readonly activeFailures = new Set<string>();
  private readonly cacheRateAlerts = new Set<string>();
  private readonly cacheRateTimers = new Map<string, ReturnType<typeof setTimeout>>();
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

  cacheRate(
    siteId: string,
    siteName: string,
    groupIdentity: string,
    groupName: string,
    averageRate: number,
    sampleCount: number,
    enabled: boolean,
    fresh = true,
  ): boolean {
    const fingerprint = `cache-rate:${groupIdentity}`;
    const key = `${siteId}:${fingerprint}`;
    if (!enabled) {
      this.cancelCacheRateTimer(key);
      return false;
    }
    if (!fresh || sampleCount < 30 || !Number.isFinite(averageRate)) return false;
    if (averageRate >= 80) {
      this.cancelCacheRateTimer(key);
      this.cacheRateAlerts.delete(key);
      this.store?.remove?.(siteId, fingerprint);
      return false;
    }
    if (
      this.cacheRateAlerts.has(key) ||
      this.cacheRateTimers.has(key) ||
      this.store?.get(siteId, fingerprint) !== undefined
    )
      return false;

    this.cacheRateAlerts.add(key);
    this.store?.set(siteId, fingerprint, Date.now());
    const title = 'Sub2API 缓存率提醒';
    const body = `你现在使用的「${siteName}」中「${groupName}」缓存率持续下降，请注意。`;
    this.safeSend(title, body);
    const timer = setTimeout(() => {
      this.cacheRateTimers.delete(key);
      this.safeSend(title, body);
    }, 2_000);
    this.cacheRateTimers.set(key, timer);
    return true;
  }

  cancelSite(siteId: string): void {
    for (const key of this.cacheRateTimers.keys()) {
      if (key.startsWith(`${siteId}:`)) this.cancelCacheRateTimer(key);
    }
    for (const key of this.cacheRateAlerts) {
      if (key.startsWith(`${siteId}:`)) this.cacheRateAlerts.delete(key);
    }
  }

  cancelAllCacheRate(): void {
    for (const key of this.cacheRateTimers.keys()) this.cancelCacheRateTimer(key);
  }

  retainCacheRateGroups(siteId: string, groupIdentities: readonly string[]): void {
    const retained = new Set(groupIdentities);
    this.store?.retain?.(
      siteId,
      'cache-rate:',
      groupIdentities.map((identity) => `cache-rate:${identity}`),
    );
    const prefix = `${siteId}:cache-rate:`;
    for (const key of this.cacheRateAlerts) {
      if (!key.startsWith(prefix)) continue;
      const groupIdentity = key.slice(prefix.length);
      if (retained.has(groupIdentity)) continue;
      this.cancelCacheRateTimer(key);
      this.cacheRateAlerts.delete(key);
      this.store?.remove?.(siteId, `cache-rate:${groupIdentity}`);
    }
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

  private cancelCacheRateTimer(key: string): void {
    const timer = this.cacheRateTimers.get(key);
    if (timer) clearTimeout(timer);
    this.cacheRateTimers.delete(key);
  }

  private safeSend(title: string, body: string): void {
    try {
      this.sender.send(title, body);
    } catch {
      /* native notifications may be unavailable or denied */
    }
  }
}
