import { ExportBgMode, PngScale } from '../settings';

export const MAX_CANVAS_EDGE = 8192;

const INLINE_STYLE_PROPS: readonly string[] = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'opacity',
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'text-anchor',
  'dominant-baseline',
  'text-align',
  'background-color',
  'border-color',
  'border-width',
  'border-style',
  'border-radius',
];

// Properties where "none" is semantically critical in SVG (default fill is black!).
const PRESERVE_NONE_PROPS = new Set(['fill', 'stroke']);
const DARK_INK = '#1e293b';
const WHITE_PAPER = '#ffffff';
const NONE_VALUE = 'none';

function applyDynamicStyle(el: HTMLElement | SVGElement, prop: string, value: string): void {
  const withHelper = el as HTMLElement & { setCssProps?: (props: Record<string, string>) => void };
  if (typeof withHelper.setCssProps === 'function') {
    withHelper.setCssProps({ [prop]: value });
  } else {
    el.style.setProperty(prop, value);
  }
}

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface DiagramDimensions {
  width: number;
  height: number;
  minX: number;
  minY: number;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseRgbColor(cssColor: string | null | undefined): RgbaColor | null {
  if (!cssColor) return null;
  const s = cssColor.trim().toLowerCase();
  if (!s || s === 'none' || s === 'transparent') return null;

  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgb = s.match(/^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (!rgb) return null;
  let a = 1;
  if (rgb[4] !== undefined) {
    a = rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
  }
  return {
    r: Math.max(0, Math.min(255, Number(rgb[1]))),
    g: Math.max(0, Math.min(255, Number(rgb[2]))),
    b: Math.max(0, Math.min(255, Number(rgb[3]))),
    a: Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 1,
  };
}

export function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (v: number): number => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(c1: RgbaColor, c2: RgbaColor): number {
  const l1 = relativeLuminance(c1.r, c1.g, c1.b);
  const l2 = relativeLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Darken a pale dark-mode color while preserving its hue so it reaches high contrast
 * against pure white paper (#ffffff).
 */
export function darkenColorForWhiteBg(cssColor: string, maxLuminance = 0.17): string {
  const parsed = parseRgbColor(cssColor);
  if (!parsed || parsed.a < 0.05) return cssColor;
  const lum = relativeLuminance(parsed.r, parsed.g, parsed.b);
  if (lum <= maxLuminance) return cssColor;

  // Binary search a scale factor toward dark slate preserving hue proportions.
  let lo = 0.1;
  let hi = 1.0;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const testLum = relativeLuminance(parsed.r * mid, parsed.g * mid, parsed.b * mid);
    if (testLum > maxLuminance) hi = mid;
    else lo = mid;
  }
  const r = Math.round(parsed.r * lo);
  const g = Math.round(parsed.g * lo);
  const b = Math.round(parsed.b * lo);
  return parsed.a < 0.999 ? `rgba(${r}, ${g}, ${b}, ${parsed.a})` : `rgb(${r}, ${g}, ${b})`;
}

export function isDarkThemeDocument(doc: Document): boolean {
  if (doc.body?.classList?.contains('theme-dark')) return true;
  if (doc.body?.classList?.contains('theme-light')) return false;
  const win = doc.defaultView || window;
  const bg = parseRgbColor(win.getComputedStyle(doc.body).backgroundColor);
  return Boolean(bg && bg.a > 0.5 && relativeLuminance(bg.r, bg.g, bg.b) < 0.3);
}

function isOpaqueDarkColor(cssColor: string | null | undefined): boolean {
  const parsed = parseRgbColor(cssColor);
  return Boolean(parsed && parsed.a > 0.45 && relativeLuminance(parsed.r, parsed.g, parsed.b) < 0.32);
}

function isLabelMaskElement(el: Element): boolean {
  return Boolean(
    el.matches?.('.edgeLabel, .labelBkg, .relationshipLabelBox')
    || el.closest?.('.edgeLabel, .labelBkg'),
  );
}

/**
 * Determine whether a text/foreignObject node visually sits on top of a dark-filled node shape
 * (in which case light text should be preserved) vs bare on the diagram canvas (in which case
 * light text must become dark ink on white paper).
 */
function hasDarkShapeBackdrop(el: Element, win: Window): boolean {
  if (isLabelMaskElement(el)) return false;

  // Check ancestor HTML boxes inside foreignObject
  let cur: Element | null = el;
  while (cur && cur.tagName.toLowerCase() !== 'svg') {
    if (isLabelMaskElement(cur)) return false;
    const cs = win.getComputedStyle(cur);
    if (isOpaqueDarkColor(cs.backgroundColor)) return true;
    cur = cur.parentElement;
  }

  // Check nearest SVG node/actor/cluster container for a dark-filled shape sibling
  const group = el.closest('g.node, g.actor, g.classGroup, g.statediagram-state, g.entity, g[id]');
  if (group && !group.matches('.edgeLabel, .edgeLabels, .edgePath, .edgePaths')) {
    const shapes = group.querySelectorAll(':scope > rect, :scope > polygon, :scope > circle, :scope > ellipse, :scope > path, :scope > g > rect, :scope > g > polygon');
    for (const shape of Array.from(shapes)) {
      if (shape.matches('.relationshipLabelBox, .labelBkg')) continue;
      const scs = win.getComputedStyle(shape);
      if (isOpaqueDarkColor(scs.fill)) return true;
    }
  }
  return false;
}

/**
 * Adapt a cloned dark-mode Mermaid SVG so bare canvas labels, edge labels, and pale lines
 * remain crisp (WCAG AA/AAA) when displayed or exported on a pure white background.
 */
export function adaptSvgForWhiteBackground(
  sourceSvg: SVGSVGElement,
  targetSvg: SVGSVGElement,
  win: Window,
): void {
  const srcList = [sourceSvg, ...Array.from(sourceSvg.querySelectorAll('*'))];
  const dstList = [targetSvg, ...Array.from(targetSvg.querySelectorAll('*'))];
  const count = Math.min(srcList.length, dstList.length);

  for (let i = 0; i < count; i++) {
    const src = srcList[i];
    const dst = dstList[i] as HTMLElement | SVGElement;
    if (!dst || !dst.style) continue;

    const tag = src.tagName.toLowerCase();
    const cs = win.getComputedStyle(src);

    // 1. Label mask backgrounds (.edgeLabel / .labelBkg / .relationshipLabelBox)
    if (src.matches('.relationshipLabelBox')) {
      if (isOpaqueDarkColor(cs.fill)) {
        applyDynamicStyle(dst, 'fill', WHITE_PAPER);
      }
      continue;
    }
    if (src.matches('.edgeLabel, .labelBkg') || src.closest('.edgeLabel, .labelBkg')) {
      if (isOpaqueDarkColor(cs.backgroundColor)) {
        applyDynamicStyle(dst, 'background-color', WHITE_PAPER);
      }
      if (isOpaqueDarkColor(cs.fill) && tag === 'rect') {
        applyDynamicStyle(dst, 'fill', WHITE_PAPER);
      }
    }

    // 2. SVG text / tspan & HTML labels inside foreignObject
    if (tag === 'text' || tag === 'tspan') {
      const fill = parseRgbColor(cs.fill);
      if (fill && relativeLuminance(fill.r, fill.g, fill.b) > 0.3 && !hasDarkShapeBackdrop(src, win)) {
        dst.style.setProperty('fill', DARK_INK);
      }
      continue;
    }

    if (src.closest('foreignObject') && tag !== 'foreignobject') {
      const color = parseRgbColor(cs.color);
      if (color && relativeLuminance(color.r, color.g, color.b) > 0.3 && !hasDarkShapeBackdrop(src, win)) {
        dst.style.setProperty('color', DARK_INK);
      }
      continue;
    }

    // 3. Markers (arrowheads)
    if (src.closest('marker')) {
      const mFill = parseRgbColor(cs.fill);
      if (mFill && relativeLuminance(mFill.r, mFill.g, mFill.b) > 0.35) {
        dst.style.setProperty('fill', darkenColorForWhiteBg(cs.fill, 0.17));
      }
      const mStroke = parseRgbColor(cs.stroke);
      if (mStroke && relativeLuminance(mStroke.r, mStroke.g, mStroke.b) > 0.35) {
        dst.style.setProperty('stroke', darkenColorForWhiteBg(cs.stroke, 0.17));
      }
      continue;
    }

    // 4. Connectors, edges, lifelines, borders
    if (tag === 'path' || tag === 'line' || tag === 'polyline' || tag === 'polygon' || tag === 'rect') {
      const stroke = parseRgbColor(cs.stroke);
      if (stroke && relativeLuminance(stroke.r, stroke.g, stroke.b) > 0.36) {
        dst.style.setProperty('stroke', darkenColorForWhiteBg(cs.stroke, 0.17));
      }
    }
  }
}

/**
 * Clone a Mermaid SVG while rewriting its root ID and internal <style>/url(#...) references
 * so Mermaid's `#mermaid-xxx` scoped CSS rules keep matching without duplicate DOM IDs.
 */
export function cloneSvgWithScopedId(sourceSvg: SVGSVGElement, suffix: string): SVGSVGElement {
  const clone = sourceSvg.cloneNode(true) as SVGSVGElement;
  const oldId = sourceSvg.getAttribute('id');
  const idMap = new Map<string, string>();

  if (oldId) {
    const newId = `${oldId}-${suffix}`;
    clone.setAttribute('id', newId);
    idMap.set(oldId, newId);
  }

  for (const el of Array.from(clone.querySelectorAll('[id]'))) {
    const orig = el.getAttribute('id');
    if (!orig) continue;
    const mapped = `${orig}-${suffix}`;
    el.setAttribute('id', mapped);
    idMap.set(orig, mapped);
  }

  if (idMap.size > 0) {
    for (const styleEl of Array.from(clone.querySelectorAll('style'))) {
      let cssText = styleEl.textContent || '';
      if (oldId) {
        const re = new RegExp(`#${escapeRegExp(oldId)}(?![\\w-])`, 'g');
        cssText = cssText.replace(re, `#${idMap.get(oldId)}`);
      }
      styleEl.textContent = cssText;
    }

    const refAttrs = ['marker-start', 'marker-mid', 'marker-end', 'clip-path', 'mask', 'filter', 'fill', 'stroke', 'href', 'xlink:href'];
    for (const el of Array.from(clone.querySelectorAll('*'))) {
      for (const attr of refAttrs) {
        const val = el.getAttribute(attr);
        if (!val) continue;
        if (attr === 'href' || attr === 'xlink:href') {
          if (val.startsWith('#')) {
            const mapped = idMap.get(val.slice(1));
            if (mapped) el.setAttribute(attr, `#${mapped}`);
          }
        } else if (val.includes('url(#')) {
          const next = val.replace(/url\(#([^)]+)\)/g, (full: string, refId: string) => {
            const mapped = idMap.get(refId);
            return mapped ? `url(#${mapped})` : full;
          });
          if (next !== val) el.setAttribute(attr, next);
        }
      }
    }
  }

  return clone;
}

export function measureSvgDimensions(svg: SVGSVGElement): DiagramDimensions {
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) {
    return {
      width: Math.ceil(vb.width),
      height: Math.ceil(vb.height),
      minX: vb.x,
      minY: vb.y,
    };
  }
  try {
    const box = svg.getBBox();
    if (box.width > 0 && box.height > 0) {
      return {
        width: Math.ceil(box.width),
        height: Math.ceil(box.height),
        minX: box.x,
        minY: box.y,
      };
    }
  } catch {
    // Fallback to client rect
  }
  const rect = svg.getBoundingClientRect();
  return {
    width: Math.max(100, Math.ceil(rect.width || Number(svg.getAttribute('width')) || 640)),
    height: Math.max(80, Math.ceil(rect.height || Number(svg.getAttribute('height')) || 360)),
    minX: 0,
    minY: 0,
  };
}

export function computeSafeExportScale(
  width: number,
  height: number,
  requestedScale: number,
  maxEdge = MAX_CANVAS_EDGE,
): { scale: number; clamped: boolean } {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const maxByW = maxEdge / safeW;
  const maxByH = maxEdge / safeH;
  const ceiling = Math.min(maxByW, maxByH);
  if (requestedScale <= ceiling) {
    return { scale: requestedScale, clamped: false };
  }
  return { scale: Math.max(0.5, Math.floor(ceiling * 100) / 100), clamped: true };
}

export function resolveExportBackground(doc: Document, bgMode: ExportBgMode): string | null {
  if (bgMode === 'transparent') return null;
  if (bgMode === 'white') return '#ffffff';
  const win = doc.defaultView || window;
  const cs = win.getComputedStyle(doc.body);
  const qsBg = cs.getPropertyValue('--qs-bg-paper').trim();
  const obsBg = cs.getPropertyValue('--background-primary').trim();
  const bodyBg = cs.backgroundColor;
  return qsBg || obsBg || (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' ? bodyBg : '#ffffff');
}

function inlineComputedStyles(sourceRoot: Element, cloneRoot: Element, win: Window): void {
  const srcList = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll('*'))];
  const dstList = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll('*'))];
  const count = Math.min(srcList.length, dstList.length);
  for (let i = 0; i < count; i++) {
    const src = srcList[i];
    const dst = dstList[i] as HTMLElement | SVGElement;
    if (!dst || !dst.style) continue;
    dst.classList.remove('qs-wb-node-dim', 'qs-wb-node-match', 'qs-wb-node-current');
    const cs = win.getComputedStyle(src);
    for (const prop of INLINE_STYLE_PROPS) {
      const val = cs.getPropertyValue(prop);
      if (!val || val === 'normal' || val === 'auto') continue;
      if (val === 'none' && !PRESERVE_NONE_PROPS.has(prop)) continue;
      dst.style.setProperty(prop, val);
    }
  }
}

