export type ColumnType = 'number' | 'percent' | 'date' | 'semver' | 'text';

export interface CellLink {
  text: string;
  href: string;
  isInternal: boolean;
}

export interface TableCellData {
  text: string;
  links: CellLink[];
}

export interface TableColumn {
  index: number;
  label: string;
  type: ColumnType;
}

export interface TableRowData {
  rowIndex: number;
  cells: TableCellData[];
}

export interface TableGrid {
  columns: TableColumn[];
  rows: TableRowData[];
  hasSpans: boolean;
  hasExplicitHeader: boolean;
}

const PERCENT_RE = /^[+-]?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*%$|^[+-]?\d+(?:\.\d+)?\s*%$/;
const NUMBER_RE = /^[+-]?\s*[¥$€£]?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:万|亿|千|k|K|m|M|ms|s|px|KB|MB|GB|%)?$|^[+-]?\s*[¥$€£]?\s*\d+(?:\.\d+)?\s*(?:万|亿|千|k|K|m|M|ms|s|px|KB|MB|GB)?$/;
const DATE_RE = /^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}(?:日)?(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/;
const SEMVER_RE = /^v?\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?$/;

export function parseNumericValue(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  let multiplier = 1;
  let cleaned = s.replace(/[¥$€£,\s]/g, '');
  if (cleaned.endsWith('亿')) { multiplier = 1e8; cleaned = cleaned.slice(0, -1); }
  else if (cleaned.endsWith('万')) { multiplier = 1e4; cleaned = cleaned.slice(0, -1); }
  else if (cleaned.endsWith('千')) { multiplier = 1e3; cleaned = cleaned.slice(0, -1); }
  else if (/ms$/i.test(cleaned)) { cleaned = cleaned.slice(0, -2); }
  else if (/px$/i.test(cleaned)) { cleaned = cleaned.slice(0, -2); }
  else if (/kb$/i.test(cleaned)) { multiplier = 1024; cleaned = cleaned.slice(0, -2); }
  else if (/mb$/i.test(cleaned)) { multiplier = 1024 * 1024; cleaned = cleaned.slice(0, -2); }
  else if (/gb$/i.test(cleaned)) { multiplier = 1024 * 1024 * 1024; cleaned = cleaned.slice(0, -2); }
  else if (/[kK]$/.test(cleaned)) { multiplier = 1e3; cleaned = cleaned.slice(0, -1); }
  else if (/[mM]$/.test(cleaned)) { multiplier = 1e6; cleaned = cleaned.slice(0, -1); }
  else if (cleaned.endsWith('%')) { cleaned = cleaned.slice(0, -1); }
  else if (cleaned.endsWith('s')) { cleaned = cleaned.slice(0, -1); }
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n * multiplier : null;
}

export function parseDateTimestamp(raw: string): number | null {
  const s = raw.trim();
  if (!DATE_RE.test(s)) return null;
  const iso = s
    .replace(/年|月/g, '-')
    .replace(/日/g, '')
    .replace(/\//g, '-')
    .replace(' ', 'T');
  const ts = Date.parse(iso);
  return Number.isFinite(ts) ? ts : null;
}

export function parseSemverTuple(raw: string): number[] | null {
  const s = raw.trim();
  if (!SEMVER_RE.test(s)) return null;
  const core = s.replace(/^v/i, '').split('-')[0];
  return core.split('.').map(part => Number(part));
}

export function detectColumnType(values: readonly string[]): ColumnType {
  const sample = values.map(v => v.trim()).filter(Boolean).slice(0, 50);
  if (sample.length === 0) return 'text';
  const threshold = Math.ceil(sample.length * 0.75);

  if (sample.filter(v => PERCENT_RE.test(v)).length >= threshold) return 'percent';
  if (sample.filter(v => DATE_RE.test(v) && parseDateTimestamp(v) !== null).length >= threshold) return 'date';
  if (sample.filter(v => SEMVER_RE.test(v)).length >= threshold) return 'semver';
  if (sample.filter(v => NUMBER_RE.test(v) && parseNumericValue(v) !== null).length >= threshold) return 'number';
  return 'text';
}

function normalizeCellText(el: Element, isLivePreviewTable: boolean): string {
  // Fast path: plain-text cells without child elements need zero DOM queries.
  if (!el.firstElementChild) {
    const raw = (el.textContent || '').replace(/\u200B/g, '').trim();
    return raw.includes('\n') ? raw.replace(/\s*\n\s*/g, '\n') : raw;
  }
  if (isLivePreviewTable) {
    const cmLines = el.querySelectorAll('.cm-line');
    if (cmLines.length > 0) {
      return Array.from(cmLines)
        .map(line => (line.textContent || '').replace(/\u200B/g, '').trim())
        .join('\n')
        .trim();
    }
  }
  const text = (el.textContent || '').replace(/\u200B/g, '').trim();
  return text.includes('\n') ? text.replace(/\s*\n\s*/g, '\n') : text;
}

function extractCellLinks(el: Element): CellLink[] {
  if (!el.firstElementChild) return [];
  const anchors = el.querySelectorAll('a.internal-link, a.external-link, a[href]');
  if (anchors.length === 0) return [];
  const out: CellLink[] = [];
  for (const a of Array.from(anchors)) {
    const text = (a.textContent || '').trim();
    const isInternal = a.classList.contains('internal-link');
    const href = (a.getAttribute('data-href') || a.getAttribute('href') || '').trim();
    if (!href || !text) continue;
    if (!isInternal && !/^https?:\/\//i.test(href)) continue;
    out.push({ text, href, isInternal });
  }
  return out;
}

export function extractTableGrid(table: HTMLTableElement): TableGrid {
  let hasSpans = false;
  const isLivePreviewTable = Boolean(table.closest?.('.cm-table-widget') || table.querySelector?.('.cm-line'));
  const checkSpans = (cells: HTMLCollectionOf<HTMLTableCellElement> | Element[]): void => {
    for (const c of Array.from(cells)) {
      if (c.hasAttribute('colspan') || c.hasAttribute('rowspan')) {
        const cs = Number(c.getAttribute('colspan') || '1');
        const rs = Number(c.getAttribute('rowspan') || '1');
        if (cs > 1 || rs > 1) hasSpans = true;
      }
    }
  };

  const theadRow = table.querySelector('thead tr');
  const tbodyRows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr'));
  const allRows = tbodyRows.length > 0 ? tbodyRows : Array.from(table.querySelectorAll<HTMLTableRowElement>('tr'));

  let headerLabels: string[] = [];
  let dataRowsEls: HTMLTableRowElement[] = [];
  let hasExplicitHeader = false;

  if (theadRow) {
    hasExplicitHeader = true;
    const ths = Array.from(theadRow.children).filter(el => el.tagName === 'TH' || el.tagName === 'TD');
    checkSpans(ths);
    headerLabels = ths.map((th, i) => normalizeCellText(th, isLivePreviewTable) || `Col ${i + 1}`);
    dataRowsEls = tbodyRows;
  } else if (allRows.length > 0) {
    const firstCells = Array.from(allRows[0].children).filter(el => el.tagName === 'TH' || el.tagName === 'TD');
    checkSpans(firstCells);
    headerLabels = firstCells.map((c, i) => normalizeCellText(c, isLivePreviewTable) || `Col ${i + 1}`);
    dataRowsEls = allRows.slice(1);
  }

  let maxCols = headerLabels.length;
  const rawRows: TableCellData[][] = [];

  for (const tr of dataRowsEls) {
    const cellEls = Array.from(tr.children).filter(el => el.tagName === 'TD' || el.tagName === 'TH');
    checkSpans(cellEls);
    if (cellEls.length > maxCols) maxCols = cellEls.length;
    rawRows.push(
      cellEls.map(cell => ({
        text: normalizeCellText(cell, isLivePreviewTable),
        links: extractCellLinks(cell),
      })),
    );
  }

  while (headerLabels.length < maxCols) {
    headerLabels.push(`Col ${headerLabels.length + 1}`);
  }

  const rows: TableRowData[] = rawRows.map((cells, rowIndex) => {
    const padded = cells.slice();
    while (padded.length < maxCols) padded.push({ text: '', links: [] });
    return { rowIndex, cells: padded };
  });

  const columns: TableColumn[] = headerLabels.map((label, index) => ({
    index,
    label,
    type: detectColumnType(rows.map(r => r.cells[index]?.text ?? '')),
  }));

  return { columns, rows, hasSpans, hasExplicitHeader };
}
