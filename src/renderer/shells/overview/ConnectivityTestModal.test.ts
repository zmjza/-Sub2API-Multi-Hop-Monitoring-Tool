import { describe, expect, it } from 'vitest';
import { canStartConnectivityTest, defaultConnectivityKeyId } from './ConnectivityTestModal';

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
