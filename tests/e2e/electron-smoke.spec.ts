import { _electron as electron, expect, type Page, test } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const launchApplication = (userData: string, env: NodeJS.ProcessEnv = process.env) => {
  const executablePath = process.env.SUB2API_PACKAGED_EXECUTABLE;
  return electron.launch({
    ...(executablePath ? { executablePath } : { args: ['.'] }),
    env: { ...env, SUB2API_TEST_USER_DATA: userData },
  });
};

const captureEvidence = async (page: Page, name: string) => {
  const evidenceDirectory = process.env.SUB2API_REAL_EVIDENCE_DIR;
  if (!evidenceDirectory) return;
  await mkdir(evidenceDirectory, { recursive: true });
  await page
    .locator('.refresh-progress')
    .waitFor({ state: 'detached', timeout: 3_000 })
    .catch(() => {});
  await page.waitForTimeout(150);
  const shell = page.locator('.app-shell, .floating-window').first();
  await shell.screenshot({ path: path.join(evidenceDirectory, `${name}.png`) });
};

test('opens the controlled renderer preview', async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-preview-e2e-'));
  const application = await launchApplication(userData);
  await application.firstWindow();
  await expect.poll(async () => (await application.windows()).length).toBe(2);
  const windows = await application.windows();
  let window = windows[0]!;
  for (const candidate of windows) {
    if ((await candidate.locator('.app-shell').count()) > 0) window = candidate;
  }
  await expect(window.getByText('看看你还有💰吗？', { exact: true })).toBeVisible();
  await expect(window.locator('.brand-mark img')).toHaveJSProperty('complete', true);
  expect(await window.locator('.brand-mark img').evaluate((image) => image.naturalWidth)).toBe(
    1024,
  );
  const shellGeometry = await window.locator('.app-shell').evaluate((shell) => {
    const sidebar = shell.querySelector('.app-sidebar');
    const shellRect = shell.getBoundingClientRect();
    const sidebarStyle = sidebar ? window.getComputedStyle(sidebar) : undefined;
    return {
      shellWidth: Math.round(shellRect.width),
      shellHeight: Math.round(shellRect.height),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      sidebarPosition: sidebarStyle?.position,
      sidebarLeft: sidebarStyle?.left,
    };
  });
  expect(shellGeometry).toEqual({
    shellWidth: shellGeometry.viewportWidth,
    shellHeight: shellGeometry.viewportHeight,
    viewportWidth: shellGeometry.viewportWidth,
    viewportHeight: shellGeometry.viewportHeight,
    sidebarPosition: 'fixed',
    sidebarLeft: '24px',
  });
  const geometry = await application.evaluate(({ BrowserWindow, screen }) => {
    const main = BrowserWindow.getAllWindows().find(
      (candidate) => candidate.getBounds().width > 500,
    );
    const workArea = screen.getPrimaryDisplay().workAreaSize;
    return {
      bounds: main?.getBounds(),
      contentBounds: main?.getContentBounds(),
      backgroundColor: main?.getBackgroundColor(),
      resizable: main?.isResizable(),
      workArea,
    };
  });
  expect(geometry.resizable).toBe(true);
  expect(geometry.backgroundColor.toLowerCase()).toBe('#f8f9ff');
  expect(geometry.contentBounds).toEqual(geometry.bounds);
  expect(
    Math.abs((geometry.bounds?.width ?? 0) - Math.round(geometry.workArea.width * 0.6)),
  ).toBeLessThanOrEqual(2);
  expect(
    Math.abs((geometry.bounds?.height ?? 0) - Math.round(geometry.workArea.height * 0.9)),
  ).toBeLessThanOrEqual(2);
  await window.screenshot({ path: 'test-results/overview.png' });
  for (const shell of ['usage', 'channels', 'sites', 'radar']) {
    let radarMode: 'success' | 'empty' | 'error' = 'success';
    if (shell === 'radar') {
      await window.route('https://codexradar.com/current.json*', async (route) => {
        if (radarMode === 'error') {
          await route.fulfill({ status: 503, body: 'unavailable' });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body:
            radarMode === 'empty'
              ? JSON.stringify({ model_iq: { comparisons: {} } })
              : JSON.stringify({
                  monitored_at: '2026-07-18T00:00:00Z',
                  model_iq: {
                    latest: {
                      model: 'gpt-5',
                      reasoning_effort: 'high',
                      score: 123,
                      passed: 9,
                      tasks: 10,
                      cost_usd: 1.2,
                      wall_seconds: 60,
                    },
                    comparisons: {},
                  },
                }),
        });
      });
    }
    await window.goto(`file://${process.cwd()}/dist/index.html?surface=main&shell=${shell}`);
    await expect(window.locator('.app-shell')).toBeVisible();
    if (shell === 'radar') {
      await expect(window.getByRole('heading', { name: '模型选型雷达' })).toBeVisible();
      await expect(window.getByRole('heading', { name: 'GPT-5 high', exact: true })).toBeVisible();
      radarMode = 'empty';
      await window.reload();
      await expect(window.getByText('暂无可用模型数据。', { exact: true })).toBeVisible();
      radarMode = 'error';
      await window.reload();
      await expect(
        window.getByText('公开数据读取失败，请检查网络或稍后重试。', { exact: true }),
      ).toBeVisible();
      await window.unroute('https://codexradar.com/current.json*');
    }
    await window.screenshot({ path: `test-results/${shell}.png` });
  }
  for (const state of [
    'loading',
    'refreshing',
    'partial',
    'success',
    'stale',
    'error',
    'auth-required',
    'unsupported',
    'empty',
    'disabled',
    'selected',
  ]) {
    await window.goto(
      `file://${process.cwd()}/dist/index.html?surface=main&shell=overview&preview=true&state=${state}`,
    );
    await expect(window.locator('.app-shell')).toHaveAttribute('data-state', state);
  }
  await application.close();
});

