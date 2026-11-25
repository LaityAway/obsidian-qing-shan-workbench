import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const PW_PATH = process.env.PLAYWRIGHT_MODULE || '';
const CHROME_PATH = process.env.CHROME_PATH || '';

function resolveChromium() {
  if (PW_PATH && fs.existsSync(PW_PATH)) {
    return require(PW_PATH).chromium;
  }
  try {
    return require('playwright').chromium;
  } catch {
    return null;
  }
}

async function buildStressHarness() {
  const res = await esbuild.build({
    stdin: {
      contents: `
        import { openMermaidLightbox } from './src/mermaid/mermaid-modal';
        import { buildStandaloneSvgString, renderSvgToPngBlob } from './src/mermaid/mermaid-export';
        import { openTableWorkbench } from './src/table/table-modal';
        import { enhanceInlineTable } from './src/table/table-inline';
        import { extractTableGrid } from './src/table/table-model';
        import { serializeToTsv, serializeToCsv, serializeToMarkdown } from './src/table/table-export';
        import { DEFAULT_SETTINGS } from './src/settings';
        import { MarkdownRenderChild } from 'obsidian';
        window.__STRESS__ = {
          openMermaidLightbox,
          buildStandaloneSvgString,
          renderSvgToPngBlob,
          openTableWorkbench,
          enhanceInlineTable,
          extractTableGrid,
          serializeToTsv,
          serializeToCsv,
          serializeToMarkdown,
          DEFAULT_SETTINGS,
          MarkdownRenderChild,
        };
      `,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    plugins: [{
      name: 'mock-obsidian',
      setup(build) {
        build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'mock' }));
        build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
          contents: `
            export const getLanguage = () => 'zh';
            export class Notice { constructor(msg) { window.__NOTICES__ = window.__NOTICES__ || []; window.__NOTICES__.push(msg); } }
            export const setIcon = (el, name) => { el.dataset.icon = name; };
            export class Plugin {}
            export class PluginSettingTab {}
            export class Setting {}
            export class MarkdownRenderChild {
              constructor(el) { this.containerEl = el; this._cbs = []; }
              register(cb) { this._cbs.push(cb); }
              registerDomEvent(el, ev, fn) { el.addEventListener(ev, fn); this._cbs.push(() => el.removeEventListener(ev, fn)); }
              unload() { while (this._cbs.length) this._cbs.pop()(); }
            }
          `,
          loader: 'js',
        }));
      },
    }],
  });
  return res.outputFiles[0].text;
}

