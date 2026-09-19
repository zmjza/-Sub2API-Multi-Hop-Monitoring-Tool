import { describe, expect, it } from 'vitest';
import { buildHvoyAiFillScript, isAllowedHvoyAiNavigation } from './hvoy-ai-policy.js';

describe('isAllowedHvoyAiNavigation', () => {
  it('only allows the two default HTTPS origins without credentials', () => {
    expect(isAllowedHvoyAiNavigation('https://www.hvoyai.com/path')).toBe(true);
    expect(isAllowedHvoyAiNavigation('https://hvoyai.com/?tab=test')).toBe(true);
    expect(isAllowedHvoyAiNavigation('https://hvoyai.com:444/path')).toBe(false);
    expect(isAllowedHvoyAiNavigation('https://user:pass@hvoyai.com/path')).toBe(false);
    expect(isAllowedHvoyAiNavigation('http://hvoyai.com/path')).toBe(false);
    expect(isAllowedHvoyAiNavigation('https://evil.example/path')).toBe(false);
  });

  it('activates the real Hvoy key control before filling and keeps detection manual', () => {
    const script = buildHvoyAiFillScript('https://example.com/v1', 'sk-test-key');

    expect(script).toContain("element.name==='access-token-input'");
    expect(script).toContain('/api *key|api密钥|密钥/i');
    expect(script).toContain("querySelector('div.cursor-text')");
    expect(script).toContain('keyActivation:');
    expect(script).toContain("button.textContent?.trim()==='我知道了'");
    expect(script).toContain("element.textContent?.trim()==='接口配置'");
    expect(script).toContain('new InputEvent');
    expect(script).not.toContain('开始检测');
  });
});
