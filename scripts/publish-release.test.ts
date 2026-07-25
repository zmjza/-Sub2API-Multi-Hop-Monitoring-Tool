import { describe, expect, it } from 'vitest';
import { assetNames, parseArgs, validateVersion } from './publish-release.mjs';

describe('publish release command', () => {
  it('requires notes and supports test-only releases', () => {
    expect(parseArgs(['--notes', '修复更新问题', '--test-only'])).toEqual({
      notes: '修复更新问题',
      testOnly: true,
      dryRun: false,
    });
    expect(() => parseArgs([])).toThrow('必须提供 --notes');
  });

  it('rejects invalid versions', () => {
    expect(validateVersion('1.4.7')).toBe('1.4.7');
    expect(() => validateVersion('1.4')).toThrow('SemVer');
    expect(() => validateVersion('v1.4.7')).toThrow('SemVer');
  });

  it('defines both platform assets and their blockmaps', () => {
    expect(assetNames('1.4.7')).toEqual([
      'Sub2API-Multi-Hub-Monitor-1.4.7-mac-arm64.dmg',
      'Sub2API-Multi-Hub-Monitor-1.4.7-mac-arm64.dmg.blockmap',
      'Sub2API-Multi-Hub-Monitor-1.4.7-win-x64.exe',
      'Sub2API-Multi-Hub-Monitor-1.4.7-win-x64.exe.blockmap',
      'update-manifest.json',
    ]);
  });
});
