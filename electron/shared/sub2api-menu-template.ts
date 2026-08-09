import { sub2apiMenuPathKey } from './sub2api-server.js';

export type Sub2ApiTemplateGroup = 'user' | 'admin';

export type Sub2ApiStandardMenu = {
  id: string;
  group: Sub2ApiTemplateGroup;
  label: string;
  path: string;
  icon: string;
  order: number;
};

export type Sub2ApiShortcutLike = {
  id?: string;
  label: string;
  path: string;
  icon?: string;
  menuId?: string;
};

const menu = (
  group: Sub2ApiTemplateGroup,
  id: string,
  label: string,
  path: string,
  icon: string,
): Sub2ApiStandardMenu => ({
  id,
  group,
  label,
  path,
  icon,
  order: 0,
});

export const SUB2API_STANDARD_MENUS: readonly Sub2ApiStandardMenu[] = [
  menu('user', 'standard-user-dashboard', '仪表盘', '/dashboard', 'LayoutDashboard'),
  menu('user', 'standard-user-keys', 'API 密钥', '/keys', 'KeyRound'),
  menu('user', 'standard-user-batch-image', '批量图片', '/batch-image', 'Images'),
  menu('user', 'standard-user-usage', '使用记录', '/usage', 'BarChart3'),
  menu('user', 'standard-user-available-channels', '可用渠道', '/available-channels', 'ListChecks'),
  menu('user', 'standard-user-monitor', '渠道状态', '/monitor', 'Activity'),
  menu('user', 'standard-user-subscriptions', '我的订阅', '/subscriptions', 'CreditCard'),
  menu('user', 'standard-user-purchase', '充值/订阅', '/purchase', 'Wallet'),
  menu('user', 'standard-user-orders', '我的订单', '/orders', 'ReceiptText'),
  menu('user', 'standard-user-redeem', '兑换', '/redeem', 'Gift'),
  menu('user', 'standard-user-affiliate', '邀请返利', '/affiliate', 'Users'),
  menu('user', 'standard-user-profile', '个人资料', '/profile', 'UserRound'),
  menu('admin', 'standard-admin-dashboard', '仪表盘', '/admin/dashboard', 'LayoutDashboard'),
  menu('admin', 'standard-admin-ops', '运维监控', '/admin/ops', 'Activity'),
  menu('admin', 'standard-admin-users', '用户管理', '/admin/users', 'Users'),
  menu('admin', 'standard-admin-groups', '分组管理', '/admin/groups', 'Folder'),
  menu(
    'admin',
    'standard-admin-channels-pricing',
    '渠道定价',
    '/admin/channels/pricing',
    'BadgePercent',
  ),
  menu(
    'admin',
    'standard-admin-channels-monitor',
    '渠道监控',
    '/admin/channels/monitor',
    'Activity',
  ),
  menu('admin', 'standard-admin-subscriptions', '订阅管理', '/admin/subscriptions', 'CreditCard'),
  menu('admin', 'standard-admin-accounts', '账号管理', '/admin/accounts', 'Globe'),
  menu('admin', 'standard-admin-announcements', '公告管理', '/admin/announcements', 'Bell'),
  menu('admin', 'standard-admin-proxies', 'IP 管理', '/admin/proxies', 'ServerCog'),
  menu('admin', 'standard-admin-risk-control', '内容风控', '/admin/risk-control', 'ShieldCheck'),
  menu('admin', 'standard-admin-prompt-audit', '提示词审计', '/admin/prompt-audit', 'ScrollText'),
  menu('admin', 'standard-admin-redeem', '兑换码', '/admin/redeem', 'Ticket'),
  menu('admin', 'standard-admin-promo-codes', '优惠码', '/admin/promo-codes', 'Gift'),
  menu(
    'admin',
    'standard-admin-affiliates-invites',
    '邀请记录',
    '/admin/affiliates/invites',
    'Users',
  ),
  menu(
    'admin',
    'standard-admin-affiliates-rebates',
    '返利记录',
    '/admin/affiliates/rebates',
    'ReceiptText',
  ),
  menu(
    'admin',
    'standard-admin-affiliates-transfers',
    '转账记录',
    '/admin/affiliates/transfers',
    'CreditCard',
  ),
  menu(
    'admin',
    'standard-admin-orders-dashboard',
    '支付看板',
    '/admin/orders/dashboard',
    'BarChart3',
  ),
  menu('admin', 'standard-admin-orders', '订单管理', '/admin/orders', 'ReceiptText'),
  menu('admin', 'standard-admin-orders-plans', '套餐管理', '/admin/orders/plans', 'PackageCheck'),
  menu('admin', 'standard-admin-usage', '使用记录', '/admin/usage', 'History'),
  menu('admin', 'standard-admin-audit-logs', '操作日志', '/admin/audit-logs', 'ClipboardList'),
  menu('admin', 'standard-admin-settings', '系统设置', '/admin/settings', 'Settings2'),
].map((item, index) => ({ ...item, order: index }));

export function sub2apiTemplateGroupLabel(group: Sub2ApiTemplateGroup): string {
  return group === 'user' ? '我的账户' : '后台管理';
}

export function sub2apiStandardMenuByPath(path: string): Sub2ApiStandardMenu | undefined {
  const key = sub2apiMenuPathKey(path);
  return SUB2API_STANDARD_MENUS.find((menu) => sub2apiMenuPathKey(menu.path) === key);
}

export function normalizeSub2ApiShortcutForTemplate(
  shortcut: Sub2ApiShortcutLike,
): Sub2ApiShortcutLike {
  const standard = sub2apiStandardMenuByPath(shortcut.path);
  if (!standard) return { ...shortcut };
  return {
    ...(shortcut.id ? { id: shortcut.id } : {}),
    label: standard.label,
    path: standard.path,
    icon: standard.icon,
    menuId: standard.id,
  };
}
