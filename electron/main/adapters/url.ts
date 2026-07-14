const knownSuffixes = ['/api/v1/auth/login', '/api/v1'];

export function normalizeSiteUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('INVALID_URL');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('INVALID_URL');
  }
  const suffix = knownSuffixes.find((candidate) =>
    url.pathname.replace(/\/+$/, '').endsWith(candidate),
  );
  const apiPrefix = '/api/v1';
  if (suffix) url.pathname = url.pathname.slice(0, -suffix.length);
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  const baseUrl = url.toString().replace(/\/$/, '');
  return { baseUrl, apiPrefix, apiBaseUrl: `${baseUrl}${apiPrefix}` };
}
