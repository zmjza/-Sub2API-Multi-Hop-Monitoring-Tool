import { describe, expect, it } from 'vitest';
import {
  SUB2API_STANDARD_MENUS,
  normalizeSub2ApiShortcutForTemplate,
  sub2apiStandardMenuByPath,
  sub2apiTemplateGroupLabel,
} from './sub2api-menu-template.js';

const userPaths = [
  '/dashboard',
  '/keys',
  '/batch-image',
  '/usage',
  '/available-channels',
  '/monitor',
  '/subscriptions',
  '/purchase',
  '/orders',
  '/redeem',
  '/affiliate',
  '/profile',
];

const adminPaths = [
  '/admin/dashboard',
  '/admin/ops',
  '/admin/users',
  '/admin/groups',
  '/admin/channels/pricing',
  '/admin/channels/monitor',
  '/admin/subscriptions',
  '/admin/accounts',
  '/admin/announcements',
  '/admin/proxies',
  '/admin/risk-control',
  '/admin/prompt-audit',
  '/admin/redeem',
  '/admin/promo-codes',
  '/admin/affiliates/invites',
  '/admin/affiliates/rebates',
  '/admin/affiliates/transfers',
  '/admin/orders/dashboard',
  '/admin/orders',
  '/admin/orders/plans',
  '/admin/usage',
  '/admin/audit-logs',
  '/admin/settings',
];

describe('sub2api standard menu template', () => {
  it('covers every Wei-Shaw/sub2api user and admin route exactly once', () => {
    const paths = new Set(SUB2API_STANDARD_MENUS.map((menu) => menu.path));
    expect(paths.size).toBe(SUB2API_STANDARD_MENUS.length);
    expect(SUB2API_STANDARD_MENUS).toHaveLength(userPaths.length + adminPaths.length);
    for (const path of [...userPaths, ...adminPaths]) {
      expect(paths).toContain(path);
    }
  });

  it('assigns stable ids, labels, icons, groups and order to every template item', () => {
    for (const [order, menu] of SUB2API_STANDARD_MENUS.entries()) {
      expect(menu.id).toMatch(/^standard-(user|admin)-[a-z0-9-]+$/);
      expect(menu.label.length).toBeGreaterThan(0);
      expect(menu.icon.length).toBeGreaterThan(0);
      expect(menu.group).toMatch(/^(user|admin)$/);
      expect(menu.order).toBe(order);
    }
  });

  it('separates the user and admin groups with stable labels', () => {
    const user = SUB2API_STANDARD_MENUS.filter((menu) => menu.group === 'user');
    const admin = SUB2API_STANDARD_MENUS.filter((menu) => menu.group === 'admin');
    expect(user.map((menu) => menu.path)).toEqual(userPaths);
    expect(admin.map((menu) => menu.path)).toEqual(adminPaths);
    expect(sub2apiTemplateGroupLabel('user')).toBe('我的账户');
    expect(sub2apiTemplateGroupLabel('admin')).toBe('后台管理');
  });

  it('excludes expand-only parents and dynamic custom routes', () => {
    const paths = SUB2API_STANDARD_MENUS.map((menu) => menu.path);
    for (const excluded of [
      '/admin/channels',
      '/admin/security-audit',
      '/admin/affiliates',
      '/admin/orders/plans/parent',
      '/custom/1',
    ]) {
      expect(paths).not.toContain(excluded);
    }
  });

  it('matches template paths from relative, absolute, query and hash forms', () => {
    expect(sub2apiStandardMenuByPath('/admin/accounts')).toMatchObject({
      group: 'admin',
      path: '/admin/accounts',
    });
    expect(sub2apiStandardMenuByPath('https://example.com/admin/ACCOUNTS')).toMatchObject({
      path: '/admin/accounts',
    });
    expect(sub2apiStandardMenuByPath('/keys?tab=main#top')).toMatchObject({
      path: '/keys',
    });
    expect(sub2apiStandardMenuByPath('/custom/1')).toBeUndefined();
  });

  it('normalizes legacy shortcuts to template ids and icons while preserving unmatched items', () => {
    const matching = normalizeSub2ApiShortcutForTemplate({
      id: 'legacy-1',
      label: '旧账号',
      path: 'https://example.com/admin/accounts',
      icon: 'Users',
    });
    expect(matching).toEqual({
      id: 'legacy-1',
      label: '账号管理',
      path: '/admin/accounts',
      icon: 'Globe',
      menuId: expect.stringMatching(/^standard-admin-accounts$/),
    });

    const unmatched = normalizeSub2ApiShortcutForTemplate({
      id: 'legacy-2',
      label: '旧自定义',
      path: '/custom-old',
      icon: 'Menu',
    });
    expect(unmatched).toEqual({
      id: 'legacy-2',
      label: '旧自定义',
      path: '/custom-old',
      icon: 'Menu',
    });
  });
});
