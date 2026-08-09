import {
  AlertCircle,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  GripVertical,
  History,
  KeyRound,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  Settings,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  SUB2API_SERVER_LIMIT,
  SUB2API_SERVER_SHORTCUT_LIMIT,
  isSafeSub2ApiServerUrl,
  normalizeSub2ApiServerUrl,
  sub2apiShortcutUrl,
  type Sub2ApiServer,
  type Sub2ApiServerEmbedState,
  type Sub2ApiShortcut,
} from '../../../../electron/shared/sub2api-server';
import './sub2api-servers.css';

type Sub2ApiServersPageProps = {
  embedState: Sub2ApiServerEmbedState;
  onOpen: (server: Sub2ApiServer) => void;
  onOpenShortcut: (server: Sub2ApiServer, shortcut: Sub2ApiShortcut) => void;
};

type ListState = {
  status: 'loading' | 'error' | 'ready';
  servers: Sub2ApiServer[];
  message?: string;
};

type ShortcutDraft = {
  id?: string;
  label: string;
  path: string;
  icon?: string;
};

type ServerDraft = {
  id?: string;
  name: string;
  baseUrl: string;
  loginRule: string;
  shortcuts: ShortcutDraft[];
};

const shortcutIconOptions = [
  { value: 'Users', label: '账号管理', Icon: Users },
  { value: 'History', label: '使用记录', Icon: History },
  { value: 'KeyRound', label: 'API 密钥', Icon: KeyRound },
  { value: 'LayoutGrid', label: '渠道管理', Icon: LayoutGrid },
  { value: 'Settings', label: '系统设置', Icon: Settings },
];