test('moves between the frameless main and floating windows and quits from close', async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-lifecycle-e2e-'));
  const application = await launchApplication(userData);
  await expect.poll(async () => (await application.windows()).length).toBe(2);
  await expect
    .poll(async () => {
      let matched = 0;
      for (const candidate of await application.windows())
        matched +=
          (await candidate.locator('.app-shell').count()) +
          (await candidate.locator('.floating-window').count());
      return matched;
    })
    .toBe(2);
  let main = (await application.windows())[0]!;
  let floating = (await application.windows())[0]!;
  for (const candidate of await application.windows()) {
    if ((await candidate.locator('.app-shell').count()) > 0) main = candidate;
    if ((await candidate.locator('.floating-window').count()) > 0) floating = candidate;
  }
  await expect(main.getByRole('button', { name: '关闭' })).toHaveCount(1);
  await expect(floating.getByRole('button', { name: '打开主页面' })).toHaveCount(1);

  expect(
    await application.evaluate(({ BrowserWindow }) => {
      const floatingWindow = BrowserWindow.getAllWindows().find(
        (candidate) => candidate.getBounds().width <= 500,
      );
      return {
        alwaysOnTop: floatingWindow?.isAlwaysOnTop(),
        visibleOnAllWorkspaces: floatingWindow?.isVisibleOnAllWorkspaces(),
      };
    }),
  ).toEqual({
    alwaysOnTop: false,
    visibleOnAllWorkspaces: process.platform === 'darwin',
  });

  await expect
    .poll(() =>
      application.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        const mainWindow = windows.find((candidate) => candidate.getBounds().width > 500);
        const floatingWindow = windows.find((candidate) => candidate.getBounds().width <= 500);
        return { main: mainWindow?.isVisible(), floating: floatingWindow?.isVisible() };
      }),
    )
    .toEqual({ main: true, floating: false });

  await main.getByRole('button', { name: '最小化' }).click();
  await expect
    .poll(() =>
      application.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        const mainWindow = windows.find((candidate) => candidate.getBounds().width > 500);
        const floatingWindow = windows.find((candidate) => candidate.getBounds().width <= 500);
        return { main: mainWindow?.isVisible(), floating: floatingWindow?.isVisible() };
      }),
    )
    .toEqual({ main: false, floating: true });

  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()
      .find((candidate) => candidate.getBounds().width <= 500)
      ?.blur();
  });
  await expect
    .poll(() =>
      application.evaluate(({ BrowserWindow }) => {
        const floatingWindow = BrowserWindow.getAllWindows().find(
          (candidate) => candidate.getBounds().width <= 500,
        );
        return {
          visible: floatingWindow?.isVisible(),
          alwaysOnTop: floatingWindow?.isAlwaysOnTop(),
        };
      }),
    )
    .toEqual({ visible: true, alwaysOnTop: false });

  await application.evaluate(({ ipcMain }) => {
    ipcMain.emit('window:open-main', {} as Electron.IpcMainEvent);
  });
  await expect
    .poll(() =>
      application.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        const mainWindow = windows.find((candidate) => candidate.getBounds().width > 500);
        const floatingWindow = windows.find((candidate) => candidate.getBounds().width <= 500);
        return { main: mainWindow?.isVisible(), floating: floatingWindow?.isVisible() };
      }),
    )
    .toEqual({ main: true, floating: false });

  const exited = new Promise<void>((resolve) =>
    application.process().once('exit', () => resolve()),
  );
  await application.evaluate(({ ipcMain }) => {
    ipcMain.emit('window:close-main', {} as Electron.IpcMainEvent);
  });
  await exited;
});

