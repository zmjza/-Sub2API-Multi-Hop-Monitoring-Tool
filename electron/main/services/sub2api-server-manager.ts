import { randomUUID } from 'node:crypto';
import { session, type BrowserWindow, WebContentsView } from 'electron';
import type { AppDatabase } from '../storage/database.js';
import {
  SUB2API_SERVER_MENU_LIMIT,
  SUB2API_SERVER_LIMIT,
  isAllowedSub2ApiServerNavigation,
  isSub2ApiServerLoginRoute,
  normalizeSub2ApiServerUrl,
  resolveSub2ApiServerLoginState,
  sanitizeSub2ApiDiscoveredMenus,
  sub2apiShortcutUrl,
  sub2apiServerViewBounds,
  type Sub2ApiDiscoveredMenu,
  type Sub2ApiMenu,
  type Sub2ApiMenuDiscoveryResult,
  type Sub2ApiServer,
  type Sub2ApiServerEmbedState,
  type Sub2ApiServerInput,
  type Sub2ApiServerLoginState,
  type Sub2ApiServerTarget,
  type Sub2ApiServerUpdateInput,
} from '../../shared/sub2api-server.js';

const SUB2API_SERVER_LOAD_ERROR = '服务器网页加载失败，请检查网络后重试。';
const SUB2API_MENU_DISCOVERY_FAILED = '菜单获取失败，请稍后重试。';
const SUB2API_MENU_LOGIN_REQUIRED = '请先打开服务器并登录账号。';
const SUB2API_MENU_LOGIN_EXPIRED = '登录已过期，请重新登录后刷新菜单。';

const sub2apiMenuExtractionScript = `
(() => {
  const maxItems = Number(${SUB2API_SERVER_MENU_LIMIT});
  const origin = String(${JSON.stringify('__ORIGIN__')});
  const loginPath = /(^|\\/)(login|signin|sign-in|auth|logon|logout|signout|register|forgot)([\\/?#]|$)/i;
  const labelFor = (element) => {
    const own = (element.getAttribute('aria-label') || '').trim();
    if (own) return own;
    const text = (element.textContent || '').replace(/\\s+/g, ' ').trim();
    return text.length > 120 ? text.slice(0, 120).trim() : text;
  };
  const visible = (element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden';
  };
  const collect = (root) => {
    const found = [];
    const seen = new Set();
    const anchors = Array.from(root.querySelectorAll('a[href]'));
    for (const anchor of anchors) {
      if (found.length >= maxItems) break;
      if (!visible(anchor)) continue;
      let raw = anchor.getAttribute('href') || '';
      if (/^(#|javascript:|mailto:|tel:|data:)/i.test(raw.trim())) continue;
      let href;
      try {
        href = new URL(raw, window.location.href).toString();
      } catch {
        continue;
      }
      if (href.startsWith('http:') || !href.startsWith(origin) || loginPath.test(href)) continue;
      const label = labelFor(anchor);
      if (!label || label.length > 80 || seen.has(href)) continue;
      seen.add(href);
      const nav = anchor.closest('nav, aside, [role="navigation"], .sidebar, .menu, [class*="menu" i], [class*="nav" i]');
      const parentLabel = nav && nav !== root && labelFor(nav).length > 0 ? labelFor(nav).slice(0, 80) : '';
      found.push({ label, href, ...(parentLabel ? { parentLabel } : {}) });
    }
    return found;
  };
  const roots = [
    ...document.querySelectorAll('nav, aside, [role="navigation"]'),
  ].filter(visible);
  const results = roots.length > 0 ? roots.flatMap(collect) : collect(document.body);
  const unique = [];
  const seen = new Set();
  for (const item of results) {
    if (unique.length >= maxItems) break;
    const key = item.href + '|' + item.label;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
})()
`;

export class Sub2ApiServerManager {
  private view: WebContentsView | undefined;
  private discoveryView: WebContentsView | undefined;
  private target: Sub2ApiServerTarget | undefined;
  private currentServer: Sub2ApiServer | undefined;
  private cleanup: (() => void) | undefined;
  private discoveryAbort: (() => void) | undefined;

