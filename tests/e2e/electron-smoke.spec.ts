import { _electron as electron, expect, type Page, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import path from 'node:path';

const launchApplication = (userData: string, env: NodeJS.ProcessEnv = process.env) => {
  const executablePath = process.env.SUB2API_PACKAGED_EXECUTABLE;
  return electron.launch({
    ...(executablePath ? { executablePath } : { args: ['.'] }),
    env: { ...env, SUB2API_TEST_USER_DATA: userData },
  });
};

const macWindowIdScript = `
import CoreGraphics
import Foundation
let pid = Int32(CommandLine.arguments[1])!
let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
var largest: (id: Int, width: Double) = (0, 0)
for info in windows {
  guard let ownerPid = info[kCGWindowOwnerPID as String] as? Int32, ownerPid == pid else { continue }
  let bounds = info[kCGWindowBounds as String] as? [String: Any] ?? [:]
  let width = (bounds["Width"] as? NSNumber)?.doubleValue ?? 0
  let id = (info[kCGWindowNumber as String] as? NSNumber)?.intValue ?? 0
  if width > largest.width { largest = (id, width) }
}
if largest.id > 0 { print(largest.id) }
`;

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

const seedSub2ApiServer = (userData: string) => {
  const database = new DatabaseSync(path.join(userData, 'sub2api.sqlite'));
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
  `);
  database
    .prepare(
      `INSERT OR REPLACE INTO settings(key, value_json)
       VALUES ('sub2api-servers:entries', ?)`,
    )
    .run(
      JSON.stringify([
        {
          id: 'legacy-server',
          partitionId: 'persist:sub2api-server-legacy-server',
          loginState: 'logged-in',
          seenLoggedIn: true,
          createdAt: 1,
          updatedAt: 1,
          name: '旧服务器',
          baseUrl: 'https://example.invalid/',
          shortcuts: [
            { id: 'legacy-shortcut', label: '旧账号', path: '/admin/accounts', icon: 'Users' },
            { id: 'legacy-extra', label: '旧自定义', path: '/legacy', icon: 'Menu' },
          ],
        },
      ]),
    );
  database.close();
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
    const bounds = main?.getBounds();
    const display = bounds
      ? screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
      : screen.getPrimaryDisplay();
    return {
      bounds,
      contentBounds: main?.getContentBounds(),
      backgroundColor: main?.getBackgroundColor(),
      resizable: main?.isResizable(),
      workArea: display.workAreaSize,
      isPrimaryDisplay: display.id === screen.getPrimaryDisplay().id,
    };
  });
  expect(geometry.resizable).toBe(true);
  expect(geometry.backgroundColor.toLowerCase()).toBe('#f8f9ff');
  expect(geometry.contentBounds).toEqual(geometry.bounds);
  if (geometry.isPrimaryDisplay) {
    expect(
      Math.abs((geometry.bounds?.width ?? 0) - Math.round(geometry.workArea.width * 0.6)),
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs((geometry.bounds?.height ?? 0) - Math.round(geometry.workArea.height * 0.9)),
    ).toBeLessThanOrEqual(2);
  } else {
    expect(geometry.bounds?.width ?? 0).toBeGreaterThanOrEqual(720);
    expect(geometry.bounds?.width ?? 0).toBeLessThanOrEqual(geometry.workArea.width);
    expect(geometry.bounds?.height ?? 0).toBeGreaterThanOrEqual(512);
    expect(geometry.bounds?.height ?? 0).toBeLessThanOrEqual(geometry.workArea.height);
  }
  await window.screenshot({ path: 'test-results/overview.png' });
  for (const shell of [
    'api-keys',
    'usage',
    'channels',
    'sites',
    'sub2api-servers',
    'radar',
    'general-settings',
    'notification-rules',
  ]) {
    await window.goto(`file://${process.cwd()}/dist/index.html?surface=main&shell=${shell}`);
    await expect(window.locator('.app-shell')).toBeVisible();
    if (shell === 'radar') {
      await expect(window.getByRole('heading', { name: '雷达', exact: true })).toBeVisible();
      await expect(window.locator('.radar-target-card')).toHaveCount(2);
      await expect(
        window.getByRole('button', { name: '打开 Codex 雷达', exact: true }),
      ).toBeVisible();
      await expect(
        window.getByRole('button', { name: '打开 分布式雷达 Codex 站', exact: true }),
      ).toBeVisible();
      await expect(
        window.getByRole('button', { name: '删除 Codex 雷达', exact: true }),
      ).toBeVisible();
      await expect(window.getByRole('button', { name: '新增雷达站点', exact: true })).toBeVisible();
      await expect(window.locator('body')).not.toContainText('模型选型雷达');
      await expect(window.locator('body')).not.toContainText('current.json');
    }
    if (shell === 'sub2api-servers') {
      await expect(
        window.getByRole('heading', { name: 'Sub2API 服务器管理', exact: true }),
      ).toBeVisible();
      await expect(window.locator('.svr-add-button')).toBeVisible();
      await expect(window.locator('[data-svr-list-state="empty"]')).toBeVisible();
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

test('manages persistent dynamic Radar entries', async () => {
  type ElectronApplication = Awaited<ReturnType<typeof electron.launch>>;
  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-radar-manage-e2e-'));
  const launch = () => launchApplication(userData);
  const findMain = async (application: ElectronApplication) => {
    await expect
      .poll(
        async () => {
          for (const candidate of await application.windows())
            if ((await candidate.locator('.app-shell').count()) > 0) return true;
          return false;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    for (const candidate of await application.windows())
      if ((await candidate.locator('.app-shell').count()) > 0) return candidate;
    throw new Error('Main renderer window unavailable');
  };
  let application: ElectronApplication | undefined = await launch();

  try {
    let window = await findMain(application);
    await window.goto(`file://${process.cwd()}/dist/index.html?surface=main&shell=radar`);
    await expect(window.getByRole('heading', { name: '雷达', exact: true })).toBeVisible();
    await expect(window.locator('.radar-target-card')).toHaveCount(2);

    await window.getByRole('button', { name: '新增雷达站点', exact: true }).click();
    const addDialog = window.getByRole('dialog', { name: '新增雷达站点' });
    await expect(addDialog).toBeVisible();
    await expect(window.getByLabel('名称')).toBeFocused();
    await window.getByLabel('名称').fill('测试雷达');
    await window.getByLabel('网址').fill('http://example.com');
    await window.getByRole('button', { name: '确认新增', exact: true }).click();
    await expect(addDialog.getByText('网址必须是完整的 HTTPS 地址')).toBeVisible();
    await window.getByLabel('网址').fill('https://codexradar.com/');
    await window.getByRole('button', { name: '确认新增', exact: true }).click();
    await expect(addDialog.getByText('该网址已存在，请换一个网址')).toBeVisible();
    await window.getByLabel('网址').fill('https://example.com/');
    await window.getByRole('button', { name: '确认新增', exact: true }).click();
    await expect(addDialog).toHaveCount(0);
    await expect(window.locator('.radar-target-card')).toHaveCount(3);
    await expect(window.getByRole('button', { name: '打开 测试雷达', exact: true })).toBeVisible();
    await expect(window.getByRole('button', { name: '删除 测试雷达', exact: true })).toBeVisible();

    await application!.close();
    application = await launch();
    window = await findMain(application);
    await window.goto(`file://${process.cwd()}/dist/index.html?surface=main&shell=radar`);
    await expect(window.locator('.radar-target-card')).toHaveCount(3);
    await expect(window.getByRole('button', { name: '打开 测试雷达', exact: true })).toBeVisible();

    await window.getByRole('button', { name: '删除 测试雷达', exact: true }).click();
    const deleteDialog = window.getByRole('dialog', { name: '删除雷达站点' });
    await expect(deleteDialog).toBeVisible();
    await expect(deleteDialog).toContainText('https://example.com/');
    await deleteDialog.getByRole('button', { name: '取消', exact: true }).click();
    await expect(deleteDialog).toHaveCount(0);
    await expect(window.getByRole('button', { name: '打开 测试雷达', exact: true })).toBeVisible();

    await window.getByRole('button', { name: '删除 测试雷达', exact: true }).click();
    await window.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(deleteDialog).toHaveCount(0);
    await expect(window.getByRole('button', { name: '打开 测试雷达', exact: true })).toHaveCount(0);
    await expect(window.locator('.radar-target-card')).toHaveCount(2);

    await application!.close();
    application = await launch();
    window = await findMain(application);
    await window.goto(`file://${process.cwd()}/dist/index.html?surface=main&shell=radar`);
    await expect(window.locator('.radar-target-card')).toHaveCount(2);
    await expect(window.getByRole('button', { name: '打开 测试雷达', exact: true })).toHaveCount(0);

    while (await window.locator('.radar-target-card').count()) {
      await window.locator('.radar-target-delete').first().click();
      await window
        .getByRole('dialog', { name: '删除雷达站点' })
        .getByRole('button', { name: '确认删除', exact: true })
        .click();
      await expect(window.getByRole('dialog', { name: '删除雷达站点' })).toHaveCount(0);
    }
    await expect(window.locator('.radar-list-state[data-radar-list-state="empty"]')).toBeVisible();
    await expect(window.locator('.radar-add-button')).toBeVisible();
  } finally {
    await application?.close().catch(() => undefined);
  }
});

test('manages persistent Sub2API servers with template-based shortcuts', async () => {
  type ElectronApplication = Awaited<ReturnType<typeof electron.launch>>;
  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-servers-e2e-'));
  const launch = () => launchApplication(userData);
  const findMain = async (application: ElectronApplication) => {
    await expect
      .poll(
        async () => {
          for (const candidate of await application.windows())
            if ((await candidate.locator('.app-shell').count()) > 0) return true;
          return false;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    for (const candidate of await application.windows())
      if ((await candidate.locator('.app-shell').count()) > 0) return candidate;
    throw new Error('MAIN_WINDOW_NOT_FOUND');
  };

  await mkdir(userData, { recursive: true });
  seedSub2ApiServer(userData);
  let application = await launch();
  let main = await findMain(application);
  await main.getByRole('button', { name: 'Sub2API 服务器', exact: true }).click();
  await expect(main.locator('.svr-target-card')).toHaveCount(1);
  await expect(main.locator('.svr-target-card')).toContainText('旧服务器');
  await expect(
    main.locator('.svr-card-shortcuts').getByRole('button', { name: '旧账号', exact: true }),
  ).toBeVisible();
  await expect(
    main.locator('.svr-card-shortcuts').getByRole('button', { name: '旧自定义', exact: true }),
  ).toBeVisible();

  await main.getByRole('button', { name: '编辑 旧服务器', exact: true }).click();
  let editor = main.locator('.svr-dialog');
  await expect(editor.getByRole('button', { name: '获取菜单', exact: true })).toHaveCount(0);
  await expect(
    editor.getByRole('checkbox', { name: '账号管理 /admin/accounts', exact: true }),
  ).toBeChecked();
  await expect(editor.getByText('历史快捷入口')).toBeVisible();
  await expect(editor.getByText('旧自定义')).toBeVisible();
  await editor.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(main.locator('.svr-target-card')).toHaveCount(1);
  await expect(
    main.locator('.svr-card-shortcuts').getByRole('button', { name: '账号管理', exact: true }),
  ).toBeVisible();
  await expect(
    main.locator('.svr-card-shortcuts').getByRole('button', { name: '旧自定义', exact: true }),
  ).toBeVisible();

  await application.close();
  application = await launch();
  main = await findMain(application);
  await main.getByRole('button', { name: 'Sub2API 服务器', exact: true }).click();
  await expect(main.locator('.svr-target-card')).toHaveCount(1);
  await main.getByRole('button', { name: '编辑 旧服务器', exact: true }).click();
  editor = main.locator('.svr-dialog');
  await expect(
    editor.getByRole('checkbox', { name: '账号管理 /admin/accounts', exact: true }),
  ).toBeChecked();
  await expect(editor.getByText('旧自定义')).toBeVisible();
  await editor.locator('input').nth(0).fill('测试服务器改');
  await editor.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(main.locator('.svr-target-card')).toContainText('测试服务器改');
  await main.getByRole('button', { name: '删除 测试服务器改', exact: true }).click();
  await expect(main.getByRole('heading', { name: '确认删除', exact: true })).toBeVisible();
  await main.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(main.locator('[data-svr-list-state="empty"]')).toBeVisible();
  await application.close();
});

test('adds a Sub2API server without manual shortcut fields', async () => {
  type ElectronApplication = Awaited<ReturnType<typeof electron.launch>>;
  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-servers-add-e2e-'));
  const launch = () => launchApplication(userData);
  const findMain = async (application: ElectronApplication) => {
    await expect
      .poll(
        async () => {
          for (const candidate of await application.windows())
            if ((await candidate.locator('.app-shell').count()) > 0) return true;
          return false;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    for (const candidate of await application.windows())
      if ((await candidate.locator('.app-shell').count()) > 0) return candidate;
    throw new Error('MAIN_WINDOW_NOT_FOUND');
  };

  let application = await launch();
  let main = await findMain(application);
  await main.getByRole('button', { name: 'Sub2API 服务器', exact: true }).click();
  await expect(main.locator('[data-svr-list-state="empty"]')).toBeVisible();
  await main.locator('.svr-add-button').click();
  let editor = main.locator('.svr-dialog');
  await editor.locator('input').nth(0).fill('测试服务器');
  await editor.locator('input').nth(1).fill('https://example.invalid');
  await expect(
    editor.getByText('保存服务器后，再次编辑即可从内置菜单勾选快捷入口。'),
  ).toBeVisible();
  await editor.getByRole('button', { name: '添加服务器', exact: true }).click();
  await expect(main.locator('.svr-target-card')).toHaveCount(1);
  await expect(main.locator('.svr-target-card')).toContainText('example.invalid');

  await application.close();
  application = await launch();
  main = await findMain(application);
  await main.getByRole('button', { name: 'Sub2API 服务器', exact: true }).click();
  await expect(main.locator('.svr-target-card')).toHaveCount(1);
  await main.getByRole('button', { name: '编辑 测试服务器', exact: true }).click();
  editor = main.locator('.svr-dialog');
  await editor.locator('input').nth(0).fill('测试服务器改');
  await expect(editor.getByRole('button', { name: '获取菜单', exact: true })).toHaveCount(0);
  await expect(editor.getByRole('heading', { name: '我的账户', exact: true })).toBeVisible();
  await expect(editor.getByRole('heading', { name: '后台管理', exact: true })).toBeVisible();
  await editor.getByLabel('搜索快捷入口').fill('账号管理');
  await expect(
    editor.getByRole('checkbox', { name: '账号管理 /admin/accounts', exact: true }),
  ).toBeVisible();
  await expect(
    editor.getByRole('checkbox', { name: '仪表盘 /dashboard', exact: true }),
  ).toHaveCount(0);
  await editor.getByLabel('搜索快捷入口').fill('');
  for (const [label, path] of [
    ['API 密钥', '/keys'],
    ['使用记录', '/usage'],
    ['渠道状态', '/monitor'],
    ['个人资料', '/profile'],
    ['账号管理', '/admin/accounts'],
  ]) {
    await editor.getByRole('checkbox', { name: `${label} ${path}`, exact: true }).check();
  }
  await expect(editor.getByText('快捷入口（已选 5/5）', { exact: true })).toBeVisible();
  await expect(
    editor.getByRole('checkbox', { name: '仪表盘 /dashboard', exact: true }),
  ).toBeDisabled();
  await editor.getByRole('checkbox', { name: '个人资料 /profile', exact: true }).uncheck();
  await expect(editor.getByText('快捷入口（已选 4/5）', { exact: true })).toBeVisible();
  await expect(
    editor.getByRole('checkbox', { name: '仪表盘 /dashboard', exact: true }),
  ).toBeEnabled();
  await editor.getByRole('checkbox', { name: '个人资料 /profile', exact: true }).check();
  await editor.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(main.locator('.svr-target-card')).toContainText('测试服务器改');
  for (const label of ['API 密钥', '使用记录', '渠道状态', '个人资料', '账号管理']) {
    await expect(
      main.locator('.svr-card-shortcuts').getByRole('button', { name: label, exact: true }),
    ).toBeVisible();
  }

  await application.close();
  application = await launch();
  main = await findMain(application);
  await main.getByRole('button', { name: 'Sub2API 服务器', exact: true }).click();
  await expect(main.locator('.svr-target-card')).toHaveCount(1);
  await expect(main.locator('.svr-target-card')).toContainText('测试服务器改');
  for (const label of ['API 密钥', '使用记录', '渠道状态', '个人资料', '账号管理']) {
    await expect(
      main.locator('.svr-card-shortcuts').getByRole('button', { name: label, exact: true }),
    ).toBeVisible();
  }
  await main.getByRole('button', { name: '编辑 测试服务器改', exact: true }).click();
  editor = main.locator('.svr-dialog');
  await expect(editor.getByText('快捷入口（已选 5/5）', { exact: true })).toBeVisible();
  await editor.getByRole('button', { name: '取消', exact: true }).click();
  await expect(main.locator('.svr-target-card')).toHaveCount(1);
  await main.getByRole('button', { name: '删除 测试服务器改', exact: true }).click();
  await expect(main.getByRole('heading', { name: '确认删除', exact: true })).toBeVisible();
  await main.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(main.locator('[data-svr-list-state="empty"]')).toBeVisible();
  await application.close();
});

test('embeds both real Radar sites in the main Electron window', async () => {
  test.setTimeout(180_000);
  test.skip(process.env.SUB2API_RADAR_REAL_E2E !== '1', 'real Radar acceptance is opt-in');
  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-radar-e2e-'));
  let application = await launchApplication(userData);
  const evidenceDirectory = process.env.SUB2API_REAL_EVIDENCE_DIR;
  if (evidenceDirectory) await mkdir(evidenceDirectory, { recursive: true });

  const main = async () => {
    await expect
      .poll(
        async () => {
          for (const candidate of await application.windows())
            if ((await candidate.locator('.app-shell').count()) > 0) return true;
          return false;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    for (const candidate of await application.windows())
      if ((await candidate.locator('.app-shell').count()) > 0) return candidate;
    throw new Error('Main renderer window unavailable');
  };
  const radarSnapshot = async () =>
    application.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows().find(
        (candidate) => candidate.getBounds().width > 500,
      );
      const children = mainWindow?.contentView.children ?? [];
      return children.map((child) => {
        const view = child as Electron.WebContentsView;
        return {
          url: view.webContents?.getURL() ?? '',
          bounds: child.getBounds(),
        };
      });
    });
  const captureRadar = async (name: string) => {
    if (!evidenceDirectory) return;
    const image = await application.evaluate(async ({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows().find(
        (candidate) => candidate.getBounds().width > 500,
      );
      const view = mainWindow?.contentView.children
        .map((child) => child as Electron.WebContentsView)
        .find((candidate) => candidate.webContents?.getURL().startsWith('https://'));
      if (!view) return undefined;
      return (await view.webContents.capturePage()).toPNG().toString('base64');
    });
    if (image) await writeFile(path.join(evidenceDirectory, `${name}.png`), image, 'base64');
  };
  const capturePage = async (window: Page, name: string) => {
    if (!evidenceDirectory) return;
    await window.screenshot({ path: path.join(evidenceDirectory, `${name}.png`) });
  };
  const captureDesktop = async (name: string) => {
    if (!evidenceDirectory || process.platform !== 'darwin') return;
    const electronPid = await application.evaluate(() => process.pid);
    const windowId = execFileSync('swift', ['-e', macWindowIdScript, String(electronPid)], {
      encoding: 'utf8',
    }).trim();
    if (!windowId) throw new Error(`Unable to find the Electron window for PID ${electronPid}`);
    const target = path.join(evidenceDirectory, `${name}.png`);
    try {
      execFileSync('screencapture', ['-x', '-l', windowId, target], { stdio: 'ignore' });
    } catch {
      execFileSync('screencapture', ['-x', target], { stdio: 'ignore' });
    }
  };
  const focusMainWindow = async () => {
    await application.evaluate(({ app, BrowserWindow }) => {
      app.focus({ steal: true });
      const mainWindow = BrowserWindow.getAllWindows().find(
        (candidate) => candidate.getBounds().width > 500,
      );
      mainWindow?.show();
      mainWindow?.focus();
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
  };

  try {
    let window = await main();
    await window.goto(`file://${process.cwd()}/dist/index.html?surface=main&shell=radar`);
    await expect(
      window.getByRole('button', { name: '打开 Codex 雷达', exact: true }),
    ).toBeVisible();
    await expect(window.locator('.radar-target-card')).toHaveCount(2);
    if (evidenceDirectory)
      await window.screenshot({ path: path.join(evidenceDirectory, 'radar-chooser.png') });

    await window.getByRole('button', { name: '新增雷达站点', exact: true }).click();
    const addDialog = window.getByRole('dialog', { name: '新增雷达站点' });
    await expect(addDialog).toBeVisible();
    await capturePage(window, 'radar-add-dialog');
    const longLabel = '这是一个用于验证长名称换行和卡片稳定性的雷达站点名称测试';
    await window.getByLabel('名称').fill(longLabel);
    await window.getByLabel('网址').fill('http://example.com');
    await window.getByRole('button', { name: '确认新增', exact: true }).click();
    await expect(addDialog.getByText('网址必须是完整的 HTTPS 地址')).toBeVisible();
    await capturePage(window, 'radar-add-invalid-http');

    await window.getByLabel('名称').fill('Codex 雷达');
    await window.getByLabel('网址').fill('https://other.example/');
    await window.getByRole('button', { name: '确认新增', exact: true }).click();
    await expect(addDialog.getByText('该名称已存在，请换一个名称')).toBeVisible();

    await window.getByLabel('名称').fill('重复网址副本');
    await window.getByLabel('网址').fill('https://codexradar.com/');
    await window.getByRole('button', { name: '确认新增', exact: true }).click();
    await expect(addDialog.getByText('该网址已存在，请换一个网址')).toBeVisible();

    await window.getByLabel('名称').fill(longLabel);
    await window
      .getByLabel('网址')
      .fill('https://example.com/very/long/path?query=radar-long-url-test');
    await window.getByRole('button', { name: '确认新增', exact: true }).click();
    await expect(addDialog).toHaveCount(0);
    await expect(window.locator('.radar-target-card')).toHaveCount(3);
    await expect(
      window.getByRole('button', { name: `打开 ${longLabel}`, exact: true }),
    ).toBeVisible();
    await capturePage(window, 'radar-after-add-long');

    await window.getByRole('button', { name: '打开 Codex 雷达', exact: true }).click();
    await expect(window.getByRole('button', { name: '关闭雷达网页', exact: true })).toBeVisible();
    await expect
      .poll(async () =>
        (await radarSnapshot()).some((view) => view.url.startsWith('https://codexradar.com')),
      )
      .toBe(true);
    await focusMainWindow();
    await captureDesktop('radar-codex-window');
    await captureRadar('radar-codex');
    const codexBounds = (await radarSnapshot()).find((view) =>
      view.url.startsWith('https://codexradar.com'),
    )?.bounds;
    expect(codexBounds).toEqual(
      expect.objectContaining({
        x: 284,
        y: 80,
        width: expect.any(Number),
        height: expect.any(Number),
      }),
    );

    const originalContentSize = await application.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows().find(
        (candidate) => candidate.getBounds().width > 500,
      );
      return mainWindow?.getContentSize();
    });
    await application.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows().find(
        (candidate) => candidate.getBounds().width > 500,
      );
      mainWindow?.setContentSize(960, 640);
    });
    await expect
      .poll(
        async () =>
          (await radarSnapshot()).find((view) => view.url.startsWith('https://codexradar.com'))
            ?.bounds,
      )
      .toEqual({ x: 284, y: 80, width: 676, height: 560 });
    await focusMainWindow();
    await captureDesktop('radar-codex-window-small');
    if (originalContentSize)
      await application.evaluate(({ BrowserWindow }, size) => {
        const mainWindow = BrowserWindow.getAllWindows().find(
          (candidate) => candidate.getBounds().width > 500,
        );
        mainWindow?.setContentSize(size[0], size[1]);
      }, originalContentSize);

    await window.getByRole('button', { name: '关闭雷达网页', exact: true }).click();
    await expect(
      window.getByRole('button', { name: '打开 Codex 雷达', exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () =>
        (await radarSnapshot()).some((view) => view.url.startsWith('https://codexradar.com')),
      )
      .toBe(false);

    await window.getByRole('button', { name: '打开 分布式雷达 Codex 站', exact: true }).click();
    await expect(window.getByRole('button', { name: '关闭雷达网页', exact: true })).toBeVisible();
    await expect
      .poll(async () =>
        (await radarSnapshot()).some((view) => view.url.startsWith('https://deng.codexradar.com')),
      )
      .toBe(true);
    await focusMainWindow();
    await captureDesktop('radar-distributed-window');
    await captureRadar('radar-distributed');
    await application.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows().find(
        (candidate) => candidate.getBounds().width > 500,
      );
      const view = mainWindow?.contentView.children
        .map((child) => child as Electron.WebContentsView)
        .find((candidate) => candidate.webContents?.getURL().startsWith('https://'));
      view?.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
      view?.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    });
    await expect(
      window.getByRole('button', { name: '打开 分布式雷达 Codex 站', exact: true }),
    ).toBeVisible();
    await expect(window.getByRole('button', { name: '关闭雷达网页', exact: true })).toHaveCount(0);

    await window.getByRole('button', { name: `打开 ${longLabel}`, exact: true }).click();
    await expect(window.getByRole('button', { name: '关闭雷达网页', exact: true })).toBeVisible();
    await expect
      .poll(async () =>
        (await radarSnapshot()).some((view) => view.url.startsWith('https://example.com')),
      )
      .toBe(true);
    await focusMainWindow();
    await captureDesktop('radar-added-window');
    await captureRadar('radar-added');
    await window.getByRole('button', { name: '关闭雷达网页', exact: true }).click();
    await expect(
      window.getByRole('button', { name: `打开 ${longLabel}`, exact: true }),
    ).toBeVisible();

    await application!.close();
    application = await launchApplication(userData);
    window = await main();
    await window.goto(`file://${process.cwd()}/dist/index.html?surface=main&shell=radar`);
    await expect(window.locator('.radar-target-card')).toHaveCount(3);
    await expect(
      window.getByRole('button', { name: `打开 ${longLabel}`, exact: true }),
    ).toBeVisible();
    await capturePage(window, 'radar-persisted-after-restart');

    await window.getByRole('button', { name: `删除 ${longLabel}`, exact: true }).click();
    const deleteDialog = window.getByRole('dialog', { name: '删除雷达站点' });
    await expect(deleteDialog).toBeVisible();
    await expect(deleteDialog).toContainText('https://example.com/very/long/path');
    await capturePage(window, 'radar-delete-dialog');
    await deleteDialog.getByRole('button', { name: '取消', exact: true }).click();
    await expect(deleteDialog).toHaveCount(0);
    await expect(
      window.getByRole('button', { name: `打开 ${longLabel}`, exact: true }),
    ).toBeVisible();

    await window.getByRole('button', { name: `删除 ${longLabel}`, exact: true }).click();
    await window.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(deleteDialog).toHaveCount(0);
    await expect(
      window.getByRole('button', { name: `打开 ${longLabel}`, exact: true }),
    ).toHaveCount(0);
    await expect(window.locator('.radar-target-card')).toHaveCount(2);

    while (await window.locator('.radar-target-card').count()) {
      await window.locator('.radar-target-delete').first().click();
      await window
        .getByRole('dialog', { name: '删除雷达站点' })
        .getByRole('button', { name: '确认删除', exact: true })
        .click();
      await expect(window.getByRole('dialog', { name: '删除雷达站点' })).toHaveCount(0);
    }
    await expect(window.locator('.radar-list-state[data-radar-list-state="empty"]')).toBeVisible();
    await capturePage(window, 'radar-empty');
  } finally {
    await application.close();
  }
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

  await main.getByRole('button', { name: '设置', exact: true }).click();
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
  await restartedMain.goto(
    `file://${process.cwd()}/dist/index.html?surface=main&shell=general-settings`,
  );
  await expect(restartedMain.getByRole('heading', { name: '通用设置' })).toBeVisible();
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
  test.setTimeout(75_000);
  let keysRequestCount = 0;
  let availableRatesRequestCount = 0;
  let channelRequestCount = 0;
  let channelDetailRequestCount = 0;
  const channelDetailRequestCountById = new Map<string, number>();
  const failingChannelDetails = new Set(['channel-e2e-1']);
  let channelDelayMs = 0;
  let channelListMode: 'success' | 'error' = 'success';
  const channelErrorPorts = new Set<number>();
  let modelsRequestCount = 0;
  let floatingLatestHost: string | undefined;
  let floatingLatestSequence = 0;
  let channelTimelineRevision = 0;
  let channelTimelineLimit: number | undefined;
  let availableRatesMode: 'success' | 'delayed' | 'error' | 'empty' = 'success';
  let availableChannelsMode: 'complete' | 'partial' = 'complete';
  let includeSecondaryG1Association = false;
  let managedKeyGroupId = '101';
  let interactiveVerificationEnabled = false;
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
  const channelFixtures = [
    { name: 'E2E 分组精准通道', platform: 'openai', model: 'gpt-e2e', status: 'normal' },
    { name: 'OpenAI 便宜 A', platform: 'openai', model: 'gpt-e2e', status: 'normal' },
    { name: 'OpenAI 便宜 B', platform: 'openai', model: 'gpt-e2e', status: 'degraded' },
    { name: 'Claude 通道', platform: 'anthropic', model: 'claude-e2e', status: 'normal' },
    { name: 'Gemini 通道', platform: 'google', model: 'gemini-e2e', status: 'normal' },
    { name: 'Grok 通道', platform: 'xai', model: 'grok-e2e', status: 'normal' },
    { name: '本地模型通道', platform: 'Local-Lab', model: 'local-e2e', status: 'normal' },
  ] as const;
  const handleRequest = (request: IncomingMessage, response: ServerResponse) => {
    response.setHeader('content-type', 'application/json');
    const url = request.url ?? '';
    if (url === '/api/v1/settings/public')
      return response.end(
        JSON.stringify({
          data: {
            turnstile_enabled: interactiveVerificationEnabled,
            geetest_enabled: false,
          },
        }),
      );
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
    if (request.method === 'GET' && url.startsWith('/api/v1/keys?page=1&page_size=20'))
      return response.end(
        JSON.stringify({
          data: {
            items: [
              {
                id: 101,
                name: 'E2E Managed Key',
                key: 'x',
                status: 'active',
                group_id: Number(managedKeyGroupId),
                group: {
                  id: Number(managedKeyGroupId),
                  name: managedKeyGroupId === '101' ? 'E2E 管理分组' : 'E2E 高速分组',
                },
                current_concurrency: 2,
                created_at: '2026-07-24T00:00:00Z',
              },
            ],
            page: 1,
            page_size: 20,
            pages: 1,
            total: 1,
          },
        }),
      );
    if (request.method === 'GET' && url === '/api/v1/keys/101')
      return response.end(
        JSON.stringify({
          data: {
            id: 101,
            name: 'E2E Managed Key',
            key: 'x',
            status: 'active',
            group_id: Number(managedKeyGroupId),
            group: {
              id: Number(managedKeyGroupId),
              name: managedKeyGroupId === '101' ? 'E2E 管理分组' : 'E2E 高速分组',
            },
            created_at: '2026-07-24T00:00:00Z',
          },
        }),
      );
    if (request.method === 'PUT' && url === '/api/v1/keys/101') {
      managedKeyGroupId = '202';
      return response.end(JSON.stringify({ data: { id: 101 } }));
    }
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
              group: {
                id: 'g1',
                name: 'E2E 分组',
                platform: 'openai',
                rate_multiplier: 1.4,
                status: 'active',
              },
              quota: 80.88,
              quota_used: 66.5,
            },
            {
              id: 'key-e2e-manual',
              name: 'Manual E2E Key',
              status: 'active',
              group_id: 'g2',
              group: {
                id: 'g2',
                name: '独立分组',
                platform: 'openai',
                rate_multiplier: 0.8,
                status: 'active',
              },
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
            { id: 101, name: 'E2E 管理分组', platform: 'openai', ratio: 1 },
            { id: 202, name: 'E2E 高速分组', platform: 'openai', ratio: 0.5 },
          ],
        }),
      );
    if (url === '/api/v1/groups/rates')
      return response.end(JSON.stringify({ data: { g1: 1.4, 101: 1, 202: 0.5 } }));
    if (url === '/api/v1/channels/available')
      return response.end(
        JSON.stringify({
          data: [
            {
              name: 'E2E 分组精准通道',
              platforms: [
                {
                  platform: 'openai',
                  groups:
                    availableChannelsMode === 'complete'
                      ? [{ id: 'g1', name: 'E2E 分组' }]
                      : [{ name: 'E2E 分组' }],
                  supported_models: [{ name: 'gpt-e2e' }],
                },
              ],
            },
            {
              name: 'OpenAI 便宜 A',
              platforms: [
                {
                  platform: 'openai',
                  groups: [
                    { id: 'rate-openai-a', name: 'OpenAI 便宜 A' },
                    ...(includeSecondaryG1Association ? [{ id: 'g1', name: 'E2E 分组' }] : []),
                  ],
                  supported_models: [{ name: 'gpt-e2e' }],
                },
              ],
            },
            {
              name: 'OpenAI 便宜 B',
              platforms: [
                {
                  platform: 'openai',
                  groups: [{ id: 'rate-openai-b', name: 'OpenAI 便宜 B' }],
                  supported_models: [{ name: 'gpt-e2e' }],
                },
              ],
            },
          ],
        }),
      );
    if (request.method === 'POST' && url === '/api/v1/usage/dashboard/api-keys-usage')
      return response.end(
        JSON.stringify({ data: { stats: { 101: { api_key_id: 101, today_actual_cost: 0.25 } } } }),
      );
    if (url.startsWith('/api/v1/user/api-keys/101/usage/daily'))
      return response.end(
        JSON.stringify({ data: { items: [{ date: '2026-07-24', actual_cost: 0.75 }] } }),
      );
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
      const requestPort = Number(
        String(request.headers.host ?? '')
          .split(':')
          .at(-1),
      );
      if (channelListMode === 'error' || channelErrorPorts.has(requestPort)) {
        response.statusCode = 503;
        return response.end(JSON.stringify({ message: 'temporarily unavailable' }));
      }
      const timelineStatuses = ['normal', 'degraded', 'unknown', 'failed'] as const;
      const timelineLength = channelTimelineLimit ?? 12 + channelTimelineRevision;
      const timelineNow = Date.now();
      const timeline = Array.from({ length: timelineLength }, (_, index) => {
        const recentIndex = index - 8;
        return {
          status:
            index < 8
              ? timelineStatuses[index % timelineStatuses.length]
              : index === 12
                ? 'degraded'
                : 'normal',
          checked_at: new Date(
            index < 8
              ? timelineNow - (120 - index * 5) * 1_000
              : timelineNow - (timelineLength - 1 - index) * 10_000,
          ).toISOString(),
          latency_ms: 120 + index,
          ping_latency_ms: 40 + recentIndex,
        };
      }).reverse();
      const body = JSON.stringify({
        data: channelFixtures.map((fixture, index) => ({
          id: `channel-e2e-${index + 1}`,
          name: fixture.name,
          platform: fixture.platform,
          group_name: '',
          primary_model: fixture.model,
          primary_status: fixture.status,
          availability_7d: fixture.status === 'degraded' ? 90.76 : 99.9,
          timeline,
        })),
      });
      if (channelDelayMs) {
        setTimeout(() => response.end(body), channelDelayMs);
        return;
      }
      return response.end(body);
    }
    if (url.startsWith('/api/v1/channel-monitors/channel-e2e-') && url.endsWith('/status')) {
      const channelId = url.split('/').at(-2) ?? '';
      channelDetailRequestCount += 1;
      channelDetailRequestCountById.set(
        channelId,
        (channelDetailRequestCountById.get(channelId) ?? 0) + 1,
      );
      if (failingChannelDetails.has(channelId)) {
        response.statusCode = 503;
        return response.end(JSON.stringify({ message: 'channel detail temporarily unavailable' }));
      }
      const fixtureIndex = Number(channelId.split('-').at(-1)) - 1;
      const fixture = channelFixtures[fixtureIndex] ?? channelFixtures[0];
      return response.end(
        JSON.stringify({
          data: {
            id: channelId,
            name:
              channelId === 'channel-e2e-1'
                ? '用于验证超长渠道名称不会撑高当前渠道摘要固定槽位的渠道'
                : fixture.name,
            platform: fixture.platform,
            group_name: fixture.name,
            models: [
              {
                model: fixture.model,
                latest_status: fixture.status,
                availability_7d: fixture.status === 'degraded' ? 90.76 : 99.9,
              },
            ],
          },
        }),
      );
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ message: 'missing' }));
  };
  const server = createServer(handleRequest);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('E2E mock server unavailable');
  const layoutServers = Array.from({ length: 3 }, () => createServer(handleRequest));
  for (const layoutServer of layoutServers)
    await new Promise<void>((resolve) => layoutServer.listen(0, '127.0.0.1', resolve));
  const layoutPorts = layoutServers.map((layoutServer) => {
    const layoutAddress = layoutServer.address();
    if (!layoutAddress || typeof layoutAddress === 'string')
      throw new Error('E2E layout server unavailable');
    return layoutAddress.port;
  });
  channelErrorPorts.add(layoutPorts.at(-1)!);
  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-e2e-'));
  const exportPath = path.join(userData, 'usage.csv');
  const application = await launchApplication(userData, {
    ...process.env,
    SUB2API_TEST_SECRET_CODEC: 'memory',
    SUB2API_TEST_EXPORT_PATH: exportPath,
  });
  const packageManifest = JSON.parse(
    await readFile(path.join(process.cwd(), 'package.json'), 'utf8'),
  ) as { version?: string };
  await expect.poll(async () => (await application.windows()).length).toBe(2);
  const appWindows = await application.windows();
  let main = appWindows[0]!;
  for (const candidate of appWindows)
    if ((await candidate.locator('.app-shell').count()) > 0) main = candidate;
  expect(await main.evaluate(() => typeof window.sub2apiDesktop)).toBe('object');
  await expect(main.getByText('最后更新：', { exact: false })).toBeVisible();
  await expect(main.locator('.app-version-badge')).toContainText(`v${packageManifest.version}`);
  await expect(main.locator('.app-version-badge')).toBeEnabled({ timeout: 20_000 });
  await main.locator('.app-version-badge').click();
  await expect(main.locator('.app-notification')).toContainText(
    /正在检查更新|当前已是最新版本|发现新版本|检查更新失败/,
    { timeout: 5_000 },
  );
  await expect(main.getByRole('heading', { name: '添加新站点' })).toBeVisible();
  await main.getByPlaceholder('例如: OpenAI 备用节点').fill('本地集成站点');
  await main.getByPlaceholder('https://api.example.com').fill(`http://127.0.0.1:${address.port}`);
  await main.getByLabel('用户名', { exact: true }).fill('e2e@example.invalid');
  await main.getByLabel('密码', { exact: true }).fill('runtime-only');
  await main.getByRole('button', { name: '添加并验证' }).click();
  await expect(main.getByText('站点验证成功')).toBeVisible({ timeout: 15_000 });
  interactiveVerificationEnabled = true;
  await main.getByPlaceholder('例如: OpenAI 备用节点').fill('Turnstile 关闭测试');
  await main.getByLabel('用户名', { exact: true }).fill('turnstile-close@example.invalid');
  await main.getByLabel('密码', { exact: true }).fill('runtime-only');
  await main.getByRole('button', { name: '添加并验证' }).click();
  const securityDialog = main.getByRole('dialog', { name: '需要完成安全验证' });
  await expect(securityDialog).toBeVisible();
  await expect(securityDialog).toContainText('Cloudflare Turnstile');
  await expect(securityDialog.getByRole('button', { name: '开始登录' })).toBeVisible();
  await expect(securityDialog.getByRole('button', { name: '开始验证' })).toHaveCount(0);
  const securityDialogWideBounds = await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((candidate) => candidate.getBounds().width > 500)
      ?.getBounds(),
  );
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()
      .find((candidate) => candidate.getBounds().width > 500)
      ?.setBounds({ x: 0, y: 0, width: 720, height: 520 });
  });
  await main.waitForTimeout(200);
  expect(
    await securityDialog.evaluate((dialog) => {
      const dialogRect = dialog.getBoundingClientRect();
      const controls = Array.from(dialog.querySelectorAll('button')).map((button) =>
        button.getBoundingClientRect(),
      );
      return {
        insideViewport:
          dialogRect.left >= 0 &&
          dialogRect.top >= 0 &&
          dialogRect.right <= window.innerWidth &&
          dialogRect.bottom <= window.innerHeight,
        controlsInside: controls.every(
          (rect) =>
            rect.left >= dialogRect.left &&
            rect.top >= dialogRect.top &&
            rect.right <= dialogRect.right &&
            rect.bottom <= dialogRect.bottom,
        ),
        maxHeight: Number.parseFloat(getComputedStyle(dialog).maxHeight),
        viewportSafeHeight: window.innerHeight - 32,
      };
    }),
  ).toMatchObject({
    insideViewport: true,
    controlsInside: true,
    maxHeight: 488,
    viewportSafeHeight: 488,
  });
  await captureEvidence(main, '20-security-dialog-narrow');
  await securityDialog.getByLabel('关闭安全验证').click();
  await expect(securityDialog).toHaveCount(0);
  await expect
    .poll(() =>
      main.evaluate(async () => (await window.sub2apiDesktop?.sites.list())?.sites.length),
    )
    .toBe(1);
  if (securityDialogWideBounds)
    await application.evaluate(({ BrowserWindow }, bounds) => {
      BrowserWindow.getAllWindows()
        .find((candidate) => candidate.getBounds().width > 500)
        ?.setBounds(bounds);
    }, securityDialogWideBounds);
  await main.getByRole('button', { name: '添加并验证' }).click();
  await expect(securityDialog).toBeVisible();
  await main.keyboard.press('Escape');
  await expect(securityDialog).toHaveCount(0);
  await expect
    .poll(() =>
      main.evaluate(async () => (await window.sub2apiDesktop?.sites.list())?.sites.length),
    )
    .toBe(1);
  interactiveVerificationEnabled = false;
  expect(await main.locator('.app-sidebar nav .nav-item span').allTextContents()).toEqual([
    '全部站点',
    'API 密钥',
    '使用记录',
    '渠道状态',
    '站点管理',
    'Sub2API 服务器',
    '雷达',
    '常用网站',
  ]);
  await main.getByRole('button', { name: 'API 密钥', exact: true }).click();
  await expect(main.getByRole('heading', { name: 'API 密钥', exact: true })).toBeVisible();
  await expect(main.getByText('E2E Managed Key', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(main.locator('.api-keys-full-key')).toContainText('x');
  const groupTrigger = main.locator(
    '.api-keys-group-select-trigger[aria-label="切换E2E Managed Key的分组"]',
  );
  await groupTrigger.click();
  const groupMenu = main.locator('.api-keys-group-select-menu');
  const [triggerBox, menuBox] = await Promise.all([
    groupTrigger.boundingBox(),
    groupMenu.boundingBox(),
  ]);
  expect(menuBox?.width ?? 0).toBeGreaterThanOrEqual(triggerBox?.width ?? 0);
  await main
    .locator('.api-keys-group-select-menu')
    .getByRole('option', { name: /E2E 高速分组.*OpenAI.*0\.50x/ })
    .click();
  await expect(main.getByText('分组已同步到远程站点', { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(groupTrigger).toContainText('E2E 高速分组');
  const apiKeysWindowBounds = await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((candidate) => candidate.getBounds().width > 500)
      ?.getBounds(),
  );
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()
      .find((candidate) => candidate.getBounds().width > 500)
      ?.setBounds({ x: 0, y: 0, width: 1600, height: 900 });
  });
  await expect(main.locator('.api-keys-table-wrap')).toBeVisible();
  await captureEvidence(main, '14-api-keys-wide');
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()
      .find((candidate) => candidate.getBounds().width > 500)
      ?.setBounds({ x: 0, y: 0, width: 720, height: 800 });
  });
  await expect(main.locator('.api-keys-table-wrap')).toHaveCSS('overflow-x', 'auto');
  await captureEvidence(main, '15-api-keys-narrow');
  if (apiKeysWindowBounds)
    await application.evaluate(({ BrowserWindow }, bounds) => {
      BrowserWindow.getAllWindows()
        .find((candidate) => candidate.getBounds().width > 500)
        ?.setBounds(bounds);
    }, apiKeysWindowBounds);
  await main.getByRole('button', { name: '站点管理', exact: true }).click();
  await main.getByLabel('用户名', { exact: true }).fill('e2e@example.invalid');
  await main.getByLabel('密码', { exact: true }).fill('runtime-only');
  await main.getByText('批量添加站点', { exact: true }).click();
  await main.locator('.batch-entry textarea').fill(`http://localhost:${address.port}\nnot-a-url`);
  await main.getByRole('button', { name: '批量验证并保存' }).click();
  await expect(main.locator('.batch-progress-panel')).toBeVisible({ timeout: 15_000 });
  await expect(main.locator('.batch-progress-panel')).toContainText('全部完成', {
    timeout: 15_000,
  });
  await expect(main.locator('.batch-progress-panel')).toContainText('100%');
  await expect(main.locator('.site-task-card')).toHaveCount(2);
  await main.locator('.site-task-card').first().click();
  await expect(main.getByRole('dialog', { name: /localhost/ })).toBeVisible();
  await expect(main.getByRole('dialog', { name: /localhost/ })).toContainText('核心能力');
  await captureEvidence(main, '26-batch-card-detail');
  await main.getByLabel('关闭站点详情').click();
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()
      .find((candidate) => candidate.getBounds().width > 500)
      ?.setBounds({ x: 0, y: 0, width: 1600, height: 900 });
  });
  await captureEvidence(main, '21-batch-cards-wide');
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()
      .find((candidate) => candidate.getBounds().width > 500)
      ?.setBounds({ x: 0, y: 0, width: 720, height: 800 });
  });
  await main.locator('.site-task-card').first().scrollIntoViewIfNeeded();
  await captureEvidence(main, '22-batch-cards-narrow');
  await captureEvidence(main, '07-batch-progress');
  channelDelayMs = 1_200;
  const additionalSites = await main.evaluate(async (ports) => {
    const desktop = window.sub2apiDesktop?.sites;
    if (!desktop) throw new Error('Desktop bridge unavailable');
    const inputs = [
      { port: ports[0], name: '用于验证超长站点名称不会挤压底部操作区的测试站点' },
      { port: ports[1], name: '布局密度测试站点' },
      { port: ports[2], name: '第五个布局测试站点' },
    ];
    const sites = [];
    for (const input of inputs) {
      const result = await desktop.addAndVerify({
        name: input.name,
        url: `http://127.0.0.1:${input.port}`,
        account: 'e2e@example.invalid',
        password: 'runtime-only',
      });
      if (result.status !== 'added') throw new Error('Unexpected interactive verification');
      sites.push(result.site);
    }
    await desktop.setNote(
      sites[0]!.id,
      '这是一段用于验证长备注不会改变当前渠道摘要和底部操作区基线的测试备注',
    );
    return sites.map((site) => site.id);
  }, layoutPorts);
  expect(additionalSites).toHaveLength(3);
  await main.getByRole('button', { name: '全部站点', exact: true }).click();
  await expect(main.locator('.site-card')).toHaveCount(5);
  await expect(main.locator('.site-card > .rate-inline-channel')).toHaveCount(5);
  await expect(main.getByText('正在获取余额', { exact: false })).toHaveCount(0);
  const currentKeyCreditMetric = main.locator('.metric-card').filter({
    hasText: '所选 Key 可用额度',
  });
  await expect(currentKeyCreditMetric).toContainText('$42.50');
  await currentKeyCreditMetric.scrollIntoViewIfNeeded();
  await captureEvidence(main, '16-overview-credit-sum');
  expect(
    await main
      .locator('.site-card > .rate-inline-channel')
      .evaluateAll((summaries) =>
        summaries.every(
          (summary) =>
            Math.abs(
              summary.getBoundingClientRect().height - summaries[0]!.getBoundingClientRect().height,
            ) <= 1,
        ),
      ),
  ).toBe(true);
  channelDelayMs = 0;
  await expect(main.locator('.site-card > .rate-inline-channel.is-error')).toHaveCount(1);
  await expect(
    main.locator('.site-card > .rate-inline-channel').filter({ hasText: '自动关联' }),
  ).toHaveCount(4);
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
  await expect(firstSiteCard.locator('.quota-summary')).toContainText('总额 $20.00');
  await expect(firstSiteCard.locator('.rate-inline-channel')).toContainText(
    '当前分组未关联到具体渠道',
  );
  expect(
    await firstSiteCard.locator('.rate-inline-channel').evaluate((summary) => {
      const sibling = Array.from(
        document.querySelectorAll<HTMLElement>('.rate-inline-channel'),
      ).find((candidate) => candidate !== summary);
      return sibling
        ? Math.abs(summary.getBoundingClientRect().height - sibling.getBoundingClientRect().height)
        : Number.POSITIVE_INFINITY;
    }),
  ).toBeLessThanOrEqual(1);
  await main.getByLabel('本地集成站点 默认 Key').selectOption('auto');
  await expect(firstSiteCard.locator('.quota-summary')).toContainText('总额 $80.88');
  await expect(firstSiteCard.locator('.site-card-balance')).toContainText('$8.50');
  await expect(firstSiteCard.locator('.site-card-meta')).toContainText('1.4x');
  await main.getByLabel('本地集成站点 默认 Key').selectOption('key-e2e-manual');
  await expect(firstSiteCard.locator('.quota-summary')).toContainText('总额 $20.00');
  await main.getByLabel('本地集成站点 默认 Key').selectOption('auto');
  await expect(firstSiteCard.locator('.quota-summary')).toContainText('总额 $80.88');
  const secondSiteCard = main.locator('.site-card').filter({ hasText: 'localhost' });
  const selectedSiteIdBeforeRates = await main.evaluate(async () => {
    const dashboard = await window.sub2apiDesktop?.sites.list();
    return dashboard?.currentSiteId;
  });
  const channelsBeforeInlineStatus = channelRequestCount;
  await firstSiteCard.getByLabel('本地集成站点 设置充值比例').click();
  await firstSiteCard.getByRole('button', { name: '自定义比例' }).click();
  await firstSiteCard.getByLabel('本地集成站点 自定义充值比例').fill('-1');
  await firstSiteCard.getByRole('button', { name: '保存充值比例' }).click();
  await expect(firstSiteCard.getByText('请输入大于 0 的数字')).toBeVisible();
  await firstSiteCard.getByLabel('本地集成站点 自定义充值比例').fill('2.5');
  await firstSiteCard.getByRole('button', { name: '保存充值比例' }).click();
  await expect(firstSiteCard.getByLabel('本地集成站点 设置充值比例')).toHaveAttribute(
    'title',
    '设置充值比例，当前 1:2.5',
  );
  await firstSiteCard.getByLabel('本地集成站点 设置充值比例').click();
  await firstSiteCard.getByRole('button', { name: '1:10' }).click();
  await expect(firstSiteCard.getByLabel('本地集成站点 设置充值比例')).toHaveAttribute(
    'title',
    '设置充值比例，当前 1:10',
  );
  await expect
    .poll(() => channelRequestCount, { timeout: 15_000 })
    .toBe(channelsBeforeInlineStatus);
  await expect
    .poll(() => channelDetailRequestCountById.get('channel-e2e-1') ?? 0, { timeout: 15_000 })
    .toBeGreaterThan(0);
  await expect(firstSiteCard).not.toContainText('当前分组匹配到多个渠道');
  expect(channelDetailRequestCountById.get('channel-e2e-2') ?? 0).toBe(0);
  await expect(firstSiteCard.locator('.rate-inline-channel')).toContainText('E2E 分组');
  await expect(firstSiteCard).toContainText('详情加载失败，可单独重试');
  const currentDetailRequestsBeforeRetry = channelDetailRequestCountById.get('channel-e2e-1') ?? 0;
  failingChannelDetails.delete('channel-e2e-1');
  await firstSiteCard.getByTitle('重试渠道详情').click();
  await expect
    .poll(() => channelDetailRequestCountById.get('channel-e2e-1') ?? 0)
    .toBeGreaterThan(currentDetailRequestsBeforeRetry);
  await expect(firstSiteCard).not.toContainText('详情加载失败，可单独重试');
  await expect(firstSiteCard.locator('.rate-inline-channel-heading > b')).toHaveAttribute(
    'title',
    '用于验证超长渠道名称不会撑高当前渠道摘要固定槽位的渠道',
  );
  expect(
    await firstSiteCard.locator('.rate-inline-channel-heading > b').evaluate((name) => ({
      whiteSpace: getComputedStyle(name).whiteSpace,
      contained: name.scrollWidth > name.clientWidth,
      summaryHeight: name.closest('.rate-inline-channel')?.getBoundingClientRect().height,
    })),
  ).toEqual({ whiteSpace: 'nowrap', contained: true, summaryHeight: 102 });
  await expect(main.locator('.rate-comparison-band')).toContainText('OpenAI');
  await expect(main.getByRole('heading', { name: '倍率对比', exact: true })).toHaveCount(0);
  await expect(main.getByText('按充值比例折算后，比较各平台最低分组', { exact: true })).toHaveCount(
    0,
  );
  await expect(main.locator('.rate-comparison-band')).toContainText('0.04');
  await expect(main.locator('.rate-comparison-list')).toHaveAttribute('tabindex', '0');
  await expect(main.getByLabel('倍率对比自动刷新周期')).toHaveValue('5');
  await expect(main.getByLabel('倍率对比自动刷新周期').locator('option')).toHaveCount(4);
  const openAiRateCard = main.locator('.rate-platform-card[data-platform="openai"]');
  await expect(openAiRateCard.locator('.rate-platform-site')).toHaveCount(1);
  await expect(openAiRateCard).toContainText('OpenAI 便宜 A');
  await expect(openAiRateCard).not.toContainText('OpenAI 便宜 B');
  await expect(openAiRateCard.locator('.rate-inline-channel')).toHaveCount(0);
  await expect(openAiRateCard).toContainText('近 1 分钟稳定');
  await expect(main.locator('.rate-platform-logo')).toHaveCount(4);
  await expect(main.locator('.rate-platform-content')).toHaveCount(5);
  expect(
    await main.locator('.rate-comparison-list').evaluate((list) => {
      const cards = Array.from(list.querySelectorAll<HTMLElement>('.rate-platform-card'));
      const listStyle = getComputedStyle(list);
      const cardRects = cards.slice(0, 4).map((card) => card.getBoundingClientRect());
      return {
        order: cards.map((card) => card.dataset.platform),
        oneRow: new Set(cards.map((card) => card.offsetTop)).size === 1,
        scrollable: list.scrollWidth > list.clientWidth,
        overflowX: listStyle.overflowX,
        gap: listStyle.columnGap,
        scrollbarWidth: listStyle.scrollbarWidth,
        webkitScrollbarDisplay: getComputedStyle(list, '::-webkit-scrollbar').display,
        equalCardHeights:
          Math.max(...cardRects.map((rect) => rect.height)) -
            Math.min(...cardRects.map((rect) => rect.height)) <=
          1,
        cardRadius: getComputedStyle(cards[0]!).borderRadius,
        cardPadding: getComputedStyle(cards[0]!).paddingTop,
        contentRadius: getComputedStyle(
          cards[0]!.querySelector<HTMLElement>('.rate-platform-content')!,
        ).borderRadius,
        logoSizes: cards.slice(0, 4).map((card) => {
          const logo = card.querySelector<HTMLImageElement>('.rate-platform-logo')!;
          const rect = logo.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            loaded: logo.complete && logo.naturalWidth > 0,
            svg:
              logo.src.startsWith('data:image/svg+xml') ||
              new URL(logo.src).pathname.endsWith('.svg'),
          };
        }),
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
    overflowX: 'auto',
    gap: '24px',
    scrollbarWidth: 'none',
    webkitScrollbarDisplay: 'none',
    equalCardHeights: true,
    cardRadius: '32px',
    cardPadding: '16px',
    contentRadius: '24px',
    logoSizes: [
      { width: 40, height: 40, loaded: true, svg: true },
      { width: 40, height: 40, loaded: true, svg: true },
      { width: 40, height: 40, loaded: true, svg: true },
      { width: 40, height: 40, loaded: true, svg: true },
    ],
    colors: {
      openai: 'rgb(255, 255, 255)',
      claude: 'rgb(255, 255, 255)',
      gemini: 'rgb(255, 255, 255)',
      grok: 'rgb(255, 255, 255)',
    },
  });
  expect(
    await main.locator('.site-card').evaluateAll((cards) => {
      const measurements = cards.map((card) => {
        const cardRect = card.getBoundingClientRect();
        const footer = card.querySelector<HTMLElement>('.site-card-actions');
        const summary = card.querySelector<HTMLElement>('.rate-inline-channel');
        const controls = footer ? Array.from(footer.children) : [];
        const controlRects = controls.map((control) => control.getBoundingClientRect());
        const footerRect = footer?.getBoundingClientRect();
        const summaryRect = summary?.getBoundingClientRect();
        return {
          controlCount: controls.length,
          display: footer ? getComputedStyle(footer).display : '',
          flexWrap: footer ? getComputedStyle(footer).flexWrap : '',
          oneRow:
            controlRects.length === 3 &&
            Math.max(...controlRects.map((rect) => rect.top)) -
              Math.min(...controlRects.map((rect) => rect.top)) <=
              1 &&
            Math.max(...controlRects.map((rect) => rect.bottom)) -
              Math.min(...controlRects.map((rect) => rect.bottom)) <=
              1,
          insideBounds: Boolean(
            footer &&
            footerRect &&
            controlRects.every(
              (rect) =>
                rect.left >= footerRect.left - 1 &&
                rect.right <= footerRect.right + 1 &&
                rect.right <= cardRect.right + 1,
            ),
          ),
          noOverflow: Boolean(
            footer &&
            footer.scrollWidth <= footer.clientWidth + 1 &&
            footer.scrollHeight <= footer.clientHeight + 1,
          ),
          cardTop: cardRect.top,
          cardBottom: cardRect.bottom,
          footerTop: footerRect?.top,
          footerBottom: footerRect?.bottom,
          summaryTop: summaryRect?.top,
          summaryBottom: summaryRect?.bottom,
          summaryHeight: summaryRect?.height,
          summaryNoOverflow: Boolean(summary && summary.scrollHeight <= summary.clientHeight + 1),
          summaryBeforeFooter: Boolean(
            summaryRect && footerRect && summaryRect.bottom <= footerRect.top + 1,
          ),
        };
      });
      const rows = Object.values(
        Object.groupBy(measurements, (measurement) => Math.round(measurement.cardTop)),
      ).filter((row): row is typeof measurements => Boolean(row));
      const summaryHeights = measurements.flatMap((measurement) =>
        measurement.summaryHeight === undefined ? [] : [measurement.summaryHeight],
      );
      const footerBottomOffsets = measurements.flatMap((measurement) =>
        measurement.footerBottom === undefined
          ? []
          : [measurement.cardBottom - measurement.footerBottom],
      );
      const summaryBottomOffsets = measurements.flatMap((measurement) =>
        measurement.summaryBottom === undefined
          ? []
          : [measurement.cardBottom - measurement.summaryBottom],
      );
      return {
        allControlsValid: measurements.every(
          ({
            controlCount,
            display,
            flexWrap,
            oneRow,
            insideBounds,
            noOverflow,
            summaryBeforeFooter,
            summaryNoOverflow,
          }) =>
            controlCount === 3 &&
            display === 'grid' &&
            flexWrap === 'nowrap' &&
            oneRow &&
            insideBounds &&
            noOverflow &&
            summaryBeforeFooter &&
            summaryNoOverflow,
        ),
        footerTopsAligned: rows.every((row) => {
          const tops = row.flatMap((measurement) =>
            measurement.footerTop === undefined ? [] : [measurement.footerTop],
          );
          return Math.max(...tops) - Math.min(...tops) <= 1;
        }),
        summaryTopsAligned: rows.every((row) => {
          const tops = row.flatMap((measurement) =>
            measurement.summaryTop === undefined ? [] : [measurement.summaryTop],
          );
          return Math.max(...tops) - Math.min(...tops) <= 1;
        }),
        summaryHeightsAligned: Math.max(...summaryHeights) - Math.min(...summaryHeights) <= 1,
        footerBottomOffsetsAligned:
          Math.max(...footerBottomOffsets) - Math.min(...footerBottomOffsets) <= 1,
        summaryBottomOffsetsAligned:
          Math.max(...summaryBottomOffsets) - Math.min(...summaryBottomOffsets) <= 1,
      };
    }),
  ).toEqual({
    allControlsValid: true,
    footerTopsAligned: true,
    summaryTopsAligned: true,
    summaryHeightsAligned: true,
    footerBottomOffsetsAligned: true,
    summaryBottomOffsetsAligned: true,
  });
  const originalMainBounds = await application.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(
      (candidate) => candidate.getBounds().width > 500,
    );
    const bounds = window?.getBounds();
    window?.setBounds({ x: 0, y: 0, width: 1600, height: 900 });
    return bounds;
  });
  await main.waitForTimeout(200);
  await main.locator('.rate-comparison-band').scrollIntoViewIfNeeded();
  await captureEvidence(main, '12-rate-comparison-stitch-wide');
  expect(
    await main.locator('.rate-comparison-list').evaluate((list) => {
      const cards = Array.from(list.querySelectorAll<HTMLElement>('.rate-platform-card'));
      const listRect = list.getBoundingClientRect();
      return {
        firstFourVisible: cards
          .slice(0, 4)
          .every(
            (card) =>
              card.getBoundingClientRect().left >= listRect.left - 1 &&
              card.getBoundingClientRect().right <= listRect.right + 1,
          ),
        oneRow:
          new Set(cards.map((card) => Math.round(card.getBoundingClientRect().top))).size === 1,
      };
    }),
  ).toEqual({ firstFourVisible: true, oneRow: true });
  const longNameCard = main.locator('.site-card').filter({
    hasText: '用于验证超长站点名称不会挤压底部操作区的测试站点',
  });
  expect(
    await longNameCard.locator('.site-card-header').evaluate((header) => {
      const name = header.querySelector<HTMLElement>('.site-name');
      const status = header.querySelector<HTMLElement>('.status-pill');
      return {
        nameTitle: name?.getAttribute('title'),
        nameWhiteSpace: name ? getComputedStyle(name).whiteSpace : '',
        statusWhiteSpace: status ? getComputedStyle(status).whiteSpace : '',
        statusSingleLine: status
          ? status.getBoundingClientRect().height <= 30 &&
            status.scrollWidth <= status.clientWidth + 1
          : false,
      };
    }),
  ).toEqual({
    nameTitle: '用于验证超长站点名称不会挤压底部操作区的测试站点',
    nameWhiteSpace: 'nowrap',
    statusWhiteSpace: 'nowrap',
    statusSingleLine: true,
  });
  expect(
    await main.locator('.site-card-grid').evaluate((grid) => {
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('.site-card'));
      const firstTop = cards[0]?.getBoundingClientRect().top;
      return {
        count: cards.length,
        firstRowCount: cards.filter(
          (card) => Math.abs(card.getBoundingClientRect().top - (firstTop ?? 0)) <= 1,
        ).length,
      };
    }),
  ).toEqual({ count: 5, firstRowCount: 4 });
  await captureEvidence(main, '10-overview-wide-footer-layout');
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()
      .find((candidate) => candidate.getBounds().width > 500)
      ?.setBounds({ x: 0, y: 0, width: 720, height: 800 });
  });
  await main.waitForTimeout(200);
  await main.locator('.rate-comparison-band').scrollIntoViewIfNeeded();
  await captureEvidence(main, '13-rate-comparison-stitch-narrow');
  expect(
    await main.locator('.rate-comparison-list').evaluate((list) => {
      const cards = Array.from(list.querySelectorAll<HTMLElement>('.rate-platform-card'));
      const style = getComputedStyle(list);
      return {
        oneRow:
          new Set(cards.map((card) => Math.round(card.getBoundingClientRect().top))).size === 1,
        scrollable: list.scrollWidth > list.clientWidth,
        scrollbarWidth: style.scrollbarWidth,
        webkitScrollbarDisplay: getComputedStyle(list, '::-webkit-scrollbar').display,
      };
    }),
  ).toEqual({
    oneRow: true,
    scrollable: true,
    scrollbarWidth: 'none',
    webkitScrollbarDisplay: 'none',
  });
  expect(
    await main.locator('.site-card').evaluateAll((cards) =>
      cards.every((card) => {
        const footer = card.querySelector<HTMLElement>('.site-card-actions');
        const controls = footer ? Array.from(footer.children) : [];
        const rects = controls.map((control) => control.getBoundingClientRect());
        return Boolean(
          footer &&
          controls.length === 3 &&
          Math.max(...rects.map((rect) => rect.top)) - Math.min(...rects.map((rect) => rect.top)) <=
            1 &&
          footer.scrollWidth <= footer.clientWidth + 1 &&
          footer.scrollHeight <= footer.clientHeight + 1,
        );
      }),
    ),
  ).toBe(true);
  expect(
    await main
      .locator('.site-card-actions .recharge-ratio-trigger')
      .first()
      .evaluate((button) => button.getBoundingClientRect().width),
  ).toBe(34);
  await main.locator('.site-card-actions').first().scrollIntoViewIfNeeded();
  await captureEvidence(main, '11-overview-narrow-footer-layout');
  if (originalMainBounds)
    await application.evaluate(({ BrowserWindow }, bounds) => {
      BrowserWindow.getAllWindows()
        .find((candidate) => candidate.getBounds().width > 500)
        ?.setBounds(bounds);
    }, originalMainBounds);
  await main.waitForTimeout(200);
  await main.evaluate(async (siteIds) => {
    const desktop = window.sub2apiDesktop?.sites;
    if (!desktop) throw new Error('Desktop bridge unavailable');
    for (const siteId of siteIds) await desktop.delete(siteId);
  }, additionalSites);
  await expect(main.locator('.site-card')).toHaveCount(2);
  await captureEvidence(main, '08-rate-comparison');
  const ratesBeforePopoverRefresh = availableRatesRequestCount;
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
  await expect(main.getByRole('dialog', { name: '本地集成站点 渠道状态' })).toContainText(
    'E2E 分组',
  );
  await expect(
    main.getByRole('dialog', { name: '本地集成站点 渠道状态' }).locator('.rate-channel-list-card'),
  ).toHaveCount(7);
  await expect(main.getByRole('dialog', { name: '本地集成站点 渠道状态' })).toContainText(
    '本地模型通道',
  );
  await expect(main.getByRole('dialog', { name: '本地集成站点 渠道状态' })).not.toContainText(
    /折算|倍率不可用/,
  );
  await captureEvidence(main, '09-channel-status-popover');
  expect(channelRequestCount).toBe(channelsBeforeShortcut);
  expect(channelDetailRequestCount).toBe(detailsBeforeShortcut);
  await main.keyboard.press('Escape');
  await expect(main.getByRole('dialog', { name: '本地集成站点 渠道状态' })).toHaveCount(0);
  const channelsAfterFirstOpen = channelRequestCount;
  const detailsAfterFirstOpen = channelDetailRequestCount;
  await firstSiteCard.getByLabel('查看 本地集成站点 渠道状态').click();
  await expect(main.getByRole('dialog', { name: '本地集成站点 渠道状态' })).toContainText(
    'E2E 分组',
  );
  expect(channelRequestCount).toBe(channelsAfterFirstOpen);
  expect(channelDetailRequestCount).toBe(detailsAfterFirstOpen);
  await main.keyboard.press('Escape');
  channelListMode = 'error';
  await secondSiteCard.getByLabel('查看 localhost 渠道状态').click();
  await expect(main.getByRole('dialog', { name: 'localhost 渠道状态' })).toContainText('E2E 分组');
  await main
    .getByRole('dialog', { name: 'localhost 渠道状态' })
    .getByRole('button', { name: '刷新渠道状态' })
    .click();
  await expect(main.getByText('更新失败，显示上次数据', { exact: true })).toBeVisible();
  await expect(main.getByRole('dialog', { name: 'localhost 渠道状态' })).toContainText('E2E 分组');
  channelListMode = 'success';
  await main
    .getByRole('dialog', { name: 'localhost 渠道状态' })
    .getByRole('button', { name: '重试渠道状态', exact: true })
    .click();
  await expect(
    main.getByRole('dialog', { name: 'localhost 渠道状态' }).locator('.rate-channel-list-card'),
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
  await main.getByLabel('本地集成站点 默认 Key').selectOption('key-e2e-manual');
  await expect(firstSiteCard.locator('.quota-summary')).toContainText('已用 $5.00');
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
    timeout: 15_000,
  });
  await expect(main.locator('.usage-table-panel').getByText('高', { exact: true })).toBeVisible();
  await expect(main.locator('.usage-table-panel').getByText('首字', { exact: true })).toBeVisible();
  await expect(main.locator('.usage-table-panel')).not.toContainText('缓存 Token');
  await expect(main.locator('.usage-table-panel')).toContainText('耗时 / t/s');
  await expect(main.locator('.usage-speed-badge').first()).toContainText('125.27 t/s');
  const tokenCell = main.locator('.usage-token-cell').first();
  await expect(tokenCell).toContainText('2,008');
  await expect(tokenCell).toContainText('1,879');
  await expect(tokenCell).toContainText('65.3K');
  await expect(main.locator('.usage-table-panel').getByText('2026/07/19 14:54:38')).toBeVisible();
  await main.locator('.usage-table-panel').scrollIntoViewIfNeeded();
  await captureEvidence(main, '02-usage');
  await main.locator('.usage-table-wrap').evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await captureEvidence(main, '25-usage-speed');
  await main.getByRole('button', { name: '导出 CSV' }).click();
  await expect
    .poll(async () => readFile(exportPath, 'utf8').catch(() => ''))
    .toContain('test-model');
  expect((await stat(exportPath)).mode & 0o077).toBe(0);
  await main.evaluate(async () => {
    const desktop = window.sub2apiDesktop?.sites;
    const sites = (await desktop?.list())?.sites ?? [];
    if (!desktop || !sites.length) throw new Error('Sites unavailable');
    for (const site of sites) await desktop.setKeyPreference(site.id, { mode: 'auto' });
  });
  await main.getByRole('button', { name: '渠道状态', exact: true }).click();
  await expect(main.locator('.channel-card')).toHaveCount(7);
  await expect(main.getByRole('region', { name: 'Key 分组渠道关联' })).toHaveCount(0);
  await expect(main.getByText('E2E 分组精准通道', { exact: true }).first()).toBeVisible();
  await expect(main.locator('.channel-card-status-stack')).toHaveCount(7);
  await expect(main.locator('.channel-card .channel-rate-badge')).toHaveCount(0);
  await expect(main.locator('.channel-card').filter({ hasText: /折算|倍率不可用/ })).toHaveCount(0);
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
  availableChannelsMode = 'partial';
  await main.getByRole('button', { name: '全部站点', exact: true }).click();
  await main.getByRole('button', { name: '查看 本地集成站点 渠道状态' }).click();
  const associationPopover = main.getByRole('dialog', { name: /渠道状态/ });
  await expect(associationPopover.locator('.rate-channel-association-button')).toHaveCount(7);
  await associationPopover.getByRole('button', { name: /关联 OpenAI 便宜 A/ }).click();
  await expect(
    associationPopover.getByRole('button', { name: /取消关联 OpenAI 便宜 A/ }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      main.evaluate(async () =>
        window.sub2apiDesktop?.sites.channelAssociations(
          (await window.sub2apiDesktop?.sites.list())?.currentSiteId ?? '',
        ),
      ),
    )
    .toEqual([
      expect.objectContaining({ groupId: 'g1', channelIds: ['channel-e2e-2'], source: 'manual' }),
    ]);
  await associationPopover.getByRole('button', { name: /取消关联 OpenAI 便宜 A/ }).click();
  await captureEvidence(main, '17-channel-manual-association');
  await expect
    .poll(async () =>
      main.evaluate(async () =>
        window.sub2apiDesktop?.sites.channelAssociations(
          (await window.sub2apiDesktop?.sites.list())?.currentSiteId ?? '',
        ),
      ),
    )
    .toEqual([]);
  await associationPopover.getByRole('button', { name: /查看 OpenAI 便宜 A 渠道详情/ }).click();
  await expect(associationPopover).toBeVisible();
  await associationPopover.getByRole('button', { name: /关联 E2E 分组精准通道/ }).click();
  await associationPopover.getByRole('button', { name: /关联 OpenAI 便宜 A/ }).click();
  await expect
    .poll(async () =>
      main.evaluate(async () =>
        window.sub2apiDesktop?.sites.channelAssociations(
          (await window.sub2apiDesktop?.sites.list())?.currentSiteId ?? '',
        ),
      ),
    )
    .toEqual([
      expect.objectContaining({
        groupId: 'g1',
        channelIds: ['channel-e2e-1', 'channel-e2e-2'],
        source: 'manual',
      }),
    ]);
  await associationPopover.getByRole('button', { name: '关闭渠道状态弹窗' }).click();
  await main.evaluate(async () => {
    const desktop = window.sub2apiDesktop?.sites;
    const sites = (await desktop?.list())?.sites ?? [];
    if (!desktop || sites.length < 2) throw new Error('Expected two isolated local sites');
    for (const site of sites)
      await desktop.setChannelAssociation({
        siteId: site.id,
        groupId: 'g1',
        channelIds: ['channel-e2e-1', 'channel-e2e-2'],
      });
  });
  includeSecondaryG1Association = true;
  availableChannelsMode = 'complete';
  await main.getByRole('button', { name: '通知', exact: true }).click();
  await expect(main.locator('.app-shell')).toHaveAttribute('data-shell', 'notification-rules');
  await expect(main.getByRole('heading', { name: '通知规则设置' })).toBeVisible();
  await main.getByLabel('通知冷却时间').selectOption('15');
  await captureEvidence(main, '24-notification-rules');
  await main.getByRole('button', { name: '设置', exact: true }).click();
  await expect(main.locator('.app-shell')).toHaveAttribute('data-shell', 'general-settings');
  await expect(main.getByRole('heading', { name: '通用设置' })).toBeVisible();
  await main.getByLabel('自动刷新频率').selectOption('10');
  await main.getByLabel('数据过期提示').selectOption('5');
  await captureEvidence(main, '23-general-settings');
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
    await expect(floating.locator('footer .floating-speed')).toContainText(/\d+(?:\.\d)? t\/s/);
    await expect(floating.locator('.floating-speed')).toContainText('快');
    await expect(floating.locator('.floating-channels')).toHaveCount(0);
    await expect(floating.locator('.floating-channel-panel')).toHaveCount(0);
    const compactChannel = floating.getByRole('button', {
      name: 'E2E 分组精准通道，查看全部关联渠道',
    });
    await expect(compactChannel).toBeVisible();
    await expect(compactChannel).toContainText('近期可用率');
    await expect(compactChannel).not.toContainText('自动关联');
    await expect(compactChannel).not.toContainText('E2E 分组精准通道');
    const timelineCells = compactChannel.locator('.floating-channel-timeline i');
    await expect(timelineCells).toHaveCount(20);
    await expect(compactChannel.locator('.floating-channel-timeline i.empty')).toHaveCount(8);
    await expect(timelineCells.first()).toHaveClass('empty');
    await expect(timelineCells.nth(8)).toHaveClass('normal');
    await expect(timelineCells.last()).toHaveClass('normal');
    await expect(timelineCells.last()).toHaveAttribute('title', /正常$/);

    const refreshCooldownRemaining = 5_100 - (Date.now() - usageSiteRefreshStartedAt);
    if (refreshCooldownRemaining > 0)
      await new Promise((resolve) => setTimeout(resolve, refreshCooldownRemaining));
    const keysBeforeFloatingRefresh = keysRequestCount;
    const channelsBeforeFloatingRefresh = channelRequestCount;
    channelTimelineRevision = 1;
    await expect(floating.getByRole('button', { name: '刷新悬浮窗' })).toBeEnabled({
      timeout: 15_000,
    });
    await floating.getByRole('button', { name: '刷新悬浮窗' }).click();
    await expect(floating.getByRole('button', { name: '刷新悬浮窗' })).toBeDisabled();
    await expect
      .poll(() => keysRequestCount, { timeout: 15_000 })
      .toBeGreaterThan(keysBeforeFloatingRefresh);
    await expect
      .poll(() => channelRequestCount, { timeout: 15_000 })
      .toBeGreaterThan(channelsBeforeFloatingRefresh);
    await expect(floating.getByRole('button', { name: '刷新悬浮窗' })).toBeEnabled({
      timeout: 15_000,
    });
    await expect(compactChannel.locator('.floating-channel-timeline i.empty')).toHaveCount(7);
    await expect(timelineCells.first()).toHaveClass('empty');
    await expect(timelineCells.nth(7)).toHaveClass('normal');
    await expect(timelineCells.last()).toHaveClass('degraded');
    await expect(timelineCells.last()).toHaveAttribute('title', /降级$/);
    await compactChannel.click();
    const floatingChannelDialog = floating.getByRole('dialog', { name: '关联渠道' });
    await expect(floatingChannelDialog).toBeVisible();
    await expect(floatingChannelDialog.locator('.floating-channel-dialog-row')).toHaveCount(2);
    await expect(floatingChannelDialog).toContainText('近期可用率');
    await expect(floatingChannelDialog).not.toContainText('最近 1 分钟');
    await expect(
      floatingChannelDialog.locator('.floating-channel-dialog-row').first().locator('i'),
    ).toHaveCount(20);
    await expect(floatingChannelDialog).toContainText('E2E 分组精准通道');
    await expect(floatingChannelDialog).toContainText('OpenAI 便宜 A');
    await expect(floatingChannelDialog.getByText('当前展示')).toHaveCount(1);
    const closeChannelDialog = floating.getByRole('button', { name: '关闭关联渠道弹框' });
    await expect(closeChannelDialog).toBeFocused();
    await expect(floating.locator('.floating-actions button')).toHaveCount(2);
    expect(
      await floating.evaluate(() => {
        const windowBounds = document.querySelector('.floating-window')?.getBoundingClientRect();
        const balance = document.querySelector('.floating-balance')?.getBoundingClientRect();
        const channel = document.querySelector('.floating-channel-card')?.getBoundingClientRect();
        const metrics = document.querySelector('.floating-metrics')?.getBoundingClientRect();
        const footer = document.querySelector('.floating-window footer')?.getBoundingClientRect();
        const speed = document.querySelector('.floating-speed')?.getBoundingClientRect();
        const dialog = document.querySelector('.floating-channel-dialog')?.getBoundingClientRect();
        const actions = Array.from(
          document.querySelectorAll<HTMLButtonElement>('.floating-actions button'),
        ).map((button) => button.getBoundingClientRect());
        return {
          bodyNoOverlap: Boolean(
            balance &&
            channel &&
            metrics &&
            footer &&
            balance.right <= channel.left &&
            channel.bottom <= metrics.top &&
            metrics.bottom <= footer.top,
          ),
          speedInFooter: Boolean(
            speed &&
            footer &&
            speed.top >= footer.top &&
            speed.right <= footer.right &&
            speed.bottom <= footer.bottom,
          ),
          dialogContained: Boolean(
            dialog &&
            windowBounds &&
            dialog.left >= windowBounds.left &&
            dialog.top >= windowBounds.top &&
            dialog.right <= windowBounds.right &&
            dialog.bottom <= windowBounds.bottom,
          ),
          adjacent:
            actions.length === 2 &&
            actions[1]!.left - actions[0]!.right >= 0 &&
            actions[1]!.left - actions[0]!.right <= 6,
          rightAligned:
            actions.length === 2 && footer ? footer.right - actions[1]!.right <= 24 : false,
        };
      }),
    ).toEqual({
      bodyNoOverlap: true,
      speedInFooter: true,
      dialogContained: true,
      adjacent: true,
      rightAligned: true,
    });
    await captureEvidence(floating, '27-floating-channel-dialog');
    await closeChannelDialog.click();
    await expect(floatingChannelDialog).toHaveCount(0);
    await expect(compactChannel).toBeFocused();
    await compactChannel.click();
    await floating.keyboard.press('Escape');
    await expect(floatingChannelDialog).toHaveCount(0);
    await expect(compactChannel).toBeFocused();
    await compactChannel.click();
    await floating
      .locator('.floating-channel-dialog-backdrop')
      .click({ position: { x: 10, y: 130 } });
    await expect(floatingChannelDialog).toHaveCount(0);
    await expect(compactChannel).toBeFocused();
    await captureEvidence(floating, '05-floating');
    await new Promise((resolve) => setTimeout(resolve, 5_100));
    channelTimelineLimit = 3;
    const channelsBeforeShortHistoryRefresh = channelRequestCount;
    await floating.getByRole('button', { name: '刷新悬浮窗' }).click();
    await expect
      .poll(() => channelRequestCount, { timeout: 15_000 })
      .toBeGreaterThan(channelsBeforeShortHistoryRefresh);
    await expect(compactChannel.locator('.floating-channel-timeline i.empty')).toHaveCount(17);
    await expect(timelineCells.nth(16)).toHaveClass('empty');
    await expect(timelineCells.nth(17)).toHaveClass('normal');
    await expect(timelineCells.last()).toHaveClass('unknown');
    await expect(timelineCells.nth(16)).toHaveAttribute('title', '暂无更早记录');
    await expect(timelineCells.last()).toHaveAttribute('title', /未知$/);
    await captureEvidence(floating, '28-floating-short-history');
  }
  await application.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await Promise.all(
    layoutServers.map(
      (layoutServer) => new Promise<void>((resolve) => layoutServer.close(() => resolve())),
    ),
  );
});