test('opens the independent floating preview at the fixed size', async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-floating-e2e-'));
  const application = await launchApplication(userData);
  await expect.poll(async () => (await application.windows()).length).toBe(2);
  const candidates = await application.windows();
  let floating = candidates[0];
  for (const candidate of candidates) {
    if ((await candidate.locator('.floating-window').count()) > 0) floating = candidate;
  }
  expect(floating).toBeTruthy();
  if (floating) {
    await expect(floating.locator('.floating-window')).toBeVisible();
    await expect(floating.locator('input[type="range"]')).toHaveAttribute('min', '35');
    await expect(floating.locator('input[type="range"]')).toHaveAttribute('max', '100');
    await floating.evaluate(async () => {
      await window.sub2apiDesktop?.sites.setFloatingSettings({
        position: 'top-right',
        opacity: 35,
      });
    });
    await expect
      .poll(() =>
        application.evaluate(({ BrowserWindow }) => {
          const current = BrowserWindow.getAllWindows().find(
            (candidate) => candidate.getBounds().width <= 500,
          );
          return current?.getOpacity();
        }),
      )
      .toBeCloseTo(0.35, 2);
    await floating.screenshot({ path: 'test-results/floating.png' });
    await floating.goto(
      `file://${process.cwd()}/dist/index.html?surface=floating&preview=true&state=loading`,
    );
    await expect(floating.getByText(/正在查询站点数据 · 预计 3–5 秒/)).toBeVisible();
    await floating.screenshot({ path: 'test-results/floating-loading.png' });
    await floating.goto(
      `file://${process.cwd()}/dist/index.html?surface=floating&preview=true&state=stale`,
    );
    await expect(floating.getByText('缓存数据 · 过期', { exact: true })).toBeVisible();
    await floating.screenshot({ path: 'test-results/floating-stale.png' });
    await floating.goto(
      `file://${process.cwd()}/dist/index.html?surface=floating&preview=true&state=error`,
    );
    await expect(floating.getByText('保留上次成功数据 · error', { exact: true })).toBeVisible();
    await floating.screenshot({ path: 'test-results/floating-error.png' });
  }
  await application.close();
});

