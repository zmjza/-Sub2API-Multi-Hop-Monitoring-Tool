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

  const customBounds = {
    x: placement.area.x + 96,
    y: placement.area.y + 88,
    width: 380,
    height: 260,
  };
  await first.evaluate(({ BrowserWindow }, bounds) => {
    BrowserWindow.getAllWindows()
      .find((candidate) => candidate.getBounds().width <= 500)
      ?.setBounds(bounds);
  }, customBounds);
  await expect
    .poll(() => main.evaluate(async () => window.sub2apiDesktop?.sites.floatingSettings()), {
      timeout: 3_000,
    })
    .toEqual({ position: 'custom', x: customBounds.x, y: customBounds.y, opacity: 84 });

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
      floating: { position: 'custom', x: customBounds.x, y: customBounds.y, opacity: 84 },
    });
  expect(
    await second.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((candidate) => candidate.getBounds().width <= 500)
        ?.getBounds(),
    ),
  ).toEqual(customBounds);
  await restartedMain.getByLabel('悬浮窗固定位置').selectOption('bottom-left');
  await expect
    .poll(() => restartedMain.evaluate(async () => window.sub2apiDesktop?.sites.floatingSettings()))
    .toEqual({ position: 'bottom-left', opacity: 84 });
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
  let keysRequestCount = 0;
  let availableRatesRequestCount = 0;
  let channelRequestCount = 0;
  let channelDetailRequestCount = 0;
  let channelDelayMs = 0;
  let channelListMode: 'success' | 'error' = 'success';
  let modelsRequestCount = 0;
  let floatingLatestHost: string | undefined;
  let floatingLatestSequence = 0;
  let availableRatesMode: 'success' | 'delayed' | 'error' | 'empty' = 'success';
  const availableRateGroups = [
    {
      id: 'rate-openai-a',
      name: 'OpenAI 便宜 A',
      description: '便宜稳定',
      platform: 'openai',
      status: 'active',
      rate_multiplier: 0.4,
    },
    {
      id: 'rate-openai-b',
      name: 'OpenAI 便宜 B',
      description: '同价备用',
      platform: 'openai',
      status: 'active',
      rate_multiplier: 0.4,
    },
    {
      id: 'rate-claude',
      name: 'Claude 通道',
      platform: 'anthropic',
      status: 'active',
      rate_multiplier: 0.8,
    },
    {
      id: 'rate-gemini',
      name: 'Gemini 通道',
      platform: 'google',
      status: 'active',
      rate_multiplier: 0.6,
    },
    {
      id: 'rate-grok',
      name: 'Grok 通道',
      platform: 'xai',
      status: 'active',
      rate_multiplier: 0.7,
    },
    {
      id: 'rate-local',
      name: '本地模型通道',
      platform: 'Local-Lab',
      status: 'active',
      rate_multiplier: 0.5,
    },
  ];
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
    if (url === '/api/v1/keys' || url.startsWith('/api/v1/keys?')) {
      keysRequestCount += 1;
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
            {
              id: 'key-e2e-manual',
              name: 'Manual E2E Key',
              status: 'active',
              group_id: 'g2',
              quota: 20,
              quota_used: 5,
            },
          ],
        }),
      );
    }
    if (url.startsWith('/api/v1/groups/available?timezone=')) {
      availableRatesRequestCount += 1;
      if (availableRatesMode === 'error') {
        response.statusCode = 503;
        return response.end(JSON.stringify({ message: 'temporarily unavailable' }));
      }
      const body = JSON.stringify({
        data: availableRatesMode === 'empty' ? [] : availableRateGroups,
      });
      if (availableRatesMode === 'delayed') {
        setTimeout(() => response.end(body), 600);
        return;
      }
      return response.end(body);
    }
    if (url === '/api/v1/groups/available')
      return response.end(
        JSON.stringify({
          data: [
            { id: 'g1', name: 'E2E 分组', ratio: 1.2 },
            { id: 'g2', name: '独立分组', ratio: 0.8 },
          ],
        }),
      );
    if (url === '/api/v1/groups/rates') return response.end(JSON.stringify({ data: { g1: 1.4 } }));
    if (url.startsWith('/api/v1/usage/dashboard/models')) {
      modelsRequestCount += 1;
      setTimeout(() => response.end(JSON.stringify({ data: { models: ['test-model'] } })), 1_200);
      return;
    }
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
    if (url.startsWith('/api/v1/usage?')) {
      const requestHost = String(request.headers.host ?? '').split(':')[0];
      const latestForHost = floatingLatestHost === requestHost;
      const seconds = latestForHost ? 38 + floatingLatestSequence * 2 : 38;
      return response.end(
        JSON.stringify({
          data: {
            items: [
              {
                created_at: `2026-07-19T14:54:${String(seconds).padStart(2, '0')}+08:00`,
                api_key_name: 'E2E Key',
                model: 'test-model',
                reasoning_effort: 'high',
                group_id: 'g1',
                group_name: 'E2E 分组',
                input_tokens: 2008,
                output_tokens: 1879,
                cache_read_tokens: 65300,
                actual_cost: 0.25,
                first_token_ms: 9999,
                duration_ms: 15000,
              },
            ],
          },
        }),
      );
    }
    if (url === '/api/v1/channel-monitors') {
      channelRequestCount += 1;
      if (channelListMode === 'error') {
        response.statusCode = 503;
        return response.end(JSON.stringify({ message: 'temporarily unavailable' }));
      }
      const body = JSON.stringify({
        data: Array.from({ length: 7 }, (_, index) => ({
          id: `channel-e2e-${index + 1}`,
          name: `E2E 渠道 ${index + 1}`,
          platform: index === 0 ? 'openai' : 'Mock',
          group_name: index === 0 ? 'OpenAI 便宜 A' : `其他分组 ${index + 1}`,
          primary_model: index === 0 ? 'gpt-e2e' : 'mock-model',
          primary_status: 'normal',
          availability_7d: 99.9,
          timeline: [
            { status: 'normal', checked_at: '2026-07-19T15:00:00+08:00', latency_ms: 120 },
          ],
        })),
      });
      if (channelDelayMs) {
        setTimeout(() => response.end(body), channelDelayMs);
        return;
      }
      return response.end(body);
    }
    if (url.startsWith('/api/v1/channel-monitors/channel-e2e-') && url.endsWith('/status')) {
      channelDetailRequestCount += 1;
      return response.end(
        JSON.stringify({
          data: {
            id: 'channel-e2e-1',
            name: 'E2E 渠道 1',
            platform: 'openai',
            group_name: 'OpenAI 便宜 A',
            models: [{ model: 'gpt-e2e', latest_status: 'normal', availability_7d: 99.9 }],
          },
        }),
      );
    }
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
  const firstSiteCard = main.locator('.site-card').filter({ hasText: '本地集成备注' });
  await main.getByLabel('本地集成站点 默认 Key').selectOption('key-e2e-manual');
  await expect(main.locator('.quota-summary')).toContainText('总额 $20.00');
  await main.getByLabel('本地集成站点 默认 Key').selectOption('auto');
  await expect(firstSiteCard.locator('.quota-summary')).toHaveCount(0);
  await expect(firstSiteCard.locator('.site-card-balance')).toContainText('$8.50');
  await expect(firstSiteCard.locator('.site-card-meta')).toContainText('1.4x');
  await main.getByLabel('本地集成站点 默认 Key').selectOption('key-e2e-manual');
  await expect(main.locator('.quota-summary')).toContainText('总额 $20.00');
  const secondSiteCard = main.locator('.site-card').filter({ hasText: 'localhost' });
  const selectedSiteIdBeforeRates = await main.evaluate(async () => {
    const dashboard = await window.sub2apiDesktop?.sites.list();
    return dashboard?.currentSiteId;
  });
  await firstSiteCard.getByLabel('本地集成站点 充值比例').selectOption('custom');
  await firstSiteCard.getByLabel('本地集成站点 自定义充值比例').fill('-1');
  await firstSiteCard.getByRole('button', { name: '保存充值比例' }).click();
  await expect(firstSiteCard.getByText('请输入大于 0 的数字')).toBeVisible();
  await firstSiteCard.getByLabel('本地集成站点 自定义充值比例').fill('2.5');
  await firstSiteCard.getByRole('button', { name: '保存充值比例' }).click();
  await expect(firstSiteCard.getByLabel('本地集成站点 充值比例')).toHaveValue('custom');
  await firstSiteCard.getByLabel('本地集成站点 充值比例').selectOption('10');
  await expect(firstSiteCard.getByLabel('本地集成站点 充值比例')).toHaveValue('10');
  await expect(main.locator('.rate-comparison-band')).toContainText('OpenAI');
  await expect(main.locator('.rate-comparison-band')).toContainText('0.04');
  await expect(main.locator('.rate-comparison-list')).toHaveAttribute('tabindex', '0');
  expect(
    await main.locator('.rate-comparison-list').evaluate((list) => {
      const cards = Array.from(list.querySelectorAll<HTMLElement>('.rate-platform-card'));
      return {
        order: cards.map((card) => card.dataset.platform),
        oneRow:
          new Set(cards.map((card) => Math.round(card.getBoundingClientRect().top))).size === 1,
        scrollable: list.scrollWidth > list.clientWidth,
        colors: Object.fromEntries(
          cards
            .slice(0, 4)
            .map((card) => [card.dataset.platform, getComputedStyle(card).backgroundColor]),
        ),
      };
    }),
  ).toEqual({
    order: ['openai', 'claude', 'gemini', 'grok', 'local-lab'],
    oneRow: true,
    scrollable: true,
    colors: {
      openai: 'rgb(241, 251, 244)',
      claude: 'rgb(255, 248, 239)',
      gemini: 'rgb(241, 248, 255)',
      grok: 'rgb(241, 243, 245)',
    },
  });
  await captureEvidence(main, '08-rate-comparison');
  const ratesBeforePopoverRefresh = availableRatesRequestCount;
  const keysBeforePopoverRefresh = keysRequestCount;
  await firstSiteCard.getByRole('button', { name: '查看倍率' }).click();
  await expect(main.getByRole('dialog', { name: '本地集成站点 分组倍率' })).toBeVisible();
  await expect(main.getByRole('dialog', { name: '本地集成站点 分组倍率' })).toContainText(
    '并列最低',
  );
  await main.getByLabel('搜索分组倍率').fill('便宜');
  await expect(main.locator('.rate-group-list')).toContainText('OpenAI 便宜 A');
  await expect(main.locator('.rate-group-list')).not.toContainText('Claude 通道');
  await main.getByLabel('搜索分组倍率').fill('');
  await main.getByRole('button', { name: 'Claude', exact: true }).click();
  await expect(main.locator('.rate-group-list')).toContainText('Claude 通道');
  await expect(main.locator('.rate-group-list')).not.toContainText('OpenAI 便宜 A');
  expect(
    await main.getByRole('dialog', { name: '本地集成站点 分组倍率' }).evaluate((dialog) => {
      const rect = dialog.getBoundingClientRect();
      return {
        insideViewport:
          rect.left >= 0 &&
          rect.top >= 0 &&
          rect.right <= window.innerWidth &&
          rect.bottom <= window.innerHeight,
        hasScrollableList: getComputedStyle(dialog.querySelector('.rate-group-list')!).overflowY,
      };
    }),
  ).toEqual({ insideViewport: true, hasScrollableList: 'auto' });
  availableRatesMode = 'delayed';
  const ratesBeforeLoading = availableRatesRequestCount;
  await main.getByRole('button', { name: '刷新当前站点倍率' }).click();
  await expect(main.getByRole('button', { name: '刷新当前站点倍率' })).toBeDisabled();
  await expect
    .poll(() => availableRatesRequestCount, { timeout: 15_000 })
    .toBeGreaterThan(ratesBeforeLoading);
  availableRatesMode = 'success';
  await expect(main.getByRole('button', { name: '刷新当前站点倍率' })).toBeEnabled();
  await expect
    .poll(() => availableRatesRequestCount, { timeout: 15_000 })
    .toBeGreaterThan(ratesBeforePopoverRefresh);
  expect(keysRequestCount).toBe(keysBeforePopoverRefresh);

  availableRatesMode = 'error';
  await main.getByRole('button', { name: '刷新当前站点倍率' }).click();
  await expect(main.getByText('倍率更新失败', { exact: true })).toBeVisible();
  await expect(main.getByText('正在显示上次缓存结果', { exact: true })).toBeVisible();
  availableRatesMode = 'success';
  await main.getByRole('button', { name: '刷新当前站点倍率' }).click();
  await expect(main.getByText('倍率更新失败', { exact: true })).toHaveCount(0);

  availableRatesMode = 'empty';
  await main.getByRole('button', { name: '刷新当前站点倍率' }).click();
  await expect(main.getByText('暂无可用分组倍率', { exact: true })).toBeVisible();
  availableRatesMode = 'success';
  await main.getByRole('button', { name: '重试', exact: true }).click();
  await expect(main.locator('.rate-group-list')).toContainText('Claude 通道');
  await main.getByRole('button', { name: '关闭倍率弹窗' }).click();
  await expect(main.getByRole('dialog', { name: '本地集成站点 分组倍率' })).toHaveCount(0);

  const channelsBeforeShortcut = channelRequestCount;
  const detailsBeforeShortcut = channelDetailRequestCount;
  channelDelayMs = 300;
  await firstSiteCard.getByLabel('查看 本地集成站点 渠道状态').click();
  await expect(main.getByText('正在读取渠道状态…', { exact: true })).toBeVisible();
  await expect(main.getByRole('dialog', { name: '本地集成站点 渠道状态' })).toContainText(
    'E2E 渠道 1',
  );
  await expect(
    main
      .getByRole('dialog', { name: '本地集成站点 渠道状态' })
      .locator('.rate-channel-list > button'),
  ).toHaveCount(7);
  await expect(main.getByRole('dialog', { name: '本地集成站点 渠道状态' })).toContainText(
    'E2E 渠道 7',
  );
  await captureEvidence(main, '09-channel-status-popover');
  expect(channelRequestCount).toBeGreaterThan(channelsBeforeShortcut);
  expect(channelDetailRequestCount).toBeGreaterThan(detailsBeforeShortcut);
  await main.keyboard.press('Escape');
  await expect(main.getByRole('dialog', { name: '本地集成站点 渠道状态' })).toHaveCount(0);
  const channelsAfterFirstOpen = channelRequestCount;
  const detailsAfterFirstOpen = channelDetailRequestCount;
  await firstSiteCard.getByLabel('查看 本地集成站点 渠道状态').click();
  await expect(main.getByRole('dialog', { name: '本地集成站点 渠道状态' })).toContainText(
    'E2E 渠道 1',
  );
  expect(channelRequestCount).toBe(channelsAfterFirstOpen);
  expect(channelDetailRequestCount).toBe(detailsAfterFirstOpen);
  await main.keyboard.press('Escape');
  channelListMode = 'error';
  await secondSiteCard.getByLabel('查看 localhost 渠道状态').click();
  await expect(main.getByText('渠道状态读取失败', { exact: true })).toBeVisible();
  channelListMode = 'success';
  await main
    .getByRole('dialog', { name: 'localhost 渠道状态' })
    .getByRole('button', { name: '重试', exact: true })
    .click();
  await expect(
    main.getByRole('dialog', { name: 'localhost 渠道状态' }).locator('.rate-channel-list > button'),
  ).toHaveCount(7);
  await main.keyboard.press('Escape');

  await firstSiteCard.getByRole('button', { name: '查看倍率' }).click();
  await main.keyboard.press('Escape');
  await expect(main.getByRole('dialog', { name: '本地集成站点 分组倍率' })).toHaveCount(0);
  await firstSiteCard.getByRole('button', { name: '查看倍率' }).click();
  const viewport = await main.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  await main.mouse.click(viewport.width - 4, viewport.height - 4);
  await expect(main.getByRole('dialog', { name: '本地集成站点 分组倍率' })).toHaveCount(0);
  await secondSiteCard.getByRole('button', { name: '查看倍率' }).click();
  await expect(main.getByRole('dialog', { name: 'localhost 分组倍率' })).toBeVisible();
  await main.keyboard.press('Escape');
  await expect(main.getByLabel('站点备注')).toHaveCount(0);
  expect(
    await main.evaluate(async () => {
      const dashboard = await window.sub2apiDesktop?.sites.list();
      return dashboard?.currentSiteId;
    }),
  ).toBe(selectedSiteIdBeforeRates);
  await expect(main.locator('.quota-summary')).toContainText('已用 $5.00');
  await secondSiteCard.click();
  await expect(firstSiteCard.locator('select.overview-key-select')).toHaveValue('key-e2e-manual');
  await expect(firstSiteCard.locator('.quota-summary')).toContainText('总额 $20.00');
  await secondSiteCard.locator('select.overview-key-select').selectOption('key-e2e-manual');
  await firstSiteCard.click();
  await expect(secondSiteCard.locator('select.overview-key-select')).toHaveValue('key-e2e-manual');
  await expect(secondSiteCard.locator('.quota-summary')).toContainText('总额 $20.00');
  const refreshBefore = await main.evaluate(async () => {
    const dashboard = await window.sub2apiDesktop?.sites.list();
    return Object.fromEntries(dashboard?.sites.map((site) => [site.id, site.fetchedAt ?? 0]) ?? []);
  });
  const keysBeforeRefreshAll = keysRequestCount;
  await main.getByRole('button', { name: '刷新站点' }).click();
  await expect(main.getByRole('button', { name: '刷新站点' })).toBeDisabled();
  await expect(main.getByText('刷新中', { exact: true })).toHaveCount(2);
  await expect
    .poll(() => keysRequestCount, { timeout: 15_000 })
    .toBeGreaterThan(keysBeforeRefreshAll);
  await expect(main.getByRole('button', { name: '刷新站点' })).toBeEnabled({ timeout: 15_000 });
  await expect
    .poll(() =>
      main.evaluate(async (before) => {
        const dashboard = await window.sub2apiDesktop?.sites.list();
        return Boolean(
          dashboard?.sites.length &&
          dashboard.sites.every((site) => (site.fetchedAt ?? 0) > (before[site.id] ?? 0)),
        );
      }, refreshBefore),
    )
    .toBe(true);
  await captureEvidence(main, '06-overview-quota');
  await expect
    .poll(() =>
      main.evaluate(async () => {
        const dashboard = await window.sub2apiDesktop?.sites.list();
        const siteId = dashboard?.currentSiteId;
        return siteId ? window.sub2apiDesktop?.sites.keyPreference(siteId) : undefined;
      }),
    )
    .toMatchObject({ mode: 'manual', keyId: 'key-e2e-manual' });
  await main.getByRole('button', { name: '使用记录', exact: true }).click();
  await main.locator('.usage-summary').scrollIntoViewIfNeeded();
  await expect(main.locator('.usage-summary').getByText('1.23K', { exact: true })).toBeVisible();
  await expect(main.getByLabel('分组').locator('option')).toContainText(
    ['全部', 'E2E 分组', '独立分组'],
    { timeout: 1_000 },
  );
  await expect(main.getByLabel('模型').locator('option')).not.toContainText('test-model');
  const usageSiteRefreshStartedAt = Date.now();
  const modelsBeforeRefresh = modelsRequestCount;
  await main.locator('.app-toolbar').getByRole('button', { name: '刷新' }).click();
  await expect.poll(() => modelsRequestCount).toBeGreaterThan(modelsBeforeRefresh);
  await expect(main.getByLabel('模型').locator('option')).toContainText(['全部', 'test-model'], {
    timeout: 5_000,
  });
  await expect(main.locator('.usage-table-panel').getByText('高', { exact: true })).toBeVisible();
  await expect(main.locator('.usage-table-panel').getByText('首字', { exact: true })).toBeVisible();
  await expect(main.locator('.usage-table-panel')).not.toContainText('缓存 Token');
  const tokenCell = main.locator('.usage-token-cell').first();
  await expect(tokenCell).toContainText('2,008');
  await expect(tokenCell).toContainText('1,879');
  await expect(tokenCell).toContainText('65.3K');
  await expect(main.locator('.usage-table-panel').getByText('2026/07/19 14:54:38')).toBeVisible();
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
    floatingLatestHost = '127.0.0.1';
    floatingLatestSequence = 1;
    await main.getByRole('button', { name: '最小化' }).click();
    await expect(floating.getByText('本地集成备注', { exact: true })).toBeVisible();
    floatingLatestHost = 'localhost';
    floatingLatestSequence = 2;
    await expect(floating.locator('.floating-header strong')).toContainText('localhost', {
      timeout: 10_000,
    });
    await expect(floating.locator('.floating-actions button')).toHaveCount(2);
    expect(
      await floating.evaluate(() => {
        const metrics = document.querySelector('.floating-metrics')?.getBoundingClientRect();
        const footer = document.querySelector('.floating-window footer')?.getBoundingClientRect();
        const actions = Array.from(
          document.querySelectorAll<HTMLButtonElement>('.floating-actions button'),
        ).map((button) => button.getBoundingClientRect());
        return {
          noOverlap: Boolean(metrics && footer && metrics.bottom <= footer.top),
          adjacent:
            actions.length === 2 &&
            actions[1]!.left - actions[0]!.right >= 0 &&
            actions[1]!.left - actions[0]!.right <= 6,
          rightAligned:
            actions.length === 2 && footer ? footer.right - actions[1]!.right <= 24 : false,
        };
      }),
    ).toEqual({ noOverlap: true, adjacent: true, rightAligned: true });
    const refreshCooldownRemaining = 5_100 - (Date.now() - usageSiteRefreshStartedAt);
    if (refreshCooldownRemaining > 0)
      await new Promise((resolve) => setTimeout(resolve, refreshCooldownRemaining));
    const keysBeforeFloatingRefresh = keysRequestCount;
    await floating.getByRole('button', { name: '刷新悬浮窗' }).click();
    await expect(floating.getByRole('button', { name: '刷新悬浮窗' })).toBeDisabled();
    await expect
      .poll(() => keysRequestCount, { timeout: 15_000 })
      .toBeGreaterThan(keysBeforeFloatingRefresh);
    await expect(floating.getByRole('button', { name: '刷新悬浮窗' })).toBeEnabled({
      timeout: 15_000,
    });
    await captureEvidence(floating, '05-floating');
  }
  await application.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
