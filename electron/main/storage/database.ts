import type { DatabaseSync } from 'node:sqlite';
import type { AvailableRateGroup } from '../../shared/contracts.js';
import type { ChannelAssociation } from '../../shared/contracts.js';

export interface SiteRow {
  id: string;
  name: string;
  baseUrl: string;
  apiPrefix: string;
  capabilities?: Record<string, string>;
}

export class AppDatabase {
  constructor(private readonly db: DatabaseSync) {}

  migrate(): void {
    this.db.exec('PRAGMA foreign_keys = ON');
    const existingVersion = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")
      .get();
    if (existingVersion) {
      const row = this.db.prepare('SELECT MAX(version) AS version FROM schema_version').get() as {
        version?: number;
      };
      if (Number(row.version ?? 0) > 1) throw new Error('DATABASE_VERSION_NEWER_THAN_APP');
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
      INSERT INTO schema_version(version)
        SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM schema_version);
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        api_prefix TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'unknown',
        capability_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS credential_refs (
        site_id TEXT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
        account_label TEXT NOT NULL,
        secret_ref TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        site_id TEXT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
        access_ref TEXT NOT NULL,
        refresh_ref TEXT,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS snapshots (
        site_id TEXT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
        snapshot_json TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notification_states (
        site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        fingerprint TEXT NOT NULL,
        last_sent_at INTEGER NOT NULL,
        PRIMARY KEY(site_id, fingerprint)
      );
    `);
  }

  saveSite(site: SiteRow): void {
    this.db
      .prepare(
        `
      INSERT INTO sites(id, name, base_url, api_prefix, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, base_url=excluded.base_url, api_prefix=excluded.api_prefix
    `,
      )
      .run(site.id, site.name, site.baseUrl, site.apiPrefix, Date.now());
  }

  listSites(): SiteRow[] {
    const rows = this.db
      .prepare(
        'SELECT id, name, base_url AS baseUrl, api_prefix AS apiPrefix, capability_json AS capabilityJson FROM sites ORDER BY created_at',
      )
      .all() as unknown as Array<Omit<SiteRow, 'capabilities'> & { capabilityJson: string }>;
    return rows.map(({ capabilityJson, ...row }) => ({
      ...row,
      capabilities: parseCapabilities(capabilityJson),
    }));
  }

  setCapabilities(siteId: string, capabilities: Record<string, string>): void {
    this.db
      .prepare('UPDATE sites SET capability_json = ? WHERE id = ?')
      .run(JSON.stringify(capabilities), siteId);
  }

  saveCredentialReference(siteId: string, accountLabel: string, secretRef: string): void {
    this.db
      .prepare(
        `
      INSERT INTO credential_refs(site_id, account_label, secret_ref, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(site_id) DO UPDATE SET account_label=excluded.account_label, secret_ref=excluded.secret_ref, version=credential_refs.version + 1, updated_at=excluded.updated_at
    `,
      )
      .run(siteId, accountLabel, secretRef, Date.now());
  }

  getCredentialReference(siteId: string): { accountLabel: string; secretRef: string } | undefined {
    const row = this.db
      .prepare(
        'SELECT account_label AS accountLabel, secret_ref AS secretRef FROM credential_refs WHERE site_id = ?',
      )
      .get(siteId) as { accountLabel?: string; secretRef?: string } | undefined;
    if (!row?.accountLabel || !row.secretRef) return undefined;
    return { accountLabel: row.accountLabel, secretRef: row.secretRef };
  }

  saveSnapshot(siteId: string, snapshotJson: string, fetchedAt: number, expiresAt: number): void {
    this.db
      .prepare(
        `
      INSERT INTO snapshots(site_id, snapshot_json, fetched_at, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(site_id) DO UPDATE SET snapshot_json=excluded.snapshot_json, fetched_at=excluded.fetched_at, expires_at=excluded.expires_at
    `,
      )
      .run(siteId, snapshotJson, fetchedAt, expiresAt);
  }

  deleteSnapshot(siteId: string): void {
    this.db.prepare('DELETE FROM snapshots WHERE site_id = ?').run(siteId);
  }

  listSnapshots(): Array<{
    siteId: string;
    snapshotJson: string;
    fetchedAt: number;
    expiresAt: number;
  }> {
    return this.db
      .prepare(
        'SELECT site_id AS siteId, snapshot_json AS snapshotJson, fetched_at AS fetchedAt, expires_at AS expiresAt FROM snapshots',
      )
      .all() as unknown as Array<{
      siteId: string;
      snapshotJson: string;
      fetchedAt: number;
      expiresAt: number;
    }>;
  }

  cleanupSnapshots(olderThan: number): number {
    return Number(
      this.db.prepare('DELETE FROM snapshots WHERE fetched_at < ?').run(olderThan).changes,
    );
  }

  deleteSite(siteId: string): void {
    this.db.prepare('DELETE FROM sites WHERE id = ?').run(siteId);
  }

  countSiteOwnedRows(siteId: string): number {
    const tables = ['credential_refs', 'auth_sessions', 'snapshots'];
    return tables.reduce((count, table) => {
      const row = this.db
        .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE site_id = ?`)
        .get(siteId) as { count: number };
      return count + Number(row.count);
    }, 0);
  }

  getSetting<T>(key: string, fallback: T): T {
    const row = this.db
      .prepare('SELECT value_json AS valueJson FROM settings WHERE key = ?')
      .get(key) as { valueJson?: string } | undefined;
    if (!row?.valueJson) return fallback;
    try {
      return JSON.parse(row.valueJson) as T;
    } catch {
      return fallback;
    }
  }

  setSetting<T>(key: string, value: T): void {
    this.db
      .prepare(
        `INSERT INTO settings(key, value_json) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json`,
      )
      .run(key, JSON.stringify(value));
  }

  getChannelAssociations(siteId: string): ChannelAssociation[] {
    return this.getSetting<ChannelAssociation[]>(`channelAssociations:${siteId}`, []);
  }

  setChannelAssociation(
    siteId: string,
    groupId: string,
    channelIds: string[],
  ): ChannelAssociation[] {
    const current = this.getChannelAssociations(siteId).filter((item) => item.groupId !== groupId);
    const next = [
      ...current,
      { siteId, groupId, channelIds: [...new Set(channelIds)], source: 'manual' as const },
    ].filter((item) => item.channelIds.length > 0);
    this.setSetting(`channelAssociations:${siteId}`, next);
    return next;
  }

  clearChannelAssociation(siteId: string, groupId: string): ChannelAssociation[] {
    const next = this.getChannelAssociations(siteId).filter((item) => item.groupId !== groupId);
    this.setSetting(`channelAssociations:${siteId}`, next);
    return next;
  }

  deleteSetting(key: string): void {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }

  getKeyCache(siteId: string): unknown {
    return this.getSetting(`site:${siteId}:keyCache`, []);
  }

  setKeyCache(siteId: string, keys: unknown[]): void {
    this.setSetting(`site:${siteId}:keyCache`, keys);
  }

  getKeyPreference(siteId: string): { mode: 'auto' | 'manual'; keyId?: string } {
    return this.getSetting(`site:${siteId}:keyPreference`, { mode: 'auto' as const });
  }

  setKeyPreference(siteId: string, preference: { mode: 'auto' | 'manual'; keyId?: string }): void {
    this.setSetting(`site:${siteId}:keyPreference`, preference);
  }

  getSiteNote(siteId: string): string {
    return this.getSetting(`site:${siteId}:note`, '');
  }

  setSiteNote(siteId: string, note: string): void {
    this.setSetting(`site:${siteId}:note`, note.trim().slice(0, 500));
  }

  getRateCache(siteId: string): { groups: AvailableRateGroup[]; fetchedAt?: number } {
    return this.getSetting(`site:${siteId}:rateCache`, { groups: [] });
  }

  setRateCache(siteId: string, value: { groups: AvailableRateGroup[]; fetchedAt: number }): void {
    this.setSetting(`site:${siteId}:rateCache`, value);
  }

  getRechargeRatio(siteId: string): number | undefined {
    const value = this.getSetting<unknown>(`site:${siteId}:rechargeRatio`, undefined);
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
  }

  setRechargeRatio(siteId: string, ratio: number): void {
    if (!Number.isFinite(ratio) || ratio <= 0) throw new Error('INVALID_RECHARGE_RATIO');
    this.setSetting(`site:${siteId}:rechargeRatio`, ratio);
  }

  getRechargeRatios(): Record<string, number> {
    return Object.fromEntries(
      this.listSites().flatMap((site) => {
        const ratio = this.getRechargeRatio(site.id);
        return ratio === undefined ? [] : [[site.id, ratio]];
      }),
    );
  }

  getNotificationSettings(): {
    enabled: boolean;
    threshold: number;
    cooldownMs: number;
    siteFailures: boolean;
    channelFailures: boolean;
    recoveryNotifications: boolean;
    sites: Record<string, { enabled?: boolean; threshold?: number }>;
  } {
    return this.getSetting('notifications', {
      enabled: false,
      threshold: 0.5,
      cooldownMs: 1_800_000,
      siteFailures: true,
      channelFailures: true,
      recoveryNotifications: true,
      sites: {},
    });
  }

  setNotificationSettings(value: {
    enabled: boolean;
    threshold: number;
    cooldownMs: number;
    siteFailures: boolean;
    channelFailures: boolean;
    recoveryNotifications: boolean;
    sites: Record<string, { enabled?: boolean; threshold?: number }>;
  }): void {
    this.setSetting('notifications', value);
  }

  getAppSettings(): {
    refreshIntervalMinutes: 1 | 5 | 10 | 15;
    floatingEnabled: boolean;
    staleAfterMinutes: 2 | 5 | 10 | 30;
  } {
    return this.getSetting('app:settings', {
      refreshIntervalMinutes: 5 as const,
      floatingEnabled: true,
      staleAfterMinutes: 2 as const,
    });
  }

  setAppSettings(value: {
    refreshIntervalMinutes: 1 | 5 | 10 | 15;
    floatingEnabled: boolean;
    staleAfterMinutes: 2 | 5 | 10 | 30;
  }): void {
    this.setSetting('app:settings', value);
  }

  getNotificationLastSent(siteId: string, fingerprint: string): number | undefined {
    const row = this.db
      .prepare(
        'SELECT last_sent_at AS lastSentAt FROM notification_states WHERE site_id = ? AND fingerprint = ?',
      )
      .get(siteId, fingerprint) as { lastSentAt?: number } | undefined;
    return row?.lastSentAt;
  }

  setNotificationLastSent(siteId: string, fingerprint: string, timestamp: number): void {
    this.db
      .prepare(
        `INSERT INTO notification_states(site_id, fingerprint, last_sent_at) VALUES (?, ?, ?)
      ON CONFLICT(site_id, fingerprint) DO UPDATE SET last_sent_at=excluded.last_sent_at`,
      )
      .run(siteId, fingerprint, timestamp);
  }
}

function parseCapabilities(value: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}
