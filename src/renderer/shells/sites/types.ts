import type { PreviewContext } from '../../preview/types';
export interface SiteDraft {
  name: string;
  url: string;
  validation: string;
}
export interface SiteEvents {
  onTestAndSave(draft: SiteDraft): void;
  onBatchValidate(urls: string[]): void;
  onOpenNotificationSettings(): void;
}
export type SitesProps = PreviewContext;
