import { z } from 'zod';

export const SUB2API_SERVERS_KEY = 'sub2api-servers:entries';
export const SUB2API_SERVER_LIMIT = 50;
export const SUB2API_SERVER_SHORTCUT_LIMIT = 5;
export const SUB2API_MENUS_KEY_PREFIX = 'sub2api-servers:menus:';

export const sub2apiServerLoginStateSchema = z.enum([
  'unknown',
  'please-login',
  'logged-in',
  'expired',
]);

export type Sub2ApiServerLoginState = z.infer<typeof sub2apiServerLoginStateSchema>;

export function normalizeSub2ApiServerUrl(value: string): string {
  return new URL(value.trim()).origin + '/';
}

export function isSafeSub2ApiServerUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

export function sub2apiShortcutUrl(baseUrl: string, path: string): string | undefined {
  const root = normalizeSub2ApiServerUrl(baseUrl);
  const value = path.trim();
  if (!value) return undefined;
  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      if (url.origin !== new URL(root).origin || url.username || url.password) return undefined;
      return url.toString();
    }
    if (!value.startsWith('/')) return undefined;
    const url = new URL(value, root);
    return url.origin === new URL(root).origin ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function sub2apiMenuPathKey(path: string): string {
  try {
    const url = new URL(path.startsWith('/') ? `https://placeholder.invalid${path}` : path);
    return url.pathname.replace(/\/+$/, '').toLocaleLowerCase();
  } catch {
    return path.trim().replace(/\/+$/, '').toLocaleLowerCase();
  }
}

export const sub2apiShortcutInputSchema = z
  .object({
    label: z.string().trim().min(1, '请输入快捷入口名称').max(40, '快捷入口名称不能超过 40 个字符'),
    path: z
      .string()
      .trim()
      .min(1, '请输入快捷入口路径')
      .max(500, '快捷入口路径不能超过 500 个字符'),
    icon: z.string().trim().min(1).max(40).optional(),
    menuId: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

export const sub2apiShortcutSchema = sub2apiShortcutInputSchema.extend({
  id: z.string().min(1).max(128),
});

export const sub2apiShortcutUpdateSchema = sub2apiShortcutInputSchema.extend({
  id: z.string().min(1).max(128).optional(),
});

export function sub2apiMenusKey(serverId: string): string {
  return `${SUB2API_MENUS_KEY_PREFIX}${serverId}`;
}

export const sub2apiServerInputSchema = z
  .object({
    name: z.string().trim().min(1, '请输入名称').max(80, '名称不能超过 80 个字符'),
    baseUrl: z
      .string()
      .trim()
      .min(1, '请输入服务器地址')
      .max(500, '服务器地址不能超过 500 个字符')
      .refine(isSafeSub2ApiServerUrl, '服务器地址必须是完整的 HTTPS 地址'),
    loginRule: z.string().trim().max(120, '登录页识别规则不能超过 120 个字符').optional(),
    shortcuts: z
      .array(sub2apiShortcutInputSchema)
      .max(SUB2API_SERVER_SHORTCUT_LIMIT, `最多 ${SUB2API_SERVER_SHORTCUT_LIMIT} 个快捷入口`)
      .default([]),
  })
  .strict();

export const sub2apiServerSchema = sub2apiServerInputSchema.extend({
  id: z.string().min(1).max(128),
  partitionId: z.string().min(1).max(200),
  loginState: sub2apiServerLoginStateSchema,
  seenLoggedIn: z.boolean(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  shortcuts: z
    .array(sub2apiShortcutSchema)
    .max(SUB2API_SERVER_SHORTCUT_LIMIT, `最多 ${SUB2API_SERVER_SHORTCUT_LIMIT} 个快捷入口`),
});

export const sub2apiServersSchema = z
  .array(sub2apiServerSchema)
  .max(SUB2API_SERVER_LIMIT)
  .superRefine((servers, context) => {
    const names = new Set<string>();
    const urls = new Set<string>();
    servers.forEach((server, serverIndex) => {
      const name = server.name.trim();
      const url = normalizeSub2ApiServerUrl(server.baseUrl);
      if (names.has(name))
        context.addIssue({
          code: 'custom',
          path: [serverIndex, 'name'],
          message: '服务器名称不能重复',
        });
      if (urls.has(url))
        context.addIssue({
          code: 'custom',
          path: [serverIndex, 'baseUrl'],
          message: '服务器地址不能重复',
        });
      names.add(name);
      urls.add(url);
      const shortcutLabels = new Set<string>();
      server.shortcuts.forEach((shortcut, shortcutIndex) => {
        if (shortcutLabels.has(shortcut.label.trim()))
          context.addIssue({
            code: 'custom',
            path: [serverIndex, 'shortcuts', shortcutIndex, 'label'],
            message: '快捷入口名称不能重复',
          });
        shortcutLabels.add(shortcut.label.trim());
        if (!sub2apiShortcutUrl(url, shortcut.path))
          context.addIssue({
            code: 'custom',
            path: [serverIndex, 'shortcuts', shortcutIndex, 'path'],
            message: '快捷入口必须指向当前服务器同源 HTTPS 地址',
          });
      });
    });
  });

export const sub2apiServerIdSchema = z.string().min(1).max(128);

export const sub2apiServerUpdateSchema = z
  .object({
    id: sub2apiServerIdSchema,
    name: sub2apiServerInputSchema.shape.name,
    baseUrl: sub2apiServerInputSchema.shape.baseUrl,
    loginRule: sub2apiServerInputSchema.shape.loginRule,
    shortcuts: z
      .array(sub2apiShortcutUpdateSchema)
      .max(SUB2API_SERVER_SHORTCUT_LIMIT, `最多 ${SUB2API_SERVER_SHORTCUT_LIMIT} 个快捷入口`),
  })
  .strict();

export type Sub2ApiShortcutInput = z.infer<typeof sub2apiShortcutInputSchema>;
export type Sub2ApiShortcut = z.infer<typeof sub2apiShortcutSchema>;
export type Sub2ApiServerInput = z.infer<typeof sub2apiServerInputSchema>;
export type Sub2ApiServer = z.infer<typeof sub2apiServerSchema>;
export type Sub2ApiServerUpdateInput = z.infer<typeof sub2apiServerUpdateSchema>;

export type Sub2ApiServerTarget = { id: string; label: string };

export type Sub2ApiServerEmbedState =
  | { status: 'idle' }
  | { status: 'opening'; target: Sub2ApiServerTarget }
  | {
      status: 'open';
      target: Sub2ApiServerTarget;
      url: string;
      canGoBack: boolean;
      canGoForward: boolean;
      loading: boolean;
      loginState: Sub2ApiServerLoginState;
    }
  | { status: 'error'; target: Sub2ApiServerTarget; message: string };

export function isAllowedSub2ApiServerNavigation(value: unknown, allowedOrigin: string): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.origin === allowedOrigin
    );
  } catch {
    return false;
  }
}