  constructor(
    private readonly db: AppDatabase,
    private readonly getMainWindow: () => BrowserWindow | undefined,
    private readonly emit: (state: Sub2ApiServerEmbedState) => void,
  ) {}

  list(): Sub2ApiServer[] {
    return this.db.getSub2ApiServers();
  }

  create(input: Sub2ApiServerInput): Sub2ApiServer[] {
    const current = this.db.getSub2ApiServers();
    if (current.length >= SUB2API_SERVER_LIMIT) throw new Error('SUB2API_SERVER_LIMIT_REACHED');
    this.assertUnique(current, input.name, input.baseUrl);
    const now = Date.now();
    const id = randomUUID();
    const server: Sub2ApiServer = {
      ...input,
      id,
      partitionId: `persist:sub2api-server-${id}`,
      loginState: 'unknown',
      seenLoggedIn: false,
      createdAt: now,
      updatedAt: now,
      shortcuts: input.shortcuts.map((shortcut) => ({ ...shortcut, id: randomUUID() })),
    };
    this.db.setSub2ApiServers([...current, server]);
    return this.list();
  }

  async update(input: Sub2ApiServerUpdateInput): Promise<Sub2ApiServer[]> {
    const current = this.db.getSub2ApiServers();
    const index = current.findIndex((server) => server.id === input.id);
    if (index < 0) throw new Error('SUB2API_SERVER_NOT_FOUND');
    const previous = current[index]!;
    this.assertUnique(
      current.filter((server) => server.id !== input.id),
      input.name,
      input.baseUrl,
    );
    const originChanged =
      normalizeSub2ApiServerUrl(previous.baseUrl) !== normalizeSub2ApiServerUrl(input.baseUrl);
    const shortcuts = input.shortcuts.map((shortcut) => {
      const existing = previous.shortcuts.find((candidate) => candidate.id === shortcut.id);
      return {
        id: existing?.id ?? randomUUID(),
        label: shortcut.label,
        path: shortcut.path,
        ...(shortcut.icon !== undefined ? { icon: shortcut.icon } : {}),
        ...(shortcut.menuId !== undefined ? { menuId: shortcut.menuId } : {}),
      };
    });
    const next: Sub2ApiServer = {
      ...previous,
      name: input.name,
      baseUrl: normalizeSub2ApiServerUrl(input.baseUrl),
      ...(input.loginRule !== undefined ? { loginRule: input.loginRule } : {}),
      shortcuts,
      updatedAt: Date.now(),
      ...(originChanged
        ? { loginState: 'unknown' as const, seenLoggedIn: false }
        : { loginState: previous.loginState, seenLoggedIn: previous.seenLoggedIn }),
    };
    current[index] = next;
    this.db.setSub2ApiServers(current);
    if (originChanged) {
      await this.clearServerStorage(next);
      this.db.clearSub2ApiMenus(next.id);
    }
    if (this.target?.id === next.id) await this.open(next.id);
    return this.list();
  }

  async delete(id: string): Promise<Sub2ApiServer[]> {
    const current = this.db.getSub2ApiServers();
    const server = current.find((candidate) => candidate.id === id);
    if (!server) throw new Error('SUB2API_SERVER_NOT_FOUND');
    if (this.target?.id === id) this.closeView();
    await this.clearServerStorage(server);
    this.db.clearSub2ApiMenus(server.id);
    this.db.setSub2ApiServers(current.filter((candidate) => candidate.id !== id));
    return this.list();
  }

  async clearSession(id: string): Promise<void> {
    const server = this.db.getSub2ApiServers().find((candidate) => candidate.id === id);
    if (!server) throw new Error('SUB2API_SERVER_NOT_FOUND');
    await this.clearServerStorage(server);
    this.db.clearSub2ApiMenus(server.id);
    this.persistLoginState(server.id, 'unknown', false);
    if (this.target?.id === id) await this.open(id);
    else this.emit({ status: 'idle' });
  }

