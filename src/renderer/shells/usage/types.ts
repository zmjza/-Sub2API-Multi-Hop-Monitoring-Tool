import type { PreviewContext } from '../../preview/types';
export interface UsageRecord {
  time: string;
  model: string;
  groupName: string;
  requestType: string;
  tokens: string;
  actualCost: string;
  keyLabel: string;
  reasoningEffort?: string;
}
export interface UsageEvents {
  onRefresh(): void;
  onReset(): void;
  onExportCsv(): void;
  onPageChange(page: number): void;
}
export type UsageProps = PreviewContext;
