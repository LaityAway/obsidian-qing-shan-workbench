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

async function buildBrowserHarness() {
  const res = await esbuild.build({
    stdin: {
      contents: `
        import { openMermaidLightbox } from './src/mermaid/mermaid-modal';
        import { buildStandaloneSvgString, renderSvgToPngBlob } from './src/mermaid/mermaid-export';
        import { openTableWorkbench } from './src/table/table-modal';
        import { enhanceInlineTable } from './src/table/table-inline';
        import { DEFAULT_SETTINGS } from './src/settings';
        import { isProtectedTableElement, isPathExcluded } from './src/guard';
        window.__WB__ = {
          openMermaidLightbox,
          buildStandaloneSvgString,
          renderSvgToPngBlob,
          openTableWorkbench,
          enhanceInlineTable,
          DEFAULT_SETTINGS,
          isProtectedTableElement,
          isPathExcluded,
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

test('Chromium E2E: Mermaid lightbox zoom, node search, minimap, dark-to-white adaptation & 2x PNG export', async t => {
  const chromium = resolveChromium();
  if (!chromium) {
    t.skip('Playwright not available (set PLAYWRIGHT_MODULE to run browser tests)');
    return;
  }
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const harness = await buildBrowserHarness();

  const browser = await chromium.launch({
    headless: true,
    ...(CHROME_PATH && fs.existsSync(CHROME_PATH) ? { executablePath: CHROME_PATH } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent(`
      <style>
        body { margin: 0; --background-primary: #1e242c; --background-secondary: #181e25; --text-normal: #c4cedb; --text-muted: #8b9bb0; --background-modifier-border: #323d4c; --interactive-accent: #4870ac; }
      </style>
      <style>${css}</style>
      <body class="theme-dark">
        <div class="mermaid">
          <svg id="mermaid-test-99" viewBox="0 0 600 300" width="600" height="300" xmlns="http://www.w3.org/2000/svg">
            <style>
              #mermaid-test-99 .edgePath path { fill: none; stroke: #cccccc; stroke-width: 2px; }
              #mermaid-test-99 .node rect { fill: #252d38; stroke: #4870ac; }
              #mermaid-test-99 .node text { fill: #dbe7f6; }
              #mermaid-test-99 .messageText { fill: #e2e8f0; }
              #mermaid-test-99 .edgeLabel { background-color: #1e242c; color: #e2e8f0; }
            </style>
            <g class="edgePath"><path id="edge-1" d="M 180 65 Q 260 120 340 205"/></g>
            <text id="bare-msg" class="messageText" x="260" y="30">POST /api/billing/rollup</text>
            <g class="edgeLabel"><foreignObject x="210" y="100" width="90" height="24"><div xmlns="http://www.w3.org/1999/xhtml" class="edgeLabel" id="edge-lbl">Approved</div></foreignObject></g>
            <g class="node" id="n1"><rect x="20" y="40" width="160" height="50"/><text id="box-txt" x="100" y="70">Order Gateway</text></g>
            <g class="node" id="n2"><rect x="340" y="180" width="180" height="50"/><text x="430" y="210">Ledger Settlement</text></g>
          </svg>
        </div>
      </body>
    `);
    await page.addScriptTag({ content: harness });

    const result = await page.evaluate(async () => {
      const svg = document.getElementById('mermaid-test-99');
      const handle = window.__WB__.openMermaidLightbox(svg, window.__WB__.DEFAULT_SETTINGS, 'FlowDiagram');
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const overlay = document.querySelector('.qs-wb-mermaid-overlay');
      const liveEdge = overlay.querySelector('.qs-wb-mermaid-canvas .edgePath path');
      const liveRect = overlay.querySelector('.qs-wb-mermaid-canvas .node rect');
      const liveEdgeFill = getComputedStyle(liveEdge).fill;
      const liveRectFill = getComputedStyle(liveRect).fill;

      const bgBtn = [...overlay.querySelectorAll('.qs-wb-btn')].find(b => b.textContent.includes('主题底'));
      bgBtn.click();
      const whiteBareMsgFill = getComputedStyle(overlay.querySelector('.qs-wb-mermaid-canvas .messageText')).fill;
      const whiteEdgeLabelColor = getComputedStyle(overlay.querySelector('.qs-wb-mermaid-canvas div.edgeLabel')).color;
      const whiteEdgeLabelBg = getComputedStyle(overlay.querySelector('.qs-wb-mermaid-canvas div.edgeLabel')).backgroundColor;
      const whiteBoxTextFill = getComputedStyle(overlay.querySelector('.qs-wb-mermaid-canvas .node text')).fill;
      const whiteEdgeStroke = getComputedStyle(overlay.querySelector('.qs-wb-mermaid-canvas .edgePath path')).stroke;

      const searchInput = overlay.querySelector('.qs-wb-input');
      searchInput.value = 'Ledger';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));

      const matched = overlay.querySelectorAll('.qs-wb-node-match').length;
      const dimmed = overlay.querySelectorAll('.qs-wb-node-dim').length;
      const minimapPresent = Boolean(overlay.querySelector('.qs-wb-minimap svg'));

      const { svgString } = window.__WB__.buildStandaloneSvgString(svg, 'white');
      const { blob, scale } = await window.__WB__.renderSvgToPngBlob(svg, 'white', 2);

      handle.close();
      const closedCleanly = !document.querySelector('.qs-wb-mermaid-overlay');

      return {
        liveEdgeFill,
        liveRectFill,
        whiteBareMsgFill,
        whiteEdgeLabelColor,
        whiteEdgeLabelBg,
        whiteBoxTextFill,
        whiteEdgeStroke,
        exportedHasDarkInkOnBareText: /id="bare-msg"[^>]*style="[^"]*fill:\s*(?:rgb\(30,\s*41,\s*59\)|#1e293b)/.test(svgString),
        exportedPathPreservesFillNone: /<path[^>]*style="[^"]*fill:\s*none/.test(svgString),
        matched,
        dimmed,
        minimapPresent,
        svgHasInlineFill: svgString.includes('fill:') && svgString.includes('#ffffff'),
        pngSize: blob.size,
        pngType: blob.type,
        scale,
        closedCleanly,
      };
    });

    assert.equal(result.liveEdgeFill, 'none');
    assert.equal(result.liveRectFill, 'rgb(37, 45, 56)');
    assert.equal(result.whiteBareMsgFill, 'rgb(30, 41, 59)');
    assert.equal(result.whiteEdgeLabelColor, 'rgb(30, 41, 59)');
    assert.equal(result.whiteEdgeLabelBg, 'rgb(255, 255, 255)');
    assert.equal(result.whiteBoxTextFill, 'rgb(219, 231, 246)');
    assert.notEqual(result.whiteEdgeStroke, 'rgb(204, 204, 204)');
    assert.equal(result.exportedHasDarkInkOnBareText, true);
    assert.equal(result.exportedPathPreservesFillNone, true);
    assert.equal(result.matched, 1);
    assert.ok(result.dimmed >= 1);
    assert.equal(result.minimapPresent, true);
    assert.equal(result.svgHasInlineFill, true);
    assert.equal(result.pngType, 'image/png');
    assert.ok(result.pngSize > 500);
    assert.equal(result.scale, 2);
    assert.equal(result.closedCleanly, true);
  } finally {
    await browser.close();
  }
});

test('Chromium E2E: 2000x13 virtualized table, sorting, drawer links, multiline cells & element guards', async t => {
  const chromium = resolveChromium();
  if (!chromium) {
    t.skip('Playwright not available (set PLAYWRIGHT_MODULE to run browser tests)');
    return;
  }
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const harness = await buildBrowserHarness();

  const browser = await chromium.launch({
    headless: true,
    ...(CHROME_PATH && fs.existsSync(CHROME_PATH) ? { executablePath: CHROME_PATH } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent(`
      <style>body { margin: 0; }</style>
      <style>${css}</style>
      <body class="theme-light">
        <div class="workspace-leaf-content" data-type="markdown">
          <div class="markdown-reading-view">
            <div class="markdown-preview-view">
              <div class="el-table" id="host-big"><table id="big-table"><thead><tr></tr></thead><tbody></tbody></table></div>
              <div class="el-table" id="host-secret"><table id="secret-table"><thead><tr><th>Host</th><th>Password</th></tr></thead><tbody><tr><td>Demo</td><td data-password-toggle="true">••••</td></tr></tbody></table></div>
              <div class="bases-view"><table id="bases-table"><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></div>
            </div>
          </div>
        </div>
      </body>
    `);
    await page.addScriptTag({ content: harness });

    const metrics = await page.evaluate(() => {
      const tbl = document.getElementById('big-table');
      const headTr = tbl.querySelector('thead tr');
      for (let c = 0; c < 13; c++) {
        const th = document.createElement('th');
        th.textContent = c === 0 ? 'Code' : (c === 1 ? 'Latency' : `Field${c}`);
        headTr.appendChild(th);
      }
      const tbody = tbl.querySelector('tbody');
      const frag = document.createDocumentFragment();
      for (let r = 0; r < 2000; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < 13; c++) {
          const td = document.createElement('td');
          if (c === 0) td.textContent = `ROW-${String(r + 1).padStart(4, '0')}`;
          else if (c === 1) td.textContent = `${(2000 - r) * 3}ms`;
          else td.textContent = r % 50 === 0 && c === 2 ? 'TARGET_KEY' : `val-${r}-${c}`;
          tr.appendChild(td);
        }
        frag.appendChild(tr);
      }
      tbody.appendChild(frag);

      const secretProtected = window.__WB__.isProtectedTableElement(document.getElementById('secret-table'));
      const basesProtected = window.__WB__.isProtectedTableElement(document.getElementById('bases-table'));
      const bigProtected = window.__WB__.isProtectedTableElement(tbl);

      let openedLink = null;
      const handle = window.__WB__.openTableWorkbench(tbl, window.__WB__.DEFAULT_SETTINGS, {
        title: 'Stress2000',
        onOpenInternalLink: href => { openedLink = href; },
      });

      const overlay = document.querySelector('.qs-wb-table-overlay');
      const mountedDataRows = overlay.querySelectorAll('tbody tr.qs-wb-data-row').length;
      const drawerFields = overlay.querySelectorAll('.qs-wb-field-card').length;

      const t1 = performance.now();
      const search = overlay.querySelector('.qs-wb-table-search');
      search.value = 'TARGET_KEY';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      overlay.querySelectorAll('thead th.qs-wb-th')[1].click();
      const queryAndSortMs = performance.now() - t1;

      const firstFilteredCell = overlay.querySelector('tbody tr.qs-wb-data-row td')?.textContent;
      const filteredStat = overlay.querySelector('.qs-wb-meta')?.textContent;

      const linkTbl = document.createElement('table');
      linkTbl.innerHTML = '<thead><tr><th>Note</th><th>Multiline</th></tr></thead><tbody><tr><td><a class="internal-link" data-href="Docs/Architecture">Architecture</a></td><td><div class="cm-line">Line 1</div><div class="cm-line">Line 2</div></td></tr></tbody>';
      document.body.appendChild(linkTbl);
      handle.close();

      const linkHandle = window.__WB__.openTableWorkbench(linkTbl, window.__WB__.DEFAULT_SETTINGS, {
        title: 'LinkCheck',
        onOpenInternalLink: href => { openedLink = href; },
      });
      const drawerVals = [...document.querySelectorAll('.qs-wb-table-overlay .qs-wb-field-v')].map(el => el.textContent);
      const internalAnchor = document.querySelector('.qs-wb-table-overlay .qs-wb-link.is-internal');
      internalAnchor?.click();
      const modalClosedAfterLink = !document.querySelector('.qs-wb-table-overlay');
      linkHandle.close();
      linkTbl.remove();

      return {
        secretProtected,
        basesProtected,
        bigProtected,
        queryAndSortMs: Number(queryAndSortMs.toFixed(1)),
        mountedDataRows,
        drawerFields,
        firstFilteredCell,
        filteredStat,
        openedLink,
        modalClosedAfterLink,
        multilineText: drawerVals[1],
      };
    });

    assert.equal(metrics.secretProtected, true);
    assert.equal(metrics.basesProtected, true);
    assert.equal(metrics.bigProtected, false);
    assert.ok(metrics.mountedDataRows > 0 && metrics.mountedDataRows < 60);
    assert.equal(metrics.drawerFields, 13);
    assert.ok(metrics.queryAndSortMs < 150);
    assert.equal(metrics.firstFilteredCell, 'ROW-1951');
    assert.ok(metrics.filteredStat.startsWith('40 / 2000'));
    assert.equal(metrics.openedLink, 'Docs/Architecture');
    assert.equal(metrics.modalClosedAfterLink, true);
    assert.equal(metrics.multilineText, 'Line 1\nLine 2');
  } finally {
    await browser.close();
  }
});
