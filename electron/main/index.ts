import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  shell,
  Tray,
  Menu,
  nativeImage,
  safeStorage,
  Notification,
  dialog,
  clipboard,
} from 'electron';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  siteInputSchema,
  batchSiteInputSchema,
  refreshRequestSchema,
  siteNoteSchema,
  usageQuerySchema,
  keyPreferenceSchema,
  notificationSettingsSchema,
  channelStatusRequestSchema,
  channelAssociationRequestSchema,
  channelAssociationClearRequestSchema,
  channelAssociationSchema,
  startupSettingSchema,
  floatingSettingsSchema,
  appSettingsSchema,
  usageFilterOptionsSchema,
  siteSummarySchema,
  siteAddResultSchema,
  dashboardSnapshotSchema,
  usagePayloadSchema,
  usageStatsSchema,
  channelViewSchema,
  channelDetailViewSchema,
  apiKeySummarySchema,
  siteKeyContextsSchema,
  rateContextsSchema,
  rateSiteContextSchema,
  rechargeRatioRequestSchema,
  apiKeyListQuerySchema,
  apiKeyDetailRequestSchema,
  apiKeyGroupUpdateRequestSchema,
  apiKeyManagementPayloadSchema,
  managedApiKeySchema,
} from '../shared/contracts.js';
import { AppDatabase } from './storage/database.js';
import { CredentialVault } from './storage/credential-vault.js';
import { FileSecretBackend } from './storage/file-secret-backend.js';
import { SiteService } from './services/site-service.js';
import { RefreshScheduler } from './services/refresh-scheduler.js';
import { NotificationService } from './services/notification-service.js';
import { intervalInRange } from './domain/scheduler.js';
import { createTrayMenuTemplate, trayIconDataUrl } from './tray-icon.js';
import { floatingWindowPolicy, resolveFloatingBounds } from './domain/window-bounds.js';
import { compareSemver, UpdateService, updateManifestSchema } from './services/update-service.js';
import { runInteractiveAuthentication } from './services/interactive-auth-window.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
if (process.env.SUB2API_TEST_USER_DATA) app.setPath('userData', process.env.SUB2API_TEST_USER_DATA);
const preloadPath = path.join(currentDir, '../preload/bridge.cjs');
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
let mainWindow: BrowserWindow | undefined;
let floatingWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let siteService: SiteService;
let appDatabase: AppDatabase;
let isQuitting = false;
let scheduler: RefreshScheduler;
let notificationService: NotificationService;
let updateService: UpdateService;
const scheduledTimers: NodeJS.Timeout[] = [];
const boundsSaveTimers = new Map<string, NodeJS.Timeout>();
let programmaticFloatingBounds: Electron.Rectangle | undefined;

function secureWindowOptions(): Electron.BrowserWindowConstructorOptions {
  return {
    show: false,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  };
}

async function loadRenderer(window: BrowserWindow, surface: 'main' | 'floating') {
  if (devServerUrl) await window.loadURL(`${devServerUrl}/?surface=${surface}`);
  else
    await window.loadFile(path.join(currentDir, '../../dist/index.html'), { query: { surface } });
}

function protectNavigation(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event) => event.preventDefault());
}

function showMainWindow(): void {
  floatingWindow?.hide();
  mainWindow?.show();
  mainWindow?.focus();
}

function showFloatingWindow(): void {
  if (!floatingWindow) return;
  const policy = floatingWindowPolicy(process.platform);
  // Showing the desktop resident window must not activate the app. Activation
  // can move it into the foreground collection in macOS Stage Manager.
  if (policy.activateOnShow) floatingWindow.show();
  else floatingWindow.showInactive();
}

function broadcastRefreshState(
  siteId: string,
  state: 'refreshing' | 'success' | 'error' | 'auth-required',
  phase?: string,
) {
  for (const window of BrowserWindow.getAllWindows())
    window.webContents.send('sites:refresh-state', { siteId, state, phase });
}

