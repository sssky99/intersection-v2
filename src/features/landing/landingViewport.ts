export const compactVisualViewportMaxHeight = 360;
export const stableLandingExposureMs = 1000;

export type LandingViewportSnapshot = {
  layoutHeight: number;
  visualHeight: number;
  visualWidth: number;
  offsetTop: number;
  offsetLeft: number;
  scale: number;
};

type ElementRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

export function readLandingViewport(): LandingViewportSnapshot {
  const visualViewport = window.visualViewport;

  return {
    layoutHeight: Math.round(window.innerHeight),
    visualHeight: Math.round(visualViewport?.height ?? window.innerHeight),
    visualWidth: Math.round(visualViewport?.width ?? window.innerWidth),
    offsetTop: Math.round(visualViewport?.offsetTop ?? 0),
    offsetLeft: Math.round(visualViewport?.offsetLeft ?? 0),
    scale: Number((visualViewport?.scale ?? 1).toFixed(3)),
  };
}

export function visualViewportOverlapRatio(
  rect: ElementRect,
  viewport: LandingViewportSnapshot,
) {
  if (rect.width <= 0 || rect.height <= 0) return 0;

  const viewportBottom = viewport.offsetTop + viewport.visualHeight;
  const viewportRight = viewport.offsetLeft + viewport.visualWidth;
  const visibleHeight = Math.max(
    0,
    Math.min(rect.bottom, viewportBottom) -
      Math.max(rect.top, viewport.offsetTop),
  );
  const visibleWidth = Math.max(
    0,
    Math.min(rect.right, viewportRight) -
      Math.max(rect.left, viewport.offsetLeft),
  );

  return Math.min(
    1,
    Number(
      ((visibleHeight * visibleWidth) / (rect.height * rect.width)).toFixed(3),
    ),
  );
}

export function isCompactVisualViewport(height: number | null) {
  return height !== null && height <= compactVisualViewportMaxHeight;
}
