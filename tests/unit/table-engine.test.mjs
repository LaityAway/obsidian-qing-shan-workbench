import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from '../helpers/load-ts.mjs';

const model = loadTsModule('src/table/table-model.ts');
const query = loadTsModule('src/table/table-query.ts');
const exp = loadTsModule('src/table/table-export.ts');
const virt = loadTsModule('src/table/table-virtual.ts');

test('detectColumnType recognizes currency/units, percentages, dates, semver, and text', () => {
  assert.equal(model.detectColumnType(['¥12,450.80', '¥3.2万', '800', '-120']), 'number');
  assert.equal(model.detectColumnType(['98.5%', '100%', '86.2%', '0%']), 'percent');
  assert.equal(model.detectColumnType(['2026-11-01', '2026-11-24', '2026/10/15']), 'date');
  assert.equal(model.detectColumnType(['v0.6.1', 'v0.10.0', '1.0.0']), 'semver');
  assert.equal(model.detectColumnType(['Billing', 'Orders', 'Inventory']), 'text');
});

test('queryTableRows sorts numbers, semver, Chinese locale, keeps empty values last, and supports !exclude', () => {
  const grid = {
    hasSpans: false,
    hasExplicitHeader: true,
    columns: [
      { index: 0, label: '名称', type: 'text' },
      { index: 1, label: '金额', type: 'number' },
      { index: 2, label: '版本', type: 'semver' },
    ],
    rows: [
      { rowIndex: 0, cells: [{ text: '代养', links: [] }, { text: '¥3.2万', links: [] }, { text: 'v0.10.0', links: [] }] },
      { rowIndex: 1, cells: [{ text: '基地', links: [] }, { text: '¥8,500', links: [] }, { text: 'v0.6.1', links: [] }] },
      { rowIndex: 2, cells: [{ text: '空值行', links: [] }, { text: '', links: [] }, { text: 'v0.2.0', links: [] }] },
      { rowIndex: 3, cells: [{ text: '总账', links: [] }, { text: '¥120,000', links: [] }, { text: 'v1.0.0', links: [] }] },
    ],
  };

  const byMoneyAsc = query.queryTableRows(grid, {
    globalQuery: '',
    columnFilters: {},
    sort: { colIndex: 1, direction: 'asc' },
  });
  assert.deepEqual(byMoneyAsc.map(r => r.cells[0].text), ['基地', '代养', '总账', '空值行']);

  const byVerDesc = query.queryTableRows(grid, {
    globalQuery: '',
    columnFilters: {},
    sort: { colIndex: 2, direction: 'desc' },
  });
  assert.deepEqual(byVerDesc.map(r => r.cells[2].text), ['v1.0.0', 'v0.10.0', 'v0.6.1', 'v0.2.0']);

  const excluded = query.queryTableRows(grid, {
    globalQuery: '',
    columnFilters: { 0: '!空值' },
    sort: null,
  });
  assert.equal(excluded.length, 3);
});

test('serializeToTsv, serializeToCsv (UTF-8 BOM), and serializeToMarkdown escape special chars', () => {
  const cols = [
    { index: 0, label: 'Module', type: 'text' },
    { index: 1, label: 'Notes', type: 'text' },
  ];
  const rows = [
    { rowIndex: 0, cells: [{ text: 'Core|Billing', links: [] }, { text: 'With "quotes", comma\nnewline', links: [] }] },
  ];

  const tsv = exp.serializeToTsv(cols, rows);
  assert.match(tsv, /^Module\tNotes\nCore\|Billing\t"With ""quotes"", comma\nnewline"$/);

  const csv = exp.serializeToCsv(cols, rows, undefined, true);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.ok(csv.includes('"With ""quotes"", comma\nnewline"'));

  const md = exp.serializeToMarkdown(cols, rows);
  assert.ok(md.includes('Core\\|Billing'));
  assert.ok(md.includes('<br>'));
});

test('computeVirtualRange bounds rendered window for 2000 rows', () => {
  const r = virt.computeVirtualRange(2000, 3400, 408, 34, 8);
  assert.equal(r.start, 92);
  assert.equal(r.end, 120);
  assert.equal(r.end - r.start, 28);
  assert.equal(r.topSpacerHeight, 92 * 34);
  assert.equal(r.bottomSpacerHeight, (2000 - 120) * 34);
});