function registerIpc() {
  ipcMain.on('app:version', (event) => {
    event.returnValue = app.getVersion();
  });
  ipcMain.handle('sites:list', () => dashboardSnapshotSchema.parse(siteService.listSites()));
  ipcMain.handle('sites:select', (_event, input: unknown) => {
    const siteId = refreshRequestSchema.parse({ siteId: input }).siteId;
    scheduler.setCurrentSite(siteId);
    const result = siteService.setCurrentSite(siteId);
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('sites:changed');
    return dashboardSnapshotSchema.parse(result);
  });
  ipcMain.handle('sites:delete', (_event, input: unknown) => {
    const siteId = refreshRequestSchema.parse({ siteId: input }).siteId;
    const result = siteService.deleteSite(siteId);
    scheduler.setSites(result.sites.map((site) => site.id));
    if (result.currentSiteId) scheduler.setCurrentSite(result.currentSiteId);
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('sites:changed');
    return dashboardSnapshotSchema.parse(result);
  });
  ipcMain.handle('sites:add-and-verify', async (_event, input: unknown) => {
    const parsed = siteInputSchema.parse(input);
    if (await siteService.requiresInteractiveVerification(parsed))
      return siteAddResultSchema.parse({ status: 'verification-required' });
    let result;
    try {
      result = await siteService.addAndVerify(parsed);
    } catch (error) {
      if (error instanceof Error && error.message === 'GEETEST_REQUIRED')
        return siteAddResultSchema.parse({ status: 'verification-required' });
      throw error;
    }
    scheduler.setSites(siteService.listSites().sites.map((site) => site.id));
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('sites:changed');
    return siteAddResultSchema.parse({ status: 'added', site: result });
  });
  ipcMain.handle('sites:add-with-interactive-verification', async (event, input: unknown) => {
    const parsed = siteInputSchema.parse(input);
    const parent = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    if (!parent) throw new Error('INTERACTIVE_AUTH_WINDOW_UNAVAILABLE');
    const result = await runInteractiveAuthentication(parent, parsed, (tokens) =>
      siteService.addWithInteractiveSession(parsed, tokens),
    );
    scheduler.setSites(siteService.listSites().sites.map((site) => site.id));
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('sites:changed');
    return siteAddResultSchema.parse({ status: 'added', site: result });
  });
  ipcMain.handle('sites:add-batch', async (event, input: unknown) => {
    const result = await siteService.addBatch(batchSiteInputSchema.parse(input), (value) =>
      event.sender.send('sites:batch-progress', value),
    );
    scheduler.setSites(siteService.listSites().sites.map((site) => site.id));
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('sites:changed');
    return {
      successes: result.successes.map((site) => siteSummarySchema.parse(site)),
      failures: result.failures,
    };
  });
  ipcMain.handle('sites:refresh', async (_event, input: unknown) => {
    const { siteId } = refreshRequestSchema.parse({ siteId: input });
    await scheduler.manualRefresh(siteId);
    const result = siteService.listSites().sites.find((site) => site.id === siteId);
    if (!result) throw new Error('SITE_NOT_FOUND');
    return siteSummarySchema.parse(result);
  });
  ipcMain.handle('sites:refresh-all', async () => {
    await scheduler.manualRefreshAll();
    return dashboardSnapshotSchema.parse(siteService.listSites());
  });
  ipcMain.handle('sites:note:set', (_event, input: unknown) => {
    const value = siteNoteSchema.parse(input);
    return siteSummarySchema.parse(siteService.setSiteNote(value.siteId, value.note));
  });
  ipcMain.handle('rates:contexts', () => rateContextsSchema.parse(siteService.rateContexts()));
  ipcMain.handle('rates:refresh', async (_event, input: unknown) => {
    const siteId = refreshRequestSchema.parse({ siteId: input }).siteId;
    return rateSiteContextSchema.parse(await siteService.refreshRateGroups(siteId));
  });
  ipcMain.handle('rates:refresh-all', async () =>
    rateContextsSchema.parse(await siteService.refreshAllRateGroups()),
  );
  ipcMain.handle('rates:ratio:set', (_event, input: unknown) => {
    const value = rechargeRatioRequestSchema.parse(input);
    return rateContextsSchema.parse(siteService.setRechargeRatio(value.siteId, value.ratio));
  });
  ipcMain.handle('usage:list', async (_event, input: unknown) =>
    usagePayloadSchema.parse(await siteService.usage(usageQuerySchema.parse(input))),
  );
  ipcMain.handle('usage:stats', async (_event, input: unknown) =>
    usageStatsSchema.parse(await siteService.usageStats(usageQuerySchema.parse(input))),
  );
  ipcMain.handle('usage:groups', async (_event, input: unknown) => {
    const siteId = refreshRequestSchema.parse({ siteId: input }).siteId;
    return usageFilterOptionsSchema.shape.groups.parse(await siteService.usageGroups(siteId));
  });
  ipcMain.handle('usage:models', async (_event, input: unknown) => {
    const siteId = refreshRequestSchema.parse({ siteId: input }).siteId;
    return usageFilterOptionsSchema.shape.models.parse(await siteService.usageModels(siteId));
  });
  ipcMain.handle('usage:csv', async (_event, input: unknown) => {
    const csv = await siteService.usageCsv(usageQuerySchema.parse(input));
    const result = process.env.SUB2API_TEST_EXPORT_PATH
      ? { canceled: false, filePath: process.env.SUB2API_TEST_EXPORT_PATH }
      : await dialog.showSaveDialog({
          title: '导出使用记录',
          defaultPath: 'sub2api-usage.csv',
          filters: [{ name: 'CSV', extensions: ['csv'] }],
        });
    if (result.canceled || !result.filePath) return { canceled: true };
    const fs = await import('node:fs/promises');
    await fs.writeFile(result.filePath, `\ufeff${csv}`, { encoding: 'utf8', mode: 0o600 });
    await fs.chmod(result.filePath, 0o600);
    return { canceled: false, filePath: result.filePath };
  });
  ipcMain.handle('channels:list', async (_event, input: unknown) => {
    const siteId = refreshRequestSchema.parse({ siteId: input }).siteId;
    let result;
    try {
      result = channelViewSchema.parse(await siteService.channels(siteId));
    } catch (error) {
      const retryAfterSeconds = safeRetryAfterSeconds(error);
      const code = safeErrorCode(error);
      throw new Error(
        code === 'AUTH_REQUIRED'
          ? 'CHANNEL_AUTH_REQUIRED'
          : retryAfterSeconds === undefined
            ? 'CHANNEL_REFRESH_FAILED'
            : `CHANNEL_REFRESH_FAILED RETRY_AFTER=${retryAfterSeconds}`,
        { cause: error },
      );
    }
    const settings = siteService.getNotificationSettings();
    const siteName =
      siteService.listSites().sites.find((site) => site.id === siteId)?.name ?? '当前站点';
    const healthy =
      result.state === 'unsupported' ||
      !result.channels.some((channel) => ['failed', 'degraded'].includes(channel.status));
    notificationService?.channelHealth(
      siteId,
      `${siteName} 渠道`,
      healthy,
      settings.enabled && settings.channelFailures,
      settings.cooldownMs,
      settings.recoveryNotifications,
    );
    return result;
  });
  ipcMain.handle('channels:status', async (_event, input: unknown) => {
    const request = channelStatusRequestSchema.parse(input);
    return channelDetailViewSchema.parse(
      await siteService.channelStatus(request.siteId, request.channelId),
    );
  });
  ipcMain.handle('channels:associations:get', (_event, input: unknown) => {
    const siteId = refreshRequestSchema.parse({ siteId: input }).siteId;
    return channelAssociationSchema.array().parse(siteService.getChannelAssociations(siteId));
  });
  ipcMain.handle('channels:associations:set', (_event, input: unknown) => {
    const request = channelAssociationRequestSchema.parse(input);
    return channelAssociationSchema
      .array()
      .parse(
        siteService.setChannelAssociation(request.siteId, request.groupId, request.channelIds),
      );
  });
  ipcMain.handle('channels:associations:clear', (_event, input: unknown) => {
    const request = channelAssociationClearRequestSchema.parse(input);
    return channelAssociationSchema
      .array()
      .parse(siteService.clearChannelAssociation(request.siteId, request.groupId));
  });
  ipcMain.handle('keys:list', (_event, input: unknown) =>
    apiKeySummarySchema
      .array()
      .parse(siteService.listKeys(refreshRequestSchema.parse({ siteId: input }).siteId)),
  );
  ipcMain.handle('api-keys:list', async (_event, input: unknown) =>
    apiKeyManagementPayloadSchema.parse(
      await siteService.apiKeys(apiKeyListQuerySchema.parse(input)),
    ),
  );
  ipcMain.handle('api-keys:update-group', async (_event, input: unknown) =>
    managedApiKeySchema.parse(
      await siteService.updateApiKeyGroup(apiKeyGroupUpdateRequestSchema.parse(input)),
    ),
  );
  ipcMain.handle('api-keys:copy', async (_event, input: unknown) => {
    const request = apiKeyDetailRequestSchema.parse(input);
    const detail = await siteService.apiKeyDetail(request);
    if (!detail.apiKey) throw new Error('API_KEY_UNAVAILABLE');
    clipboard.writeText(detail.apiKey);
    return { copied: true };
  });
  ipcMain.handle('keys:contexts', () => siteKeyContextsSchema.parse(siteService.listKeyContexts()));
  ipcMain.handle('keys:preference:get', (_event, input: unknown) =>
    siteService.getKeyPreference(refreshRequestSchema.parse({ siteId: input }).siteId),
  );
  ipcMain.handle('keys:preference:set', (_event, input: unknown) => {
    const value = input as { siteId?: unknown; mode?: unknown; keyId?: unknown };
    const siteId = refreshRequestSchema.parse({ siteId: value.siteId }).siteId;
    const result = siteService.setKeyPreference(
      siteId,
      keyPreferenceSchema.parse({ mode: value.mode, keyId: value.keyId }),
    );
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('sites:changed');
    return result;
  });
  ipcMain.handle('notifications:get', () => siteService.getNotificationSettings());
  ipcMain.handle('notifications:set', (_event, input: unknown) =>
    siteService.setNotificationSettings(notificationSettingsSchema.parse(input)),
  );
  ipcMain.handle('notifications:permission', () => ({ supported: Notification.isSupported() }));
  ipcMain.on('window:open-main', showMainWindow);
  ipcMain.on('window:minimize-main', () => {
    if (appSettingsSchema.parse(appDatabase.getAppSettings()).floatingEnabled) {
      mainWindow?.hide();
      // Desktop residency must not activate the app. Activation can move the
      // app into the foreground collection in Stage Manager and shrink it.
      showFloatingWindow();
    } else {
      mainWindow?.hide();
    }
  });
  ipcMain.on('window:close-main', () => app.quit());
  ipcMain.on('window:hide-main', () => mainWindow?.hide());
  ipcMain.handle('startup:get', () => ({ enabled: app.getLoginItemSettings().openAtLogin }));
  ipcMain.handle('startup:set', (_event, input: unknown) => {
    const setting = startupSettingSchema.parse(input);
    app.setLoginItemSettings({ openAtLogin: setting.enabled });
    return { enabled: app.getLoginItemSettings().openAtLogin };
  });
  ipcMain.handle('floating:get', () =>
    floatingSettingsSchema.parse(
      appDatabase.getSetting('floating:settings', { position: 'top-right', opacity: 84 }),
    ),
  );
  ipcMain.handle('floating:set', (_event, input: unknown) => {
    const settings = floatingSettingsSchema.parse(input);
    appDatabase.setSetting('floating:settings', settings);
    const bounds = floatingBoundsFor(settings);
    programmaticFloatingBounds = bounds;
    floatingWindow?.setBounds(bounds);
    floatingWindow?.setOpacity(settings.opacity / 100);
    return settings;
  });
  ipcMain.handle('app-settings:get', () => appSettingsSchema.parse(appDatabase.getAppSettings()));
  ipcMain.handle('app-settings:set', (_event, input: unknown) => {
    const settings = appSettingsSchema.parse(input);
    appDatabase.setAppSettings(settings);
    if (!settings.floatingEnabled) floatingWindow?.hide();
    return settings;
  });
  ipcMain.handle('update:check', () => updateService.check());
  ipcMain.handle('update:download', async (event, input: unknown) => {
    const result = await updateService.download(updateManifestSchema.parse(input), (value) =>
      event.sender.send('update:progress', value),
    );
    return result;
  });
  ipcMain.handle('update:install', async (_event, input: unknown) => {
    if (
      typeof input !== 'string' ||
      path.dirname(input) !== os.tmpdir() ||
      !/^sub2api-update-\d+\.\d+\.\d+(?:-[^/]+)?\.(?:dmg|exe)$/.test(path.basename(input))
    )
      throw new Error('INVALID_UPDATE_PATH');
    if (process.platform === 'darwin') {
      await shell.openPath(input);
      return { mode: 'manual' as const };
    }
    if (process.platform === 'win32') {
      spawn(input, ['/S'], { detached: true, stdio: 'ignore' }).unref();
      app.quit();
      return { mode: 'restarted' as const };
    }
    throw new Error('PLATFORM_UNSUPPORTED');
  });
  ipcMain.handle('update:skip', (_event, input: unknown) => {
    if (typeof input !== 'string') throw new Error('INVALID_VERSION');
    compareSemver(input, input);
    updateService.skip(input);
  });
  ipcMain.handle('update:remind-later', (_event, input: unknown) => {
    if (typeof input !== 'string') throw new Error('INVALID_VERSION');
    compareSemver(input, input);
    updateService.remindLater(input);
  });
}

