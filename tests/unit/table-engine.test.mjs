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

test('mixed ms/s latency and B/KB/MB/GB/TB byte columns detect as number and sort accurately', () => {
  assert.equal(model.detectColumnType(['500ms', '1.2s', '45ms', '2s']), 'number');
  assert.equal(model.detectColumnType(['512B', '2kb', '1.5mb', '1GB', '2TB']), 'number');

  const latencyGrid = {
    hasSpans: false,
    hasExplicitHeader: true,
    columns: [{ index: 0, label: 'Latency', type: 'number' }],
    rows: ['1.2s', '500ms', '2s', '45ms'].map((text, rowIndex) => ({
      rowIndex,
      cells: [{ text, links: [] }],
    })),
  };
  const sortedLatency = query.queryTableRows(latencyGrid, {
    globalQuery: '',
    columnFilters: {},
    sort: { colIndex: 0, direction: 'asc' },
  });
  assert.deepEqual(sortedLatency.map(r => r.cells[0].text), ['45ms', '500ms', '1.2s', '2s']);

  const sizeGrid = {
    hasSpans: false,
    hasExplicitHeader: true,
    columns: [{ index: 0, label: 'Size', type: 'number' }],
    rows: ['1.5mb', '512B', '2TB', '2kb', '1GB'].map((text, rowIndex) => ({
      rowIndex,
      cells: [{ text, links: [] }],
    })),
  };
  const sortedSize = query.queryTableRows(sizeGrid, {
    globalQuery: '',
    columnFilters: {},
    sort: { colIndex: 0, direction: 'asc' },
  });
  assert.deepEqual(sortedSize.map(r => r.cells[0].text), ['512B', '2kb', '1.5mb', '1GB', '2TB']);
});

test('parseDateTimestamp handles single-digit / Chinese dates deterministically and rejects invalid calendar dates', () => {
  const d1 = model.parseDateTimestamp('2026-1-5');
  const d2 = model.parseDateTimestamp('2026/3/9');
  const d3 = model.parseDateTimestamp('2026年3月9日 8:05');
  const d4 = model.parseDateTimestamp('2026年3月9日 08:05:30');
  assert.equal(d1, Date.UTC(2026, 0, 5, 0, 0, 0));
  assert.equal(d2, Date.UTC(2026, 2, 9, 0, 0, 0));
  assert.equal(d3, Date.UTC(2026, 2, 9, 8, 5, 0));
  assert.equal(d4, Date.UTC(2026, 2, 9, 8, 5, 30));
  assert.ok(d1 < d2 && d2 < d3 && d3 < d4);

  assert.equal(model.parseDateTimestamp('2026-02-30'), null);
  assert.equal(model.parseDateTimestamp('2026-04-31'), null);
  assert.equal(model.parseDateTimestamp('2026-13-01'), null);
  assert.equal(model.parseDateTimestamp('2026-05-10 25:00'), null);
  assert.equal(model.detectColumnType(['2026-1-5', '2026年3月9日', '2026/11/25']), 'date');
});
