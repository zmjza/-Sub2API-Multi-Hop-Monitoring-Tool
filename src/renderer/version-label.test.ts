import { describe, expect, it } from 'vitest';
import { normalizeVersionLabel } from './version-label';

describe('normalizeVersionLabel', () => {
  it('renders the shell version in the version badge', () => {
    expect(normalizeVersionLabel('1.4.5')).toBe('v1.4.5');
    expect(normalizeVersionLabel('v1.4.5')).toBe('v1.4.5');
  });

  it('uses a development label when the desktop bridge is unavailable', () => {
    expect(normalizeVersionLabel()).toBe('开发版');
  });
});
