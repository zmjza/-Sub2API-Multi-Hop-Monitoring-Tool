import { AlertCircle, CheckCircle2, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import './notifications.css';

export type NotificationKind = 'loading' | 'success' | 'info' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  message: string;
  action?: { label: string; run: () => void };
}

type NotificationAction =
  { type: 'upsert'; notice: AppNotification } | { type: 'dismiss'; id: string };

export function notificationReducer(
  state: AppNotification[],
  action: NotificationAction,
): AppNotification[] {
  if (action.type === 'dismiss') return state.filter((item) => item.id !== action.id);
  const existing = state.findIndex((item) => item.id === action.notice.id);
  if (existing >= 0) return state.map((item, index) => (index === existing ? action.notice : item));
  return [...state, action.notice].slice(-3);
}

interface NotificationsApi {
  notify(notice: AppNotification): void;
  dismiss(id: string): void;
}

const NotificationsContext = createContext<NotificationsApi | undefined>(undefined);
const dismissAfter: Record<Exclude<NotificationKind, 'loading'>, number> = {
  success: 4_000,
  info: 5_000,
  warning: 6_000,
  error: 8_000,
};

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notices, dispatch] = useReducer(notificationReducer, []);
  const timers = useRef(new Map<string, number>());
  const dismiss = useCallback((id: string) => dispatch({ type: 'dismiss', id }), []);
  const notify = useCallback((notice: AppNotification) => {
    dispatch({ type: 'upsert', notice });
  }, []);
  useEffect(() => {
    const visibleIds = new Set(notices.map((notice) => notice.id));
    for (const [id, timer] of timers.current) {
      if (visibleIds.has(id)) continue;
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    for (const notice of notices) {
      const previous = timers.current.get(notice.id);
      if (previous) window.clearTimeout(previous);
      if (notice.kind === 'loading') {
        timers.current.delete(notice.id);
        continue;
      }
      timers.current.set(
        notice.id,
        window.setTimeout(() => {
          timers.current.delete(notice.id);
          dismiss(notice.id);
        }, dismissAfter[notice.kind]),
      );
    }
  }, [dismiss, notices]);
  useEffect(
    () => () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );
  const api = useMemo(() => ({ notify, dismiss }), [dismiss, notify]);
  return (
    <NotificationsContext.Provider value={api}>
      {children}
      <div className="app-notification-viewport" aria-live="polite" aria-atomic="false">
        {notices.map((notice) => (
          <div
            className={`app-notification is-${notice.kind}`}
            role={notice.kind === 'error' ? 'alert' : 'status'}
            key={notice.id}
          >
            <NotificationIcon kind={notice.kind} />
            <span>{notice.message}</span>
            {notice.action && (
              <button
                type="button"
                className="app-notification-action"
                onClick={() => {
                  notice.action?.run();
                  dismiss(notice.id);
                }}
              >
                {notice.action.label}
              </button>
            )}
            <button
              type="button"
              className="app-notification-close"
              aria-label="关闭通知"
              title="关闭"
              onClick={() => dismiss(notice.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsApi {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error('NotificationsProvider is missing');
  return value;
}

export function safeRendererError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (raw.includes('INTERACTIVE_AUTH_TIMEOUT')) return '安全验证已超时，请重新开始';
  if (raw.includes('INTERACTIVE_AUTH_CANCELLED')) return '已取消安全验证，站点未添加';
  if (raw.includes('INTERACTIVE_AUTH_LOAD_FAILED')) return '官方登录窗口加载失败，请稍后重试';
  const stripped = raw
    .replace(/^Error:\s*/i, '')
    .replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/i, '')
    .trim();
  if (!stripped || /Error invoking remote method|\bat\s+\S+\s*\(/i.test(stripped)) return fallback;
  return stripped.slice(0, 240);
}

function NotificationIcon({ kind }: { kind: NotificationKind }) {
  if (kind === 'loading') return <LoaderCircle size={18} className="spin" aria-hidden="true" />;
  if (kind === 'success') return <CheckCircle2 size={18} aria-hidden="true" />;
  if (kind === 'warning') return <TriangleAlert size={18} aria-hidden="true" />;
  if (kind === 'error') return <AlertCircle size={18} aria-hidden="true" />;
  return <Info size={18} aria-hidden="true" />;
}