function safeRetryAfterSeconds(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('retryAfterSeconds' in error)) return undefined;
  const value = Number(error.retryAfterSeconds);
  return Number.isFinite(value) && value >= 0 ? Math.min(86_400, Math.ceil(value)) : undefined;
}

function safeErrorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
}

function scheduleRefreshLoops() {
  let firstCurrent = true;
  const scheduleCurrent = () => {
    const configuredMs = appDatabase.getAppSettings().refreshIntervalMinutes * 60_000;
    const delay = firstCurrent ? intervalInRange(2_000, 30_000) : configuredMs;
    firstCurrent = false;
    const timer = setTimeout(async () => {
      const current = siteService.listSites().currentSiteId;
      if (current)
        try {
          await scheduler.refreshNow(current);
        } catch {
          /* backoff state owns retry timing */
        }
      if (!isQuitting) scheduleCurrent();
    }, delay);
    scheduledTimers.push(timer);
  };
  const scheduleBackground = () => {
    const configuredMs = appDatabase.getAppSettings().refreshIntervalMinutes * 60_000;
    const timer = setTimeout(async () => {
      await scheduler.refreshAll();
      if (!isQuitting) scheduleBackground();
    }, configuredMs);
    scheduledTimers.push(timer);
  };
  scheduleCurrent();
  scheduleBackground();
  const scheduleCleanup = () => {
    const timer = setTimeout(
      () => {
        appDatabase.cleanupSnapshots(Date.now() - 30 * 24 * 60 * 60_000);
        if (!isQuitting) scheduleCleanup();
      },
      24 * 60 * 60_000,
    );
    scheduledTimers.push(timer);
  };
  scheduleCleanup();
}

