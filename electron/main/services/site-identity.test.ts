import { describe, expect, it } from 'vitest';
import { normalizeAccountIdentity } from './site-service.js';

describe('site account identity', () => {
  it('trims usernames and compares email identities case-insensitively', () => {
    expect(normalizeAccountIdentity('  User@Example.com ')).toBe('user@example.com');
    expect(normalizeAccountIdentity('user@example.com')).toBe('user@example.com');
  });

  it('preserves case for non-email usernames', () => {
    expect(normalizeAccountIdentity('  CaseSensitiveUser ')).toBe('CaseSensitiveUser');
    expect(normalizeAccountIdentity('casesensitiveuser')).not.toBe('CaseSensitiveUser');
  });
});
