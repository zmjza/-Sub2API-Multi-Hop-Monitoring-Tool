import type { PreviewContext } from '../../preview/types';
import type { UsageSpeedTier } from './usage-speed';
export interface UsageRecord {
  time: string;
  model: string;
  groupName: string;
  requestType: string;
  inputTokens: string;
  outputTokens: string;
  cacheReadTokens: string;
  inputTokensValue?: number;
  cacheReadTokensValue?: number;
  cacheCreationTokensValue?: number;
  cacheRate?: number;
  actualCost: string;
  keyLabel: string;
  reasoningEffort?: string;
  firstTokenMs?: string;
  firstTokenValue?: number;
  durationMs?: string;
  tokensPerSecond?: number;
  tokensPerSecondLabel?: string;
  speedTier?: UsageSpeedTier;
}
export interface UsageEvents {
  onRefresh(): void;
  onReset(): void;
  onExportCsv(): void;
  onPageChange(page: number): void;
}
export type UsageProps = PreviewContext;
