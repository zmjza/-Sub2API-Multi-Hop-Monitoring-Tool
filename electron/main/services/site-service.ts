import { randomUUID } from 'node:crypto';
import type { AppDatabase } from '../storage/database.js';
import { CredentialVault } from '../storage/credential-vault.js';
import { normalizeSiteUrl } from '../adapters/url.js';
import { getInteractiveVerificationProvider, Sub2ApiClient } from '../adapters/http-client.js';
import { Sub2ApiAdapter } from '../adapters/sub2api-adapter.js';
import { aggregateSnapshots } from '../domain/snapshot.js';
import { selectDefaultKey } from '../domain/key-policy.js';
import { buildCsv } from '../domain/csv.js';
import { estimateDurationRange } from '../domain/scheduler.js';
import type { SiteSnapshot } from '../domain/types.js';
import type {
  DashboardSnapshot,
  SiteInput,
  SiteSummary,
  UsageQuery,
  KeyPreference,
  NotificationSettings,
  BatchSiteInput,
  RateContexts,
  RateSiteContext,
  ApiKeyListQuery,
  ApiKeyDetailRequest,
  ApiKeyGroupUpdateRequest,
  ApiKeyManagementPayload,
  ManagedApiKey,
  ApiKeyBatchUsage,
  InteractiveVerificationProvider,
} from '../../shared/contracts.js';
import {
  apiKeySummarySchema,
  availableRateGroupSchema,
  notificationSettingsSchema,
  rateContextsSchema,
  rateSiteContextSchema,
} from '../../shared/contracts.js';
import type { ApiKeySummary } from '../domain/types.js';

interface StoredSite {
  id: string;
  name: string;
  baseUrl: string;
  apiPrefix: string;
  capabilities?: Record<string, string>;
}

interface VerifiedSession {
  accessToken: string;
  refreshToken?: string;
}

export interface InteractiveAuthContext {
  input: SiteInput;
  provider: InteractiveVerificationProvider;
}

export class InteractiveVerificationRequiredError extends Error {
  readonly code = 'INTERACTIVE_VERIFICATION_REQUIRED';

  constructor(readonly provider: InteractiveVerificationProvider) {
    super('需要完成安全验证');
    this.name = 'InteractiveVerificationRequiredError';
  }
}

export class SiteService {
  private readonly snapshots = new Map<string, SiteSnapshot>();
  private readonly errors = new Map<string, string[]>();
  private readonly durations = new Map<string, number[]>();
  private readonly runtime = new Map<
    string,
    { keyId?: string; defaultKeyLabel?: string; rate?: number }
  >();
  private readonly automaticRuntime = new Map<
    string,
    { keyId?: string; defaultKeyLabel?: string; rate?: number }
  >();
  private readonly keys = new Map<string, ApiKeySummary[]>();
  private readonly inflightRefresh = new Map<string, Promise<SiteSummary>>();
  private readonly rateStates = new Map<string, RateSiteContext>();
  private readonly inflightRateRefresh = new Map<string, Promise<RateSiteContext>>();
  private readonly apiKeyWrites = new Map<string, Promise<ManagedApiKey>>();
  private readonly apiKeyUsageCache = new Map<
    string,
    { fetchedAt: number; todayActualCost?: number; last30DaysActualCost?: number }
  >();
  private siteSaveQueue: Promise<void> = Promise.resolve();
  private progressListener?: (
    siteId: string,
    phase: 'profile' | 'keys' | 'groups' | 'rates' | 'usage',
  ) => void;
  private keyContextListener?: (siteId: string) => void;

  constructor(
    private readonly db: AppDatabase,
    private readonly vault: CredentialVault,
  ) {
    for (const row of db.listSnapshots()) {
      try {
        this.snapshots.set(row.siteId, JSON.parse(row.snapshotJson) as SiteSnapshot);
      } catch {
        /* discard corrupt cache */
      }
    }
    for (const site of db.listSites()) {
      const rateCache = db.getRateCache(site.id);
      const cachedGroups = availableRateGroupSchema.array().safeParse(rateCache.groups);
      if (
        cachedGroups.success &&
        typeof rateCache.fetchedAt === 'number' &&
        Number.isFinite(rateCache.fetchedAt) &&
        rateCache.fetchedAt >= 0
      )
        this.rateStates.set(site.id, {
          siteId: site.id,
          groups: cachedGroups.data,
          fetchedAt: rateCache.fetchedAt,
          source: 'cache',
          state: cachedGroups.data.length ? 'success' : 'empty',
        });
      const cached = apiKeySummarySchema.array().safeParse(db.getKeyCache(site.id));
      if (!cached.success) continue;
      this.keys.set(site.id, cached.data);
      const preference = db.getKeyPreference(site.id);
      const automatic = cached.data.find((key) => key.status === 'active');
      const manual =
        preference.mode === 'manual'
          ? cached.data.find((key) => key.id === preference.keyId && key.status === 'active')
          : undefined;
      const automaticState = {
        keyId: automatic?.id,
        defaultKeyLabel: automatic?.maskedLabel,
        rate: automatic?.rate,
      };
      this.automaticRuntime.set(site.id, automaticState);
      const selected = manual ?? automatic;
      if (selected)
        this.runtime.set(site.id, {
          keyId: selected.id,
          defaultKeyLabel: selected.maskedLabel,
          rate: selected.rate,
        });
    }
  }

  setProgressListener(
    listener: (siteId: string, phase: 'profile' | 'keys' | 'groups' | 'rates' | 'usage') => void,
  ): void {
    this.progressListener = listener;
  }

  setKeyContextListener(listener: (siteId: string) => void): void {
    this.keyContextListener = listener;
  }

  listSites(): DashboardSnapshot {
    const sites = this.db.listSites().map((site) => this.toSummary(site));
    const snapshotList = sites.flatMap((site) => {
      const snapshot = this.snapshots.get(site.id);
      return snapshot ? [snapshot] : [];
    });
    const totals = aggregateSnapshots(snapshotList, Date.now(), 120_000);
    const savedCurrent = this.db.getSetting<string | undefined>('currentSiteId', undefined);
    const currentSiteId = sites.some((site) => site.id === savedCurrent)
      ? savedCurrent
      : sites[0]?.id;
    return { sites, totals: { ...totals, total: sites.length }, currentSiteId };
  }

