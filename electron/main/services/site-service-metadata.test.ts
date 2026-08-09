import { describe, expect, it, vi } from 'vitest';
import type { AppDatabase } from '../storage/database.js';
import type { CredentialVault } from '../storage/credential-vault.js';
import { SiteService } from './site-service.js';

function fakeMetadataDatabase() {
  const setSettingMock = vi.fn();
  const stored = new Map<string, unknown>();
  return {
    listSites: () => [
      {
        id: 'site-a',
        name: 'A',
        baseUrl: 'https://a.invalid',
        apiPrefix: '/api/v1',
      },
    ],
    listSnapshots: () => [],
    getRateCache: () => ({ groups: [], fetchedAt: 0 }),
    getKeyCache: () => [],
    getKeyPreference: () => ({ mode: 'auto' }),
    getSetting: (key: string) =>
      stored.has(key)
        ? stored.get(key)
        : key === 'site:site-a:metadataBackfillAttempted'
          ? false
          : undefined,
    setSetting: (key: string, value: unknown) => {
      stored.set(key, value);
      setSettingMock(key, value);
    },
    setSettingMock,
    setSiteMetadata: vi.fn(),
  } as unknown as AppDatabase & { setSettingMock: typeof setSettingMock };
}

describe('SiteService metadata backfill', () => {
  it('marks missing icons as attempted once and never blocks startup', async () => {
    const db = fakeMetadataDatabase();
    const service = new SiteService(db, {} as CredentialVault);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await service.startMetadataBackfill();
    await service.startMetadataBackfill();

    const attempts = db.setSettingMock.mock.calls.filter(
      (call) => call[0] === 'site:site-a:metadataBackfillAttempted',
    );
    expect(attempts).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});
