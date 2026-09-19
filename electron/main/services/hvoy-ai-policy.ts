const allowedOrigins = new Set(['https://hvoyai.com', 'https://www.hvoyai.com']);

export function isAllowedHvoyAiNavigation(value: string): boolean {
  try {
    const url = new URL(value);
    return url.username === '' && url.password === '' && allowedOrigins.has(url.origin);
  } catch {
    return false;
  }
}
