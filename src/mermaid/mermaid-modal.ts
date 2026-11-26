import { Notice } from 'obsidian';
import { ExportBgMode, WorkbenchSettings } from '../settings';
import { t } from '../i18n';
import { createIconButton } from '../ui/icons';
import {
  centerOnContentPoint,
  clampPan,
  computeFitViewport,
  computeFitWidthViewport,
  ViewportBounds,
  ViewportState,
  zoomAtPoint,
} from './mermaid-viewport';
import {
  extractDiagramSearchNodes,
  filterDiagramNodes,
  getNodeCenterInSvg,
  IndexedDiagramNode,
} from './mermaid-search';
import { createMermaidMinimap, MinimapController } from './mermaid-minimap';
import {
  adaptSvgForWhiteBackground,
  buildStandaloneSvgString,
  cloneSvgWithScopedId,
  copyPngBlobToClipboard,
  isDarkThemeDocument,
  measureSvgDimensions,
  renderSvgToPngBlob,
  triggerBlobDownload,
} from './mermaid-export';

export interface MermaidModalHandle {
  close(): void;
}

const BG_ORDER: readonly ExportBgMode[] = ['theme', 'white', 'transparent'];

export function openMermaidLightbox(
  sourceSvg: SVGSVGElement,
  settings: WorkbenchSettings,
  title = 'Mermaid',
  onClose?: () => void,
): MermaidModalHandle {
  const doc = sourceSvg.ownerDocument;
  const win = doc.defaultView || window;
  const prevFocused = doc.activeElement as HTMLElement | null;

  const overlay = doc.createElement('div');
  overlay.className = 'qs-wb-overlay qs-wb-mermaid-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', t('Mermaid 沉浸式灯箱', 'Mermaid lightbox'));
  overlay.tabIndex = -1;

  const modal = doc.createElement('div');
  modal.className = 'qs-wb-modal';
  overlay.appendChild(modal);

  // Header toolbar
  const toolbar = doc.createElement('div');
  toolbar.className = 'qs-wb-toolbar';
  modal.appendChild(toolbar);

  const leftGroup = doc.createElement('div');
  leftGroup.className = 'qs-wb-group';
  const rightGroup = doc.createElement('div');
  rightGroup.className = 'qs-wb-group';
  toolbar.append(leftGroup, rightGroup);

  const btnOut = createIconButton(doc, 'zoom-out', t('缩小 (-)', 'Zoom out (-)'));
  const zoomReadout = doc.createElement('span');
  zoomReadout.className = 'qs-wb-zoom-readout';
  zoomReadout.textContent = '100%';
  const btnIn = createIconButton(doc, 'zoom-in', t('放大 (+)', 'Zoom in (+)'));
  const btnFit = createIconButton(doc, 'maximize-2', t('适应窗口 (F)', 'Fit to view (F)'), t('适屏', 'Fit'));
  const btnFitW = createIconButton(doc, 'move-horizontal', t('适应宽度 (W)', 'Fit width (W)'), t('适宽', 'Width'));
  const btnReset = createIconButton(doc, 'rotate-ccw', t('100% 原始尺寸 (0)', 'Actual size (0)'), '1:1');

  let bgMode: ExportBgMode = settings.defaultExportBg;
  const bgLabel = (mode: ExportBgMode): string => {
    if (mode === 'white') return t('纯白底', 'White');
    if (mode === 'transparent') return t('透明底', 'Transparent');
    return t('主题底', 'Theme');
  };
  const btnBg = createIconButton(doc, 'palette', t('切换画布与导出底色', 'Switch canvas & export background'), bgLabel(bgMode));
  const btnMinimap = createIconButton(doc, 'map', t('显示/隐藏小地图 (M)', 'Toggle minimap (M)'));
  btnMinimap.classList.toggle('is-active', settings.showMinimap);

  leftGroup.append(btnOut, zoomReadout, btnIn, btnFit, btnFitW, btnReset, btnBg, btnMinimap);

  // Search box
  const searchWrap = doc.createElement('div');
  searchWrap.className = 'qs-wb-search-wrap';
  const searchInput = doc.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'qs-wb-input';
  searchInput.placeholder = t('图内搜节点 (⌘F)', 'Search nodes (⌘F)');
  const matchStat = doc.createElement('span');
  matchStat.className = 'qs-wb-meta';
  const btnPrev = createIconButton(doc, 'chevron-up', t('上一个命中 (Shift+Enter)', 'Previous match'));
  const btnNext = createIconButton(doc, 'chevron-down', t('下一个命中 (Enter)', 'Next match'));
  searchWrap.append(searchInput, matchStat, btnPrev, btnNext);

  const btnCopyPng = createIconButton(
    doc,
    'copy',
    t(`复制 ${settings.pngScale}× 高清 PNG`, `Copy ${settings.pngScale}x PNG`),
    t('复制 PNG', 'Copy PNG'),
  );
  const btnDlPng = createIconButton(doc, 'image', t('下载高清 PNG', 'Download PNG'), 'PNG');
  const btnDlSvg = createIconButton(doc, 'download', t('导出高保真 SVG', 'Export SVG'), 'SVG');
  const btnClose = createIconButton(doc, 'x', t('关闭 (Esc)', 'Close (Esc)'));

  rightGroup.append(searchWrap, btnCopyPng, btnDlPng, btnDlSvg, btnClose);

  // Interactive Stage
  const stage = doc.createElement('div');
  stage.className = 'qs-wb-mermaid-stage';
  stage.dataset.bg = bgMode;
  modal.appendChild(stage);

  const canvas = doc.createElement('div');
  canvas.className = 'qs-wb-mermaid-canvas';
  stage.appendChild(canvas);

  const dims = measureSvgDimensions(sourceSvg);
  const mountLiveClone = (): SVGSVGElement => {
    canvas.textContent = '';
    const nextClone = cloneSvgWithScopedId(sourceSvg, 'qs-live');
    nextClone.setAttribute('width', String(dims.width));
    nextClone.setAttribute('height', String(dims.height));
    nextClone.classList.add('qs-wb-live-svg');
    nextClone.style.width = `${dims.width}px`;
    nextClone.style.height = `${dims.height}px`;
    if (bgMode === 'white' && isDarkThemeDocument(doc) && sourceSvg.isConnected) {
      adaptSvgForWhiteBackground(sourceSvg, nextClone, win);
    }
    canvas.appendChild(nextClone);
    return nextClone;
  };
  let liveClone = mountLiveClone();

  // Status footer
  const footer = doc.createElement('div');
  footer.className = 'qs-wb-footer';
  const footerLeft = doc.createElement('span');
  footerLeft.textContent = `${title} · ${dims.width} × ${dims.height}px`;
  const footerRight = doc.createElement('span');
  footerRight.textContent = t(
    '滚轮缩放 · 左键拖拽 · +/-/0/F/W/M · ⌘F 搜节点 · Esc 关闭',
    'Wheel zoom · Drag pan · +/-/0/F/W/M · ⌘F search · Esc close',
  );
  footer.append(footerLeft, footerRight);
  modal.appendChild(footer);

  doc.body.appendChild(overlay);

  const getBounds = (): ViewportBounds => ({
    stageWidth: stage.clientWidth || win.innerWidth || 900,
    stageHeight: stage.clientHeight || win.innerHeight || 600,
    contentWidth: dims.width,
    contentHeight: dims.height,
  });

  let state: ViewportState = computeFitViewport(getBounds());
  let minimapVisible = settings.showMinimap;
  let minimap: MinimapController | null = null;

  const renderViewport = (): void => {
    canvas.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`;
    zoomReadout.textContent = `${Math.round(state.scale * 100)}%`;
    minimap?.sync(state, getBounds());
  };

  minimap = createMermaidMinimap(doc, liveClone, (rx, ry) => {
    const b = getBounds();
    state = centerOnContentPoint(rx * b.contentWidth, ry * b.contentHeight, b, state.scale);
    renderViewport();
  }, bgMode);
  minimap.setVisible(minimapVisible);
  stage.appendChild(minimap.element);

  // Search state
  let indexedNodes: IndexedDiagramNode[] = extractDiagramSearchNodes(liveClone);
  let matchedNodes: IndexedDiagramNode[] = [];
  let matchIdx = -1;

  const focusMatch = (): void => {
    if (!matchedNodes.length) return;
    for (let i = 0; i < matchedNodes.length; i++) {
      matchedNodes[i].element.classList.toggle('qs-wb-node-current', i === matchIdx);
    }
    const target = matchedNodes[matchIdx];
    const center = getNodeCenterInSvg(target.element, liveClone, dims.width, dims.height);
    const b = getBounds();
    state = centerOnContentPoint(center.x, center.y, b, Math.max(state.scale, 1.25));
    matchStat.textContent = `${matchIdx + 1} / ${matchedNodes.length}`;
    renderViewport();
  };

  const DIMMED_NODE_OPACITY = '0.22';

  const setNodeDimmed = (el: Element, dimmed: boolean, dimOpacity = DIMMED_NODE_OPACITY): void => {
    el.classList.toggle('qs-wb-node-dim', dimmed);
    const stylable = el as HTMLElement | SVGElement;
    if (!stylable.style) return;
    if (dimmed) {
      if (stylable.dataset && stylable.dataset.qsWbOrigOpacity === undefined) {
        stylable.dataset.qsWbOrigOpacity = stylable.style.opacity || '';
      }
      // Apply dimmed opacity dynamically so it overrides both Mermaid inline `opacity: 1`
      // and `#mermaid-xxx .node` ID-scoped rules without requiring `!important` in CSS.
      stylable.style.setProperty('opacity', dimOpacity);
    } else if (stylable.dataset && stylable.dataset.qsWbOrigOpacity !== undefined) {
      const orig = stylable.dataset.qsWbOrigOpacity;
      if (orig) stylable.style.setProperty('opacity', orig);
      else stylable.style.removeProperty('opacity');
      delete stylable.dataset.qsWbOrigOpacity;
    }
  };

  const applySearch = (): void => {
    const q = searchInput.value.trim();
    for (const item of indexedNodes) {
      setNodeDimmed(item.element, false);
      item.element.classList.remove('qs-wb-node-match', 'qs-wb-node-current');
    }
    if (!q) {
      matchedNodes = [];
      matchIdx = -1;
      matchStat.textContent = '';
      return;
    }
    matchedNodes = filterDiagramNodes(indexedNodes, q);
    const matchSet = new Set(matchedNodes.map(m => m.element));
    for (const item of indexedNodes) {
      if (matchSet.has(item.element)) {
        item.element.classList.add('qs-wb-node-match');
      } else if (!matchedNodes.some(m => item.element.contains(m.element))) {
        setNodeDimmed(item.element, true);
      }
    }
    if (matchedNodes.length) {
      matchIdx = 0;
      focusMatch();
    } else {
      matchIdx = -1;
      matchStat.textContent = '0 / 0';
    }
  };

  // Controls
  const doZoom = (factor: number): void => {
    const b = getBounds();
    state = zoomAtPoint(state, factor, b.stageWidth / 2, b.stageHeight / 2, b);
    renderViewport();
  };

  btnIn.addEventListener('click', () => doZoom(1.25));
  btnOut.addEventListener('click', () => doZoom(0.8));
  btnFit.addEventListener('click', () => {
    state = computeFitViewport(getBounds());
    renderViewport();
  });
  btnFitW.addEventListener('click', () => {
    state = computeFitWidthViewport(getBounds());
    renderViewport();
  });
  btnReset.addEventListener('click', () => {
    const b = getBounds();
    state = centerOnContentPoint(b.contentWidth / 2, b.contentHeight / 2, b, 1);
    renderViewport();
  });
  btnBg.addEventListener('click', () => {
    bgMode = BG_ORDER[(BG_ORDER.indexOf(bgMode) + 1) % BG_ORDER.length];
    stage.dataset.bg = bgMode;
    const lbl = btnBg.querySelector('.qs-wb-btn-label');
    if (lbl) lbl.textContent = bgLabel(bgMode);
    if (isDarkThemeDocument(doc) && sourceSvg.isConnected) {
      liveClone = mountLiveClone();
      indexedNodes = extractDiagramSearchNodes(liveClone);
      minimap?.updateSource(liveClone, bgMode);
      if (searchInput.value.trim()) applySearch();
    } else {
      minimap?.updateSource(liveClone, bgMode);
    }
    minimap?.sync(state, getBounds());
  });
  btnMinimap.addEventListener('click', () => {
    minimapVisible = !minimapVisible;
    btnMinimap.classList.toggle('is-active', minimapVisible);
    minimap?.setVisible(minimapVisible);
    if (minimapVisible) minimap?.sync(state, getBounds());
  });

  searchInput.addEventListener('input', applySearch);
  searchInput.addEventListener('keydown', evt => {
    if (evt.key === 'Enter' && matchedNodes.length) {
      evt.preventDefault();
      matchIdx = evt.shiftKey
        ? (matchIdx - 1 + matchedNodes.length) % matchedNodes.length
        : (matchIdx + 1) % matchedNodes.length;
      focusMatch();
    }
  });
  btnNext.addEventListener('click', () => {
    if (!matchedNodes.length) return;
    matchIdx = (matchIdx + 1) % matchedNodes.length;
    focusMatch();
  });
  btnPrev.addEventListener('click', () => {
    if (!matchedNodes.length) return;
    matchIdx = (matchIdx - 1 + matchedNodes.length) % matchedNodes.length;
    focusMatch();
  });

  const safeSlug = title.replace(/[^\w\u4e00-\u9fff-]+/g, '-').replace(/^-+|-+$/g, '') || 'diagram';
  const getExportSource = (): SVGSVGElement => (sourceSvg.isConnected ? sourceSvg : liveClone);

  const downloadSvg = (): void => {
    try {
      const { svgString } = buildStandaloneSvgString(getExportSource(), bgMode);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      triggerBlobDownload(doc, blob, `${safeSlug}.svg`);
      new Notice(t('已导出高保真 SVG', 'Exported styled SVG'));
    } catch {
      new Notice(t('SVG 导出失败', 'Failed to export SVG'));
    }
  };

  btnDlSvg.addEventListener('click', downloadSvg);

  const showPngFallbackNotice = (): void => {
    const frag = doc.createDocumentFragment();
    const box = doc.createElement('div');
    box.className = 'qs-wb-notice-fallback';
    const msg = doc.createElement('span');
    msg.textContent = t('PNG 渲染受限，可一键降级导出高保真 SVG：', 'PNG rendering restricted; export styled SVG instead:');
    const actionBtn = doc.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'qs-wb-notice-action';
    actionBtn.textContent = t('导出 SVG', 'Export SVG');
    actionBtn.addEventListener('click', downloadSvg);
    box.append(msg, actionBtn);
    frag.appendChild(box);
    new Notice(frag, 8000);
  };

  const exportPng = async (copyOnly: boolean): Promise<void> => {
    try {
      const { blob, scale, clamped } = await renderSvgToPngBlob(getExportSource(), bgMode, settings.pngScale);
      if (copyOnly) {
        const copied = await copyPngBlobToClipboard(win, blob);
        if (copied) {
          new Notice(
            clamped
              ? t(`已复制 ${scale}× PNG（超大图自动降档）`, `Copied ${scale}x PNG (auto-clamped for large diagram)`)
              : t(`已复制 ${scale}× 高清 PNG 到剪贴板`, `Copied ${scale}x PNG to clipboard`),
          );
          return;
        }
        triggerBlobDownload(doc, blob, `${safeSlug}-${scale}x.png`);
        new Notice(t('当前环境不支持剪贴板写图，已自动下载 PNG', 'Clipboard image write unavailable; downloaded PNG instead'));
        return;
      }
      triggerBlobDownload(doc, blob, `${safeSlug}-${scale}x.png`);
      new Notice(
        clamped
          ? t(`已下载 ${scale}× PNG（超大图自动降档）`, `Downloaded ${scale}x PNG (auto-clamped)`)
          : t(`已下载 ${scale}× 高清 PNG`, `Downloaded ${scale}x PNG`),
      );
    } catch {
      showPngFallbackNotice();
    }
  };

  btnCopyPng.addEventListener('click', () => { void exportPng(true); });
  btnDlPng.addEventListener('click', () => { void exportPng(false); });

  // Pointer pan & touch pinch-zoom
  const activePointers = new Map<number, { x: number; y: number }>();
  let panStart: { x: number; y: number; ox: number; oy: number } | null = null;
  let lastPinchDist = 0;

  const onPointerDown = (evt: PointerEvent): void => {
    if ((evt.target as Element)?.closest?.('.qs-wb-minimap')) return;
    activePointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
    if (activePointers.size === 1) {
      panStart = { x: evt.clientX, y: evt.clientY, ox: state.x, oy: state.y };
      stage.classList.add('is-dragging');
    } else if (activePointers.size === 2) {
      panStart = null;
      const pts = Array.from(activePointers.values());
      lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }
  };

  const onPointerMove = (evt: PointerEvent): void => {
    if (!activePointers.has(evt.pointerId)) return;
    activePointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
    if (activePointers.size === 1 && panStart) {
      state = clampPan(
        {
          scale: state.scale,
          x: panStart.ox + (evt.clientX - panStart.x),
          y: panStart.oy + (evt.clientY - panStart.y),
        },
        getBounds(),
      );
      renderViewport();
    } else if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (lastPinchDist > 0 && dist > 0) {
        const rect = stage.getBoundingClientRect();
        const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
        const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
        state = zoomAtPoint(state, dist / lastPinchDist, midX, midY, getBounds());
        renderViewport();
      }
      lastPinchDist = dist;
    }
  };

  const onPointerUp = (evt: PointerEvent): void => {
    activePointers.delete(evt.pointerId);
    if (activePointers.size < 2) lastPinchDist = 0;
    if (activePointers.size === 0) {
      panStart = null;
      stage.classList.remove('is-dragging');
    }
  };

  const onWheel = (evt: WheelEvent): void => {
    if (settings.wheelZoomMode === 'ctrl' && !evt.ctrlKey && !evt.metaKey) return;
    evt.preventDefault();
    const clampedDelta = Math.max(-120, Math.min(120, evt.deltaY));
    if (clampedDelta === 0) return;
    const rect = stage.getBoundingClientRect();
    // Continuous exponential zoom provides smooth trackpad pinch and responsive wheel steps.
    const factor = Math.exp(-clampedDelta * 0.0028);
    state = zoomAtPoint(state, factor, evt.clientX - rect.left, evt.clientY - rect.top, getBounds());
    renderViewport();
  };

  const onStageDblClick = (evt: MouseEvent): void => {
    if ((evt.target as Element)?.closest?.('.qs-wb-minimap')) return;
    const b = getBounds();
    if (Math.abs(state.scale - 1) < 0.06) {
      state = computeFitViewport(b);
    } else {
      const rect = stage.getBoundingClientRect();
      const clickX = evt.clientX - rect.left;
      const clickY = evt.clientY - rect.top;
      const contentX = (clickX - state.x) / state.scale;
      const contentY = (clickY - state.y) / state.scale;
      state = centerOnContentPoint(contentX, contentY, b, 1);
    }
    renderViewport();
  };

  const onKeyDown = (evt: KeyboardEvent): void => {
    if (evt.key === 'Escape') {
      evt.preventDefault();
      evt.stopPropagation();
      close();
      return;
    }
    if ((evt.metaKey || evt.ctrlKey) && evt.key.toLowerCase() === 'f') {
      evt.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }
    if (doc.activeElement === searchInput) return;
    if (evt.key === '+' || evt.key === '=') { evt.preventDefault(); doZoom(1.25); }
    else if (evt.key === '-') { evt.preventDefault(); doZoom(0.8); }
    else if (evt.key === '0') { evt.preventDefault(); btnReset.click(); }
    else if (evt.key.toLowerCase() === 'f') { evt.preventDefault(); btnFit.click(); }
    else if (evt.key.toLowerCase() === 'w') { evt.preventDefault(); btnFitW.click(); }
    else if (evt.key.toLowerCase() === 'm') { evt.preventDefault(); btnMinimap.click(); }
  };

  const onOverlayClick = (evt: MouseEvent): void => {
    if (evt.target === overlay) close();
  };

  const onResize = (): void => {
    state = clampPan(state, getBounds());
    renderViewport();
  };

  const onBlur = (): void => {
    activePointers.clear();
    panStart = null;
    lastPinchDist = 0;
    stage.classList.remove('is-dragging');
  };

  stage.addEventListener('pointerdown', onPointerDown);
  win.addEventListener('pointermove', onPointerMove);
  win.addEventListener('pointerup', onPointerUp);
  win.addEventListener('pointercancel', onPointerUp);
  win.addEventListener('blur', onBlur);
  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('dblclick', onStageDblClick);
  win.addEventListener('keydown', onKeyDown, true);
  win.addEventListener('resize', onResize);
  overlay.addEventListener('click', onOverlayClick);

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    stage.removeEventListener('pointerdown', onPointerDown);
    win.removeEventListener('pointermove', onPointerMove);
    win.removeEventListener('pointerup', onPointerUp);
    win.removeEventListener('pointercancel', onPointerUp);
    win.removeEventListener('blur', onBlur);
    stage.removeEventListener('wheel', onWheel);
    stage.removeEventListener('dblclick', onStageDblClick);
    win.removeEventListener('keydown', onKeyDown, true);
    win.removeEventListener('resize', onResize);
    overlay.removeEventListener('click', onOverlayClick);
    minimap?.destroy();
    minimap = null;
    overlay.remove();
    prevFocused?.focus?.();
    onClose?.();
  };

  btnClose.addEventListener('click', close);

  win.requestAnimationFrame(() => {
    state = computeFitViewport(getBounds());
    renderViewport();
    overlay.focus();
  });

  return { close };
}
