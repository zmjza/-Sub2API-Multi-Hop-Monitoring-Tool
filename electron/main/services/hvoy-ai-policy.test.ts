import { describe, expect, it } from 'vitest';
import { isAllowedHvoyAiNavigation } from './hvoy-ai-policy.js';

describe('isAllowedHvoyAiNavigation', () => {
  it('only allows the two default HTTPS origins without credentials', () => {
    expect(isAllowedHvoyAiNavigation('https://www.hvoyai.com/path')).toBe(true);
    expect(isAllowedHvoyAiNavigation('https://hvoyai.com/?tab=test')).toBe(true);
    expect(isAllowedHvoyAiNavigation('https://hvoyai.com:444/path')).toBe(false);
    expect(isAllowedHvoyAiNavigation('https://user:pass@hvoyai.com/path')).toBe(false);
    expect(isAllowedHvoyAiNavigation('http://hvoyai.com/path')).toBe(false);
    expect(isAllowedHvoyAiNavigation('https://evil.example/path')).toBe(false);
  });
});