export function isSub2ApiServerLoginRoute(url: string, loginRule?: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLocaleLowerCase();
    const rule = loginRule?.trim().toLocaleLowerCase().replace(/^\//, '');
    if (rule) return pathname.includes(rule);
    return /(^|\/)(login|signin|sign-in|auth|logon|logout|signout)([/?#]|$)/.test(pathname);
  } catch {
    return false;
  }
}

export function resolveSub2ApiServerLoginState(
  current: { loginState: Sub2ApiServerLoginState; seenLoggedIn: boolean; loginRule?: string },
  url: string,
  httpResponseCode: number,
): { loginState: Sub2ApiServerLoginState; seenLoggedIn: boolean } {
  let loginState = current.loginState;
  let seenLoggedIn = current.seenLoggedIn;
  if (httpResponseCode === 401 || httpResponseCode === 403) {
    loginState = 'expired';
    seenLoggedIn = true;
  } else if (isSub2ApiServerLoginRoute(url, current.loginRule)) {
    loginState = seenLoggedIn ? 'expired' : 'please-login';
  } else if (httpResponseCode >= 200 && httpResponseCode < 400) {
    loginState = 'logged-in';
    seenLoggedIn = true;
  }
  return { loginState, seenLoggedIn };
}

export type Sub2ApiServerContentSize = { width: number; height: number };

export const SUB2API_SERVER_VIEW_LEFT = 284;
export const SUB2API_SERVER_VIEW_TOP = 80;

export function sub2apiServerViewBounds(size: Sub2ApiServerContentSize) {
  return {
    x: SUB2API_SERVER_VIEW_LEFT,
    y: SUB2API_SERVER_VIEW_TOP,
    width: Math.max(0, Math.round(size.width) - SUB2API_SERVER_VIEW_LEFT),
    height: Math.max(0, Math.round(size.height) - SUB2API_SERVER_VIEW_TOP),
  };
}
