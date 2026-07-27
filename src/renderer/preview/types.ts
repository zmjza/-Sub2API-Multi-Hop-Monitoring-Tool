export const previewStates = [
  'success',
  'loading',
  'refreshing',
  'partial',
  'stale',
  'error',
  'auth-required',
  'unsupported',
  'empty',
  'disabled',
  'selected',
] as const;
export type PreviewState = (typeof previewStates)[number];
export type ThemeMode = 'light';
export type MainShell = 'overview' | 'api-keys' | 'usage' | 'channels' | 'sites' | 'radar';
export interface PreviewContext {
  state: PreviewState;
  theme: ThemeMode;
  reducedTransparency: boolean;
  highContrast: boolean;
  sitesSection?: 'notifications' | 'settings';
  queryPhase?: string;
  isRefreshingAll?: boolean;
  refreshingSiteIds?: string[];
  rateContexts?: RateContexts;
  isRefreshingRates?: boolean;
  refreshingRateSiteIds?: string[];
  dashboard?: DashboardSnapshot;
  selectedSite?: SiteSummary;
  usageData?: unknown;
  usageStats?: unknown;
  channelsData?: unknown;
  channelAssociations?: ChannelAssociation[];
  channelAssociationsBySite?: Record<string, ChannelAssociation[]>;
  channelDetail?: unknown;
  selectedChannelId?: string;
  keyOptions?: Array<{
    id: string;
    maskedLabel: string;
    status: string;
    groupId?: string;
    groupName?: string;
    quota?: number;
    quotaUsed?: number;
    subscriptionType?: string;
    rate?: number;
  }>;
  keyContexts?: SiteKeyContexts;
  currentKeyStatsBySite?: Record<string, CurrentKeyStatsState>;
  isRefreshingCurrentKeyStats?: boolean;
  usageFilterOptions?: {
    models: string[];
    groups: Array<{ id: string; name: string; rate?: number }>;
  };
  keyPreference?: { mode: 'auto' | 'manual'; keyId?: string };
  onSelectSite?: (siteId: string) => void;
  onRefreshSite?: () => void;
  onRefreshCurrentKeyStats?: () => void;
  onRefreshFloating?: () => void;
  onPreviousSite?: () => void;
  onNextSite?: () => void;
  onOpenSite?: () => void;
  onUsageQuery?: (query: {
    period: 'today' | '7d' | '30d' | 'custom';
    page: number;
    apiKeyId?: string;
    model?: string;
    groupId?: string;
    startDate?: string;
    endDate?: string;
    requestType?: string;
    billingType?: string;
    billingMode?: string;
    sort?: 'asc' | 'desc';
  }) => void;
  onKeyPreferenceChange?: (
    siteId: string,
    value: { mode: 'auto' | 'manual'; keyId?: string },
  ) => void;
  onSiteNoteChange?: (siteId: string, note: string) => Promise<void>;
  onRefreshAllRates?: () => Promise<void>;
  onRefreshSiteRates?: (siteId: string) => Promise<void>;
  onRechargeRatioChange?: (siteId: string, ratio: number) => Promise<void>;
  onSelectChannel?: (channelId: string) => void;
  onRefreshChannels?: () => Promise<{
    ok: boolean;
    retryAfterSeconds?: number;
    terminal?: boolean;
  }>;
  onChannelAssociationSave?: (groupId: string, channelIds: string[]) => Promise<void>;
  onChannelAssociationClear?: (groupId: string) => Promise<void>;
  floatingPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom';
  floatingOpacity?: number;
  onFloatingPositionChange?: (
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  ) => void;
  onFloatingOpacityChange?: (opacity: number) => void;
}

export interface PreviewLocation extends Omit<PreviewContext, 'theme'> {
  surface: 'main' | 'floating';
  shell: MainShell;
}

export function parsePreviewLocation(search: string): PreviewLocation {
  const params = new URLSearchParams(search);
  const surface = params.get('surface') === 'floating' ? 'floating' : 'main';
  const shellValue = params.get('shell');
  const shell: MainShell = ['overview', 'api-keys', 'usage', 'channels', 'sites', 'radar'].includes(
    shellValue ?? '',
  )
    ? (shellValue as MainShell)
    : 'overview';
  const stateValue = params.get('state');
  const state: PreviewState = (previewStates as readonly string[]).includes(stateValue ?? '')
    ? (stateValue as PreviewState)
    : 'success';
  return {
    surface,
    shell,
    state,
    reducedTransparency: params.get('reduceTransparency') === 'true',
    highContrast: params.get('highContrast') === 'true',
  };
}
import type {
  ChannelAssociation,
  DashboardSnapshot,
  RateContexts,
  SiteKeyContexts,
  SiteSummary,
} from '../../../electron/shared/contracts';
import type { CurrentKeyStatsState } from '../shells/overview/current-key-stats';