function createTray() {
  const trayIcon = nativeImage.createFromDataURL(trayIconDataUrl()).resize({
    width: 18,
    height: 18,
  });
  if (process.platform === 'darwin') trayIcon.setTemplateImage(true);
  tray = new Tray(trayIcon);
  tray.setToolTip('看看你还有💰吗？');
  tray.setContextMenu(
    Menu.buildFromTemplate(
      createTrayMenuTemplate({
        showMain: showMainWindow,
        toggleFloating: () =>
          floatingWindow?.isVisible() ? floatingWindow.hide() : showFloatingWindow(),
        quit: () => app.quit(),
      }),
    ),
  );
}

async function createWindows() {
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const mainBounds = restoreBounds('window:main', {
    width: Math.round(workArea.width * 0.6),
    height: Math.round(workArea.height * 0.9),
  });
  mainWindow = new BrowserWindow({
    ...secureWindowOptions(),
    ...mainBounds,
    backgroundColor: '#f8f9ff',
    minWidth: 720,
    minHeight: 512,
    resizable: true,
    ...(mainBounds.x === undefined ? { center: true } : {}),
  });
  protectNavigation(mainWindow);
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      app.quit();
    }
  });
  await loadRenderer(mainWindow, 'main');
  mainWindow.show();
  if (mainBounds.x !== undefined && mainBounds.y !== undefined) mainWindow.setBounds(mainBounds);
  mainWindow.on('resize', () => saveBounds('window:main', mainWindow));
  mainWindow.on('move', () => saveBounds('window:main', mainWindow));

  const floatingSettings = floatingSettingsSchema.parse(
    appDatabase.getSetting('floating:settings', { position: 'top-right', opacity: 84 }),
  );
  const floatingBounds = floatingBoundsFor(floatingSettings);
  const floatingPolicy = floatingWindowPolicy(process.platform);
  floatingWindow = new BrowserWindow({
    ...secureWindowOptions(),
    ...floatingBounds,
    width: 380,
    height: 260,
    resizable: false,
    alwaysOnTop: floatingPolicy.alwaysOnTop,
    focusable: true,
  });
  floatingWindow.setOpacity(floatingSettings.opacity / 100);
  if (floatingPolicy.visibleOnAllWorkspaces)
    floatingWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: floatingPolicy.visibleOnFullScreen,
    });
  protectNavigation(floatingWindow);
  await loadRenderer(floatingWindow, 'floating');
  floatingWindow.on('move', () => {
    if (!floatingWindow || floatingWindow.isDestroyed()) return;
    const bounds = floatingWindow.getBounds();
    if (
      programmaticFloatingBounds &&
      bounds.x === programmaticFloatingBounds.x &&
      bounds.y === programmaticFloatingBounds.y
    ) {
      programmaticFloatingBounds = undefined;
      return;
    }
    const previous = boundsSaveTimers.get('floating:placement');
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      boundsSaveTimers.delete('floating:placement');
      if (!floatingWindow || floatingWindow.isDestroyed()) return;
      const current = floatingWindow.getBounds();
      const area = screen.getDisplayMatching(current).workArea;
      const safe = resolveFloatingBounds(
        { position: 'custom', x: current.x, y: current.y },
        screen.getAllDisplays().map((display) => display.workArea),
        area,
      );
      appDatabase.setSetting('floating:settings', {
        position: 'custom',
        x: safe.x,
        y: safe.y,
        opacity: Math.round(floatingWindow.getOpacity() * 100),
      });
    }, 150);
    boundsSaveTimers.set('floating:placement', timer);
  });
}

