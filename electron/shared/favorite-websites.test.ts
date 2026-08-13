import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FAVORITE_WEBSITES_POLICY,
  favoriteWebsiteInputSchema,
  favoriteWebsitePolicySchema,
  favoriteWebsitesSchema,
  isPermanentlyBlockedUrl,
  isUrlAllowedByPolicy,
  matchCustomAllowRule,
  normalizeFavoriteWebsiteUrl,
  parseCustomAllowRule,
} from './favorite-websites.js';

describe('常用网站 URL 基础边界', () => {
  it('规范化并接受 HTTP/HTTPS、localhost、回环和局域网地址', () => {
    expect(normalizeFavoriteWebsiteUrl(' http://localhost:3000/ ')).toBe('http://localhost:3000/');
    expect(normalizeFavoriteWebsiteUrl('https://example.com/a?b=1#top')).toBe(
      'https://example.com/a?b=1#top',
    );
    expect(normalizeFavoriteWebsiteUrl('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080/');
    expect(normalizeFavoriteWebsiteUrl('http://192.168.1.10:3000')).toBe(
      'http://192.168.1.10:3000/',
    );
  });

  it('永久拒绝危险协议、凭据和无效地址', () => {
    for (const value of [
      'file:///tmp/test.html',
      'javascript:alert(1)',
      'data:text/html,hello',
      'devtools://devtools/bundled/inspector.html',
      'ftp://example.com/file',
      'about:blank',
      'chrome://settings',
      'https://user:pass@example.com/',
      'http://user@example.com/',
      '',
      '   ',
      'example.com',
      'https://',
      'not a url',
    ]) {
      expect(isPermanentlyBlockedUrl(value), value).toBe(true);
    }
  });

  it('不把合法 HTTP/HTTPS 地址判为永久禁止', () => {
    for (const value of [
      'https://example.com/',
      'http://localhost:5173/',
      'http://10.0.0.8:8080/panel',
      'https://example.com:8443/admin',
    ]) {
      expect(isPermanentlyBlockedUrl(value), value).toBe(false);
    }
  });
});

describe('常用网站地址类型开关', () => {
  it('默认策略允许公网、本地、局域网和非标准端口', () => {
    const policy = DEFAULT_FAVORITE_WEBSITES_POLICY;
    expect(isUrlAllowedByPolicy('https://example.com/', policy)).toBe(true);
    expect(isUrlAllowedByPolicy('http://example.com/', policy)).toBe(true);
    expect(isUrlAllowedByPolicy('http://localhost:5173/', policy)).toBe(true);
    expect(isUrlAllowedByPolicy('http://127.0.0.1:8080/', policy)).toBe(true);
    expect(isUrlAllowedByPolicy('http://192.168.1.10:3000/', policy)).toBe(true);
    expect(isUrlAllowedByPolicy('http://10.2.3.4/', policy)).toBe(true);
  });

  it('关闭 HTTP 后拒绝 http 地址但保留 https', () => {
    const policy = { ...DEFAULT_FAVORITE_WEBSITES_POLICY, http: false };
    expect(isUrlAllowedByPolicy('http://example.com/', policy)).toBe(false);
    expect(isUrlAllowedByPolicy('http://localhost:5173/', policy)).toBe(false);
    expect(isUrlAllowedByPolicy('https://example.com/', policy)).toBe(true);
  });

  it('关闭 localhost 后只拒绝本机域名，不影响回环或局域网', () => {
    const policy = { ...DEFAULT_FAVORITE_WEBSITES_POLICY, localhost: false };
    expect(isUrlAllowedByPolicy('http://localhost:5173/', policy)).toBe(false);
    expect(isUrlAllowedByPolicy('http://127.0.0.1:8080/', policy)).toBe(true);
    expect(isUrlAllowedByPolicy('http://192.168.1.10/', policy)).toBe(true);
  });

  it('关闭局域网 IP 后拒绝私有网段但保留公网域名', () => {
    const policy = { ...DEFAULT_FAVORITE_WEBSITES_POLICY, lanIp: false };
    expect(isUrlAllowedByPolicy('http://192.168.1.10/', policy)).toBe(false);
    expect(isUrlAllowedByPolicy('http://10.0.0.1/', policy)).toBe(false);
    expect(isUrlAllowedByPolicy('http://172.16.0.1/', policy)).toBe(false);
    expect(isUrlAllowedByPolicy('https://example.com/', policy)).toBe(true);
  });

  it('关闭非标准端口后只允许默认端口', () => {
    const policy = { ...DEFAULT_FAVORITE_WEBSITES_POLICY, nonStandardPorts: false };
    expect(isUrlAllowedByPolicy('http://localhost:5173/', policy)).toBe(false);
    expect(isUrlAllowedByPolicy('https://example.com:8443/', policy)).toBe(false);
    expect(isUrlAllowedByPolicy('http://example.com/', policy)).toBe(true);
    expect(isUrlAllowedByPolicy('https://example.com/', policy)).toBe(true);
  });

  it('永久禁止不受任何开关影响', () => {
    expect(isUrlAllowedByPolicy('file:///tmp/x.html', DEFAULT_FAVORITE_WEBSITES_POLICY)).toBe(
      false,
    );
    expect(isUrlAllowedByPolicy('javascript:alert(1)', DEFAULT_FAVORITE_WEBSITES_POLICY)).toBe(
      false,
    );
    expect(
      isUrlAllowedByPolicy('https://user:pass@example.com/', DEFAULT_FAVORITE_WEBSITES_POLICY),
    ).toBe(false);
  });
});

describe('自定义允许规则', () => {
  it('解析精确域名、通配子域名、IP、端口和地址前缀规则', () => {
    expect(parseCustomAllowRule('example.com')).toMatchObject({
      protocol: undefined,
      host: 'example.com',
      port: undefined,
      path: undefined,
    });
    expect(parseCustomAllowRule('*.example.com')).toMatchObject({ host: '*.example.com' });
    expect(parseCustomAllowRule('192.168.1.20')).toMatchObject({ host: '192.168.1.20' });
    expect(parseCustomAllowRule('localhost:3000')).toMatchObject({ host: 'localhost', port: 3000 });
    expect(parseCustomAllowRule('http://192.168.1.20:8080/')).toMatchObject({
      protocol: 'http:',
      host: '192.168.1.20',
      port: 8080,
      path: '/',
    });
  });

  it('拒绝危险规则和不完整规则', () => {
    for (const value of [
      'file:///tmp',
      'javascript:alert(1)',
      'https://user:pass@example.com',
      'ftp://example.com',
      '*.',
      'https://',
      '',
      '   ',
      'https://example.com:99999',
    ]) {
      expect(parseCustomAllowRule(value), value).toBeUndefined();
    }
  });

  it('匹配精确域名但不误匹配长后缀', () => {
    expect(matchCustomAllowRule(parseCustomAllowRule('example.com')!, 'https://example.com/')).toBe(
      true,
    );
    expect(
      matchCustomAllowRule(parseCustomAllowRule('example.com')!, 'https://badexample.com/'),
    ).toBe(false);
    expect(
      matchCustomAllowRule(parseCustomAllowRule('example.com')!, 'https://example.com.evil/'),
    ).toBe(false);
    expect(
      matchCustomAllowRule(parseCustomAllowRule('*.example.com')!, 'https://a.example.com/'),
    ).toBe(true);
    expect(
      matchCustomAllowRule(parseCustomAllowRule('*.example.com')!, 'https://example.com/'),
    ).toBe(false);
    expect(
      matchCustomAllowRule(parseCustomAllowRule('*.example.com')!, 'https://a.b.example.com/'),
    ).toBe(true);
  });

  it('匹配 IP、端口和带路径的规则', () => {
    expect(
      matchCustomAllowRule(parseCustomAllowRule('192.168.1.20')!, 'http://192.168.1.20:3000/login'),
    ).toBe(true);
    expect(
      matchCustomAllowRule(parseCustomAllowRule('localhost:3000')!, 'http://localhost:3000/a/b'),
    ).toBe(true);
    expect(
      matchCustomAllowRule(parseCustomAllowRule('localhost:3000')!, 'http://localhost:4000/a'),
    ).toBe(false);
    expect(
      matchCustomAllowRule(
        parseCustomAllowRule('http://192.168.1.20:8080/panel')!,
        'http://192.168.1.20:8080/panel/keys',
      ),
    ).toBe(true);
    expect(
      matchCustomAllowRule(
        parseCustomAllowRule('http://192.168.1.20:8080/panel')!,
        'http://192.168.1.20:8080/other',
      ),
    ).toBe(false);
  });

  it('启用规则可以补齐被关闭的类型开关，禁用规则不生效', () => {
    const policy = {
      ...DEFAULT_FAVORITE_WEBSITES_POLICY,
      http: false,
      lanIp: false,
      customRules: [
        {
          id: 'rule-1',
          label: '内网面板',
          pattern: 'http://192.168.1.20:8080/',
          enabled: true,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'rule-2',
          label: '关闭的规则',
          pattern: 'http://10.0.0.9:9000/',
          enabled: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    };
    expect(isUrlAllowedByPolicy('http://192.168.1.20:8080/panel', policy)).toBe(true);
    expect(isUrlAllowedByPolicy('http://10.0.0.9:9000/', policy)).toBe(false);
    expect(isUrlAllowedByPolicy('http://other.example.com/', policy)).toBe(false);
  });
});

describe('常用网站 schema', () => {
  it('接受合法输入并补全规范化 URL', () => {
    const parsed = favoriteWebsiteInputSchema.parse({
      name: '  本地面板 ',
      url: ' http://localhost:5173 ',
    });
    expect(parsed).toEqual({ name: '本地面板', url: 'http://localhost:5173/' });
  });

  it('拒绝超长、空名称、危险地址和重复项', () => {
    expect(
      favoriteWebsiteInputSchema.safeParse({ name: '', url: 'https://example.com/' }).success,
    ).toBe(false);
    expect(
      favoriteWebsiteInputSchema.safeParse({ name: 'x'.repeat(81), url: 'https://example.com/' })
        .success,
    ).toBe(false);
    expect(
      favoriteWebsiteInputSchema.safeParse({ name: '测试', url: 'file:///tmp/x' }).success,
    ).toBe(false);
    expect(
      favoriteWebsiteInputSchema.safeParse({ name: '测试', url: 'https://user:p@example.com/' })
        .success,
    ).toBe(false);

    const base = {
      id: 'a',
      partitionId: 'persist:favorite-website-a',
      createdAt: 1,
      updatedAt: 1,
    };
    const duplicate = favoriteWebsitesSchema.safeParse([
      { ...base, name: '同一个', url: 'https://example.com/' },
      {
        ...base,
        id: 'b',
        partitionId: 'persist:favorite-website-b',
        name: '另一个',
        url: 'https://example.com/',
      },
    ]);
    expect(duplicate.success).toBe(false);
  });

  it('政策 schema 对未知字段安全回退到默认值', () => {
    expect(favoriteWebsitePolicySchema.safeParse({ http: false }).success).toBe(true);
    const parsed = favoriteWebsitePolicySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.http).toBe(true);
  });
});
