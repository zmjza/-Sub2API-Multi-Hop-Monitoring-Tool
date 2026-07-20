import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  LoaderCircle,
  Network,
  Radio,
  Settings,
  SlidersHorizontal,
  TimerReset,
} from 'lucide-react';
import { PreviewControls } from './preview/PreviewControls';
import {
  parsePreviewLocation,
  type MainShell,
  type PreviewContext,
  type PreviewState,
} from './preview/types';
import { OverviewPage } from './shells/overview/OverviewPage';
import { desktopRateChannelStatusLoader } from './shells/overview/rate-channel-status-loader';
import { UsagePage } from './shells/usage/UsagePage';
import { ChannelsPage } from './shells/channels/ChannelsPage';
import { ChannelLoadCoordinator } from './channel-load-coordinator';
import { SitesPage } from './shells/sites/SitesPage';
import { FloatingWindow } from './shells/floating/FloatingWindow';
import {
  selectLatestUsageSite,
  stateForSelectedUsageSite,
} from './shells/floating/latest-usage-site';
import { RadarPage } from './shells/radar/RadarPage';
import sub2ApiLogo from './assets/sub2api-logo.png';
import './styles.css';
import type {
  SiteKeyContext,
  SiteKeyContexts,
  UsageFilterOptions,
  FloatingSettings,
  RateContexts,
} from '../../electron/shared/contracts';
const initialLocation = parsePreviewLocation(window.location.search);
const showPreviewControls =
  import.meta.env.DEV || new URLSearchParams(window.location.search).get('preview') === 'true';