function floatingBoundsFor(
  settings: import('../shared/contracts.js').FloatingSettings,
): Electron.Rectangle {
  const reference = floatingWindow?.getBounds();
  const target = reference
    ? screen.getDisplayMatching(reference).workArea
    : screen.getPrimaryDisplay().workArea;
  return resolveFloatingBounds(
    settings,
    screen.getAllDisplays().map((display) => display.workArea),
    target,
  );
}

app.whenReady().then(async () => {
  const database = new AppDatabase(
    new DatabaseSync(path.join(app.getPath('userData'), 'sub2api.sqlite')),
  );
  database.migrate();
  database.cleanupSnapshots(Date.now() - 30 * 24 * 60 * 60_000);
  appDatabase = database;
  updateService = new UpdateService(app.getVersion(), {
    get: (key, fallback) => database.getSetting(key, fallback),
    set: (key, value) => database.setSetting(key, value),
  });
  const testCodec = process.env.SUB2API_TEST_SECRET_CODEC === 'memory';
  const vault = new CredentialVault(
    testCodec
      ? {
          isAvailable: () => true,
          encrypt: (value) => Buffer.from(`test:${value}`),
          decrypt: (value) => value.toString().replace(/^test:/, ''),
        }
      : {
          isAvailable: () => safeStorage.isEncryptionAvailable(),
          encrypt: (value) => safeStorage.encryptString(value),
          decrypt: (value) => safeStorage.decryptString(value),
        },
    new FileSecretBackend(path.join(app.getPath('userData'), 'credentials.json')),
  );
  siteService = new SiteService(database, vault);
  siteService.setProgressListener((siteId, phase) =>
    broadcastRefreshState(siteId, 'refreshing', phase),
  );
  siteService.setKeyContextListener((siteId) => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send('keys:changed', { siteId });
  });
  const notifications = new NotificationService(
    { send: (title, body) => new Notification({ title, body }).show() },
    {
      get: (siteId, fingerprint) => database.getNotificationLastSent(siteId, fingerprint),
      set: (siteId, fingerprint, timestamp) =>
        database.setNotificationLastSent(siteId, fingerprint, timestamp),
    },
  );
  notificationService = notifications;
  scheduler = new RefreshScheduler(async (siteId) => {
    broadcastRefreshState(siteId, 'refreshing');
    const summary = await siteService.refresh(siteId);
    const settings = siteService.getNotificationSettings();
    if (summary.balance !== undefined) {
      const siteRule = settings.sites[siteId];
      notifications.lowBalance(
        siteId,
        summary.name,
        summary.balance,
        siteRule?.enabled ?? settings.enabled,
        siteRule?.threshold ?? settings.threshold,
        settings.cooldownMs,
      );
    }
    notifications.health(
      siteId,
      summary.name,
      summary.status !== 'error' && summary.status !== 'auth-required',
      settings.enabled && settings.siteFailures,
      settings.cooldownMs,
      settings.recoveryNotifications,
    );
    broadcastRefreshState(
      siteId,
      summary.status === 'auth-required'
        ? 'auth-required'
        : summary.status === 'error'
          ? 'error'
          : 'success',
    );
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('sites:changed');
    if (summary.status === 'error' || summary.status === 'auth-required')
      throw new Error(summary.status);
  });
  scheduler.setSites(siteService.listSites().sites.map((site) => site.id));
  const currentSiteId = siteService.listSites().currentSiteId;
  if (currentSiteId) scheduler.setCurrentSite(currentSiteId);
  scheduler.start();
  registerIpc();
  createTray();
  await createWindows();
  scheduleRefreshLoops();
});

