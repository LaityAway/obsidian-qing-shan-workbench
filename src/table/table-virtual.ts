export interface VirtualRange {
  start: number;
  end: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
}

export const VIRTUAL_ROW_HEIGHT = 34;
export const VIRTUAL_OVERSCAN = 8;

export function computeVirtualRange(
  totalRows: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight = VIRTUAL_ROW_HEIGHT,
  overscan = VIRTUAL_OVERSCAN,
): VirtualRange {
  if (totalRows <= 0) {
    return { start: 0, end: 0, topSpacerHeight: 0, bottomSpacerHeight: 0 };
  }
  const safeRowH = Math.max(16, rowHeight);
  const safeVpH = Math.max(safeRowH, viewportHeight);
  const firstVisible = Math.floor(Math.max(0, scrollTop) / safeRowH);
  const visibleCount = Math.ceil(safeVpH / safeRowH);
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(totalRows, firstVisible + visibleCount + overscan);
  return {
    start,
    end,
    topSpacerHeight: start * safeRowH,
    bottomSpacerHeight: Math.max(0, (totalRows - end) * safeRowH),
  };
}
