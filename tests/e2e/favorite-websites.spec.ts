import { _electron as electron, expect, test, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const launchApplication = (userData: string) =>
  electron.launch({
    args: ['.'],
    env: { ...process.env, SUB2API_TEST_USER_DATA: userData },
  });

async function findMainWindow(
  application: Awaited<ReturnType<typeof electron.launch>>,
): Promise<Page> {
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
  throw new Error('主窗口未找到');
}

function shellUrl(shell: string): string {
  return 'file://' + process.cwd() + '/dist/index.html?surface=main&shell=' + shell;
}

async function withLocalServer(run: (server: Server, url: string) => Promise<void>): Promise<void> {
  const server = createServer((_request, response) => {
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end('<html><body><h1>本机测试页</h1><p>常用网站内嵌网页正常加载</p></body></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    await run(server, 'http://127.0.0.1:' + port + '/');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('manages persistent favorite websites and opens an embedded HTTP page', async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-favorite-websites-e2e-'));
  let application = await launchApplication(userData);
  try {
    let window = await findMainWindow(application);
    await window.goto(shellUrl('favorite-websites'));
    await expect(window.getByRole('heading', { name: '常用网站', exact: true })).toBeVisible();
    await expect(window.locator('[data-fav-list-state="empty"]')).toBeVisible();
    await expect(window.locator('.fav-edit-button')).toBeVisible();

    await window.locator('.fav-add-button').click();
    const siteDialog = window.getByRole('dialog', { name: '新增网站' });
    await expect(siteDialog).toBeVisible();
    await window.getByLabel('名称').fill('测试内网页');
    await window.getByLabel('网站地址').fill('http://127.0.0.1:9000/');
    await window.getByRole('button', { name: '添加网站', exact: true }).click();
    await expect(siteDialog).toHaveCount(0);
    await expect(window.locator('.fav-target-card')).toHaveCount(1);
    await expect(
      window.getByRole('button', { name: '打开 测试内网页', exact: true }),
    ).toBeVisible();
    await window.screenshot({ path: 'test-results/fav-list.png' });

    await window.getByRole('button', { name: '编辑 测试内网页', exact: true }).click();
    const editDialog = window.getByRole('dialog', { name: '编辑网站' });
    await expect(editDialog).toBeVisible();
    await window.getByLabel('名称').fill('测试内网页改');
    await window.getByRole('button', { name: '保存修改', exact: true }).click();
    await expect(editDialog).toHaveCount(0);
    await expect(
      window.getByRole('button', { name: '打开 测试内网页改', exact: true }),
    ).toBeVisible();

    await window.locator('.fav-edit-button').click();
    const policyDialog = window.getByRole('dialog', { name: '编辑常用网站地址支持' });
    await expect(policyDialog).toBeVisible();
    await policyDialog.getByRole('button', { name: '新增规则', exact: true }).click();
    await policyDialog.getByLabel('规则名称').fill('局域网测试');
    await policyDialog.getByLabel('规则内容').fill('192.168.1.20:8080');
    await policyDialog.getByRole('button', { name: '保存规则', exact: true }).first().click();
    await policyDialog.getByRole('button', { name: '保存规则', exact: true }).last().click();
    await expect(policyDialog).toHaveCount(0);
    await window.screenshot({ path: 'test-results/fav-policy.png' });

    await window.getByRole('button', { name: '删除 测试内网页改', exact: true }).click();
    const deleteDialog = window.getByRole('dialog', { name: '确认删除' });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(deleteDialog).toHaveCount(0);
    await expect(window.locator('[data-fav-list-state="empty"]')).toBeVisible();

    await window.locator('.fav-add-button').click();
    await window.getByLabel('名称').fill('本机测试页');
    await window.getByLabel('网站地址').fill('http://127.0.0.1:9001/');
    await window.getByRole('button', { name: '添加网站', exact: true }).click();
    await expect(window.locator('.fav-target-card')).toHaveCount(1);

    await application.close();
    application = await launchApplication(userData);
    window = await findMainWindow(application);
    await window.goto(shellUrl('favorite-websites'));
    await expect(window.locator('.fav-target-card')).toHaveCount(1);
    await expect(
      window.getByRole('button', { name: '打开 本机测试页', exact: true }),
    ).toBeVisible();
  } finally {
    await application?.close().catch(() => undefined);
  }
});

test('opens a local favorite website in the embedded web view', async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-favorite-embed-e2e-'));
  const application = await launchApplication(userData);
  try {
    const window = await findMainWindow(application);
    await withLocalServer(async (_server, url) => {
      await window.goto(shellUrl('favorite-websites'));
      await window.locator('.fav-add-button').click();
      const dialog = window.getByRole('dialog', { name: '新增网站' });
      await dialog.getByLabel('名称').fill('本机测试服务');
      await dialog.getByLabel('网站地址').fill(url);
      await dialog.getByRole('button', { name: '添加网站', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await window.getByRole('button', { name: '打开 本机测试服务', exact: true }).click();
      await expect(window.locator('.fav-embed-toolbar-label')).toContainText('本机测试服务');
      await expect(
        window.getByRole('button', { name: '关闭常用网站网页', exact: true }),
      ).toBeVisible();
      await window.screenshot({ path: 'test-results/fav-embed.png' });
    });
  } finally {
    await application?.close().catch(() => undefined);
  }
});
