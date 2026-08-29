import type {
  AppSettings,
  FloatingSettings,
  BatchSiteInput,
  DashboardSnapshot,
  SiteInput,
  InteractiveVerificationProvider,
  SiteSummary,
  ChannelViewPayload,
  SiteAddResult,
  SiteKeyContexts,
  UsageQuery,
  UsageStats,
  RateContexts,
  RateSiteContext,
  ApiKeyListQuery,
  ApiKeyGroupUpdateRequest,
  ApiKeyManagementPayload,
  ManagedApiKey,
  ChannelAssociation,
} from '../shared/contracts.js';
import type { UpdateCheckResult, UpdateManifest } from '../main/services/update-service.js';
import type { RadarEmbedState, RadarEntry, RadarEntryInput } from '../shared/radar.js';
import type {
  Sub2ApiServer,
  Sub2ApiServerEmbedState,
  Sub2ApiServerInput,
  Sub2ApiServerUpdateInput,
} from '../shared/sub2api-server.js';
import type {
  FavoriteWebsite,
  FavoriteWebsiteEmbedState,
  FavoriteWebsiteInput,
  FavoriteWebsiteUpdate,
  FavoriteWebsitesPolicy,
} from '../shared/favorite-websites.js';
import type { OpenCodexLogsPayload, OpenCodexLogsQuery } from '../shared/opencodex.js';

