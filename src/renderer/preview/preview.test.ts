import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { siteDrafts } from '../shells/sites/data';
import { parsePreviewLocation, previewStates } from './types';
describe('controlled UI shell preview', () => {
  it('exposes every required state sample', () => {
    expect(previewStates).toHaveLength(11);
    expect(previewStates).toContain('auth-required');
    expect(previewStates).toContain('selected');
  });

  it('parses a supported shell and state without exposing theme modes', () => {
    expect(
      parsePreviewLocation('?surface=main&shell=usage&state=stale&reduceTransparency=true'),
    ).toEqual({
      surface: 'main',
      shell: 'usage',
      state: 'stale',
      reducedTransparency: true,
      highContrast: false,
    });
  });

  it('exposes the API key shell through the formal preview route', () => {
    expect(parsePreviewLocation('?surface=main&shell=api-keys&state=success').shell).toBe(
      'api-keys',
    );
  });

  it('falls back to the fixed-light safe defaults for unknown values', () => {
    expect(parsePreviewLocation('?surface=wrong&shell=wrong&state=wrong&theme=dark')).toEqual({
      surface: 'main',
      shell: 'overview',
      state: 'success',
      reducedTransparency: false,
      highContrast: false,
    });
  });

  it('keeps the cancelled credential-template feature out of the sites shell', () => {
    const sitesPage = readFileSync(
      fileURLToPath(new URL('../shells/sites/SitesPage.tsx', import.meta.url)),
      'utf8',
    );
    const sitesStyles = readFileSync(
      fileURLToPath(new URL('../shells/sites/sites.css', import.meta.url)),
      'utf8',
    );

    expect(siteDrafts.every((draft) => !('credentialTemplate' in draft))).toBe(true);
    expect(sitesPage).not.toContain('从模板填充');
    expect(sitesPage).not.toContain('site-template-button');
    expect(sitesStyles).not.toContain('.site-template-button');
  });

  it('routes sidebar notification and settings actions to independent pages', () => {
    const app = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8');
    const settings = readFileSync(
      fileURLToPath(new URL('../shells/settings/SettingsPages.tsx', import.meta.url)),
      'utf8',
    );

    expect(app).toContain("changeShell('general-settings')");
    expect(app).toContain("changeShell('notification-rules')");
    expect(app).toContain('GeneralSettingsPage');
    expect(app).toContain('NotificationRulesPage');
    expect(settings).toContain('通用设置');
    expect(settings).toContain('通知规则设置');
  });

  it('registers the Sub2API server shell and the login expiry notice', () => {
    const app = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8');
    const page = readFileSync(
      fileURLToPath(new URL('../shells/sub2api-servers/Sub2ApiServersPage.tsx', import.meta.url)),
      'utf8',
    );

    expect(app).toContain("'sub2api-servers'");
    expect(app).toContain('<Sub2ApiServersPage');
    expect(page).toContain('新增服务器');
    expect(page).toContain('快捷入口');
    expect(page).toContain('搜索快捷入口');
    expect(page).toContain('SUB2API_STANDARD_MENUS');
    expect(page).toContain('sub2apiTemplateGroupLabel');
    expect(page).not.toContain('获取菜单');
    expect(page).not.toContain('正在读取服务器菜单');
    expect(app).toContain('登录过期，请去站点管理重新验证');
  });

  it('exposes update feedback and confirmation actions in the main shell', () => {
    const app = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8');
    const settingsPage = readFileSync(
      fileURLToPath(new URL('../shells/settings/SettingsPages.tsx', import.meta.url)),
      'utf8',
    );
    const styles = readFileSync(fileURLToPath(new URL('../styles.css', import.meta.url)), 'utf8');
    const notificationStyles = readFileSync(
      fileURLToPath(new URL('../notifications.css', import.meta.url)),
      'utf8',
    );

    expect(app).toContain('正在检查更新');
    expect(app).toContain('当前已是最新版本');
    expect(app).toContain('发现新版本');
    expect(app).toContain('role="dialog"');
    expect(app).toContain('aria-modal="true"');
    expect(app).toContain('跳过此版本');
    expect(app).toContain('稍后提醒');
    expect(app).toContain("setShell('overview')");
    expect(app).toContain('updateCheckingRef');
    expect(app).toContain('update-card');
    expect(app).toContain('update-modal-version-row');
    expect(settingsPage).toContain('onCheckForUpdate');
    expect(settingsPage).toContain('aria-busy={props.updateChecking}');
    expect(settingsPage).not.toContain('sites.updateCheck()');
    expect(settingsPage).toContain('检查 GitHub 稳定版更新');
    expect(settingsPage).not.toContain('检查 Gitee 稳定版更新');
    expect(app).toContain('useNotifications()');
    expect(notificationStyles).toContain('.app-notification-viewport');
    expect(styles).not.toContain('.update-toast');
    expect(styles).toContain('.update-modal-backdrop');
  });

  it('uses the packaged Sub2API logo in the application brand lockup', () => {
    const app = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8');

    expect(app).toContain("import sub2ApiLogo from './assets/sub2api-logo.png'");
    expect(app).toContain('<img src={sub2ApiLogo} alt="" />');
    expect(app).toContain('<strong>看看你还有💰吗？</strong>');
    expect(app).toContain('<small>Sub2API 多站监控</small>');
    expect(app).not.toContain('<Network size={20} />');
  });

  it('does not leave completed UI-shell connection TODOs in runtime pages', () => {
    for (const relativePath of [
      '../shells/overview/OverviewPage.tsx',
      '../shells/usage/UsagePage.tsx',
      '../shells/channels/ChannelsPage.tsx',
      '../shells/floating/FloatingWindow.tsx',
      '../shells/sites/SitesPage.tsx',
    ]) {
      const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
      expect(source).not.toMatch(
        /TODO\((?:ui-shell|codex-connect|codex-state|codex-validate|codex-route)\)/,
      );
    }
  });
});
