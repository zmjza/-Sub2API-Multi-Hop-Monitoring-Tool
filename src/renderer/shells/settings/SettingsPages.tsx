import { useEffect, useState } from 'react';
import { BellRing, LoaderCircle, Settings2 } from 'lucide-react';
import type {
  AppSettings,
  FloatingSettings,
  NotificationSettings,
  SiteSummary,
} from '../../../../electron/shared/contracts';
import './settings.css';

const defaultAppSettings: AppSettings = {
  refreshIntervalMinutes: 5,
  floatingEnabled: true,
  staleAfterMinutes: 2,
};

const defaultFloatingSettings: FloatingSettings = { position: 'top-right', opacity: 84 };

const defaultNotificationSettings: NotificationSettings = {
  enabled: false,
  threshold: 0.5,
  cooldownMs: 30 * 60_000,
  siteFailures: true,
  channelFailures: true,
  recoveryNotifications: true,
  sites: {},
};

export function GeneralSettingsPage(props: {
  updateChecking?: boolean;
  onCheckForUpdate?: () => void;
}) {
  const [startupEnabled, setStartupEnabled] = useState(false);
  const [floating, setFloating] = useState<FloatingSettings>(defaultFloatingSettings);
  const [app, setApp] = useState<AppSettings>(defaultAppSettings);

  useEffect(() => {
    void window.sub2apiDesktop?.sites
      .startupSetting()
      .then((value) => setStartupEnabled(value.enabled))
      .catch(() => undefined);
    void window.sub2apiDesktop?.sites
      .floatingSettings()
      .then(setFloating)
      .catch(() => undefined);
    void window.sub2apiDesktop?.sites
      .appSettings()
      .then(setApp)
      .catch(() => undefined);
  }, []);

  const saveApp = (value: AppSettings) => {
    setApp(value);
    void window.sub2apiDesktop?.sites
      .setAppSettings(value)
      .then(setApp)
      .catch(() => undefined);
  };

  return (
    <section className="settings-shell" aria-labelledby="general-settings-title">
      <header className="settings-page-heading">
        <span>
          <Settings2 size={20} />
        </span>
        <div>
          <h1 id="general-settings-title">通用设置</h1>
          <p>应用、悬浮窗与数据刷新偏好</p>
        </div>
      </header>
      <div className="settings-panel">
        <SettingRow title="在线更新" description="检查 GitHub 稳定版更新">
          <button
            className="settings-action"
            aria-busy={props.updateChecking}
            disabled={props.updateChecking}
            onClick={() => props.onCheckForUpdate?.()}
          >
            {props.updateChecking && <LoaderCircle size={16} className="spin" />}
            {props.updateChecking ? '检查中…' : '检查更新'}
          </button>
        </SettingRow>
        <SettingRow title="开机启动" description="登录系统后自动启动本地监控">
          <Toggle
            label="切换开机启动"
            active={startupEnabled}
            onClick={() => {
              const enabled = !startupEnabled;
              setStartupEnabled(enabled);
              void window.sub2apiDesktop?.sites
                .setStartupSetting(enabled)
                .then((value) => setStartupEnabled(value.enabled))
                .catch(() => setStartupEnabled(!enabled));
            }}
          />
        </SettingRow>
        <SettingRow title="悬浮窗固定位置" description="默认右上角，常驻桌面且不会遮挡前台应用">
          <select
            className="settings-select"
            aria-label="悬浮窗固定位置"
            value={floating.position}
            onChange={(event) => {
              const position = event.target.value as Exclude<
                FloatingSettings['position'],
                'custom'
              >;
              const value: FloatingSettings = { position, opacity: floating.opacity };
              setFloating(value);
              void window.sub2apiDesktop?.sites
                .setFloatingSettings(value)
                .then(setFloating)
                .catch(() => undefined);
            }}
          >
            {floating.position === 'custom' && (
              <option value="custom" disabled>
                自定义位置
              </option>
            )}
            <option value="top-left">左上角</option>
            <option value="top-right">右上角</option>
            <option value="bottom-left">左下角</option>
            <option value="bottom-right">右下角</option>
          </select>
        </SettingRow>
        <SettingRow title="启用悬浮窗" description="关闭后，最小化会隐藏到系统托盘">
          <Toggle
            label="切换悬浮窗"
            active={app.floatingEnabled}
            onClick={() => saveApp({ ...app, floatingEnabled: !app.floatingEnabled })}
          />
        </SettingRow>
        <SettingRow title="自动刷新频率" description="应用运行期间定时刷新已保存站点">
          <select
            className="settings-select"
            aria-label="自动刷新频率"
            value={app.refreshIntervalMinutes}
            onChange={(event) =>
              saveApp({
                ...app,
                refreshIntervalMinutes: Number(
                  event.target.value,
                ) as AppSettings['refreshIntervalMinutes'],
              })
            }
          >
            <option value={1}>每 1 分钟</option>
            <option value={5}>每 5 分钟</option>
            <option value={10}>每 10 分钟</option>
            <option value={15}>每 15 分钟</option>
          </select>
        </SettingRow>
        <SettingRow title="数据过期提示" description="超过所选时长未刷新时标记为缓存数据">
          <select
            className="settings-select"
            aria-label="数据过期提示"
            value={app.staleAfterMinutes}
            onChange={(event) =>
              saveApp({
                ...app,
                staleAfterMinutes: Number(event.target.value) as AppSettings['staleAfterMinutes'],
              })
            }
          >
            <option value={2}>2 分钟</option>
            <option value={5}>5 分钟</option>
            <option value={10}>10 分钟</option>
            <option value={30}>30 分钟</option>
          </select>
        </SettingRow>
      </div>
    </section>
  );
}

