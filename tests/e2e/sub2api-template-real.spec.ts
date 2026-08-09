import { _electron as electron, expect, type Page, test } from '@playwright/test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const enabled = process.env.SUB2API_SUB2API_REAL_E2E === '1';
const executable = process.env.SUB2API_PACKAGED_EXECUTABLE;
const evidenceDirectory = process.env.SUB2API_REAL_EVIDENCE_DIR ?? 'real-test-evidence/macos-2.1.2';
const username = process.env.SUB2API_REAL_USERNAME ?? '';
const password = process.env.SUB2API_REAL_PASSWORD ?? '';

test('real api-feng Sub2API template shortcuts', async () => {
  test.skip(!enabled || !executable, 'real Sub2API acceptance is opt-in');
  test.setTimeout(240_000);

  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-template-real-'));
  await mkdir(evidenceDirectory, { recursive: true });
  const application = await electron.launch({
    executablePath: executable,
    env: { ...process.env, SUB2API_TEST_USER_DATA: userData },
  });
  let currentApplication = application;

  const findMain = async (): Promise<Page> => {
    await expect
      .poll(
        async () => {
          for (const candidate of await currentApplication.windows())
            if ((await candidate.locator('.app-shell').count()) > 0) return true;
          return false;
        },
        { timeout: 20_000 },
      )
      .toBe(true);
    for (const candidate of await currentApplication.windows())
      if ((await candidate.locator('.app-shell').count()) > 0) return candidate;
    throw new Error('MAIN_WINDOW_NOT_FOUND');
  };

  const embeddedInfo = () =>
    currentApplication.evaluate(({ BrowserWindow }) => {
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

  const captureEmbedded = async (name: string) => {
    const image = await currentApplication.evaluate(async ({ BrowserWindow }) => {
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

  const captureMain = async (name: string) => {
    const page = await findMain();
    await page.screenshot({ path: path.join(evidenceDirectory, `${name}.png`) });
  };

  const embeddedScript = <T>(script: string): Promise<T | undefined> =>
    currentApplication.evaluate(({ BrowserWindow }, source) => {
      const mainWindow = BrowserWindow.getAllWindows().find(
        (candidate) => candidate.getBounds().width > 500,
      );
      const view = mainWindow?.contentView.children
        .map((child) => child as Electron.WebContentsView)
        .find((candidate) => candidate.webContents?.getURL().startsWith('https://'));
      if (!view?.webContents) return undefined;
      return view.webContents.executeJavaScript(source) as Promise<T>;
    }, script);

  try {
    let main = await findMain();
    await main.getByRole('button', { name: 'Sub2API 服务器', exact: true }).click();
    await expect(main.locator('[data-svr-list-state="empty"]')).toBeVisible();

    await main.locator('.svr-add-button').click();
    let editor = main.locator('.svr-dialog');
    await editor.locator('input').nth(0).fill('真实站点');
    await editor.locator('input').nth(1).fill('https://www.api-feng.online/');
    await editor.getByRole('button', { name: '添加服务器', exact: true }).click();
    await expect(main.locator('.svr-target-card')).toHaveCount(1);
    await captureMain('01-server-saved');

    await main.getByRole('button', { name: '编辑 真实站点', exact: true }).click();
    editor = main.locator('.svr-dialog');
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
    await editor.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await main.waitForTimeout(250);
    await captureMain('02-template-editor');

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
    await editor.getByRole('button', { name: '保存修改', exact: true }).click();
    await expect(main.locator('.svr-target-card')).toContainText('真实站点');
    await captureMain('03-five-shortcuts');

    await currentApplication.close();
    currentApplication = await electron.launch({
      executablePath: executable,
      env: { ...process.env, SUB2API_TEST_USER_DATA: userData },
    });
    main = await findMain();
    await main.getByRole('button', { name: 'Sub2API 服务器', exact: true }).click();
    await expect(main.locator('.svr-target-card')).toHaveCount(1);
    for (const label of ['API 密钥', '使用记录', '渠道状态', '个人资料', '账号管理']) {
      await expect(
        main.locator('.svr-card-shortcuts').getByRole('button', { name: label, exact: true }),
      ).toBeVisible();
    }
    await captureMain('04-restart-preserved');

    await main
      .locator('.svr-card-shortcuts')
      .getByRole('button', { name: '账号管理', exact: true })
      .click();
    await expect
      .poll(async () => {
        const views = await embeddedInfo();
        return views.some((view) => view.url.startsWith('https://www.api-feng.online/'));
      })
      .toBe(true);
    await captureEmbedded('05-shortcut-open');

    if (username && password) {
      const loginState = await embeddedScript<{ url: string; inputs: string[]; text: string }>(`
        (() => ({
          url: window.location.href,
          inputs: Array.from(document.querySelectorAll('input')).map((input) => ({
            type: input.type,
            placeholder: input.placeholder || '',
            name: input.name || '',
            id: input.id || '',
          })),
          text: (document.body.innerText || '').slice(0, 300),
        }))()
      `);
      if (loginState) {
        await writeFile(
          path.join(evidenceDirectory, 'login-state.json'),
          JSON.stringify(
            {
              url: loginState.url,
              inputs: loginState.inputs,
              text: loginState.text.slice(0, 80),
            },
            null,
            2,
          ),
        );
      }

      const submitted = await embeddedScript<boolean>(`
        (() => {
          const inputs = Array.from(document.querySelectorAll('input'));
          const email = inputs.find((input) =>
            /email|邮箱|username|account/i.test(
              [input.placeholder, input.name, input.id].join(' ')
            )
          ) || inputs[0];
          const pass = inputs.find((input) => input.type === 'password') || inputs[1];
          if (!email || !pass) return false;
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          if (!setter) return false;
          setter.call(email, ${JSON.stringify(username)});
          email.dispatchEvent(new Event('input', { bubbles: true }));
          email.dispatchEvent(new Event('change', { bubbles: true }));
          setter.call(pass, ${JSON.stringify(password)});
          pass.dispatchEvent(new Event('input', { bubbles: true }));
          pass.dispatchEvent(new Event('change', { bubbles: true }));
          const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
            /登录|sign\\s*in/i.test(candidate.textContent || '')
          );
          if (button) button.click();
          return true;
        })()
      `);
      expect(submitted).toBe(true);
      await main.waitForTimeout(5_000);
      await captureEmbedded('06-after-login');

      await currentApplication.close();
      currentApplication = await electron.launch({
        executablePath: executable,
        env: { ...process.env, SUB2API_TEST_USER_DATA: userData },
      });
      main = await findMain();
      await main.getByRole('button', { name: 'Sub2API 服务器', exact: true }).click();
      await main
        .locator('.svr-card-shortcuts')
        .getByRole('button', { name: '账号管理', exact: true })
        .click();
      await expect
        .poll(async () => {
          const views = await embeddedInfo();
          return views.some((view) => view.url.startsWith('https://www.api-feng.online/'));
        })
        .toBe(true);
      await main.waitForTimeout(4_000);
      const restartState = await embeddedScript<{ url: string; text: string }>(`
        (() => ({ url: window.location.href, text: (document.body.innerText || '').slice(0, 300) }))()
      `);
      expect(restartState?.url.includes('/login')).toBe(false);
      await writeFile(
        path.join(evidenceDirectory, 'login-state-restart.json'),
        JSON.stringify(
          { url: restartState?.url ?? '', text: restartState?.text.slice(0, 80) ?? '' },
          null,
          2,
        ),
      );
      await captureEmbedded('07-after-restart-login');
    }

    await currentApplication.close();
  } finally {
    await currentApplication.close().catch(() => undefined);
  }
});
