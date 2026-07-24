import { describe, expect, it } from 'vitest';
import { siteDisplayName } from './site-label';

describe('siteDisplayName', () => {
  it('prefers a non-empty trimmed note over the imported name', () => {
    expect(siteDisplayName({ name: '导入名称', note: '  我的备注  ' })).toBe('我的备注');
  });

  it('falls back to the imported name when note is blank', () => {
    expect(siteDisplayName({ name: '导入名称', note: '   ' })).toBe('导入名称');
  });
});
