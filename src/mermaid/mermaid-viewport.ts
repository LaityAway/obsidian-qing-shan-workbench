export interface ViewportState {
  x: number;
  y: number;
  scale: number;
}

export interface ViewportBounds {
  stageWidth: number;
  stageHeight: number;
  contentWidth: number;
  contentHeight: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8.0;

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
}

export function clampPan(state: ViewportState, bounds: ViewportBounds, margin = 48): ViewportState {
  const sw = Math.max(1, bounds.stageWidth);
  const sh = Math.max(1, bounds.stageHeight);
  const cw = Math.max(1, bounds.contentWidth) * state.scale;
  const ch = Math.max(1, bounds.contentHeight) * state.scale;

  const minX = Math.min(margin - cw, sw - cw - margin);
  const maxX = Math.max(sw - margin, margin);
  const minY = Math.min(margin - ch, sh - ch - margin);
  const maxY = Math.max(sh - margin, margin);

  return {
    scale: state.scale,
    x: Math.max(minX, Math.min(maxX, state.x)),
    y: Math.max(minY, Math.min(maxY, state.y)),
  };
}

export function computeFitViewport(bounds: ViewportBounds, padding = 32): ViewportState {
  const sw = Math.max(1, bounds.stageWidth);
  const sh = Math.max(1, bounds.stageHeight);
  const cw = Math.max(1, bounds.contentWidth);
  const ch = Math.max(1, bounds.contentHeight);
  const availW = Math.max(40, sw - padding * 2);
  const availH = Math.max(40, sh - padding * 2);
  const scale = clampZoom(Math.min(availW / cw, availH / ch, 2.0));
  return {
    scale,
    x: (sw - cw * scale) / 2,
    y: (sh - ch * scale) / 2,
  };
}

export function computeFitWidthViewport(bounds: ViewportBounds, padding = 24): ViewportState {
  const sw = Math.max(1, bounds.stageWidth);
  const cw = Math.max(1, bounds.contentWidth);
  const availW = Math.max(40, sw - padding * 2);
  const scale = clampZoom(availW / cw);
  return {
    scale,
    x: (sw - cw * scale) / 2,
    y: padding,
  };
}

export function zoomAtPoint(
  state: ViewportState,
  factor: number,
  anchorX: number,
  anchorY: number,
  bounds?: ViewportBounds,
): ViewportState {
  const nextScale = clampZoom(state.scale * factor);
  const ratio = nextScale / state.scale;
  const next: ViewportState = {
    scale: nextScale,
    x: anchorX - (anchorX - state.x) * ratio,
    y: anchorY - (anchorY - state.y) * ratio,
  };
  return bounds ? clampPan(next, bounds) : next;
}

export function centerOnContentPoint(
  contentX: number,
  contentY: number,
  bounds: ViewportBounds,
  targetScale: number,
): ViewportState {
  const scale = clampZoom(targetScale);
  const next: ViewportState = {
    scale,
    x: bounds.stageWidth / 2 - contentX * scale,
    y: bounds.stageHeight / 2 - contentY * scale,
  };
  return clampPan(next, bounds);
}

export interface MinimapRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function computeMinimapViewportRect(
  state: ViewportState,
  bounds: ViewportBounds,
  mapWidth: number,
  mapHeight: number,
): MinimapRect {
  const cw = Math.max(1, bounds.contentWidth);
  const ch = Math.max(1, bounds.contentHeight);
  const mw = Math.max(1, mapWidth);
  const mh = Math.max(1, mapHeight);
  const rawLeft = (-state.x / state.scale / cw) * mw;
  const rawTop = (-state.y / state.scale / ch) * mh;
  const rawWidth = (bounds.stageWidth / state.scale / cw) * mw;
  const rawHeight = (bounds.stageHeight / state.scale / ch) * mh;

  const width = Math.max(12, Math.min(mw, rawWidth));
  const height = Math.max(10, Math.min(mh, rawHeight));
  const left = Math.max(0, Math.min(mw - width, rawLeft));
  const top = Math.max(0, Math.min(mh - height, rawTop));
  return { left, top, width, height };
}
