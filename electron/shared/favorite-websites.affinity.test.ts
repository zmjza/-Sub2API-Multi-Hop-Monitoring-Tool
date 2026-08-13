import { describe, expect, it } from 'vitest';
import {
  blockedFavoriteWebsiteIds,
  isFavoriteWebsiteAllowed,
  type FavoriteWebsite,
  type FavoriteWebsitesPolicy,
} from './favorite-websites.js';

describe('常用网站政策应用到既有网站', () => {
  const site = (id: string, name: string, url: string): FavoriteWebsite => ({
    id,
    name,
    url,
    partitionId: 'persist:favorite-website-' + id,
    createdAt: 1,
    updatedAt: 1,
  });

  it('开关变化只影响对应类型的网站', () => {
    const policy: FavoriteWebsitesPolicy = {
      http: false,
      https: true,
      localhost: true,
      loopback: true,
      lanIp: true,
      publicDomain: true,
      nonStandardPorts: true,
      customRules: [],
      version: 1,
    };
    const websites = [
      site('http-site', 'HTTP 站点', 'http://example.com/'),
      site('https-site', 'HTTPS 站点', 'https://example.com/'),
    ];
    expect(isFavoriteWebsiteAllowed(websites[0], policy)).toBe(false);
    expect(isFavoriteWebsiteAllowed(websites[1], policy)).toBe(true);
    expect(blockedFavoriteWebsiteIds(websites, policy)).toEqual(['http-site']);
  });

  it('禁用自定义规则后正确标出受影响网站且不会删除配置', () => {
    const policy: FavoriteWebsitesPolicy = {
      http: false,
      https: true,
      localhost: false,
      loopback: false,
      lanIp: false,
      publicDomain: true,
      nonStandardPorts: false,
      customRules: [
        {
          id: 'rule-a',
          label: '内网面板',
          pattern: 'http://192.168.1.20:8080/',
          enabled: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      version: 1,
    };
    const websites = [site('a', '内网面板', 'http://192.168.1.20:8080/')];
    expect(isFavoriteWebsiteAllowed(websites[0], policy)).toBe(false);
    expect(blockedFavoriteWebsiteIds(websites, policy)).toEqual(['a']);
    expect(websites).toHaveLength(1);
  });
});
