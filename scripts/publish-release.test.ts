import { describe, expect, it } from 'vitest';
import { assetNames, assetsToReplace, parseArgs, validateVersion } from './publish-release.mjs';

describe('publish release command', () => {
  it('requires notes and supports test-only releases', () => {
    expect(parseArgs(['--notes', '修复更新问题', '--test-only'])).toEqual({
      notes: '修复更新问题',
      testOnly: true,
      dryRun: false,
      reuseArtifacts: false,
    });
    expect(() => parseArgs([])).toThrow('必须提供 --notes');
  });

  it('supports reusing a separately audited artifact set', () => {
    expect(parseArgs(['--notes', '发布已审计产物', '--reuse-artifacts'])).toEqual({
      notes: '发布已审计产物',
      testOnly: false,
      dryRun: false,
      reuseArtifacts: true,
    });
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

  it('replaces existing assets in fresh mode and keeps them when reusing artifacts', () => {
    const names = assetNames('1.4.7');
    expect(assetsToReplace(names, names, false)).toEqual(names);
    expect(
      assetsToReplace(['Sub2API-Multi-Hub-Monitor-1.4.7-mac-arm64.dmg'], names, false),
    ).toEqual(['Sub2API-Multi-Hub-Monitor-1.4.7-mac-arm64.dmg']);
    expect(assetsToReplace(names, names, true)).toEqual([]);
    expect(assetsToReplace([], names, false)).toEqual([]);
  });
});
