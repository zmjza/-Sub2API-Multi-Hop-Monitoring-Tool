import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Globe,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  FAVORITE_WEBSITE_LIMIT,
  isPermanentlyBlockedUrl,
  isUrlAllowedByPolicy,
  parseCustomAllowRule,
  type FavoriteWebsite,
  type FavoriteWebsiteEmbedState,
  type FavoriteWebsiteInput,
  type FavoriteWebsitesPolicy,
} from '../../../../electron/shared/favorite-websites';
import './favorite-websites.css';

type FavoriteWebsitesPageProps = {
  embedState: FavoriteWebsiteEmbedState;
  onOpen: (website: FavoriteWebsite) => void;
};

type ListState = {
  status: 'loading' | 'error' | 'ready';
  websites: FavoriteWebsite[];
  message?: string;
};

type SiteDraft = {
  id?: string;
  name: string;
  url: string;
};

type RuleDraft = {
  id?: string;
  label: string;
  pattern: string;
  description: string;
  enabled: boolean;
};

const initialRuleDraft: RuleDraft = {
  label: '',
  pattern: '',
  description: '',
  enabled: true,
};

function errorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('FAVORITE_WEBSITE_DUPLICATE_NAME')) return '网站名称已存在';
  if (message.includes('FAVORITE_WEBSITE_DUPLICATE_URL')) return '网站地址已存在';
  if (message.includes('FAVORITE_WEBSITE_LIMIT_REACHED'))
    return '最多可添加 ' + FAVORITE_WEBSITE_LIMIT + ' 个常用网站';
  if (message.includes('FAVORITE_WEBSITE_POLICY_BLOCKED'))
    return '当前地址支持规则不允许打开该网站';
  if (message.includes('FAVORITE_WEBSITE_BLOCKED_URL')) return '网站地址包含危险协议或格式无效';
  if (message.includes('FAVORITE_WEBSITE_NOT_FOUND')) return '常用网站不存在';
  if (message.includes('BRIDGE_UNAVAILABLE')) return '常用网站服务不可用，请重新打开应用';
  return fallback;
}

function validateSiteDraft(draft: SiteDraft, websites: FavoriteWebsite[]): string | undefined {
  const name = draft.name.trim();
  const url = draft.url.trim();
  if (!name) return '请输入网站名称';
  if (name.length > 80) return '网站名称不能超过 80 个字符';
  if (!url) return '请输入网站地址';
  if (url.length > 500) return '网站地址不能超过 500 个字符';
  if (isPermanentlyBlockedUrl(url))
    return '网站地址必须是完整的 HTTP 或 HTTPS 地址，不能包含用户名密码或危险协议';
  let normalized: string;
  try {
    normalized = new URL(url).toString();
  } catch {
    return '网站地址格式无效';
  }
  if (websites.some((website) => website.name.trim() === name && website.id !== draft.id))
    return '网站名称已存在';
  if (websites.some((website) => website.url === normalized && website.id !== draft.id))
    return '网站地址已存在';
  if (!draft.id && websites.length >= FAVORITE_WEBSITE_LIMIT)
    return '最多可添加 ' + FAVORITE_WEBSITE_LIMIT + ' 个常用网站';
  return undefined;
}

function validateRuleDraft(
  draft: RuleDraft,
  rules: FavoriteWebsitesPolicy['customRules'],
): string | undefined {
  const label = draft.label.trim();
  const pattern = draft.pattern.trim();
  if (!label) return '请输入规则名称';
  if (label.length > 40) return '规则名称不能超过 40 个字符';
  if (!pattern) return '请输入规则内容';
  if (parseCustomAllowRule(pattern) === undefined)
    return '规则内容无效，仅支持 HTTP/HTTPS 域名、通配子域名、IP、端口和路径前缀';
  if (rules.some((rule) => rule.label.trim() === label && rule.id !== draft.id))
    return '规则名称已存在';
  const normalizedPattern = pattern.toLocaleLowerCase();
  if (
    rules.some(
      (rule) => rule.pattern.toLocaleLowerCase() === normalizedPattern && rule.id !== draft.id,
    )
  )
    return '规则内容已存在';
  return undefined;
}

