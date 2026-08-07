import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  batchProgressPercent,
  shouldKeepInteractiveVerificationPrompt,
  siteTaskSummary,
} from './SitesPage';

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

  it('keeps the security prompt available after retryable auth-window failures', () => {
    expect(shouldKeepInteractiveVerificationPrompt(new Error('INTERACTIVE_AUTH_TIMEOUT'))).toBe(
      true,
    );
    expect(
      shouldKeepInteractiveVerificationPrompt(new Error('INTERACTIVE_AUTH_CHALLENGE_NETWORK')),
    ).toBe(true);
    for (const code of [
      'CHROME_NOT_INSTALLED',
      'CHROME_CLOSED',
      'CHROME_AUTH_TOKEN_NOT_FOUND',
      'CHROME_AUTH_ORIGIN_BLOCKED',
    ]) {
      expect(shouldKeepInteractiveVerificationPrompt(new Error(code))).toBe(true);
    }
    expect(shouldKeepInteractiveVerificationPrompt(new Error('INTERACTIVE_AUTH_CANCELLED'))).toBe(
      false,
    );
    expect(shouldKeepInteractiveVerificationPrompt(new Error('SITE_DUPLICATE_ACCOUNT'))).toBe(
      false,
    );
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

  it('keeps settings out of site management and renders batch tasks as detailed cards', () => {
    const source = readFileSync(fileURLToPath(new URL('./SitesPage.tsx', import.meta.url)), 'utf8');

    expect(source).not.toContain('通用设置');
    expect(source).not.toContain('通知规则设置');
    expect(source).not.toContain('.appSettings()');
    expect(source).toContain('site-task-grid');
    expect(source).toContain('site-task-card');
    expect(source).toContain('iconDataUrl');
    expect(source).toContain('site-detail-dialog');
    expect(source).toContain('重新验证');
    expect(source).toContain('删除站点');
  });

  it('uses provider-aware security copy and the interactive verification bridge', () => {
    const source = readFileSync(fileURLToPath(new URL('./SitesPage.tsx', import.meta.url)), 'utf8');
    const styles = readFileSync(fileURLToPath(new URL('./sites.css', import.meta.url)), 'utf8');

    expect(source).toContain('需要完成安全验证');
    expect(source).toContain('Cloudflare Turnstile');
    expect(source).toContain('providerDisplayName');
    expect(source).toContain('验证成功后将自动继续添加站点。');
    expect(source).toContain('暂不添加');
    expect(source).toContain('开始登录');
    expect(source).not.toContain('开始验证');
    expect(source).toContain('security-verification-close');
    expect(source).toContain('关闭安全验证');
    expect(source).toContain('shouldKeepInteractiveVerificationPrompt');
    expect(styles).toContain('.security-verification-close');
    expect(source).toContain('.addWithInteractiveVerification(');
    expect(source).toContain('pending.input');
    expect(source).not.toContain('site-form-message');
  });

  it('resets the add flow phase when the security prompt is cancelled', () => {
    const source = readFileSync(fileURLToPath(new URL('./SitesPage.tsx', import.meta.url)), 'utf8');
    const cancelStart = source.indexOf('const cancelInteractiveVerification');
    const cancelEnd = source.indexOf('const startInteractiveVerification');
    expect(cancelStart).toBeGreaterThan(-1);
    expect(cancelEnd).toBeGreaterThan(cancelStart);
    expect(source.slice(cancelStart, cancelEnd)).toContain("setValidationPhase('等待开始')");
  });

  it('renders a safe account label for duplicate site addresses', () => {
    const source = readFileSync(fileURLToPath(new URL('./SitesPage.tsx', import.meta.url)), 'utf8');

    expect(source).toContain('accountLabel');
    expect(source).toContain('site.accountLabel');
    expect(source).toContain('sites.reverify(pending.siteId)');
    expect(source).toContain('site.interactiveVerificationProvider');
  });
});
