import { TableColumn, TableRowData } from './table-model';

// Neutralize spreadsheet formula injection (=SUM, @SUM, +cmd, -cmd) while keeping
// legitimate numeric negatives/positives (-120, +5.2%) untouched.
const FORMULA_PREFIX_RE = /^(?:[=@\t\r]|[+-](?=[A-Za-z_@(=]))/;

export function sanitizeSpreadsheetCell(raw: string): string {
  const trimmedStart = raw.replace(/^ +/, '');
  if (FORMULA_PREFIX_RE.test(trimmedStart)) {
    return `'${raw}`;
  }
  return raw;
}

function escapeTsvCell(raw: string, sanitizeFormulas: boolean): string {
  let s = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (sanitizeFormulas) s = sanitizeSpreadsheetCell(s);
  if (/[\t\n"]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function escapeCsvCell(raw: string, sanitizeFormulas: boolean): string {
  let s = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (sanitizeFormulas) s = sanitizeSpreadsheetCell(s);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function escapeMdCell(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br>');
}

export function serializeToTsv(
  columns: readonly TableColumn[],
  rows: readonly TableRowData[],
  visibleColIndexes?: readonly number[],
  sanitizeFormulas = true,
): string {
  const colIds = visibleColIndexes ?? columns.map(c => c.index);
  const headerLine = colIds.map(i => escapeTsvCell(columns[i]?.label ?? '', sanitizeFormulas)).join('\t');
  const bodyLines = rows.map(row =>
    colIds.map(i => escapeTsvCell(row.cells[i]?.text ?? '', sanitizeFormulas)).join('\t'),
  );
  return [headerLine, ...bodyLines].join('\n');
}

export function serializeToCsv(
  columns: readonly TableColumn[],
  rows: readonly TableRowData[],
  visibleColIndexes?: readonly number[],
  withBom = true,
  sanitizeFormulas = true,
): string {
  const colIds = visibleColIndexes ?? columns.map(c => c.index);
  const headerLine = colIds.map(i => escapeCsvCell(columns[i]?.label ?? '', sanitizeFormulas)).join(',');
  const bodyLines = rows.map(row =>
    colIds.map(i => escapeCsvCell(row.cells[i]?.text ?? '', sanitizeFormulas)).join(','),
  );
  const content = [headerLine, ...bodyLines].join('\r\n');
  return withBom ? `\uFEFF${content}` : content;
}

export function serializeToMarkdown(
  columns: readonly TableColumn[],
  rows: readonly TableRowData[],
  visibleColIndexes?: readonly number[],
): string {
  const colIds = visibleColIndexes ?? columns.map(c => c.index);
  const header = `| ${colIds.map(i => escapeMdCell(columns[i]?.label ?? '')).join(' | ')} |`;
  const sep = `| ${colIds.map(() => '---').join(' | ')} |`;
  const body = rows.map(
    row => `| ${colIds.map(i => escapeMdCell(row.cells[i]?.text ?? '')).join(' | ')} |`,
  );
  return [header, sep, ...body].join('\n');
}
