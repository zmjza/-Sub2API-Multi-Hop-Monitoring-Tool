import type { PreviewContext } from '../../preview/types';
export interface ChannelPreview {
  name: string;
  platform: string;
  latency: string;
  ping: string;
  availability: string;
}
export interface ChannelEvents {
  onSelectChannel(id: string): void;
  onPeriodChange(days: 7 | 15 | 30): void;
  onRefresh(): void;
}
export type ChannelsProps = PreviewContext;
