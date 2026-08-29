import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('checks OpenCodex usage page geometry at desktop and narrow widths', async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'sub2api-opencodex-visual-'));
  const evidenceDir = process.env.SUB2API_REAL_EVIDENCE_DIR
    ? path.resolve(process.env.SUB2API_REAL_EVIDENCE_DIR)
    : path.resolve('test-results/opencodex-visual');
  await mkdir(evidenceDir, { recursive: true });
  const application = await electron.launch({
    args: ['.'],
    env: { ...process.env, SUB2API_TEST_USER_DATA: userData },
  });
  await application.firstWindow();
  await expect.poll(async () => (await application.windows()).length).toBe(2);
  const windows = await application.windows();
  let window = windows[0]!;
  for (const candidate of windows) {
    if ((await candidate.locator('.app-shell').count()) > 0) window = candidate;
  }
  await window.goto('file://' + process.cwd() + '/dist/index.html?surface=main&shell=usage');
  await expect(
    window.getByRole('button', { name: '切换 opencodex 模式', exact: true }),
  ).toBeVisible();
  await window.getByRole('button', { name: '切换 opencodex 模式', exact: true }).click();
  await expect(window.locator('[data-opencodex-page]')).toBeVisible();
  await expect(window.getByRole('button', { name: '切回中转站模式', exact: true })).toBeVisible();
  await expect(window.locator('.table-caption strong')).toHaveText('OpenCodex 请求记录');
  if ((await window.locator('[data-opencodex-error]').count()) === 0) {
    await expect(window.locator('[data-opencodex-page] tbody tr').first()).toBeVisible();
    await expect(window.locator('[data-opencodex-page] .usage-cache-rate-badge')).toHaveCount(0);
    const headers = await window.locator('[data-opencodex-page] thead th').allTextContents();
    expect(headers.slice(0, 4).map((text) => text.replace(/[↓↑]/g, '').trim())).toEqual([
      '时间',
      '提供方',
      '提供方模型',
      '状态',
    ]);
    const firstRowText = await window.locator('[data-opencodex-page] tbody tr').first().innerText();
    expect(firstRowText).toMatch(/low|medium|high|xhigh|max|none|—/);
    const badgeClasses = await window
      .locator('[data-opencodex-page] .usage-speed-badge')
      .evaluateAll((badges) => badges.map((badge) => Array.from(badge.classList).join(' ')));
    for (const classes of badgeClasses) {
      expect(classes).toMatch(/is-(slow|normal|fast|unavailable)/);
    }
  }

  const checkGeometry = async () => {
    return window.locator('[data-opencodex-page]').evaluate((root) => {
      const result: Record<string, unknown> = {};
      const rect = (selector: string) => {
        const element = root.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right };
      };
      result.toggle = rect('.usage-mode-toggle');
      result.header = rect('.usage-mode-header');
      const stats = Array.from(root.querySelectorAll('.usage-summary .usage-stat')).map(
        (element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        },
      );
      result.stats = stats;
      result.filterLabels = Array.from(root.querySelectorAll('.filter-grid label')).map(
        (element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
        },
      );
      const wrap = root.querySelector('.usage-table-wrap');
      result.tableScroll = wrap
        ? { scrollWidth: wrap.scrollWidth, clientWidth: wrap.clientWidth }
        : null;
      result.viewportWidth = window.innerWidth;
      return result;
    });
  };

  const desktop = await checkGeometry();
  expect(desktop.toggle).not.toBeNull();
  expect(desktop.header).not.toBeNull();
  const stats = desktop.stats as Array<{ left: number; right: number }>;
  if (stats.length) {
    for (let index = 1; index < stats.length; index += 1) {
      const previous = stats[index - 1]!;
      const current = stats[index]!;
      if (current.top === previous.top) {
        expect(current.left).toBeGreaterThanOrEqual(previous.right - 1);
      }
    }
    for (const stat of stats) {
      expect(stat.left).toBeGreaterThanOrEqual(0);
      expect(stat.right).toBeLessThanOrEqual((desktop.viewportWidth as number) + 1);
    }
  }
  await window.screenshot({ path: path.join(evidenceDir, 'opencodex-desktop.png') });

  await application.evaluate(({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows().find(
      (candidate) => candidate.getBounds().width > 500,
    );
    main?.setSize(1100, 800);
  });
  await window.waitForTimeout(400);
  await window.screenshot({ path: path.join(evidenceDir, 'opencodex-narrow.png') });
  const narrow = await checkGeometry();
  expect(narrow.toggle).not.toBeNull();
  await application.close();
});