export function buildStandaloneSvgString(
  sourceSvg: SVGSVGElement,
  bgMode: ExportBgMode,
  padding = 24,
): { svgString: string; width: number; height: number } {
  const doc = sourceSvg.ownerDocument;
  const win = doc.defaultView || window;
  const dims = measureSvgDimensions(sourceSvg);
  const totalW = dims.width + padding * 2;
  const totalH = dims.height + padding * 2;

  const clone = sourceSvg.cloneNode(true) as SVGSVGElement;
  inlineComputedStyles(sourceSvg, clone, win);
  if (bgMode === 'white' && isDarkThemeDocument(doc)) {
    adaptSvgForWhiteBackground(sourceSvg, clone, win);
  }

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width', String(totalW));
  clone.setAttribute('height', String(totalH));
  clone.setAttribute(
    'viewBox',
    `${dims.minX - padding} ${dims.minY - padding} ${totalW} ${totalH}`,
  );
  applyDynamicStyle(clone, 'max-width', NONE_VALUE);
  applyDynamicStyle(clone, 'max-height', NONE_VALUE);

  const bgColor = resolveExportBackground(doc, bgMode);
  if (bgColor) {
    const bgRect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', String(dims.minX - padding));
    bgRect.setAttribute('y', String(dims.minY - padding));
    bgRect.setAttribute('width', String(totalW));
    bgRect.setAttribute('height', String(totalH));
    bgRect.setAttribute('fill', bgColor);
    clone.insertBefore(bgRect, clone.firstChild);
  }

  const serializer = new XMLSerializer();
  let serialized = serializer.serializeToString(clone);
  if (!serialized.startsWith('<?xml')) {
    serialized = `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;
  }
  return { svgString: serialized, width: totalW, height: totalH };
}

export async function renderSvgToPngBlob(
  sourceSvg: SVGSVGElement,
  bgMode: ExportBgMode,
  requestedScale: PngScale,
): Promise<{ blob: Blob; scale: number; clamped: boolean }> {
  const doc = sourceSvg.ownerDocument;
  const { svgString, width, height } = buildStandaloneSvgString(sourceSvg, bgMode);
  const { scale, clamped } = computeSafeExportScale(width, height, requestedScale);

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode SVG for PNG rendering'));
    image.src = dataUrl;
  });

  const canvas = doc.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const bgColor = resolveExportBackground(doc, bgMode);
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => {
      if (result) resolve(result);
      else reject(new Error('Canvas toBlob returned null'));
    }, 'image/png');
  });
  return { blob, scale, clamped };
}

export function triggerBlobDownload(doc: Document, blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = filename;
  a.className = 'qs-wb-hidden-download';
  doc.body.appendChild(a);
  a.click();
  a.remove();
  const win = doc.defaultView || window;
  win.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyPngBlobToClipboard(win: Window, blob: Blob): Promise<boolean> {
  try {
    const ClipboardItemCtor = (win as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
      || window.ClipboardItem;
    const clipboard = win.navigator?.clipboard || window.navigator?.clipboard;
    if (!ClipboardItemCtor || !clipboard || typeof clipboard.write !== 'function') {
      return false;
    }
    await clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