app.on('before-quit', () => {
  isQuitting = true;
  scheduler?.stop();
  for (const timer of scheduledTimers) clearTimeout(timer);
  for (const timer of boundsSaveTimers.values()) clearTimeout(timer);
  saveBoundsNow('window:main', mainWindow);
});
app.on('window-all-closed', () => {
  /* tray keeps the app resident */
});

function restoreBounds(
  key: string,
  fallback: { x?: number; y?: number; width: number; height: number },
): { x?: number; y?: number; width: number; height: number } {
  const saved = appDatabase?.getSetting<Electron.Rectangle | undefined>(key, undefined);
  if (!saved || saved.width <= 0 || saved.height <= 0) return fallback;
  const visible = screen
    .getAllDisplays()
    .some(
      ({ workArea }) =>
        saved.x < workArea.x + workArea.width &&
        saved.x + saved.width > workArea.x &&
        saved.y < workArea.y + workArea.height &&
        saved.y + saved.height > workArea.y,
    );
  return visible ? saved : fallback;
}

function saveBounds(key: string, window: BrowserWindow | undefined): void {
  const previous = boundsSaveTimers.get(key);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => {
    boundsSaveTimers.delete(key);
    saveBoundsNow(key, window);
  }, 100);
  boundsSaveTimers.set(key, timer);
}

function saveBoundsNow(key: string, window: BrowserWindow | undefined): void {
  if (window && !window.isDestroyed()) appDatabase?.setSetting(key, window.getBounds());
}
