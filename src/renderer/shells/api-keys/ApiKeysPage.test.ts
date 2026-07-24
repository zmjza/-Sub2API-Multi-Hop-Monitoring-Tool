import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ApiKeysPage,
  apiKeyStateMessage,
  normalizeApiKeyPagination,
  shouldRequestGroupChange,
} from './ApiKeysPage';
import type { ApiKeysPageProps } from './types';

const fixtureCompleteKey = ['sk', 'live', 'complete', 'A1B2'].join('-');

const baseProps: ApiKeysPageProps = {
  state: 'success',
  sites: [
    { id: 'site-a', name: '测试站点 A' },
    { id: 'site-b', name: '测试站点 B' },
  ],
  selectedSiteId: 'site-a',
  search: '',
  groupFilter: '',
  statusFilter: '',
  groups: [
    { id: 'group-a', name: '默认分组', platform: 'OpenAI', rate: 1 },
    { id: 'group-b', name: '优先分组', platform: 'Anthropic', rate: 0 },
  ],
  keys: [
    {
      id: 'key-a',
      name: '日常使用',
      maskedLabel: 'sk-xxx...A1B2',
      apiKey: fixtureCompleteKey,
      groupId: 'group-a',
      groupName: '默认分组',
      platform: 'OpenAI',
      effectiveRate: 1,
      currentConcurrency: 2,
      todayActualCost: 1.25,
      last30DaysActualCost: 8.5,
      expiresAt: undefined,
      status: 'active',
      createdAt: '2026-07-24T08:30:00.000Z',
    },
  ],
  pagination: { page: 1, pageSize: 20, pages: 2, total: 21 },
};
describe('API key page state model', () => {
  it('normalizes malformed pagination without inventing rows', () => {
    expect(normalizeApiKeyPagination({ page: 9, pageSize: 0, pages: 2, total: -3 })).toEqual({
      page: 2,
      pageSize: 20,
      pages: 2,
      total: 0,
      rangeStart: 0,
      rangeEnd: 0,
    });
  });

  it('does not request a write for the current group or a writing row', () => {
    expect(shouldRequestGroupChange('group-a', 'group-a', false)).toBe(false);
    expect(shouldRequestGroupChange('group-a', 'group-b', true)).toBe(false);
    expect(shouldRequestGroupChange('group-a', 'group-b', false)).toBe(true);
  });

  it('defines stable messages for every required remote state', () => {
    expect(apiKeyStateMessage('loading')).toContain('正在读取');
    expect(apiKeyStateMessage('empty')).toContain('暂无');
    expect(apiKeyStateMessage('error')).toContain('失败');
    expect(apiKeyStateMessage('unsupported')).toContain('不支持');
    expect(apiKeyStateMessage('auth-required')).toContain('重新登录');
    expect(apiKeyStateMessage('success')).toBe('');
    expect(apiKeyStateMessage('refreshing')).toContain('刷新');
    expect(apiKeyStateMessage('partial')).toContain('部分');
  });
});

describe('ApiKeysPage', () => {
  it('renders the site switcher, filters, complete table fields, group menu and pagination', () => {
    const html = renderToStaticMarkup(createElement(ApiKeysPage, baseProps));

    expect(html).toContain('aria-label="选择中转站"');
    expect(html).toContain('搜索名称或完整 API Key');
    for (const heading of [
      '名称',
      'API 密钥',
      '分组',
      '平台',
      '有效倍率',
      '当前并发',
      '消费',
      '状态',
      '创建时间',
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain(fixtureCompleteKey);
    expect(html).toContain('今日');
    expect(html).toContain('30天');
    expect(html).not.toContain('过期时间');
    expect(html).not.toContain('永久有效');
    expect(html).toContain('aria-label="切换日常使用的分组"');
    expect(html).toContain('0.00x');
    expect(html).toContain('aria-label="第 2 页"');
  });

  it('only disables the group control for the writing row and keeps partial data visible', () => {
    const secondKey = {
      ...baseProps.keys[0],
      id: 'key-b',
      name: '备用',
      maskedLabel: 'sk-xxx...C3D4',
    };
    const html = renderToStaticMarkup(
      createElement(ApiKeysPage, {
        ...baseProps,
        state: 'partial',
        keys: [baseProps.keys[0], secondKey],
        writingKeyIds: ['key-a'],
      }),
    );

    expect(html).toContain('部分用量暂未读取');
    expect(html.match(/api-keys-group-select-trigger[^>]*disabled=""/g)).toHaveLength(1);
    expect(html).toContain(fixtureCompleteKey);
  });

  it('renders a no-site action instead of stale table data', () => {
    const html = renderToStaticMarkup(
      createElement(ApiKeysPage, {
        ...baseProps,
        sites: [],
        selectedSiteId: undefined,
        keys: [],
      }),
    );

    expect(html).toContain('还没有可用的中转站');
    expect(html).toContain('前往站点管理');
    expect(html).not.toContain('sk-xxx...A1B2');
  });

  it('keeps every stylesheet selector scoped to the API key page', () => {
    const css = readFileSync(fileURLToPath(new URL('./api-keys.css', import.meta.url)), 'utf8');
    const selectors = css
      .split('{')
      .slice(0, -1)
      .map((chunk) => chunk.slice(chunk.lastIndexOf('}') + 1).trim())
      .filter((selector) => selector && !selector.startsWith('@'));

    expect(selectors.length).toBeGreaterThan(10);
    expect(
      selectors.every((selector) => selector.startsWith('.api-keys-') || selector === 'to'),
    ).toBe(true);
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('max-width: 1440px');
    expect(css).toContain('#4f46e5');
  });
});
