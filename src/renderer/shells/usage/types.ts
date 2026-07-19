import type { PreviewContext } from '../../preview/types';
export interface UsageRecord {
  time: string;
  model: string;
  groupName: string;
  requestType: string;
  inputTokens: string;
  outputTokens: string;
  cacheReadTokens: string;
  actualCost: string;
  keyLabel: string;
  reasoningEffort?: string;
  firstTokenMs?: string;
  firstTokenValue?: number;
  durationMs?: string;
}
export interface UsageEvents {
  onRefresh(): void;
  onReset(): void;
  onExportCsv(): void;
  onPageChange(page: number): void;
}
export type UsageProps = PreviewContext;
