export type FloatingCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface FloatingWindowPolicy {
  alwaysOnTop: false;
  visibleOnAllWorkspaces: boolean;
  visibleOnFullScreen: boolean;
}

export function floatingWindowPolicy(platform: NodeJS.Platform): FloatingWindowPolicy {
  const isMac = platform === 'darwin';
  return {
    alwaysOnTop: false,
    visibleOnAllWorkspaces: isMac,
    visibleOnFullScreen: false,
  };
}

export function floatingCornerBounds(
  position: FloatingCorner,
  workArea: { x: number; y: number; width: number; height: number },
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
