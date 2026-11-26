import { MarkdownRenderChild, Notice } from 'obsidian';
import { WorkbenchSettings } from '../settings';
import { t } from '../i18n';
import { createIconButton } from '../ui/icons';
import { extractTableGrid } from './table-model';
import { serializeToTsv } from './table-export';
import { shouldEnhanceTableInline } from '../guard';

export interface InlineTableCallbacks {
  onOpenWorkbench(table: HTMLTableElement): void;
}

export function enhanceInlineTable(
  table: HTMLTableElement,
  child: MarkdownRenderChild,
  settings: WorkbenchSettings,
  callbacks: InlineTableCallbacks,
): boolean {
  if (table.dataset.qsWbTable === '1') return false;

  const theadCols = table.querySelectorAll('thead tr:first-child th, thead tr:first-child td').length;
  const firstRowCols = table.querySelectorAll('tr:first-child th, tr:first-child td').length;
  const colCount = theadCols || firstRowCols;
  const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
  const rowCount = bodyRows.length;

  if (!shouldEnhanceTableInline(colCount, rowCount, settings.inlineMinColumns, settings.inlineMinRows)) {
    return false;
  }

  const parent = table.parentElement;
  if (!parent) return false;

  const doc = table.ownerDocument;
  const dedicatedHost = parent.classList.contains('table-wrapper')
    ? parent
    : (parent.classList.contains('el-table') && parent.querySelectorAll('table').length === 1 ? parent : null);

  let host: HTMLElement;
  let createdWrapper: HTMLDivElement | null = null;
  if (dedicatedHost) {
    host = dedicatedHost;
  } else {
    // Isolate bare / callout HTML tables so freezing or toolbar insertion never affects sibling paragraphs.
    createdWrapper = doc.createElement('div');
    createdWrapper.className = 'qs-wb-table-wrap';
    parent.insertBefore(createdWrapper, table);
    createdWrapper.appendChild(table);
    host = createdWrapper;
  }

  table.dataset.qsWbTable = '1';

  const bar = doc.createElement('div');
  bar.className = 'qs-wb-inline-bar qs-wb-table-bar';

  const meta = doc.createElement('span');
  meta.className = 'qs-wb-inline-meta';
  meta.textContent = `${rowCount}×${colCount}`;

  const filterInput = doc.createElement('input');
  filterInput.type = 'search';
  filterInput.className = 'qs-wb-inline-filter';
  filterInput.placeholder = t('页内筛选...', 'Quick filter...');

  const btnFreeze = createIconButton(
    doc,
    'pin',
    t('冻结表头与首列', 'Toggle sticky header & first column'),
    t('冻结', 'Freeze'),
    'qs-wb-inline-btn',
  );
  const btnCopy = createIconButton(
    doc,
    'copy',
    t('复制为 TSV（直贴 Excel / 钉钉）', 'Copy as TSV (Excel / spreadsheet ready)'),
    'TSV',
    'qs-wb-inline-btn',
  );
  const btnExpand = createIconButton(
    doc,
    'maximize-2',
    t('在全屏宽表工作台打开', 'Open in wide-table workbench'),
    t('工作台', 'Workbench'),
    'qs-wb-inline-btn is-primary',
  );

  bar.append(meta, filterInput, btnFreeze, btnCopy, btnExpand);

  host.classList.add('qs-wb-table-host');
  host.style.setProperty('--qs-wb-inline-max-h', `${settings.inlineMaxHeight}px`);
  host.insertBefore(bar, host.firstChild);

  let frozen = false;
  let barObserver: ResizeObserver | null = null;
  let cachedRowTexts: string[] | null = null;

  const syncBarHeight = (): void => {
    if (!frozen) return;
    const barH = Math.max(32, Math.ceil(bar.getBoundingClientRect().height || 36));
    host.style.setProperty('--qs-wb-bar-h', `${barH}px`);
  };

  const disconnectBarObserver = (): void => {
    barObserver?.disconnect();
    barObserver = null;
  };

  const setFrozen = (next: boolean): void => {
    frozen = next;
    host.classList.toggle('qs-wb-table-frozen', frozen);
    btnFreeze.classList.toggle('is-active', frozen);
    if (frozen) {
      syncBarHeight();
      disconnectBarObserver();
      const RO = doc.defaultView?.ResizeObserver ?? (typeof ResizeObserver === 'function' ? ResizeObserver : null);
      if (RO) {
        barObserver = new RO(() => syncBarHeight());
        barObserver.observe(bar);
      }
    } else {
      disconnectBarObserver();
      host.style.removeProperty('--qs-wb-bar-h');
    }
  };

  const applyFilter = (): void => {
    const q = filterInput.value.trim().toLowerCase();
    if (cachedRowTexts === null) {
      cachedRowTexts = bodyRows.map(tr => (tr.textContent || '').toLowerCase());
    }
    let visible = 0;
    for (let i = 0; i < bodyRows.length; i++) {
      const match = !q || cachedRowTexts[i].includes(q);
      bodyRows[i].classList.toggle('qs-wb-row-hidden', !match);
      if (match) visible++;
    }
    meta.textContent = q ? `${visible}/${rowCount}×${colCount}` : `${rowCount}×${colCount}`;
  };

  child.registerDomEvent(filterInput, 'input', applyFilter);
  child.registerDomEvent(btnFreeze, 'click', evt => {
    evt.preventDefault();
    evt.stopPropagation();
    setFrozen(!frozen);
  });
  child.registerDomEvent(btnCopy, 'click', evt => {
    evt.preventDefault();
    evt.stopPropagation();
    void (async () => {
      try {
        const grid = extractTableGrid(table);
        const visibleRows = grid.rows.filter((_, idx) => !bodyRows[idx]?.classList.contains('qs-wb-row-hidden'));
        const tsv = serializeToTsv(grid.columns, visibleRows);
        const nav = doc.defaultView?.navigator || navigator;
        await nav.clipboard.writeText(tsv);
        new Notice(t(`已复制 ${visibleRows.length} 行 TSV（可直贴 Excel/钉钉）`, `Copied ${visibleRows.length} rows as TSV`));
      } catch {
        new Notice(t('复制 TSV 失败', 'Failed to copy TSV'));
      }
    })();
  });
  child.registerDomEvent(btnExpand, 'click', evt => {
    evt.preventDefault();
    evt.stopPropagation();
    callbacks.onOpenWorkbench(table);
  });

  child.register(() => {
    disconnectBarObserver();
    cachedRowTexts = null;
    for (const tr of bodyRows) tr.classList.remove('qs-wb-row-hidden');
    host.classList.remove('qs-wb-table-host', 'qs-wb-table-frozen');
    host.style.removeProperty('--qs-wb-inline-max-h');
    host.style.removeProperty('--qs-wb-bar-h');
    bar.remove();
    if (createdWrapper && createdWrapper.parentElement) {
      createdWrapper.parentElement.insertBefore(table, createdWrapper);
      createdWrapper.remove();
    }
    delete table.dataset.qsWbTable;
  });
  return true;
}
