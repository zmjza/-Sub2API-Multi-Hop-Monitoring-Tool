import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { siteTaskSummary } from './SitesPage';

describe('SitesPage runtime state', () => {
  it('never reports a static in-progress count for saved runtime sites', () => {
    expect(siteTaskSummary(false, [])).toBe('暂无任务');
    expect(siteTaskSummary(false, [{ status: 'success' }, { status: 'error' }])).toBe('2 个站点');
    expect(siteTaskSummary(true, [{ status: 'success' }])).toBe('验证中');
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
});
