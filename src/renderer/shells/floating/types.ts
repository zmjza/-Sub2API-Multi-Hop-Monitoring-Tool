import type { PreviewContext, PreviewState } from '../../preview/types';
export interface FloatingSnapshot {
  siteName: string;
  balance: string;
  keyLabel: string;
  rate: string;
  todayTokens: string;
  todayCost: string;
}
export interface FloatingEvents {
  onPreviousSite(): void;
  onNextSite(): void;
  onOpenSite(): void;
  onStateChange(value: PreviewState): void;
}
export type FloatingProps = PreviewContext & Pick<FloatingEvents, 'onStateChange'>;