function blockedWebsiteIds(
  websites: FavoriteWebsite[],
  policy: FavoriteWebsitesPolicy | undefined,
): Set<string> {
  if (!policy) return new Set();
  return new Set(
    websites
      .filter((website) => !isUrlAllowedByPolicy(website.url, policy))
      .map((website) => website.id),
  );
}

export function FavoriteWebsitesPage({ embedState, onOpen }: FavoriteWebsitesPageProps) {
  const [listState, setListState] = useState<ListState>({ status: 'loading', websites: [] });
  const [policy, setPolicy] = useState<FavoriteWebsitesPolicy>();
  const [siteEditor, setSiteEditor] = useState<SiteDraft | undefined>();
  const [deleteWebsite, setDeleteWebsite] = useState<FavoriteWebsite>();
  const [siteError, setSiteError] = useState<string>();
  const [siteSubmitting, setSiteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyDraft, setPolicyDraft] = useState<FavoriteWebsitesPolicy>();
  const [ruleEditor, setRuleEditor] = useState<RuleDraft | undefined>();
  const [policyError, setPolicyError] = useState<string>();
  const [policySubmitting, setPolicySubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const deleteCloseRef = useRef<HTMLButtonElement>(null);
  const policyCloseRef = useRef<HTMLButtonElement>(null);

  const loadWebsites = useCallback(async () => {
    setListState((current) => ({ ...current, status: 'loading' }));
    try {
      const bridge = window.sub2apiDesktop?.favoriteWebsites;
      if (!bridge) throw new Error('FAVORITE_WEBSITE_BRIDGE_UNAVAILABLE');
      const [websites, nextPolicy] = await Promise.all([bridge.list(), bridge.policy()]);
      setListState({ status: 'ready', websites });
      setPolicy(nextPolicy);
    } catch (error) {
      setListState({
        status: 'error',
        websites: [],
        message: errorMessage(error, '常用网站加载失败，请稍后重试'),
      });
    }
  }, []);

  useEffect(() => {
    void loadWebsites();
  }, [loadWebsites]);

  const blockedIds = blockedWebsiteIds(listState.websites, policy);

  const openSiteEditor = (website?: FavoriteWebsite) => {
    if (siteSubmitting) return;
    setSiteEditor(
      website ? { id: website.id, name: website.name, url: website.url } : { name: '', url: '' },
    );
    setSiteError(undefined);
  };

  const submitSite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!siteEditor || siteSubmitting) return;
    const validationError = validateSiteDraft(siteEditor, listState.websites);
    if (validationError) {
      setSiteError(validationError);
      return;
    }
    setSiteSubmitting(true);
    setSiteError(undefined);
    try {
      const bridge = window.sub2apiDesktop?.favoriteWebsites;
      if (!bridge) throw new Error('FAVORITE_WEBSITE_BRIDGE_UNAVAILABLE');
      const input: FavoriteWebsiteInput = {
        name: siteEditor.name.trim(),
        url: siteEditor.url.trim(),
      };
      const websites = siteEditor.id
        ? await bridge.update({ id: siteEditor.id, ...input })
        : await bridge.create(input);
      setListState({ status: 'ready', websites });
      setSiteEditor(undefined);
      addButtonRef.current?.focus();
    } catch (error) {
      setSiteError(errorMessage(error, '保存网站失败，请稍后重试'));
    } finally {
      setSiteSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteWebsite || deleteSubmitting) return;
    setDeleteSubmitting(true);
    setDeleteError(undefined);
    try {
      const bridge = window.sub2apiDesktop?.favoriteWebsites;
      if (!bridge) throw new Error('FAVORITE_WEBSITE_BRIDGE_UNAVAILABLE');
      const websites = await bridge.delete(deleteWebsite.id);
      setListState({ status: 'ready', websites });
      setDeleteWebsite(undefined);
      addButtonRef.current?.focus();
    } catch (error) {
      setDeleteError(errorMessage(error, '删除网站失败，请稍后重试'));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openPolicyEditor = async () => {
    if (!policy) return;
    setPolicyDraft({ ...policy, customRules: policy.customRules.map((rule) => ({ ...rule })) });
    setRuleEditor(undefined);
    setPolicyError(undefined);
    setPolicyOpen(true);
  };

  const submitPolicy = async () => {
    if (!policyDraft || policySubmitting || ruleEditor) return;
    setPolicySubmitting(true);
    setPolicyError(undefined);
    try {
      const bridge = window.sub2apiDesktop?.favoriteWebsites;
      if (!bridge) throw new Error('FAVORITE_WEBSITE_BRIDGE_UNAVAILABLE');
      const nextPolicy = await bridge.savePolicy(policyDraft);
      setPolicy(nextPolicy);
      setPolicyOpen(false);
      const websites = await bridge.list();
      setListState({ status: 'ready', websites });
    } catch (error) {
      setPolicyError(errorMessage(error, '保存地址支持规则失败，请稍后重试'));
    } finally {
      setPolicySubmitting(false);
    }
  };

  const saveRule = (draft: RuleDraft) => {
    if (!policyDraft) return;
    const validationError = validateRuleDraft(draft, policyDraft.customRules);
    if (validationError) {
      setPolicyError(validationError);
      return;
    }
    const now = Date.now();
    const rule = draft.id
      ? {
          id: draft.id,
          label: draft.label.trim(),
          pattern: draft.pattern.trim(),
          description: draft.description.trim() || undefined,
          enabled: draft.enabled,
          createdAt: policyDraft.customRules.find((item) => item.id === draft.id)?.createdAt ?? now,
          updatedAt: now,
        }
      : {
          id: 'rule-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          label: draft.label.trim(),
          pattern: draft.pattern.trim(),
          description: draft.description.trim() || undefined,
          enabled: draft.enabled,
          createdAt: now,
          updatedAt: now,
        };
    setPolicyDraft({
      ...policyDraft,
      customRules: draft.id
        ? policyDraft.customRules.map((item) => (item.id === draft.id ? rule : item))
        : [...policyDraft.customRules, rule],
    });
    setRuleEditor(undefined);
    setPolicyError(undefined);
  };

  if (embedState.status === 'error')
    return (
      <div className="fav-page fav-page-state" data-fav-state="error">
        <div className="fav-state-icon" aria-hidden="true">
          <Globe size={22} />
        </div>
        <h1>常用网站暂时无法加载</h1>
        <p>{embedState.message}</p>
        <span>请点击右上角关闭图标返回常用网站列表。</span>
      </div>
    );

  if (embedState.status === 'opening')
    return (
      <div className="fav-page fav-page-state" data-fav-state="opening" role="status">
        <div className="fav-state-icon fav-state-icon-loading" aria-hidden="true">
          <LoaderCircle size={22} />
        </div>
        <h1>正在打开 {embedState.target.label}</h1>
        <p>网页将在当前 Electron 窗口内显示。</p>
      </div>
    );

  if (embedState.status === 'open' || embedState.status === 'blocked')
    return (
      <div
        className="fav-page fav-page-state"
        data-fav-state={embedState.status}
        aria-hidden="true"
      >
        <div className="fav-state-icon" aria-hidden="true">
          {embedState.status === 'open' ? <Globe size={22} /> : <ShieldCheck size={22} />}
        </div>
        <h1>{embedState.target.label}</h1>
        {embedState.status === 'blocked' && <p>{embedState.message}</p>}
      </div>
    );

  return (
    <div className="fav-page" data-fav-state="idle">
      <header className="fav-heading">
        <div>
          <p className="fav-eyebrow">
            <Globe size={15} aria-hidden="true" /> 常用网站
          </p>
          <h1>常用网站</h1>
          <p className="fav-subtitle">保存并打开在线网站、本机服务或局域网页面</p>
        </div>
        <div className="fav-heading-actions">
          <button
            type="button"
            className="secondary-action fav-edit-button"
            onClick={() => void openPolicyEditor()}
          >
            编辑
          </button>
          <button
            type="button"
            ref={addButtonRef}
            className="primary-action fav-add-button"
            onClick={() => openSiteEditor()}
          >
            <Plus size={16} aria-hidden="true" />
            新增网站
          </button>
        </div>
      </header>

      {listState.status === 'loading' && (
        <section className="fav-list-state" data-fav-list-state="loading" role="status">
          <LoaderCircle className="fav-loading-icon" size={24} aria-hidden="true" />
          <span>正在加载常用网站</span>
        </section>
      )}

      {listState.status === 'error' && (
        <section className="fav-list-state fav-list-error" data-fav-list-state="error">
          <AlertCircle size={24} aria-hidden="true" />
          <h2>常用网站加载失败</h2>
          <p>{listState.message ?? '请稍后重试。'}</p>
          <button type="button" className="secondary-action" onClick={() => void loadWebsites()}>
            <RefreshCw size={15} aria-hidden="true" />
            重试
          </button>
        </section>
      )}

      {listState.status === 'ready' && listState.websites.length === 0 && (
        <section className="fav-list-state fav-empty" data-fav-list-state="empty">
          <span className="fav-empty-icon" aria-hidden="true">
            <Globe size={24} />
          </span>
          <h2>还没有常用网站</h2>
          <p>新增一个 HTTP 或 HTTPS 网站后即可在应用内打开。</p>
          <button type="button" className="primary-action" onClick={() => openSiteEditor()}>
            <Plus size={16} aria-hidden="true" />
            新增网站
          </button>
        </section>
      )}

      {listState.status === 'ready' && listState.websites.length > 0 && (
        <section className="fav-target-grid" aria-label="常用网站">
          {listState.websites.map((website) => {
            const blocked = blockedIds.has(website.id);
            return (
              <article
                className={blocked ? 'fav-target-card is-blocked' : 'fav-target-card'}
                key={website.id}
              >
                <button
                  type="button"
                  className="fav-target-open"
                  aria-label={'打开 ' + website.name}
                  disabled={blocked}
                  onClick={() => onOpen(website)}
                >
                  <span className="fav-target-card-icon" aria-hidden="true">
                    <Globe size={22} />
                  </span>
                  <span className="fav-target-card-copy">
                    <strong>{website.name}</strong>
                    <small>{website.url}</small>
                    {blocked && <span className="fav-blocked-badge">当前规则不支持</span>}
                  </span>
                  <ArrowUpRight className="fav-target-card-arrow" size={20} aria-hidden="true" />
                </button>
                <div className="fav-card-actions">
                  <button
                    type="button"
                    aria-label={'编辑 ' + website.name}
                    title="编辑网站"
                    onClick={() => openSiteEditor(website)}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="danger"
                    aria-label={'删除 ' + website.name}
                    title="删除网站"
                    onClick={() => {
                      setDeleteWebsite(website);
                      setDeleteError(undefined);
                    }}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {siteEditor && (
        <div
          className="fav-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !siteSubmitting) setSiteEditor(undefined);
          }}
        >
          <section
            className="fav-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fav-site-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="fav-dialog-header">
              <div>
                <span className="fav-dialog-eyebrow">常用网站</span>
                <h2 id="fav-site-title">{siteEditor.id ? '编辑网站' : '新增网站'}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="关闭网站弹窗"
                title="关闭"
                disabled={siteSubmitting}
                onClick={() => setSiteEditor(undefined)}
              >
                <X size={18} />
              </button>
            </header>
            <form className="fav-editor-form" onSubmit={(event) => void submitSite(event)}>
              <label className="fav-field">
                名称
                <input
                  ref={nameInputRef}
                  value={siteEditor.name}
                  maxLength={80}
                  placeholder="例如：本地面板"
                  onChange={(event) => setSiteEditor({ ...siteEditor, name: event.target.value })}
                />
              </label>
              <label className="fav-field">
                网站地址
                <input
                  value={siteEditor.url}
                  maxLength={500}
                  placeholder="https://example.com 或 http://localhost:3000"
                  onChange={(event) => setSiteEditor({ ...siteEditor, url: event.target.value })}
                />
              </label>
              {siteError && (
                <p className="fav-form-error" role="alert">
                  <AlertCircle size={14} />
                  {siteError}
                </p>
              )}
              <div className="fav-dialog-actions">
                <button
                  type="button"
                  className="secondary-action"
                  disabled={siteSubmitting}
                  onClick={() => setSiteEditor(undefined)}
                >
                  取消
                </button>
                <button type="submit" className="primary-action" disabled={siteSubmitting}>
                  {siteSubmitting && <LoaderCircle size={15} className="spin" />}
                  {siteSubmitting ? '保存中…' : siteEditor.id ? '保存修改' : '添加网站'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteWebsite && (
        <div
          className="fav-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleteSubmitting)
              setDeleteWebsite(undefined);
          }}
        >
          <section
            className="fav-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fav-delete-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="fav-dialog-header">
              <div>
                <span className="fav-dialog-eyebrow fav-dialog-eyebrow-danger">删除网站</span>
                <h2 id="fav-delete-title">确认删除</h2>
              </div>
              <button
                ref={deleteCloseRef}
                type="button"
                className="icon-button"
                aria-label="关闭删除确认"
                title="关闭"
                disabled={deleteSubmitting}
                onClick={() => setDeleteWebsite(undefined)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="fav-delete-entry">
              <strong>{deleteWebsite.name}</strong>
              <code>{deleteWebsite.url}</code>
              <p>删除后会同时清理该网站在本机的登录态和缓存。</p>
            </div>
            {deleteError && (
              <p className="fav-form-error" role="alert">
                <AlertCircle size={14} />
                {deleteError}
              </p>
            )}
            <div className="fav-dialog-actions">
              <button
                type="button"
                className="secondary-action"
                disabled={deleteSubmitting}
                onClick={() => setDeleteWebsite(undefined)}
              >
                取消
              </button>
              <button
                type="button"
                className="primary-action fav-danger-action"
                disabled={deleteSubmitting}
                onClick={() => void confirmDelete()}
              >
                {deleteSubmitting && <LoaderCircle size={15} className="spin" />}
                {deleteSubmitting ? '删除中…' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      )}

      {policyOpen && policyDraft && (
        <div
          className="fav-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !policySubmitting && !ruleEditor)
              setPolicyOpen(false);
          }}
        >
          <section
            className="fav-dialog fav-policy-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fav-policy-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="fav-dialog-header">
              <div>
                <span className="fav-dialog-eyebrow">地址支持规则</span>
                <h2 id="fav-policy-title">编辑常用网站地址支持</h2>
                <p>关闭某项后，新添加或打开网站会重新校验；已保存的网站不会自动删除。</p>
              </div>
              <button
                ref={policyCloseRef}
                type="button"
                className="icon-button"
                aria-label="关闭规则编辑弹窗"
                title="关闭"
                disabled={policySubmitting}
                onClick={() => {
                  if (!ruleEditor) setPolicyOpen(false);
                }}
              >
                <X size={18} />
              </button>
            </header>
            <div className="fav-policy-section">
              <h3>地址类型</h3>
              <div className="fav-policy-toggles">
                {(
                  [
                    ['http', 'HTTP 网站'],
                    ['https', 'HTTPS 网站'],
                    ['localhost', 'localhost 本机域名'],
                    ['loopback', '127.0.0.1 回环地址'],
                    ['lanIp', '局域网 IP'],
                    ['publicDomain', '公网域名'],
                    ['nonStandardPorts', '非标准端口'],
                  ] as const
                ).map(([key, label]) => (
                  <label className="fav-checkbox" key={key}>
                    <input
                      type="checkbox"
                      checked={policyDraft[key]}
                      onChange={(event) =>
                        setPolicyDraft({ ...policyDraft, [key]: event.target.checked })
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="fav-policy-section">
              <h3>自定义允许规则</h3>
              <p className="fav-policy-hint">
                支持精确域名、通配子域名、IP、端口和路径前缀。危险协议永久禁止，不能通过自定义规则打开。
              </p>
              {policyDraft.customRules.length > 0 && (
                <ul className="fav-rule-list">
                  {policyDraft.customRules.map((rule) => (
                    <li
                      className={rule.enabled ? 'fav-rule-item' : 'fav-rule-item is-disabled'}
                      key={rule.id}
                    >
                      <div className="fav-rule-copy">
                        <strong>{rule.label}</strong>
                        <code>{rule.pattern}</code>
                        {rule.description && <small>{rule.description}</small>}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPolicyDraft({
                            ...policyDraft,
                            customRules: policyDraft.customRules.map((item) =>
                              item.id === rule.id ? { ...item, enabled: !item.enabled } : item,
                            ),
                          })
                        }
                      >
                        {rule.enabled ? '停用' : '启用'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRuleEditor({
                            id: rule.id,
                            label: rule.label,
                            pattern: rule.pattern,
                            description: rule.description ?? '',
                            enabled: rule.enabled,
                          })
                        }
                      >
                        <Pencil size={15} aria-hidden="true" /> 编辑
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          setPolicyDraft({
                            ...policyDraft,
                            customRules: policyDraft.customRules.filter(
                              (item) => item.id !== rule.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={15} aria-hidden="true" /> 删除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setRuleEditor({ ...initialRuleDraft });
                  setPolicyError(undefined);
                }}
              >
                <Plus size={15} aria-hidden="true" /> 新增规则
              </button>
              {ruleEditor && (
                <div className="fav-rule-editor">
                  <label className="fav-field">
                    规则名称
                    <input
                      value={ruleEditor.label}
                      maxLength={40}
                      onChange={(event) =>
                        setRuleEditor({ ...ruleEditor, label: event.target.value })
                      }
                    />
                  </label>
                  <label className="fav-field">
                    规则内容
                    <input
                      value={ruleEditor.pattern}
                      maxLength={500}
                      placeholder="example.com、*.example.com、192.168.1.20:8080"
                      onChange={(event) =>
                        setRuleEditor({ ...ruleEditor, pattern: event.target.value })
                      }
                    />
                  </label>
                  <label className="fav-field">
                    备注
                    <input
                      value={ruleEditor.description}
                      maxLength={200}
                      onChange={(event) =>
                        setRuleEditor({ ...ruleEditor, description: event.target.value })
                      }
                    />
                  </label>
                  <label className="fav-checkbox">
                    <input
                      type="checkbox"
                      checked={ruleEditor.enabled}
                      onChange={(event) =>
                        setRuleEditor({ ...ruleEditor, enabled: event.target.checked })
                      }
                    />
                    <span>启用这条规则</span>
                  </label>
                  <div className="fav-rule-editor-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => setRuleEditor(undefined)}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      className="primary-action"
                      onClick={() => saveRule(ruleEditor)}
                    >
                      保存规则
                    </button>
                  </div>
                </div>
              )}
            </div>
            {policyError && (
              <p className="fav-form-error" role="alert">
                <AlertCircle size={14} />
                {policyError}
              </p>
            )}
            <div className="fav-dialog-actions">
              <button
                type="button"
                className="secondary-action"
                disabled={policySubmitting}
                onClick={() => {
                  if (!ruleEditor) setPolicyOpen(false);
                }}
              >
                取消
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={policySubmitting || Boolean(ruleEditor)}
                onClick={() => void submitPolicy()}
              >
                {policySubmitting && <LoaderCircle size={15} className="spin" />}
                {policySubmitting ? '保存中…' : '保存规则'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
