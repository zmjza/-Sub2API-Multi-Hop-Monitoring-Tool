import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Globe,
  LoaderCircle,
  Plus,
  Radio,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  RADAR_ENTRY_LIMIT,
  isSafeRadarUrl,
  normalizeRadarUrl,
  type RadarEmbedState,
  type RadarEntry,
} from './radar-data';
import './radar.css';

type RadarPageProps = {
  embedState: RadarEmbedState;
  onOpen: (entry: RadarEntry) => void;
};

type RadarListState = {
  status: 'loading' | 'error' | 'ready';
  entries: RadarEntry[];
  message?: string;
};

type RadarDialogProps = {
  open: boolean;
  labelledBy: string;
  describedBy?: string;
  onClose: () => void;
  initialFocusRef: RefObject<HTMLButtonElement | HTMLInputElement | null>;
  children: ReactNode;
};

export function RadarPage({ embedState, onOpen }: RadarPageProps) {
  const [listState, setListState] = useState<RadarListState>({
    status: 'loading',
    entries: [],
  });
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ label: '', url: '' });
  const [addError, setAddError] = useState<string>();
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState<RadarEntry>();
  const [deleteError, setDeleteError] = useState<string>();
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const loadEntries = useCallback(async () => {
    setListState((current) => ({ ...current, status: 'loading' }));
    try {
      const radar = window.sub2apiDesktop?.radar;
      if (!radar) throw new Error('RADAR_BRIDGE_UNAVAILABLE');
      const entries = await radar.list();
      setListState({ status: 'ready', entries });
    } catch (error) {
      setListState({
        status: 'error',
        entries: [],
        message: radarErrorMessage(error),
      });
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const closeAddDialog = useCallback(() => {
    if (addSubmitting) return;
    setAddOpen(false);
  }, [addSubmitting]);

  const closeDeleteDialog = useCallback(() => {
    if (deleteSubmitting) return;
    setDeleteEntry(undefined);
    setDeleteError(undefined);
  }, [deleteSubmitting]);

  const openAddDialog = () => {
    if (addSubmitting) return;
    setAddForm({ label: '', url: '' });
    setAddError(undefined);
    setAddOpen(true);
  };

  const validateAddForm = (): string | undefined => {
    const label = addForm.label.trim();
    const url = addForm.url.trim();
    if (!label) return '请输入名称';
    if (label.length > 80) return '名称不能超过 80 个字符';
    if (!url) return '请输入网址';
    if (url.length > 500) return '网址不能超过 500 个字符';
    if (!isSafeRadarUrl(url)) return '网址必须是完整的 HTTPS 地址';
    if (listState.entries.some((entry) => entry.label.trim() === label))
      return '该名称已存在，请换一个名称';
    if (listState.entries.some((entry) => entry.url === normalizeRadarUrl(url)))
      return '该网址已存在，请换一个网址';
    if (listState.entries.length >= RADAR_ENTRY_LIMIT)
      return `最多可添加 ${RADAR_ENTRY_LIMIT} 个雷达站点`;
    return undefined;
  };

  const submitAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (addSubmitting) return;
    const validationError = validateAddForm();
    if (validationError) {
      setAddError(validationError);
      return;
    }
    setAddSubmitting(true);
    setAddError(undefined);
    try {
      const radar = window.sub2apiDesktop?.radar;
      if (!radar) throw new Error('RADAR_BRIDGE_UNAVAILABLE');
      const entries = await radar.create({
        label: addForm.label.trim(),
        url: addForm.url.trim(),
      });
      setListState({ status: 'ready', entries });
      setAddOpen(false);
      addButtonRef.current?.focus();
    } catch (error) {
      setAddError(radarErrorMessage(error));
    } finally {
      setAddSubmitting(false);
    }
  };

  const requestDelete = (entry: RadarEntry) => {
    setDeleteEntry(entry);
    setDeleteError(undefined);
  };

  const confirmDelete = async () => {
    if (!deleteEntry || deleteSubmitting) return;
    setDeleteSubmitting(true);
    setDeleteError(undefined);
    try {
      const radar = window.sub2apiDesktop?.radar;
      if (!radar) throw new Error('RADAR_BRIDGE_UNAVAILABLE');
      const entries = await radar.delete(deleteEntry.id);
      setListState({ status: 'ready', entries });
      setDeleteEntry(undefined);
    } catch (error) {
      setDeleteError(radarErrorMessage(error));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (embedState.status === 'error')
    return (
      <div className="radar-page radar-page-state" data-radar-state="error">
        <div className="radar-state-icon" aria-hidden="true">
          <Globe size={22} />
        </div>
        <h1>雷达网页暂时无法加载</h1>
        <p>{embedState.message}</p>
        <span>请点击右上角关闭图标返回雷达入口。</span>
      </div>
    );

  if (embedState.status === 'opening')
    return (
      <div className="radar-page radar-page-state" data-radar-state="opening" role="status">
        <div className="radar-state-icon radar-state-icon-loading" aria-hidden="true">
          <Radio size={22} />
        </div>
        <h1>正在打开 {embedState.target.label}</h1>
        <p>网页将在当前 Electron 窗口内显示。</p>
      </div>
    );

  if (embedState.status === 'open')
    return (
      <div className="radar-page radar-page-state" data-radar-state="open" aria-hidden="true">
        <div className="radar-state-icon" aria-hidden="true">
          <Radio size={22} />
        </div>
        <h1>{embedState.target.label}</h1>
      </div>
    );

  return (
    <div className="radar-page" data-radar-state="idle">
      <header className="radar-heading">
        <div>
          <p className="radar-eyebrow">
            <Radio size={15} aria-hidden="true" /> CODEX RADAR
          </p>
          <h1>雷达</h1>
          <p className="radar-subtitle">选择要打开的雷达站点</p>
        </div>
        <button
          type="button"
          ref={addButtonRef}
          className="primary-action radar-add-button"
          onClick={openAddDialog}
        >
          <Plus size={16} aria-hidden="true" />
          新增雷达站点
        </button>
      </header>

      {listState.status === 'loading' && (
        <section className="radar-list-state" data-radar-list-state="loading" role="status">
          <LoaderCircle className="radar-loading-icon" size={24} aria-hidden="true" />
          <span>正在加载雷达站点</span>
        </section>
      )}

      {listState.status === 'error' && (
        <section className="radar-list-state radar-list-error" data-radar-list-state="error">
          <AlertCircle size={24} aria-hidden="true" />
          <h2>雷达站点加载失败</h2>
          <p>{listState.message ?? '请稍后重试。'}</p>
          <button type="button" className="secondary-action" onClick={() => void loadEntries()}>
            <RefreshCw size={15} aria-hidden="true" />
            重试
          </button>
        </section>
      )}

      {listState.status === 'ready' && listState.entries.length === 0 && (
        <section className="radar-list-state radar-empty" data-radar-list-state="empty">
          <span className="radar-empty-icon" aria-hidden="true">
            <Globe size={24} />
          </span>
          <h2>还没有雷达站点</h2>
          <p>新增一个 HTTPS 雷达网页后即可在应用内打开。</p>
          <button type="button" className="primary-action" onClick={openAddDialog}>
            <Plus size={16} aria-hidden="true" />
            新增雷达站点
          </button>
        </section>
      )}

      {listState.status === 'ready' && listState.entries.length > 0 && (
        <section className="radar-target-grid" aria-label="雷达站点">
          {listState.entries.map((entry) => (
            <article className="radar-target-card" key={entry.id}>
              <button
                type="button"
                className="radar-target-open"
                aria-label={`打开 ${entry.label}`}
                onClick={() => onOpen(entry)}
              >
                <span className="radar-target-card-icon" aria-hidden="true">
                  <Radio size={22} />
                </span>
                <span className="radar-target-card-copy">
                  <strong>{entry.label}</strong>
                  <small>{radarHostname(entry)}</small>
                </span>
                <ArrowUpRight className="radar-target-card-arrow" size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="radar-target-delete"
                aria-label={`删除 ${entry.label}`}
                title="删除雷达站点"
                onClick={() => requestDelete(entry)}
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </article>
          ))}
        </section>
      )}

      <RadarDialog
        open={addOpen}
        labelledBy="radar-add-title"
        describedBy="radar-add-description"
        onClose={closeAddDialog}
        initialFocusRef={nameInputRef}
      >
        <header className="radar-dialog-header">
          <div>
            <span className="radar-dialog-eyebrow">新增</span>
            <h2 id="radar-add-title">新增雷达站点</h2>
            <p id="radar-add-description">输入名称和完整 HTTPS 网址。</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭新增雷达站点弹窗"
            title="关闭"
            disabled={addSubmitting}
            onClick={closeAddDialog}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <form className="radar-add-form" onSubmit={(event) => void submitAdd(event)}>
          <label className="radar-field">
            <span>名称</span>
            <input
              ref={nameInputRef}
              type="text"
              value={addForm.label}
              maxLength={80}
              placeholder="例如：Codex 雷达"
              autoComplete="off"
              disabled={addSubmitting}
              aria-invalid={Boolean(addError && !addForm.url.trim())}
              aria-describedby="radar-add-error"
              onChange={(event) =>
                setAddForm((current) => ({ ...current, label: event.target.value }))
              }
            />
          </label>
          <label className="radar-field">
            <span>网址</span>
            <input
              type="url"
              value={addForm.url}
              maxLength={500}
              placeholder="https://example.com/"
              autoComplete="off"
              disabled={addSubmitting}
              aria-invalid={Boolean(addError && !addForm.label.trim())}
              aria-describedby="radar-add-error"
              onChange={(event) =>
                setAddForm((current) => ({ ...current, url: event.target.value }))
              }
            />
          </label>
          {addError && (
            <p className="radar-form-error" id="radar-add-error" role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              {addError}
            </p>
          )}
          <footer className="radar-dialog-actions">
            <button
              type="button"
              className="secondary-action"
              disabled={addSubmitting}
              onClick={closeAddDialog}
            >
              取消
            </button>
            <button type="submit" className="primary-action" disabled={addSubmitting}>
              {addSubmitting ? '新增中…' : '确认新增'}
            </button>
          </footer>
        </form>
      </RadarDialog>

      <RadarDialog
        open={Boolean(deleteEntry)}
        labelledBy="radar-delete-title"
        describedBy="radar-delete-description"
        onClose={closeDeleteDialog}
        initialFocusRef={confirmDeleteRef}
      >
        {deleteEntry && (
          <>
            <header className="radar-dialog-header">
              <div>
                <span className="radar-dialog-eyebrow radar-dialog-eyebrow-danger">删除</span>
                <h2 id="radar-delete-title">删除雷达站点</h2>
                <p id="radar-delete-description">删除后可以重新新增。</p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="关闭删除雷达站点弹窗"
                title="关闭"
                disabled={deleteSubmitting}
                onClick={closeDeleteDialog}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className="radar-delete-entry">
              <strong>{deleteEntry.label}</strong>
              <code>{deleteEntry.url}</code>
            </div>
            {deleteError && (
              <p className="radar-form-error" role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                {deleteError}
              </p>
            )}
            <footer className="radar-dialog-actions">
              <button
                type="button"
                className="secondary-action"
                disabled={deleteSubmitting}
                onClick={closeDeleteDialog}
              >
                取消
              </button>
              <button
                type="button"
                ref={confirmDeleteRef}
                className="radar-danger-action"
                disabled={deleteSubmitting}
                onClick={() => void confirmDelete()}
              >
                {deleteSubmitting ? '删除中…' : '确认删除'}
              </button>
            </footer>
          </>
        )}
      </RadarDialog>
    </div>
  );
}

function RadarDialog({
  open,
  labelledBy,
  describedBy,
  onClose,
  initialFocusRef,
  children,
}: RadarDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    initialFocusRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previous?.focus();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;
  return (
    <div
      className="radar-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <section
        ref={dialogRef}
        className="radar-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
      >
        {children}
      </section>
    </div>
  );
}

function radarHostname(entry: RadarEntry): string {
  try {
    return new URL(entry.url).hostname;
  } catch {
    return entry.url;
  }
}

function radarErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('RADAR_DUPLICATE_LABEL')) return '该名称已存在，请换一个名称';
  if (message.includes('RADAR_DUPLICATE_URL')) return '该网址已存在，请换一个网址';
  if (message.includes('RADAR_ENTRY_LIMIT_REACHED'))
    return `最多可添加 ${RADAR_ENTRY_LIMIT} 个雷达站点`;
  if (message.includes('RADAR_IPC_FORBIDDEN')) return '当前窗口无权操作雷达';
  if (message.includes('RADAR_BRIDGE_UNAVAILABLE')) return '当前 Electron 桥不可用';
  return message;
}
