import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  canStartConnectivityTest,
  connectivityPanelState,
  defaultConnectivityKeyId,
} from './ConnectivityTestModal';

describe('connectivity test defaults', () => {
  const keys = [
    { id: 'paused', maskedLabel: 'Paused', status: 'disabled' },
    { id: 'auto-key', maskedLabel: 'Auto', status: 'active' },
    { id: 'manual-key', maskedLabel: 'Manual', status: 'active' },
  ];

  it('prefers the current effective key and falls back to the first active key', () => {
    expect(defaultConnectivityKeyId(keys, { mode: 'auto' }, 'auto-key')).toBe('auto-key');
    expect(defaultConnectivityKeyId(keys, { mode: 'manual', keyId: 'manual-key' })).toBe(
      'manual-key',
    );
    expect(defaultConnectivityKeyId(keys, { mode: 'auto' })).toBe('auto-key');
    expect(defaultConnectivityKeyId([], { mode: 'auto' })).toBe('');
  });

  it('blocks start when key or model is missing', () => {
    expect(canStartConnectivityTest('auto-key', 'gpt-5.6-sol', false)).toBe(true);
    expect(canStartConnectivityTest('auto-key', '', false)).toBe(false);
    expect(canStartConnectivityTest('', 'gpt-5.6-sol', false)).toBe(false);
    expect(canStartConnectivityTest('auto-key', 'gpt-5.6-sol', true)).toBe(false);
  });
});

describe('connectivityPanelState', () => {
  it('maps real events including 30s timeout failed', () => {
    expect(connectivityPanelState({ type: 'started' })).toBe('waiting');
    expect(connectivityPanelState({ type: 'delta' })).toBe('streaming');
    expect(connectivityPanelState({ type: 'completed' })).toBe('success');
    expect(connectivityPanelState({ type: 'failed', message: '测试超时' })).toBe('timeout-failed');
    expect(connectivityPanelState({ type: 'failed', message: '鉴权失败' })).toBe('failed');
    expect(connectivityPanelState({ type: 'cancelled' })).toBe('cancelled');
  });
});

describe('connectivity log motion', () => {
  it('styles waiting streaming success failed timeout and cancelled states', () => {
    const css = readFileSync(fileURLToPath(new URL('./overview.css', import.meta.url)), 'utf8');
    for (const state of [
      'waiting',
      'streaming',
      'success',
      'failed',
      'timeout-failed',
      'cancelled',
    ]) {
      expect(css).toContain(`.connectivity-log[data-state='${state}']`);
    }
  });
});
