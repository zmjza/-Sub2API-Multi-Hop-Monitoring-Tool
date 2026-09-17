import { describe, expect, it } from 'vitest';
import {
  chromeLaunchArgsForUrl,
  decideEmbeddedWindowOpen,
  isSafeExternalHttpUrl,
  purchaseUrlFromBase,
} from './external-url.js';

describe('purchaseUrlFromBase', () => {
  it('opens origin plus a single /purchase path', () => {
    expect(purchaseUrlFromBase('https://mdkj.lol')).toEqual({
      ok: true,
      url: 'https://mdkj.lol/purchase',
    });
    expect(purchaseUrlFromBase('https://mdkj.lol/')).toEqual({
      ok: true,
      url: 'https://mdkj.lol/purchase',
    });
    expect(purchaseUrlFromBase('https://mdkj.lol/purchase')).toEqual({
      ok: true,
      url: 'https://mdkj.lol/purchase',
    });
    expect(purchaseUrlFromBase('https://mdkj.lol/purchase/')).toEqual({
      ok: true,
      url: 'https://mdkj.lol/purchase',
    });
  });

  it('rejects credentials, query, hash and unsafe protocols', () => {
    expect(purchaseUrlFromBase('https://user:pass@mdkj.lol').ok).toBe(false);
    expect(purchaseUrlFromBase('javascript:alert(1)').ok).toBe(false);
    expect(purchaseUrlFromBase('file:///tmp').ok).toBe(false);
    expect(purchaseUrlFromBase('https://mdkj.lol/path?x=1').ok).toBe(true);
    expect(purchaseUrlFromBase('https://mdkj.lol/path?x=1')).toEqual({
      ok: true,
      url: 'https://mdkj.lol/purchase',
    });
  });
});

describe('decideEmbeddedWindowOpen', () => {
  it('opens safe user-gesture http(s) in the system browser and still denies Electron windows', () => {
    expect(
      decideEmbeddedWindowOpen({ url: 'https://example.com/docs', disposition: 'new-window' }),
    ).toEqual({ action: 'deny', openExternal: 'https://example.com/docs' });
    expect(
      decideEmbeddedWindowOpen({ url: 'http://127.0.0.1:10100', disposition: 'foreground-tab' }),
    ).toEqual({ action: 'deny', openExternal: 'http://127.0.0.1:10100' });
  });

  it('rejects dangerous protocols, credentials and non-user-gesture popups', () => {
    expect(
      decideEmbeddedWindowOpen({ url: 'javascript:alert(1)', disposition: 'new-window' })
        .openExternal,
    ).toBeUndefined();
    expect(
      decideEmbeddedWindowOpen({ url: 'https://a:b@evil.test', disposition: 'new-window' }).error,
    ).toBeTruthy();
    expect(
      decideEmbeddedWindowOpen({ url: 'https://example.com', disposition: 'other' }).openExternal,
    ).toBeUndefined();
  });
});

describe('chromeLaunchArgsForUrl', () => {
  it('never enables remote debugging', () => {
    const args = chromeLaunchArgsForUrl('https://mdkj.lol/purchase');
    expect(args).toEqual(['--new-window', 'https://mdkj.lol/purchase']);
    expect(args.join(' ')).not.toContain('remote-debugging');
  });
});

describe('isSafeExternalHttpUrl', () => {
  it('allows http(s) without credentials', () => {
    expect(isSafeExternalHttpUrl('https://ok.test/a')).toBe(true);
    expect(isSafeExternalHttpUrl('http://ok.test')).toBe(true);
    expect(isSafeExternalHttpUrl('https://u:p@ok.test')).toBe(false);
    expect(isSafeExternalHttpUrl('data:text/html,hi')).toBe(false);
  });
});
