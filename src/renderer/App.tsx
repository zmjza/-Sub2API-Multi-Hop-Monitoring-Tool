import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  ChevronDown,
  Download,
  Globe,
  History,
  House,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  Network,
  Radio,
  RefreshCw,
  Server,
  Settings,
  SlidersHorizontal,
  TimerReset,
  Tag,
  X,
} from 'lucide-react';
import { PreviewControls } from './preview/PreviewControls';
import {
  parsePreviewLocation,
  type MainShell,
  type PreviewContext,
  type PreviewState,
} from './preview/types';
import { OverviewPage } from './shells/overview/OverviewPage';
import { CurrentKeyStatsLoader } from './shells/overview/current-key-stats-loader';
import {
  availableCreditForKey,
  resolveEffectiveKey,
  type CurrentKeyStatsState,
} from './shells/overview/current-key-stats';
import { desktopRateChannelStatusLoader } from './shells/overview/rate-channel-status-loader';
import { UsagePage } from './shells/usage/UsagePage';
import { ApiKeysPage } from './shells/api-keys/ApiKeysPage';
import type { ApiKeyRow, ApiKeysPageState, ApiKeyStatus } from './shells/api-keys/types';
import { siteDisplayName } from './site-label';
import { normalizeVersionLabel } from './version-label';
import { UsageLoadCoordinator } from './shells/usage/usage-load-coordinator';
import { ChannelsPage } from './shells/channels/ChannelsPage';
import { currentKeyGroup, resolveFinalChannelAssociation } from './shells/channels/channel-ranking';
import { ChannelLoadCoordinator } from './channel-load-coordinator';
import { randomPollingDelayMs, retryAfterSecondsFromError } from './channel-polling';
import { SitesPage } from './shells/sites/SitesPage';
import { GeneralSettingsPage, NotificationRulesPage } from './shells/settings/SettingsPages';
import { FloatingWindow } from './shells/floating/FloatingWindow';
import {
  selectLatestUsageSite,
  stateForSelectedUsageSite,
} from './shells/floating/latest-usage-site';
import { RadarPage } from './shells/radar/RadarPage';
import { Sub2ApiServersPage } from './shells/sub2api-servers/Sub2ApiServersPage';
import { FavoriteWebsitesPage } from './shells/favorite-websites/FavoriteWebsitesPage';
import sub2ApiLogo from './assets/sub2api-logo.png';
import './styles.css';
import { canSwitchSub2ApiServer } from './app-navigation';
import type {
  SiteKeyContext,
  SiteKeyContexts,
  ChannelAssociation,
  UsageFilterOptions,
  FloatingSettings,
  RateContexts,
  ApiKeyManagementPayload,
} from '../../electron/shared/contracts';
import { type RadarEntry, type RadarEmbedState } from '../../electron/shared/radar';
import {
  type Sub2ApiServer,
  type Sub2ApiServerEmbedState,
} from '../../electron/shared/sub2api-server';
import {
  type FavoriteWebsite,
  type FavoriteWebsiteEmbedState,
} from '../../electron/shared/favorite-websites';
import { safeRendererError, useNotifications } from './notifications';
import type {
  UpdateCheckResult,
  UpdateManifest,
} from '../../electron/main/services/update-service';
const initialLocation = parsePreviewLocation(window.location.search);
const showPreviewControls =
  import.meta.env.DEV || new URLSearchParams(window.location.search).get('preview') === 'true';
