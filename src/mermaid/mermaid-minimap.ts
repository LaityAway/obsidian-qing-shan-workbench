import { computeMinimapViewportRect, ViewportBounds, ViewportState } from './mermaid-viewport';
import { cloneSvgWithScopedId } from './mermaid-export';
import { t } from '../i18n';

export interface MinimapController {
  element: HTMLElement;
  sync(state: ViewportState, bounds: ViewportBounds): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

export function createMermaidMinimap(
  doc: Document,
  sourceSvg: SVGSVGElement,
  onNavigate: (ratioX: number, ratioY: number) => void,
): MinimapController {
  const wrap = doc.createElement('div');
  wrap.className = 'qs-wb-minimap';
  wrap.title = t('点击或拖拽小地图快速漫游', 'Click or drag minimap to pan');

  const label = doc.createElement('span');
  label.className = 'qs-wb-minimap-label';
  label.textContent = 'Minimap';
  wrap.appendChild(label);

  const previewSvg = cloneSvgWithScopedId(sourceSvg, 'qs-mini');
  previewSvg.removeAttribute('width');
  previewSvg.removeAttribute('height');
  previewSvg.classList.add('qs-wb-minimap-svg');
  previewSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  previewSvg.setAttribute('aria-hidden', 'true');
  wrap.appendChild(previewSvg);

  const vpBox = doc.createElement('div');
  vpBox.className = 'qs-wb-minimap-vp';
  wrap.appendChild(vpBox);

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
    destroy(): void {
      wrap.removeEventListener('pointerdown', onDown);
      win.removeEventListener('pointermove', onMove);
      win.removeEventListener('pointerup', onUp);
      wrap.remove();
    },
  };
}
