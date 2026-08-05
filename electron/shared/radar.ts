export const RADAR_TARGETS = {
  codex: { label: 'Codex 雷达', url: 'https://codexradar.com/' },
  distributed: { label: '分布式雷达 Codex 站', url: 'https://deng.codexradar.com/' },
} as const;

export const RADAR_TARGET_IDS = ['codex', 'distributed'] as const;

export type RadarTargetId = (typeof RADAR_TARGET_IDS)[number];

export type RadarEmbedState =
  | { status: 'idle' }
  | { status: 'opening'; target: RadarTargetId }
  | { status: 'open'; target: RadarTargetId }
  | { status: 'error'; target: RadarTargetId; message: string };

const RADAR_ORIGINS = new Set(Object.values(RADAR_TARGETS).map(({ url }) => new URL(url).origin));

export function radarUrlForTarget(value: unknown): string | undefined {
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(RADAR_TARGETS, value))
    return undefined;
  return RADAR_TARGETS[value as RadarTargetId].url;
}

export function isAllowedRadarNavigation(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      RADAR_ORIGINS.has(url.origin)
    );
  } catch {
    return false;
  }
}

export type RadarContentSize = { width: number; height: number };

export const RADAR_VIEW_LEFT = 284;
export const RADAR_VIEW_TOP = 80;

export function radarViewBounds(size: RadarContentSize) {
  return {
    x: RADAR_VIEW_LEFT,
    y: RADAR_VIEW_TOP,
    width: Math.max(0, Math.round(size.width) - RADAR_VIEW_LEFT),
    height: Math.max(0, Math.round(size.height) - RADAR_VIEW_TOP),
  };
}
