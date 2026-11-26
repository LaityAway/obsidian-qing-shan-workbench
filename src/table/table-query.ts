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
  sort: SortSpec | readonly SortSpec[] | null;
}

export interface ColumnSummary {
  colIndex: number;
  label: string;
  type: 'number' | 'percent';
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

const zhCollator = new Intl.Collator('zh-Hans-CN', {
  numeric: true,
  sensitivity: 'base',
});

type ParsedSortKey = number | number[] | string | null;

// Per-grid, per-column Schwartzian sort-key cache so repeated asc/desc toggles
// or multi-column sorts avoid O(N log N) regex re-parsing.
const sortKeyCache = new WeakMap<TableGrid, Map<number, ParsedSortKey[]>>();

function parseKeyForType(raw: string, type: ColumnType): ParsedSortKey {
  const s = raw.trim();
  if (!s) return null;
  if (type === 'number' || type === 'percent') {
    return parseNumericValue(s);
  }
  if (type === 'date') {
    return parseDateTimestamp(s);
  }
  if (type === 'semver') {
    return parseSemverTuple(s);
  }
  return s;
}

function getColumnSortKeys(grid: TableGrid, colIndex: number, colType: ColumnType): ParsedSortKey[] {
  let byCol = sortKeyCache.get(grid);
  if (!byCol) {
    byCol = new Map<number, ParsedSortKey[]>();
    sortKeyCache.set(grid, byCol);
  }
  const existing = byCol.get(colIndex);
  if (existing && existing.length === grid.rows.length) {
    return existing;
  }
  const keys: ParsedSortKey[] = new Array<ParsedSortKey>(grid.rows.length).fill(null);
  for (let i = 0; i < grid.rows.length; i++) {
    const row = grid.rows[i];
    const idx = row.rowIndex >= 0 && row.rowIndex < grid.rows.length ? row.rowIndex : i;
    keys[idx] = parseKeyForType(row.cells[colIndex]?.text ?? '', colType);
  }
  byCol.set(colIndex, keys);
  return keys;
}

function compareSemverTuples(av: readonly number[], bv: readonly number[]): number {
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i++) {
    const diff = (av[i] ?? 0) - (bv[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function compareParsedKeys(
  ak: ParsedSortKey,
  bk: ParsedSortKey,
  aRaw: string,
  bRaw: string,
  type: ColumnType,
): number {
  if (type === 'number' || type === 'percent' || type === 'date') {
    const an = typeof ak === 'number' ? ak : null;
    const bn = typeof bk === 'number' ? bk : null;
    if (an !== null && bn !== null) return an - bn;
    if (an !== null) return -1;
    if (bn !== null) return 1;
    return zhCollator.compare(aRaw.trim(), bRaw.trim());
  }
  if (type === 'semver') {
    const av = Array.isArray(ak) ? ak : null;
    const bv = Array.isArray(bk) ? bk : null;
    if (av && bv) {
      const diff = compareSemverTuples(av, bv);
      return diff !== 0 ? diff : zhCollator.compare(aRaw.trim(), bRaw.trim());
    }
    if (av) return -1;
    if (bv) return 1;
    return zhCollator.compare(aRaw.trim(), bRaw.trim());
  }
  return zhCollator.compare(aRaw.trim(), bRaw.trim());
}

export function compareCellValues(aRaw: string, bRaw: string, type: ColumnType): number {
  const a = aRaw.trim();
  const b = bRaw.trim();
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return compareParsedKeys(parseKeyForType(a, type), parseKeyForType(b, type), a, b, type);
}

const COMPARE_OP_RE = /^(>=|<=|>|<)\s*(.+)$/;
const RANGE_EXPR_RE = /^(.+?)\.\.(.+)$/;

interface CompiledBranch {
  kind: 'compare' | 'range' | 'substring';
  op?: '>=' | '<=' | '>' | '<';
  target?: number | number[];
  lo?: number | number[];
  hi?: number | number[];
  substr?: string;
}

interface CompiledColFilter {
  colIndex: number;
  colType: ColumnType;
  negate: boolean;
  branches: CompiledBranch[];
}

function parseComparableOperand(raw: string, colType: ColumnType): number | number[] | null {
  const s = raw.trim();
  if (!s) return null;
  if (colType === 'date') return parseDateTimestamp(s);
  if (colType === 'semver') return parseSemverTuple(s);
  if (colType === 'number' || colType === 'percent') return parseNumericValue(s);
  // Allow numeric/date comparison even on mixed/text columns when operand is clearly numeric or date
  const dateVal = parseDateTimestamp(s);
  if (dateVal !== null) return dateVal;
  return parseNumericValue(s);
}

function compareTypedScalar(
  cellVal: number | number[],
  targetVal: number | number[],
): number | null {
  if (typeof cellVal === 'number' && typeof targetVal === 'number') {
    return cellVal - targetVal;
  }
  if (Array.isArray(cellVal) && Array.isArray(targetVal)) {
    return compareSemverTuples(cellVal, targetVal);
  }
  return null;
}

function compileBranch(rawPart: string, colType: ColumnType): CompiledBranch | null {
  const part = rawPart.trim();
  if (!part) return null;

  const cmpMatch = COMPARE_OP_RE.exec(part);
  if (cmpMatch) {
    const op = cmpMatch[1] as '>=' | '<=' | '>' | '<';
    const target = parseComparableOperand(cmpMatch[2], colType);
    if (target !== null) {
      return { kind: 'compare', op, target };
    }
  }

  const rangeMatch = RANGE_EXPR_RE.exec(part);
  if (rangeMatch) {
    const lo = parseComparableOperand(rangeMatch[1], colType);
    const hi = parseComparableOperand(rangeMatch[2], colType);
    if (lo !== null && hi !== null && typeof lo === typeof hi) {
      return { kind: 'range', lo, hi };
    }
  }

  return { kind: 'substring', substr: part.toLowerCase() };
}

function compileColumnFilter(colIndex: number, rawExpr: string, colType: ColumnType): CompiledColFilter | null {
  const trimmed = rawExpr.trim();
  if (!trimmed) return null;
  const negate = trimmed.startsWith('!');
  const body = negate ? trimmed.slice(1).trim() : trimmed;
  if (!body) return null;

  const rawBranches = body.split('|');
  const branches: CompiledBranch[] = [];
  for (const part of rawBranches) {
    const compiled = compileBranch(part, colType);
    if (compiled) branches.push(compiled);
  }
  if (branches.length === 0) return null;
  return { colIndex, colType, negate, branches };
}

function matchesCompiledBranch(cellRaw: string, cellLower: string, branch: CompiledBranch, colType: ColumnType): boolean {
  if (branch.kind === 'substring') {
    return cellLower.includes(branch.substr ?? '');
  }
  const cellVal = parseComparableOperand(cellRaw, colType);
  if (cellVal === null) return false;
  if (branch.kind === 'compare' && branch.target !== undefined) {
    const diff = compareTypedScalar(cellVal, branch.target);
    if (diff === null) return false;
    if (branch.op === '>') return diff > 0;
    if (branch.op === '>=') return diff >= 0;
    if (branch.op === '<') return diff < 0;
    if (branch.op === '<=') return diff <= 0;
    return false;
  }
  if (branch.kind === 'range' && branch.lo !== undefined && branch.hi !== undefined) {
    const dLo = compareTypedScalar(cellVal, branch.lo);
    const dHi = compareTypedScalar(cellVal, branch.hi);
    if (dLo === null || dHi === null) return false;
    return dLo >= 0 && dHi <= 0;
  }
  return false;
}

export function extractHighlightTerms(globalQuery: string, colFilterExpr?: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (term: string): void => {
    const cleaned = term.trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) return;
    seen.add(key);
    out.push(cleaned);
  };

  for (const t of globalQuery.trim().split(/\s+/)) {
    if (t) add(t);
  }

  if (colFilterExpr) {
    const trimmed = colFilterExpr.trim();
    if (trimmed && !trimmed.startsWith('!')) {
      for (const part of trimmed.split('|')) {
        const p = part.trim();
        if (!p || COMPARE_OP_RE.test(p) || RANGE_EXPR_RE.test(p)) continue;
        add(p);
      }
    }
  }
  return out;
}

function normalizeSortSpecs(sort: TableQuery['sort']): readonly SortSpec[] {
  if (!sort) return [];
  if (Array.isArray(sort)) return sort as readonly SortSpec[];
  return [sort as SortSpec];
}

export function queryTableRows(grid: TableGrid, query: TableQuery): TableRowData[] {
  const globalTerms = query.globalQuery
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const compiledFilters: CompiledColFilter[] = [];
  for (const [k, v] of Object.entries(query.columnFilters)) {
    const colIdx = Number(k);
    const colType = grid.columns[colIdx]?.type ?? 'text';
    const compiled = compileColumnFilter(colIdx, v, colType);
    if (compiled) compiledFilters.push(compiled);
  }

  let result = grid.rows.filter(row => {
    if (globalTerms.length > 0) {
      let blob = row.searchText;
      if (blob === undefined) {
        blob = row.cells.map(c => c.text).join(' ').toLowerCase();
        row.searchText = blob;
      }
      for (const term of globalTerms) {
        if (!blob.includes(term)) return false;
      }
    }
    for (const f of compiledFilters) {
      const cellRaw = row.cells[f.colIndex]?.text ?? '';
      const cellLower = cellRaw.toLowerCase();
      let matchedAny = false;
      for (const branch of f.branches) {
        if (matchesCompiledBranch(cellRaw, cellLower, branch, f.colType)) {
          matchedAny = true;
          break;
        }
      }
      if (f.negate ? matchedAny : !matchedAny) return false;
    }
    return true;
  });

  const sortSpecs = grid.hasSpans ? [] : normalizeSortSpecs(query.sort);
  if (sortSpecs.length > 0 && result.length > 1) {
    const prepared = sortSpecs.map(spec => {
      const colType: ColumnType = grid.columns[spec.colIndex]?.type ?? 'text';
      return {
        colIndex: spec.colIndex,
        colType,
        mult: spec.direction === 'asc' ? 1 : -1,
        keys: getColumnSortKeys(grid, spec.colIndex, colType),
      };
    });

    result = [...result].sort((ra, rb) => {
      for (const s of prepared) {
        const av = ra.cells[s.colIndex]?.text ?? '';
        const bv = rb.cells[s.colIndex]?.text ?? '';
        const aEmpty = !av.trim();
        const bEmpty = !bv.trim();
        if (aEmpty && bEmpty) continue;
        if (aEmpty) return 1;
        if (bEmpty) return -1;
        const ak = s.keys[ra.rowIndex] !== undefined ? s.keys[ra.rowIndex] : parseKeyForType(av, s.colType);
        const bk = s.keys[rb.rowIndex] !== undefined ? s.keys[rb.rowIndex] : parseKeyForType(bv, s.colType);
        const cmp = compareParsedKeys(ak, bk, av, bv, s.colType);
        if (cmp !== 0) return cmp * s.mult;
      }
      return ra.rowIndex - rb.rowIndex;
    });
  }

  return result;
}

export function computeColumnSummaries(
  grid: TableGrid,
  rows: readonly TableRowData[],
  visibleColIndexes?: readonly number[],
): ColumnSummary[] {
  const colSet = visibleColIndexes ? new Set(visibleColIndexes) : null;
  const out: ColumnSummary[] = [];
  for (const col of grid.columns) {
    if (colSet && !colSet.has(col.index)) continue;
    if (col.type !== 'number' && col.type !== 'percent') continue;
    let count = 0;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const row of rows) {
      const raw = row.cells[col.index]?.text ?? '';
      if (!raw.trim()) continue;
      const val = parseNumericValue(raw);
      if (val === null) continue;
      count++;
      sum += val;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    if (count === 0) continue;
    out.push({
      colIndex: col.index,
      label: col.label,
      type: col.type,
      count,
      sum,
      avg: sum / count,
      min,
      max,
    });
  }
  return out;
}

export function formatSummaryValue(value: number, type: 'number' | 'percent'): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const maxFrac = abs >= 1000 ? 1 : (abs >= 1 ? 2 : 3);
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: maxFrac,
  }).format(value);
  return type === 'percent' ? `${formatted}%` : formatted;
}
