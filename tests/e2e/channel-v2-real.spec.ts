// prettier-ignore-file
import { _electron as electron, expect, test } from '@playwright/test';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('renders a V2 matrix from the source Electron app', async () => {
  test.setTimeout(45_000);
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    response.setHeader('content-type', 'application/json');
    const url = request.url ?? '';
    if (url === '/api/v1/settings/public')
      return response.end(JSON.stringify({ data: { turnstile_enabled: false, geetest_enabled: false } }));
    if (url === '/api/v1/auth/login')
      return response.end(JSON.stringify({ code: 0, data: { access_token: 'e2e-access', refresh_token: 'e2e-refresh', expires_in: 3600, token_type: 'Bearer', user: { id: 1, role: 'user', status: 'active', balance: 8 } } }));
    if (url === '/api/v1/user/profile') return response.end(JSON.stringify({ data: { account: 'v2@example.invalid', balance: 8, status: 'active' } }));
    if (url === '/api/v1/keys' || url.startsWith('/api/v1/keys?'))
      return response.end(JSON.stringify({ data: [{ id: '101', name: 'V2 Key', status: 'active', group_id: '130', group: { id: '130', name: 'Claude-Aws【稳定】', platform: 'anthropic', rate_multiplier: 0.7 }, quota: 10, quota_used: 1 }] }));
    if (url === '/api/v1/groups/available') return response.end(JSON.stringify({ data: [{ id: '130', name: 'Claude-Aws【稳定】', platform: 'anthropic', ratio: 0.7 }] }));
    if (url === '/api/v1/groups/rates') return response.end(JSON.stringify({ data: { '130': 0.7 } }));
    if (url.startsWith('/api/v1/usage/stats')) return response.end(JSON.stringify({ data: { total_requests: 3, total_tokens: 100, total_input_tokens: 50, total_output_tokens: 50, total_cache_read_tokens: 20, total_actual_cost: 0.1, total_cost: 0.2, average_duration_ms: 1200 } }));
    if (url.startsWith('/api/v1/usage?')) return response.end(JSON.stringify({ data: { items: [] } }));
    if (url.startsWith('/api/v1/user/api-keys/')) return response.end(JSON.stringify({ data: { items: [] } }));
    if (url === '/api/v1/channel-monitors') { response.statusCode = 404; return response.end(JSON.stringify({ message: 'missing' })); }
    if (url === '/api/v1/channels/available') return response.end(JSON.stringify({ data: [] }));
    if (url.startsWith('/api/v1/channel-monitor-v2/snapshot'))
      return response.end(JSON.stringify({ data: { coverage: { data_through: '2026-09-14T03:00:00Z', coverage_complete: false, bootstrap: { active: true, progress_percent: 62 } }, metrics: { success_rate: 0.84, cache_rate: 0.78 }, refresh_interval_seconds: 10 } }));
    if (url.startsWith('/api/v1/channel-monitor-v2/matrix')) {
      const starts = ['02:15:00', '02:20:00', '02:25:00', '02:30:00', '02:35:00', '02:40:00'];
      const rates = [0.91, 0.55, 0.2, 0.99, 0.84, 0.7];
      return response.end(JSON.stringify({ data: { group_by: 'platform_group', coverage: { data_through: '2026-09-14T03:00:00Z', coverage_complete: false, bootstrap: { active: true, progress_percent: 62 } }, items: [{ group_id: '130', group_name: 'Claude-Aws【稳定】', platform: 'anthropic', metrics: { success_rate: 0.84, cache_rate: 0.78, ttft: { avg_ms: 6800 } }, buckets: starts.map((time, index) => ({ bucket_start: '2026-09-14T' + time + 'Z', metrics: { success_rate: rates[index], cache_rate: 0.6 + index / 20, ttft: { avg_ms: index === 2 ? 32000 : index === 1 ? 12000 : 1800 } } })) }] } }));
    }
    response.statusCode = 404;
    return response.end(JSON.stringify({ message: 'missing' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fixture unavailable');
  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-v2-real-e2e-'));
  const app = await electron.launch({ args: ['.'], env: { ...process.env, SUB2API_TEST_USER_DATA: userData, SUB2API_TEST_SECRET_CODEC: 'memory', SUB2API_DISABLE_AUTOMATIC_REFRESH: '1' } });
  try {
    await expect.poll(async () => (await app.windows()).length).toBe(2);
    let main;
    for (const window of await app.windows()) {
      if (await window.locator('.app-shell').count()) {
        main = window;
        break;
      }
    }
    if (!main) throw new Error('main window unavailable');
    await main.getByRole('button', { name: '站点管理', exact: true }).click();
    await main.getByPlaceholder('例如: OpenAI 备用节点').fill('V2 本地站点');
    await main.getByPlaceholder('https://api.example.com').fill('http://127.0.0.1:' + address.port);
    await main.getByLabel('用户名', { exact: true }).fill('v2@example.invalid');
    await main.getByLabel('密码', { exact: true }).fill('runtime-only');
    await main.getByRole('button', { name: '添加并验证' }).click();
    await expect(main.getByText('站点验证成功')).toBeVisible({ timeout: 15_000 });
    await main.getByRole('button', { name: '渠道状态', exact: true }).click();
    await expect(main.locator('.channels-page.monitor-v2')).toBeVisible({ timeout: 15_000 });
    await expect(main.locator('.channel-card')).toHaveCount(1);
    await expect(main.locator('.channel-card')).toContainText('缓存率');
    await expect(main.locator('.channel-card')).toContainText('首 Token');
    await expect(main.locator('.channel-card')).toContainText('可用率');
    await expect(main.locator('.channel-card')).toContainText('健康');
    await expect(main.locator('.channel-card')).not.toContainText('对话延迟');
    await expect(main.locator('.channel-card')).not.toContainText('端点 PING');
    await expect(main.locator('.channel-card .sparkline i')).toHaveCount(18);
    await expect(main.locator('.channel-card .sparkline i.good')).toHaveCount(4);
    await expect(main.locator('.channel-card .sparkline i.warn')).toHaveCount(1);
    await expect(main.locator('.channel-card .sparkline i.bad')).toHaveCount(1);
    await expect(main.locator('.channel-card .sparkline i.bad')).toHaveAttribute('title', /可用率 20.0%.*首 Token 32.0s/);
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows().find((window) => window.getBounds().width > 500)?.setSize(1600, 900);
    });
    await main.screenshot({ path: 'test-results/channel-v2-source-macos-wide.png' });
    for (const range of ['24h', '7d', '30d']) {
      await main.getByRole('button', { name: range, exact: true }).click();
      await expect(main.locator('.channel-card .sparkline i')).toHaveCount(18);
    }
    await main.screenshot({ path: 'test-results/channel-v2-source-macos-30d.png' });
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows().find((window) => window.getBounds().width > 500)?.setSize(720, 800);
    });
    await expect(main.locator('.channel-card')).toBeVisible();
    await expect(main.locator('.channel-family-list')).toHaveCSS('overflow-y', 'auto');
    await main.screenshot({ path: 'test-results/channel-v2-source-macos-narrow.png' });
  } finally {
    await app.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
