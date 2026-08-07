import { useEffect, useRef, useState } from 'react';
import { Check, Circle, Globe2, LoaderCircle, Plus, ShieldCheck, X } from 'lucide-react';
import type { SitesProps } from './types';
import type {
  InteractiveVerificationProvider,
  SiteInput,
  SiteSummary,
} from '../../../../electron/shared/contracts';
import { safeRendererError, useNotifications } from '../../notifications';
import { siteDrafts } from './data';
import './sites.css';

export function siteTaskSummary(submitting: boolean, sites: Array<{ status: string }>): string {
  if (submitting) return '验证中';
  return sites.length ? `${sites.length} 个站点` : '暂无任务';
}

export function batchProgressPercent(current: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(current)) return 0;
  return Math.min(100, Math.max(0, Math.round((current / total) * 100)));
}

interface BatchTask {
  url: string;
  status: 'success' | 'failed' | 'pending';
  error?: string;
  site?: SiteSummary;
}

export function SitesPage(props: SitesProps) {
  const { dismiss, notify } = useNotifications();
  const draft = siteDrafts[0];
  const runtime = Boolean(window.sub2apiDesktop);
  const [name, setName] = useState(runtime ? '' : draft.name);
  const [url, setUrl] = useState(runtime ? '' : draft.url);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [batchUrls, setBatchUrls] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submissionMode, setSubmissionMode] = useState<'single' | 'batch'>('single');
  const [validationPhase, setValidationPhase] = useState('等待开始');
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchPhase, setBatchPhase] = useState('等待开始');
  const [batchCurrentUrl, setBatchCurrentUrl] = useState('');
  const [batchResults, setBatchResults] = useState<BatchTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<BatchTask>();
  const [pendingVerification, setPendingVerification] = useState<
    | { mode: 'add'; input: SiteInput; provider: InteractiveVerificationProvider }
    | { mode: 'reauth'; siteId: string; provider: InteractiveVerificationProvider }
  >();
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const closeVerifyButtonRef = useRef<HTMLButtonElement>(null);
  const cancelVerifyButtonRef = useRef<HTMLButtonElement>(null);
  const verifyButtonRef = useRef<HTMLButtonElement>(null);
  const detailCloseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const unsubscribePhase = window.sub2apiDesktop?.sites.onRefreshState((value) => {
      if (!submitting || submissionMode !== 'single' || value.state !== 'refreshing') return;
      setValidationPhase(validationPhaseLabel(value.phase));
    });
    const unsubscribeBatch = window.sub2apiDesktop?.sites.onBatchProgress((value) => {
      if (!submitting || submissionMode !== 'batch') return;
      const current = Math.min(Math.max(value.current, 0), Math.max(value.total, 0));
      setBatchProgress({ current, total: Math.max(value.total, 0) });
      setBatchCurrentUrl(value.url);
      setBatchPhase(
        value.total > 0 && current >= value.total
          ? '全部完成'
          : value.status === 'success'
            ? '已完成当前站点'
            : '当前站点失败，继续处理',
      );
      setBatchResults((current) => [
        ...current.filter((item) => item.url !== value.url),
        { url: value.url, status: value.status, error: value.error },
      ]);
    });
    return () => {
      unsubscribePhase?.();
      unsubscribeBatch?.();
    };
  }, [submitting, submissionMode]);
  useEffect(() => {
    if (!pendingVerification) return;
    verifyButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelInteractiveVerification();
        return;
      }
      if (event.key !== 'Tab') return;
      const close = closeVerifyButtonRef.current;
      const cancel = cancelVerifyButtonRef.current;
      const verify = verifyButtonRef.current;
      if (!close || !cancel || !verify) return;
      const focusables = [close, cancel, verify];
      const currentIndex = focusables.indexOf(document.activeElement as HTMLButtonElement);
      if (currentIndex < 0) return;
      /* Keep keyboard focus inside the modal while the provider is pending. */
      event.preventDefault();
      const nextIndex =
        (currentIndex + (event.shiftKey ? -1 : 1) + focusables.length) % focusables.length;
      focusables[nextIndex]?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [notify, pendingVerification]);
  useEffect(() => {
    if (!selectedTask) return;
    detailCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedTask(undefined);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedTask]);

  const finishSiteAdd = () => {
    setValidationPhase('验证完成');
    setPassword('');
    notify({ id: 'site-add', kind: 'success', message: '站点验证成功，已添加' });
    window.dispatchEvent(new Event('sub2api:refresh'));
  };

  const cancelInteractiveVerification = () => {
    const wasReauthentication = pendingVerification?.mode === 'reauth';
    setPendingVerification(undefined);
    setValidationPhase('等待开始');
    notify({
      id: 'site-add',
      kind: 'info',
      message: wasReauthentication ? '已取消重新验证，站点未修改' : '已暂不添加站点',
    });
    window.setTimeout(() => submitButtonRef.current?.focus(), 0);
  };

  const startInteractiveVerification = async () => {
    const pending = pendingVerification;
    if (!pending || submitting) return;
    setPendingVerification(undefined);
    setSubmitting(true);
    setValidationPhase('等待安全验证');
    notify({
      id: 'site-add',
      kind: 'loading',
      message:
        pending.provider === 'turnstile'
          ? '请在 Google Chrome 登录窗口完成人机验证和账号登录…'
          : '请在官方登录窗口完成人机验证…',
    });
    try {
      if (pending.mode === 'add') {
        const result = await window.sub2apiDesktop?.sites.addWithInteractiveVerification(
          pending.input,
          pending.provider,
        );
        if (!result || result.status !== 'added') throw new Error('站点验证未完成');
        finishSiteAdd();
      } else {
        const result = await window.sub2apiDesktop?.sites.reverify(pending.siteId);
        if (!result) throw new Error('站点重新验证未完成');
        setValidationPhase('验证完成');
        notify({ id: 'site-add', kind: 'success', message: '安全验证成功，站点已恢复' });
        window.dispatchEvent(new Event('sub2api:refresh'));
      }
    } catch (error) {
      if (shouldKeepInteractiveVerificationPrompt(error)) setPendingVerification(pending);
      const message = safeRendererError(error, '站点验证失败，请稍后重试');
      notify({
        id: 'site-add',
        kind: message.startsWith('已取消') ? 'info' : 'error',
        message,
      });
    } finally {
      setSubmitting(false);
      window.setTimeout(() => submitButtonRef.current?.focus(), 0);
    }
  };
  const beginSiteReverification = (site: {
    id: string;
    status: string;
    interactiveVerificationProvider?: InteractiveVerificationProvider;
  }) => {
    if (submitting || site.status !== 'auth-required') return;
    const provider = site.interactiveVerificationProvider;
    if (!provider) {
      notify({
        id: `site-reverify:${site.id}`,
        kind: 'error',
        message: '无法确认验证方式，请重新添加站点',
      });
      return;
    }
    setPendingVerification({ mode: 'reauth', siteId: site.id, provider });
  };
  return (
    <section className={`sites-shell state-${props.state}`}>
      <div className="sites-prototype-grid">
        <section className="site-entry-panel" id="site-settings">
          <div className="site-panel-heading">
            <h2>添加新站点</h2>
          </div>
          <div className="site-form-grid">
            <label>
              站点名称
              <input
                placeholder="例如: OpenAI 备用节点"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              API URL
              <input
                placeholder="https://api.example.com"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </label>
            <label>
              用户名
              <input value={account} onChange={(event) => setAccount(event.target.value)} />
            </label>
            <label>
              密码
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          </div>
          <details className="batch-entry">
            <summary>批量添加站点</summary>
            <label>
              每行一个站点网址
              <textarea
                value={batchUrls}
                onChange={(event) => setBatchUrls(event.target.value)}
                placeholder={'https://site-a.example\nhttps://site-b.example'}
              />
            </label>
            <button
              className="site-batch-button"
              disabled={submitting || !account || !password || !batchUrls.trim()}
              onClick={() => {
                const urls = [
                  ...new Set(
                    batchUrls
                      .split(/\r?\n/)
                      .map((value) => value.trim())
                      .filter(Boolean),
                  ),
                ];
                if (!urls.length) {
                  notify({
                    id: 'site-batch',
                    kind: 'warning',
                    message: '请至少输入一个有效站点地址',
                  });
                  setBatchPhase('输入无效');
                  return;
                }
                setSubmissionMode('batch');
                setSubmitting(true);
                setBatchProgress({ current: 0, total: urls.length });
                setBatchResults([]);
                setBatchCurrentUrl('');
                setBatchPhase('准备验证');
                notify({
                  id: 'site-batch',
                  kind: 'loading',
                  message: `正在批量验证 ${urls.length} 个站点…`,
                });
                const request = window.sub2apiDesktop?.sites.addBatch({ urls, account, password });
                if (!request) {
                  setBatchPhase('无法连接桌面服务');
                  notify({ id: 'site-batch', kind: 'error', message: '当前环境不支持批量验证' });
                  setSubmitting(false);
                  return;
                }
                void request
                  .then((result) => {
                    setBatchProgress({ current: urls.length, total: urls.length });
                    setBatchPhase('全部完成');
                    setBatchResults((current) =>
                      current.map((task) => {
                        const site = result.successes.find((candidate) =>
                          sameSiteOrigin(candidate.baseUrl, task.url),
                        );
                        return site ? { ...task, status: 'success', site } : task;
                      }),
                    );
                    notify({
                      id: 'site-batch',
                      kind: result.failures.length ? 'warning' : 'success',
                      message: `批量验证完成：成功 ${result.successes.length}，失败 ${result.failures.length}`,
                    });
                    if (!result.failures.length) {
                      setBatchUrls('');
                      setPassword('');
                    }
                  })
                  .catch((error: unknown) => {
                    setBatchPhase('验证中断');
                    notify({
                      id: 'site-batch',
                      kind: 'error',
                      message: safeRendererError(error, '批量验证失败'),
                    });
                  })
                  .finally(() => setSubmitting(false));
              }}
            >
              {submitting && submissionMode === 'batch' ? (
                <>
                  <LoaderCircle size={16} className="spin" /> 验证中 {batchProgress.current}/
                  {batchProgress.total}
                </>
              ) : (
                '批量验证并保存'
              )}
            </button>
            {batchProgress.total > 0 && (
              <div
                className={`batch-progress-panel ${submitting ? 'is-loading' : 'is-complete'}`}
                role="status"
                aria-live="polite"
                aria-label="批量验证进度"
              >
                <div className="batch-progress-heading">
                  <strong>{submitting ? '正在验证站点' : batchPhase}</strong>
                  <span>
                    {batchProgress.current}/{batchProgress.total}（
                    {batchProgressPercent(batchProgress.current, batchProgress.total)}%）
                  </span>
                </div>
                <div className="batch-progress">
                  <i
                    style={{
                      width: `${Math.min(100, (batchProgress.current / batchProgress.total) * 100)}%`,
                    }}
                  />
                </div>
                <div className="batch-progress-meta">
                  <span>{batchCurrentUrl || '正在准备任务…'}</span>
                  <span>
                    成功 {batchResults.filter((item) => item.status === 'success').length} · 失败{' '}
                    {batchResults.filter((item) => item.status === 'failed').length}
                  </span>
                </div>
              </div>
            )}
          </details>
          <div className="verification-steps" aria-label={`当前验证阶段：${validationPhase}`}>
            <div className={`step ${validationPhase !== '等待开始' ? 'complete' : ''}`}>
              <span>
                <Check size={18} />
              </span>
              <b>登录与连通性</b>
            </div>
            <i />
            <div className="step">
              <span>
                <Circle size={18} />
              </span>
              <b>额度与 Key</b>
            </div>
            <i />
            <div className="step muted-step">
              <span>
                <Circle size={18} />
              </span>
              <b>{validationPhase}</b>
            </div>
          </div>
          <button
            ref={submitButtonRef}
            className="site-submit-button"
            disabled={submitting || !name || !url || !account || !password}
            onClick={async () => {
              setSubmissionMode('single');
              setSubmitting(true);
              setValidationPhase('登录与连通性');
              notify({ id: 'site-add', kind: 'loading', message: '正在检测站点登录方式…' });
              const input = { name, url, account, password };
              try {
                const result = await window.sub2apiDesktop?.sites.addAndVerify(input);
                if (!result) throw new Error('桌面服务不可用');
                if (result.status === 'verification-required') {
                  dismiss('site-add');
                  setPendingVerification({ mode: 'add', input, provider: result.provider });
                  return;
                }
                finishSiteAdd();
              } catch (error) {
                notify({
                  id: 'site-add',
                  kind: 'error',
                  message: safeRendererError(error, '站点验证失败，请稍后重试'),
                });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting && submissionMode === 'single' ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Plus size={18} />
            )}
            {submitting ? '验证中…' : '添加并验证'}
          </button>
        </section>
        <div className="sites-lower-grid">
          <section className="site-table-panel site-task-panel">
            <div className="site-panel-heading">
              <h2>批量验证任务</h2>
              <span className="progress-pill">
                {siteTaskSummary(submitting, props.dashboard?.sites ?? [])}
              </span>
            </div>
            <div className="site-task-grid">
              {(batchResults.length
                ? batchResults
                : (props.dashboard?.sites ?? []).map(siteToBatchTask)
              ).map((task) => (
                <button
                  type="button"
                  className="site-task-card"
                  key={task.site?.id ?? `batch-${task.url}`}
                  onClick={() => setSelectedTask(task)}
                  aria-label={`查看 ${task.site?.name ?? safeHostName(task.url)} 验证详情`}
                >
                  <span className="site-task-main">
                    <span className="site-task-icon" aria-hidden="true">
                      {task.site?.iconDataUrl ? (
                        <img src={task.site.iconDataUrl} alt="" />
                      ) : (
                        <Globe2 size={22} />
                      )}
                    </span>
                    <span className="site-task-copy">
                      <strong>{task.site?.name ?? safeHostName(task.url)}</strong>
                      <span className="site-task-url">{task.site?.baseUrl ?? task.url}</span>
                      <small>
                        {task.site?.accountLabel
                          ? `账号：${task.site.accountLabel}`
                          : '账号：等待验证结果'}
                      </small>
                    </span>
                  </span>
                  <span className="site-task-footer">
                    <span className="site-task-capability">
                      <ShieldCheck size={16} />
                      {task.error ?? capabilitySummary(task.site)}
                    </span>
                    <span className={`verify-tag ${task.status}`}>
                      <i aria-hidden="true" />
                      {taskStatusLabel(task)}
                    </span>
                  </span>
                </button>
              ))}
              {!batchResults.length && !props.dashboard?.sites.length && (
                <div className="site-task-empty">暂无批量验证任务</div>
              )}
            </div>
          </section>
        </div>
      </div>
      {selectedTask && (
        <div
          className="site-detail-backdrop"
          role="presentation"
          onMouseDown={() => setSelectedTask(undefined)}
        >
          <section
            className="site-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="site-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="site-detail-header">
              <span className="site-task-icon" aria-hidden="true">
                {selectedTask.site?.iconDataUrl ? (
                  <img src={selectedTask.site.iconDataUrl} alt="" />
                ) : (
                  <Globe2 size={22} />
                )}
              </span>
              <div>
                <h2 id="site-detail-title">
                  {selectedTask.site?.name ?? safeHostName(selectedTask.url)}
                </h2>
                <span>{selectedTask.site?.baseUrl ?? selectedTask.url}</span>
              </div>
              <button
                ref={detailCloseRef}
                type="button"
                className="site-detail-close"
                aria-label="关闭站点详情"
                title="关闭"
                onClick={() => setSelectedTask(undefined)}
              >
                <X size={18} />
              </button>
            </header>
            <dl className="site-detail-list">
              <div>
                <dt>验证状态</dt>
                <dd>{taskStatusLabel(selectedTask)}</dd>
              </div>
              <div>
                <dt>账号</dt>
                <dd>{selectedTask.site?.accountLabel ?? '未获取'}</dd>
              </div>
              <div>
                <dt>数据来源</dt>
                <dd>{selectedTask.site?.source ?? '批量任务'}</dd>
              </div>
              <div>
                <dt>核心能力</dt>
                <dd>{capabilitySummary(selectedTask.site)}</dd>
              </div>
              {selectedTask.error && (
                <div>
                  <dt>失败原因</dt>
                  <dd className="error-text">{selectedTask.error}</dd>
                </div>
              )}
            </dl>
            {selectedTask.site?.capabilities && (
              <div className="site-detail-capabilities" aria-label="能力验证详情">
                {Object.entries(selectedTask.site.capabilities).map(([name, status]) => (
                  <span key={name} className={status === 'error' ? 'failed' : 'success'}>
                    {name} · {status === 'error' ? '异常' : '可用'}
                  </span>
                ))}
              </div>
            )}
            {selectedTask.site && (
              <footer className="site-detail-actions">
                {selectedTask.site.status === 'auth-required' &&
                  selectedTask.site.interactiveVerificationProvider && (
                    <button
                      type="button"
                      className="site-reverify-button"
                      onClick={() => {
                        beginSiteReverification(selectedTask.site!);
                        setSelectedTask(undefined);
                      }}
                    >
                      重新验证
                    </button>
                  )}
                <button
                  type="button"
                  className="site-delete-button"
                  onClick={() => {
                    const site = selectedTask.site!;
                    if (
                      !window.confirm(
                        `确认删除站点“${site.name}”？此操作会同时删除本机凭据和缓存。`,
                      )
                    )
                      return;
                    void window.sub2apiDesktop?.sites
                      .delete(site.id)
                      .then(() => {
                        setSelectedTask(undefined);
                        notify({
                          id: `site-delete:${site.id}`,
                          kind: 'success',
                          message: `站点“${site.name}”已删除`,
                        });
                        window.dispatchEvent(new Event('sub2api:refresh'));
                      })
                      .catch((error) =>
                        notify({
                          id: `site-delete:${site.id}`,
                          kind: 'error',
                          message: safeRendererError(error, '站点删除失败'),
                        }),
                      );
                  }}
                >
                  删除站点
                </button>
              </footer>
            )}
          </section>
        </div>
      )}
      {pendingVerification && (
        <div className="security-verification-backdrop" role="presentation">
          <section
            className="security-verification-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="security-verification-title"
            aria-describedby="security-verification-description"
          >
            <button
              type="button"
              className="security-verification-close"
              ref={closeVerifyButtonRef}
              aria-label="关闭安全验证"
              title="关闭安全验证"
              onClick={cancelInteractiveVerification}
            >
              <X size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <div className="security-verification-icon" aria-hidden="true">
              <ShieldCheck size={22} />
            </div>
            <div className="security-verification-copy">
              <h2 id="security-verification-title">需要完成安全验证</h2>
              <p id="security-verification-description">
                {pendingVerification.provider === 'turnstile'
                  ? '该站点已启用 Cloudflare Turnstile。请在 Google Chrome 登录窗口完成人机验证和账号登录，'
                  : `该站点已启用 ${providerDisplayName(pendingVerification.provider)}。请在官方登录窗口完成人机验证，`}
                <br />
                验证成功后将自动继续添加站点。
              </p>
            </div>
            <div className="security-verification-actions">
              <button
                type="button"
                ref={cancelVerifyButtonRef}
                onClick={cancelInteractiveVerification}
              >
                暂不添加
              </button>
              <button
                type="button"
                className="primary"
                ref={verifyButtonRef}
                onClick={() => void startInteractiveVerification()}
              >
                开始登录
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function validationPhaseLabel(phase: string | undefined) {
  return (
    {
      profile: '获取额度',
      keys: '获取 API Key',
      groups: '获取分组',
      rates: '读取倍率',
      usage: '读取今日统计',
    }[phase ?? ''] ?? '登录与连通性'
  );
}

function providerDisplayName(provider: InteractiveVerificationProvider): string {
  return provider === 'turnstile' ? 'Cloudflare Turnstile' : 'GeeTest';
}

function safeHostName(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function sameSiteOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return left === right;
  }
}

function siteToBatchTask(site: SiteSummary): BatchTask {
  return {
    url: site.baseUrl,
    status:
      site.status === 'success'
        ? 'success'
        : site.status === 'auth-required' || site.status === 'error'
          ? 'failed'
          : 'pending',
    error: site.errors[0],
    site,
  };
}

function taskStatusLabel(task: BatchTask): string {
  if (task.site?.status === 'auth-required') return '需重新登录';
  if (task.status === 'success') return '成功';
  if (task.status === 'failed') return '失败';
  return '验证中';
}

function capabilitySummary(site: SiteSummary | undefined): string {
  if (!site) return '等待核心能力验证';
  const capabilities = Object.values(site.capabilities ?? {});
  if (!capabilities.length) return site.source === 'cache' ? '缓存数据' : '核心能力可用';
  const failed = capabilities.filter((status) => status === 'error').length;
  return failed ? `${failed} 项核心能力异常` : `${capabilities.length} 项核心能力可用`;
}

export function shouldKeepInteractiveVerificationPrompt(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return [
    'INTERACTIVE_AUTH_TIMEOUT',
    'INTERACTIVE_AUTH_LOAD_FAILED',
    'INTERACTIVE_AUTH_CHALLENGE_NETWORK',
    'CHROME_NOT_INSTALLED',
    'CHROME_START_FAILED',
    'CHROME_CDP_UNAVAILABLE',
    'CHROME_CLOSED',
    'CHROME_AUTH_TIMEOUT',
    'CHROME_AUTH_TOKEN_NOT_FOUND',
    'CHROME_AUTH_ORIGIN_BLOCKED',
    'CHROME_AUTH_FAILED',
    'CHROME_AUTH_ALREADY_RUNNING',
  ].some((code) => raw.includes(code));
}