  listMenus(id: string): Sub2ApiMenu[] {
    const server = this.db.getSub2ApiServers().find((candidate) => candidate.id === id);
    if (!server) throw new Error('SUB2API_SERVER_NOT_FOUND');
    return this.db.getSub2ApiMenus(server.id);
  }

  async discoverMenus(id: string): Promise<Sub2ApiMenuDiscoveryResult> {
    const server = this.db.getSub2ApiServers().find((candidate) => candidate.id === id);
    if (!server) throw new Error('SUB2API_SERVER_NOT_FOUND');
    if (this.view && this.target?.id !== id) throw new Error('SUB2API_MENU_ANOTHER_SERVER_OPEN');

    const serverUrl = normalizeSub2ApiServerUrl(server.baseUrl);
    if (this.view && this.target?.id === id) {
      const currentUrl = this.view.webContents.getURL();
      if (isSub2ApiServerLoginRoute(currentUrl, server.loginRule)) {
        return server.seenLoggedIn
          ? { status: 'login', message: SUB2API_MENU_LOGIN_EXPIRED }
          : { status: 'login', message: SUB2API_MENU_LOGIN_REQUIRED };
      }
      await this.waitForDomReady();
      const discovered = await this.extractMenus(this.view.webContents, serverUrl, server.baseUrl);
      return this.persistMenus(server, discovered);
    }

    this.closeDiscoveryView();
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        partition: server.partitionId,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    });
    this.discoveryView = view;
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const allowedOrigin = new URL(server.baseUrl).origin;
    const rejectExternal = (event: Electron.Event<{ isMainFrame: boolean; url: string }>) => {
      if (!event.isMainFrame || isAllowedSub2ApiServerNavigation(event.url, allowedOrigin)) return;
      event.preventDefault();
    };
    const onWillAttachWebview = (event: Electron.Event) => event.preventDefault();
    view.webContents.on('will-navigate', rejectExternal);
    view.webContents.on('will-redirect', rejectExternal);
    view.webContents.on('will-attach-webview', onWillAttachWebview);
    const onDestroyed = () => {
      if (this.discoveryView !== view) return;
      this.discoveryView = undefined;
      this.discoveryAbort?.();
      this.discoveryAbort = undefined;
    };
    view.webContents.on('destroyed', onDestroyed);
    this.discoveryAbort = () => {
      if (this.discoveryView !== view) return;
      view.webContents.removeListener('will-navigate', rejectExternal);
      view.webContents.removeListener('will-redirect', rejectExternal);
      view.webContents.removeListener('will-attach-webview', onWillAttachWebview);
      view.webContents.removeListener('destroyed', onDestroyed);
      const mainWindow = this.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(view);
      if (!view.webContents.isDestroyed()) view.webContents.close({ waitForBeforeUnload: false });
      this.discoveryView = undefined;
      this.discoveryAbort = undefined;
    };

    try {
      const mainWindow = this.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.contentView.addChildView(view);
        view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      }
      await this.loadForDiscovery(view.webContents, serverUrl);
      const currentUrl = view.webContents.getURL();
      if (isSub2ApiServerLoginRoute(currentUrl, server.loginRule)) {
        return server.seenLoggedIn
          ? { status: 'login', message: SUB2API_MENU_LOGIN_EXPIRED }
          : { status: 'login', message: SUB2API_MENU_LOGIN_REQUIRED };
      }
      await this.waitForDomReady();
      const discovered = await this.extractMenus(view.webContents, serverUrl, server.baseUrl);
      return this.persistMenus(server, discovered);
    } finally {
      this.discoveryAbort?.();
    }
  }

  async open(id: string, targetUrl?: string): Promise<void> {
    const mainWindow = this.getMainWindow();
    const server = this.db.getSub2ApiServers().find((candidate) => candidate.id === id);
    if (!server || !mainWindow) throw new Error('SUB2API_SERVER_NOT_FOUND');
    const url = targetUrl ?? normalizeSub2ApiServerUrl(server.baseUrl);
    if (!isAllowedSub2ApiServerNavigation(url, new URL(server.baseUrl).origin))
      throw new Error('SUB2API_SERVER_NAVIGATION_BLOCKED');
    this.closeDiscoveryView();
    this.closeView(false);
    const target: Sub2ApiServerTarget = { id: server.id, label: server.name };
    this.emit({ status: 'opening', target });

    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        partition: server.partitionId,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    });
    this.view = view;
    this.target = target;
    this.currentServer = server;

    const allowedOrigin = new URL(server.baseUrl).origin;
    const rejectExternalNavigation = (
      event: Electron.Event<{ isMainFrame: boolean; url: string }>,
    ) => {
      if (!event.isMainFrame || isAllowedSub2ApiServerNavigation(event.url, allowedOrigin)) return;
      event.preventDefault();
      this.failView(view, target);
    };
    const onBeforeInput = (event: Electron.Event, input: Electron.Input) => {
      if (input.type !== 'keyDown' || input.key !== 'Escape') return;
      event.preventDefault();
      this.closeView();
    };
    const onDidFailLoad = (
      _event: Electron.Event,
      _errorCode: number,
      _errorDescription: string,
      _validatedURL: string,
      isMainFrame: boolean,
    ) => {
      if (isMainFrame) this.failView(view, target);
    };
    const onWillAttachWebview = (event: Electron.Event) => event.preventDefault();
    const onDestroyed = () => {
      if (this.view !== view) return;
      this.view = undefined;
      this.target = undefined;
      this.currentServer = undefined;
      this.cleanup = undefined;
      const mainWindow = this.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(view);
      this.emit({ status: 'idle' });
    };
    const syncState = () => this.emitCurrentState(view, target, server);
    const onDidNavigate = (_event: Electron.Event, url: string, httpResponseCode: number) => {
      if (!isAllowedSub2ApiServerNavigation(url, allowedOrigin)) {
        this.failView(view, target);
        return;
      }
      this.updateLoginState(server, url, httpResponseCode);
      syncState();
    };
    const onDidNavigateInPage = () => syncState();
    const onDidStartLoading = () => syncState();
    const onDidStopLoading = () => syncState();

    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('will-navigate', rejectExternalNavigation);
    view.webContents.on('will-redirect', rejectExternalNavigation);
    view.webContents.on('will-attach-webview', onWillAttachWebview);
    view.webContents.on('before-input-event', onBeforeInput);
    view.webContents.on('did-fail-load', onDidFailLoad);
    view.webContents.on('did-navigate', onDidNavigate);
    view.webContents.on('did-navigate-in-page', onDidNavigateInPage);
    view.webContents.on('did-start-loading', onDidStartLoading);
    view.webContents.on('did-stop-loading', onDidStopLoading);
    view.webContents.on('destroyed', onDestroyed);
    this.cleanup = () => {
      view.webContents.removeListener('will-navigate', rejectExternalNavigation);
      view.webContents.removeListener('will-redirect', rejectExternalNavigation);
      view.webContents.removeListener('will-attach-webview', onWillAttachWebview);
      view.webContents.removeListener('before-input-event', onBeforeInput);
      view.webContents.removeListener('did-fail-load', onDidFailLoad);
      view.webContents.removeListener('did-navigate', onDidNavigate);
      view.webContents.removeListener('did-navigate-in-page', onDidNavigateInPage);
      view.webContents.removeListener('did-start-loading', onDidStartLoading);
      view.webContents.removeListener('did-stop-loading', onDidStopLoading);
      view.webContents.removeListener('destroyed', onDestroyed);
    };

    mainWindow.contentView.addChildView(view);
    this.syncBounds();
    try {
      await this.loadForDiscovery(view.webContents, url);
      if (this.view === view) {
        await this.waitForDomReady();
        syncState();
      }
    } catch {
      this.failView(view, target);
    }
  }

  async openShortcut(id: string, shortcutId: string): Promise<void> {
    const server = this.db.getSub2ApiServers().find((candidate) => candidate.id === id);
    const shortcut = server?.shortcuts.find((candidate) => candidate.id === shortcutId);
    const url = shortcut ? sub2apiShortcutUrl(server!.baseUrl, shortcut.path) : undefined;
    if (!url) throw new Error('SUB2API_SERVER_SHORTCUT_NOT_FOUND');
    await this.open(id, url);
  }

  navigateBack(): void {
    if (this.view?.webContents.navigationHistory.canGoBack()) {
      this.view.webContents.navigationHistory.goBack();
      this.emitCurrentState();
    }
  }

  navigateForward(): void {
    if (this.view?.webContents.navigationHistory.canGoForward()) {
      this.view.webContents.navigationHistory.goForward();
      this.emitCurrentState();
    }
  }

  reload(): void {
    if (this.view?.webContents) this.view.webContents.reload();
  }

  home(): void {
    if (!this.currentServer || !this.view?.webContents) return;
    void this.view.webContents.loadURL(normalizeSub2ApiServerUrl(this.currentServer.baseUrl));
  }

  close(): void {
    this.closeView();
  }

  syncBounds(): void {
    const mainWindow = this.getMainWindow();
    if (!this.view || !mainWindow || mainWindow.isDestroyed()) return;
    const [width, height] = mainWindow.getContentSize();
    this.view.setBounds(sub2apiServerViewBounds({ width, height }));
  }

  closeView(notify = true): void {
    this.closeDiscoveryView();
    const view = this.view;
    const cleanup = this.cleanup;
    this.view = undefined;
    this.target = undefined;
    this.currentServer = undefined;
    this.cleanup = undefined;
    cleanup?.();
    if (view) {
      const mainWindow = this.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(view);
      if (!view.webContents.isDestroyed()) view.webContents.close({ waitForBeforeUnload: false });
    }
    if (notify) this.emit({ status: 'idle' });
  }

  private closeDiscoveryView(): void {
    this.discoveryAbort?.();
    this.discoveryAbort = undefined;
    this.discoveryView = undefined;
  }

  private loadForDiscovery(webContents: Electron.WebContents, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        webContents.removeListener('dom-ready', onReady);
        webContents.removeListener('did-fail-load', onFail);
        reject(new Error(SUB2API_MENU_DISCOVERY_FAILED));
      }, 20_000);
      const onReady = () => {
        clearTimeout(timeout);
        webContents.removeListener('dom-ready', onReady);
        webContents.removeListener('did-fail-load', onFail);
        resolve();
      };
      const onFail = (
        _event: Electron.Event,
        _errorCode: number,
        _errorDescription: string,
        _validatedURL: string,
        isMainFrame: boolean,
      ) => {
        if (!isMainFrame) return;
        clearTimeout(timeout);
        webContents.removeListener('dom-ready', onReady);
        webContents.removeListener('did-fail-load', onFail);
        reject(new Error(SUB2API_MENU_DISCOVERY_FAILED));
      };
      webContents.once('dom-ready', onReady);
      webContents.once('did-fail-load', onFail);
      void webContents.loadURL(url).catch(() => undefined);
    });
  }

  private waitForDomReady(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 2_500));
  }

  private async extractMenus(
    webContents: Electron.WebContents,
    serverUrl: string,
    baseUrl: string,
  ): Promise<Sub2ApiDiscoveredMenu[]> {
    const allowedOrigin = new URL(serverUrl).origin;
    const script = sub2apiMenuExtractionScript.replace('__ORIGIN__', allowedOrigin);
    let discovered: Sub2ApiDiscoveredMenu[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let raw: unknown;
      try {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 400));
        raw = await webContents.executeJavaScript(script, true);
      } catch {
        throw new Error(SUB2API_MENU_DISCOVERY_FAILED);
      }
      discovered = Array.isArray(raw)
        ? sanitizeSub2ApiDiscoveredMenus(
            baseUrl,
            (raw as Array<{ label?: unknown; href?: unknown; parentLabel?: unknown }>).flatMap(
              (item) => {
                if (typeof item.label !== 'string' || typeof item.href !== 'string') return [];
                const normalized: { label: string; href: string; parentLabel?: string } = {
                  label: item.label,
                  href: item.href,
                };
                if (typeof item.parentLabel === 'string' && item.parentLabel.trim())
                  normalized.parentLabel = item.parentLabel;
                return [normalized];
              },
            ),
          )
        : [];
      if (discovered.length > 0) break;
    }
    return discovered;
  }

  private persistMenus(
    server: Sub2ApiServer,
    discovered: Sub2ApiDiscoveredMenu[],
  ): Sub2ApiMenuDiscoveryResult {
    const discoveredAt = Date.now();
    const menus: Sub2ApiMenu[] = discovered.map((menu, index) => ({
      ...menu,
      id: randomUUID(),
      order: menu.order ?? index,
      discoveredAt,
    }));
    this.db.setSub2ApiMenus(server.id, menus);
    return { status: 'ready', menus };
  }

  private failView(view: WebContentsView, target: Sub2ApiServerTarget): void {
    if (this.view !== view || !this.target) return;
    this.closeView(false);
    this.emit({ status: 'error', target, message: SUB2API_SERVER_LOAD_ERROR });
  }

  private emitCurrentState(
    view = this.view,
    target = this.target,
    server = this.currentServer,
  ): void {
    if (!view || !target || !server || view.webContents.isDestroyed()) return;
    const loginState = this.db
      .getSub2ApiServers()
      .find((item) => item.id === server.id)?.loginState;
    this.emit({
      status: 'open',
      target,
      url: view.webContents.getURL(),
      canGoBack: view.webContents.navigationHistory.canGoBack(),
      canGoForward: view.webContents.navigationHistory.canGoForward(),
      loading: view.webContents.isLoading(),
      loginState: loginState ?? 'unknown',
    });
  }

  private updateLoginState(server: Sub2ApiServer, url: string, httpResponseCode: number): void {
    const current = this.db.getSub2ApiServers().find((item) => item.id === server.id);
    if (!current) return;
    const resolved = resolveSub2ApiServerLoginState(current, url, httpResponseCode);
    if (
      resolved.loginState === current.loginState &&
      resolved.seenLoggedIn === current.seenLoggedIn
    )
      return;
    this.persistLoginState(current.id, resolved.loginState, resolved.seenLoggedIn);
  }

  private persistLoginState(
    id: string,
    loginState: Sub2ApiServerLoginState,
    seenLoggedIn: boolean,
  ): void {
    this.db.setSub2ApiServers(
      this.db
        .getSub2ApiServers()
        .map((item) =>
          item.id === id ? { ...item, loginState, seenLoggedIn, updatedAt: Date.now() } : item,
        ),
    );
  }

  private assertUnique(servers: Sub2ApiServer[], name: string, baseUrl: string): void {
    const normalized = normalizeSub2ApiServerUrl(baseUrl);
    if (servers.some((server) => server.name.trim() === name.trim()))
      throw new Error('SUB2API_SERVER_DUPLICATE_NAME');
    if (servers.some((server) => normalizeSub2ApiServerUrl(server.baseUrl) === normalized))
      throw new Error('SUB2API_SERVER_DUPLICATE_URL');
  }

  private async clearServerStorage(server: Sub2ApiServer): Promise<void> {
    const targetSession = session.fromPartition(server.partitionId);
    await Promise.allSettled([
      targetSession.clearStorageData({
        storages: [
          'cookies',
          'localstorage',
          'indexdb',
          'cachestorage',
          'serviceworkers',
          'shadercache',
        ],
      }),
      targetSession.clearCache(),
    ]);
  }
}