  setCurrentSite(siteId: string): DashboardSnapshot {
    if (!this.db.listSites().some((site) => site.id === siteId)) throw new Error('SITE_NOT_FOUND');
    this.db.setSetting('currentSiteId', siteId);
    return this.listSites();
  }

  setSiteNote(siteId: string, note: string): SiteSummary {
    if (!this.db.listSites().some((site) => site.id === siteId)) throw new Error('SITE_NOT_FOUND');
    this.db.setSiteNote(siteId, note);
    const site = this.db.listSites().find((candidate) => candidate.id === siteId);
    if (!site) throw new Error('SITE_NOT_FOUND');
    return this.toSummary(site);
  }

  rateContexts(): RateContexts {
    const sites = Object.fromEntries(
      this.db.listSites().map((site) => [
        site.id,
        this.rateStates.get(site.id) ?? {
          siteId: site.id,
          groups: [],
          source: 'none' as const,
          state: 'empty' as const,
        },
      ]),
    );
    return rateContextsSchema.parse({ sites, ratios: this.db.getRechargeRatios() });
  }

  setRechargeRatio(siteId: string, ratio: number): RateContexts {
    if (!this.db.listSites().some((site) => site.id === siteId)) throw new Error('SITE_NOT_FOUND');
    this.db.setRechargeRatio(siteId, ratio);
    return this.rateContexts();
  }

  refreshRateGroups(siteId: string): Promise<RateSiteContext> {
    const existing = this.inflightRateRefresh.get(siteId);
    if (existing) return existing;
    const request = this.fetchRateGroups(siteId).finally(() => {
      if (this.inflightRateRefresh.get(siteId) === request) this.inflightRateRefresh.delete(siteId);
    });
    this.inflightRateRefresh.set(siteId, request);
    return request;
  }

