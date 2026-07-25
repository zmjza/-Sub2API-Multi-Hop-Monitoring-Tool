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
  updateNotice?: {
    tone: 'info' | 'success' | 'error';
    message: string;
  };
  updateState?: UpdateCheckResult;
  onCheckForUpdate?: () => void;
};
