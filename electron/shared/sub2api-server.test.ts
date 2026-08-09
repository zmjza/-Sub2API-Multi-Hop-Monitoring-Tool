import { describe, expect, it } from 'vitest';
import {
  SUB2API_SERVER_SHORTCUT_LIMIT,
  isAllowedSub2ApiServerNavigation,
  isSafeSub2ApiServerUrl,
  normalizeSub2ApiServerUrl,
  sub2apiServerInputSchema,
  sub2apiServersSchema,
  sub2apiShortcutUrl,
  sub2apiServerViewBounds,
} from './sub2api-server.js';

describe('sub2api server boundary', () => {
  it('normalizes server roots to a stable HTTPS origin', () => {
    expect(normalizeSub2ApiServerUrl('  https://example.com/api  ')).toBe('https://example.com/');
    expect(normalizeSub2ApiServerUrl('https://example.com')).toBe('https://example.com/');
    expect(isSafeSub2ApiServerUrl('http://example.com')).toBe(false);
    expect(isSafeSub2ApiServerUrl('https://user:pass@example.com')).toBe(false);
    expect(isSafeSub2ApiServerUrl('file:///tmp/x')).toBe(false);
  });

  it('validates server input with name, HTTPS root, login rule and shortcut limit', () => {
    const input = {
      name: ' 测试站 ',
      baseUrl: 'https://example.com/',
      loginRule: '/login',
      shortcuts: [
        { label: '账号管理', path: '/account', icon: 'Users' },
        { label: '使用记录', path: 'https://example.com/usage', icon: 'History' },
      ],
    };
    expect(sub2apiServerInputSchema.parse(input)).toMatchObject({
      name: '测试站',
      baseUrl: 'https://example.com/',
    });
    expect(
      sub2apiServerInputSchema.safeParse({
        ...input,
        baseUrl: 'http://example.com',
      }).success,
    ).toBe(false);
    expect(
      sub2apiServerInputSchema.safeParse({
        ...input,
        shortcuts: Array.from({ length: SUB2API_SERVER_SHORTCUT_LIMIT + 1 }, (_, index) => ({
          label: `快捷${index}`,
          path: `/p${index}`,
        })),
      }).success,
    ).toBe(false);
  });

  it('resolves shortcut paths only against the current server origin', () => {
    expect(sub2apiShortcutUrl('https://example.com', '/account')).toBe(
      'https://example.com/account',
    );
    expect(sub2apiShortcutUrl('https://example.com', 'https://example.com/usage')).toBe(
      'https://example.com/usage',
    );
    expect(
      sub2apiShortcutUrl('https://example.com', 'https://other.example/usage'),
    ).toBeUndefined();
    expect(sub2apiShortcutUrl('https://example.com', '//other.example/usage')).toBeUndefined();
    expect(sub2apiShortcutUrl('https://example.com', 'account')).toBeUndefined();
    expect(sub2apiShortcutUrl('https://example.com', 'javascript:alert(1)')).toBeUndefined();
  });

  it('rejects duplicate server names, URLs and shortcut labels in persisted entries', () => {
    const server = (id: string, name: string, url: string) => ({
      id,
      partitionId: `persist:sub2api-server-${id}`,
      loginState: 'unknown' as const,
      seenLoggedIn: false,
      createdAt: 1,
      updatedAt: 1,
      name,
      baseUrl: url,
      shortcuts: [{ id: 's1', label: '账号', path: '/account' }],
    });
    expect(
      sub2apiServersSchema.safeParse([
        server('a', '同名', 'https://a.example'),
        server('b', '同名', 'https://b.example'),
      ]).success,
    ).toBe(false);
    expect(
      sub2apiServersSchema.safeParse([
        server('a', 'A', 'https://a.example'),
        server('b', 'B', 'https://a.example'),
      ]).success,
    ).toBe(false);
  });

  it('allows only same-origin HTTPS navigation for the embedded server page', () => {
    const origin = 'https://example.com';
    expect(isAllowedSub2ApiServerNavigation('https://example.com/account', origin)).toBe(true);
    expect(isAllowedSub2ApiServerNavigation('https://other.example/', origin)).toBe(false);
    expect(isAllowedSub2ApiServerNavigation('https://example.com:444/', origin)).toBe(false);
    expect(isAllowedSub2ApiServerNavigation('https://user:pass@example.com/', origin)).toBe(false);
    expect(isAllowedSub2ApiServerNavigation('data:text/html,x', origin)).toBe(false);
  });

  it('keeps the embedded server below the app toolbar and beside the sidebar', () => {
    expect(sub2apiServerViewBounds({ width: 1200, height: 800 })).toEqual({
      x: 284,
      y: 80,
      width: 916,
      height: 720,
    });
  });
});
