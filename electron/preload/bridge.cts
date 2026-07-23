import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge } from './index.js';

let pendingAppSettings: Promise<unknown> = Promise.resolve();

const desktopBridge: DesktopBridge = {
  platform: process.platform,
  shellVersion: '1.4.1',
  sites: {
    list: () => ipcRenderer.invoke('sites:list'),
    select: (siteId) => ipcRenderer.invoke('sites:select', siteId),
    delete: (siteId) => ipcRenderer.invoke('sites:delete', siteId),
    addAndVerify: (input) => ipcRenderer.invoke('sites:add-and-verify', input),
    addBatch: (input) => ipcRenderer.invoke('sites:add-batch', input),
    refresh: (siteId) => ipcRenderer.invoke('sites:refresh', siteId),
    refreshAll: () => ipcRenderer.invoke('sites:refresh-all'),
    rateContexts: () => ipcRenderer.invoke('rates:contexts'),
    refreshRateGroups: (siteId) => ipcRenderer.invoke('rates:refresh', siteId),
    refreshAllRateGroups: () => ipcRenderer.invoke('rates:refresh-all'),
    setRechargeRatio: (siteId, ratio) => ipcRenderer.invoke('rates:ratio:set', { siteId, ratio }),
    usage: (query) => ipcRenderer.invoke('usage:list', query),
    usageStats: (query) => ipcRenderer.invoke('usage:stats', query),
    usageGroups: (siteId) => ipcRenderer.invoke('usage:groups', siteId),
    usageModels: (siteId) => ipcRenderer.invoke('usage:models', siteId),
    usageCsv: (query) => ipcRenderer.invoke('usage:csv', query),
    channels: (siteId) => ipcRenderer.invoke('channels:list', siteId),
    channelStatus: (siteId, channelId) =>
      ipcRenderer.invoke('channels:status', { siteId, channelId }),
    keys: (siteId) => ipcRenderer.invoke('keys:list', siteId),
    apiKeys: (query) => ipcRenderer.invoke('api-keys:list', query),
    updateApiKeyGroup: (input) => ipcRenderer.invoke('api-keys:update-group', input),
    keyContexts: () => ipcRenderer.invoke('keys:contexts'),
    keyPreference: (siteId) => ipcRenderer.invoke('keys:preference:get', siteId),
    setKeyPreference: (siteId, value) =>
      ipcRenderer.invoke('keys:preference:set', { siteId, ...value }),
    setNote: (siteId, note) => ipcRenderer.invoke('sites:note:set', { siteId, note }),
    notificationSettings: () => ipcRenderer.invoke('notifications:get'),
    setNotificationSettings: (value) => ipcRenderer.invoke('notifications:set', value),
    openMainWindow: () => ipcRenderer.send('window:open-main'),
    minimizeMainWindow: () => {
      void pendingAppSettings.then(() => ipcRenderer.send('window:minimize-main'));
    },
    closeMainWindow: () => ipcRenderer.send('window:close-main'),
    hideMainWindow: () => ipcRenderer.send('window:hide-main'),
    startupSetting: () => ipcRenderer.invoke('startup:get'),
    setStartupSetting: (enabled) => ipcRenderer.invoke('startup:set', { enabled }),
    floatingSettings: () => ipcRenderer.invoke('floating:get'),
    setFloatingSettings: (value) => ipcRenderer.invoke('floating:set', value),
    appSettings: () => ipcRenderer.invoke('app-settings:get'),
    setAppSettings: (value) => {
      const request = ipcRenderer.invoke('app-settings:set', value);
      pendingAppSettings = request.catch(() => undefined);
      return request;
    },
    notificationPermission: () => ipcRenderer.invoke('notifications:permission'),
    onChanged: (listener) => {
      const handler = () => listener();
      ipcRenderer.on('sites:changed', handler);
      return () => ipcRenderer.removeListener('sites:changed', handler);
    },
    onKeyContextChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, value: { siteId: string }) =>
        listener(value.siteId);
      ipcRenderer.on('keys:changed', handler);
      return () => ipcRenderer.removeListener('keys:changed', handler);
    },
    onRefreshState: (listener) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        value: {
          siteId: string;
          state: 'refreshing' | 'success' | 'error' | 'auth-required';
          phase?: string;
        },
      ) => listener(value);
      ipcRenderer.on('sites:refresh-state', handler);
      return () => ipcRenderer.removeListener('sites:refresh-state', handler);
    },
    onBatchProgress: (listener) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        value: {
          current: number;
          total: number;
          url: string;
          status: 'success' | 'failed';
          error?: string;
        },
      ) => listener(value);
      ipcRenderer.on('sites:batch-progress', handler);
      return () => ipcRenderer.removeListener('sites:batch-progress', handler);
    },
  },
};

contextBridge.exposeInMainWorld('sub2apiDesktop', Object.freeze(desktopBridge));
