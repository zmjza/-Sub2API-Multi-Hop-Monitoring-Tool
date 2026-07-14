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
