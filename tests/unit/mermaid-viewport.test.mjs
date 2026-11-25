import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from '../helpers/load-ts.mjs';

const vp = loadTsModule('src/mermaid/mermaid-viewport.ts');
const exp = loadTsModule('src/mermaid/mermaid-export.ts');

test('zoomAtPoint keeps pointer anchor fixed in content coordinates', () => {
  const initial = { x: 100, y: 50, scale: 1 };
  const anchorX = 320;
  const anchorY = 180;
  const contentBeforeX = (anchorX - initial.x) / initial.scale;
  const contentBeforeY = (anchorY - initial.y) / initial.scale;

  const next = vp.zoomAtPoint(initial, 2, anchorX, anchorY);
  const contentAfterX = (anchorX - next.x) / next.scale;
  const contentAfterY = (anchorY - next.y) / next.scale;

  assert.equal(next.scale, 2);
  assert.ok(Math.abs(contentAfterX - contentBeforeX) < 1e-6);
  assert.ok(Math.abs(contentAfterY - contentBeforeY) < 1e-6);
});

test('computeFitViewport centers diagram inside stage with padding', () => {
  const bounds = { stageWidth: 1000, stageHeight: 600, contentWidth: 2000, contentHeight: 800 };
  const fitted = vp.computeFitViewport(bounds, 40);
  assert.ok(fitted.scale > 0 && fitted.scale <= 0.5);
  assert.ok(Math.abs(fitted.x - (1000 - 2000 * fitted.scale) / 2) < 1e-6);
  assert.ok(Math.abs(fitted.y - (600 - 800 * fitted.scale) / 2) < 1e-6);
});

test('computeSafeExportScale clamps huge diagrams to MAX_CANVAS_EDGE', () => {
  const normal = exp.computeSafeExportScale(1200, 800, 3);
  assert.equal(normal.clamped, false);
  assert.equal(normal.scale, 3);

  const huge = exp.computeSafeExportScale(6000, 3000, 3);
  assert.equal(huge.clamped, true);
  assert.ok(huge.scale * 6000 <= exp.MAX_CANVAS_EDGE + 10);
});

test('darkenColorForWhiteBg pulls pale dark-mode colors to WCAG AA+ contrast on white while keeping hue', () => {
  const white = { r: 255, g: 255, b: 255, a: 1 };
  for (const pale of ['rgb(219, 231, 246)', '#cccccc', 'rgb(158, 203, 255)']) {
    const adapted = exp.darkenColorForWhiteBg(pale);
    const parsed = exp.parseRgbColor(adapted);
    assert.ok(parsed, `Expected valid RGB output for ${pale}, got ${adapted}`);
    const ratio = exp.contrastRatio(parsed, white);
    assert.ok(ratio >= 4.5, `Expected contrast >= 4.5 for ${pale} -> ${adapted}, got ${ratio.toFixed(2)}`);
  }
  // Already-dark ink stays untouched
  assert.equal(exp.darkenColorForWhiteBg('rgb(30, 41, 59)'), 'rgb(30, 41, 59)');
});