test('persists floating placement and general settings across restarts', async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-settings-e2e-'));
  const env = { ...process.env, SUB2API_TEST_USER_DATA: userData };
  const first = await launchApplication(userData, env);
  await expect.poll(async () => (await first.windows()).length).toBe(2);
  let main = (await first.windows())[0]!;
  for (const candidate of await first.windows())
    if ((await candidate.locator('.app-shell').count()) > 0) main = candidate;

  await main.getByLabel('悬浮窗固定位置').selectOption('bottom-left');
  await expect
    .poll(() =>
      first.evaluate(({ BrowserWindow, screen }) => {
        const floating = BrowserWindow.getAllWindows().find(
          (candidate) => candidate.getBounds().width <= 500,
        );
        const area = screen.getPrimaryDisplay().workArea;
        const bounds = floating?.getBounds();
        return {
          x: bounds?.x,
          y: bounds?.y,
          expectedX: area.x + 12,
          expectedY: area.y + area.height - 260 - 12,
        };
      }),
    )
    .toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
  const placement = await first.evaluate(({ BrowserWindow, screen }) => {
    const floating = BrowserWindow.getAllWindows().find(
      (candidate) => candidate.getBounds().width <= 500,
    );
    const area = screen.getPrimaryDisplay().workArea;
    return { bounds: floating?.getBounds(), area };
  });
  expect(placement.bounds?.x).toBe(placement.area.x + 12);
  expect(placement.bounds?.y).toBe(placement.area.y + placement.area.height - 260 - 12);

  await main.getByLabel('自动刷新频率').selectOption('10');
  await main.getByLabel('数据过期提示').selectOption('30');
  await main.getByRole('button', { name: '切换悬浮窗' }).click();
  await main.getByRole('button', { name: '最小化' }).click();
  await expect
    .poll(() =>
      first.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        const mainWindow = windows.find((candidate) => candidate.getBounds().width > 500);
        const floatingWindow = windows.find((candidate) => candidate.getBounds().width <= 500);
        return {
          visible: mainWindow?.isVisible(),
          floating: floatingWindow?.isVisible(),
        };
      }),
    )
    .toEqual({ visible: false, floating: false });
  await first.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((candidate) => candidate.getBounds().width > 500)
      ?.restore(),
  );
  await first.close();

  const second = await launchApplication(userData, env);
  await expect.poll(async () => (await second.windows()).length).toBe(2);
  let restartedMain = (await second.windows())[0]!;
  for (const candidate of await second.windows())
    if ((await candidate.locator('.app-shell').count()) > 0) restartedMain = candidate;
  await expect
    .poll(() =>
      restartedMain.evaluate(async () => ({
        app: await window.sub2apiDesktop?.sites.appSettings(),
        floating: await window.sub2apiDesktop?.sites.floatingSettings(),
      })),
    )
    .toEqual({
      app: { refreshIntervalMinutes: 10, floatingEnabled: false, staleAfterMinutes: 30 },
      floating: { position: 'bottom-left', opacity: 84 },
    });
  await second.close();
});

test('restores a visible main-window position from local settings', async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-window-e2e-'));
  const env = {
    ...process.env,
    SUB2API_TEST_USER_DATA: userData,
    SUB2API_TEST_SECRET_CODEC: 'memory',
  };
  const first = await launchApplication(userData, env);
  await expect.poll(async () => (await first.windows()).length).toBe(2);
  await first.evaluate(({ BrowserWindow, screen }) => {
    const window = BrowserWindow.getAllWindows().find(
      (candidate) => candidate.getBounds().width > 500,
    );
    const area = screen.getPrimaryDisplay().workArea;
    const bounds = {
      x: area.x + 40,
      y: area.y + 40,
      width: Math.min(900, area.width - 80),
      height: Math.min(700, area.height - 80),
    };
    window?.setBounds(bounds);
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  const target = await first.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((candidate) => candidate.getBounds().width > 500)
      ?.getBounds(),
  );
  await first.close();
  const second = await launchApplication(userData, env);
  await expect.poll(async () => (await second.windows()).length).toBe(2);
  const restored = await second.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((candidate) => candidate.getBounds().width > 500)
      ?.getBounds(),
  );
  expect(restored).toEqual(target);
  await second.close();
});