export interface DesktopBridge {
  readonly platform: NodeJS.Platform;
  readonly shellVersion: string;
  readonly radar: {
    list(): Promise<RadarEntry[]>;
    create(input: RadarEntryInput): Promise<RadarEntry[]>;
    delete(id: string): Promise<RadarEntry[]>;
    open(id: string): void;
    close(): void;
    onStateChange(listener: (state: RadarEmbedState) => void): () => void;
  };
  readonly sub2apiServers: {
    list(): Promise<Sub2ApiServer[]>;
    create(input: Sub2ApiServerInput): Promise<Sub2ApiServer[]>;
    update(input: Sub2ApiServerUpdateInput): Promise<Sub2ApiServer[]>;
    delete(id: string): Promise<Sub2ApiServer[]>;
    open(id: string): void;
    openShortcut(serverId: string, shortcutId: string): void;
    close(): void;
    back(): void;
    forward(): void;
    reload(): void;
    home(): void;
    clearSession(id: string): Promise<void>;
    onStateChange(listener: (state: Sub2ApiServerEmbedState) => void): () => void;
  };
  readonly favoriteWebsites: {
    list(): Promise<FavoriteWebsite[]>;
    create(input: FavoriteWebsiteInput): Promise<FavoriteWebsite[]>;
    update(input: FavoriteWebsiteUpdate): Promise<FavoriteWebsite[]>;
    delete(id: string): Promise<FavoriteWebsite[]>;
    policy(): Promise<FavoriteWebsitesPolicy>;
    savePolicy(policy: FavoriteWebsitesPolicy): Promise<FavoriteWebsitesPolicy>;
    open(id: string): void;
    close(): void;
    back(): void;
    forward(): void;
    reload(): void;
    home(): void;
    onStateChange(listener: (state: FavoriteWebsiteEmbedState) => void): () => void;
  };
  readonly sites: {
    list(): Promise<DashboardSnapshot>;
    select(siteId: string): Promise<DashboardSnapshot>;
    reorder(siteIds: string[]): Promise<DashboardSnapshot>;
    delete(siteId: string): Promise<DashboardSnapshot>;
    addAndVerify(input: SiteInput): Promise<SiteAddResult>;
    addWithInteractiveVerification(
      input: SiteInput,
      provider: InteractiveVerificationProvider,
    ): Promise<SiteAddResult>;
    reverify(siteId: string): Promise<SiteSummary>;
    addBatch(
      input: BatchSiteInput,
    ): Promise<{ successes: SiteSummary[]; failures: Array<{ url: string; error: string }> }>;
    refresh(siteId: string): Promise<SiteSummary>;
    refreshAll(): Promise<DashboardSnapshot>;
    rateContexts(): Promise<RateContexts>;
    refreshRateGroups(siteId: string): Promise<RateSiteContext>;
    refreshAllRateGroups(): Promise<RateContexts>;
    setRechargeRatio(siteId: string, ratio: number): Promise<RateContexts>;
    usage(query: UsageQuery): Promise<unknown>;
    usageStats(query: UsageQuery): Promise<UsageStats>;
    usageGroups(siteId: string): Promise<unknown>;
    usageModels(siteId: string): Promise<unknown>;
    usageCsv(query: UsageQuery): Promise<{ canceled: boolean; filePath?: string }>;
    opencodexLogs(query?: OpenCodexLogsQuery): Promise<OpenCodexLogsPayload>;
    channels(siteId: string): Promise<unknown>;
    refreshChannels(siteId: string): Promise<ChannelViewPayload>;
    channelStatus(siteId: string, channelId: string): Promise<unknown>;
    onChannelChanged(
      listener: (value: { siteId: string; data: ChannelViewPayload }) => void,
    ): () => void;
    onRateChanged(listener: (value: RateContexts) => void): () => void;
    channelAssociations(siteId: string): Promise<ChannelAssociation[]>;
    setChannelAssociation(input: {
      siteId: string;
      groupId: string;
      channelIds: string[];
    }): Promise<ChannelAssociation[]>;
    clearChannelAssociation(input: {
      siteId: string;
      groupId: string;
    }): Promise<ChannelAssociation[]>;
    keys(siteId: string): Promise<unknown>;
    apiKeys(query: ApiKeyListQuery): Promise<ApiKeyManagementPayload>;
    updateApiKeyGroup(input: ApiKeyGroupUpdateRequest): Promise<ManagedApiKey>;
    copyApiKey(input: { siteId: string; keyId: string }): Promise<{ copied: boolean }>;
    keyContexts(): Promise<SiteKeyContexts>;
    keyPreference(siteId: string): Promise<unknown>;
    setKeyPreference(
      siteId: string,
      value: { mode: 'auto' | 'manual'; keyId?: string },
    ): Promise<unknown>;
    setNote(siteId: string, note: string): Promise<SiteSummary>;
    notificationSettings(): Promise<unknown>;
    setNotificationSettings(value: unknown): Promise<unknown>;
    openMainWindow(): void;
    minimizeMainWindow(): void;
    closeMainWindow(): void;
    hideMainWindow(): void;
    startupSetting(): Promise<{ enabled: boolean }>;
    setStartupSetting(enabled: boolean): Promise<{ enabled: boolean }>;
    floatingSettings(): Promise<FloatingSettings>;
    setFloatingSettings(value: FloatingSettings): Promise<FloatingSettings>;
    appSettings(): Promise<AppSettings>;
    setAppSettings(value: AppSettings): Promise<AppSettings>;
    updateCheck(): Promise<UpdateCheckResult>;
    updateDownload(
      manifest: UpdateManifest,
    ): Promise<{ filePath: string; platform: NodeJS.Platform }>;
    updateInstall(filePath: string): Promise<{ mode: 'restarted' | 'manual' }>;
    updateSkip(version: string): Promise<void>;
    updateRemindLater(version: string): Promise<void>;
    onUpdateProgress(listener: (value: { received: number; total?: number }) => void): () => void;
    notificationPermission(): Promise<{ supported: boolean }>;
    onChanged(listener: () => void): () => void;
    onKeyContextChanged(listener: (siteId: string) => void): () => void;
    onRefreshState(
      listener: (value: {
        siteId: string;
        state: 'refreshing' | 'success' | 'error' | 'auth-required';
        phase?: string;
      }) => void,
    ): () => void;
    onBatchProgress(
      listener: (value: {
        current: number;
        total: number;
        url: string;
        status: 'success' | 'failed';
        error?: string;
      }) => void,
    ): () => void;
  };
}