export function NotificationRulesPage(props: { selectedSite?: SiteSummary }) {
  const [settings, setSettings] = useState<NotificationSettings>(defaultNotificationSettings);
  const [supported, setSupported] = useState<boolean>();

  useEffect(() => {
    void window.sub2apiDesktop?.sites
      .notificationSettings()
      .then((value) => {
        if (isNotificationSettings(value)) setSettings(value);
      })
      .catch(() => undefined);
    void window.sub2apiDesktop?.sites
      .notificationPermission()
      .then((value) => setSupported(value.supported))
      .catch(() => setSupported(false));
  }, []);

  const save = (value: NotificationSettings) => {
    setSettings(value);
    void window.sub2apiDesktop?.sites
      .setNotificationSettings(value)
      .then((saved) => {
        if (isNotificationSettings(saved)) setSettings(saved);
      })
      .catch(() => undefined);
  };
  const siteRule = props.selectedSite ? settings.sites[props.selectedSite.id] : undefined;

  return (
    <section className="settings-shell" aria-labelledby="notification-settings-title">
      <header className="settings-page-heading">
        <span>
          <BellRing size={20} />
        </span>
        <div>
          <h1 id="notification-settings-title">通知规则设置</h1>
          <p>余额、站点与渠道异常提醒</p>
        </div>
      </header>
      <div className="settings-panel">
        <SettingRow
          title="系统通知权限"
          description={
            supported === undefined
              ? '正在检查系统支持状态'
              : supported
                ? '系统支持，首次发送时由系统处理授权'
                : '当前系统不支持 Electron 通知'
          }
        >
          <span className={`permission-state ${supported ? 'supported' : ''}`}>
            {supported ? '可用' : '不可用'}
          </span>
        </SettingRow>
        <SettingRow title="低额度警告" description="当站点余额低于阈值时触发">
          <div className="settings-control-pair">
            <label className="threshold-field">
              $
              <input
                aria-label="全局低额度阈值"
                type="number"
                min="0"
                step="0.1"
                value={settings.threshold}
                disabled={!settings.enabled}
                onChange={(event) =>
                  setSettings({ ...settings, threshold: Math.max(0, Number(event.target.value)) })
                }
                onBlur={() => save(settings)}
              />
            </label>
            <Toggle
              label="切换低额度警告"
              active={settings.enabled}
              onClick={() => save({ ...settings, enabled: !settings.enabled })}
            />
          </div>
        </SettingRow>
        <SettingRow title="渠道降级/失败" description="特定模型请求失败超过阈值">
          <Toggle
            label="切换渠道失败提醒"
            active={settings.channelFailures}
            onClick={() => save({ ...settings, channelFailures: !settings.channelFailures })}
          />
        </SettingRow>
        <SettingRow title="站点连续失败" description="连续查询失败时提醒">
          <Toggle
            label="切换站点失败提醒"
            active={settings.siteFailures}
            onClick={() => save({ ...settings, siteFailures: !settings.siteFailures })}
          />
        </SettingRow>
        <SettingRow title="恢复通知" description="异常站点或渠道恢复正常时提醒">
          <Toggle
            label="切换恢复通知"
            active={settings.recoveryNotifications}
            onClick={() =>
              save({ ...settings, recoveryNotifications: !settings.recoveryNotifications })
            }
          />
        </SettingRow>
        <SettingRow title="通知冷却时间" description="相同异常在冷却期内不重复提醒">
          <select
            className="settings-select"
            aria-label="通知冷却时间"
            value={Math.round(settings.cooldownMs / 60_000)}
            onChange={(event) =>
              save({ ...settings, cooldownMs: Number(event.target.value) * 60_000 })
            }
          >
            <option value={5}>5 分钟</option>
            <option value={15}>15 分钟</option>
            <option value={30}>30 分钟</option>
            <option value={60}>60 分钟</option>
          </select>
        </SettingRow>
        {props.selectedSite && (
          <SettingRow
            title={`${props.selectedSite.name} 独立余额规则`}
            description="覆盖当前站点的全局额度规则"
          >
            <div className="settings-control-pair">
              <label className="threshold-field">
                $
                <input
                  aria-label="当前站点低额度阈值"
                  type="number"
                  min="0"
                  step="0.1"
                  value={siteRule?.threshold ?? settings.threshold}
                  disabled={!(siteRule?.enabled ?? settings.enabled)}
                  onChange={(event) => {
                    const threshold = Math.max(0, Number(event.target.value));
                    setSettings({
                      ...settings,
                      sites: {
                        ...settings.sites,
                        [props.selectedSite!.id]: { ...siteRule, threshold },
                      },
                    });
                  }}
                  onBlur={() => save(settings)}
                />
              </label>
              <Toggle
                label="切换当前站点余额提醒"
                active={siteRule?.enabled ?? settings.enabled}
                onClick={() =>
                  save({
                    ...settings,
                    sites: {
                      ...settings.sites,
                      [props.selectedSite!.id]: {
                        ...siteRule,
                        enabled: !(siteRule?.enabled ?? settings.enabled),
                      },
                    },
                  })
                }
              />
            </div>
          </SettingRow>
        )}
      </div>
    </section>
  );
}

function SettingRow(props: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-copy">
        <b>{props.title}</b>
        <small>{props.description}</small>
      </div>
      {props.children}
    </div>
  );
}

function Toggle(props: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`settings-toggle ${props.active ? 'active' : ''}`}
      aria-label={props.label}
      aria-pressed={props.active}
      onClick={props.onClick}
    />
  );
}

function isNotificationSettings(value: unknown): value is NotificationSettings {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NotificationSettings>;
  return (
    typeof candidate.enabled === 'boolean' &&
    typeof candidate.threshold === 'number' &&
    typeof candidate.cooldownMs === 'number' &&
    typeof candidate.siteFailures === 'boolean' &&
    typeof candidate.channelFailures === 'boolean' &&
    typeof candidate.recoveryNotifications === 'boolean' &&
    Boolean(candidate.sites && typeof candidate.sites === 'object')
  );
}
