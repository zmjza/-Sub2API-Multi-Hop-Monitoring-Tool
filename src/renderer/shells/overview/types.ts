import type { PreviewContext } from '../../preview/types';
export interface OverviewSite {
  name: string;
  balance: string;
  keyLabel: string;
  status: string;
}
export interface OverviewEvents {
  onSelectSite(siteName: string): void;
  onSort(field: 'balance' | 'tokens' | 'cost' | 'health'): void;
}
export type OverviewProps = PreviewContext;
