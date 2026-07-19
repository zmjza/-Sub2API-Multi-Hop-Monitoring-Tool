import { useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Circle, LoaderCircle, Plus } from 'lucide-react';
import type { SitesProps } from './types';
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

export function SitesPage(props: SitesProps) {
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
  const [batchResults, setBatchResults] = useState<
    Array<{ url: string; status: 'success' | 'failed'; error?: string }>
  >([]);
  const [message, setMessage] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationThreshold, setNotificationThreshold] = useState(0.5);
  const [startupEnabled, setStartupEnabled] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState<
    'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom'
  >('top-right');
  const [floatingOpacity, setFloatingOpacity] = useState(84);
  const [siteFailures, setSiteFailures] = useState(true);
  const [channelFailures, setChannelFailures] = useState(true);
  const [recoveryNotifications, setRecoveryNotifications] = useState(true);
  const [cooldownMinutes, setCooldownMinutes] = useState(30);
  const [notificationSupported, setNotificationSupported] = useState<boolean>();
  const [appSettings, setAppSettings] = useState<{
    refreshIntervalMinutes: 1 | 5 | 10 | 15;
    floatingEnabled: boolean;
    staleAfterMinutes: 2 | 5 | 10 | 30;
  }>({ refreshIntervalMinutes: 5, floatingEnabled: true, staleAfterMinutes: 2 });
  const [siteRules, setSiteRules] = useState<
    Record<string, { enabled?: boolean; threshold?: number }>
  >({});
  useEffect(() => {
    void window.sub2apiDesktop?.sites.notificationSettings().then((value) => {
      if (value && typeof value === 'object' && 'enabled' in value) {
        setNotificationsEnabled(Boolean(value.enabled));
        if ('threshold' in value && typeof value.threshold === 'number')
          setNotificationThreshold(value.threshold);
        if ('siteFailures' in value && typeof value.siteFailures === 'boolean')
          setSiteFailures(value.siteFailures);
        if ('channelFailures' in value && typeof value.channelFailures === 'boolean')
          setChannelFailures(value.channelFailures);
        if ('recoveryNotifications' in value && typeof value.recoveryNotifications === 'boolean')
          setRecoveryNotifications(value.recoveryNotifications);
        if ('cooldownMs' in value && typeof value.cooldownMs === 'number')
          setCooldownMinutes(Math.max(0, Math.round(value.cooldownMs / 60_000)));
        if ('sites' in value && value.sites && typeof value.sites === 'object')
          setSiteRules(value.sites as Record<string, { enabled?: boolean; threshold?: number }>);
      }
    });
    void window.sub2apiDesktop?.sites
      .startupSetting()
      .then((value) => setStartupEnabled(value.enabled))
      .catch(() => undefined);
    void window.sub2apiDesktop?.sites
      .floatingSettings()
      .then((value) => {
        setFloatingPosition(value.position);
        setFloatingOpacity(value.opacity);
      })
      .catch(() => undefined);
    void window.sub2apiDesktop?.sites
      .appSettings()
      .then(setAppSettings)
      .catch(() => undefined);
    void window.sub2apiDesktop?.sites
      .notificationPermission()
      .then((value) => setNotificationSupported(value.supported))
      .catch(() => setNotificationSupported(false));
  }, []);
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
    if (!props.sitesSection) return;
    const target =
      props.sitesSection === 'notifications' ? 'notification-settings' : 'general-settings';
    document.getElementById(target)?.scrollIntoView({ block: 'start' });
  }, [props.sitesSection]);
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
                  setMessage('请至少输入一个有效站点地址');
                  setBatchPhase('输入无效');
                  return;
                }
                setSubmissionMode('batch');
                setSubmitting(true);
                setBatchProgress({ current: 0, total: urls.length });
                setBatchResults([]);
                setBatchCurrentUrl('');
                setBatchPhase('准备验证');
                setMessage(`正在批量验证 ${urls.length} 个站点…`);
                const request = window.sub2apiDesktop?.sites.addBatch({ urls, account, password });
                if (!request) {
                  setBatchPhase('无法连接桌面服务');
                  setMessage('当前环境不支持批量验证');
                  setSubmitting(false);
                  return;
                }
                void request
                  .then((result) => {
                    setBatchProgress({ current: urls.length, total: urls.length });
                    setBatchPhase('全部完成');
                    setMessage(
                      `批量验证完成：成功 ${result.successes.length}，失败 ${result.failures.length}`,
                    );
                    if (!result.failures.length) {
                      setBatchUrls('');
                      setPassword('');
                    }
                  })
                  .catch((error: unknown) => {
                    setBatchPhase('验证中断');
                    setMessage(error instanceof Error ? error.message : '批量验证失败');
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
            className="site-submit-button"
            disabled={submitting || !name || !url || !account || !password}
            onClick={() => {
              setSubmissionMode('single');
              setSubmitting(true);
              setValidationPhase('登录与连通性');
              setMessage('正在验证站点…');
              void window.sub2apiDesktop?.sites
                .addAndVerify({ name, url, account, password })
                .then(() => {
                  setValidationPhase('验证完成');
                  setMessage('站点验证成功');
                  setPassword('');
                  window.dispatchEvent(new Event('sub2api:refresh'));
                })
                .catch((error: unknown) =>
                  setMessage(error instanceof Error ? error.message : '站点验证失败'),
                )
                .finally(() => setSubmitting(false));
            }}
          >
            {submitting && submissionMode === 'single' ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Plus size={18} />
            )}
            {submitting ? '验证中…' : '添加并验证'}
          </button>
          {message && <small className="site-form-message">{message}</small>}
        </section>
        <div className="sites-lower-grid">
          <section className="site-table-panel">
            <div className="site-panel-heading">
              <h2>批量验证任务</h2>
              <span className="progress-pill">
                {siteTaskSummary(submitting, props.dashboard?.sites ?? [])}
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>目标 URL</th>
                  <th>状态</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                {batchResults.map((result) => (
                  <tr key={`batch-${result.url}`}>
                    <td>{result.url}</td>
                    <td>
                      <span className={`verify-tag ${result.status}`}>
                        {result.status === 'success' ? '成功' : '失败'}
                      </span>
                    </td>
                    <td className={result.status === 'failed' ? 'error-text' : ''}>
                      {result.error ?? '验证并保存成功'}
                    </td>
                  </tr>
                ))}
                {!batchResults.length &&
                  props.dashboard?.sites.map((site) => (
                    <tr key={site.id}>
                      <td>{site.baseUrl}</td>
                      <td>
                        <span
                          className={`verify-tag ${site.status === 'success' ? 'success' : site.status === 'auth-required' || site.status === 'error' ? 'failed' : 'pending'}`}
                        >
                          {site.status === 'success'
                            ? '成功'
                            : site.status === 'auth-required'
                              ? '需重新登录'
                              : site.status}
                        </span>
                      </td>
                      <td>
                        {site.errors[0] ?? (site.source === 'cache' ? '缓存数据' : '核心能力可用')}{' '}
                        <button
                          className="site-delete-button"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `确认删除站点“${site.name}”？此操作会同时删除本机凭据和缓存。`,
                              )
                            )
                              return;
                            void window.sub2apiDesktop?.sites
                              .delete(site.id)
                              .then(() => window.dispatchEvent(new Event('sub2api:refresh')));
                          }}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                {!props.dashboard && !runtime && (
                  <>
                    <tr>
                      <td>api.openai-proxy.com</td>
                      <td>
                        <span className="verify-tag pending">验证中</span>
                      </td>
                      <td>检查额度...</td>
                    </tr>
                    <tr>
                      <td>claude.api-hub.net</td>
                      <td>
                        <span className="verify-tag success">
                          <CheckCircle2 size={14} />
                          成功
                        </span>
                      </td>
                      <td>所有能力可用</td>
                    </tr>
                    <tr>
                      <td>dead.endpoint.org</td>
                      <td>
                        <span className="verify-tag failed">
                          <AlertCircle size={14} />
                          失败
                        </span>
                      </td>
                      <td className="error-text">401 Unauthorized</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </section>
          <section className="notification-panel" id="general-settings">
            <h2>通用设置</h2>
            <div className="notification-row">
              <div>
                <b>开机启动</b>
                <small>登录系统后自动启动本地监控</small>
              </div>
              <button
                className={`toggle ${startupEnabled ? 'active' : ''}`}
                aria-label="切换开机启动"
                onClick={() => {
                  const enabled = !startupEnabled;
                  void window.sub2apiDesktop?.sites
                    .setStartupSetting(enabled)
                    .then((value) => setStartupEnabled(value.enabled));
                }}
              />
            </div>
            <div className="notification-row">
              <div>
                <b>悬浮窗固定位置</b>
                <small>默认右上角，常驻桌面且不会遮挡前台应用</small>
              </div>
              <select
                className="settings-select"
                aria-label="悬浮窗固定位置"
                value={floatingPosition}
                onChange={(event) => {
                  const position = event.target.value as Exclude<typeof floatingPosition, 'custom'>;
                  setFloatingPosition(position);
                  void window.sub2apiDesktop?.sites
                    .setFloatingSettings({ position, opacity: floatingOpacity })
                    .then((value) => {
                      setFloatingPosition(value.position);
                      setFloatingOpacity(value.opacity);
                    });
                }}
              >
                {floatingPosition === 'custom' && (
                  <option value="custom" disabled>
                    自定义位置
                  </option>
                )}
                <option value="top-left">左上角</option>
                <option value="top-right">右上角</option>
                <option value="bottom-left">左下角</option>
                <option value="bottom-right">右下角</option>
              </select>
            </div>
            <div className="notification-row">
              <div>
                <b>启用悬浮窗</b>
                <small>关闭后，最小化会隐藏到系统托盘</small>
              </div>
              <button
                className={`toggle ${appSettings.floatingEnabled ? 'active' : ''}`}
                aria-label="切换悬浮窗"
                onClick={() => {
                  const value = { ...appSettings, floatingEnabled: !appSettings.floatingEnabled };
                  setAppSettings(value);
                  void window.sub2apiDesktop?.sites.setAppSettings(value).then(setAppSettings);
                }}
              />
            </div>
            <div className="notification-row">
              <div>
                <b>自动刷新频率</b>
                <small>应用运行期间定时刷新已保存站点</small>
              </div>
              <select
                className="settings-select"
                aria-label="自动刷新频率"
                value={appSettings.refreshIntervalMinutes}
                onChange={(event) => {
                  const value = {
                    ...appSettings,
                    refreshIntervalMinutes: Number(event.target.value) as 1 | 5 | 10 | 15,
                  };
                  setAppSettings(value);
                  void window.sub2apiDesktop?.sites.setAppSettings(value).then(setAppSettings);
                }}
              >
                <option value={1}>每 1 分钟</option>
                <option value={5}>每 5 分钟</option>
                <option value={10}>每 10 分钟</option>
                <option value={15}>每 15 分钟</option>
              </select>
            </div>
            <div className="notification-row">
              <div>
                <b>数据过期提示</b>
                <small>超过所选时长未刷新时标记为缓存数据</small>
              </div>
              <select
                className="settings-select"
                aria-label="数据过期提示"
                value={appSettings.staleAfterMinutes}
                onChange={(event) => {
                  const value = {
                    ...appSettings,
                    staleAfterMinutes: Number(event.target.value) as 2 | 5 | 10 | 30,
                  };
                  setAppSettings(value);
                  void window.sub2apiDesktop?.sites.setAppSettings(value).then(setAppSettings);
                }}
              >
                <option value={2}>2 分钟</option>
                <option value={5}>5 分钟</option>
                <option value={10}>10 分钟</option>
                <option value={30}>30 分钟</option>
              </select>
            </div>
            <h2 className="settings-section-heading" id="notification-settings">
              通知规则设置
            </h2>
            <div className="notification-row">
              <div>
                <b>系统通知权限</b>
                <small>
                  {notificationSupported === undefined
                    ? '正在检查系统支持状态'
                    : notificationSupported
                      ? '系统支持，首次发送时由系统处理授权'
                      : '当前系统不支持 Electron 通知'}
                </small>
              </div>
              <span className={`permission-state ${notificationSupported ? 'supported' : ''}`}>
                {notificationSupported ? '可用' : '不可用'}
              </span>
            </div>
            <div className="notification-row">
              <div>
                <b>低额度警告</b>
                <small>当站点余额低于阈值时触发</small>
                <label className="threshold-field">
                  ${' '}
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={notificationThreshold}
                    onChange={(event) =>
                      setNotificationThreshold(Math.max(0, Number(event.target.value)))
                    }
                    onBlur={() => {
                      void window.sub2apiDesktop?.sites.setNotificationSettings({
                        enabled: notificationsEnabled,
                        threshold: notificationThreshold,
                        cooldownMs: cooldownMinutes * 60_000,
                        siteFailures,
                        channelFailures,
                        recoveryNotifications,
                        sites: siteRules,
                      });
                    }}
                  />
                </label>
              </div>
              <button
                className={`toggle ${notificationsEnabled ? 'active' : ''}`}
                aria-label="切换低额度警告"
                onClick={() => {
                  const enabled = !notificationsEnabled;
                  setNotificationsEnabled(enabled);
                  void window.sub2apiDesktop?.sites.setNotificationSettings({
                    enabled,
                    threshold: notificationThreshold,
                    cooldownMs: cooldownMinutes * 60_000,
                    siteFailures,
                    channelFailures,
                    recoveryNotifications,
                    sites: siteRules,
                  });
                }}
              />
            </div>
            <div className="notification-row">
              <div>
                <b>渠道降级/失败</b>
                <small>特定模型请求失败超过阈值</small>
              </div>
              <button
                className={`toggle ${channelFailures ? 'active' : ''}`}
                aria-label="切换渠道失败提醒"
                onClick={() => {
                  const value = !channelFailures;
                  setChannelFailures(value);
                  void window.sub2apiDesktop?.sites.setNotificationSettings({
                    enabled: notificationsEnabled,
                    threshold: notificationThreshold,
                    cooldownMs: cooldownMinutes * 60_000,
                    siteFailures,
                    channelFailures: value,
                    recoveryNotifications,
                    sites: siteRules,
                  });
                }}
              />
            </div>
            <div className="notification-row">
              <div>
                <b>站点连续失败</b>
                <small>连续查询失败时提醒</small>
              </div>
              <button
                className={`toggle ${siteFailures ? 'active' : ''}`}
                aria-label="切换站点失败提醒"
                onClick={() => {
                  const value = !siteFailures;
                  setSiteFailures(value);
                  void window.sub2apiDesktop?.sites.setNotificationSettings({
                    enabled: notificationsEnabled,
                    threshold: notificationThreshold,
                    cooldownMs: cooldownMinutes * 60_000,
                    siteFailures: value,
                    channelFailures,
                    recoveryNotifications,
                    sites: siteRules,
                  });
                }}
              />
            </div>
            <div className="notification-row">
              <div>
                <b>恢复通知</b>
                <small>异常站点或渠道恢复正常时提醒</small>
              </div>
              <button
                className={`toggle ${recoveryNotifications ? 'active' : ''}`}
                aria-label="切换恢复通知"
                onClick={() => {
                  const value = !recoveryNotifications;
                  setRecoveryNotifications(value);
                  void window.sub2apiDesktop?.sites.setNotificationSettings({
                    enabled: notificationsEnabled,
                    threshold: notificationThreshold,
                    cooldownMs: cooldownMinutes * 60_000,
                    siteFailures,
                    channelFailures,
                    recoveryNotifications: value,
                    sites: siteRules,
                  });
                }}
              />
            </div>
            <div className="notification-row">
              <div>
                <b>通知冷却时间</b>
                <small>相同异常在冷却期内不重复提醒</small>
              </div>
              <select
                className="settings-select"
                aria-label="通知冷却时间"
                value={cooldownMinutes}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setCooldownMinutes(value);
                  void window.sub2apiDesktop?.sites.setNotificationSettings({
                    enabled: notificationsEnabled,
                    threshold: notificationThreshold,
                    cooldownMs: value * 60_000,
                    siteFailures,
                    channelFailures,
                    recoveryNotifications,
                    sites: siteRules,
                  });
                }}
              >
                <option value={5}>5 分钟</option>
                <option value={15}>15 分钟</option>
                <option value={30}>30 分钟</option>
                <option value={60}>60 分钟</option>
              </select>
            </div>
            {props.selectedSite && (
              <div className="notification-row">
                <div>
                  <b>{props.selectedSite.name} 独立余额规则</b>
                  <label className="threshold-field">
                    ${' '}
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={siteRules[props.selectedSite.id]?.threshold ?? notificationThreshold}
                      onChange={(event) => {
                        const threshold = Math.max(0, Number(event.target.value));
                        const sites = {
                          ...siteRules,
                          [props.selectedSite!.id]: {
                            ...siteRules[props.selectedSite!.id],
                            threshold,
                          },
                        };
                        setSiteRules(sites);
                      }}
                      onBlur={() => {
                        void window.sub2apiDesktop?.sites.setNotificationSettings({
                          enabled: notificationsEnabled,
                          threshold: notificationThreshold,
                          cooldownMs: cooldownMinutes * 60_000,
                          siteFailures,
                          channelFailures,
                          recoveryNotifications,
                          sites: siteRules,
                        });
                      }}
                    />
                  </label>
                </div>
                <button
                  className={`toggle ${(siteRules[props.selectedSite.id]?.enabled ?? notificationsEnabled) ? 'active' : ''}`}
                  aria-label="切换当前站点余额提醒"
                  onClick={() => {
                    const current =
                      siteRules[props.selectedSite!.id]?.enabled ?? notificationsEnabled;
                    const sites = {
                      ...siteRules,
                      [props.selectedSite!.id]: {
                        ...siteRules[props.selectedSite!.id],
                        enabled: !current,
                      },
                    };
                    setSiteRules(sites);
                    void window.sub2apiDesktop?.sites.setNotificationSettings({
                      enabled: notificationsEnabled,
                      threshold: notificationThreshold,
                      cooldownMs: cooldownMinutes * 60_000,
                      siteFailures,
                      channelFailures,
                      recoveryNotifications,
                      sites,
                    });
                  }}
                />
              </div>
            )}
          </section>
        </div>
      </div>
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
