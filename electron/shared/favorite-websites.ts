import { z } from 'zod';

export const FAVORITE_WEBSITES_KEY = 'favorite-websites:entries';
export const FAVORITE_WEBSITES_POLICY_KEY = 'favorite-websites:policy';
export const FAVORITE_WEBSITE_LIMIT = 50;
export const FAVORITE_CUSTOM_RULE_LIMIT = 100;

export const favoriteAddressSwitchSchema = z
  .object({
    http: z.boolean().default(true),
    https: z.boolean().default(true),
    localhost: z.boolean().default(true),
    loopback: z.boolean().default(true),
    lanIp: z.boolean().default(true),
    publicDomain: z.boolean().default(true),
    nonStandardPorts: z.boolean().default(true),
  })
  .strict();

export type ParsedCustomAllowRule = {
  protocol: 'http:' | 'https:' | undefined;
  host: string;
  port: number | undefined;
  path: string | undefined;
};

export const favoriteCustomAllowRuleInputSchema = z
  .object({
    label: z.string().trim().min(1, '请输入规则名称').max(40, '规则名称不能超过 40 个字符'),
    pattern: z
      .string()
      .trim()
      .min(1, '请输入规则内容')
      .max(500, '规则内容不能超过 500 个字符')
      .refine((value) => parseCustomAllowRule(value) !== undefined, '规则内容无效或超出允许范围'),
    description: z.string().trim().max(200, '备注不能超过 200 个字符').optional(),
  })
  .strict();

export const favoriteCustomAllowRuleSchema = favoriteCustomAllowRuleInputSchema.extend({
  id: z.string().min(1).max(128),
  enabled: z.boolean().default(true),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

export const favoriteWebsitePolicySchema = z
  .object({
    ...favoriteAddressSwitchSchema.shape,
    customRules: z
      .array(favoriteCustomAllowRuleSchema)
      .max(FAVORITE_CUSTOM_RULE_LIMIT, `最多 ${FAVORITE_CUSTOM_RULE_LIMIT} 条自定义规则`)
      .default([]),
    version: z.literal(1).default(1),
  })
  .strict()
  .superRefine((policy, context) => {
    const labels = new Set<string>();
    const patterns = new Set<string>();
    policy.customRules.forEach((rule, index) => {
      if (labels.has(rule.label.trim()))
        context.addIssue({
          code: 'custom',
          path: ['customRules', index, 'label'],
          message: '规则名称不能重复',
        });
      labels.add(rule.label.trim());
      const normalized = normalizeCustomAllowRulePattern(rule.pattern);
      if (normalized && patterns.has(normalized))
        context.addIssue({
          code: 'custom',
          path: ['customRules', index, 'pattern'],
          message: '规则内容不能重复',
        });
      if (normalized) patterns.add(normalized);
    });
  });

export type FavoriteWebsitesPolicy = z.infer<typeof favoriteWebsitePolicySchema>;

export const DEFAULT_FAVORITE_WEBSITES_POLICY: FavoriteWebsitesPolicy =
  favoriteWebsitePolicySchema.parse({});

export const favoriteWebsiteInputSchema = z
  .object({
    name: z.string().trim().min(1, '请输入网站名称').max(80, '网站名称不能超过 80 个字符'),
    url: z
      .string()
      .trim()
      .min(1, '请输入网站地址')
      .max(500, '网站地址不能超过 500 个字符')
      .refine(
        (value) => !isPermanentlyBlockedUrl(value),
        '网站地址必须是完整的 HTTP 或 HTTPS 地址，不能包含用户名密码或危险协议',
      )
      .transform((value) => normalizeFavoriteWebsiteUrl(value) ?? value),
  })
  .strict();

export const favoriteWebsiteSchema = favoriteWebsiteInputSchema.extend({
  id: z.string().min(1).max(128),
  partitionId: z.string().min(1).max(200),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

export const favoriteWebsiteUpdateSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: favoriteWebsiteInputSchema.shape.name,
    url: favoriteWebsiteInputSchema.shape.url,
  })
  .strict();

export const favoriteWebsiteIdSchema = z.string().min(1).max(128);

export const favoriteWebsitesSchema = z
  .array(favoriteWebsiteSchema)
  .max(FAVORITE_WEBSITE_LIMIT)
  .superRefine((websites, context) => {
    const names = new Set<string>();
    const urls = new Set<string>();
    websites.forEach((website, index) => {
      if (names.has(website.name.trim()))
        context.addIssue({
          code: 'custom',
          path: [index, 'name'],
          message: '网站名称不能重复',
        });
      names.add(website.name.trim());
      if (urls.has(website.url))
        context.addIssue({
          code: 'custom',
          path: [index, 'url'],
          message: '网站地址不能重复',
        });
      urls.add(website.url);
    });
  });

export type FavoriteCustomAllowRule = z.infer<typeof favoriteCustomAllowRuleSchema>;
export type FavoriteWebsite = z.infer<typeof favoriteWebsiteSchema>;
export type FavoriteWebsiteInput = z.infer<typeof favoriteWebsiteInputSchema>;
export type FavoriteWebsiteUpdate = z.infer<typeof favoriteWebsiteUpdateSchema>;

export function normalizeFavoriteWebsiteUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username !== '' ||
      url.password !== '' ||
      url.hostname.length === 0
    )
      return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function isPermanentlyBlockedUrl(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  return normalizeFavoriteWebsiteUrl(value) === undefined;
}

function parseIpv4(value: string): number[] | undefined {
  const parts = value.split('.');
  if (parts.length !== 4) return undefined;
  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return undefined;
    const number = Number(part);
    if (number > 255 || (part.length > 1 && part.startsWith('0'))) return undefined;
    numbers.push(number);
  }
  return numbers;
}

