export interface SiteLabelLike {
  name?: string;
  note?: string;
}

export function siteDisplayName(site: SiteLabelLike | undefined): string {
  const note = site?.note?.trim();
  return note || site?.name?.trim() || '未选择站点';
}
