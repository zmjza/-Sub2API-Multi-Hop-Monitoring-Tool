import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { batchProgressPercent, siteTaskSummary } from './SitesPage';

describe('SitesPage runtime state', () => {
  it('never reports a static in-progress count for saved runtime sites', () => {
    expect(siteTaskSummary(false, [])).toBe('暂无任务');
    expect(siteTaskSummary(false, [{ status: 'success' }, { status: 'error' }])).toBe('2 个站点');
    expect(siteTaskSummary(true, [{ status: 'success' }])).toBe('验证中');
  });

  it('clamps batch progress at safe boundaries', () => {
    expect(batchProgressPercent(0, 4)).toBe(0);
    expect(batchProgressPercent(1, 4)).toBe(25);
    expect(batchProgressPercent(4, 4)).toBe(100);
    expect(batchProgressPercent(9, 4)).toBe(100);
    expect(batchProgressPercent(-1, 4)).toBe(0);
    expect(batchProgressPercent(1, 0)).toBe(0);
  });

  it('marks credentials as required and removes completed shell TODO markers', () => {
    const source = readFileSync(fileURLToPath(new URL('./SitesPage.tsx', import.meta.url)), 'utf8');
    const styles = readFileSync(fileURLToPath(new URL('./sites.css', import.meta.url)), 'utf8');

    expect(source).toContain('用户名');
    expect(source).toContain('密码');
    expect(source).not.toContain('用户名 (可选)');
    expect(source).not.toContain('密码 (可选)');
    expect(source).not.toContain('TODO(ui-shell)');
    expect(styles).toContain('.toggle.active');
  });

  it('exposes persisted notification and general application settings', () => {
    const source = readFileSync(fileURLToPath(new URL('./SitesPage.tsx', import.meta.url)), 'utf8');

    for (const label of [
      '恢复通知',
      '通知冷却时间',
      '系统通知权限',
      '自动刷新频率',
      '启用悬浮窗',
      '数据过期提示',
    ]) {
      expect(source).toContain(label);
    }
    expect(source).toContain('.appSettings()');
    expect(source).toContain('.setAppSettings(');
    expect(source).toContain('常驻桌面且不会遮挡前台应用');
    expect(source).not.toContain('悬浮窗保持普通桌面层级');
  });

  it('uses the approved GeeTest dialog copy and interactive verification bridge', () => {
    const source = readFileSync(fileURLToPath(new URL('./SitesPage.tsx', import.meta.url)), 'utf8');

    expect(source).toContain('需要完成安全验证');
    expect(source).toContain('该站点已启用 GeeTest。请在官方登录窗口完成人机验证，');
    expect(source).toContain('验证成功后将自动继续添加站点。');
    expect(source).toContain('暂不添加');
    expect(source).toContain('开始验证');
    expect(source).toContain('.addWithInteractiveVerification(input)');
    expect(source).not.toContain('site-form-message');
  });
});
