const HTML_LIMIT_BYTES = 256 * 1024;
const ICON_LIMIT_BYTES = 128 * 1024;
const MAX_REDIRECTS = 3;

export interface SafeSiteMetadata {
  name: string;
  iconDataUrl?: string;
}

export async function fetchSafeSiteMetadata(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<SafeSiteMetadata> {
  const root = new URL(baseUrl);
  const fallbackName = root.hostname;
  try {
    const page = await fetchSameOrigin(root, root, fetcher, 'text/html', HTML_LIMIT_BYTES);
    const html = new TextDecoder().decode(page.bytes);
    const name = sanitizeSiteTitle(readTagText(html, 'title')) || fallbackName;
    const iconUrl = new URL(readIconHref(html) || '/favicon.ico', page.url);
    if (iconUrl.origin !== root.origin) return { name };
    try {
      const icon = await fetchSameOrigin(root, iconUrl, fetcher, 'image/', ICON_LIMIT_BYTES);
      return {
        name,
        iconDataUrl: `data:${icon.contentType};base64,${Buffer.from(icon.bytes).toString('base64')}`,
      };
    } catch {
      return { name };
    }
  } catch {
    return { name: fallbackName };
  }
}

export function sanitizeSiteTitle(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const decoded = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return decoded ? decoded.slice(0, 120) : undefined;
}

function readTagText(html: string, tag: string): string | undefined {
  return new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(html)?.[1];
}

function readIconHref(html: string): string | undefined {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = readAttribute(tag, 'rel')?.toLowerCase().split(/\s+/) ?? [];
    if (!rel.includes('icon')) continue;
    const href = readAttribute(tag, 'href');
    if (href) return href;
  }
  return undefined;
}

function readAttribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

async function fetchSameOrigin(
  root: URL,
  initialUrl: URL,
  fetcher: typeof fetch,
  acceptedType: string,
  limit: number,
): Promise<{ url: URL; contentType: string; bytes: Uint8Array }> {
  let url = initialUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (url.origin !== root.origin) throw new Error('SITE_METADATA_CROSS_ORIGIN');
    const response = await fetcher(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { accept: acceptedType === 'image/' ? 'image/*' : 'text/html' },
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirects === MAX_REDIRECTS) throw new Error('SITE_METADATA_REDIRECT');
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new Error('SITE_METADATA_HTTP');
    const contentType =
      response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!contentType.startsWith(acceptedType)) throw new Error('SITE_METADATA_TYPE');
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > limit)
      throw new Error('SITE_METADATA_SIZE');
    return { url, contentType, bytes: await readLimitedBody(response, limit) };
  }
  throw new Error('SITE_METADATA_REDIRECT');
}

async function readLimitedBody(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error('SITE_METADATA_SIZE');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
