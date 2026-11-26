import { computeMinimapViewportRect, ViewportBounds, ViewportState } from './mermaid-viewport';
import { cloneSvgWithScopedId } from './mermaid-export';
import { ExportBgMode } from '../settings';
import { t } from '../i18n';

export interface MinimapController {
  element: HTMLElement;
  sync(state: ViewportState, bounds: ViewportBounds): void;
  setVisible(visible: boolean): void;
  updateSource(nextSvg: SVGSVGElement, bgMode?: ExportBgMode): void;
  destroy(): void;
}

export function createMermaidMinimap(
  doc: Document,
  sourceSvg: SVGSVGElement,
  onNavigate: (ratioX: number, ratioY: number) => void,
  initialBgMode: ExportBgMode = 'theme',
): MinimapController {
  const wrap = doc.createElement('div');
  wrap.className = 'qs-wb-minimap';
  wrap.dataset.bg = initialBgMode;
  wrap.title = t('点击或拖拽小地图快速漫游', 'Click or drag minimap to pan');

  const label = doc.createElement('span');
  label.className = 'qs-wb-minimap-label';
  label.textContent = 'Minimap';
  wrap.appendChild(label);

  const vpBox = doc.createElement('div');
  vpBox.className = 'qs-wb-minimap-vp';
  wrap.appendChild(vpBox);

  let previewSvg: SVGSVGElement | null = null;

  const mountPreviewSvg = (svg: SVGSVGElement): void => {
    previewSvg?.remove();
    const cloned = cloneSvgWithScopedId(svg, 'qs-mini');
    cloned.removeAttribute('width');
    cloned.removeAttribute('height');
    cloned.style.removeProperty('width');
    cloned.style.removeProperty('height');
    cloned.classList.remove('qs-wb-live-svg');
    cloned.classList.add('qs-wb-minimap-svg');
    for (const el of Array.from(cloned.querySelectorAll('.qs-wb-node-dim, .qs-wb-node-match, .qs-wb-node-current'))) {
      el.classList.remove('qs-wb-node-dim', 'qs-wb-node-match', 'qs-wb-node-current');
      const stylable = el as HTMLElement | SVGElement;
      if (stylable.dataset && stylable.dataset.qsWbOrigOpacity !== undefined) {
        const orig = stylable.dataset.qsWbOrigOpacity;
        if (orig) stylable.style.setProperty('opacity', orig);
        else stylable.style.removeProperty('opacity');
        delete stylable.dataset.qsWbOrigOpacity;
      }
    }
    cloned.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    cloned.setAttribute('aria-hidden', 'true');
    wrap.insertBefore(cloned, vpBox);
    previewSvg = cloned;
  };

  mountPreviewSvg(sourceSvg);

  const win = doc.defaultView || window;
  let dragging = false;

  const navigateFromEvent = (evt: PointerEvent): void => {
    const rect = wrap.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const rx = Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width));
    const ry = Math.max(0, Math.min(1, (evt.clientY - rect.top) / rect.height));
    onNavigate(rx, ry);
  };

  const onDown = (evt: PointerEvent): void => {
    evt.preventDefault();
    evt.stopPropagation();
    dragging = true;
    navigateFromEvent(evt);
  };
  const onMove = (evt: PointerEvent): void => {
    if (!dragging) return;
    navigateFromEvent(evt);
  };
  const onUp = (): void => {
    dragging = false;
  };

  wrap.addEventListener('pointerdown', onDown);
  win.addEventListener('pointermove', onMove);
  win.addEventListener('pointerup', onUp);
  win.addEventListener('pointercancel', onUp);
  win.addEventListener('blur', onUp);

  return {
    element: wrap,
    sync(state: ViewportState, bounds: ViewportBounds): void {
      const mw = wrap.clientWidth || 168;
      const mh = wrap.clientHeight || 96;
      const r = computeMinimapViewportRect(state, bounds, mw, mh);
      vpBox.style.left = `${r.left}px`;
      vpBox.style.top = `${r.top}px`;
      vpBox.style.width = `${r.width}px`;
      vpBox.style.height = `${r.height}px`;
    },
    setVisible(visible: boolean): void {
      wrap.classList.toggle('is-hidden', !visible);
    },
    updateSource(nextSvg: SVGSVGElement, bgMode?: ExportBgMode): void {
      if (bgMode) wrap.dataset.bg = bgMode;
      mountPreviewSvg(nextSvg);
    },
    destroy(): void {
      wrap.removeEventListener('pointerdown', onDown);
      win.removeEventListener('pointermove', onMove);
      win.removeEventListener('pointerup', onUp);
      win.removeEventListener('pointercancel', onUp);
      win.removeEventListener('blur', onUp);
      wrap.remove();
    },
  };
}
