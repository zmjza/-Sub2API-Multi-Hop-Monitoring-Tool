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
import { UsagePage } from './shells/usage/UsagePage';
import { ChannelsPage } from './shells/channels/ChannelsPage';
import { ChannelLoadCoordinator } from './channel-load-coordinator';
import { SitesPage } from './shells/sites/SitesPage';
import { FloatingWindow } from './shells/floating/FloatingWindow';
import { RadarPage } from './shells/radar/RadarPage';
import sub2ApiLogo from './assets/sub2api-logo.png';
import './styles.css';
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
  const [keyOptions, setKeyOptions] = useState<
    Array<{
      id: string;
      maskedLabel: string;
      status: string;
      groupId?: string;
      groupName?: string;
      quota?: number;
      quotaUsed?: number;
    }>
  >([]);
  const [usageFilterOptions, setUsageFilterOptions] = useState<{
    models: string[];
    groups: Array<{ id: string; name: string; rate?: number }>;
  }>({ models: [], groups: [] });
  const [floatingPosition, setFloatingPosition] = useState<
    'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  >('top-right');
  const [floatingOpacity, setFloatingOpacity] = useState(84);
  const [keyPreference, setKeyPreference] = useState<{ mode: 'auto' | 'manual'; keyId?: string }>({
    mode: 'auto',
  });
  const [currentSiteId, setCurrentSiteId] = useState<string>();
  const [sitesSection, setSitesSection] = useState<'notifications' | 'settings'>();
  const currentSiteRef = useRef<string | undefined>(undefined);
  const channelLoadCoordinatorRef = useRef(new ChannelLoadCoordinator());
  const siteRequestRef = useRef(0);
  const usageRequestRef = useRef(0);
  const channelDetailRequestRef = useRef(0);
  const selectedSite = dashboard?.sites.find(
    (site) => site.id === (currentSiteId ?? dashboard.currentSiteId),
  );
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
  };
  context.dashboard = dashboard;
  context.selectedSite = selectedSite;
  context.usageData = usageData;
  context.channelsData = channelsData;
  context.channelDetail = channelDetail;
  context.selectedChannelId = selectedChannelId;
  context.keyOptions = keyOptions;
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
    const [keys, filters, preference] = await Promise.all([
      desktop.keys(siteId).catch(() => []),
      desktop.usageFilters(siteId).catch(() => ({ models: [], groups: [] })),
      desktop.keyPreference(siteId).catch(() => ({ mode: 'auto' as const })),
    ]);
    if (currentSiteRef.current !== siteId) return;
    setKeyOptions(Array.isArray(keys) ? (keys as typeof keyOptions) : []);
    if (filters && typeof filters === 'object' && 'models' in filters && 'groups' in filters)
      setUsageFilterOptions(filters as typeof usageFilterOptions);
    if (preference && typeof preference === 'object' && 'mode' in preference)
      setKeyPreference(preference as typeof keyPreference);
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
    setKeyOptions([]);
    setUsageFilterOptions({ models: [], groups: [] });
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
  context.onSelectSite = selectSite;
  context.onRefreshSite = refreshSelected;
  context.onPreviousSite = () => moveSite(-1);
  context.onNextSite = () => moveSite(1);
  context.onOpenSite = () => {
    void window.sub2apiDesktop?.sites.openMainWindow();
  };
  context.onKeyPreferenceChange = (value) => {
    if (!selectedSite) return;
    void window.sub2apiDesktop?.sites
      .setKeyPreference(selectedSite.id, value)
      .then((result) => {
        if (result && typeof result === 'object' && 'preference' in result)
          setKeyPreference(result.preference as typeof keyPreference);
        return window.sub2apiDesktop?.sites.refresh(selectedSite.id);
      })
      .then(() => window.sub2apiDesktop?.sites.list())
      .then((value) => {
        if (value) setDashboard(value);
      })
      .catch(() => undefined);
  };
  context.onSiteNoteChange = async (note) => {
    if (!selectedSite) return;
    const updated = await window.sub2apiDesktop?.sites.setNote(selectedSite.id, note);
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
  context.onRefreshFloating = refreshSelected;
  context.onSelectChannel = (channelId) => {
    if (!selectedSite) return;
    const siteId = selectedSite.id;
    const requestId = ++channelDetailRequestRef.current;
    setSelectedChannelId(channelId);
    void window.sub2apiDesktop?.sites
      .channelStatus(siteId, channelId)
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
    void loadChannels(selectedSite.id);
  };
  context.floatingPosition = floatingPosition;
  context.floatingOpacity = floatingOpacity;
  context.onFloatingPositionChange = (position) => {
    setFloatingPosition(position);
    void window.sub2apiDesktop?.sites
      .setFloatingSettings({ position, opacity: floatingOpacity })
      .then((value) => {
        setFloatingPosition(value.position);
        setFloatingOpacity(value.opacity);
      });
  };
  context.onFloatingOpacityChange = (opacity) => {
    setFloatingOpacity(opacity);
    void window.sub2apiDesktop?.sites
      .setFloatingSettings({ position: floatingPosition, opacity })
      .catch(() => undefined);
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
          setCurrentSiteId(value.currentSiteId);
          if (value.sites.length === 0 && initialLocation.surface === 'main' && !hasExplicitShell)
            setShell('sites');
        })
        .catch(() => undefined);
    refresh();
    window.addEventListener('sub2api:refresh', refresh);
    const unsubscribe = window.sub2apiDesktop?.sites.onChanged(refresh);
    const unsubscribeState = window.sub2apiDesktop?.sites.onRefreshState((value) => {
      if (value.siteId === currentSiteRef.current) {
        setState(value.state);
        setQueryPhase(value.phase);
      }
    });
    return () => {
      window.removeEventListener('sub2api:refresh', refresh);
      unsubscribe?.();
      unsubscribeState?.();
    };
  }, []);
  useEffect(() => {
    if (!selectedSite || initialLocation.surface === 'floating') return;
    const siteId = selectedSite.id;
    const requestId = ++usageRequestRef.current;
    void window.sub2apiDesktop?.sites
      .usage({ siteId, period: 'today', page: 1, pageSize: 20 })
      .then((value) => {
        if (currentSiteRef.current === siteId && usageRequestRef.current === requestId)
          setUsageData(value);
      })
      .catch(() => undefined);
    void loadChannels(selectedSite.id);
    void loadKeyContext(siteId);
  }, [selectedSite?.id]);
  useEffect(() => {
    void window.sub2apiDesktop?.sites
      .floatingSettings()
      .then((value) => {
        setFloatingPosition(value.position);
        setFloatingOpacity(value.opacity);
      })
      .catch(() => undefined);
  }, []);

  async function loadChannels(siteId: string) {
    const request = channelLoadCoordinatorRef.current.begin(siteId);
    const isCurrent = () =>
      channelLoadCoordinatorRef.current.isCurrent(request, currentSiteRef.current);
    if (isCurrent()) {
      setChannelDetail(undefined);
      setState('refreshing');
    }
    try {
      const value = await window.sub2apiDesktop?.sites.channels(siteId);
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
      const detail = await window.sub2apiDesktop?.sites.channelStatus(siteId, id);
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
    document.querySelector<HTMLElement>('.app-content')?.scrollTo({ top: 0, left: 0 });
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
            onClick={refreshSelected}
            disabled={!selectedSite || state === 'refreshing'}
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
          {(state === 'loading' || state === 'refreshing') && (
            <div className="refresh-progress" role="status">
              <LoaderCircle size={16} className="spin" />
              {state === 'refreshing' ? '正在刷新最新数据…' : '正在加载站点数据…'}
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