  async refreshAllRateGroups(): Promise<RateContexts> {
    const siteIds = this.db.listSites().map((site) => site.id);
    let cursor = 0;
    const worker = async () => {
      while (cursor < siteIds.length) {
        const siteId = siteIds[cursor++];
        if (siteId) await this.refreshRateGroups(siteId);
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, siteIds.length) }, worker));
    return this.rateContexts();
  }

  private async fetchRateGroups(siteId: string): Promise<RateSiteContext> {
    const site = this.db.listSites().find((candidate) => candidate.id === siteId);
    const credential = site ? this.vault.read(site.id) : undefined;
    if (!site) throw new Error('SITE_NOT_FOUND');
    if (!credential?.accessToken) {
      const context = this.rateErrorContext(siteId, 'auth-required', '需要重新登录');
      this.rateStates.set(siteId, context);
      return context;
    }
    try {
      const client = new Sub2ApiClient(`${site.baseUrl}${site.apiPrefix}`);
      const adapter = new Sub2ApiAdapter(client);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const readGroups = (accessToken: string) =>
        adapter.readAvailableRateGroups(accessToken, timezone);
      let groups: Awaited<ReturnType<Sub2ApiAdapter['readAvailableRateGroups']>> | undefined;
      try {
        groups = await readGroups(credential.accessToken);
      } catch (error) {
        if (!isAuthError(error)) throw error;
        let recovered = false;
        if (credential.refreshToken) {
          try {
            const renewed = await client.refresh(credential.refreshToken);
            this.vault.write(siteId, {
              ...credential,
              accessToken: renewed.accessToken,
              refreshToken: renewed.refreshToken,
            });
            groups = await readGroups(renewed.accessToken);
            recovered = true;
          } catch {
            /* fall through to password login */
          }
        }
        if (!recovered) {
          if (isInteractiveAuthenticationMode(credential.authenticationMode))
            throw { code: 'AUTH_REQUIRED', message: '需要重新验证', retryable: false };
          const relogin = await client.login(credential.account, credential.password);
          this.vault.write(siteId, {
            ...credential,
            accessToken: relogin.accessToken,
            refreshToken: relogin.refreshToken,
          });
          groups = await readGroups(relogin.accessToken);
        }
      }
      if (groups === undefined) throw new Error('RATE_SESSION_RECOVERY_FAILED');
      const fetchedAt = Date.now();
      const context = rateSiteContextSchema.parse({
        siteId,
        groups,
        fetchedAt,
        source: 'live',
        state: groups.length ? 'success' : 'empty',
      });
      this.db.setRateCache(siteId, { groups, fetchedAt });
      this.rateStates.set(siteId, context);
      return context;
    } catch (error) {
      const context = this.rateErrorContext(
        siteId,
        isAuthError(error) ? 'auth-required' : 'error',
        safeMessage(error),
      );
      this.rateStates.set(siteId, context);
      return context;
    }
  }

  private rateErrorContext(
    siteId: string,
    state: 'error' | 'auth-required',
    error: string,
  ): RateSiteContext {
    const cached = this.rateStates.get(siteId);
    return rateSiteContextSchema.parse({
      siteId,
      groups: cached?.groups ?? [],
      ...(cached?.fetchedAt === undefined ? {} : { fetchedAt: cached.fetchedAt }),
      source: cached?.groups.length ? 'cache' : 'none',
      state,
      error,
    });
  }

  deleteSite(siteId: string): DashboardSnapshot {
    if (!this.db.listSites().some((site) => site.id === siteId)) throw new Error('SITE_NOT_FOUND');
    this.vault.remove(siteId);
    this.db.deleteSetting(`site:${siteId}:note`);
    this.db.deleteSetting(`channelAssociations:${siteId}`);
    this.db.deleteSetting(`site:${siteId}:keyPreference`);
    this.db.deleteSetting(`site:${siteId}:keyCache`);
    this.db.deleteSetting(`site:${siteId}:rateCache`);
    this.db.deleteSetting(`site:${siteId}:rechargeRatio`);
    if (this.db.getSetting<string | undefined>('currentSiteId', undefined) === siteId)
      this.db.deleteSetting('currentSiteId');
    const notificationSettings = this.db.getNotificationSettings();
    if (Object.prototype.hasOwnProperty.call(notificationSettings.sites, siteId)) {
      const sites = Object.fromEntries(
        Object.entries(notificationSettings.sites).filter(([id]) => id !== siteId),
      );
      this.db.setNotificationSettings({ ...notificationSettings, sites });
    }
    this.db.deleteSite(siteId);
    this.snapshots.delete(siteId);
    this.errors.delete(siteId);
    this.durations.delete(siteId);
    this.runtime.delete(siteId);
    this.automaticRuntime.delete(siteId);
    this.keys.delete(siteId);
    this.rateStates.delete(siteId);
    this.inflightRefresh.delete(siteId);
    this.inflightRateRefresh.delete(siteId);
    this.apiKeyWrites.delete(siteId);
    this.apiKeyUsageCache.delete(siteId);
    return this.listSites();
  }

  async addAndVerify(input: SiteInput): Promise<SiteSummary> {
    const normalized = this.normalizedNewSite(input);
    const client = new Sub2ApiClient(normalized.apiBaseUrl);
    const session = await client.login(input.account, input.password).catch((error: unknown) => {
      const provider = getInteractiveVerificationProvider(error);
      if (provider) throw new InteractiveVerificationRequiredError(provider);
      throw new Error(siteInputErrorMessage(error));
    });
    return this.verifyAndSave(input, normalized, session, 'password');
  }

  async requiresInteractiveVerification(
    input: SiteInput,
  ): Promise<InteractiveVerificationProvider | undefined> {
    const normalized = this.normalizedNewSite(input);
    try {
      const mode = await new Sub2ApiClient(normalized.apiBaseUrl).authenticationMode();
      return mode.interactiveVerification.required
        ? mode.interactiveVerification.provider
        : undefined;
    } catch {
      return undefined;
    }
  }

  async addWithInteractiveSession(
    input: SiteInput,
    session: VerifiedSession,
    provider: InteractiveVerificationProvider = 'geetest',
  ): Promise<SiteSummary> {
    const normalized = this.normalizedNewSite(input);
    return this.verifyAndSave(input, normalized, session, 'interactive', provider);
  }

  getInteractiveAuthContext(siteId: string): InteractiveAuthContext {
    const site = this.db.listSites().find((candidate) => candidate.id === siteId);
    let credential: ReturnType<CredentialVault['read']>;
    try {
      credential = site ? this.vault.read(site.id) : undefined;
    } catch {
      throw new Error('INTERACTIVE_VERIFICATION_UNAVAILABLE');
    }
    if (!site || !credential) throw new Error('SITE_NOT_FOUND');
    const provider =
      credential.authenticationProvider ??
      (credential.authenticationMode === 'geetest' ? 'geetest' : undefined);
    if (!provider || !isInteractiveAuthenticationMode(credential.authenticationMode))
      throw new Error('INTERACTIVE_VERIFICATION_UNAVAILABLE');
    return {
      input: {
        name: site.name,
        url: site.baseUrl,
        account: credential.account,
        password: credential.password,
      },
      provider,
    };
  }

  async reverifyWithInteractiveSession(
    siteId: string,
    session: VerifiedSession,
    provider: InteractiveVerificationProvider,
  ): Promise<SiteSummary> {
    const site = this.db.listSites().find((candidate) => candidate.id === siteId);
    let credential: ReturnType<CredentialVault['read']>;
    try {
      credential = site ? this.vault.read(site.id) : undefined;
    } catch {
      throw new Error('INTERACTIVE_VERIFICATION_UNAVAILABLE');
    }
    if (!site || !credential) throw new Error('SITE_NOT_FOUND');
    const started = Date.now();
    const client = new Sub2ApiClient(`${site.baseUrl}${site.apiPrefix}`);
    const adapter = new Sub2ApiAdapter(client, undefined, (phase) =>
      this.progressListener?.(siteId, phase),
    );
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const core = await adapter.readCore(session.accessToken, timezone);
    assertProfileIdentity(credential.account, core.profile.account);
    const requestsByKey = await adapter.readTodayRequestsByKey(
      session.accessToken,
      core.keys,
      timezone,
    );
    const snapshot = createSnapshot(siteId, core.profile.balance, core.usage);
    const nextKeys = withRates(core.keys, core.rates);
    apiKeySummarySchema.array().parse(nextKeys);
    const previousSnapshot = this.snapshots.get(siteId);
    const previousPersistedSnapshot = this.db.listSnapshots().find((row) => row.siteId === siteId);
    const previousKeys = this.keys.get(siteId);
    const previousPersistedKeyCache = this.db.getSetting<unknown | undefined>(
      `site:${siteId}:keyCache`,
      undefined,
    );
    const previousPersistedKeyPreference = this.db.getSetting<KeyPreference | undefined>(
      `site:${siteId}:keyPreference`,
      undefined,
    );
    const previousRuntime = this.runtime.get(siteId);
    const previousAutomaticRuntime = this.automaticRuntime.get(siteId);
    const previousErrors = this.errors.get(siteId);
    const previousDurations = this.durations.get(siteId);
    let credentialWriteAttempted = false;
    try {
      this.snapshots.set(siteId, snapshot);
      this.db.saveSnapshot(
        siteId,
        JSON.stringify(snapshot),
        snapshot.fetchedAt,
        snapshot.fetchedAt + 120_000,
      );
      this.cacheKeys(siteId, nextKeys);
      this.updateRuntimeKey(siteId, core.keys, core.rates, requestsByKey);
      this.errors.delete(siteId);
      this.durations.set(
        siteId,
        [...(this.durations.get(siteId) ?? []), Date.now() - started].slice(-10),
      );
      credentialWriteAttempted = true;
      this.vault.write(siteId, {
        ...credential,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        authenticationMode: 'interactive',
        authenticationProvider: provider,
      });
      return this.toSummary(site);
    } catch (error) {
      if (credentialWriteAttempted) {
        try {
          this.vault.write(siteId, credential);
        } catch {
          /* Preserve the original error; secure storage may be temporarily unavailable. */
        }
      }
      if (previousSnapshot) this.snapshots.set(siteId, previousSnapshot);
      else this.snapshots.delete(siteId);
      try {
        if (previousPersistedSnapshot) {
          this.db.saveSnapshot(
            siteId,
            previousPersistedSnapshot.snapshotJson,
            previousPersistedSnapshot.fetchedAt,
            previousPersistedSnapshot.expiresAt,
          );
        } else {
          this.db.deleteSnapshot(siteId);
        }
        if (previousPersistedKeyCache === undefined)
          this.db.deleteSetting(`site:${siteId}:keyCache`);
        else this.db.setSetting(`site:${siteId}:keyCache`, previousPersistedKeyCache);
        if (previousPersistedKeyPreference === undefined)
          this.db.deleteSetting(`site:${siteId}:keyPreference`);
        else this.db.setSetting(`site:${siteId}:keyPreference`, previousPersistedKeyPreference);
      } catch {
        /* Preserve the original error; rollback is best-effort at the storage boundary. */
      }
      if (previousKeys) this.keys.set(siteId, previousKeys);
      else this.keys.delete(siteId);
      if (previousRuntime) this.runtime.set(siteId, previousRuntime);
      else this.runtime.delete(siteId);
      if (previousAutomaticRuntime) this.automaticRuntime.set(siteId, previousAutomaticRuntime);
      else this.automaticRuntime.delete(siteId);
      if (previousErrors) this.errors.set(siteId, previousErrors);
      else this.errors.delete(siteId);
      if (previousDurations) this.durations.set(siteId, previousDurations);
      else this.durations.delete(siteId);
      this.keyContextListener?.(siteId);
      throw error;
    }
  }

  private normalizedNewSite(input: SiteInput): ReturnType<typeof normalizeSiteUrl> {
    let normalized: ReturnType<typeof normalizeSiteUrl>;
    try {
      normalized = normalizeSiteUrl(input.url);
    } catch {
      throw new Error('站点地址无效');
    }
    this.assertUniqueSiteAccount(normalized.baseUrl, input.account);
    return normalized;
  }

  private assertUniqueSiteAccount(baseUrl: string, account: string): void {
    const identity = normalizeAccountIdentity(account);
    for (const site of this.db.listSites()) {
      if (site.baseUrl !== baseUrl) continue;
      let credential;
      try {
        credential = this.vault.read(site.id);
      } catch {
        throw new Error('SITE_ACCOUNT_IDENTITY_UNAVAILABLE');
      }
      if (!credential?.account) throw new Error('SITE_ACCOUNT_IDENTITY_UNAVAILABLE');
      if (normalizeAccountIdentity(credential.account) === identity)
        throw new Error('SITE_DUPLICATE_ACCOUNT');
    }
  }

  private async verifyAndSave(
    input: SiteInput,
    normalized: ReturnType<typeof normalizeSiteUrl>,
    session: VerifiedSession,
    authenticationMode: 'password' | 'interactive',
    authenticationProvider?: InteractiveVerificationProvider,
  ): Promise<SiteSummary> {
    const id = randomUUID();
    const started = Date.now();
    const client = new Sub2ApiClient(normalized.apiBaseUrl);
    const adapter = new Sub2ApiAdapter(client, undefined, (phase) =>
      this.progressListener?.(id, phase),
    );
    const core = await adapter
      .readCore(session.accessToken, Intl.DateTimeFormat().resolvedOptions().timeZone)
      .catch((error: unknown) => {
        throw new Error(siteInputErrorMessage(error));
      });
    assertProfileIdentity(input.account, core.profile.account);
    let channelCapability: string;
    try {
      channelCapability = (await adapter.readOptionalChannels(session.accessToken)).state;
    } catch {
      channelCapability = 'error';
    }
    const requestsByKey = await adapter
      .readTodayRequestsByKey(
        session.accessToken,
        core.keys,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      )
      .catch((error: unknown) => {
        throw new Error(siteInputErrorMessage(error));
      });
    return this.serializeSiteSave(async () => {
      this.assertUniqueSiteAccount(normalized.baseUrl, input.account);
      let persistenceStarted = false;
      try {
        this.db.saveSite({
          id,
          name: input.name,
          baseUrl: normalized.baseUrl,
          apiPrefix: normalized.apiPrefix,
        });
        persistenceStarted = true;
        const capabilities = {
          profile: 'supported',
          keys: 'supported',
          groups: 'supported',
          rates: 'supported',
          usageStats: 'supported',
          usageList: 'unknown',
          channelMonitors: channelCapability,
        };
        this.db.setCapabilities(id, capabilities);
        this.vault.write(id, {
          account: input.account,
          password: input.password,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          authenticationMode,
          authenticationProvider,
        });
        this.db.saveCredentialReference(id, maskAccount(input.account), `credential:${id}`);
        const snapshot = createSnapshot(id, core.profile.balance, core.usage);
        this.snapshots.set(id, snapshot);
        this.db.saveSnapshot(
          id,
          JSON.stringify(snapshot),
          snapshot.fetchedAt,
          snapshot.fetchedAt + 120_000,
        );
        this.durations.set(id, [Date.now() - started]);
        this.cacheKeys(id, withRates(core.keys, core.rates));
        this.updateRuntimeKey(id, core.keys, core.rates, requestsByKey);
        return this.toSummary({
          id,
          name: input.name,
          baseUrl: normalized.baseUrl,
          apiPrefix: normalized.apiPrefix,
          capabilities,
        });
      } catch (error) {
        if (persistenceStarted) {
          try {
            this.vault.remove(id);
          } catch {
            /* Best-effort cleanup; the site is still removed below. */
          }
          this.db.deleteSite(id);
          this.db.deleteSetting(`site:${id}:keyCache`);
          this.db.deleteSetting(`site:${id}:keyPreference`);
          this.db.deleteSetting(`site:${id}:rateCache`);
          this.db.deleteSetting(`site:${id}:rechargeRatio`);
        }
        this.snapshots.delete(id);
        this.errors.delete(id);
        this.durations.delete(id);
        this.runtime.delete(id);
        this.automaticRuntime.delete(id);
        this.keys.delete(id);
        this.rateStates.delete(id);
        throw error;
      }
    });
  }

  private async serializeSiteSave<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.siteSaveQueue;
    let release!: () => void;
    this.siteSaveQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  }

  async addBatch(
    input: BatchSiteInput,
    onProgress: (value: {
      current: number;
      total: number;
      url: string;
      status: 'success' | 'failed';
      error?: string;
    }) => void = () => undefined,
  ): Promise<{ successes: SiteSummary[]; failures: Array<{ url: string; error: string }> }> {
    const successes: SiteSummary[] = [];
    const failures: Array<{ url: string; error: string }> = [];
    for (const [index, url] of input.urls.entries()) {
      try {
        let host: string;
        try {
          host = new URL(url).hostname;
        } catch {
          throw new Error('站点地址无效');
        }
        const siteInput = {
          name: host,
          url,
          account: input.account,
          password: input.password,
        };
        const provider = await this.requiresInteractiveVerification(siteInput);
        if (provider) throw new InteractiveVerificationRequiredError(provider);
        const site = await this.addAndVerify(siteInput);
        successes.push(site);
        onProgress({ current: index + 1, total: input.urls.length, url, status: 'success' });
      } catch (error) {
        const message =
          error instanceof InteractiveVerificationRequiredError
            ? '需要单独完成安全验证'
            : safeMessage(error);
        failures.push({ url, error: message });
        onProgress({
          current: index + 1,
          total: input.urls.length,
          url,
          status: 'failed',
          error: message,
        });
      }
    }
    return { successes, failures };
  }

  refresh(siteId: string): Promise<SiteSummary> {
    const existing = this.inflightRefresh.get(siteId);
    if (existing) return existing;
    const request = this.refreshInternal(siteId).finally(() => {
      if (this.inflightRefresh.get(siteId) === request) this.inflightRefresh.delete(siteId);
    });
    this.inflightRefresh.set(siteId, request);
    return request;
  }

  private async refreshInternal(siteId: string): Promise<SiteSummary> {
    const site = this.db.listSites().find((candidate) => candidate.id === siteId);
    if (!site) throw new Error('SITE_NOT_FOUND');
    const credential = this.vault.read(siteId);
    if (!credential) throw new Error('AUTH_REQUIRED');
    const started = Date.now();
    const client = new Sub2ApiClient(`${site.baseUrl}${site.apiPrefix}`);
    const accessToken = credential.accessToken;
    if (!accessToken && isInteractiveAuthenticationMode(credential.authenticationMode)) {
      this.errors.set(siteId, ['auth-required']);
      return this.toSummary(site);
    }
    let session = accessToken
      ? { accessToken, refreshToken: credential.refreshToken, expiresAt: Date.now() + 60_000 }
      : undefined;
    if (!session || !accessToken) {
      try {
        session = await client.login(credential.account, credential.password);
      } catch (error) {
        const provider = getInteractiveVerificationProvider(error);
        if (provider)
          this.vault.write(siteId, {
            ...credential,
            authenticationMode: 'interactive',
            authenticationProvider: provider,
          });
        this.errors.set(siteId, ['auth-required']);
        return this.toSummary(site);
      }
    }
    const adapter = new Sub2ApiAdapter(
      client,
      undefined,
      (phase) => this.progressListener?.(siteId, phase),
      (keys) => this.cacheKeys(siteId, keys),
    );
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const core = await adapter.readCore(accessToken ?? session.accessToken, timezone);
      this.cacheKeys(siteId, withRates(core.keys, core.rates));
      const requestsByKey = await adapter.readTodayRequestsByKey(
        accessToken ?? session.accessToken,
        core.keys,
        timezone,
      );
      const snapshot = createSnapshot(siteId, core.profile.balance, core.usage);
      this.snapshots.set(siteId, snapshot);
      this.db.saveSnapshot(
        siteId,
        JSON.stringify(snapshot),
        snapshot.fetchedAt,
        snapshot.fetchedAt + 120_000,
      );
      this.updateRuntimeKey(siteId, core.keys, core.rates, requestsByKey);
      this.errors.delete(siteId);
      this.durations.set(
        siteId,
        [...(this.durations.get(siteId) ?? []), Date.now() - started].slice(-10),
      );
      return this.toSummary(site);
    } catch (error) {
      if (isAuthError(error) && isInteractiveAuthenticationMode(credential.authenticationMode)) {
        if (!session.refreshToken) {
          this.errors.set(siteId, ['auth-required']);
          return this.toSummary(site);
        }
      }
      if (isAuthError(error) && session.refreshToken) {
        try {
          const renewed = await client.refresh(session.refreshToken);
          this.vault.write(siteId, {
            ...credential,
            accessToken: renewed.accessToken,
            refreshToken: renewed.refreshToken,
          });
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const core = await adapter.readCore(renewed.accessToken, timezone);
          this.cacheKeys(siteId, withRates(core.keys, core.rates));
          const requestsByKey = await adapter.readTodayRequestsByKey(
            renewed.accessToken,
            core.keys,
            timezone,
          );
          const snapshot = createSnapshot(siteId, core.profile.balance, core.usage);
          this.snapshots.set(siteId, snapshot);
          this.db.saveSnapshot(
            siteId,
            JSON.stringify(snapshot),
            snapshot.fetchedAt,
            snapshot.fetchedAt + 120_000,
          );
          this.updateRuntimeKey(siteId, core.keys, core.rates, requestsByKey);
          this.errors.delete(siteId);
          return this.toSummary(site);
        } catch {
          if (isInteractiveAuthenticationMode(credential.authenticationMode)) {
            this.errors.set(siteId, ['auth-required']);
            return this.toSummary(site);
          }
          try {
            const relogin = await client.login(credential.account, credential.password);
            this.vault.write(siteId, {
              ...credential,
              accessToken: relogin.accessToken,
              refreshToken: relogin.refreshToken,
            });
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const core = await adapter.readCore(relogin.accessToken, timezone);
            this.cacheKeys(siteId, withRates(core.keys, core.rates));
            const requestsByKey = await adapter.readTodayRequestsByKey(
              relogin.accessToken,
              core.keys,
              timezone,
            );
            const snapshot = createSnapshot(siteId, core.profile.balance, core.usage);
            this.snapshots.set(siteId, snapshot);
            this.db.saveSnapshot(
              siteId,
              JSON.stringify(snapshot),
              snapshot.fetchedAt,
              snapshot.fetchedAt + 120_000,
            );
            this.updateRuntimeKey(siteId, core.keys, core.rates, requestsByKey);
            this.errors.delete(siteId);
            return this.toSummary(site);
          } catch (reloginError) {
            const provider = getInteractiveVerificationProvider(reloginError);
            if (provider)
              this.vault.write(siteId, {
                ...credential,
                authenticationMode: 'interactive',
                authenticationProvider: provider,
              });
            this.errors.set(siteId, ['auth-required']);
            return this.toSummary(site);
          }
        }
      }
      this.errors.set(siteId, [safeMessage(error)]);
      return this.toSummary(site);
    }
  }

  async usage(query: UsageQuery): Promise<unknown> {
    const site = this.db.listSites().find((candidate) => candidate.id === query.siteId);
    const credential = site ? this.vault.read(site.id) : undefined;
    if (!site || !credential?.accessToken) throw new Error('AUTH_REQUIRED');
    const client = new Sub2ApiClient(`${site.baseUrl}${site.apiPrefix}`);
    const adapter = new Sub2ApiAdapter(client);
    const result = await adapter.readUsage(credential.accessToken, usageUpstreamQuery(query));
    this.db.setCapabilities(site.id, { ...(site.capabilities ?? {}), usageList: 'supported' });
    return result;
  }

  async usageStats(query: UsageQuery) {
    const site = this.db.listSites().find((candidate) => candidate.id === query.siteId);
    const credential = site ? this.vault.read(site.id) : undefined;
    if (!site || !credential?.accessToken) throw new Error('AUTH_REQUIRED');
    const client = new Sub2ApiClient(`${site.baseUrl}${site.apiPrefix}`);
    const result = await new Sub2ApiAdapter(client).readUsageStats(
      credential.accessToken,
      usageUpstreamQuery(query),
    );
    this.db.setCapabilities(site.id, { ...(site.capabilities ?? {}), usageStats: 'supported' });
    return result;
  }

  async usageCsv(query: UsageQuery): Promise<string> {
    const value = (await this.usage(query)) as import('../../shared/contracts.js').UsagePayload;
    return buildCsv(
      value.items.map((item) => ({
        time: item.createdAt,
        keyLabel: item.apiKeyLabel,
        model: item.model,
        tokens: item.totalTokens,
        firstTokenMs: item.firstTokenMs,
        durationMs: item.durationMs,
        actualCost: item.actualCost,
      })),
    );
  }

  async usageGroups(siteId: string) {
    const site = this.db.listSites().find((candidate) => candidate.id === siteId);
    const credential = site ? this.vault.read(site.id) : undefined;
    if (!site || !credential?.accessToken) throw new Error('AUTH_REQUIRED');
    const client = new Sub2ApiClient(`${site.baseUrl}${site.apiPrefix}`);
    return new Sub2ApiAdapter(client).readUsageGroups(credential.accessToken);
  }

  async usageModels(siteId: string) {
    const site = this.db.listSites().find((candidate) => candidate.id === siteId);
    const credential = site ? this.vault.read(site.id) : undefined;
    if (!site || !credential?.accessToken) throw new Error('AUTH_REQUIRED');
    const client = new Sub2ApiClient(`${site.baseUrl}${site.apiPrefix}`);
    return new Sub2ApiAdapter(client).readUsageModels(
      credential.accessToken,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  }

  async channels(siteId: string) {
    const site = this.db.listSites().find((candidate) => candidate.id === siteId);
    const credential = site ? this.vault.read(site.id) : undefined;
    if (!site || !credential?.accessToken) throw new Error('AUTH_REQUIRED');
    const client = new Sub2ApiClient(`${site.baseUrl}${site.apiPrefix}`);
    const result = await new Sub2ApiAdapter(client).readOptionalChannels(credential.accessToken);
    this.db.setCapabilities(siteId, {
      ...(site.capabilities ?? {}),
      channelMonitors: result.state,
    });
    return result;
  }

  async channelStatus(siteId: string, channelId: string) {
    const site = this.db.listSites().find((candidate) => candidate.id === siteId);
    const credential = site ? this.vault.read(site.id) : undefined;
    if (!site || !credential?.accessToken) throw new Error('AUTH_REQUIRED');
    const client = new Sub2ApiClient(`${site.baseUrl}${site.apiPrefix}`);
    return new Sub2ApiAdapter(client).readChannelStatus(credential.accessToken, channelId);
  }

  getChannelAssociations(siteId: string) {
    return this.db.getChannelAssociations(siteId);
  }

  setChannelAssociation(siteId: string, groupId: string, channelIds: string[]) {
    return this.db.setChannelAssociation(siteId, groupId, channelIds);
  }

  clearChannelAssociation(siteId: string, groupId: string) {
    return this.db.clearChannelAssociation(siteId, groupId);
  }

  async apiKeys(query: ApiKeyListQuery): Promise<ApiKeyManagementPayload> {
    const { adapter, accessToken } = this.apiKeySession(query.siteId);
    const [page, groups] = await Promise.all([
      adapter.readApiKeyPage(accessToken, {
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        search: query.search,
        groupId: query.groupId,
        status: query.status,
      }),
      adapter.readApiKeyGroups(accessToken),
    ]);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let partial = false;
    const today: ApiKeyBatchUsage = await adapter
      .readBatchApiKeyUsage(
        accessToken,
        page.items.map((key) => key.id),
      )
      .catch(() => {
        partial = true;
        return {} as ApiKeyBatchUsage;
      });
    const items = await mapConcurrent(page.items, 4, async (key) => {
      const cacheKey = `${query.siteId}:${key.id}`;
      const cached = this.apiKeyUsageCache.get(cacheKey);
      const fresh = cached && !query.force && Date.now() - cached.fetchedAt < 60_000;
      let last30DaysActualCost = fresh ? cached.last30DaysActualCost : undefined;
      if (!fresh) {
        try {
          last30DaysActualCost = (await adapter.readApiKeyDailyUsage(accessToken, key.id, timezone))
            .actualCost30d;
        } catch {
          partial = true;
        }
      }
      const todayActualCost = today[key.id]?.todayActualCost ?? cached?.todayActualCost;
      this.apiKeyUsageCache.set(cacheKey, {
        fetchedAt: Date.now(),
        ...(todayActualCost === undefined ? {} : { todayActualCost }),
        ...(last30DaysActualCost === undefined ? {} : { last30DaysActualCost }),
      });
      const group = groups.find((candidate) => candidate.id === key.groupId);
      return {
        ...key,
        ...(key.platform || !group?.platform ? {} : { platform: group.platform }),
        ...(key.effectiveRate !== undefined || group?.effectiveRate === undefined
          ? {}
          : { effectiveRate: group.effectiveRate }),
        ...(todayActualCost === undefined ? {} : { todayActualCost }),
        ...(last30DaysActualCost === undefined ? {} : { last30DaysActualCost }),
      };
    });
    return {
      items,
      groups,
      page: { page: page.page, pageSize: page.pageSize, pages: page.pages, total: page.total },
      state: partial ? 'partial' : 'success',
    };
  }

  async apiKeyDetail(input: ApiKeyDetailRequest): Promise<ManagedApiKey> {
    const { adapter, accessToken } = this.apiKeySession(input.siteId);
    return adapter.readApiKeyDetail(accessToken, input.keyId);
  }

  updateApiKeyGroup(input: ApiKeyGroupUpdateRequest): Promise<ManagedApiKey> {
    const lockKey = `${input.siteId}:${input.keyId}`;
    if (this.apiKeyWrites.has(lockKey)) return Promise.reject(new Error('KEY_UPDATE_IN_PROGRESS'));
    const request = this.performApiKeyGroupUpdate(input).finally(() => {
      if (this.apiKeyWrites.get(lockKey) === request) this.apiKeyWrites.delete(lockKey);
    });
    this.apiKeyWrites.set(lockKey, request);
    return request;
  }

  private async performApiKeyGroupUpdate(input: ApiKeyGroupUpdateRequest): Promise<ManagedApiKey> {
    const { adapter, accessToken } = this.apiKeySession(input.siteId);
    await adapter.updateApiKeyGroup(accessToken, input.keyId, input.groupId);
    const confirmed = await adapter.readApiKeyDetail(accessToken, input.keyId);
    if (confirmed.groupId !== input.groupId) throw new Error('KEY_GROUP_CONFIRMATION_FAILED');
    this.apiKeyUsageCache.delete(`${input.siteId}:${input.keyId}`);
    const cached = this.keys.get(input.siteId);
    if (cached) {
      this.keys.set(
        input.siteId,
        cached.map((key) =>
          key.id === input.keyId
            ? {
                ...key,
                groupId: confirmed.groupId,
                groupName: confirmed.groupName,
                rate: confirmed.effectiveRate,
              }
            : key,
        ),
      );
      this.keyContextListener?.(input.siteId);
    }
    return confirmed;
  }

  private apiKeySession(siteId: string) {
    const site = this.db.listSites().find((candidate) => candidate.id === siteId);
    const credential = site ? this.vault.read(site.id) : undefined;
    if (!site || !credential?.accessToken) throw new Error('AUTH_REQUIRED');
    return {
      adapter: new Sub2ApiAdapter(new Sub2ApiClient(`${site.baseUrl}${site.apiPrefix}`)),
      accessToken: credential.accessToken,
    };
  }

  listKeys(siteId: string) {
    return (this.keys.get(siteId) ?? []).map(
      ({
        id,
        name,
        maskedLabel,
        status,
        groupId,
        groupName,
        quota,
        quotaUsed,
        subscriptionType,
        rate,
      }) => ({
        id,
        name,
        maskedLabel,
        status,
        groupId,
        groupName,
        quota,
        quotaUsed,
        subscriptionType,
        rate,
      }),
    );
  }

  listKeyContexts() {
    return Object.fromEntries(
      this.db.listSites().map((site) => {
        const keys = this.listKeys(site.id);
        const stored = this.db.getKeyPreference(site.id);
        const preference =
          stored.mode === 'manual' &&
          keys.length > 0 &&
          !keys.some((key) => key.id === stored.keyId && key.status === 'active')
            ? ({ mode: 'auto' } as const)
            : stored;
        if (preference !== stored) this.db.setKeyPreference(site.id, preference);
        return [site.id, { keys, preference }];
      }),
    );
  }

  getKeyPreference(siteId: string): KeyPreference {
    return this.db.getKeyPreference(siteId);
  }

  setKeyPreference(
    siteId: string,
    preference: KeyPreference,
  ): { preference: KeyPreference; fallback: boolean } {
    const keys = this.keys.get(siteId) ?? [];
    const valid =
      preference.mode === 'auto' ||
      keys.some((key) => key.id === preference.keyId && key.status === 'active');
    if (!valid) {
      const fallback: KeyPreference = { mode: 'auto' };
      this.db.setKeyPreference(siteId, fallback);
      this.keyContextListener?.(siteId);
      return { preference: fallback, fallback: true };
    }
    this.db.setKeyPreference(siteId, preference);
    if (preference.mode === 'manual') {
      const selected = keys.find((key) => key.id === preference.keyId);
      if (selected)
        this.runtime.set(siteId, {
          ...this.runtime.get(siteId),
          keyId: selected.id,
          defaultKeyLabel: selected.maskedLabel,
          rate: selected.rate,
        });
    } else {
      const automatic = this.automaticRuntime.get(siteId);
      if (automatic) this.runtime.set(siteId, automatic);
    }
    this.keyContextListener?.(siteId);
    return { preference, fallback: false };
  }

  getNotificationSettings(): NotificationSettings {
    return notificationSettingsSchema.parse(this.db.getNotificationSettings());
  }
  setNotificationSettings(settings: NotificationSettings): NotificationSettings {
    this.db.setNotificationSettings(settings);
    return settings;
  }

  private cacheKeys(siteId: string, keys: ApiKeySummary[]): void {
    const safeKeys = apiKeySummarySchema.array().parse(keys);
    this.keys.set(siteId, safeKeys);
    this.db.setKeyCache(siteId, safeKeys);
    this.keyContextListener?.(siteId);
  }

  private resetInvalidKeyPreference(siteId: string): void {
    this.db.setKeyPreference(siteId, { mode: 'auto' });
    this.keyContextListener?.(siteId);
  }

  private updateRuntimeKey(
    siteId: string,
    keys: ApiKeySummary[],
    rates: ReadonlyMap<string, number | undefined>,
    requestsByKey: Record<string, number>,
  ): void {
    const automaticKeyId = selectDefaultKey(
      keys,
      requestsByKey,
      this.automaticRuntime.get(siteId)?.keyId,
    );
    const automatic = keys.find((key) => key.id === automaticKeyId);
    const automaticState = {
      keyId: automatic?.id,
      defaultKeyLabel: automatic?.maskedLabel,
      rate: automatic?.groupId ? rates.get(automatic.groupId) : automatic?.rate,
    };
    this.automaticRuntime.set(siteId, automaticState);
    const preference = this.db.getKeyPreference(siteId);
    const manual =
      preference.mode === 'manual'
        ? keys.find((key) => key.id === preference.keyId && key.status === 'active')
        : undefined;
    if (preference.mode === 'manual' && !manual) this.resetInvalidKeyPreference(siteId);
    const selected = manual
      ? {
          keyId: manual.id,
          defaultKeyLabel: manual.maskedLabel,
          rate: manual.groupId ? rates.get(manual.groupId) : manual.rate,
        }
      : automaticState;
    this.runtime.set(siteId, selected);
  }

  private toSummary(site: StoredSite): SiteSummary {
    const snapshot = this.snapshots.get(site.id);
    const errors = this.errors.get(site.id) ?? [];
    const partial = Object.values(site.capabilities ?? {}).includes('error');
    const staleAfterMs = this.db.getAppSettings().staleAfterMinutes * 60_000;
    let credential: ReturnType<CredentialVault['read']>;
    try {
      credential = this.vault.read(site.id);
    } catch {
      credential = undefined;
    }
    const interactiveVerificationProvider = credential
      ? (credential.authenticationProvider ??
        (credential.authenticationMode === 'geetest' ? 'geetest' : undefined))
      : undefined;
    return {
      id: site.id,
      name: site.name,
      baseUrl: site.baseUrl,
      accountLabel: this.db.getCredentialReference(site.id)?.accountLabel,
      interactiveVerificationProvider: isInteractiveAuthenticationMode(
        credential?.authenticationMode,
      )
        ? interactiveVerificationProvider
        : undefined,
      balance: snapshot?.balance,
      todayTokens: snapshot?.todayTokens,
      todayActualCost: snapshot?.todayActualCost,
      todayRequests: snapshot?.todayRequests,
      todayInputTokens: snapshot?.todayInputTokens,
      todayOutputTokens: snapshot?.todayOutputTokens,
      todayCacheReadTokens: snapshot?.todayCacheReadTokens,
      todayCacheCreationTokens: snapshot?.todayCacheCreationTokens,
      todayTotalCost: snapshot?.todayTotalCost,
      averageDurationMs: snapshot?.averageDurationMs,
      status: errors.length
        ? errors.includes('auth-required')
          ? 'auth-required'
          : 'error'
        : snapshot
          ? Date.now() - snapshot.fetchedAt > staleAfterMs
            ? 'stale'
            : partial
              ? 'partial'
              : 'success'
          : 'empty',
      source: snapshot
        ? errors.length || Date.now() - snapshot.fetchedAt > staleAfterMs
          ? 'cache'
          : 'live'
        : 'none',
      fetchedAt: snapshot?.fetchedAt,
      errors,
      capabilities: site.capabilities,
      estimatedDurationMs: estimateDurationRange(this.durations.get(site.id) ?? []),
      ...(() => {
        const runtime = this.runtime.get(site.id);
        return runtime
          ? {
              defaultKeyId: runtime.keyId,
              defaultKeyLabel: runtime.defaultKeyLabel,
              rate: runtime.rate,
            }
          : {};
      })(),
      note: this.db.getSiteNote(site.id),
    };
  }
}

