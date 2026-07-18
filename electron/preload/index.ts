import type {
  AppSettings,
  FloatingSettings,
  BatchSiteInput,
  DashboardSnapshot,
  SiteInput,
  SiteSummary,
  UsageQuery,
} from '../shared/contracts.js';

export interface DesktopBridge {
  readonly platform: NodeJS.Platform;
  readonly shellVersion: string;
  readonly sites: {
    list(): Promise<DashboardSnapshot>;
    select(siteId: string): Promise<DashboardSnapshot>;
    delete(siteId: string): Promise<DashboardSnapshot>;
    addAndVerify(input: SiteInput): Promise<SiteSummary>;
    addBatch(
      input: BatchSiteInput,
    ): Promise<{ successes: SiteSummary[]; failures: Array<{ url: string; error: string }> }>;
    refresh(siteId: string): Promise<SiteSummary>;
    usage(query: UsageQuery): Promise<unknown>;
    usageFilters(siteId: string): Promise<unknown>;
    usageCsv(query: UsageQuery): Promise<{ canceled: boolean; filePath?: string }>;
    channels(siteId: string): Promise<unknown>;
    channelStatus(siteId: string, channelId: string): Promise<unknown>;
    keys(siteId: string): Promise<unknown>;
    keyPreference(siteId: string): Promise<unknown>;
    setKeyPreference(
      siteId: string,
      value: { mode: 'auto' | 'manual'; keyId?: string },
    ): Promise<unknown>;
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
    notificationPermission(): Promise<{ supported: boolean }>;
    onChanged(listener: () => void): () => void;
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