export function isLanIpv4Address(hostname: string): boolean {
  const ip = parseIpv4(hostname);
  if (!ip) return false;
  const [a, b] = ip;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function isLoopbackHostname(hostname: string): boolean {
  const lower = hostname.toLocaleLowerCase();
  return lower === '::1' || lower === 'localhost' || lower.endsWith('.localhost');
}

export function isLoopbackIpv4Address(hostname: string): boolean {
  const ip = parseIpv4(hostname);
  return ip !== undefined && ip[0] === 127;
}

function portIsNonStandard(url: URL): boolean {
  if (url.port === '') return false;
  const port = Number(url.port);
  if (Number.isNaN(port)) return true;
  return !(
    (url.protocol === 'http:' && port === 80) ||
    (url.protocol === 'https:' && port === 443)
  );
}

function urlMatchesAddressSwitch(url: URL, policy: FavoriteWebsitesPolicy): boolean {
  if (url.protocol === 'http:' && !policy.http) return false;
  if (url.protocol === 'https:' && !policy.https) return false;
  if (isLoopbackHostname(url.hostname) && !policy.localhost) return false;
  if (isLoopbackIpv4Address(url.hostname) && !policy.loopback) return false;
  if (isLanIpv4Address(url.hostname) && !policy.lanIp) return false;
  const isSpecialHost =
    isLoopbackHostname(url.hostname) ||
    isLoopbackIpv4Address(url.hostname) ||
    isLanIpv4Address(url.hostname) ||
    parseIpv4(url.hostname) !== undefined;
  if (!isSpecialHost && !policy.publicDomain) return false;
  if (portIsNonStandard(url) && !policy.nonStandardPorts) return false;
  return true;
}

export function normalizeCustomAllowRulePattern(value: string): string | undefined {
  const parsed = parseCustomAllowRule(value);
  if (!parsed) return undefined;
  const protocol = parsed.protocol ? `${parsed.protocol}//` : '';
  const port = parsed.port !== undefined ? `:${parsed.port}` : '';
  return `${protocol}${parsed.host}${port}${parsed.path ?? ''}`;
}

export function parseCustomAllowRule(value: string): ParsedCustomAllowRule | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return undefined;
  if (trimmed.includes('@')) return undefined;

  let protocol: 'http:' | 'https:' | undefined;
  let rest = trimmed;
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(rest);
  if (schemeMatch) {
    const scheme = schemeMatch[1];
    if (scheme !== 'http' && scheme !== 'https') return undefined;
    protocol = (scheme + ':') as 'http:' | 'https:';
    rest = rest.slice(scheme.length + 3);
  } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(rest)) {
    return undefined;
  }
  const slashIndex = rest.indexOf('/');
  const authority = slashIndex >= 0 ? rest.slice(0, slashIndex) : rest;
  const path = slashIndex >= 0 ? rest.slice(slashIndex) : undefined;
  if (path !== undefined && (path.length === 0 || path.includes('?') || path.includes('#')))
    return undefined;

  let host: string;
  let port: number | undefined;
  if (authority.startsWith('[')) {
    const close = authority.indexOf(']');
    if (close < 0) return undefined;
    host = authority.slice(1, close).toLocaleLowerCase();
    const suffix = authority.slice(close + 1);
    if (suffix !== '') {
      if (!suffix.startsWith(':')) return undefined;
      port = parsePort(suffix.slice(1));
      if (port === undefined) return undefined;
    }
    if (host !== '::1') return undefined;
  } else {
    const colonIndex = authority.lastIndexOf(':');
    if (colonIndex >= 0) {
      host = authority.slice(0, colonIndex);
      port = parsePort(authority.slice(colonIndex + 1));
      if (port === undefined) return undefined;
    } else {
      host = authority;
    }
    host = host.toLocaleLowerCase();
    if (host.startsWith('*.')) {
      const bareHost = host.slice(2);
      if (
        !bareHost ||
        bareHost.startsWith('.') ||
        bareHost.endsWith('.') ||
        bareHost === 'localhost' ||
        bareHost.endsWith('.localhost') ||
        isLoopbackIpv4Address(bareHost) ||
        isLanIpv4Address(bareHost) ||
        !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(bareHost)
      )
        return undefined;
    } else if (
      host === '' ||
      host.includes('*') ||
      (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host) &&
        parseIpv4(host) === undefined &&
        host !== 'localhost' &&
        !host.endsWith('.localhost'))
    )
      return undefined;
  }

  return { protocol, host, port, path };
}