const hasExplicitShell = new URLSearchParams(window.location.search).has('shell');
export function App() {
  const [shell, setShell] = useState<MainShell>(initialLocation.shell);
  const [state, setState] = useState<PreviewState>(initialLocation.state);
  const [queryPhase, setQueryPhase] = useState<string>();
  const [reducedTransparency, setReducedTransparency] = useState(
    initialLocation.reducedTransparency,
  );
  const [highContrast, setHighContrast] = useState(initialLocation.highContrast);
  const [dashboard, setDashboard] =
    useState<import('../../electron/shared/contracts').DashboardSnapshot>();
  const [usageData, setUsageData] = useState<unknown>();
  const [channelsData, setChannelsData] = useState<unknown>();
  const [channelDetail, setChannelDetail] = useState<unknown>();
  const [selectedChannelId, setSelectedChannelId] = useState<string>();
  const [keyContexts, setKeyContexts] = useState<SiteKeyContexts>({});
  const [usageFiltersBySite, setUsageFiltersBySite] = useState<Record<string, UsageFilterOptions>>(
    {},
  );
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [refreshingSiteIds, setRefreshingSiteIds] = useState<Set<string>>(() => new Set());
  const [rateContexts, setRateContexts] = useState<RateContexts>({ sites: {}, ratios: {} });
  const [isRefreshingRates, setIsRefreshingRates] = useState(false);
  const [refreshingRateSiteIds, setRefreshingRateSiteIds] = useState<Set<string>>(() => new Set());
  const [floatingSettings, setFloatingSettings] = useState<FloatingSettings>({
    position: 'top-right',
    opacity: 84,
  });
  const floatingPosition = floatingSettings.position;
  const floatingOpacity = floatingSettings.opacity;
  const [currentSiteId, setCurrentSiteId] = useState<string>();
  const [sitesSection, setSitesSection] = useState<'notifications' | 'settings'>();
  const currentSiteRef = useRef<string | undefined>(undefined);
  const refreshingSiteIdsRef = useRef<Set<string>>(new Set());
  const shellRef = useRef(shell);
  const channelLoadCoordinatorRef = useRef(new ChannelLoadCoordinator());
  const channelStatusLoaderRef = useRef(desktopRateChannelStatusLoader());
  const keyContextRequestRef = useRef(new Map<string, number>());
  const siteRequestRef = useRef(0);
  const usageRequestRef = useRef(0);
  const channelDetailRequestRef = useRef(0);
  const floatingUsageScanRef = useRef({ running: false, latestAt: 0, siteId: '' });
  const selectedSite = dashboard?.sites.find(
    (site) => site.id === (currentSiteId ?? dashboard.currentSiteId),
  );
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
  context.channelsData = channelsData;
  context.channelDetail = channelDetail;
  context.selectedChannelId = selectedChannelId;
  context.keyOptions = keyOptions;
  context.keyContexts = keyContexts;
  context.rateContexts = rateContexts;
  context.isRefreshingRates = isRefreshingRates;
  context.refreshingRateSiteIds = [...refreshingRateSiteIds];
  context.usageFilterOptions = usageFilterOptions;
  context.keyPreference = keyPreference;
  context.sitesSection = sitesSection;
  const openSitesSection = (section: 'notifications' | 'settings') => {
    setSitesSection(section);
    setShell('sites');
  };
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
  const refreshSelected = () => {
    if (!selectedSite) return;
    const siteId = selectedSite.id;
    setState('refreshing');
    void window.sub2apiDesktop?.sites
      .refresh(siteId)
      .then(() => window.sub2apiDesktop?.sites.list())
      .then((value) => {
        if (currentSiteRef.current !== siteId) return;
        if (value) setDashboard(value);
        setState('success');
      })
      .catch(() => {
        if (currentSiteRef.current === siteId) setState('error');
      });
  };
  const refreshAll = () => {
    if (isRefreshingAll || !dashboard?.sites.length) return;
    setIsRefreshingAll(true);
    setRefreshingSiteIds(new Set(dashboard.sites.map((site) => site.id)));
    void window.sub2apiDesktop?.sites
      .refreshAll()
      .then((value) => {
        if (value) setDashboard(value);
      })
      .finally(() => {
        setIsRefreshingAll(false);
        setRefreshingSiteIds(new Set());
      });
  };
  context.onSelectSite = selectSite;
  context.onRefreshSite = refreshAll;
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
    } catch (error) {
      setRateContexts((current) => {
        const ratios = { ...current.ratios };
        if (previous === undefined) delete ratios[siteId];
        else ratios[siteId] = previous;
        return { ...current, ratios };
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
  context.onRefreshChannels = () => {
    if (!selectedSite) return;
    void loadChannels(selectedSite.id, true);
  };
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
    const requestId = ++usageRequestRef.current;
    setUsageData(undefined);
    setState('loading');
    void window.sub2apiDesktop?.sites
      .usage({ siteId, period, page, pageSize: 20, ...filters })
      .then((value) => {
        if (currentSiteRef.current !== siteId || usageRequestRef.current !== requestId) return;
        setUsageData(value);
        setState('success');
      })
      .catch(() => {
        if (currentSiteRef.current === siteId && usageRequestRef.current === requestId)
          setState('error');
      });
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
            setShell('sites');
        })
        .catch(() => undefined);
    refresh();
    window.addEventListener('sub2api:refresh', refresh);
    const unsubscribe = window.sub2apiDesktop?.sites.onChanged(refresh);
    const unsubscribeKeyContext = window.sub2apiDesktop?.sites.onKeyContextChanged((siteId) => {
      void loadKeyContext(siteId);
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
    });
    return () => {
      window.removeEventListener('sub2api:refresh', refresh);
      unsubscribe?.();
      unsubscribeKeyContext?.();
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
    const requestId = ++usageRequestRef.current;
    void loadKeyContext(siteId);
    if (shell === 'usage')
      void window.sub2apiDesktop?.sites
        .usage({ siteId, period: 'today', page: 1, pageSize: 20 })
        .then((value) => {
          if (currentSiteRef.current === siteId && usageRequestRef.current === requestId)
            setUsageData(value);
        })
        .catch(() => undefined);
    if (shell === 'channels') void loadChannels(selectedSite.id);
  }, [selectedSite?.id, shell]);
  useEffect(() => {
    void window.sub2apiDesktop?.sites
      .keyContexts()
      .then((value) => setKeyContexts(value))
      .catch(() => undefined);
  }, []);
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

  async function loadChannels(siteId: string, force = false) {
    const request = channelLoadCoordinatorRef.current.begin(siteId);
    const isCurrent = () =>
      channelLoadCoordinatorRef.current.isCurrent(request, currentSiteRef.current);
    if (isCurrent()) {
      setChannelDetail(undefined);
      setState('refreshing');
    }
    try {
      const value = await channelStatusLoaderRef.current.loadChannels(siteId, force);
      if (!isCurrent()) return;
      setChannelsData(value);
      const rawChannels =
        value && typeof value === 'object' && 'channels' in value ? value.channels : undefined;
      const first = Array.isArray(rawChannels) ? rawChannels[0] : undefined;
      const id =
        first && typeof first === 'object' && 'id' in first ? String(first.id ?? '') : undefined;
      setSelectedChannelId(id);
      if (!id) {
        setChannelDetail(undefined);
        setState('success');
        return;
      }
      const detailRequestId = ++channelDetailRequestRef.current;
      const detail = await channelStatusLoaderRef.current.loadDetail(siteId, id, force);
      if (isCurrent() && channelDetailRequestRef.current === detailRequestId)
        setChannelDetail(detail);
      if (isCurrent()) setState('success');
    } catch {
      if (!isCurrent()) return;
      setChannelsData((current: unknown) => current ?? { state: 'error', channels: [] });
      setChannelDetail({ state: 'error' });
      setState('error');
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
  const pages = {
    overview: <OverviewPage {...context} />,
    usage: <UsagePage {...context} />,
    channels: <ChannelsPage {...context} />,
    sites: <SitesPage {...context} />,
    radar: <RadarPage />,
  };
  const navigation = [
    ['overview', '全部站点', LayoutDashboard],
    ['usage', '使用记录', TimerReset],
    ['channels', '渠道状态', Network],
    ['sites', '站点管理', SlidersHorizontal],
    ['radar', '雷达', Radio],
  ] as const;
  return (
    <main className="app-shell" data-shell={shell} data-state={effectiveState}>
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
              onClick={() => setShell(value)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item" onClick={() => openSitesSection('notifications')}>
            <Bell size={18} />
            <span>通知</span>
          </button>
          <button className="nav-item" onClick={() => openSitesSection('settings')}>
            <Settings size={18} />
            <span>设置</span>
          </button>
        </div>
      </aside>
      <section className="app-content">
        <header className="app-toolbar">
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
                    {site.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} />
            </label>
          )}
          <span className="last-updated">
            {selectedSite?.fetchedAt
              ? `最后更新: ${new Date(selectedSite.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : '尚无更新时间'}
          </span>
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
      </section>
      {showPreviewControls && (
        <PreviewControls
          {...context}
          shell={shell}
          onShellChange={setShell}
          onStateChange={setState}
          onReducedTransparencyChange={setReducedTransparency}
          onHighContrastChange={setHighContrast}
        />
      )}
    </main>
  );
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