const hasExplicitShell = new URLSearchParams(window.location.search).has('shell');
export function App() {
  const { dismiss, notify } = useNotifications();
  const [shell, setShell] = useState<MainShell>(initialLocation.shell);
  const [usageMode, setUsageMode] = useState<'sub2api' | 'opencodex'>('sub2api');
  const [state, setState] = useState<PreviewState>(initialLocation.state);
  const [queryPhase, setQueryPhase] = useState<string>();
  const [reducedTransparency, setReducedTransparency] = useState(
    initialLocation.reducedTransparency,
  );
  const [highContrast, setHighContrast] = useState(initialLocation.highContrast);
  const [dashboard, setDashboard] =
    useState<import('../../electron/shared/contracts').DashboardSnapshot>();
  const [usageData, setUsageData] = useState<unknown>();
  const [usageStats, setUsageStats] = useState<unknown>();
  const [latestUsageRecord, setLatestUsageRecord] = useState<{
    createdAt?: unknown;
    outputTokens?: unknown;
    durationMs?: unknown;
  }>();
  const [apiKeysData, setApiKeysData] = useState<ApiKeyManagementPayload>();
  const [apiKeysState, setApiKeysState] = useState<ApiKeysPageState>('loading');
  const [apiKeyFilters, setApiKeyFilters] = useState<{
    search: string;
    groupId: string;
    status: '' | ApiKeyStatus;
    page: number;
  }>({ search: '', groupId: '', status: '', page: 1 });
  const [writingKeyIds, setWritingKeyIds] = useState<Set<string>>(() => new Set());
  const [apiKeyMessage, setApiKeyMessage] = useState('');
  const [channelsData, setChannelsData] = useState<unknown>();
  const [channelAssociations, setChannelAssociations] = useState<ChannelAssociation[]>([]);
  const [channelAssociationsBySite, setChannelAssociationsBySite] = useState<
    Record<string, ChannelAssociation[]>
  >({});
  const [channelDetail, setChannelDetail] = useState<unknown>();
  const [selectedChannelId, setSelectedChannelId] = useState<string>();
  const [keyContexts, setKeyContexts] = useState<SiteKeyContexts>({});
  const [currentKeyStatsBySite, setCurrentKeyStatsBySite] = useState<
    Record<string, CurrentKeyStatsState>
  >({});
  const [isRefreshingCurrentKeyStats, setIsRefreshingCurrentKeyStats] = useState(false);
  const [usageFiltersBySite, setUsageFiltersBySite] = useState<Record<string, UsageFilterOptions>>(
    {},
  );
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [refreshingSiteIds, setRefreshingSiteIds] = useState<Set<string>>(() => new Set());
  const [rateContexts, setRateContexts] = useState<RateContexts>({ sites: {}, ratios: {} });
  const [isRefreshingRates, setIsRefreshingRates] = useState(false);
  const [refreshingRateSiteIds, setRefreshingRateSiteIds] = useState<Set<string>>(() => new Set());
  const [radarEmbedState, setRadarEmbedState] = useState<RadarEmbedState>({ status: 'idle' });
  const [radarEntries, setRadarEntries] = useState<RadarEntry[]>([]);
  const [sub2apiServerEmbedState, setSub2ApiServerEmbedState] = useState<Sub2ApiServerEmbedState>({
    status: 'idle',
  });
  const [sub2apiServers, setSub2apiServers] = useState<Sub2ApiServer[]>([]);
  const [channelStatusBySite, setChannelStatusBySite] = useState<
    Record<string, import('../../electron/shared/contracts').ChannelViewPayload>
  >({});
  const [favoriteWebsiteEmbedState, setFavoriteWebsiteEmbedState] =
    useState<FavoriteWebsiteEmbedState>({ status: 'idle' });
  const [favoriteWebsites, setFavoriteWebsites] = useState<FavoriteWebsite[]>([]);
  const [floatingSettings, setFloatingSettings] = useState<FloatingSettings>({
    position: 'top-right',
    opacity: 84,
  });
  const floatingPosition = floatingSettings.position;
  const floatingOpacity = floatingSettings.opacity;
  const [currentSiteId, setCurrentSiteId] = useState<string>();
  const [updateState, setUpdateState] = useState<UpdateCheckResult | undefined>();
  const [updateDownloading, setUpdateDownloading] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const updateCheckingRef = useRef(false);
  const updateTriggerRef = useRef<HTMLButtonElement>(null);
  const updateCloseRef = useRef<HTMLButtonElement>(null);
  const currentSiteRef = useRef<string | undefined>(undefined);
  const refreshingSiteIdsRef = useRef<Set<string>>(new Set());
  const shellRef = useRef(shell);
  const channelLoadCoordinatorRef = useRef(new ChannelLoadCoordinator());
  const channelStatusLoaderRef = useRef(desktopRateChannelStatusLoader());
  const keyContextRequestRef = useRef(new Map<string, number>());
  const currentKeyStatsRequestRef = useRef(0);
  const currentKeyStatsLoaderRef = useRef<CurrentKeyStatsLoader | null>(null);
  const siteRequestRef = useRef(0);
  const usageLoadCoordinatorRef = useRef(new UsageLoadCoordinator());
  const apiKeysRequestRef = useRef(0);
  const channelDetailRequestRef = useRef(0);
  const floatingUsageScanRef = useRef({ running: false, latestAt: 0, siteId: '' });
  const floatingRefreshRef = useRef({ running: false, lastRunAt: 0 });
  const selectedSite = dashboard?.sites.find(
    (site) => site.id === (currentSiteId ?? dashboard.currentSiteId),
  );
  const versionLabel = normalizeVersionLabel(window.sub2apiDesktop?.shellVersion);
  const showUpdateNotice = (message: string, tone: 'info' | 'success' | 'error' = 'info') => {
    notify({
      id: 'app-update',
      kind: tone === 'info' && message.startsWith('正在') ? 'loading' : tone,
      message,
    });
  };
  const checkForUpdate = async () => {
    if (updateCheckingRef.current) return;
    updateCheckingRef.current = true;
    setUpdateChecking(true);
    showUpdateNotice('正在检查更新…');
    try {
      const result = await window.sub2apiDesktop?.sites.updateCheck();
      if (!result) throw new Error('更新服务不可用');
      setUpdateState(result);
      if (result.status === 'available') {
        setShell('overview');
        setUpdateModalOpen(true);
        showUpdateNotice(`发现新版本 ${result.manifest.version}`, 'success');
      } else if (result.status === 'up-to-date') showUpdateNotice('当前已是最新版本', 'success');
      else if (result.status === 'skipped') showUpdateNotice('该版本已按设置跳过', 'info');
      else showUpdateNotice(`检查更新失败：${result.message}`, 'error');
    } catch (error) {
      const message = error instanceof Error ? error.message : '检查更新失败';
      setUpdateState({ status: 'error', code: 'CHECK_FAILED', message });
      showUpdateNotice(`检查更新失败：${message}`, 'error');
    } finally {
      updateCheckingRef.current = false;
      setUpdateChecking(false);
    }
  };
  const closeUpdateModal = () => {
    if (updateDownloading) return;
    setUpdateModalOpen(false);
    window.setTimeout(() => updateTriggerRef.current?.focus(), 0);
  };
  const downloadUpdate = async (manifest: UpdateManifest) => {
    setUpdateDownloading(true);
    setUpdateProgress(0);
    try {
      const result = await window.sub2apiDesktop?.sites.updateDownload(manifest);
      if (result) {
        const install = await window.sub2apiDesktop?.sites.updateInstall(result.filePath);
        if (install?.mode === 'manual')
          setUpdateState({
            status: 'error',
            code: 'MACOS_MANUAL',
            message: 'DMG 已打开，请将新 App 替换旧 App 后重新启动。',
          });
        if (install?.mode === 'manual') {
          setUpdateModalOpen(false);
          showUpdateNotice('DMG 已打开，请替换旧 App 后重新启动。');
        }
      }
    } catch (error) {
      setUpdateState({
        status: 'error',
        code: 'DOWNLOAD_FAILED',
        message: error instanceof Error ? error.message : '下载失败',
      });
      setUpdateModalOpen(false);
      showUpdateNotice('更新下载失败，请稍后重试。', 'error');
    } finally {
      setUpdateDownloading(false);
    }
  };
  useEffect(() => {
    const desktop = window.sub2apiDesktop?.sites;
    if (!desktop) return;
    const unsubscribe = desktop.onUpdateProgress((value) =>
      setUpdateProgress(value.total ? Math.round((value.received / value.total) * 100) : 0),
    );
    const timer = window.setTimeout(checkForUpdate, 1200);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!updateModalOpen) return;
    updateCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeUpdateModal();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [updateModalOpen, updateDownloading]);
  const closeEmbeddedRadar = () => {
    const radar = window.sub2apiDesktop?.radar;
    if (radar) radar.close();
    setRadarEmbedState({ status: 'idle' });
  };
  const openEmbeddedRadar = (entry: RadarEntry) => {
    if (sub2apiServerEmbedState.status !== 'idle' || favoriteWebsiteEmbedState.status !== 'idle')
      return;
    const radar = window.sub2apiDesktop?.radar;
    if (!radar) {
      setRadarEmbedState({
        status: 'error',
        target: { id: entry.id, label: entry.label },
        message: '当前 Electron 桥不可用，无法打开雷达网页。',
      });
      return;
    }
    setRadarEmbedState({ status: 'opening', target: { id: entry.id, label: entry.label } });
    radar.open(entry.id);
  };
  const closeEmbeddedSub2ApiServer = () => {
    const servers = window.sub2apiDesktop?.sub2apiServers;
    if (servers) servers.close();
    setSub2ApiServerEmbedState({ status: 'idle' });
  };
  const openEmbeddedSub2ApiServer = (server: Sub2ApiServer) => {
    const switching = sub2apiServerEmbedState.status !== 'idle';
    if (
      (switching && !canSwitchSub2ApiServer(sub2apiServerEmbedState, server.id)) ||
      (!switching &&
        (radarEmbedState.status !== 'idle' || favoriteWebsiteEmbedState.status !== 'idle'))
    )
      return;
    const servers = window.sub2apiDesktop?.sub2apiServers;
    if (!servers) {
      setSub2ApiServerEmbedState({
        status: 'error',
        target: { id: server.id, label: server.name },
        message: '当前 Electron 桥不可用，无法打开服务器网页。',
      });
      return;
    }
    if (!switching) setShell('sub2api-servers');
    setSub2ApiServerEmbedState({
      status: 'opening',
      target: { id: server.id, label: server.name },
    });
    servers.open(server.id);
  };
  const closeEmbeddedFavoriteWebsite = () => {
    const favorites = window.sub2apiDesktop?.favoriteWebsites;
    if (favorites) favorites.close();
    setFavoriteWebsiteEmbedState({ status: 'idle' });
  };
  const openEmbeddedFavoriteWebsite = (website: FavoriteWebsite) => {
    if (sub2apiServerEmbedState.status !== 'idle' || radarEmbedState.status !== 'idle') return;
    const favorites = window.sub2apiDesktop?.favoriteWebsites;
    if (!favorites) {
      setFavoriteWebsiteEmbedState({
        status: 'error',
        target: { id: website.id, label: website.name },
        message: '当前 Electron 桥不可用，无法打开常用网站网页。',
      });
      return;
    }
    setFavoriteWebsiteEmbedState({
      status: 'opening',
      target: { id: website.id, label: website.name },
    });
    favorites.open(website.id);
  };
  const openSub2ApiServerShortcut = (
    server: Sub2ApiServer,
    shortcut: import('../../electron/shared/sub2api-server').Sub2ApiShortcut,
  ) => {
    if (
      sub2apiServerEmbedState.status !== 'idle' ||
      radarEmbedState.status !== 'idle' ||
      favoriteWebsiteEmbedState.status !== 'idle'
    )
      return;
    const servers = window.sub2apiDesktop?.sub2apiServers;
    if (!servers) return;
    setSub2ApiServerEmbedState({
      status: 'opening',
      target: { id: server.id, label: server.name },
    });
    servers.openShortcut(server.id, shortcut.id);
  };
  const changeShell = (nextShell: MainShell) => {
    if (radarEmbedState.status !== 'idle' && nextShell !== 'radar') closeEmbeddedRadar();
    if (sub2apiServerEmbedState.status !== 'idle' && nextShell !== 'sub2api-servers')
      closeEmbeddedSub2ApiServer();
    if (favoriteWebsiteEmbedState.status !== 'idle' && nextShell !== 'favorite-websites')
      closeEmbeddedFavoriteWebsite();
    setShell(nextShell);
  };
  useEffect(() => {
    const unsubscribe = window.sub2apiDesktop?.radar.onStateChange((nextState) => {
      setRadarEmbedState(nextState);
    });
    void window.sub2apiDesktop?.radar
      .list()
      .then(setRadarEntries)
      .catch(() => undefined);
    return () => unsubscribe?.();
  }, []);
  useEffect(() => {
    const unsubscribe = window.sub2apiDesktop?.sub2apiServers.onStateChange((nextState) => {
      setSub2ApiServerEmbedState(nextState);
    });
    void window.sub2apiDesktop?.sub2apiServers
      .list()
      .then(setSub2apiServers)
      .catch(() => undefined);
    return () => unsubscribe?.();
  }, []);
  useEffect(() => {
    void window.sub2apiDesktop?.favoriteWebsites
      .list()
      .then(setFavoriteWebsites)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const unsubscribe = window.sub2apiDesktop?.favoriteWebsites.onStateChange((nextState) => {
      setFavoriteWebsiteEmbedState(nextState);
    });
    return () => unsubscribe?.();
  }, []);
  useEffect(() => {
    if (radarEmbedState.status === 'idle') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeEmbeddedRadar();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [radarEmbedState.status]);
  useEffect(() => {
    if (sub2apiServerEmbedState.status === 'idle') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeEmbeddedSub2ApiServer();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sub2apiServerEmbedState.status]);
  useEffect(() => {
    if (favoriteWebsiteEmbedState.status === 'idle') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeEmbeddedFavoriteWebsite();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [favoriteWebsiteEmbedState.status]);
  const siteIdsKey = dashboard?.sites
    .map((site) => site.id)
    .sort((left, right) => left.localeCompare(right))
    .join('|');
  const selectedKeyContext = selectedSite ? keyContexts[selectedSite.id] : undefined;
  const keyOptions = selectedKeyContext?.keys ?? [];
  const keyPreference = selectedKeyContext?.preference ?? { mode: 'auto' as const };
  const usageFilterOptions = selectedSite
    ? (usageFiltersBySite[selectedSite.id] ?? groupsFromKeys(keyOptions))
    : { models: [], groups: [] };
  const currentKeySelectionKey = JSON.stringify(
    (dashboard?.sites ?? []).map((site) => {
      const keyContext = keyContexts[site.id] ?? {
        keys: [],
        preference: { mode: 'auto' as const },
      };
      const key = resolveEffectiveKey(keyContext.keys, keyContext.preference, site.defaultKeyId);
      return [
        site.id,
        site.balance,
        site.defaultKeyId,
        keyContext.preference.mode,
        keyContext.preference.keyId,
        key?.id,
        key?.quota,
        key?.quotaUsed,
        key?.subscriptionType,
      ];
    }),
  );
  shellRef.current = shell;
  currentSiteRef.current = selectedSite?.id;
  const runtimeState = selectedSite?.status;
  const effectiveState: PreviewState = showPreviewControls
    ? state
    : state !== 'success' || !window.sub2apiDesktop
      ? state
      : dashboard?.sites.length === 0
        ? 'empty'
        : (
              ['success', 'stale', 'error', 'auth-required', 'partial', 'unsupported'] as string[]
            ).includes(runtimeState ?? '')
          ? (runtimeState as PreviewState)
          : 'success';
  const context: PreviewContext = {
    state: effectiveState,
    theme: 'light',
    reducedTransparency,
    highContrast,
    queryPhase,
    isRefreshingAll,
    refreshingSiteIds: [...refreshingSiteIds],
  };
  context.dashboard = dashboard;
  context.selectedSite = selectedSite;
  context.usageData = usageData;
  context.usageStats = usageStats;
  context.usageMode = usageMode;
  context.onToggleUsageMode = () =>
    setUsageMode((current) => (current === 'sub2api' ? 'opencodex' : 'sub2api'));
  context.latestUsageRecord = latestUsageRecord;
  context.channelsData = channelsData;
  context.channelStatusBySite = channelStatusBySite;
  context.channelAssociations = channelAssociations;
  context.channelAssociationsBySite = channelAssociationsBySite;
  context.channelDetail = channelDetail;
  context.selectedChannelId = selectedChannelId;
  context.keyOptions = keyOptions;
  context.keyContexts = keyContexts;
  context.currentKeyStatsBySite = currentKeyStatsBySite;
  context.isRefreshingCurrentKeyStats = isRefreshingCurrentKeyStats;
  context.rateContexts = rateContexts;
  context.isRefreshingRates = isRefreshingRates;
  context.refreshingRateSiteIds = [...refreshingRateSiteIds];
  context.usageFilterOptions = usageFilterOptions;
  context.keyPreference = keyPreference;
  async function loadKeyContext(siteId: string) {
    const desktop = window.sub2apiDesktop?.sites;
    if (!desktop) return;
    const requestId = (keyContextRequestRef.current.get(siteId) ?? 0) + 1;
    keyContextRequestRef.current.set(siteId, requestId);
    const isCurrentRequest = () => keyContextRequestRef.current.get(siteId) === requestId;
    void desktop
      .keys(siteId)
      .then((keys) => {
        if (!isCurrentRequest() || !Array.isArray(keys)) return;
        setKeyContexts((current) => ({
          ...current,
          [siteId]: {
            keys: keys as SiteKeyContext['keys'],
            preference: current[siteId]?.preference ?? { mode: 'auto' },
          },
        }));
        setUsageFiltersBySite((current) => ({
          ...current,
          [siteId]: mergeUsageFilters(
            current[siteId],
            groupsFromKeys(keys as SiteKeyContext['keys']),
          ),
        }));
      })
      .catch(() => undefined);
    void desktop
      .keyPreference(siteId)
      .then((preference) => {
        if (!isCurrentRequest() || !isKeyPreference(preference)) return;
        setKeyContexts((current) => ({
          ...current,
          [siteId]: { keys: current[siteId]?.keys ?? [], preference },
        }));
      })
      .catch(() => undefined);
    if (shellRef.current !== 'usage') return;
    void desktop
      .usageGroups(siteId)
      .then((groups) => {
        if (!isCurrentRequest() || !isUsageGroups(groups)) return;
        setUsageFiltersBySite((current) => ({
          ...current,
          [siteId]: mergeUsageFilters(current[siteId], { models: [], groups }),
        }));
      })
      .catch(() => undefined);
    void desktop
      .usageModels(siteId)
      .then((models) => {
        if (!isCurrentRequest() || !isUsageModels(models)) return;
        setUsageFiltersBySite((current) => ({
          ...current,
          [siteId]: mergeUsageFilters(current[siteId], { models, groups: [] }),
        }));
      })
      .catch(() => undefined);
  }
  const selectSite = (siteId: string) => {
    if (siteId === selectedSite?.id) return;
    const requestId = ++siteRequestRef.current;
    currentSiteRef.current = siteId;
    setCurrentSiteId(siteId);
    setUsageData(undefined);
    setUsageStats(undefined);
    setApiKeysData(undefined);
    setApiKeysState('loading');
    setApiKeyFilters({ search: '', groupId: '', status: '', page: 1 });
    setWritingKeyIds(new Set());
    setApiKeyMessage('');
    setChannelsData(undefined);
    setChannelDetail(undefined);
    setSelectedChannelId(undefined);
    setState('loading');
    void window.sub2apiDesktop?.sites
      .select(siteId)
      .then((value) => {
        if (siteRequestRef.current !== requestId || currentSiteRef.current !== siteId) return;
        setDashboard(value);
        setState('success');
      })
      .catch(() => {
        if (siteRequestRef.current === requestId && currentSiteRef.current === siteId)
          setState('error');
      });
  };
  const moveSite = (direction: -1 | 1) => {
    if (!dashboard?.sites.length) return;
    const activeId = selectedSite?.id ?? dashboard.currentSiteId;
    const index = Math.max(
      0,
      dashboard.sites.findIndex((site) => site.id === activeId),
    );
    const next =
      dashboard.sites[(index + direction + dashboard.sites.length) % dashboard.sites.length];
    if (next) selectSite(next.id);
  };
  const loadLatestUsageForSite = async (siteId: string) => {
    const payload = await window.sub2apiDesktop?.sites.usage({
      siteId,
      period: '30d',
      page: 1,
      pageSize: 1,
      sort: 'desc',
    });
    if (!payload || currentSiteRef.current !== siteId) return;
    const latest = selectLatestUsageSite([{ siteId, payload }]);
    if (latest) setLatestUsageRecord(latest.record);
  };
  const refreshSelected = async () => {
    if (!selectedSite) return;
    const siteId = selectedSite.id;
    setState('refreshing');
    const desktop = window.sub2apiDesktop?.sites;
    if (!desktop) return;
    const results = await Promise.allSettled([
      desktop.refresh(siteId).then(() => desktop.list()),
      loadKeyContext(siteId),
      loadCurrentKeyStats(true),
      loadLatestUsageForSite(siteId),
      loadChannels(siteId, true),
    ]);
    if (currentSiteRef.current !== siteId) return;
    const dashboardResult = results[0];
    if (dashboardResult.status === 'fulfilled') setDashboard(dashboardResult.value);
    const failed = results.some((result) => result.status === 'rejected');
    setState(failed ? 'error' : 'success');
    if (failed)
      notify({
        id: `site-refresh:${siteId}`,
        kind: 'error',
        message: '部分数据刷新失败，已保留最近成功结果',
      });
  };
  const refreshAll = () => {
    if (isRefreshingAll || !dashboard?.sites.length) return;
    void loadCurrentKeyStats(true);
    setIsRefreshingAll(true);
    setRefreshingSiteIds(new Set(dashboard.sites.map((site) => site.id)));
    void window.sub2apiDesktop?.sites
      .refreshAll()
      .then(async (value) => {
        if (value) setDashboard(value);
        const refreshedRates = await window.sub2apiDesktop?.sites.rateContexts();
        if (refreshedRates) setRateContexts(refreshedRates);
      })
      .catch((error) =>
        notify({
          id: 'site-refresh-all',
          kind: 'error',
          message: safeRendererError(error, '全部站点刷新失败，请稍后重试'),
        }),
      )
      .finally(() => {
        setIsRefreshingAll(false);
        setRefreshingSiteIds(new Set());
      });
  };
  context.onSelectSite = selectSite;
  context.onReorderSites = async (siteIds) => {
    const next = await window.sub2apiDesktop?.sites.reorder(siteIds);
    if (next) setDashboard(next);
  };
  context.onRefreshSite = refreshAll;
  context.onRefreshCurrentKeyStats = () => void loadCurrentKeyStats(true);
  context.onPreviousSite = () => moveSite(-1);
  context.onNextSite = () => moveSite(1);
  context.onOpenSite = () => {
    void window.sub2apiDesktop?.sites.openMainWindow();
  };
  context.onKeyPreferenceChange = (siteId, value) => {
    setKeyContexts((current) => ({
      ...current,
      [siteId]: { keys: current[siteId]?.keys ?? [], preference: value },
    }));
    void window.sub2apiDesktop?.sites
      .setKeyPreference(siteId, value)
      .then((result) => {
        if (!result || typeof result !== 'object' || !('preference' in result)) return;
        const preference = result.preference;
        if (!isKeyPreference(preference)) return;
        setKeyContexts((current) => ({
          ...current,
          [siteId]: { keys: current[siteId]?.keys ?? [], preference },
        }));
      })
      .catch(() => undefined);
  };
  context.onSiteNoteChange = async (siteId, note) => {
    try {
      const updated = await window.sub2apiDesktop?.sites.setNote(siteId, note);
      if (!updated) return;
      setDashboard((current) =>
        current
          ? {
              ...current,
              sites: current.sites.map((site) => (site.id === updated.id ? updated : site)),
            }
          : current,
      );
      notify({ id: `site-note:${siteId}`, kind: 'success', message: '站点备注已保存' });
    } catch (error) {
      notify({
        id: `site-note:${siteId}`,
        kind: 'error',
        message: safeRendererError(error, '备注保存失败，请重试'),
      });
      throw error;
    }
  };
  context.onRefreshAllRates = async () => {
    const desktop = window.sub2apiDesktop?.sites;
    if (!desktop || isRefreshingRates) return;
    setIsRefreshingRates(true);
    try {
      setRateContexts(await desktop.refreshAllRateGroups());
    } finally {
      setIsRefreshingRates(false);
    }
  };
  context.onRefreshSiteRates = async (siteId) => {
    const desktop = window.sub2apiDesktop?.sites;
    if (!desktop || refreshingRateSiteIds.has(siteId)) return;
    setRefreshingRateSiteIds((current) => new Set(current).add(siteId));
    try {
      const next = await desktop.refreshRateGroups(siteId);
      setRateContexts((current) => ({
        ...current,
        sites: { ...current.sites, [siteId]: next },
      }));
    } finally {
      setRefreshingRateSiteIds((current) => {
        const next = new Set(current);
        next.delete(siteId);
        return next;
      });
    }
  };
  context.onRechargeRatioChange = async (siteId, ratio) => {
    const previous = rateContexts.ratios[siteId];
    setRateContexts((current) => ({
      ...current,
      ratios: { ...current.ratios, [siteId]: ratio },
    }));
    try {
      const next = await window.sub2apiDesktop?.sites.setRechargeRatio(siteId, ratio);
      if (next) setRateContexts(next);
      notify({ id: `recharge-ratio:${siteId}`, kind: 'success', message: '充值比例已保存' });
    } catch (error) {
      setRateContexts((current) => {
        const ratios = { ...current.ratios };
        if (previous === undefined) delete ratios[siteId];
        else ratios[siteId] = previous;
        return { ...current, ratios };
      });
      notify({
        id: `recharge-ratio:${siteId}`,
        kind: 'error',
        message: safeRendererError(error, '充值比例保存失败'),
      });
      throw error;
    }
  };
  context.onRefreshFloating = refreshSelected;
  context.onSelectChannel = (channelId) => {
    if (!selectedSite) return;
    const siteId = selectedSite.id;
    const requestId = ++channelDetailRequestRef.current;
    setSelectedChannelId(channelId);
    void channelStatusLoaderRef.current
      .loadDetail(siteId, channelId)
      .then((value) => {
        if (currentSiteRef.current === siteId && channelDetailRequestRef.current === requestId)
          setChannelDetail(value);
      })
      .catch(() => {
        if (currentSiteRef.current === siteId && channelDetailRequestRef.current === requestId)
          setChannelDetail({ state: 'error' });
      });
  };
  context.onRefreshChannels = async () => {
    if (!selectedSite) return { ok: false };
    const result = await loadChannels(selectedSite.id, true);
    if (!result.ok)
      notify({
        id: `channel-refresh:${selectedSite.id}`,
        kind: result.terminal ? 'warning' : 'error',
        message: result.terminal ? '渠道状态需要重新验证' : '渠道状态刷新失败，已保留上次数据',
      });
    return result;
  };
  const saveChannelAssociationForSite = async (
    siteId: string,
    groupId: string,
    channelIds: string[],
  ) => {
    if (!window.sub2apiDesktop) return;
    const next = await window.sub2apiDesktop.sites.setChannelAssociation({
      siteId,
      groupId,
      channelIds,
    });
    setChannelAssociations((current) => (selectedSite?.id === siteId ? next : current));
    setChannelAssociationsBySite((current) => ({ ...current, [siteId]: next }));
    await loadChannels(siteId, true);
    notify({ id: `channel-association:${siteId}`, kind: 'success', message: '渠道关联已保存' });
  };
  const clearChannelAssociationForSite = async (siteId: string, groupId: string) => {
    if (!window.sub2apiDesktop) return;
    const next = await window.sub2apiDesktop.sites.clearChannelAssociation({ siteId, groupId });
    setChannelAssociations((current) => (selectedSite?.id === siteId ? next : current));
    setChannelAssociationsBySite((current) => ({ ...current, [siteId]: next }));
    await loadChannels(siteId, true);
    notify({ id: `channel-association:${siteId}`, kind: 'success', message: '渠道关联已清除' });
  };
  context.onChannelAssociationSave = async (groupId, channelIds) => {
    if (!selectedSite || !window.sub2apiDesktop) return;
    await saveChannelAssociationForSite(selectedSite.id, groupId, channelIds);
  };
  context.onChannelAssociationClear = async (groupId) => {
    if (!selectedSite || !window.sub2apiDesktop) return;
    await clearChannelAssociationForSite(selectedSite.id, groupId);
  };
  context.onChannelAssociationSaveForSite = saveChannelAssociationForSite;
  context.onChannelAssociationClearForSite = clearChannelAssociationForSite;
  context.floatingPosition = floatingPosition;
  context.floatingOpacity = floatingOpacity;
  context.onFloatingPositionChange = (position) => {
    const next = { position, opacity: floatingOpacity } as FloatingSettings;
    setFloatingSettings(next);
    void window.sub2apiDesktop?.sites.setFloatingSettings(next).then(setFloatingSettings);
  };
  context.onFloatingOpacityChange = (opacity) => {
    const next = { ...floatingSettings, opacity };
    setFloatingSettings(next);
    void window.sub2apiDesktop?.sites.setFloatingSettings(next).catch(() => undefined);
  };
  context.onUsageQuery = ({ period, page, ...filters }) => {
    if (!selectedSite) return;
    const siteId = selectedSite.id;
    const desktop = window.sub2apiDesktop?.sites;
    if (!desktop) return;
    const query = { siteId, period, page, pageSize: 20, ...filters };
    setUsageData(undefined);
    setUsageStats(undefined);
    setState('loading');
    void usageLoadCoordinatorRef.current.load(
      () => desktop.usage(query),
      () => desktop.usageStats(query),
      (value, stats) => {
        if (currentSiteRef.current !== siteId) return;
        setUsageData(value);
        setUsageStats(stats);
        setState('success');
      },
      () => {
        if (currentSiteRef.current === siteId) setState('error');
      },
    );
  };
  const loadApiKeys = async (
    siteId: string,
    filters = apiKeyFilters,
    force = false,
  ): Promise<void> => {
    const desktop = window.sub2apiDesktop?.sites;
    if (!desktop) return;
    const requestId = ++apiKeysRequestRef.current;
    setApiKeysState(apiKeysData ? 'refreshing' : 'loading');
    try {
      const value = await desktop.apiKeys({
        siteId,
        page: filters.page,
        pageSize: 20,
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.groupId ? { groupId: filters.groupId } : {}),
        ...(filters.status
          ? { status: filters.status === 'exhausted' ? 'quota-exhausted' : filters.status }
          : {}),
        force,
      });
      if (requestId !== apiKeysRequestRef.current || currentSiteRef.current !== siteId) return;
      setApiKeysData(value);
      setApiKeysState(value.items.length ? value.state : 'empty');
    } catch (error) {
      if (requestId !== apiKeysRequestRef.current || currentSiteRef.current !== siteId) return;
      const message = error instanceof Error ? error.message : '';
      setApiKeysState(
        message.includes('AUTH_REQUIRED')
          ? 'auth-required'
          : message.includes('UNSUPPORTED')
            ? 'unsupported'
            : 'error',
      );
      setApiKeyMessage('API 密钥读取失败，请稍后重试');
    }
  };
  useEffect(() => {
    const refresh = () =>
      void window.sub2apiDesktop?.sites
        .list()
        .then((value) => {
          setDashboard(value);
          setCurrentSiteId((current) =>
            initialLocation.surface === 'floating'
              ? (current ?? value.currentSiteId)
              : value.currentSiteId,
          );
          if (value.sites.length === 0 && initialLocation.surface === 'main' && !hasExplicitShell)
            changeShell('sites');
        })
        .catch(() => undefined);
    refresh();
    window.addEventListener('sub2api:refresh', refresh);
    const unsubscribe = window.sub2apiDesktop?.sites.onChanged(refresh);
    const unsubscribeKeyContext = window.sub2apiDesktop?.sites.onKeyContextChanged((siteId) => {
      void loadKeyContext(siteId);
    });
    const unsubscribeChannel = window.sub2apiDesktop?.sites.onChannelChanged((value) => {
      setChannelStatusBySite((current) => ({ ...current, [value.siteId]: value.data }));
      if (value.siteId !== currentSiteRef.current) return;
      channelStatusLoaderRef.current?.seed(value.siteId, { channels: value.data, details: {} });
      setChannelsData(value.data);
      setState(value.data.stale ? 'error' : 'success');
    });
    const unsubscribeRate = window.sub2apiDesktop?.sites.onRateChanged((value) => {
      setRateContexts(value);
    });
    const unsubscribeState = window.sub2apiDesktop?.sites.onRefreshState((value) => {
      setRefreshingSiteIds((current) => {
        const next = new Set(current);
        if (value.state === 'refreshing') next.add(value.siteId);
        else next.delete(value.siteId);
        refreshingSiteIdsRef.current = next;
        return next;
      });
      if (value.siteId === currentSiteRef.current) {
        setState(value.state);
        setQueryPhase(value.phase);
      }
      if (value.state === 'auth-required')
        notify({
          id: `site-auth:${value.siteId}`,
          kind: 'warning',
          message: '登录过期，请去站点管理重新验证',
        });
      else if (value.state === 'success') dismiss(`site-auth:${value.siteId}`);
    });
    return () => {
      window.removeEventListener('sub2api:refresh', refresh);
      unsubscribe?.();
      unsubscribeKeyContext?.();
      unsubscribeChannel?.();
      unsubscribeRate?.();
      unsubscribeState?.();
    };
  }, []);
  useEffect(() => {
    if (initialLocation.surface !== 'floating') return;
    const desktop = window.sub2apiDesktop?.sites;
    const sites = dashboard?.sites ?? [];
    if (!desktop || sites.length === 0) return;
    let active = true;
    const scan = async () => {
      if (!active || document.visibilityState === 'hidden' || floatingUsageScanRef.current.running)
        return;
      floatingUsageScanRef.current.running = true;
      try {
        const settled = await Promise.allSettled(
          sites.map(async (site) => ({
            siteId: site.id,
            payload: await desktop.usage({
              siteId: site.id,
              period: '30d',
              page: 1,
              pageSize: 1,
              sort: 'desc',
            }),
          })),
        );
        if (!active) return;
        const latest = selectLatestUsageSite(
          settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
        );
        if (!latest) return;
        setLatestUsageRecord(latest.record);
        const previous = floatingUsageScanRef.current;
        if (
          latest.usedAt > previous.latestAt ||
          (latest.usedAt === previous.latestAt && latest.siteId !== previous.siteId)
        ) {
          floatingUsageScanRef.current.latestAt = latest.usedAt;
          floatingUsageScanRef.current.siteId = latest.siteId;
          currentSiteRef.current = latest.siteId;
          setCurrentSiteId(latest.siteId);
          setState(
            stateForSelectedUsageSite(
              latest.siteId,
              sites.find((site) => site.id === latest.siteId)?.status,
              refreshingSiteIdsRef.current,
            ),
          );
          setQueryPhase(undefined);
        }
      } finally {
        floatingUsageScanRef.current.running = false;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void scan();
    };
    void scan();
    const interval = window.setInterval(() => void scan(), 2_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [siteIdsKey]);
  useEffect(() => {
    if (!selectedSite || initialLocation.surface === 'floating') return;
    const siteId = selectedSite.id;
    usageLoadCoordinatorRef.current.invalidate();
    void loadKeyContext(siteId);
    if (shell === 'api-keys') void loadApiKeys(siteId);
    if (shell === 'usage') {
      setUsageData(undefined);
      setUsageStats(undefined);
    }
    if (shell === 'channels') void loadChannels(selectedSite.id);
  }, [selectedSite?.id, shell]);
  useEffect(() => {
    if (initialLocation.surface !== 'floating' || !selectedSite || !window.sub2apiDesktop) return;
    const siteId = selectedSite.id;
    void loadKeyContext(siteId);
    void loadChannels(siteId);
    let active = true;
    let timer: number | undefined;
    const run = async () => {
      if (!active || document.visibilityState === 'hidden' || floatingRefreshRef.current.running)
        return;
      floatingRefreshRef.current.running = true;
      floatingRefreshRef.current.lastRunAt = Date.now();
      try {
        await refreshSelected();
      } finally {
        floatingRefreshRef.current.running = false;
      }
    };
    const schedule = () => {
      if (!active) return;
      timer = window.setTimeout(async () => {
        await run();
        schedule();
      }, randomPollingDelayMs());
    };
    const onVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - floatingRefreshRef.current.lastRunAt >= 30_000
      )
        void run();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [selectedSite?.id, siteIdsKey]);
  useEffect(() => {
    void window.sub2apiDesktop?.sites
      .keyContexts()
      .then((value) => setKeyContexts(value))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (shell !== 'overview' && initialLocation.surface !== 'floating') return;
    void loadCurrentKeyStats();
  }, [currentKeySelectionKey, shell, initialLocation.surface]);
  useEffect(() => {
    if (initialLocation.surface === 'floating') return;
    const desktop = window.sub2apiDesktop?.sites;
    if (!desktop || !siteIdsKey) return;
    let active = true;
    void desktop
      .rateContexts()
      .then((cached) => {
        if (active) setRateContexts(cached);
        if (!active) return undefined;
        setIsRefreshingRates(true);
        return desktop.refreshAllRateGroups();
      })
      .then((live) => {
        if (active && live) setRateContexts(live);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsRefreshingRates(false);
      });
    return () => {
      active = false;
    };
  }, [siteIdsKey]);
  useEffect(() => {
    void window.sub2apiDesktop?.sites
      .floatingSettings()
      .then(setFloatingSettings)
      .catch(() => undefined);
  }, []);

  async function loadChannels(
    siteId: string,
    force = false,
  ): Promise<{ ok: boolean; retryAfterSeconds?: number; terminal?: boolean }> {
    const request = channelLoadCoordinatorRef.current.begin(siteId);
    const isCurrent = () =>
      channelLoadCoordinatorRef.current.isCurrent(request, currentSiteRef.current);
    if (isCurrent()) {
      setChannelDetail(undefined);
      setState('refreshing');
    }
    try {
      const value = await channelStatusLoaderRef.current.loadChannels(siteId, force);
      if (!isCurrent()) return { ok: false };
      setChannelsData(value);
      const staleChannelData = value.stale === true;
      const storedAssociations = await window.sub2apiDesktop?.sites.channelAssociations(siteId);
      if (isCurrent() && storedAssociations) {
        setChannelAssociations(storedAssociations);
        setChannelAssociationsBySite((current) => ({ ...current, [siteId]: storedAssociations }));
      }
      const keyGroup = currentKeyGroup(
        keyOptions,
        usageFilterOptions.groups,
        keyPreference,
        selectedSite?.defaultKeyLabel,
      );
      const manualChannelIds =
        storedAssociations?.find((item) => item.groupId === keyGroup?.groupId)?.channelIds ?? [];
      const association = keyGroup?.groupId
        ? resolveFinalChannelAssociation(
            value.channels,
            keyGroup.groupName,
            value.availableChannels ?? [],
            keyGroup.groupId,
            manualChannelIds,
            value.availableChannelsState,
          )
        : undefined;
      const first = association?.status === 'matched' ? association.channels[0] : value.channels[0];
      const id = first?.id;
      setSelectedChannelId(id);
      if (!id) {
        setChannelDetail(undefined);
        setState(staleChannelData ? 'error' : 'success');
        return { ok: !staleChannelData };
      }
      const detailRequestId = ++channelDetailRequestRef.current;
      const detail = await channelStatusLoaderRef.current.loadDetail(siteId, id, force);
      if (isCurrent() && channelDetailRequestRef.current === detailRequestId)
        setChannelDetail(detail);
      if (isCurrent()) setState(staleChannelData ? 'error' : 'success');
      return { ok: !staleChannelData };
    } catch (error) {
      if (!isCurrent()) return { ok: false };
      setChannelsData((current: unknown) => current ?? { state: 'error', channels: [] });
      setChannelDetail({ state: 'error' });
      setState('error');
      const retryAfterSeconds = retryAfterSecondsFromError(error);
      if (error instanceof Error && error.message.includes('CHANNEL_AUTH_REQUIRED'))
        return { ok: false, terminal: true };
      return retryAfterSeconds === undefined ? { ok: false } : { ok: false, retryAfterSeconds };
    }
  }

  async function loadCurrentKeyStats(force = false) {
    const desktop = window.sub2apiDesktop?.sites;
    const sites = dashboard?.sites ?? [];
    if (!desktop || sites.length === 0) {
      setCurrentKeyStatsBySite({});
      return;
    }
    if (!currentKeyStatsLoaderRef.current)
      currentKeyStatsLoaderRef.current = new CurrentKeyStatsLoader((siteId, keyId) =>
        desktop.usageStats({
          siteId,
          period: 'today',
          page: 1,
          pageSize: 1,
          apiKeyId: keyId,
        }),
      );
    const inputs = sites.map((site) => {
      const context = keyContexts[site.id] ?? {
        keys: [],
        preference: { mode: 'auto' as const },
      };
      const key = resolveEffectiveKey(context.keys, context.preference, site.defaultKeyId);
      return {
        siteId: site.id,
        keyId: key?.id,
        availableCredit: availableCreditForKey(key, site.balance),
      };
    });
    const requestId = ++currentKeyStatsRequestRef.current;
    setIsRefreshingCurrentKeyStats(true);
    setCurrentKeyStatsBySite((current) =>
      Object.fromEntries(
        inputs.map((input) => {
          const previous = current[input.siteId];
          return [
            input.siteId,
            previous && 'keyId' in previous && previous.keyId === input.keyId
              ? previous
              : input.keyId
                ? { state: 'loading' as const, keyId: input.keyId }
                : { state: 'unknown' as const },
          ];
        }),
      ),
    );
    try {
      const result = await currentKeyStatsLoaderRef.current.load(inputs, force);
      if (currentKeyStatsRequestRef.current === requestId) setCurrentKeyStatsBySite(result);
    } finally {
      if (currentKeyStatsRequestRef.current === requestId) setIsRefreshingCurrentKeyStats(false);
    }
  }
  useEffect(() => {
    document.documentElement.dataset.reduceTransparency = String(reducedTransparency);
    document.documentElement.dataset.highContrast = String(highContrast);
  }, [reducedTransparency, highContrast]);
  useEffect(() => {
    document.querySelector<HTMLElement>('.content-scroll')?.scrollTo({ top: 0, left: 0 });
  }, [shell]);
  if (initialLocation.surface === 'floating')
    return <FloatingWindow {...context} onStateChange={setState} />;
  const apiKeysPage = (
    <ApiKeysPage
      state={apiKeysState}
      sites={
        dashboard?.sites.map((site) => ({
          id: site.id,
          name: siteDisplayName(site),
        })) ?? []
      }
      selectedSiteId={selectedSite?.id}
      search={apiKeyFilters.search}
      groupFilter={apiKeyFilters.groupId}
      statusFilter={apiKeyFilters.status}
      groups={
        apiKeysData?.groups.map((group) => ({
          id: group.id,
          name: group.name,
          platform: group.platform,
          rate: group.effectiveRate ?? group.defaultRate,
        })) ?? []
      }
      keys={(apiKeysData?.items ?? []).map(apiKeyRow)}
      pagination={apiKeysData?.page ?? { page: 1, pageSize: 20, pages: 0, total: 0 }}
      writingKeyIds={[...writingKeyIds]}
      errorMessage={apiKeysState === 'error' ? apiKeyMessage : undefined}
      successMessage={apiKeysState !== 'error' ? apiKeyMessage : undefined}
      onSelectSite={selectSite}
      onSearchChange={(search) => {
        const next = { ...apiKeyFilters, search, page: 1 };
        setApiKeyFilters(next);
        if (selectedSite) void loadApiKeys(selectedSite.id, next);
      }}
      onGroupFilterChange={(groupId) => {
        const next = { ...apiKeyFilters, groupId, page: 1 };
        setApiKeyFilters(next);
        if (selectedSite) void loadApiKeys(selectedSite.id, next);
      }}
      onStatusFilterChange={(status) => {
        const next = { ...apiKeyFilters, status, page: 1 };
        setApiKeyFilters(next);
        if (selectedSite) void loadApiKeys(selectedSite.id, next);
      }}
      onRefresh={() => selectedSite && void loadApiKeys(selectedSite.id, apiKeyFilters, true)}
      onCopyKey={async (keyId) => {
        if (!selectedSite) throw new Error('SITE_REQUIRED');
        try {
          const result = await window.sub2apiDesktop?.sites.copyApiKey({
            siteId: selectedSite.id,
            keyId,
          });
          if (!result?.copied) throw new Error('API_KEY_COPY_FAILED');
          notify({ id: 'api-key-copy', kind: 'success', message: 'API Key 已复制' });
        } catch (error) {
          notify({
            id: 'api-key-copy',
            kind: 'error',
            message: safeRendererError(error, 'API Key 复制失败'),
          });
          throw error;
        }
      }}
      onPageChange={(page) => {
        const next = { ...apiKeyFilters, page };
        setApiKeyFilters(next);
        if (selectedSite) void loadApiKeys(selectedSite.id, next);
      }}
      onGroupChange={(keyId, groupId) => {
        if (!selectedSite || writingKeyIds.has(keyId)) return;
        const siteId = selectedSite.id;
        setWritingKeyIds((current) => new Set(current).add(keyId));
        setApiKeyMessage('');
        void window.sub2apiDesktop?.sites
          .updateApiKeyGroup({ siteId, keyId, groupId })
          .then(() => {
            if (currentSiteRef.current !== siteId) return;
            notify({
              id: `api-key-group:${keyId}`,
              kind: 'success',
              message: '分组已同步到远程站点',
            });
            return loadApiKeys(siteId, apiKeyFilters, true);
          })
          .catch((error) => {
            if (currentSiteRef.current === siteId)
              notify({
                id: `api-key-group:${keyId}`,
                kind: 'error',
                message: safeRendererError(error, '分组切换失败，已保留原分组'),
              });
          })
          .finally(() => {
            if (currentSiteRef.current === siteId)
              setWritingKeyIds((current) => {
                const next = new Set(current);
                next.delete(keyId);
                return next;
              });
          });
      }}
      onOpenSiteManagement={() => changeShell('sites')}
    />
  );
  const pages = {
    overview: <OverviewPage {...context} />,
    'api-keys': apiKeysPage,
    usage: <UsagePage {...context} />,
    channels: <ChannelsPage {...context} />,
    sites: <SitesPage {...context} />,
    'sub2api-servers': (
      <Sub2ApiServersPage
        embedState={sub2apiServerEmbedState}
        onOpen={openEmbeddedSub2ApiServer}
        onOpenShortcut={openSub2ApiServerShortcut}
      />
    ),
    radar: <RadarPage embedState={radarEmbedState} onOpen={openEmbeddedRadar} />,
    'favorite-websites': (
      <FavoriteWebsitesPage
        embedState={favoriteWebsiteEmbedState}
        onOpen={openEmbeddedFavoriteWebsite}
      />
    ),
    'general-settings': (
      <GeneralSettingsPage updateChecking={updateChecking} onCheckForUpdate={checkForUpdate} />
    ),
    'notification-rules': <NotificationRulesPage selectedSite={selectedSite} />,
  };
  const navigation = [
    ['overview', '全部站点', LayoutDashboard],
    ['api-keys', 'API 密钥', KeyRound],
    ['usage', '使用记录', TimerReset],
    ['channels', '渠道状态', Network],
    ['sites', '站点管理', SlidersHorizontal],
    ['sub2api-servers', 'Sub2API 服务器', Server],
    ['radar', '雷达', Radio],
    ['favorite-websites', '常用网站', Globe],
  ] as const;
  return (
    <main
      className="app-shell"
      data-shell={shell}
      data-state={effectiveState}
      data-radar-embedded={radarEmbedState.status !== 'idle'}
      data-server-embedded={sub2apiServerEmbedState.status !== 'idle'}
      data-favorite-embedded={favoriteWebsiteEmbedState.status !== 'idle'}
    >
      <aside className="app-sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <img src={sub2ApiLogo} alt="" />
          </div>
          <div>
            <strong>看看你还有💰吗？</strong>
            <small>Sub2API 多站监控</small>
          </div>
        </div>
        <nav aria-label="主导航">
          {navigation.map(([value, label, Icon]) => (
            <button
              key={value}
              className={shell === value ? 'nav-item active' : 'nav-item'}
              onClick={() => changeShell(value)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            className={shell === 'notification-rules' ? 'nav-item active' : 'nav-item'}
            onClick={() => changeShell('notification-rules')}
          >
            <Bell size={18} />
            <span>通知</span>
          </button>
          <button
            className={shell === 'general-settings' ? 'nav-item active' : 'nav-item'}
            onClick={() => changeShell('general-settings')}
          >
            <Settings size={18} />
            <span>设置</span>
          </button>
        </div>
      </aside>
      <section className="app-content">
        <header className="app-toolbar">
          {favoriteWebsiteEmbedState.status !== 'idle' ? (
            <>
              <div className="fav-embed-toolbar-label">
                <Globe size={16} aria-hidden="true" />
                <span>{favoriteWebsiteEmbedState.target.label}</span>
              </div>
              <nav className="svr-server-switcher" aria-label="切换常用网站">
                {favoriteWebsites.map((website) => {
                  const active = website.id === favoriteWebsiteEmbedState.target.id;
                  return (
                    <button
                      key={website.id}
                      type="button"
                      className={active ? 'active' : ''}
                      aria-current={active ? 'page' : undefined}
                      aria-label={`切换到 ${website.name}`}
                      onClick={() => openEmbeddedFavoriteWebsite(website)}
                    >
                      {website.name}
                    </button>
                  );
                })}
              </nav>
              <div className="fav-embed-nav">
                <button
                  className="icon-button"
                  aria-label="后退"
                  title="后退"
                  disabled={
                    favoriteWebsiteEmbedState.status !== 'open' ||
                    !favoriteWebsiteEmbedState.canGoBack
                  }
                  onClick={() => window.sub2apiDesktop?.favoriteWebsites.back()}
                >
                  <ArrowLeft size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="前进"
                  title="前进"
                  disabled={
                    favoriteWebsiteEmbedState.status !== 'open' ||
                    !favoriteWebsiteEmbedState.canGoForward
                  }
                  onClick={() => window.sub2apiDesktop?.favoriteWebsites.forward()}
                >
                  <ArrowRight size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="返回网站主页"
                  title="主页"
                  disabled={favoriteWebsiteEmbedState.status !== 'open'}
                  onClick={() => window.sub2apiDesktop?.favoriteWebsites.home()}
                >
                  <House size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="刷新网站网页"
                  title="刷新"
                  disabled={favoriteWebsiteEmbedState.status !== 'open'}
                  onClick={() => window.sub2apiDesktop?.favoriteWebsites.reload()}
                >
                  <RefreshCw size={17} />
                </button>
              </div>
              <button
                className="icon-button fav-embed-close"
                aria-label="关闭常用网站网页"
                title="关闭常用网站网页"
                onClick={closeEmbeddedFavoriteWebsite}
              >
                <X size={18} />
              </button>
            </>
          ) : sub2apiServerEmbedState.status !== 'idle' ? (
            <>
              <div className="svr-embed-toolbar-label">
                <Server size={16} aria-hidden="true" />
                <span>{sub2apiServerEmbedState.target.label}</span>
                {sub2apiServerEmbedState.status === 'open' && (
                  <em className={`svr-toolbar-login is-${sub2apiServerEmbedState.loginState}`}>
                    {serverLoginLabel(sub2apiServerEmbedState.loginState)}
                  </em>
                )}
              </div>
              <nav className="svr-server-switcher" aria-label="切换 Sub2API 服务器">
                {sub2apiServers.map((server) => {
                  const active = server.id === sub2apiServerEmbedState.target.id;
                  return (
                    <button
                      key={server.id}
                      type="button"
                      className={active ? 'active' : ''}
                      aria-current={active ? 'page' : undefined}
                      aria-label={`切换到 ${server.name}`}
                      disabled={active}
                      onClick={() => openEmbeddedSub2ApiServer(server)}
                    >
                      {server.name}
                    </button>
                  );
                })}
              </nav>
              <div className="svr-embed-nav">
                <button
                  className="icon-button"
                  aria-label="后退"
                  title="后退"
                  disabled={
                    sub2apiServerEmbedState.status !== 'open' || !sub2apiServerEmbedState.canGoBack
                  }
                  onClick={() => window.sub2apiDesktop?.sub2apiServers.back()}
                >
                  <ArrowLeft size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="前进"
                  title="前进"
                  disabled={
                    sub2apiServerEmbedState.status !== 'open' ||
                    !sub2apiServerEmbedState.canGoForward
                  }
                  onClick={() => window.sub2apiDesktop?.sub2apiServers.forward()}
                >
                  <ArrowRight size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="返回服务器主页"
                  title="主页"
                  disabled={sub2apiServerEmbedState.status !== 'open'}
                  onClick={() => window.sub2apiDesktop?.sub2apiServers.home()}
                >
                  <House size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="刷新服务器网页"
                  title="刷新"
                  disabled={sub2apiServerEmbedState.status !== 'open'}
                  onClick={() => window.sub2apiDesktop?.sub2apiServers.reload()}
                >
                  <RefreshCw size={17} />
                </button>
              </div>
              <button
                className="icon-button svr-embed-close"
                aria-label="关闭服务器网页"
                title="关闭服务器网页"
                onClick={closeEmbeddedSub2ApiServer}
              >
                <X size={18} />
              </button>
            </>
          ) : radarEmbedState.status !== 'idle' ? (
            <>
              <div className="radar-embed-toolbar-label">
                <Radio size={16} aria-hidden="true" />
                <span>{radarEmbedState.target.label}</span>
              </div>
              <nav className="svr-server-switcher" aria-label="切换雷达站点">
                {radarEntries.map((entry) => {
                  const active = entry.id === radarEmbedState.target.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={active ? 'active' : ''}
                      aria-current={active ? 'page' : undefined}
                      aria-label={`切换到 ${entry.label}`}
                      onClick={() => openEmbeddedRadar(entry)}
                    >
                      {entry.label}
                    </button>
                  );
                })}
              </nav>
              <button
                className="icon-button radar-embed-close"
                aria-label="关闭雷达网页"
                title="关闭雷达网页"
                onClick={closeEmbeddedRadar}
              >
                <X size={18} />
              </button>
            </>
          ) : (
            <>
              {(shell === 'usage' || shell === 'channels') && (
                <label className="toolbar-site-switch">
                  <i />
                  <select
                    aria-label="当前选中中转站"
                    value={selectedSite?.id ?? ''}
                    onChange={(event) => selectSite(event.target.value)}
                  >
                    {!selectedSite && <option value="">未选择站点</option>}
                    {dashboard?.sites.map((site) => (
                      <option value={site.id} key={site.id}>
                        {siteDisplayName(site)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} />
                </label>
              )}
              <span className="last-updated" title="当前站点最后更新时间">
                <History size={15} aria-hidden="true" />
                <span>
                  最后更新：
                  {selectedSite?.fetchedAt
                    ? new Date(selectedSite.fetchedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </span>
              </span>
              <button
                className="app-version-badge"
                ref={updateTriggerRef}
                aria-label={`版本 ${versionLabel}`}
                title={updateChecking ? '正在检查更新' : '点击检查更新'}
                aria-busy={updateChecking}
                disabled={updateChecking}
                onClick={checkForUpdate}
              >
                <Tag size={14} aria-hidden="true" />
                <span>{versionLabel}</span>
              </button>
              <button
                className="icon-button"
                aria-label="刷新"
                onClick={shell === 'overview' ? refreshAll : refreshSelected}
                disabled={
                  !selectedSite || (shell === 'overview' ? isRefreshingAll : state === 'refreshing')
                }
              >
                <TimerReset size={18} />
              </button>
            </>
          )}
          <button
            className="icon-button"
            aria-label="最小化"
            onClick={() => {
              void window.sub2apiDesktop?.sites.minimizeMainWindow();
            }}
          >
            <span aria-hidden>−</span>
          </button>
          <button
            className="icon-button danger"
            aria-label="关闭"
            onClick={() => {
              void window.sub2apiDesktop?.sites.closeMainWindow();
            }}
          >
            <span aria-hidden>×</span>
          </button>
        </header>
        <div className="content-scroll">
          {(state === 'loading' || state === 'refreshing' || isRefreshingAll) && (
            <div className="refresh-progress" role="status">
              <LoaderCircle size={16} className="spin" />
              {isRefreshingAll
                ? '正在刷新全部站点…'
                : state === 'refreshing'
                  ? '正在刷新最新数据…'
                  : '正在加载站点数据…'}
            </div>
          )}
          {pages[shell]}
        </div>
        {updateState?.status === 'available' && updateModalOpen && (
          <div
            className="update-modal-backdrop update-surface"
            role="presentation"
            onMouseDown={() => {
              closeUpdateModal();
            }}
          >
            <section
              className="update-modal update-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="update-modal-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className="update-modal-header">
                <div>
                  <span className="update-modal-eyebrow">在线更新</span>
                  <h2 id="update-modal-title">发现新版本 {updateState.manifest.version}</h2>
                </div>
                <button
                  className="icon-button"
                  ref={updateCloseRef}
                  aria-label="关闭更新弹框"
                  title="关闭"
                  disabled={updateDownloading}
                  onClick={closeUpdateModal}
                >
                  <X size={18} />
                </button>
              </header>
              {updateState.manifest.testOnly && (
                <div className="update-modal-test-note">
                  真机更新测试专用，本版本不包含业务功能变化。
                </div>
              )}
              <div className="update-modal-version-row" aria-label="版本更新信息">
                <span>{versionLabel}</span>
                <i aria-hidden="true" />
                <strong>{updateState.manifest.version}</strong>
              </div>
              <p className="update-modal-notes">{updateState.manifest.releaseNotes}</p>
              {updateDownloading && (
                <div className="update-modal-progress" role="status">
                  <div className="update-modal-progress-label">
                    <span>正在下载更新</span>
                    <strong>{updateProgress}%</strong>
                  </div>
                  <progress max="100" value={updateProgress} />
                </div>
              )}
              <div className="update-modal-actions">
                <button
                  className="primary-action"
                  disabled={updateDownloading}
                  onClick={() => void downloadUpdate(updateState.manifest)}
                >
                  <Download size={16} />
                  {updateDownloading ? '下载中' : '立即更新'}
                </button>
                <button
                  className="secondary-action"
                  disabled={updateDownloading}
                  onClick={() => {
                    void window.sub2apiDesktop?.sites.updateSkip(updateState.manifest.version);
                    setUpdateState({ ...updateState, status: 'skipped' });
                    setUpdateModalOpen(false);
                    showUpdateNotice('已跳过此版本');
                  }}
                >
                  跳过此版本
                </button>
                <button
                  className="secondary-action"
                  disabled={updateDownloading}
                  onClick={() => {
                    void window.sub2apiDesktop?.sites.updateRemindLater(
                      updateState.manifest.version,
                    );
                    setUpdateState({ ...updateState, status: 'skipped' });
                    setUpdateModalOpen(false);
                    showUpdateNotice('已设置稍后提醒');
                  }}
                >
                  稍后提醒
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
      {showPreviewControls && (
        <PreviewControls
          {...context}
          shell={shell}
          onShellChange={changeShell}
          onStateChange={setState}
          onReducedTransparencyChange={setReducedTransparency}
          onHighContrastChange={setHighContrast}
        />
      )}
    </main>
  );
}

function serverLoginLabel(
  state: Extract<Sub2ApiServerEmbedState, { status: 'open' }>['loginState'],
): string {
  if (state === 'logged-in') return '已登录';
  if (state === 'please-login') return '请登录';
  if (state === 'expired') return '登录过期';
  return '状态未知';
}

function isKeyPreference(value: unknown): value is SiteKeyContext['preference'] {
  if (!value || typeof value !== 'object' || !('mode' in value)) return false;
  const mode = (value as { mode?: unknown }).mode;
  return (
    mode === 'auto' ||
    (mode === 'manual' && typeof (value as { keyId?: unknown }).keyId === 'string')
  );
}

function isUsageGroups(value: unknown): value is UsageFilterOptions['groups'] {
  return (
    Array.isArray(value) &&
    value.every(
      (group) =>
        group &&
        typeof group === 'object' &&
        'id' in group &&
        typeof group.id === 'string' &&
        'name' in group &&
        typeof group.name === 'string',
    )
  );
}

function isUsageModels(value: unknown): value is UsageFilterOptions['models'] {
  return Array.isArray(value) && value.every((model) => typeof model === 'string');
}

function groupsFromKeys(keys: SiteKeyContext['keys']): UsageFilterOptions {
  const groups = new Map<string, { id: string; name: string; rate?: number }>();
  for (const key of keys)
    if (key.groupId && key.groupName)
      groups.set(key.groupId, { id: key.groupId, name: key.groupName, rate: key.rate });
  return { models: [], groups: [...groups.values()] };
}

function mergeUsageFilters(
  current: UsageFilterOptions | undefined,
  incoming: UsageFilterOptions,
): UsageFilterOptions {
  return {
    models: incoming.models.length ? incoming.models : (current?.models ?? []),
    groups: incoming.groups.length ? incoming.groups : (current?.groups ?? []),
  };
}

function apiKeyRow(key: ApiKeyManagementPayload['items'][number]): ApiKeyRow {
  return {
    id: key.id,
    name: key.name,
    maskedLabel: key.maskedLabel,
    apiKey: key.apiKey,
    groupId: key.groupId,
    groupName: key.groupName,
    platform: key.platform,
    effectiveRate: key.effectiveRate,
    currentConcurrency: key.currentConcurrency,
    todayActualCost: key.todayActualCost,
    last30DaysActualCost: key.last30DaysActualCost,
    expiresAt: key.expiresAt,
    status: key.status === 'quota-exhausted' ? 'exhausted' : key.status,
    createdAt: key.createdAt ?? '',
  };
}