export function Sub2ApiServersPage({
  embedState,
  onOpen,
  onOpenShortcut,
}: Sub2ApiServersPageProps) {
  const [listState, setListState] = useState<ListState>({ status: 'loading', servers: [] });
  const [editor, setEditor] = useState<ServerDraft | undefined>();
  const [deleteServer, setDeleteServer] = useState<Sub2ApiServer>();
  const [formError, setFormError] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clearingId, setClearingId] = useState<string>();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const deleteCloseRef = useRef<HTMLButtonElement>(null);
  const deleteConfirmRef = useRef<HTMLButtonElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const loadServers = useCallback(async () => {
    setListState((current) => ({ ...current, status: 'loading' }));
    try {
      const bridge = window.sub2apiDesktop?.sub2apiServers;
      if (!bridge) throw new Error('SUB2API_SERVER_BRIDGE_UNAVAILABLE');
      const servers = await bridge.list();
      setListState({ status: 'ready', servers });
    } catch (error) {
      setListState({ status: 'error', servers: [], message: serverErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    void loadServers();
  }, [loadServers]);

  useEffect(() => {
    if (!editor) return;
    nameInputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!submitting) setEditor(undefined);
        return;
      }
      if (event.key === 'Tab' && document.querySelector('.svr-dialog')) {
        trapDialogFocus(event, document.querySelector('.svr-dialog') as HTMLElement);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editor, submitting]);

  useEffect(() => {
    if (!deleteServer) return;
    deleteCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setDeleteServer(undefined);
      setDeleteError(undefined);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [deleteServer]);

  const openAdd = () => {
    if (submitting) return;
    setFormError(undefined);
    setEditor({ name: '', baseUrl: '', loginRule: '', shortcuts: [] });
  };

  const openEdit = (server: Sub2ApiServer) => {
    if (submitting) return;
    setFormError(undefined);
    setEditor({
      id: server.id,
      name: server.name,
      baseUrl: server.baseUrl,
      loginRule: server.loginRule ?? '',
      shortcuts: server.shortcuts.map((shortcut) => ({
        id: shortcut.id,
        label: shortcut.label,
        path: shortcut.path,
        icon: shortcut.icon,
      })),
    });
  };

  const validateDraft = (draft: ServerDraft): string | undefined => {
    const name = draft.name.trim();
    const baseUrl = draft.baseUrl.trim();
    if (!name) return '请输入名称';
    if (name.length > 80) return '名称不能超过 80 个字符';
    if (!baseUrl) return '请输入服务器地址';
    if (baseUrl.length > 500) return '服务器地址不能超过 500 个字符';
    if (!isSafeSub2ApiServerUrl(baseUrl)) return '服务器地址必须是完整的 HTTPS 地址';
    if (draft.loginRule.length > 120) return '登录页识别规则不能超过 120 个字符';
    if (draft.shortcuts.length > SUB2API_SERVER_SHORTCUT_LIMIT)
      return `最多 ${SUB2API_SERVER_SHORTCUT_LIMIT} 个快捷入口`;
    const labels = new Set<string>();
    for (const shortcut of draft.shortcuts) {
      if (!shortcut.label.trim()) return '快捷入口名称不能为空';
      if (labels.has(shortcut.label.trim())) return '快捷入口名称不能重复';
      labels.add(shortcut.label.trim());
      if (!sub2apiShortcutUrl(baseUrl, shortcut.path))
        return `快捷入口“${shortcut.label.trim()}”必须指向当前服务器同源 HTTPS 地址`;
    }
    const normalizedUrl = normalizeSub2ApiServerUrl(baseUrl);
    const duplicates = listState.servers.some(
      (server) =>
        server.id !== draft.id &&
        (server.name.trim() === name ||
          normalizeSub2ApiServerUrl(server.baseUrl) === normalizedUrl),
    );
    if (duplicates) return '服务器名称或地址已存在';
    if (!draft.id && listState.servers.length >= SUB2API_SERVER_LIMIT)
      return `最多可添加 ${SUB2API_SERVER_LIMIT} 个服务器`;
    return undefined;
  };

  const submitEditor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || submitting) return;
    const validationError = validateDraft(editor);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSubmitting(true);
    setFormError(undefined);
    try {
      const bridge = window.sub2apiDesktop?.sub2apiServers;
      if (!bridge) throw new Error('SUB2API_SERVER_BRIDGE_UNAVAILABLE');
      const shortcuts = editor.shortcuts.map((shortcut) => ({
        ...(shortcut.id ? { id: shortcut.id } : {}),
        label: shortcut.label.trim(),
        path: shortcut.path.trim(),
        ...(shortcut.icon ? { icon: shortcut.icon } : {}),
      }));
      const next = editor.id
        ? await bridge.update({
            id: editor.id,
            name: editor.name.trim(),
            baseUrl: editor.baseUrl.trim(),
            loginRule: editor.loginRule.trim() || undefined,
            shortcuts,
          })
        : await bridge.create({
            name: editor.name.trim(),
            baseUrl: editor.baseUrl.trim(),
            loginRule: editor.loginRule.trim() || undefined,
            shortcuts,
          });
      setListState({ status: 'ready', servers: next });
      setEditor(undefined);
      addButtonRef.current?.focus();
    } catch (error) {
      setFormError(serverErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const requestDelete = (server: Sub2ApiServer) => {
    setDeleteServer(server);
    setDeleteError(undefined);
  };

  const confirmDelete = async () => {
    if (!deleteServer || deleting) return;
    setDeleting(true);
    setDeleteError(undefined);
    try {
      const bridge = window.sub2apiDesktop?.sub2apiServers;
      if (!bridge) throw new Error('SUB2API_SERVER_BRIDGE_UNAVAILABLE');
      const next = await bridge.delete(deleteServer.id);
      setListState({ status: 'ready', servers: next });
      setDeleteServer(undefined);
      addButtonRef.current?.focus();
    } catch (error) {
      setDeleteError(serverErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const clearSession = async (server: Sub2ApiServer) => {
    if (clearingId) return;
    setClearingId(server.id);
    try {
      const bridge = window.sub2apiDesktop?.sub2apiServers;
      if (!bridge) throw new Error('SUB2API_SERVER_BRIDGE_UNAVAILABLE');
      await bridge.clearSession(server.id);
      const next = await bridge.list();
      setListState({ status: 'ready', servers: next });
    } catch (error) {
      setListState((current) => ({
        ...current,
        message: serverErrorMessage(error),
      }));
    } finally {
      setClearingId(undefined);
    }
  };

  if (embedState.status === 'error')
    return (
      <div className="svr-page svr-page-state" data-svr-state="error">
        <div className="svr-state-icon" aria-hidden="true">
          <AlertCircle size={22} />
        </div>
        <h1>服务器网页暂时无法加载</h1>
        <p>{embedState.message}</p>
        <span>请点击右上角关闭图标返回服务器列表。</span>
      </div>
    );

  if (embedState.status === 'opening')
    return (
      <div className="svr-page svr-page-state" data-svr-state="opening" role="status">
        <div className="svr-state-icon svr-state-icon-loading" aria-hidden="true">
          <Server size={22} />
        </div>
        <h1>正在打开 {embedState.target.label}</h1>
        <p>服务器网页将在当前 Electron 窗口内显示。</p>
      </div>
    );

  if (embedState.status === 'open')
    return (
      <div className="svr-page svr-page-state" data-svr-state="open" aria-hidden="true">
        <div className="svr-state-icon" aria-hidden="true">
          <Server size={22} />
        </div>
        <h1>{embedState.target.label}</h1>
      </div>
    );

  return (
    <div className="svr-page" data-svr-state="idle">
      <header className="svr-heading">
        <div>
          <p className="svr-eyebrow">
            <Server size={15} aria-hidden="true" /> SUB2API 服务器
          </p>
          <h1>Sub2API 服务器管理</h1>
          <p className="svr-subtitle">绑定二开站后可在应用内直接打开并保留网页登录态</p>
        </div>
        <button
          type="button"
          ref={addButtonRef}
          className="primary-action svr-add-button"
          onClick={openAdd}
        >
          <Plus size={16} aria-hidden="true" />
          新增服务器
        </button>
      </header>

      {listState.status === 'loading' && (
        <section className="svr-list-state" data-svr-list-state="loading" role="status">
          <LoaderCircle className="svr-loading-icon" size={24} aria-hidden="true" />
          <span>正在加载服务器</span>
        </section>
      )}

      {listState.status === 'error' && (
        <section className="svr-list-state svr-list-error" data-svr-list-state="error">
          <AlertCircle size={24} aria-hidden="true" />
          <h2>服务器加载失败</h2>
          <p>{listState.message ?? '请稍后重试。'}</p>
          <button type="button" className="secondary-action" onClick={() => void loadServers()}>
            <RefreshCw size={15} aria-hidden="true" />
            重试
          </button>
        </section>
      )}

      {listState.status === 'ready' && listState.servers.length === 0 && (
        <section className="svr-list-state svr-empty" data-svr-list-state="empty">
          <span className="svr-empty-icon" aria-hidden="true">
            <Server size={24} />
          </span>
          <h2>还没有绑定服务器</h2>
          <p>新增一个 HTTPS Sub2API 服务器后即可在应用内打开。</p>
          <button type="button" className="primary-action" onClick={openAdd}>
            <Plus size={16} aria-hidden="true" />
            新增服务器
          </button>
        </section>
      )}

      {listState.status === 'ready' && listState.servers.length > 0 && (
        <section className="svr-target-grid" aria-label="Sub2API 服务器">
          {listState.servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              clearing={clearingId === server.id}
              onOpen={() => onOpen(server)}
              onEdit={() => openEdit(server)}
              onDelete={() => requestDelete(server)}
              onClearSession={() => void clearSession(server)}
              onOpenShortcut={(shortcut) => onOpenShortcut(server, shortcut)}
            />
          ))}
        </section>
      )}

      {editor && (
        <div
          className="svr-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) setEditor(undefined);
          }}
        >
          <section
            className="svr-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="svr-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="svr-dialog-header">
              <div>
                <span className="svr-dialog-eyebrow">Sub2API 服务器</span>
                <h2 id="svr-dialog-title">{editor.id ? '编辑服务器' : '新增服务器'}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="关闭编辑弹窗"
                title="关闭"
                disabled={submitting}
                onClick={() => setEditor(undefined)}
              >
                <X size={18} />
              </button>
            </header>
            <form className="svr-editor-form" onSubmit={submitEditor}>
              <label className="svr-field">
                名称
                <input
                  ref={nameInputRef}
                  value={editor.name}
                  maxLength={80}
                  onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                />
              </label>
              <label className="svr-field">
                服务器地址
                <input
                  value={editor.baseUrl}
                  maxLength={500}
                  placeholder="https://example.com"
                  onChange={(event) => setEditor({ ...editor, baseUrl: event.target.value })}
                />
              </label>
              <label className="svr-field">
                登录页识别规则
                <input
                  value={editor.loginRule}
                  maxLength={120}
                  placeholder="/login"
                  onChange={(event) => setEditor({ ...editor, loginRule: event.target.value })}
                />
              </label>
              <ShortcutEditor
                shortcuts={editor.shortcuts}
                onChange={(shortcuts) => setEditor({ ...editor, shortcuts })}
              />
              {formError && (
                <p className="svr-form-error" role="alert">
                  <AlertCircle size={14} />
                  {formError}
                </p>
              )}
              <div className="svr-dialog-actions">
                <button
                  type="button"
                  className="secondary-action"
                  disabled={submitting}
                  onClick={() => setEditor(undefined)}
                >
                  取消
                </button>
                <button type="submit" className="primary-action" disabled={submitting}>
                  {submitting && <LoaderCircle size={15} className="spin" />}
                  {submitting ? '保存中…' : editor.id ? '保存修改' : '添加服务器'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteServer && (
        <div
          className="svr-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) setDeleteServer(undefined);
          }}
        >
          <section
            className="svr-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="svr-delete-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="svr-dialog-header">
              <div>
                <span className="svr-dialog-eyebrow svr-dialog-eyebrow-danger">删除服务器</span>
                <h2 id="svr-delete-title">确认删除</h2>
              </div>
              <button
                ref={deleteCloseRef}
                type="button"
                className="icon-button"
                aria-label="关闭删除确认"
                title="关闭"
                disabled={deleting}
                onClick={() => setDeleteServer(undefined)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="svr-delete-entry">
              <strong>{deleteServer.name}</strong>
              <code>{deleteServer.baseUrl}</code>
              <p>删除后会同时清理该服务器在本机的网页登录态和缓存。</p>
            </div>
            {deleteError && (
              <p className="svr-form-error" role="alert">
                <AlertCircle size={14} />
                {deleteError}
              </p>
            )}
            <div className="svr-dialog-actions">
              <button
                type="button"
                className="secondary-action"
                disabled={deleting}
                onClick={() => setDeleteServer(undefined)}
              >
                取消
              </button>
              <button
                ref={deleteConfirmRef}
                type="button"
                className="svr-danger-action"
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting && <LoaderCircle size={15} className="spin" />}
                {deleting ? '删除中…' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ServerCard({
  server,
  clearing,
  onOpen,
  onEdit,
  onDelete,
  onClearSession,
  onOpenShortcut,
}: {
  server: Sub2ApiServer;
  clearing: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClearSession: () => void;
  onOpenShortcut: (shortcut: Sub2ApiShortcut) => void;
}) {
  const hostname = new URL(server.baseUrl).hostname;
  return (
    <article className="svr-target-card">
      <button type="button" className="svr-target-open" onClick={onOpen}>
        <span className="svr-target-card-icon" aria-hidden="true">
          <Server size={22} />
        </span>
        <span className="svr-target-card-copy">
          <strong>{server.name}</strong>
          <small>{hostname}</small>
          <span className={`svr-login-state is-${server.loginState}`}>
            {loginStateLabel(server.loginState)}
          </span>
        </span>
        <ArrowUpRight className="svr-target-card-arrow" size={18} aria-hidden="true" />
      </button>
      <div className="svr-card-actions">
        <button type="button" aria-label={`编辑 ${server.name}`} title="编辑" onClick={onEdit}>
          <Pencil size={16} />
        </button>
        <button
          type="button"
          aria-label={`清除 ${server.name} 登录状态`}
          title="清除登录状态并重新登录"
          disabled={clearing}
          onClick={onClearSession}
        >
          {clearing ? <LoaderCircle size={16} className="spin" /> : <LogOut size={16} />}
        </button>
        <button
          type="button"
          aria-label={`删除 ${server.name}`}
          title="删除"
          className="danger"
          onClick={onDelete}
        >
          <Trash2 size={16} />
        </button>
      </div>
      {server.shortcuts.length > 0 && (
        <div className="svr-card-shortcuts" aria-label="快捷入口">
          {server.shortcuts.map((shortcut) => {
            const Icon = shortcutIconFor(shortcut.icon);
            return (
              <button
                type="button"
                key={shortcut.id}
                title={shortcut.label}
                onClick={() => onOpenShortcut(shortcut)}
              >
                <Icon size={14} aria-hidden="true" />
                <span>{shortcut.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}

function ShortcutEditor({
  shortcuts,
  onChange,
}: {
  shortcuts: ShortcutDraft[];
  onChange: (shortcuts: ShortcutDraft[]) => void;
}) {
  const addShortcut = () => {
    if (shortcuts.length >= SUB2API_SERVER_SHORTCUT_LIMIT) return;
    onChange([...shortcuts, { label: '', path: '', icon: 'Users' }]);
  };
  const updateShortcut = (index: number, patch: Partial<ShortcutDraft>) =>
    onChange(
      shortcuts.map((shortcut, shortcutIndex) =>
        shortcutIndex === index ? { ...shortcut, ...patch } : shortcut,
      ),
    );
  const removeShortcut = (index: number) =>
    onChange(shortcuts.filter((_, shortcutIndex) => shortcutIndex !== index));
  const moveShortcut = (index: number, direction: -1 | 1) => {
    const next = [...shortcuts];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };
  return (
    <fieldset className="svr-shortcut-editor">
      <legend>快捷入口（最多 {SUB2API_SERVER_SHORTCUT_LIMIT} 个）</legend>
      {shortcuts.length === 0 && <span className="svr-shortcut-empty">还没有快捷入口</span>}
      <div className="svr-shortcut-list">
        {shortcuts.map((shortcut, index) => (
          <div className="svr-shortcut-row" key={shortcut.id ?? `draft-${index}`}>
            <GripVertical size={14} aria-hidden="true" />
            <label className="svr-field">
              名称
              <input
                value={shortcut.label}
                maxLength={40}
                onChange={(event) => updateShortcut(index, { label: event.target.value })}
              />
            </label>
            <label className="svr-field">
              路径
              <input
                value={shortcut.path}
                maxLength={500}
                placeholder="/account"
                onChange={(event) => updateShortcut(index, { path: event.target.value })}
              />
            </label>
            <label className="svr-field svr-shortcut-icon-field">
              图标
              <select
                value={shortcut.icon ?? 'Users'}
                onChange={(event) => updateShortcut(index, { icon: event.target.value })}
              >
                {shortcutIconOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="svr-shortcut-row-actions">
              <button
                type="button"
                aria-label="上移快捷入口"
                title="上移"
                onClick={() => moveShortcut(index, -1)}
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                aria-label="下移快捷入口"
                title="下移"
                onClick={() => moveShortcut(index, 1)}
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                aria-label="删除快捷入口"
                title="删除"
                className="danger"
                onClick={() => removeShortcut(index)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="svr-shortcut-add"
        disabled={shortcuts.length >= SUB2API_SERVER_SHORTCUT_LIMIT}
        onClick={addShortcut}
      >
        <Plus size={14} aria-hidden="true" />
        添加快捷入口
      </button>
      <p className="svr-shortcut-hint">路径必须指向当前服务器同源地址，例如 /account</p>
    </fieldset>
  );
}

function trapDialogFocus(event: KeyboardEvent, dialog: HTMLElement): void {
  if (event.key !== 'Tab') return;
  const focusable = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
  if (!focusable.length) return;
  const first = focusable[0]!;
  const last = focusable.at(-1)!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function shortcutIconFor(icon: string | undefined): typeof Users {
  return shortcutIconOptions.find((option) => option.value === icon)?.Icon ?? Users;
}

function loginStateLabel(state: Sub2ApiServer['loginState']): string {
  if (state === 'logged-in') return '已登录';
  if (state === 'please-login') return '请登录';
  if (state === 'expired') return '登录过期';
  return '状态未知';
}

function serverErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (raw.includes('SUB2API_SERVER_DUPLICATE_NAME') || raw.includes('SUB2API_SERVER_DUPLICATE_URL'))
    return '服务器名称或地址已存在';
  if (raw.includes('SUB2API_SERVER_LIMIT_REACHED'))
    return `最多可添加 ${SUB2API_SERVER_LIMIT} 个服务器`;
  if (raw.includes('SUB2API_SERVER_NOT_FOUND')) return '服务器不存在或已被删除';
  return raw || '操作失败，请稍后重试';
}
