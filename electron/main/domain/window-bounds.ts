export type FloatingCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type WorkArea = { x: number; y: number; width: number; height: number };
type FloatingPlacement =
  { position: FloatingCorner } | { position: 'custom'; x: number; y: number };

export interface FloatingWindowPolicy {
  alwaysOnTop: false;
  visibleOnAllWorkspaces: boolean;
  visibleOnFullScreen: boolean;
  activateOnShow: false;
}

export function floatingWindowPolicy(platform: NodeJS.Platform): FloatingWindowPolicy {
  const isMac = platform === 'darwin';
  return {
    alwaysOnTop: false,
    visibleOnAllWorkspaces: isMac,
    visibleOnFullScreen: false,
    activateOnShow: false,
  };
}

export function floatingCornerBounds(
  position: FloatingCorner,
  workArea: WorkArea,
): { x: number; y: number; width: number; height: number } {
  const width = 380;
  const height = 260;
  const margin = 12;
  return {
    width,
    height,
    x: position.endsWith('right')
      ? workArea.x + workArea.width - width - margin
      : workArea.x + margin,
    y: position.startsWith('bottom')
      ? workArea.y + workArea.height - height - margin
      : workArea.y + margin,
  };
}

export function resolveFloatingBounds(
  placement: FloatingPlacement,
  workAreas: WorkArea[],
  fallbackArea: WorkArea,
): { x: number; y: number; width: number; height: number } {
  if (placement.position !== 'custom')
    return floatingCornerBounds(placement.position, fallbackArea);
  const requested = { x: placement.x, y: placement.y, width: 380, height: 260 };
  const target = workAreas
    .map((area) => ({ area, overlap: intersectionArea(requested, area) }))
    .sort((a, b) => b.overlap - a.overlap)[0];
  if (!target || target.overlap <= 0) return floatingCornerBounds('top-right', fallbackArea);
  return {
    width: requested.width,
    height: requested.height,
    x: clamp(requested.x, target.area.x, target.area.x + target.area.width - requested.width),
    y: clamp(requested.y, target.area.y, target.area.y + target.area.height - requested.height),
  };
}

function intersectionArea(a: WorkArea, b: WorkArea): number {
  return (
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}
