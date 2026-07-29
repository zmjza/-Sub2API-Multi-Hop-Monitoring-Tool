import type { PreviewContext } from '../../preview/types';
import type { UpdateCheckResult } from '../../../../electron/main/services/update-service';
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
export type SitesProps = PreviewContext & {
  updateChecking?: boolean;
  updateState?: UpdateCheckResult;
  onCheckForUpdate?: () => void;
};
