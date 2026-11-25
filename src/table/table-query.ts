import {
  ColumnType,
  parseDateTimestamp,
  parseNumericValue,
  parseSemverTuple,
  TableGrid,
  TableRowData,
} from './table-model';

export type SortDirection = 'asc' | 'desc';

export interface SortSpec {
  colIndex: number;
  direction: SortDirection;
}

export interface TableQuery {
  globalQuery: string;
  columnFilters: Record<number, string>;
  sort: SortSpec | null;
}

const zhCollator = new Intl.Collator('zh-Hans-CN', {
  numeric: true,
  sensitivity: 'base',
});

export function compareCellValues(aRaw: string, bRaw: string, type: ColumnType): number {
  const a = aRaw.trim();
  const b = bRaw.trim();
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  if (type === 'number' || type === 'percent') {
    const an = parseNumericValue(a);
    const bn = parseNumericValue(b);
    if (an !== null && bn !== null) return an - bn;
    if (an !== null) return -1;
    if (bn !== null) return 1;
  }

  if (type === 'date') {
    const ad = parseDateTimestamp(a);
    const bd = parseDateTimestamp(b);
    if (ad !== null && bd !== null) return ad - bd;
    if (ad !== null) return -1;
    if (bd !== null) return 1;
  }

  if (type === 'semver') {
    const av = parseSemverTuple(a);
    const bv = parseSemverTuple(b);
    if (av && bv) {
      const len = Math.max(av.length, bv.length);
      for (let i = 0; i < len; i++) {
        const diff = (av[i] ?? 0) - (bv[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return zhCollator.compare(a, b);
    }
  }

  return zhCollator.compare(a, b);
}

export function queryTableRows(grid: TableGrid, query: TableQuery): TableRowData[] {
  const globalTerms = query.globalQuery
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const activeColFilters = Object.entries(query.columnFilters)
    .map(([k, v]) => [Number(k), v.trim().toLowerCase()] as const)
    .filter(([, v]) => Boolean(v));

  let result = grid.rows.filter(row => {
    if (globalTerms.length > 0) {
      const joined = row.cells.map(c => c.text).join(' ').toLowerCase();
      for (const term of globalTerms) {
        if (!joined.includes(term)) return false;
      }
    }
    for (const [colIdx, filterVal] of activeColFilters) {
      const cellText = (row.cells[colIdx]?.text ?? '').toLowerCase();
      if (filterVal.startsWith('!')) {
        const neg = filterVal.slice(1).trim();
        if (neg && cellText.includes(neg)) return false;
      } else if (!cellText.includes(filterVal)) {
        return false;
      }
    }
    return true;
  });

  if (query.sort && !grid.hasSpans) {
    const { colIndex, direction } = query.sort;
    const colType: ColumnType = grid.columns[colIndex]?.type ?? 'text';
    const mult = direction === 'asc' ? 1 : -1;
    result = [...result].sort((ra, rb) => {
      const av = ra.cells[colIndex]?.text ?? '';
      const bv = rb.cells[colIndex]?.text ?? '';
      const aEmpty = !av.trim();
      const bEmpty = !bv.trim();
      if (aEmpty && bEmpty) return ra.rowIndex - rb.rowIndex;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      const cmp = compareCellValues(av, bv, colType);
      return cmp !== 0 ? cmp * mult : ra.rowIndex - rb.rowIndex;
    });
  }

  return result;
}
