import { Notice } from 'obsidian';
import { WorkbenchSettings } from '../settings';
import { t } from '../i18n';
import { createIconButton } from '../ui/icons';
import { extractTableGrid, TableGrid, TableRowData } from './table-model';
import {
  computeColumnSummaries,
  extractHighlightTerms,
  formatSummaryValue,
  queryTableRows,
  SortSpec,
} from './table-query';
import { serializeToCsv, serializeToMarkdown, serializeToTsv } from './table-export';
import { computeVirtualRange, VIRTUAL_ROW_HEIGHT } from './table-virtual';
import { triggerBlobDownload } from '../mermaid/mermaid-export';

export interface TableModalHandle {
  close(): void;
}

export interface TableModalOptions {
  title?: string;
  sourcePath?: string;
  onClose?: () => void;
  onOpenInternalLink?: (href: string) => void;
}

interface TableSessionState {
  visibleCols: number[];
  colWidths: [number, number][];
  freezeFirst: boolean;
  drawerOpen: boolean;
  showSummary: boolean;
}

const MAX_SESSION_ENTRIES = 40;
const tableSessionCache = new Map<string, TableSessionState>();

export function clearTableSessionCache(): void {
  tableSessionCache.clear();
}

function getSessionState(key: string): TableSessionState | undefined {
  const hit = tableSessionCache.get(key);
  if (!hit) return undefined;
  tableSessionCache.delete(key);
  tableSessionCache.set(key, hit);
  return hit;
}

