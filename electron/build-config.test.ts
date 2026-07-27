import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface PackageManifest {
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  build?: {
    productName?: string;
    artifactName?: string;
    executableName?: string;
    mac?: { icon?: string; target?: string | string[]; identity?: string };
    win?: { icon?: string; target?: string | string[]; executableName?: string };
  };
}

describe('electron-builder manifest', () => {
  it('keeps the public application version synchronized with the current release', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as PackageManifest;
    const preloadSource = readFileSync('electron/preload/bridge.cts', 'utf8');

    expect(manifest.version).toBe('1.5.3');
    expect(preloadSource).toContain("shellVersion: ipcRenderer.sendSync('app:version')");
  });

  it('gets the visible version from the main process instead of a stale preload literal', () => {
    const mainSource = readFileSync('electron/main/index.ts', 'utf8');
    expect(mainSource).toContain("ipcMain.on('app:version'");
  });

  it('keeps Electron as a build-time dependency', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as PackageManifest;

    expect(manifest.dependencies).not.toHaveProperty('electron');
    expect(manifest.devDependencies).toHaveProperty('electron');
  });

  it('disables automatic signing identity discovery for the local directory pack', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as PackageManifest;

    expect(manifest.scripts?.pack).toContain('CSC_IDENTITY_AUTO_DISCOVERY=false');
  });

  it('uses the branded icons and distributable targets for both desktop platforms', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as PackageManifest;

    expect(manifest.build?.mac).toEqual(
      expect.objectContaining({ icon: 'build/icon.icns', target: ['dmg'], identity: '-' }),
    );
    expect(manifest.build?.win).toEqual(
      expect.objectContaining({ icon: 'build/icon.ico', target: ['nsis'] }),
    );
    expect(manifest.build?.artifactName).toBe(
      'Sub2API-Multi-Hub-Monitor-${version}-${os}-${arch}.${ext}',
    );
    expect(existsSync('build/icon.icns')).toBe(true);
    expect(existsSync('build/icon.ico')).toBe(true);
  });

  it('uses the user-facing product name with a Windows-safe executable name', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as PackageManifest;

    expect(manifest.build?.productName).toBe('看看你还有💰吗？');
    expect(manifest.build?.executableName).toBeUndefined();
    expect(manifest.build?.win?.executableName).toBe('Sub2API-Monitor');
  });

  it('keeps rate context IPC wired through main and preload layers', () => {
    const mainSource = readFileSync('electron/main/index.ts', 'utf8');
    const bridgeSource = readFileSync('electron/preload/bridge.cts', 'utf8');
    const bridgeTypes = readFileSync('electron/preload/index.ts', 'utf8');

    for (const channel of [
      'rates:contexts',
      'rates:refresh',
      'rates:refresh-all',
      'rates:ratio:set',
    ]) {
      expect(mainSource).toContain(`ipcMain.handle('${channel}'`);
      expect(bridgeSource).toContain(`ipcRenderer.invoke('${channel}'`);
    }
    expect(bridgeTypes).toContain('rateContexts(): Promise<RateContexts>');
    expect(bridgeTypes).toContain('setRechargeRatio(siteId: string, ratio: number)');
  });
});
