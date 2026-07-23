export type ApiKeysPageState =
  | 'loading'
  | 'empty'
  | 'error'
  | 'unsupported'
  | 'auth-required'
  | 'success'
  | 'refreshing'
  | 'partial';

export type ApiKeyStatus = 'active' | 'disabled' | 'exhausted' | 'expired' | 'unknown';

export interface ApiKeySiteOption {
  id: string;
  name: string;
}

export interface ApiKeyGroupOption {
  id: string;
  name: string;
  platform?: string;
  rate?: number;
}

export interface ApiKeyRow {
  id: string;
  name: string;
  maskedLabel: string;
  groupId?: string;
  groupName?: string;
  platform?: string;
  effectiveRate?: number;
  currentConcurrency?: number;
  todayActualCost?: number;
  last30DaysActualCost?: number;
  expiresAt?: string;
  status: ApiKeyStatus;
  createdAt: string;
}

export interface ApiKeyPagination {
  page: number;
  pageSize: number;
  pages: number;
  total: number;
}

export interface ApiKeysPageProps {
  state: ApiKeysPageState;
  sites: ApiKeySiteOption[];
  selectedSiteId?: string;
  search: string;
  groupFilter: string;
  statusFilter: '' | ApiKeyStatus;
  groups: ApiKeyGroupOption[];
  keys: ApiKeyRow[];
  pagination: ApiKeyPagination;
  writingKeyIds?: string[];
  errorMessage?: string;
  successMessage?: string;
  onSelectSite?: (siteId: string) => void;
  onSearchChange?: (search: string) => void;
  onGroupFilterChange?: (groupId: string) => void;
  onStatusFilterChange?: (status: '' | ApiKeyStatus) => void;
  onRefresh?: () => void;
  onGroupChange?: (keyId: string, groupId: string) => void;
  onPageChange?: (page: number) => void;
  onOpenSiteManagement?: () => void;
}
