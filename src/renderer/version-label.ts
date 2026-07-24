export function normalizeVersionLabel(version?: string): string {
  const normalized = version?.trim().replace(/^v/i, '');
  return normalized ? `v${normalized}` : '开发版';
}