test('STRESS 1: 10,000x15 mega-table (150k cells) virtual scroll, sort, filter, keyboard nav & exports', async t => {
  const chromium = resolveChromium();
  if (!chromium) {
    t.skip('Playwright not available');
    return;
  }
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const harness = await buildStressHarness();

  const browser = await chromium.launch({
    headless: true,
    ...(CHROME_PATH && fs.existsSync(CHROME_PATH) ? { executablePath: CHROME_PATH } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.setContent(`<style>body{margin:0}</style><style>${css}</style><body class="theme-light"><table id="mega"><thead><tr></tr></thead><tbody></tbody></table></body>`);
    await page.addScriptTag({ content: harness });

    const metrics = await page.evaluate(() => {
      const ROWS = 10000;
      const COLS = 15;
      const tbl = document.getElementById('mega');
      const headTr = tbl.querySelector('thead tr');
      const labels = ['ID', 'Amount', 'Coverage', 'Updated', 'Version', 'Domain', 'Status', 'Endpoint', 'Owner', 'Latency', 'Module', 'Notes', 'Source', 'Batch', 'Priority'];
      for (let c = 0; c < COLS; c++) {
        const th = document.createElement('th');
        th.textContent = labels[c];
        headTr.appendChild(th);
      }
      const tbody = tbl.querySelector('tbody');
      const frag = document.createDocumentFragment();
      for (let r = 0; r < ROWS; r++) {
        const tr = document.createElement('tr');
        const vals = [
          `DOC-${String(r + 1).padStart(5, '0')}`,
          r % 2 === 0 ? `$${((ROWS - r) * 1.5).toFixed(2)}` : `¥${((r % 90) + 1)}万`,
          `${((r * 7) % 101).toFixed(1)}%`,
          `2026-${String((r % 12) + 1).padStart(2, '0')}-${String((r % 28) + 1).padStart(2, '0')}`,
          `v${r % 3}.${r % 12}.${r % 20}`,
          r % 3 === 0 ? 'Billing' : (r % 3 === 1 ? 'Logistics' : 'Analytics'),
          r % 20 === 0 ? 'Alert' : 'Verified',
          `/api/v1/module-${r % 40}/exec`,
          `Owner-${r % 30}`,
          `${(r * 13) % 2500}ms`,
          `MOD-${r % 50}`,
          r % 25 === 0 ? 'LEDGER_CRITICAL' : 'Standard',
          `Service${r % 80}.ts:${(r % 900) + 10}`,
          `B202611-${r % 100}`,
          r % 10 === 0 ? 'P0' : 'P1',
        ];
        for (let c = 0; c < COLS; c++) {
          const td = document.createElement('td');
          td.textContent = vals[c];
          tr.appendChild(td);
        }
        frag.appendChild(tr);
      }
      tbody.appendChild(frag);

      const handle = window.__STRESS__.openTableWorkbench(tbl, window.__STRESS__.DEFAULT_SETTINGS, 'Mega10k');
      const overlay = document.querySelector('.qs-wb-table-overlay');
      const gridWrap = overlay.querySelector('.qs-wb-grid-wrap');
      let maxMountedDuringScroll = overlay.querySelectorAll('tbody tr.qs-wb-data-row').length;

      const scrollTimes = [];
      for (let i = 0; i < 50; i++) {
        const target = Math.floor((i / 49) * (ROWS * 34 - 600));
        const ts0 = performance.now();
        gridWrap.scrollTop = target;
        gridWrap.dispatchEvent(new Event('scroll'));
        scrollTimes.push(performance.now() - ts0);
        const curMounted = overlay.querySelectorAll('tbody tr.qs-wb-data-row').length;
        if (curMounted > maxMountedDuringScroll) maxMountedDuringScroll = curMounted;
      }
      scrollTimes.sort((a, b) => a - b);
      const scrollP95Ms = scrollTimes[Math.floor(scrollTimes.length * 0.95)];

      const tSort0 = performance.now();
      overlay.querySelectorAll('thead th.qs-wb-th')[1].click();
      const sort10kMs = performance.now() - tSort0;

      const search = overlay.querySelector('.qs-wb-table-search');
      const tFilter0 = performance.now();
      search.value = 'LEDGER_CRITICAL Alert';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      const filter10kMs = performance.now() - tFilter0;

      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      for (let i = 0; i < 80; i++) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      }
      const scrollTopAfterKeys = gridWrap.scrollTop;

      const grid = window.__STRESS__.extractTableGrid(tbl);
      const tsv = window.__STRESS__.serializeToTsv(grid.columns, grid.rows);
      const csv = window.__STRESS__.serializeToCsv(grid.columns, grid.rows);
      const md = window.__STRESS__.serializeToMarkdown(grid.columns, grid.rows);

      handle.close();
      return {
        maxMountedDuringScroll,
        scrollP95Ms: Number(scrollP95Ms.toFixed(2)),
        sort10kMs: Number(sort10kMs.toFixed(1)),
        filter10kMs: Number(filter10kMs.toFixed(1)),
        scrollTopAfterKeys,
        tsvLines: tsv.split('\n').length,
        csvHasBom: csv.charCodeAt(0) === 0xFEFF,
        mdLines: md.split('\n').length,
      };
    });

    assert.ok(metrics.maxMountedDuringScroll < 65);
    assert.ok(metrics.scrollP95Ms < 16);
    assert.ok(metrics.sort10kMs < 300);
    assert.ok(metrics.filter10kMs < 120);
    assert.ok(metrics.scrollTopAfterKeys > 1500);
    assert.equal(metrics.tsvLines, 10001);
    assert.equal(metrics.csvHasBom, true);
    assert.equal(metrics.mdLines, 10002);
  } finally {
    await browser.close();
  }
});

test('STRESS 2: 300-node 450-edge Mermaid diagram dark-to-white switching, 100x zoom/pan, search & clamped PNG export', async t => {
  const chromium = resolveChromium();
  if (!chromium) {
    t.skip('Playwright not available');
    return;
  }
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const harness = await buildStressHarness();

  const browser = await chromium.launch({
    headless: true,
    ...(CHROME_PATH && fs.existsSync(CHROME_PATH) ? { executablePath: CHROME_PATH } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.setContent(`
      <style>body{margin:0;--background-primary:#1e242c;--background-secondary:#181e25;--text-normal:#c4cedb;--text-muted:#8b9bb0;--background-modifier-border:#323d4c;--interactive-accent:#4870ac;}</style>
      <style>${css}</style>
      <body class="theme-dark"><div class="mermaid" id="mm-host"></div></body>
    `);
    await page.addScriptTag({ content: harness });

    const metrics = await page.evaluate(async () => {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('id', 'mermaid-huge-300');
      svg.setAttribute('viewBox', '0 0 5000 3200');
      svg.setAttribute('width', '5000');
      svg.setAttribute('height', '3200');
      svg.setAttribute('xmlns', NS);

      const style = document.createElementNS(NS, 'style');
      style.textContent = `
        #mermaid-huge-300 .edgePath path { fill: none; stroke: #cccccc; stroke-width: 1.5px; }
        #mermaid-huge-300 .node rect { fill: #252d38; stroke: #79a8eb; }
        #mermaid-huge-300 .node text { fill: #dbe7f6; font-size: 12px; }
        #mermaid-huge-300 .messageText { fill: #e2e8f0; font-size: 11px; }
      `;
      svg.appendChild(style);

      const edgesG = document.createElementNS(NS, 'g');
      edgesG.setAttribute('class', 'edgePath');
      for (let e = 0; e < 450; e++) {
        const x1 = (e % 20) * 240 + 80;
        const y1 = Math.floor((e % 300) / 20) * 200 + 60;
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', `M ${x1} ${y1} Q ${x1 + 90} ${y1 + 40} ${x1 + 200} ${y1 + 120}`);
        edgesG.appendChild(p);
      }
      svg.appendChild(edgesG);

      for (let n = 0; n < 300; n++) {
        const col = n % 20;
        const row = Math.floor(n / 20);
        const x = col * 240 + 20;
        const y = row * 200 + 20;
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'node');
        g.setAttribute('id', `nd-${n}`);
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', '170');
        rect.setAttribute('height', '48');
        const txt = document.createElementNS(NS, 'text');
        txt.setAttribute('x', String(x + 85));
        txt.setAttribute('y', String(y + 28));
        txt.textContent = n % 5 === 0 ? `LEDGER_NODE_${n}` : `ENTITY_${n}`;
        g.append(rect, txt);
        svg.appendChild(g);
      }
      document.getElementById('mm-host').appendChild(svg);

      const handle = window.__STRESS__.openMermaidLightbox(svg, window.__STRESS__.DEFAULT_SETTINGS, 'Huge300');
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const overlay = document.querySelector('.qs-wb-mermaid-overlay');
      const stage = overlay.querySelector('.qs-wb-mermaid-stage');

      for (let i = 0; i < 100; i++) {
        stage.dispatchEvent(new WheelEvent('wheel', {
          deltaY: i % 2 === 0 ? -120 : 80,
          clientX: 400 + (i % 10) * 20,
          clientY: 300 + (i % 10) * 15,
          bubbles: true,
          cancelable: true,
        }));
      }
      const hasNaN = overlay.querySelector('.qs-wb-mermaid-canvas').style.transform.includes('NaN');

      const bgBtn = [...overlay.querySelectorAll('.qs-wb-btn')].find(b => b.textContent.includes('主题底'));
      const tWhite0 = performance.now();
      bgBtn.click();
      const firstDarkToWhiteMs = performance.now() - tWhite0;

      const search = overlay.querySelector('.qs-wb-input');
      search.value = 'LEDGER_NODE';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      const matchCount = overlay.querySelectorAll('.qs-wb-node-match').length;

      const { blob, scale, clamped } = await window.__STRESS__.renderSvgToPngBlob(svg, 'white', 3);
      handle.close();

      return { hasNaN, firstDarkToWhiteMs, matchCount, clamped, scale, pngBytes: blob.size };
    });

    assert.equal(metrics.hasNaN, false);
    assert.equal(metrics.matchCount, 60);
    assert.equal(metrics.clamped, true);
    assert.ok(metrics.scale * 5048 <= 8192 + 5);
    assert.ok(metrics.pngBytes > 2000);
    assert.ok(metrics.firstDarkToWhiteMs < 250);
  } finally {
    await browser.close();
  }
});

test('STRESS 3, 4 & 5: 50x modal leak cycle, 1500-row inline enhance/unload, XSS immunity & malformed tables', async t => {
  const chromium = resolveChromium();
  if (!chromium) {
    t.skip('Playwright not available');
    return;
  }
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const harness = await buildStressHarness();

  const browser = await chromium.launch({
    headless: true,
    ...(CHROME_PATH && fs.existsSync(CHROME_PATH) ? { executablePath: CHROME_PATH } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent(`
      <style>body{margin:0}</style><style>${css}</style>
      <body class="theme-light">
        <div class="workspace-leaf-content" data-type="markdown">
          <div class="markdown-reading-view">
            <div class="markdown-preview-view">
              <div class="mermaid"><svg id="mm-leak" viewBox="0 0 200 100" width="200" height="100"><g class="node"><rect width="80" height="40"/><text x="10" y="20">A</text></g></svg></div>
              <div class="el-table" id="inline-host"><table id="inline-1500"><thead><tr><th>#</th><th>Service</th><th>Route</th><th>Status</th><th>Notes</th><th>Source</th></tr></thead><tbody></tbody></table></div>
              <table id="xss-table"><thead><tr><th>Payload</th><th>Link</th></tr></thead><tbody><tr><td>&lt;img src=x onerror="window.__XSS__=1"&gt;</td><td><a href="javascript:window.__XSS__=2">bad</a></td></tr></tbody></table>
              <table id="span-table"><thead><tr><th colspan="2">Merged</th><th>C</th></tr></thead><tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table>
              <table id="headless-table"><tr><td>HeaderlessA</td><td>HeaderlessB</td></tr><tr><td>10</td><td>20</td></tr></table>
            </div>
          </div>
        </div>
      </body>
    `);
    await page.addScriptTag({ content: harness });

    const out = await page.evaluate(() => {
      const t1500 = document.getElementById('inline-1500');
      const tbody = t1500.querySelector('tbody');
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 1500; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i + 1}</td><td>Core</td><td>/api/${i}</td><td>${i % 10 === 0 ? 'Alert' : 'OK'}</td><td>Note ${i}</td><td>A.ts:${i}</td>`;
        frag.appendChild(tr);
      }
      tbody.appendChild(frag);

      const host = document.getElementById('inline-host');
      const child = new window.__STRESS__.MarkdownRenderChild(host);
      const enhanced = window.__STRESS__.enhanceInlineTable(t1500, child, window.__STRESS__.DEFAULT_SETTINGS, { onOpenWorkbench() {} });
      const bar = host.querySelector('.qs-wb-table-bar');
      const barStickyPos = getComputedStyle(bar).position;
      const filterInput = host.querySelector('.qs-wb-inline-filter');
      filterInput.value = 'Alert';
      filterInput.dispatchEvent(new Event('input', { bubbles: true }));
      const hiddenCount = t1500.querySelectorAll('tbody tr.qs-wb-row-hidden').length;
      const freezeBtn = [...host.querySelectorAll('.qs-wb-inline-btn')].find(b => b.textContent.includes('冻结'));
      freezeBtn.click();
      const barHVar = host.style.getPropertyValue('--qs-wb-bar-h');
      child.unload();
      const restoredClean = !host.querySelector('.qs-wb-table-bar')
        && !host.classList.contains('qs-wb-table-frozen')
        && t1500.querySelectorAll('tbody tr.qs-wb-row-hidden').length === 0
        && !t1500.dataset.qsWbTable;

      const svg = document.getElementById('mm-leak');
      const domCountBefore = document.querySelectorAll('*').length;
      for (let i = 0; i < 25; i++) {
        const m = window.__STRESS__.openMermaidLightbox(svg, window.__STRESS__.DEFAULT_SETTINGS, 'L');
        if (i % 2 === 0) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        else m.close();
        const tb = window.__STRESS__.openTableWorkbench(document.getElementById('headless-table'), window.__STRESS__.DEFAULT_SETTINGS, 'T');
        if (i % 2 === 0) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        else tb.close();
      }
      const domCountAfter = document.querySelectorAll('*').length;
      const lingeringOverlays = document.querySelectorAll('.qs-wb-overlay').length;

      const xssHandle = window.__STRESS__.openTableWorkbench(document.getElementById('xss-table'), window.__STRESS__.DEFAULT_SETTINGS, 'XSS');
      const jsLinksMounted = document.querySelectorAll('.qs-wb-table-overlay a[href^="javascript:"]').length;
      xssHandle.close();

      const spanGrid = window.__STRESS__.extractTableGrid(document.getElementById('span-table'));
      const headlessGrid = window.__STRESS__.extractTableGrid(document.getElementById('headless-table'));

      return {
        enhanced,
        barStickyPos,
        hiddenCount,
        barHVar,
        restoredClean,
        domDelta: domCountAfter - domCountBefore,
        lingeringOverlays,
        xssTriggered: Boolean(window.__XSS__),
        jsLinksMounted,
        spanDetected: spanGrid.hasSpans,
        headlessRows: headlessGrid.rows.length,
      };
    });

    assert.equal(out.enhanced, true);
    assert.equal(out.barStickyPos, 'sticky');
    assert.equal(out.hiddenCount, 1350);
    assert.ok(parseInt(out.barHVar, 10) >= 32);
    assert.equal(out.restoredClean, true);
    assert.equal(out.domDelta, 0);
    assert.equal(out.lingeringOverlays, 0);
    assert.equal(out.xssTriggered, false);
    assert.equal(out.jsLinksMounted, 0);
    assert.equal(out.spanDetected, true);
    assert.equal(out.headlessRows, 1);
  } finally {
    await browser.close();
  }
});