function parsePort(value: string): number | undefined {
  if (!/^\d{1,5}$/.test(value)) return undefined;
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : undefined;
}

export function matchCustomAllowRule(rule: ParsedCustomAllowRule, value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (isPermanentlyBlockedUrl(value)) return false;
  if (rule.protocol && url.protocol !== rule.protocol) return false;
  const hostname = url.hostname.toLocaleLowerCase();
  const wildcard = rule.host.startsWith('*.');
  const expectedHost = wildcard ? rule.host.slice(2) : rule.host;
  if (wildcard) {
    if (hostname === expectedHost || !hostname.endsWith(`.${expectedHost}`)) return false;
  } else if (hostname !== expectedHost) {
    return false;
  }
  if (rule.port !== undefined) {
    const actualPort = url.port === '' ? (url.protocol === 'http:' ? 80 : 443) : Number(url.port);
    if (actualPort !== rule.port) return false;
  }
  if (rule.path !== undefined && !url.pathname.startsWith(rule.path)) return false;
  return true;
}

export function isUrlAllowedByPolicy(value: string, policy: FavoriteWebsitesPolicy): boolean {
  if (isPermanentlyBlockedUrl(value)) return false;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (urlMatchesAddressSwitch(url, policy)) return true;
  return policy.customRules.some((rule) => {
    if (!rule.enabled) return false;
    const parsed = parseCustomAllowRule(rule.pattern);
    return parsed !== undefined && matchCustomAllowRule(parsed, value);
  });
}

export function blockedWebsiteReason(
  value: string,
  policy: FavoriteWebsitesPolicy,
): string | undefined {
  if (isPermanentlyBlockedUrl(value)) return '地址包含危险协议或不符合 HTTP/HTTPS 要求';
  if (isUrlAllowedByPolicy(value, policy)) return undefined;
  return '当前地址支持规则不允许打开该网站';
}

export function isFavoriteWebsiteAllowed(
  website: Pick<FavoriteWebsite, 'url'>,
  policy: FavoriteWebsitesPolicy,
): boolean {
  return isUrlAllowedByPolicy(website.url, policy);
}

export function blockedFavoriteWebsiteIds(
  websites: FavoriteWebsite[],
  policy: FavoriteWebsitesPolicy,
): string[] {
  return websites
    .filter((website) => !isFavoriteWebsiteAllowed(website, policy))
    .map((website) => website.id);
}

export type FavoriteWebsiteTarget = { id: string; label: string };

export type FavoriteWebsiteEmbedState =
  | { status: 'idle' }
  | { status: 'opening'; target: FavoriteWebsiteTarget }
  | {
      status: 'open';
      target: FavoriteWebsiteTarget;
      url: string;
      canGoBack: boolean;
      canGoForward: boolean;
      loading: boolean;
    }
  | { status: 'blocked'; target: FavoriteWebsiteTarget; message: string }
  | { status: 'error'; target: FavoriteWebsiteTarget; message: string };

export const FAVORITE_WEBSITE_VIEW_LEFT = 284;
export const FAVORITE_WEBSITE_VIEW_TOP = 80;

export function favoriteWebsiteViewBounds(size: { width: number; height: number }) {
  return {
    x: FAVORITE_WEBSITE_VIEW_LEFT,
    y: FAVORITE_WEBSITE_VIEW_TOP,
    width: Math.max(0, Math.round(size.width) - FAVORITE_WEBSITE_VIEW_LEFT),
    height: Math.max(0, Math.round(size.height) - FAVORITE_WEBSITE_VIEW_TOP),
  };
}
