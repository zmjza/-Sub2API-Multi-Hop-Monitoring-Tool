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
} from 'electron';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  siteInputSchema,
  batchSiteInputSchema,
  refreshRequestSchema,
  usageQuerySchema,
  keyPreferenceSchema,
  notificationSettingsSchema,
  channelStatusRequestSchema,
  startupSettingSchema,
  floatingSettingsSchema,
  appSettingsSchema,
  usageFilterOptionsSchema,
  siteSummarySchema,
  dashboardSnapshotSchema,
  usagePayloadSchema,
  channelViewSchema,
  channelDetailViewSchema,
  apiKeySummarySchema,
} from '../shared/contracts.js';
import { AppDatabase } from './storage/database.js';
import { CredentialVault } from './storage/credential-vault.js';
import { FileSecretBackend } from './storage/file-secret-backend.js';
import { SiteService } from './services/site-service.js';
import { RefreshScheduler } from './services/refresh-scheduler.js';
import { NotificationService } from './services/notification-service.js';
import { intervalInRange } from './domain/scheduler.js';
import { createTrayMenuTemplate, trayIconDataUrl } from './tray-icon.js';
import { floatingCornerBounds, type FloatingCorner } from './domain/window-bounds.js';

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
const scheduledTimers: NodeJS.Timeout[] = [];
const boundsSaveTimers = new Map<string, NodeJS.Timeout>();

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

function broadcastRefreshState(
  siteId: string,
  state: 'refreshing' | 'success' | 'error' | 'auth-required',
  phase?: string,
) {
  for (const window of BrowserWindow.getAllWindows())
    window.webContents.send('sites:refresh-state', { siteId, state, phase });
}

function registerIpc() {
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
    const result = await siteService.addAndVerify(siteInputSchema.parse(input));
    scheduler.setSites(siteService.listSites().sites.map((site) => site.id));
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('sites:changed');
    return siteSummarySchema.parse(result);
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
    broadcastRefreshState(siteId, 'refreshing');
    const result = siteSummarySchema.parse(await siteService.refresh(siteId));
    broadcastRefreshState(
      siteId,
      result.status === 'auth-required'
        ? 'auth-required'
        : result.status === 'error'
          ? 'error'
          : 'success',
    );
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('sites:changed');
    return result;
  });
  ipcMain.handle('usage:list', async (_event, input: unknown) =>
    usagePayloadSchema.parse(await siteService.usage(usageQuerySchema.parse(input))),
  );
  ipcMain.handle('usage:filters', async (_event, input: unknown) => {
    const siteId = refreshRequestSchema.parse({ siteId: input }).siteId;
    return usageFilterOptionsSchema.parse(await siteService.usageFilters(siteId));
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
    const result = channelViewSchema.parse(await siteService.channels(siteId));
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
  ipcMain.handle('keys:list', (_event, input: unknown) =>
    apiKeySummarySchema
      .array()
      .parse(siteService.listKeys(refreshRequestSchema.parse({ siteId: input }).siteId)),
  );
  ipcMain.handle('keys:preference:get', (_event, input: unknown) =>
    siteService.getKeyPreference(refreshRequestSchema.parse({ siteId: input }).siteId),
  );
  ipcMain.handle('keys:preference:set', (_event, input: unknown) => {
    const value = input as { siteId?: unknown; mode?: unknown; keyId?: unknown };
    const siteId = refreshRequestSchema.parse({ siteId: value.siteId }).siteId;
    return siteService.setKeyPreference(
      siteId,
      keyPreferenceSchema.parse({ mode: value.mode, keyId: value.keyId }),
    );
  });
  ipcMain.handle('notifications:get', () => siteService.getNotificationSettings());
  ipcMain.handle('notifications:set', (_event, input: unknown) =>
    siteService.setNotificationSettings(notificationSettingsSchema.parse(input)),
  );
  ipcMain.handle('notifications:permission', () => ({ supported: Notification.isSupported() }));
  ipcMain.on('window:open-main', () => {
    mainWindow?.show();
    mainWindow?.focus();
    setTimeout(() => floatingWindow?.hide(), 50);
  });
  ipcMain.on('window:minimize-main', () => {
    if (appSettingsSchema.parse(appDatabase.getAppSettings()).floatingEnabled) {
      mainWindow?.hide();
      floatingWindow?.show();
      floatingWindow?.focus();
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
      appDatabase.getSetting('floating:settings', { position: 'top-right' }),
    ),
  );
  ipcMain.handle('floating:set', (_event, input: unknown) => {
    const settings = floatingSettingsSchema.parse(input);
    appDatabase.setSetting('floating:settings', settings);
    floatingWindow?.setBounds(floatingBoundsFor(settings.position));
    return settings;
  });
  ipcMain.handle('app-settings:get', () => appSettingsSchema.parse(appDatabase.getAppSettings()));
  ipcMain.handle('app-settings:set', (_event, input: unknown) => {
    const settings = appSettingsSchema.parse(input);
    appDatabase.setAppSettings(settings);
    if (!settings.floatingEnabled) floatingWindow?.hide();
    return settings;
  });
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
        showMain: () => mainWindow?.show(),
        toggleFloating: () =>
          floatingWindow?.isVisible() ? floatingWindow.hide() : floatingWindow?.showInactive(),
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
    appDatabase.getSetting('floating:settings', { position: 'top-right' }),
  );
  const floatingBounds = floatingBoundsFor(floatingSettings.position);
  floatingWindow = new BrowserWindow({
    ...secureWindowOptions(),
    ...floatingBounds,
    width: 380,
    height: 260,
    resizable: false,
    alwaysOnTop: false,
    focusable: true,
  });
  protectNavigation(floatingWindow);
  await loadRenderer(floatingWindow, 'floating');
}

function floatingBoundsFor(position: FloatingCorner): Electron.Rectangle {
  return floatingCornerBounds(position, screen.getPrimaryDisplay().workArea);
}

app.whenReady().then(async () => {
  const database = new AppDatabase(
    new DatabaseSync(path.join(app.getPath('userData'), 'sub2api.sqlite')),
  );
  database.migrate();
  database.cleanupSnapshots(Date.now() - 30 * 24 * 60 * 60_000);
  appDatabase = database;
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
  saveBoundsNow('window:floating', floatingWindow);
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
