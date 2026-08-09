import { describe, expect, it, vi } from 'vitest';
import { fetchSafeSiteMetadata, sanitizeSiteTitle } from './site-metadata.js';

function mockFetch(...responses: Response[]): typeof fetch {
  const fetcher = vi.fn(async () => {
    const response = responses.shift();
    if (!response) throw new Error('unexpected fetch');
    return response;
  });
  return fetcher as unknown as typeof fetch;
}

describe('fetchSafeSiteMetadata', () => {
  it('reads a same-origin title and icon', async () => {
    const fetcher = mockFetch(
      new Response('<title> Demo &amp; Relay </title><link rel="icon" href="/brand.png">', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'image/png' },
      }),
    );

    await expect(fetchSafeSiteMetadata('https://relay.example', fetcher)).resolves.toEqual({
      name: 'Demo & Relay',
      iconDataUrl: 'data:image/png;base64,AQID',
    });
  });

  it('does not follow cross-origin page redirects', async () => {
    const fetcher = mockFetch(
      new Response(null, { status: 302, headers: { location: 'https://attacker.example/' } }),
    );

    await expect(fetchSafeSiteMetadata('https://relay.example', fetcher)).resolves.toEqual({
      name: 'relay.example',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('falls back when declared HTML is oversized or has the wrong MIME type', async () => {
    const oversized = mockFetch(
      new Response('<title>Ignored</title>', {
        headers: { 'content-type': 'text/html', 'content-length': String(256 * 1024 + 1) },
      }),
    );
    const wrongType = mockFetch(
      new Response('<title>Ignored</title>', { headers: { 'content-type': 'application/json' } }),
    );

    await expect(fetchSafeSiteMetadata('https://relay.example', oversized)).resolves.toEqual({
      name: 'relay.example',
    });
    await expect(fetchSafeSiteMetadata('https://relay.example', wrongType)).resolves.toEqual({
      name: 'relay.example',
    });
  });

  it('keeps the title but drops an oversized or non-image icon', async () => {
    const fetcher = mockFetch(
      new Response('<title>Relay</title>', { headers: { 'content-type': 'text/html' } }),
      new Response('not an image', { headers: { 'content-type': 'text/plain' } }),
    );

    await expect(fetchSafeSiteMetadata('https://relay.example', fetcher)).resolves.toEqual({
      name: 'Relay',
    });
  });

  it('falls back to the same-origin favicon.ico and drops cross-origin candidates', async () => {
    const fetcher = mockFetch(
      new Response('<title>Relay</title><link rel="icon" href="https://cdn.example/favicon.png">', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
      new Response(new Uint8Array([9]), {
        headers: { 'content-type': 'image/x-icon' },
      }),
    );

    await expect(fetchSafeSiteMetadata('https://relay.example', fetcher)).resolves.toEqual({
      name: 'Relay',
      iconDataUrl: 'data:image/x-icon;base64,CQ==',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const calls = (fetcher as unknown as { mock: { calls: Array<Array<unknown>> } }).mock.calls;
    expect(String(calls[1]?.[0])).toBe('https://relay.example/favicon.ico');
  });
});

describe('sanitizeSiteTitle', () => {
  it('removes markup, decodes common entities, normalizes whitespace, and limits length', () => {
    const title = `  <b>Relay</b>&nbsp;&amp; ${'x'.repeat(150)}  `;
    const result = sanitizeSiteTitle(title);

    expect(result).toHaveLength(120);
    expect(result).toMatch(/^Relay & x+/);
  });
});
