import type { DesktopBridge } from '../../electron/preload/index';

declare global {
  interface Window {
    sub2apiDesktop?: DesktopBridge;
  }
}

export {};
