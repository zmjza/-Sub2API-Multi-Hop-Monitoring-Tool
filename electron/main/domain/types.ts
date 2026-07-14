export type CapabilityState = 'supported' | 'unsupported' | 'error' | 'unknown';
export type SiteViewState =
  | 'loading'
  | 'refreshing'
  | 'partial'
  | 'success'
  | 'stale'
  | 'error'
  | 'auth-required'
  | 'unsupported'
  | 'empty'
  | 'disabled'
  | 'selected';

export interface ApiKeySummary {
  id: string;
  name: string;
  maskedLabel: string;
  status: 'active' | 'disabled';
  groupId?: string;
}

export interface SiteSnapshot {
  siteId: string;
  balance: number;
  todayTokens: number;
  todayActualCost: number;
  todayRequests?: number;
  todayInputTokens?: number;
  todayOutputTokens?: number;
  todayCacheReadTokens?: number;
  todayCacheCreationTokens?: number;
  todayTotalCost?: number;
  averageDurationMs?: number;
  fetchedAt: number;
}

export interface SafeError {
  code: string;
  message: string;
  capability?: string;
  httpStatus?: number;
  retryable: boolean;
}