test('connects site entry, overview, usage, channels, and floating shell to a local sub2api server', async () => {
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    const url = request.url ?? '';
    if (url === '/api/v1/auth/login')
      return response.end(
        JSON.stringify({
          code: 0,
          data: {
            access_token: 'e2e-access',
            refresh_token: 'e2e-refresh',
            expires_in: 3600,
            token_type: 'Bearer',
            user: { id: 1, role: 'user', balance: 8.5, status: 'active' },
          },
        }),
      );
    if (url === '/api/v1/user/profile')
      return response.end(JSON.stringify({ data: { balance: 8.5, status: 'active' } }));
    if (url === '/api/v1/keys' || url.startsWith('/api/v1/keys?'))
      return response.end(
        JSON.stringify({
          data: [
            {
              id: 'key-e2e',
              name: 'E2E Key',
              status: 'active',
              group_id: 'g1',
              quota: 80.88,
              quota_used: 66.5,
            },
          ],
        }),
      );
    if (url === '/api/v1/groups/available')
      return response.end(JSON.stringify({ data: [{ id: 'g1', name: 'E2E 分组', ratio: 1.2 }] }));
    if (url === '/api/v1/groups/rates') return response.end(JSON.stringify({ data: { g1: 1.4 } }));
    if (url.startsWith('/api/v1/usage/dashboard/models'))
      return response.end(JSON.stringify({ data: { models: ['test-model'] } }));
    if (url.startsWith('/api/v1/usage/stats'))
      return response.end(
        JSON.stringify({
          data: {
            total_requests: 7,
            total_tokens: 1234,
            total_input_tokens: 500,
            total_output_tokens: 234,
            total_cache_read_tokens: 500,
            total_actual_cost: 0.25,
            total_cost: 0.8,
            average_duration_ms: 1500,
          },
        }),
      );
    if (url.startsWith('/api/v1/usage?'))
      return response.end(
        JSON.stringify({
          data: {
            items: [
              {
                created_at: '2026-07-13T00:00:00Z',
                api_key_name: 'E2E Key',
                model: 'test-model',
                reasoning_effort: 'high',
                group_id: 'g1',
                group_name: 'E2E 分组',
                total_tokens: 1234,
                actual_cost: 0.25,
                first_token_ms: 9999,
                duration_ms: 15000,
              },
            ],
          },
        }),
      );
    if (url === '/api/v1/channel-monitors')
      return response.end(
        JSON.stringify({
          data: Array.from({ length: 7 }, (_, index) => ({
            id: `channel-e2e-${index + 1}`,
            name: `E2E 渠道 ${index + 1}`,
            platform: 'Mock',
          })),
        }),
      );
    if (url.startsWith('/api/v1/channel-monitors/channel-e2e-') && url.endsWith('/status'))
      return response.end(
        JSON.stringify({
          data: { name: 'E2E 渠道 1', average_latency_ms: 120, availability_7d: 99.9 },
        }),
      );
    response.statusCode = 404;
    response.end(JSON.stringify({ message: 'missing' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('E2E mock server unavailable');
  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-e2e-'));
  const exportPath = path.join(userData, 'usage.csv');
  const application = await launchApplication(userData, {
    ...process.env,
    SUB2API_TEST_SECRET_CODEC: 'memory',
    SUB2API_TEST_EXPORT_PATH: exportPath,
  });
  await expect.poll(async () => (await application.windows()).length).toBe(2);
  const appWindows = await application.windows();
  let main = appWindows[0]!;
  for (const candidate of appWindows)
    if ((await candidate.locator('.app-shell').count()) > 0) main = candidate;
  expect(await main.evaluate(() => typeof window.sub2apiDesktop)).toBe('object');
  await expect(main.getByRole('heading', { name: '添加新站点' })).toBeVisible();
  await main.getByPlaceholder('例如: OpenAI 备用节点').fill('本地集成站点');
  await main.getByPlaceholder('https://api.example.com').fill(`http://127.0.0.1:${address.port}`);
  await main.getByLabel('用户名', { exact: true }).fill('e2e@example.invalid');
  await main.getByLabel('密码', { exact: true }).fill('runtime-only');
  await main.getByRole('button', { name: '添加并验证' }).click();
  await expect(main.getByText('站点验证成功')).toBeVisible({ timeout: 15_000 });
  await main.getByLabel('密码', { exact: true }).fill('runtime-only');
  await main.getByText('批量添加站点', { exact: true }).click();
  await main.locator('.batch-entry textarea').fill(`http://localhost:${address.port}\nnot-a-url`);
  await main.getByRole('button', { name: '批量验证并保存' }).click();
  await expect(main.locator('.batch-progress-panel')).toBeVisible({ timeout: 15_000 });
  await expect(main.locator('.batch-progress-panel')).toContainText('全部完成', {
    timeout: 15_000,
  });
  await expect(main.locator('.batch-progress-panel')).toContainText('100%');
  await captureEvidence(main, '07-batch-progress');
  await main.getByRole('button', { name: '全部站点', exact: true }).click();
  await expect(main.getByText('正在获取余额', { exact: false })).toHaveCount(0);
  await expect(main.locator('.site-card').getByText('本地集成站点', { exact: true })).toBeVisible();
  await main.locator('.site-card').filter({ hasText: '本地集成站点' }).dblclick();
  await main.getByLabel('站点备注').fill('本地集成备注');
  await main.getByLabel('站点备注').press('Enter');
  await expect(main.getByText('本地集成备注', { exact: true })).toBeVisible();
  expect(
    await main.locator('.metric-card').evaluateAll((cards) =>
      cards.some((card) => {
        const label = card.querySelector('span')?.getBoundingClientRect();
        const icon = card.querySelector('.metric-icon')?.getBoundingClientRect();
        return Boolean(
          label &&
          icon &&
          label.right > icon.left &&
          label.top < icon.bottom &&
          label.bottom > icon.top,
        );
      }),
    ),
  ).toBe(false);
  await captureEvidence(main, '01-overview');
  await main.getByLabel('本地集成站点 默认 Key').selectOption('key-e2e');
  await expect(main.locator('.quota-summary')).toContainText('总额 $80.88');
  await expect(main.locator('.quota-summary')).toContainText('已用 $66.50');
  await captureEvidence(main, '06-overview-quota');
  await expect
    .poll(() =>
      main.evaluate(async () => {
        const dashboard = await window.sub2apiDesktop?.sites.list();
        const siteId = dashboard?.currentSiteId;
        return siteId ? window.sub2apiDesktop?.sites.keyPreference(siteId) : undefined;
      }),
    )
    .toMatchObject({ mode: 'manual', keyId: 'key-e2e' });
  await main.getByRole('button', { name: '使用记录', exact: true }).click();
  await main.locator('.usage-summary').scrollIntoViewIfNeeded();
  await expect(main.locator('.usage-summary').getByText('1.23K', { exact: true })).toBeVisible();
  await expect(main.getByLabel('模型').locator('option')).toContainText(['全部', 'test-model']);
  await expect(main.getByLabel('分组').locator('option')).toContainText(['全部', 'E2E 分组']);
  await expect(main.locator('.usage-table-panel').getByText('高', { exact: true })).toBeVisible();
  await expect(main.locator('.usage-table-panel').getByText('首字', { exact: true })).toBeVisible();
  await expect(
    main.locator('.usage-table-panel').getByText(/\d{2}月 \d{2}日 \d{2}时 \d{2}分 \d{2}秒/),
  ).toBeVisible();
  await captureEvidence(main, '02-usage');
  await main.getByRole('button', { name: '导出 CSV' }).click();
  await expect
    .poll(async () => readFile(exportPath, 'utf8').catch(() => ''))
    .toContain('test-model');
  expect((await stat(exportPath)).mode & 0o077).toBe(0);
  await main.getByRole('button', { name: '渠道状态', exact: true }).click();
  await expect(main.locator('.channel-card')).toHaveCount(7);
  await expect(main.getByText('E2E 渠道 1', { exact: true }).first()).toBeVisible();
  expect(
    await main.locator('.channel-cards').evaluate((node) => getComputedStyle(node).overflowY),
  ).toBe('auto');
  expect(
    await main.locator('.channel-metrics strong').evaluateAll((values) =>
      values.some((value) => {
        const style = getComputedStyle(value);
        return value.getBoundingClientRect().height > Number.parseFloat(style.lineHeight) * 1.5;
      }),
    ),
  ).toBe(false);
  await captureEvidence(main, '03-channels');
  await main.getByRole('button', { name: '通知', exact: true }).click();
  await expect(main.locator('.app-shell')).toHaveAttribute('data-shell', 'sites');
  await expect(main.locator('#notification-settings')).toBeVisible();
  await main.getByRole('button', { name: '设置', exact: true }).click();
  await expect(main.locator('#general-settings')).toBeVisible();
  await main.getByLabel('自动刷新频率').selectOption('10');
  await main.getByLabel('数据过期提示').selectOption('5');
  await main.getByLabel('通知冷却时间').selectOption('15');
  await expect
    .poll(() =>
      main.evaluate(async () => ({
        app: await window.sub2apiDesktop?.sites.appSettings(),
        notifications: await window.sub2apiDesktop?.sites.notificationSettings(),
      })),
    )
    .toMatchObject({
      app: { refreshIntervalMinutes: 10, staleAfterMinutes: 5 },
      notifications: { cooldownMs: 900_000, recoveryNotifications: true },
    });
  await captureEvidence(main, '04-sites-settings');
  let floating: typeof main | undefined;
  for (const candidate of await application.windows())
    if ((await candidate.locator('.floating-window').count()) > 0) floating = candidate;
  if (floating) {
    await expect(floating.getByText('本地集成站点', { exact: true })).toBeVisible();
    expect(
      await floating.evaluate(() => {
        const metrics = document.querySelector('.floating-metrics')?.getBoundingClientRect();
        const footer = document.querySelector('.floating-window footer')?.getBoundingClientRect();
        return Boolean(metrics && footer && metrics.bottom <= footer.top);
      }),
    ).toBe(true);
    await captureEvidence(floating, '05-floating');
  }
  await application.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
