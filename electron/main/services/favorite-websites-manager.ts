import { randomUUID } from 'node:crypto';
import { session, type BrowserWindow, WebContentsView } from 'electron';
import type { AppDatabase } from '../storage/database.js';
import {
  FAVORITE_WEBSITE_LIMIT,
  favoriteWebsitesSchema,
  favoriteWebsitePolicySchema,
  favoriteWebsiteViewBounds,
  isFavoriteWebsiteAllowed,
  isPermanentlyBlockedUrl,
  normalizeFavoriteWebsiteUrl,
  type FavoriteWebsite,
  type FavoriteWebsiteEmbedState,
  type FavoriteWebsiteInput,
  type FavoriteWebsiteTarget,
  type FavoriteWebsiteUpdate,
  type FavoriteWebsitesPolicy,
} from '../../shared/favorite-websites.js';

const FAVORITE_WEBSITE_LOAD_ERROR = '网站网页加载失败，请检查网络后重试。';
const FAVORITE_WEBSITE_BLOCKED_MESSAGE = '当前地址已被常用网站规则拦截。';

export class FavoriteWebsitesManager {
  private view: WebContentsView | undefined;
  private target: FavoriteWebsiteTarget | undefined;
  private currentWebsite: FavoriteWebsite | undefined;
  private cleanup: (() => void) | undefined;
  private openSequence = 0;

  constructor(
    private readonly db: AppDatabase,
    private readonly getMainWindow: () => BrowserWindow | undefined,
    private readonly emit: (state: FavoriteWebsiteEmbedState) => void,
  ) {}

  list(): FavoriteWebsite[] {
    return this.db.getFavoriteWebsites();
  }

  policy(): FavoriteWebsitesPolicy {
    return this.db.getFavoriteWebsitesPolicy();
  }

  create(input: FavoriteWebsiteInput): FavoriteWebsite[] {
    const current = this.db.getFavoriteWebsites();
    if (current.length >= FAVORITE_WEBSITE_LIMIT) throw new Error('FAVORITE_WEBSITE_LIMIT_REACHED');
    const url = normalizeFavoriteWebsiteUrl(input.url);
    if (!url || isPermanentlyBlockedUrl(url)) throw new Error('FAVORITE_WEBSITE_BLOCKED_URL');
    this.assertUnique(current, input.name, url);
    const now = Date.now();
    const id = randomUUID();
    const website: FavoriteWebsite = {
      ...input,
      url,
      id,
      partitionId: 'persist:favorite-website-' + id,
      createdAt: now,
      updatedAt: now,
    };
    this.db.setFavoriteWebsites(favoriteWebsitesSchema.parse([...current, website]));
    return this.list();
  }

  async update(input: FavoriteWebsiteUpdate): Promise<FavoriteWebsite[]> {
    const current = this.db.getFavoriteWebsites();
    const index = current.findIndex((website) => website.id === input.id);
    if (index < 0) throw new Error('FAVORITE_WEBSITE_NOT_FOUND');
    const previous = current[index];
    const url = normalizeFavoriteWebsiteUrl(input.url);
    if (!url || isPermanentlyBlockedUrl(url)) throw new Error('FAVORITE_WEBSITE_BLOCKED_URL');
    this.assertUnique(
      current.filter((website) => website.id !== input.id),
      input.name,
      url,
    );
    const nextWebsite: FavoriteWebsite = {
      ...previous,
      name: input.name,
      url,
      updatedAt: Date.now(),
    };
    const originChanged = new URL(previous.url).origin !== new URL(url).origin;
    const next = current.map((website) => (website.id === input.id ? nextWebsite : website));
    this.db.setFavoriteWebsites(favoriteWebsitesSchema.parse(next));
    if (originChanged) {
      await this.clearWebsiteStorage(nextWebsite);
      if (this.target?.id === nextWebsite.id) await this.open(nextWebsite.id);
    }
    return this.list();
  }

