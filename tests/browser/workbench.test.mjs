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
        import { getNodeCenterInSvg } from './src/mermaid/mermaid-search';
        import { openTableWorkbench } from './src/table/table-modal';
        import { enhanceInlineTable } from './src/table/table-inline';
        import { LivePreviewTriggerManager } from './src/detectors/editor-detector';
        import { DEFAULT_SETTINGS } from './src/settings';
        import { isProtectedTableElement, isPathExcluded } from './src/guard';
        import { MarkdownRenderChild, MarkdownView } from 'obsidian';
        window.__WB__ = {
          openMermaidLightbox,
          buildStandaloneSvgString,
          renderSvgToPngBlob,
          getNodeCenterInSvg,
          openTableWorkbench,
          enhanceInlineTable,
          LivePreviewTriggerManager,
          MarkdownRenderChild,
          MarkdownView,
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
            export class MarkdownView {}
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

test('Chromium E2E: P0/P1 regressions (transform search center, inline opacity dim, cluster non-dim, g#root bare text, callout wrap/print, LP toggle, blur cleanup)', async t => {
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
          <svg id="mermaid-v11" viewBox="0 0 1000 500" width="1000" height="500" xmlns="http://www.w3.org/2000/svg">
            <style>
              #mermaid-v11 .node { opacity: 1; }
              #mermaid-v11 .node rect { fill: #252d38; stroke: #4870ac; }
              #mermaid-v11 .node text { fill: #dbe7f6; }
              #mermaid-v11 .cluster rect { fill: #202833; stroke: #4870ac; }
              #mermaid-v11 .cluster-label text { fill: #dbe7f6; }
              #mermaid-v11 .bare-caption { fill: #e2e8f0; }
            </style>
            <g class="root" id="root">
              <text id="root-bare" class="bare-caption" x="500" y="30">Canvas Caption</text>
              <g class="clusters">
                <g class="cluster" id="sub0">
                  <rect x="360" y="150" width="200" height="140"/>
                  <g class="cluster-label"><text x="460" y="175">Billing Domain</text></g>
                  <g class="node" id="n-child" transform="translate(460, 230)" style="opacity: 1;">
                    <rect x="-70" y="-22" width="140" height="44"/>
                    <text x="0" y="4" text-anchor="middle">Inner Child</text>
                  </g>
                </g>
              </g>
              <g class="nodes">
                <g class="node" id="flowchart-Local-0" transform="translate(120, 90)" style="opacity: 1;">
                  <rect x="-70" y="-25" width="140" height="50"/>
                  <text x="0" y="5" text-anchor="middle">Local Entry</text>
                </g>
                <g class="node" id="flowchart-Remote-1" transform="translate(840, 420)" style="opacity: 1;">
                  <rect x="-90" y="-25" width="180" height="50"/>
                  <text x="0" y="5" text-anchor="middle">Remote Ledger</text>
                </g>
              </g>
            </g>
          </svg>
        </div>

        <div class="markdown-preview-view">
          <div class="markdown-preview-section">
            <div class="callout-content" id="callout-box">
              <p id="sib-p1">Intro paragraph</p>
              <table id="bare-tbl">
                <thead><tr><th>Col1</th><th>Col2</th><th>Col3</th><th>Col4</th><th>Col5</th></tr></thead>
                <tbody>
                  <tr><td>A1</td><td>B1</td><td>C1</td><td>D1</td><td>E1</td></tr>
                  <tr><td>A2</td><td>B2</td><td>C2</td><td>D2</td><td>E2</td></tr>
                  <tr><td>A3</td><td>B3</td><td>C3</td><td>D3</td><td>E3</td></tr>
                  <tr><td>A4</td><td>B4</td><td>C4</td><td>D4</td><td>E4</td></tr>
                  <tr><td>A5</td><td>B5</td><td>C5</td><td>D5</td><td>E5</td></tr>
                  <tr><td>A6</td><td>B6</td><td>C6</td><td>D6</td><td>E6</td></tr>
                  <tr><td>A7</td><td>B7</td><td>C7</td><td>D7</td><td>E7</td></tr>
                  <tr><td>A8</td><td>B8</td><td>C8</td><td>D8</td><td>E8</td></tr>
                </tbody>
              </table>
              <p id="sib-p2">Outro paragraph</p>
            </div>
          </div>
        </div>

        <div id="lp-container">
          <div id="lp-view" class="markdown-source-view mod-cm6 is-live-preview">
            <div class="cm-embed-block" id="lp-m-block">
              <div class="mermaid"><svg id="lp-svg" viewBox="0 0 100 50" width="100" height="50"><rect width="100" height="50"/></svg></div>
            </div>
            <div class="cm-embed-block cm-table-widget" id="lp-t-block">
              <table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>
            </div>
          </div>
        </div>
      </body>
    `);
    await page.addScriptTag({ content: harness });

    const res = await page.evaluate(async () => {
      const svg = document.getElementById('mermaid-v11');
      const remoteOrig = document.getElementById('flowchart-Remote-1');
      const rawCenter = window.__WB__.getNodeCenterInSvg(remoteOrig, svg, 1000, 500);

      // P0 #1 + P1 #2 + P1 #9: Open lightbox, search translated node & nested cluster child
      const handle = window.__WB__.openMermaidLightbox(svg, window.__WB__.DEFAULT_SETTINGS, 'V11Diagram');
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const overlay = document.querySelector('.qs-wb-mermaid-overlay');
      const stage = overlay.querySelector('.qs-wb-mermaid-stage');
      const searchInput = overlay.querySelector('.qs-wb-input');

      searchInput.value = 'Remote Ledger';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 220));
      const liveRemote = overlay.querySelector('[id^="flowchart-Remote-1"]');
      const liveLocal = overlay.querySelector('[id^="flowchart-Local-0"]');
      const liveRoot = overlay.querySelector('[id^="root-qs-live"]');
      const remoteRect = liveRemote.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const remoteCenteredDx = Math.abs((remoteRect.left + remoteRect.width / 2) - (stageRect.left + stageRect.width / 2));
      const remoteCenteredDy = Math.abs((remoteRect.top + remoteRect.height / 2) - (stageRect.top + stageRect.height / 2));
      const localDimmedOpacity = parseFloat(getComputedStyle(liveLocal).opacity);
      const rootWasDimmed = liveRoot.classList.contains('qs-wb-node-dim');

      // Search nested cluster child: ancestor cluster must NOT be dimmed
      searchInput.value = 'Inner Child';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      const liveSub0 = overlay.querySelector('[id^="sub0"]');
      const liveChild = overlay.querySelector('[id^="n-child"]');
      const childMatched = liveChild.classList.contains('qs-wb-node-match');
      const parentClusterDimmed = liveSub0.classList.contains('qs-wb-node-dim');

      // Clear search: inline opacity must restore to '1'
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 220));
      const localRestoredInlineOpacity = liveLocal.style.opacity;
      const localRestoredComputedOpacity = parseFloat(getComputedStyle(liveLocal).opacity);
      handle.close();

      // P1 #3: Bare text inside g#root converts to dark ink on white export despite sibling dark node rects
      const { svgString } = window.__WB__.buildStandaloneSvgString(svg, 'white');
      const bareTextTurnedDark = /id="root-bare"[^>]*style="[^"]*fill:\s*(?:rgb\(30,\s*41,\s*59\)|#1e293b)/.test(svgString);

      // P1 #7 + P1 #10: Bare table inside callout wraps ONLY table, prints unclipped, unwraps cleanly
      const bareTbl = document.getElementById('bare-tbl');
      const calloutBox = document.getElementById('callout-box');
      const child = new window.__WB__.MarkdownRenderChild(calloutBox);
      const enhanced = window.__WB__.enhanceInlineTable(bareTbl, child, window.__WB__.DEFAULT_SETTINGS, {
        onOpenModal: () => {},
        onCopyTsv: () => {},
      });
      const wrap = bareTbl.parentElement;
      const wrapIsolated = wrap.classList.contains('qs-wb-table-wrap')
        && !wrap.contains(document.getElementById('sib-p1'))
        && !wrap.contains(document.getElementById('sib-p2'));
      const freezeBtn = wrap.querySelectorAll('.qs-wb-inline-btn')[0];
      freezeBtn.click();
      const calloutFrozen = calloutBox.classList.contains('qs-wb-table-frozen');
      const wrapFrozen = wrap.classList.contains('qs-wb-table-frozen');

      // Print mode check (body.print): bar hidden + frozen table unclipped
      document.body.classList.add('print');
      const bar = wrap.querySelector('.qs-wb-table-bar');
      const printBarDisplay = getComputedStyle(bar).display;
      const printWrapMaxH = getComputedStyle(wrap).maxHeight;
      const printWrapOverflowY = getComputedStyle(wrap).overflowY;
      document.body.classList.remove('print');

      child.unload();
      const unwrappedCleanly = bareTbl.parentElement === calloutBox
        && !calloutBox.querySelector('.qs-wb-table-wrap')
        && !calloutBox.querySelector('.qs-wb-table-bar');

      // P1 #4: LivePreviewTriggerManager selective toggle off
      const liveSettings = { ...window.__WB__.DEFAULT_SETTINGS };
      const lpContainer = document.getElementById('lp-container');
      const lpViewEl = document.getElementById('lp-view');
      const fakeView = new window.__WB__.MarkdownView();
      fakeView.containerEl = lpContainer;
      fakeView.file = { path: 'Demo.md', basename: 'Demo' };
      const fakeApp = {
        workspace: {
          iterateAllLeaves: cb => { cb({ view: fakeView }); },
        },
      };
      const lpMgr = new window.__WB__.LivePreviewTriggerManager(fakeApp, {
        getSettings: () => liveSettings,
        openMermaid: () => {},
        openTable: () => {},
      });
      lpMgr.refreshAll();
      const lpBothM = lpViewEl.querySelectorAll('.qs-wb-lp-trigger.is-mermaid').length;
      const lpBothT = lpViewEl.querySelectorAll('.qs-wb-lp-trigger.is-table').length;

      liveSettings.enableMermaidWorkbench = false;
      lpMgr.refreshAll();
      const lpOnlyTM = lpViewEl.querySelectorAll('.qs-wb-lp-trigger.is-mermaid').length;
      const lpOnlyTT = lpViewEl.querySelectorAll('.qs-wb-lp-trigger.is-table').length;

      liveSettings.enableTableWorkbench = false;
      lpMgr.refreshAll();
      const lpNoneT = lpViewEl.querySelectorAll('.qs-wb-lp-trigger').length;
      lpMgr.cleanupAll();

      // P1 #8: Dynamic --qs-wb-head-h on column filter row + blur cleanup on column resize
      const tblHandle = window.__WB__.openTableWorkbench(bareTbl, window.__WB__.DEFAULT_SETTINGS, { title: 'ResizeTest' });
      const tblOverlay = document.querySelector('.qs-wb-table-overlay');
      const filterBtn = [...tblOverlay.querySelectorAll('.qs-wb-btn')].find(b => b.textContent.includes('列筛选'));
      filterBtn.click();
      const gridTable = tblOverlay.querySelector('.qs-wb-grid-table');
      const headHVar = gridTable.style.getPropertyValue('--qs-wb-head-h');
      const firstTh = tblOverlay.querySelector('thead th.qs-wb-th');
      const resizer = firstTh.querySelector('.qs-wb-col-resizer');
      resizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, bubbles: true }));
      window.dispatchEvent(new Event('blur'));
      const widthAfterBlur = firstTh.style.width;
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 400, bubbles: true }));
      const widthAfterPostBlurMove = firstTh.style.width;
      tblHandle.close();

      return {
        rawCenter,
        remoteCenteredDx,
        remoteCenteredDy,
        localDimmedOpacity,
        rootWasDimmed,
        childMatched,
        parentClusterDimmed,
        localRestoredInlineOpacity,
        localRestoredComputedOpacity,
        bareTextTurnedDark,
        enhanced,
        wrapIsolated,
        calloutFrozen,
        wrapFrozen,
        printBarDisplay,
        printWrapMaxH,
        printWrapOverflowY,
        unwrappedCleanly,
        lpBothM,
        lpBothT,
        lpOnlyTM,
        lpOnlyTT,
        lpNoneT,
        headHVar,
        blurStoppedResize: widthAfterBlur === widthAfterPostBlurMove,
      };
    });

    assert.ok(Math.abs(res.rawCenter.x - 840) < 2, `Expected center x ~840, got ${res.rawCenter.x}`);
    assert.ok(Math.abs(res.rawCenter.y - 420) < 2, `Expected center y ~420, got ${res.rawCenter.y}`);
    assert.ok(res.remoteCenteredDx < 15, `Expected remote node centered horizontally, dx=${res.remoteCenteredDx}`);
    assert.ok(res.remoteCenteredDy < 15, `Expected remote node centered vertically, dy=${res.remoteCenteredDy}`);
    assert.ok(res.localDimmedOpacity < 0.3, `Expected dimmed opacity ~0.22 despite inline opacity:1, got ${res.localDimmedOpacity}`);
    assert.equal(res.rootWasDimmed, false);
    assert.equal(res.childMatched, true);
    assert.equal(res.parentClusterDimmed, false);
    assert.equal(res.localRestoredInlineOpacity, '1');
    assert.equal(res.localRestoredComputedOpacity, 1);
    assert.equal(res.bareTextTurnedDark, true);
    assert.equal(res.enhanced, true);
    assert.equal(res.wrapIsolated, true);
    assert.equal(res.calloutFrozen, false);
    assert.equal(res.wrapFrozen, true);
    assert.equal(res.printBarDisplay, 'none');
    assert.equal(res.printWrapMaxH, 'none');
    assert.equal(res.printWrapOverflowY, 'visible');
    assert.equal(res.unwrappedCleanly, true);
    assert.equal(res.lpBothM, 1);
    assert.equal(res.lpBothT, 1);
    assert.equal(res.lpOnlyTM, 0);
    assert.equal(res.lpOnlyTT, 1);
    assert.equal(res.lpNoneT, 0);
    assert.match(res.headHVar, /^\d+px$/);
    assert.equal(res.blurStoppedResize, true);
  } finally {
    await browser.close();
  }
});