function withRates(keys: ApiKeySummary[], rates: Map<string, number | undefined>): ApiKeySummary[] {
  return keys.map((key) => ({
    ...key,
    rate: key.groupId ? rates.get(key.groupId) : undefined,
  }));
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  task: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor++;
      const value = values[index];
      if (value !== undefined) results[index] = await task(value);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

export function usageDateRange(
  period: UsageQuery['period'],
  startDate?: string,
  endDate?: string,
  now = new Date(),
): { startDate?: string; endDate?: string } {
  if (period === 'custom') return { startDate, endDate };
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - (period === '30d' ? 29 : period === '7d' ? 6 : 0));
  return { startDate: formatLocalDate(start), endDate: formatLocalDate(end) };
}

function usageUpstreamQuery(query: UsageQuery): Record<string, string | number | undefined> {
  const range = usageDateRange(query.period, query.startDate, query.endDate);
  return {
    page: query.page,
    page_size: query.pageSize,
    api_key_id: query.apiKeyId,
    model: query.model,
    group_id: query.groupId,
    start_date: range.startDate,
    end_date: range.endDate,
    request_type: query.requestType,
    billing_type: query.billingType,
    billing_mode: query.billingMode,
    sort_by: query.sort ? 'created_at' : undefined,
    sort_order: query.sort,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function formatLocalDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function maskAccount(value: string): string {
  if (value.includes('@')) return `${value.slice(0, 2)}***${value.slice(value.indexOf('@'))}`;
  return `${value.slice(0, 2)}***`;
}

export function normalizeAccountIdentity(value: string): string {
  const trimmed = value.trim();
  return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
}

export function assertProfileIdentity(expected: string, returned: string | undefined): void {
  if (returned && normalizeAccountIdentity(expected) !== normalizeAccountIdentity(returned))
    throw new Error('SITE_ACCOUNT_IDENTITY_MISMATCH');
}

function isInteractiveAuthenticationMode(
  mode: 'password' | 'geetest' | 'interactive' | undefined,
): boolean {
  return mode === 'geetest' || mode === 'interactive';
}

function safeMessage(error: unknown): string {
  return typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
    ? error.message
    : '请求失败';
}
function isAuthError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'AUTH_REQUIRED'
  );
}

function siteInputErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === 'AUTH_INVALID_CREDENTIALS') return '账号或密码错误';
  if (code === 'NETWORK_TIMEOUT') return '网络超时';
  if (code === 'UNSUPPORTED_CAPABILITY' || code === 'INCOMPATIBLE_RESPONSE') return '接口不兼容';
  if (code === 'AUTH_REQUIRED') return '账号状态异常或需要重新登录';
  if (code === 'SITE_DUPLICATE_ACCOUNT') return '该站点已添加此用户名';
  if (code === 'SITE_ACCOUNT_IDENTITY_UNAVAILABLE') return '无法确认已有站点的用户名，请先检查凭据';
  if (code === 'SITE_ACCOUNT_IDENTITY_MISMATCH') return '登录账号与添加站点用户名不一致';
  if (code === 'INTERACTIVE_VERIFICATION_UNAVAILABLE')
    return '无法确认安全验证方式，请重新添加站点';
  if (code === 'INTERACTIVE_VERIFICATION_REQUIRED' || code === 'GEETEST_REQUIRED')
    return '需要完成安全验证';
  return '站点地址无效、网络不可用或服务异常';
}

function createSnapshot(
  siteId: string,
  balance: number,
  usage: {
    totalRequests: number;
    totalTokens: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheReadTokens: number;
    totalCacheCreationTokens: number;
    totalActualCost: number;
    totalCost: number;
    averageDurationMs: number;
  },
): SiteSnapshot {
  return {
    siteId,
    balance,
    todayTokens: usage.totalTokens,
    todayActualCost: usage.totalActualCost,
    todayRequests: usage.totalRequests,
    todayInputTokens: usage.totalInputTokens,
    todayOutputTokens: usage.totalOutputTokens,
    todayCacheReadTokens: usage.totalCacheReadTokens,
    todayCacheCreationTokens: usage.totalCacheCreationTokens,
    todayTotalCost: usage.totalCost,
    averageDurationMs: usage.averageDurationMs,
    fetchedAt: Date.now(),
  };
}
