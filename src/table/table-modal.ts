import { Notice } from 'obsidian';
import { WorkbenchSettings } from '../settings';
import { t } from '../i18n';
import { createIconButton } from '../ui/icons';
import { extractTableGrid, TableGrid, TableRowData } from './table-model';
import { queryTableRows, SortSpec } from './table-query';
import { serializeToCsv, serializeToMarkdown, serializeToTsv } from './table-export';
import { computeVirtualRange, VIRTUAL_ROW_HEIGHT } from './table-virtual';
import { triggerBlobDownload } from '../mermaid/mermaid-export';

export interface TableModalHandle {
  close(): void;
}

export interface TableModalOptions {
  title?: string;
  onClose?: () => void;
  onOpenInternalLink?: (href: string) => void;
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

  let globalQuery = '';
  const columnFilters: Record<number, string> = {};
  let sortSpec: SortSpec | null = null;
  const visibleCols = new Set<number>(grid.columns.map(c => c.index));
  const colWidths = new Map<number, number>();
  let freezeFirst = settings.defaultFreezeFirstCol;
  let showColFilterRow = false;
  let selectedFilteredIdx = 0;
  let filteredRows: TableRowData[] = grid.rows;

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
    t('开启/隐藏列级筛选行', 'Toggle per-column filter row'),
    t('列筛选', 'Column filter'),
  );
  const btnClear = createIconButton(doc, 'eraser', t('清空筛选与排序', 'Reset filters & sort'), t('重置', 'Reset'));

  leftGroup.append(searchInput, statBadge, btnColFilter, btnClear);

  const btnFreeze = createIconButton(doc, 'pin', t('冻结首列', 'Freeze first column'), t('冻首列', 'Freeze 1st'));
  btnFreeze.classList.toggle('is-active', freezeFirst);

  const btnCols = createIconButton(doc, 'columns', t('显示/隐藏列', 'Toggle columns'), t('列显隐', 'Columns'));
  const btnDrawer = createIconButton(doc, 'panel-right', t('开关单行竖排详情抽屉', 'Toggle row detail drawer'), t('行详情', 'Details'));
  btnDrawer.classList.add('is-active');

  const btnTsv = createIconButton(doc, 'copy', t('复制 TSV（直贴 Excel/钉钉/飞书）', 'Copy TSV (Excel/Sheet ready)'), 'TSV');
  const btnCsv = createIconButton(doc, 'download', t('下载 UTF-8 BOM CSV', 'Download UTF-8 BOM CSV'), 'CSV');
  const btnMd = createIconButton(doc, 'file-text', t('复制 Markdown 筛选子表', 'Copy filtered Markdown table'), 'MD');
  const btnClose = createIconButton(doc, 'x', t('关闭 (Esc)', 'Close (Esc)'));

  rightGroup.append(btnFreeze, btnCols, btnDrawer, btnTsv, btnCsv, btnMd, btnClose);

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
  const theadEl = doc.createElement('thead');
  const tbodyEl = doc.createElement('tbody');
  tableEl.append(theadEl, tbodyEl);
  gridWrap.appendChild(tableEl);

  // Detail Drawer
  const drawer = doc.createElement('aside');
  drawer.className = 'qs-wb-drawer';
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

  // Footer
  const footer = doc.createElement('div');
  footer.className = 'qs-wb-footer';
  const footerLeft = doc.createElement('span');
  footerLeft.textContent = grid.hasSpans
    ? t(`${title} · 检测到合并单元格，已启用只读保护（禁用排序）`, `${title} · Merged cells detected; sorting disabled for safety`)
    : `${title} · ${t('点击表头智能排序 · 拖拽表头右缘调宽 · 原始笔记零改动', 'Click headers to sort · Drag edges to resize · Source note untouched')}`;
  const footerRight = doc.createElement('span');
  footerRight.textContent = t('↑/↓ 切换行 · ⌘F 检索 · Esc 关闭', '↑/↓ rows · ⌘F search · Esc close');
  footer.append(footerLeft, footerRight);
  modal.appendChild(footer);

  doc.body.appendChild(overlay);

  const getActiveCols = () => grid.columns.filter(c => visibleCols.has(c.index));

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

    const rangeKey = `${range.start}:${range.end}:${activeCols.map(c => c.index).join(',')}:${filteredRows.length}`;
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

    const frag = doc.createDocumentFragment();
    for (let i = range.start; i < range.end; i++) {
      const row = filteredRows[i];
      const tr = doc.createElement('tr');
      tr.className = 'qs-wb-data-row';
      if (i === selectedFilteredIdx) tr.classList.add('is-selected');
      tr.dataset.fidx = String(i);
      for (const col of activeCols) {
        const td = doc.createElement('td');
        const cell = row.cells[col.index] ?? { text: '', links: [] };
        td.textContent = cell.text;
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

  const renderHeader = (): void => {
    const activeCols = getActiveCols();
    theadEl.textContent = '';

    const headTr = doc.createElement('tr');
    for (const col of activeCols) {
      const th = doc.createElement('th');
      th.className = 'qs-wb-th';
      const w = colWidths.get(col.index);
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
      if (sortSpec && sortSpec.colIndex === col.index) {
        sortSpan.textContent = sortSpec.direction === 'asc' ? '▲' : '▼';
      }
      inner.append(labelSpan, sortSpan);
      th.appendChild(inner);

      if (!grid.hasSpans) {
        th.addEventListener('click', evt => {
          if ((evt.target as Element)?.classList?.contains('qs-wb-col-resizer')) return;
          if (sortSpec && sortSpec.colIndex === col.index) {
            if (sortSpec.direction === 'asc') sortSpec = { colIndex: col.index, direction: 'desc' };
            else sortSpec = null;
          } else {
            sortSpec = { colIndex: col.index, direction: 'asc' };
          }
          refreshData();
        });
      }

      const resizer = doc.createElement('span');
      resizer.className = 'qs-wb-col-resizer';
      resizer.title = t('拖拽调整列宽，双击还原默认', 'Drag to resize column, double-click to reset');
      resizer.addEventListener('dblclick', evt => {
        evt.preventDefault();
        evt.stopPropagation();
        colWidths.delete(col.index);
        renderHeader();
        renderBodyRows(true);
      });
      resizer.addEventListener('pointerdown', evt => {
        evt.preventDefault();
        evt.stopPropagation();
        resizeCleanup?.();
        const startX = evt.clientX;
        const startW = th.getBoundingClientRect().width || 120;
        const onMove = (mEvt: PointerEvent): void => {
          const nextW = Math.max(64, Math.min(600, Math.round(startW + (mEvt.clientX - startX))));
          colWidths.set(col.index, nextW);
          th.style.width = `${nextW}px`;
          th.style.minWidth = `${nextW}px`;
          th.style.maxWidth = `${nextW}px`;
          renderBodyRows(true);
        };
        const onUp = (): void => {
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
    }
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
        inp.placeholder = t('筛选 (!排除)', 'Filter (!exclude)');
        inp.value = columnFilters[col.index] ?? '';
        inp.addEventListener('input', () => {
          columnFilters[col.index] = inp.value;
          refreshData(false);
        });
        th.appendChild(inp);
        filterTr.appendChild(th);
      }
      theadEl.appendChild(filterTr);
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
        renderHeader();
        renderBodyRows(true);
        updateStats();
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
    filteredRows = queryTableRows(grid, {
      globalQuery,
      columnFilters,
      sort: sortSpec,
    });
    if (selectedFilteredIdx >= filteredRows.length) {
      selectedFilteredIdx = Math.max(0, filteredRows.length - 1);
    }
    gridWrap.scrollTop = 0;
    if (rebuildHeader) renderHeader();
    updateStats();
    renderBodyRows(true);
    renderDrawer(filteredRows[selectedFilteredIdx]);
  };

  // Event listeners
  searchInput.addEventListener('input', () => {
    globalQuery = searchInput.value;
    refreshData(false);
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
    sortSpec = null;
    refreshData(true);
  });

  btnFreeze.addEventListener('click', () => {
    freezeFirst = !freezeFirst;
    btnFreeze.classList.toggle('is-active', freezeFirst);
    tableEl.classList.toggle('is-freeze-first', freezeFirst);
  });

  btnCols.addEventListener('click', evt => {
    evt.stopPropagation();
    colMenu.classList.toggle('is-open');
  });

  const toggleDrawer = (open?: boolean): void => {
    const next = open === undefined ? drawer.classList.contains('is-closed') : open;
    drawer.classList.toggle('is-closed', !next);
    btnDrawer.classList.toggle('is-active', next);
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

  const onScroll = (): void => {
    renderBodyRows(false);
  };
  gridWrap.addEventListener('scroll', onScroll, { passive: true });

  const safeSlug = title.replace(/[^\w\u4e00-\u9fff-]+/g, '-').replace(/^-+|-+$/g, '') || 'table';
  const getVisibleIds = () => getActiveCols().map(c => c.index);

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
