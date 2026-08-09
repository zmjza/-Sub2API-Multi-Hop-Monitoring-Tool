import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { AppDatabase } from './database.js';
import { CredentialVault } from './credential-vault.js';

describe('AppDatabase', () => {
  it('migrates an empty database and cascades site-owned data', () => {
    const raw = new DatabaseSync(':memory:');
    const db = new AppDatabase(raw);
    db.migrate();
    db.saveSite({ id: 'site-a', name: 'A', baseUrl: 'https://a.invalid', apiPrefix: '/api/v1' });
    db.setCapabilities('site-a', { profile: 'supported', channelMonitors: 'unsupported' });
    db.saveCredentialReference('site-a', 'account@example.invalid', 'credential:site-a');
    db.saveSnapshot('site-a', JSON.stringify({ balance: 1 }), 100, 200);

    expect(db.listSites()).toHaveLength(1);
    expect(db.listSites()[0]?.capabilities?.channelMonitors).toBe('unsupported');
    expect(JSON.stringify(db.listSites())).not.toContain('credential:site-a');
    expect(db.cleanupSnapshots(150)).toBe(1);
    db.saveSnapshot('site-a', JSON.stringify({ balance: 2 }), 200, 300);
    db.deleteSite('site-a');
    expect(db.listSites()).toEqual([]);
    expect(db.countSiteOwnedRows('site-a')).toBe(0);
    raw.close();
  });

  it('stores only credential references in ordinary SQLite fields', () => {
    const raw = new DatabaseSync(':memory:');
    const db = new AppDatabase(raw);
    db.migrate();
    db.saveSite({ id: 'site-a', name: 'A', baseUrl: 'https://a.invalid', apiPrefix: '/api/v1' });
    db.saveCredentialReference('site-a', 'masked-account', 'credential:site-a');
    const dump = raw.prepare("SELECT sql FROM sqlite_master WHERE type='table'").all();
    expect(JSON.stringify(dump)).not.toMatch(/password|access_token|refresh_token/i);
    raw.close();
  });

  it('persists key preference and notification settings as non-secret JSON', () => {
    const raw = new DatabaseSync(':memory:');
    const db = new AppDatabase(raw);
    db.migrate();
    db.setKeyPreference('site-a', { mode: 'manual', keyId: 'key-1' });
    expect(db.getKeyPreference('site-a')).toEqual({ mode: 'manual', keyId: 'key-1' });
    db.setNotificationSettings({
      enabled: true,
      threshold: 0.5,
      cooldownMs: 1000,
      siteFailures: true,
      channelFailures: true,
      recoveryNotifications: true,
      sites: {},
    });
    expect(db.getNotificationSettings().enabled).toBe(true);
    db.setAppSettings({
      refreshIntervalMinutes: 5,
      floatingEnabled: false,
      staleAfterMinutes: 10,
    });
    expect(db.getAppSettings()).toEqual({
      refreshIntervalMinutes: 5,
      floatingEnabled: false,
      staleAfterMinutes: 10,
    });
    db.setSetting('currentSiteId', 'site-a');
    expect(db.getSetting('currentSiteId', undefined)).toBe('site-a');
    expect(JSON.stringify(raw.prepare('SELECT value_json FROM settings').all())).not.toMatch(
      /password|token/i,
    );
    raw.close();
  });

  it('persists site-scoped multi-channel group associations and clears them explicitly', () => {
    const raw = new DatabaseSync(':memory:');
    const db = new AppDatabase(raw);
    db.migrate();
    expect(db.getChannelAssociations('site-a')).toEqual([]);
    db.setChannelAssociation('site-a', '120', ['channel-a', 'channel-b', 'channel-a']);
    expect(db.getChannelAssociations('site-a')).toEqual([
      {
        siteId: 'site-a',
        groupId: '120',
        channelIds: ['channel-a', 'channel-b'],
        source: 'manual',
      },
    ]);
    db.setChannelAssociation('site-b', '120', ['channel-other']);
    expect(db.getChannelAssociations('site-a')).toHaveLength(1);
    db.clearChannelAssociation('site-a', '120');
    expect(db.getChannelAssociations('site-a')).toEqual([]);
    expect(db.getChannelAssociations('site-b')).toHaveLength(1);
    raw.close();
  });

  it('persists safe rate caches and positive recharge ratios per site', () => {
    const raw = new DatabaseSync(':memory:');
    const db = new AppDatabase(raw);
    db.migrate();
    db.saveSite({ id: 'site-a', name: 'A', baseUrl: 'https://a.invalid', apiPrefix: '/api/v1' });
    const cache = {
      groups: [
        {
          id: '25',
          name: '特惠分组',
          description: '公开说明',
          platform: 'openai',
          status: 'active',
          rate: 0.4,
        },
      ],
      fetchedAt: 1_721_000_000_000,
    };

    db.setRateCache('site-a', cache);
    db.setRechargeRatio('site-a', 10);

    expect(db.getRateCache('site-a')).toEqual(cache);
    expect(db.getRechargeRatio('site-a')).toBe(10);
    expect(db.getRechargeRatios()).toEqual({ 'site-a': 10 });
    expect(() => db.setRechargeRatio('site-a', 0)).toThrow('INVALID_RECHARGE_RATIO');
    expect(() => db.setRechargeRatio('site-a', Number.NaN)).toThrow('INVALID_RECHARGE_RATIO');
    expect(JSON.stringify(raw.prepare('SELECT value_json FROM settings').all())).not.toMatch(
      /password|access.?token|refresh.?token/i,
    );
    raw.close();
  });

  it('persists a reconciled site order and appends new sites at the end', () => {
    const raw = new DatabaseSync(':memory:');
    const db = new AppDatabase(raw);
    db.migrate();
    db.saveSite({ id: 'site-a', name: 'A', baseUrl: 'https://a.invalid', apiPrefix: '/api/v1' });
    db.saveSite({ id: 'site-b', name: 'B', baseUrl: 'https://b.invalid', apiPrefix: '/api/v1' });
    db.saveSite({ id: 'site-c', name: 'C', baseUrl: 'https://c.invalid', apiPrefix: '/api/v1' });
    db.setSetting('siteOrder', ['site-b', 'missing', 'site-b', 'site-a']);

    expect(db.listSites().map((site) => site.id)).toEqual(['site-b', 'site-a', 'site-c']);
    expect(db.getSetting('siteOrder', [])).toEqual(['site-b', 'site-a', 'site-c']);

    db.deleteSite('site-a');
    expect(db.listSites().map((site) => site.id)).toEqual(['site-b', 'site-c']);
    expect(db.getSetting('siteOrder', [])).toEqual(['site-b', 'site-c']);
    raw.close();
  });

  it('seeds radar defaults only when the radar setting is absent', () => {
    const raw = new DatabaseSync(':memory:');
    const db = new AppDatabase(raw);
    db.migrate();
    expect(db.getRadarEntries()).toEqual([
      { id: 'radar-codex', label: 'Codex 雷达', url: 'https://codexradar.com/' },
      {
        id: 'radar-distributed',
        label: '分布式雷达 Codex 站',
        url: 'https://deng.codexradar.com/',
      },
    ]);
    db.setRadarEntries([]);
    expect(db.getRadarEntries()).toEqual([]);
    raw.close();
  });

  it('persists sub2api server entries and keeps the empty array legal', () => {
    const raw = new DatabaseSync(':memory:');
    const db = new AppDatabase(raw);
    db.migrate();
    expect(db.getSub2ApiServers()).toEqual([]);
    const server = {
      id: 'server-a',
      partitionId: 'persist:sub2api-server-server-a',
      loginState: 'unknown' as const,
      seenLoggedIn: false,
      createdAt: 1,
      updatedAt: 1,
      name: '测试站',
      baseUrl: 'https://a.example/',
      shortcuts: [{ id: 's1', label: '账号管理', path: '/account' }],
    };
    db.setSub2ApiServers([server]);
    expect(db.getSub2ApiServers()).toEqual([server]);
    db.setSub2ApiServers([]);
    expect(db.getSub2ApiServers()).toEqual([]);
    expect(JSON.stringify(raw.prepare('SELECT value_json FROM settings').all())).not.toMatch(
      /password|access.?token|refresh.?token/i,
    );
    raw.close();
  });

  it('persists and clears discovered sub2api server menus separately from servers', () => {
    const raw = new DatabaseSync(':memory:');
    const db = new AppDatabase(raw);
    db.migrate();
    expect(db.getSub2ApiMenus('server-a')).toEqual([]);
    db.setSub2ApiMenus('server-a', [
      { id: 'm1', label: '账号管理', path: '/account', order: 0, discoveredAt: 123 },
    ]);
    expect(db.getSub2ApiMenus('server-a')).toEqual([
      { id: 'm1', label: '账号管理', path: '/account', order: 0, discoveredAt: 123 },
    ]);
    expect(db.getSub2ApiMenus('server-b')).toEqual([]);
    db.clearSub2ApiMenus('server-a');
    expect(db.getSub2ApiMenus('server-a')).toEqual([]);
    expect(JSON.stringify(raw.prepare('SELECT value_json FROM settings').all())).not.toMatch(
      /password|access.?token|refresh.?token/i,
    );
    raw.close();
  });

  it('persists dynamic radar entries as non-secret settings', () => {
    const raw = new DatabaseSync(':memory:');
    const db = new AppDatabase(raw);
    db.migrate();
    db.setRadarEntries([
      { id: 'radar-test', label: '测试雷达', url: 'https://example.com/' },
      ...db.getRadarEntries(),
    ]);
    expect(db.getRadarEntries()).toEqual([
      { id: 'radar-test', label: '测试雷达', url: 'https://example.com/' },
      { id: 'radar-codex', label: 'Codex 雷达', url: 'https://codexradar.com/' },
      {
        id: 'radar-distributed',
        label: '分布式雷达 Codex 站',
        url: 'https://deng.codexradar.com/',
      },
    ]);
    expect(JSON.stringify(raw.prepare('SELECT value_json FROM settings').all())).not.toMatch(
      /password|token/i,
    );
    raw.close();
  });
});

describe('CredentialVault', () => {
  it('encrypts values, rotates atomically, and deletes the reference', () => {
    const disk = new Map<string, string>();
    const codec = {
      isAvailable: () => true,
      encrypt: (value: string) => Buffer.from(`sealed:${value}`),
      decrypt: (value: Buffer) => value.toString().replace(/^sealed:/, ''),
    };
    const vault = new CredentialVault(codec, {
      read: (key) => disk.get(key),
      write: (key, value) => disk.set(key, value),
      remove: (key) => disk.delete(key),
    });
    vault.write('site-a', {
      account: 'safe@example.invalid',
      password: 'runtime',
      accessToken: 'a',
      refreshToken: 'r',
    });
    expect([...disk.values()].join('')).not.toContain('runtime');
    expect(vault.read('site-a')?.password).toBe('runtime');
    vault.remove('site-a');
    expect(vault.read('site-a')).toBeUndefined();
  });
});