function setSessionState(key: string, state: TableSessionState): void {
  tableSessionCache.delete(key);
  tableSessionCache.set(key, state);
  if (tableSessionCache.size > MAX_SESSION_ENTRIES) {
    const oldest = tableSessionCache.keys().next().value;
    if (oldest !== undefined) tableSessionCache.delete(oldest);
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedText(
  doc: Document,
  target: HTMLElement,
  text: string,
  terms: readonly string[],
): void {
  if (!text || terms.length === 0) {
    target.textContent = text;
    return;
  }
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${sorted.map(escapeRegExp).join('|')})`, 'gi');
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let hasHit = false;
  target.textContent = '';
  while ((match = re.exec(text)) !== null) {
    if (match[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    hasHit = true;
    if (match.index > lastIndex) {
      target.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)));
    }
    const mark = doc.createElement('mark');
    mark.className = 'qs-wb-hl';
    mark.textContent = match[0];
    target.appendChild(mark);
    lastIndex = match.index + match[0].length;
  }
  if (!hasHit) {
    target.textContent = text;
    return;
  }
  if (lastIndex < text.length) {
    target.appendChild(doc.createTextNode(text.slice(lastIndex)));
  }
}

export function openTableWorkbench(
  sourceTable: HTMLTableElement,
  settings: WorkbenchSettings,
  titleOrOptions: string | TableModalOptions = 'Table',
  legacyOnClose?: () => void,
): TableModalHandle {
  const opts: TableModalOptions = typeof titleOrOptions === 'string'
    ? { title: titleOrOptions, onClose: legacyOnClose }
    : titleOrOptions;
  const title = opts.title || 'Table';
  const onClose = opts.onClose;
  const onOpenInternalLink = opts.onOpenInternalLink;
  const doc = sourceTable.ownerDocument;
  const win = doc.defaultView || window;
  const prevFocused = doc.activeElement as HTMLElement | null;
  const grid: TableGrid = extractTableGrid(sourceTable);

  const sessionKey = `${opts.sourcePath || title}::${grid.columns.map(c => c.label).join('\u001f')}`;
  const saved = getSessionState(sessionKey);
  const isNarrowViewport = (win.innerWidth || 1024) <= 760;

  let globalQuery = '';
  const columnFilters: Record<number, string> = {};
  let sortSpecs: SortSpec[] = [];

  const validColIndexes = new Set(grid.columns.map(c => c.index));
  const restoredVisible = saved?.visibleCols.filter(idx => validColIndexes.has(idx)) ?? [];
  const visibleCols = new Set<number>(
    restoredVisible.length > 0 ? restoredVisible : grid.columns.map(c => c.index),
  );
  const colWidths = new Map<number, number>(
    (saved?.colWidths ?? []).filter(([idx, w]) => validColIndexes.has(idx) && w >= 64 && w <= 600),
  );
  let freezeFirst = saved ? saved.freezeFirst : settings.defaultFreezeFirstCol;
  let drawerOpen = saved ? saved.drawerOpen : !isNarrowViewport;
  let showSummary = saved ? saved.showSummary : true;
  let showColFilterRow = false;
  let selectedFilteredIdx = 0;
  let filteredRows: TableRowData[] = grid.rows;

  const persistSession = (): void => {
    setSessionState(sessionKey, {
      visibleCols: Array.from(visibleCols),
      colWidths: Array.from(colWidths.entries()),
      freezeFirst,
      drawerOpen,
      showSummary,
    });
  };

  const overlay = doc.createElement('div');
  overlay.className = 'qs-wb-overlay qs-wb-table-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', t('宽表全屏工作台', 'Wide-table workbench'));
  overlay.tabIndex = -1;

  const modal = doc.createElement('div');
  modal.className = 'qs-wb-modal qs-wb-table-modal';
  overlay.appendChild(modal);

  // Toolbar
  const toolbar = doc.createElement('div');
  toolbar.className = 'qs-wb-toolbar';
  modal.appendChild(toolbar);

  const leftGroup = doc.createElement('div');
  leftGroup.className = 'qs-wb-group';
  const rightGroup = doc.createElement('div');
  rightGroup.className = 'qs-wb-group';
  toolbar.append(leftGroup, rightGroup);

  const searchInput = doc.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'qs-wb-input qs-wb-table-search';
  searchInput.placeholder = t('全表检索 (⌘F，支持空格多词)', 'Search all cells (⌘F)');

  const statBadge = doc.createElement('span');
  statBadge.className = 'qs-wb-meta';

  const btnColFilter = createIconButton(
    doc,
    'filter',
    t('开启/隐藏列级筛选行（支持 >100、10..50、a|b、!排除）', 'Toggle column filters (>100, 10..50, a|b, !exclude)'),
    t('列筛选', 'Column filter'),
  );
  const btnClear = createIconButton(doc, 'eraser', t('清空筛选与排序', 'Reset filters & sort'), t('重置', 'Reset'));

  leftGroup.append(searchInput, statBadge, btnColFilter, btnClear);

  const btnFreeze = createIconButton(doc, 'pin', t('冻结首列', 'Freeze first column'), t('冻首列', 'Freeze 1st'));
  btnFreeze.classList.toggle('is-active', freezeFirst);

  const btnCols = createIconButton(doc, 'columns', t('显示/隐藏列', 'Toggle columns'), t('列显隐', 'Columns'));
  const btnSummary = createIconButton(doc, 'bar-chart-2', t('显示/隐藏数值统计汇总栏', 'Toggle numeric summary bar'), t('统计', 'Summary'));
  btnSummary.classList.toggle('is-active', showSummary);

  const btnDrawer = createIconButton(doc, 'panel-right', t('开关单行竖排详情抽屉', 'Toggle row detail drawer'), t('行详情', 'Details'));
  btnDrawer.classList.toggle('is-active', drawerOpen);

  const btnTsv = createIconButton(doc, 'copy', t('复制 TSV（直贴 Excel/钉钉/飞书）', 'Copy TSV (Excel/Sheet ready)'), 'TSV');
  const btnCsv = createIconButton(doc, 'download', t('下载 UTF-8 BOM CSV', 'Download UTF-8 BOM CSV'), 'CSV');
  const btnMd = createIconButton(doc, 'file-text', t('复制 Markdown 筛选子表', 'Copy filtered Markdown table'), 'MD');
  const btnClose = createIconButton(doc, 'x', t('关闭 (Esc)', 'Close (Esc)'));

  rightGroup.append(btnFreeze, btnCols, btnSummary, btnDrawer, btnTsv, btnCsv, btnMd, btnClose);

  // Column visibility popover
  const colMenu = doc.createElement('div');
  colMenu.className = 'qs-wb-col-menu';
  modal.appendChild(colMenu);

  // Body split: virtual grid + detail drawer
  const body = doc.createElement('div');
  body.className = 'qs-wb-table-body';
  modal.appendChild(body);

  const gridWrap = doc.createElement('div');
  gridWrap.className = 'qs-wb-grid-wrap';
  body.appendChild(gridWrap);

  const tableEl = doc.createElement('table');
  tableEl.className = 'qs-wb-grid-table';
  if (freezeFirst) tableEl.classList.add('is-freeze-first');
  const colgroupEl = doc.createElement('colgroup');
  const theadEl = doc.createElement('thead');
  const tbodyEl = doc.createElement('tbody');
  tableEl.append(colgroupEl, theadEl, tbodyEl);
  gridWrap.appendChild(tableEl);

  // Detail Drawer
  const drawer = doc.createElement('aside');
  drawer.className = 'qs-wb-drawer';
  drawer.classList.toggle('is-closed', !drawerOpen);
  const drawerHead = doc.createElement('div');
  drawerHead.className = 'qs-wb-drawer-head';
  const drawerTitle = doc.createElement('span');
  drawerTitle.textContent = t('单行竖排详情', 'Row detail');
  const drawerCloseBtn = createIconButton(doc, 'x', t('收起详情抽屉', 'Close drawer'));
  drawerHead.append(drawerTitle, drawerCloseBtn);
  const drawerList = doc.createElement('div');
  drawerList.className = 'qs-wb-drawer-list';
  drawer.append(drawerHead, drawerList);
  body.appendChild(drawer);

  // Numeric Summary Bar (auto-shown when visible numeric/percent columns exist)
  const summaryBar = doc.createElement('div');
  summaryBar.className = 'qs-wb-summary-bar is-hidden';
  modal.appendChild(summaryBar);

  // Footer
  const footer = doc.createElement('div');
  footer.className = 'qs-wb-footer';
  const footerLeft = doc.createElement('span');
  footerLeft.textContent = grid.hasSpans
    ? t(`${title} · 检测到合并单元格，已启用只读保护（禁用排序）`, `${title} · Merged cells detected; sorting disabled for safety`)
    : `${title} · ${t('点击表头排序 · Shift+点击多列排序 · 双击单元格复制', 'Click header to sort · Shift+click multi-sort · Double-click cell to copy')}`;
  const footerRight = doc.createElement('span');
  footerRight.textContent = t('↑/↓ 切换行 · ⌘F 检索 · Esc 关闭', '↑/↓ rows · ⌘F search · Esc close');
  footer.append(footerLeft, footerRight);
  modal.appendChild(footer);

  doc.body.appendChild(overlay);

  const getActiveCols = () => grid.columns.filter(c => visibleCols.has(c.index));
  const getVisibleIds = () => getActiveCols().map(c => c.index);

  const renderSummaryBar = (): void => {
    const summaries = computeColumnSummaries(grid, filteredRows, getVisibleIds());
    if (!showSummary || summaries.length === 0) {
      summaryBar.classList.add('is-hidden');
      summaryBar.textContent = '';
      return;
    }
    summaryBar.classList.remove('is-hidden');
    summaryBar.textContent = '';
    for (const s of summaries) {
      const chip = doc.createElement('button');
      chip.type = 'button';
      chip.className = 'qs-wb-summary-chip';
      const sumTxt = formatSummaryValue(s.sum, s.type);
      const avgTxt = formatSummaryValue(s.avg, s.type);
      const minTxt = formatSummaryValue(s.min, s.type);
      const maxTxt = formatSummaryValue(s.max, s.type);
      const labelText = s.type === 'percent'
        ? `${s.label}: ${t('均值', 'avg')} ${avgTxt} · ${minTxt}~${maxTxt} (n=${s.count})`
        : `${s.label}: ${t('合计', 'sum')} ${sumTxt} · ${t('均值', 'avg')} ${avgTxt} · ${minTxt}~${maxTxt}`;
      chip.textContent = labelText;
      chip.title = t('点击复制该列汇总统计', 'Click to copy column summary');
      chip.addEventListener('click', () => {
        void (async () => {
          try {
            await (win.navigator?.clipboard || navigator.clipboard).writeText(labelText);
            new Notice(t(`已复制「${s.label}」统计汇总`, `Copied summary for "${s.label}"`));
          } catch {
            new Notice(t('复制统计失败', 'Failed to copy summary'));
          }
        })();
      });
      summaryBar.appendChild(chip);
    }
  };

  const renderDrawer = (row: TableRowData | undefined): void => {
    drawerList.empty?.();
    if (!drawerList.empty) drawerList.textContent = '';
    if (!row) {
      drawerTitle.textContent = t('无匹配行', 'No matching row');
      return;
    }
    drawerTitle.textContent = `${t('第', 'Row #')} ${row.rowIndex + 1} ${t('行', '')}`.trim();
    for (const col of grid.columns) {
      const cell = row.cells[col.index] ?? { text: '', links: [] };
      const card = doc.createElement('div');
      card.className = 'qs-wb-field-card';
      const top = doc.createElement('div');
      top.className = 'qs-wb-field-top';
      const keyEl = doc.createElement('span');
      keyEl.className = 'qs-wb-field-k';
      keyEl.textContent = col.label;
      const copyBtn = doc.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'qs-wb-mini-copy';
      copyBtn.textContent = t('复制', 'Copy');
      copyBtn.addEventListener('click', () => {
        void (async () => {
          try {
            await (win.navigator?.clipboard || navigator.clipboard).writeText(cell.text);
            new Notice(t(`已复制「${col.label}」`, `Copied "${col.label}"`));
          } catch {
            new Notice(t('复制失败', 'Copy failed'));
          }
        })();
      });
      top.append(keyEl, copyBtn);

      const valEl = doc.createElement('div');
      valEl.className = 'qs-wb-field-v';
      valEl.textContent = cell.text || '—';
      card.append(top, valEl);

      if (cell.links.length > 0) {
        const linksBar = doc.createElement('div');
        linksBar.className = 'qs-wb-field-links';
        for (const link of cell.links) {
          const a = doc.createElement('a');
          a.className = link.isInternal ? 'qs-wb-link is-internal' : 'qs-wb-link is-external';
          a.textContent = link.text;
          if (link.isInternal) {
            a.href = '#';
            a.addEventListener('click', evt => {
              evt.preventDefault();
              close();
              onOpenInternalLink?.(link.href);
            });
          } else {
            a.href = link.href;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
          }
          linksBar.appendChild(a);
        }
        card.appendChild(linksBar);
      }

      drawerList.appendChild(card);
    }
  };

  let lastRenderedRange = '';

  const syncSelectedRowHighlight = (): void => {
    const prev = tbodyEl.querySelector('tr.qs-wb-data-row.is-selected');
    prev?.classList.remove('is-selected');
    const next = tbodyEl.querySelector(`tr.qs-wb-data-row[data-fidx="${selectedFilteredIdx}"]`);
    next?.classList.add('is-selected');
  };

  const renderBodyRows = (force = false): void => {
    const activeCols = getActiveCols();
    const useVirtual = filteredRows.length >= settings.virtualScrollThreshold;
    const vpH = gridWrap.clientHeight || 480;
    const range = useVirtual
      ? computeVirtualRange(filteredRows.length, gridWrap.scrollTop, vpH, VIRTUAL_ROW_HEIGHT)
      : { start: 0, end: filteredRows.length, topSpacerHeight: 0, bottomSpacerHeight: 0 };

    const hlSig = `${globalQuery.trim()}|${activeCols.map(c => columnFilters[c.index] ?? '').join('\u001f')}`;
    const rangeKey = `${range.start}:${range.end}:${activeCols.map(c => c.index).join(',')}:${filteredRows.length}:${hlSig}`;
    if (!force && rangeKey === lastRenderedRange) {
      syncSelectedRowHighlight();
      return;
    }
    lastRenderedRange = rangeKey;

    tbodyEl.textContent = '';

    if (range.topSpacerHeight > 0) {
      const trTop = doc.createElement('tr');
      trTop.className = 'qs-wb-spacer-row';
      const tdTop = doc.createElement('td');
      tdTop.colSpan = Math.max(1, activeCols.length);
      tdTop.style.height = `${range.topSpacerHeight}px`;
      trTop.appendChild(tdTop);
      tbodyEl.appendChild(trTop);
    }

    const colHlTerms = activeCols.map(c => extractHighlightTerms(globalQuery, columnFilters[c.index]));
    const frag = doc.createDocumentFragment();
    for (let i = range.start; i < range.end; i++) {
      const row = filteredRows[i];
      const tr = doc.createElement('tr');
      tr.className = 'qs-wb-data-row';
      if (i === selectedFilteredIdx) tr.classList.add('is-selected');
      tr.dataset.fidx = String(i);
      for (let pos = 0; pos < activeCols.length; pos++) {
        const col = activeCols[pos];
        const td = doc.createElement('td');
        td.dataset.colIdx = String(col.index);
        const cell = row.cells[col.index] ?? { text: '', links: [] };
        const terms = colHlTerms[pos];
        if (terms.length > 0) {
          renderHighlightedText(doc, td, cell.text, terms);
        } else {
          td.textContent = cell.text;
        }
        td.title = cell.text;
        const w = colWidths.get(col.index);
        if (w) {
          td.style.width = `${w}px`;
          td.style.minWidth = `${w}px`;
          td.style.maxWidth = `${w}px`;
        }
        tr.appendChild(td);
      }
      frag.appendChild(tr);
    }
    tbodyEl.appendChild(frag);

    if (range.bottomSpacerHeight > 0) {
      const trBot = doc.createElement('tr');
      trBot.className = 'qs-wb-spacer-row';
      const tdBot = doc.createElement('td');
      tdBot.colSpan = Math.max(1, activeCols.length);
      tdBot.style.height = `${range.bottomSpacerHeight}px`;
      trBot.appendChild(tdBot);
      tbodyEl.appendChild(trBot);
    }
  };

  let resizeCleanup: (() => void) | null = null;
  let resizeRafId: number | null = null;
  const colEls = new Map<number, HTMLTableColElement>();

  const applyLiveColumnWidth = (colIndex: number, visiblePos: number, th: HTMLTableCellElement, nextW: number): void => {
    const px = `${nextW}px`;
    const colEl = colEls.get(colIndex);
    if (colEl) colEl.style.width = px;
    th.style.width = px;
    th.style.minWidth = px;
    th.style.maxWidth = px;
    const rows = tbodyEl.querySelectorAll<HTMLTableRowElement>('tr.qs-wb-data-row');
    for (const tr of Array.from(rows)) {
      const td = tr.children[visiblePos] as HTMLElement | undefined;
      if (!td) continue;
      td.style.width = px;
      td.style.minWidth = px;
      td.style.maxWidth = px;
    }
  };

  // Debounced/coalesced filter refresh with Chinese IME composition guard
  let filterTimer: number | null = null;
  let lastFilterTs = 0;
  let isComposing = false;

  const cancelPendingFilter = (): void => {
    if (filterTimer !== null) {
      win.clearTimeout(filterTimer);
      filterTimer = null;
    }
  };

  const scheduleFilterRefresh = (forceImmediate = false): void => {
    const now = performance.now();
    const isCleared = !globalQuery.trim() && Object.values(columnFilters).every(v => !v.trim());
    if (forceImmediate || isCleared || grid.rows.length <= 500 || now - lastFilterTs >= 65) {
      cancelPendingFilter();
      lastFilterTs = now;
      refreshData(false);
      return;
    }
    cancelPendingFilter();
    filterTimer = win.setTimeout(() => {
      filterTimer = null;
      lastFilterTs = performance.now();
      refreshData(false);
    }, 65);
  };

  const renderHeader = (): void => {
    const activeCols = getActiveCols();
    colgroupEl.textContent = '';
    colEls.clear();
    theadEl.textContent = '';

    const headTr = doc.createElement('tr');
    activeCols.forEach((col, visiblePos) => {
      const colEl = doc.createElement('col');
      const w = colWidths.get(col.index);
      if (w) colEl.style.width = `${w}px`;
      colgroupEl.appendChild(colEl);
      colEls.set(col.index, colEl);

      const th = doc.createElement('th');
      th.className = 'qs-wb-th';
      if (w) {
        th.style.width = `${w}px`;
        th.style.minWidth = `${w}px`;
        th.style.maxWidth = `${w}px`;
      }

      const inner = doc.createElement('div');
      inner.className = 'qs-wb-th-inner';
      const labelSpan = doc.createElement('span');
      labelSpan.className = 'qs-wb-th-label';
      labelSpan.textContent = col.label;
      const sortSpan = doc.createElement('span');
      sortSpan.className = 'qs-wb-sort-ind';
      const sortIdx = sortSpecs.findIndex(s => s.colIndex === col.index);
      if (sortIdx >= 0) {
        const arrow = sortSpecs[sortIdx].direction === 'asc' ? '▲' : '▼';
        sortSpan.textContent = sortSpecs.length > 1 ? `${sortIdx + 1}${arrow}` : arrow;
      }
      inner.append(labelSpan, sortSpan);
      th.appendChild(inner);

      if (!grid.hasSpans) {
        th.addEventListener('click', evt => {
          if ((evt.target as Element)?.classList?.contains('qs-wb-col-resizer')) return;
          const existingIdx = sortSpecs.findIndex(s => s.colIndex === col.index);
          if (evt.shiftKey) {
            if (existingIdx >= 0) {
              if (sortSpecs[existingIdx].direction === 'asc') {
                sortSpecs = sortSpecs.map((s, i) => (i === existingIdx ? { ...s, direction: 'desc' } : s));
              } else {
                sortSpecs = sortSpecs.filter((_, i) => i !== existingIdx);
              }
            } else {
              sortSpecs = [...sortSpecs, { colIndex: col.index, direction: 'asc' }];
            }
          } else if (existingIdx >= 0 && sortSpecs.length === 1) {
            if (sortSpecs[0].direction === 'asc') sortSpecs = [{ colIndex: col.index, direction: 'desc' }];
            else sortSpecs = [];
          } else {
            sortSpecs = [{ colIndex: col.index, direction: 'asc' }];
          }
          refreshData(true);
        });
      }

      const resizer = doc.createElement('span');
      resizer.className = 'qs-wb-col-resizer';
      resizer.title = t('拖拽调整列宽，双击还原默认', 'Drag to resize column, double-click to reset');
      resizer.addEventListener('dblclick', evt => {
        evt.preventDefault();
        evt.stopPropagation();
        colWidths.delete(col.index);
        persistSession();
        renderHeader();
        renderBodyRows(true);
      });
      resizer.addEventListener('pointerdown', evt => {
        evt.preventDefault();
        evt.stopPropagation();
        resizeCleanup?.();
        const startX = evt.clientX;
        const startW = th.getBoundingClientRect().width || 120;
        let pendingW = Math.round(startW);
        const onMove = (mEvt: PointerEvent): void => {
          pendingW = Math.max(64, Math.min(600, Math.round(startW + (mEvt.clientX - startX))));
          colWidths.set(col.index, pendingW);
          if (resizeRafId === null) {
            resizeRafId = win.requestAnimationFrame(() => {
              resizeRafId = null;
              applyLiveColumnWidth(col.index, visiblePos, th, pendingW);
            });
          }
        };
        const onUp = (): void => {
          if (resizeRafId !== null) {
            win.cancelAnimationFrame(resizeRafId);
            resizeRafId = null;
            applyLiveColumnWidth(col.index, visiblePos, th, pendingW);
          }
          persistSession();
          win.removeEventListener('pointermove', onMove);
          win.removeEventListener('pointerup', onUp);
          win.removeEventListener('pointercancel', onUp);
          win.removeEventListener('blur', onUp);
          resizeCleanup = null;
        };
        resizeCleanup = onUp;
        win.addEventListener('pointermove', onMove);
        win.addEventListener('pointerup', onUp);
        win.addEventListener('pointercancel', onUp);
        win.addEventListener('blur', onUp);
      });
      th.appendChild(resizer);
      headTr.appendChild(th);
    });
    theadEl.appendChild(headTr);

    if (showColFilterRow) {
      const measuredHeadH = Math.max(30, Math.ceil(headTr.getBoundingClientRect().height || 34));
      tableEl.style.setProperty('--qs-wb-head-h', `${measuredHeadH}px`);
      const filterTr = doc.createElement('tr');
      filterTr.className = 'qs-wb-col-filter-row';
      for (const col of activeCols) {
        const th = doc.createElement('th');
        const inp = doc.createElement('input');
        inp.type = 'search';
        inp.className = 'qs-wb-col-filter-input';
        inp.placeholder = t('>100 / 1..9 / a|b / !排除', '>100 / 1..9 / a|b / !excl');
        inp.value = columnFilters[col.index] ?? '';
        inp.addEventListener('compositionstart', () => { isComposing = true; });
        inp.addEventListener('compositionend', () => {
          isComposing = false;
          columnFilters[col.index] = inp.value;
          scheduleFilterRefresh(true);
        });
        inp.addEventListener('input', () => {
          columnFilters[col.index] = inp.value;
          if (!isComposing) scheduleFilterRefresh();
        });
        th.appendChild(inp);
        filterTr.appendChild(th);
      }
      theadEl.appendChild(filterTr);
    } else {
      tableEl.style.removeProperty('--qs-wb-head-h');
    }
  };

  const renderColMenu = (): void => {
    colMenu.textContent = '';
    for (const col of grid.columns) {
      const lbl = doc.createElement('label');
      lbl.className = 'qs-wb-col-item';
      const cb = doc.createElement('input');
      cb.type = 'checkbox';
      cb.checked = visibleCols.has(col.index);
      cb.addEventListener('change', () => {
        if (cb.checked) visibleCols.add(col.index);
        else if (visibleCols.size > 1) visibleCols.delete(col.index);
        else { cb.checked = true; return; }
        persistSession();
        renderHeader();
        renderBodyRows(true);
        updateStats();
        renderSummaryBar();
      });
      const span = doc.createElement('span');
      span.textContent = col.label;
      lbl.append(cb, span);
      colMenu.appendChild(lbl);
    }
  };

  const updateStats = (): void => {
    const activeCount = visibleCols.size;
    statBadge.textContent = t(
      `${filteredRows.length} / ${grid.rows.length} 行 · ${activeCount}/${grid.columns.length} 列`,
      `${filteredRows.length} / ${grid.rows.length} rows · ${activeCount}/${grid.columns.length} cols`,
    );
  };

  const refreshData = (rebuildHeader = true): void => {
    cancelPendingFilter();
    filteredRows = queryTableRows(grid, {
      globalQuery,
      columnFilters,
      sort: sortSpecs.length > 0 ? sortSpecs : null,
    });
    if (selectedFilteredIdx >= filteredRows.length) {
      selectedFilteredIdx = Math.max(0, filteredRows.length - 1);
    }
    gridWrap.scrollTop = 0;
    if (rebuildHeader) renderHeader();
    updateStats();
    renderBodyRows(true);
    renderDrawer(filteredRows[selectedFilteredIdx]);
    renderSummaryBar();
  };

  // Event listeners
  searchInput.addEventListener('compositionstart', () => { isComposing = true; });
  searchInput.addEventListener('compositionend', () => {
    isComposing = false;
    globalQuery = searchInput.value;
    scheduleFilterRefresh(true);
  });
  searchInput.addEventListener('input', () => {
    globalQuery = searchInput.value;
    if (!isComposing) scheduleFilterRefresh();
  });

  btnColFilter.addEventListener('click', () => {
    showColFilterRow = !showColFilterRow;
    btnColFilter.classList.toggle('is-active', showColFilterRow);
    renderHeader();
  });

  btnClear.addEventListener('click', () => {
    globalQuery = '';
    searchInput.value = '';
    for (const k of Object.keys(columnFilters)) delete columnFilters[Number(k)];
    sortSpecs = [];
    refreshData(true);
  });

  btnFreeze.addEventListener('click', () => {
    freezeFirst = !freezeFirst;
    btnFreeze.classList.toggle('is-active', freezeFirst);
    tableEl.classList.toggle('is-freeze-first', freezeFirst);
    persistSession();
  });

  btnSummary.addEventListener('click', () => {
    showSummary = !showSummary;
    btnSummary.classList.toggle('is-active', showSummary);
    renderSummaryBar();
    persistSession();
  });

  btnCols.addEventListener('click', evt => {
    evt.stopPropagation();
    colMenu.classList.toggle('is-open');
  });

  const toggleDrawer = (open?: boolean): void => {
    const next = open === undefined ? !drawerOpen : open;
    drawerOpen = next;
    drawer.classList.toggle('is-closed', !next);
    btnDrawer.classList.toggle('is-active', next);
    persistSession();
  };
  btnDrawer.addEventListener('click', () => toggleDrawer());
  drawerCloseBtn.addEventListener('click', () => toggleDrawer(false));

  tbodyEl.addEventListener('click', evt => {
    const tr = (evt.target as Element)?.closest<HTMLTableRowElement>('tr.qs-wb-data-row') ?? null;
    if (!tr || tr.dataset.fidx === undefined) return;
    selectedFilteredIdx = Number(tr.dataset.fidx);
    toggleDrawer(true);
    syncSelectedRowHighlight();
    renderDrawer(filteredRows[selectedFilteredIdx]);
  });

  tbodyEl.addEventListener('dblclick', evt => {
    const td = (evt.target as Element)?.closest<HTMLTableCellElement>('td') ?? null;
    const tr = td?.closest<HTMLTableRowElement>('tr.qs-wb-data-row') ?? null;
    if (!td || !tr || tr.dataset.fidx === undefined || td.dataset.colIdx === undefined) return;
    const row = filteredRows[Number(tr.dataset.fidx)];
    const colIdx = Number(td.dataset.colIdx);
    const text = row?.cells[colIdx]?.text ?? '';
    void (async () => {
      try {
        await (win.navigator?.clipboard || navigator.clipboard).writeText(text);
        new Notice(t('已复制单元格内容', 'Copied cell value'));
      } catch {
        new Notice(t('复制失败', 'Copy failed'));
      }
    })();
  });

  const onScroll = (): void => {
    renderBodyRows(false);
  };
  gridWrap.addEventListener('scroll', onScroll, { passive: true });

  const safeSlug = title.replace(/[^\w\u4e00-\u9fff-]+/g, '-').replace(/^-+|-+$/g, '') || 'table';

  btnTsv.addEventListener('click', () => {
    void (async () => {
      try {
        const tsv = serializeToTsv(grid.columns, filteredRows, getVisibleIds());
        await (win.navigator?.clipboard || navigator.clipboard).writeText(tsv);
        new Notice(t(`已复制 ${filteredRows.length} 行 TSV`, `Copied ${filteredRows.length} rows as TSV`));
      } catch {
        new Notice(t('复制 TSV 失败', 'Failed to copy TSV'));
      }
    })();
  });

  btnCsv.addEventListener('click', () => {
    const csv = serializeToCsv(grid.columns, filteredRows, getVisibleIds(), true);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    triggerBlobDownload(doc, blob, `${safeSlug}.csv`);
    new Notice(t(`已导出 ${filteredRows.length} 行 CSV (UTF-8 BOM)`, `Exported ${filteredRows.length} rows as CSV`));
  });

  btnMd.addEventListener('click', () => {
    void (async () => {
      try {
        const md = serializeToMarkdown(grid.columns, filteredRows, getVisibleIds());
        await (win.navigator?.clipboard || navigator.clipboard).writeText(md);
        new Notice(t(`已复制 ${filteredRows.length} 行 Markdown 子表`, `Copied ${filteredRows.length} rows as Markdown`));
      } catch {
        new Notice(t('复制 Markdown 失败', 'Failed to copy Markdown'));
      }
    })();
  });

  const onKeyDown = (evt: KeyboardEvent): void => {
    if (evt.key === 'Escape') {
      evt.preventDefault();
      evt.stopPropagation();
      if (colMenu.classList.contains('is-open')) {
        colMenu.classList.remove('is-open');
        return;
      }
      close();
      return;
    }
    if ((evt.metaKey || evt.ctrlKey) && evt.key.toLowerCase() === 'f') {
      evt.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }
    const activeTag = (doc.activeElement?.tagName || '').toLowerCase();
    if (activeTag === 'input' || activeTag === 'textarea') return;
    const ensureSelectedVisible = (): void => {
      const rowTop = selectedFilteredIdx * VIRTUAL_ROW_HEIGHT;
      const rowBottom = rowTop + VIRTUAL_ROW_HEIGHT;
      const headH = theadEl.getBoundingClientRect().height || 36;
      const viewH = Math.max(VIRTUAL_ROW_HEIGHT, (gridWrap.clientHeight || 480) - headH);
      if (rowTop < gridWrap.scrollTop) {
        gridWrap.scrollTop = rowTop;
      } else if (rowBottom > gridWrap.scrollTop + viewH) {
        gridWrap.scrollTop = rowBottom - viewH;
      }
    };
    if (evt.key === 'ArrowDown' && filteredRows.length > 0) {
      evt.preventDefault();
      selectedFilteredIdx = Math.min(filteredRows.length - 1, selectedFilteredIdx + 1);
      ensureSelectedVisible();
      renderBodyRows(false);
      renderDrawer(filteredRows[selectedFilteredIdx]);
    } else if (evt.key === 'ArrowUp' && filteredRows.length > 0) {
      evt.preventDefault();
      selectedFilteredIdx = Math.max(0, selectedFilteredIdx - 1);
      ensureSelectedVisible();
      renderBodyRows(false);
      renderDrawer(filteredRows[selectedFilteredIdx]);
    }
  };

  const onOverlayClick = (evt: MouseEvent): void => {
    if (evt.target === overlay) close();
    else if (!(evt.target as Element)?.closest?.('.qs-wb-col-menu, .qs-wb-btn')) {
      colMenu.classList.remove('is-open');
    }
  };

  win.addEventListener('keydown', onKeyDown, true);
  overlay.addEventListener('click', onOverlayClick);

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    cancelPendingFilter();
    if (resizeRafId !== null) {
      win.cancelAnimationFrame(resizeRafId);
      resizeRafId = null;
    }
    resizeCleanup?.();
    gridWrap.removeEventListener('scroll', onScroll);
    win.removeEventListener('keydown', onKeyDown, true);
    overlay.removeEventListener('click', onOverlayClick);
    overlay.remove();
    prevFocused?.focus?.();
    onClose?.();
  };

  btnClose.addEventListener('click', close);

  renderColMenu();
  refreshData(true);
  win.requestAnimationFrame(() => overlay.focus());

  return { close };
}