  async delete(id: string): Promise<FavoriteWebsite[]> {
    const current = this.db.getFavoriteWebsites();
    const website = current.find((candidate) => candidate.id === id);
    if (!website) throw new Error('FAVORITE_WEBSITE_NOT_FOUND');
    if (this.target?.id === id) this.closeView();
    await this.clearWebsiteStorage(website);
    this.db.setFavoriteWebsites(
      favoriteWebsitesSchema.parse(current.filter((item) => item.id !== id)),
    );
    return this.list();
  }

  async savePolicy(policy: FavoriteWebsitesPolicy): Promise<FavoriteWebsitesPolicy> {
    const parsed = favoriteWebsitePolicySchema.parse(policy);
    this.db.setFavoriteWebsitesPolicy(parsed);
    if (
      this.currentWebsite &&
      !isFavoriteWebsiteAllowed(this.currentWebsite, parsed) &&
      this.view
    ) {
      this.emitCurrentState(this.view, this.target, this.currentWebsite);
    }
    return parsed;
  }

  async open(id: string): Promise<void> {
    const sequence = ++this.openSequence;
    const mainWindow = this.getMainWindow();
    const website = this.db.getFavoriteWebsites().find((candidate) => candidate.id === id);
    if (!website || !mainWindow) throw new Error('FAVORITE_WEBSITE_NOT_FOUND');
    if (!isFavoriteWebsiteAllowed(website, this.policy()))
      throw new Error('FAVORITE_WEBSITE_POLICY_BLOCKED');

    const previous =
      this.view && this.target && this.currentWebsite
        ? {
            view: this.view,
            target: this.target,
            website: this.currentWebsite,
            cleanup: this.cleanup,
          }
        : undefined;
    const target: FavoriteWebsiteTarget = { id: website.id, label: website.name };
    this.emit({ status: 'opening', target });
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        partition: website.partitionId,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    });
    this.view = view;
    this.target = target;
    this.currentWebsite = website;

    const fail = () => {
      if (this.view !== view) return;
      const cleanup = this.cleanup;
      this.view = previous?.view;
      this.target = previous?.target;
      this.currentWebsite = previous?.website;
      this.cleanup = previous?.cleanup;
      cleanup?.();
      if (!view.webContents.isDestroyed()) view.webContents.close({ waitForBeforeUnload: false });
      if (!mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(view);
      if (previous) this.emitCurrentState(previous.view, previous.target, previous.website);
      else this.emit({ status: 'error', target, message: FAVORITE_WEBSITE_LOAD_ERROR });
    };

    const onWillNavigate = (event: Electron.Event<{ isMainFrame: boolean; url: string }>) => {
      if (
        !event.isMainFrame ||
        isFavoriteWebsiteAllowed({ url: event.url } as FavoriteWebsite, this.policy())
      )
        return;
      event.preventDefault();
      this.emitBlocked(view, target);
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
      if (isMainFrame) fail();
    };
    const onWillAttachWebview = (event: Electron.Event) => event.preventDefault();
    const onDestroyed = () => {
      if (this.view !== view) return;
      this.view = undefined;
      this.target = undefined;
      this.currentWebsite = undefined;
      this.cleanup = undefined;
      const window = this.getMainWindow();
      if (window && !window.isDestroyed()) window.contentView.removeChildView(view);
      this.emit({ status: 'idle' });
    };
    const syncState = () => this.emitCurrentState(view, target, website);
    const onDidNavigate = (_event: Electron.Event, url: string) => {
      if (!isFavoriteWebsiteAllowed({ url } as FavoriteWebsite, this.policy())) {
        this.emitBlocked(view, target);
        return;
      }
      syncState();
    };
    const onDidNavigateInPage = () => syncState();
    const onDidStartLoading = () => syncState();
    const onDidStopLoading = () => syncState();

    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('will-navigate', onWillNavigate);
    view.webContents.on('will-redirect', onWillNavigate);
    view.webContents.on('will-attach-webview', onWillAttachWebview);
    view.webContents.on('before-input-event', onBeforeInput);
    view.webContents.on('did-fail-load', onDidFailLoad);
    view.webContents.on('did-navigate', onDidNavigate);
    view.webContents.on('did-navigate-in-page', onDidNavigateInPage);
    view.webContents.on('did-start-loading', onDidStartLoading);
    view.webContents.on('did-stop-loading', onDidStopLoading);
    view.webContents.on('destroyed', onDestroyed);
    this.cleanup = () => {
      view.webContents.removeListener('will-navigate', onWillNavigate);
      view.webContents.removeListener('will-redirect', onWillNavigate);
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
      await this.loadWebsitePage(view.webContents, website.url);
      if (sequence !== this.openSequence) return;
      if (this.view === view) {
        await this.waitForDomReady();
        syncState();
      }
    } catch {
      if (sequence !== this.openSequence) return;
      fail();
    }
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
    if (!this.currentWebsite || !this.view?.webContents) return;
    if (!isFavoriteWebsiteAllowed(this.currentWebsite, this.policy())) {
      this.emitBlocked(this.view, this.target);
      return;
    }
    void this.view.webContents.loadURL(this.currentWebsite.url);
  }

  close(): void {
    this.closeView();
  }

  syncBounds(): void {
    const mainWindow = this.getMainWindow();
    if (!this.view || !mainWindow || mainWindow.isDestroyed()) return;
    const [width, height] = mainWindow.getContentSize();
    this.view.setBounds(favoriteWebsiteViewBounds({ width, height }));
  }

  closeView(notify = true): void {
    const view = this.view;
    const cleanup = this.cleanup;
    this.view = undefined;
    this.target = undefined;
    this.currentWebsite = undefined;
    this.cleanup = undefined;
    cleanup?.();
    if (view) {
      const mainWindow = this.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(view);
      if (!view.webContents.isDestroyed()) view.webContents.close({ waitForBeforeUnload: false });
    }
    if (notify) this.emit({ status: 'idle' });
  }

  private emitBlocked(view: WebContentsView, target: FavoriteWebsiteTarget | undefined): void {
    if (this.view !== view || !target) return;
    this.emit({ status: 'blocked', target, message: FAVORITE_WEBSITE_BLOCKED_MESSAGE });
  }

  private emitCurrentState(
    view = this.view,
    target = this.target,
    website = this.currentWebsite,
  ): void {
    if (!view || !target || !website || view.webContents.isDestroyed()) return;
    this.emit({
      status: 'open',
      target,
      url: view.webContents.getURL(),
      canGoBack: view.webContents.navigationHistory.canGoBack(),
      canGoForward: view.webContents.navigationHistory.canGoForward(),
      loading: view.webContents.isLoading(),
    });
  }

  private loadWebsitePage(webContents: Electron.WebContents, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        webContents.removeListener('dom-ready', onReady);
        webContents.removeListener('did-fail-load', onFail);
        reject(new Error(FAVORITE_WEBSITE_LOAD_ERROR));
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
        reject(new Error(FAVORITE_WEBSITE_LOAD_ERROR));
      };
      webContents.once('dom-ready', onReady);
      webContents.once('did-fail-load', onFail);
      void webContents.loadURL(url).catch(() => undefined);
    });
  }

  private waitForDomReady(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 2_500));
  }

  private assertUnique(websites: FavoriteWebsite[], name: string, url: string): void {
    if (websites.some((website) => website.name.trim() === name.trim()))
      throw new Error('FAVORITE_WEBSITE_DUPLICATE_NAME');
    if (websites.some((website) => website.url === url))
      throw new Error('FAVORITE_WEBSITE_DUPLICATE_URL');
  }

  private async clearWebsiteStorage(website: FavoriteWebsite): Promise<void> {
    const targetSession = session.fromPartition(website.partitionId);
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
