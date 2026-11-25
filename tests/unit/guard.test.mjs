import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from '../helpers/load-ts.mjs';

const guard = loadTsModule('src/guard.ts');

test('isPathExcluded blocks exact folder prefixes, nested files, and normalized slashes', () => {
  assert.equal(guard.isPathExcluded('Secrets/servers.md', ['Secrets/']), true);
  assert.equal(guard.isPathExcluded('/Secrets/nested/keys.md', ['Secrets/']), true);
  assert.equal(guard.isPathExcluded('Notes/Architecture/overview.md', ['Secrets/']), false);
  assert.equal(guard.isPathExcluded('Work/Private/a.md', ['Work/Private']), true);
  assert.equal(guard.isPathExcluded('Notes/Public.md', []), false);
});

test('mergeExcludedPaths deduplicates and normalizes path separators', () => {
  const merged = guard.mergeExcludedPaths(['/Custom\\Folder/', 'Secrets/', 'Custom/Folder/']);
  assert.deepEqual(merged, ['Custom/Folder/', 'Secrets/']);
});

test('shouldEnhanceTableInline enforces column/row thresholds and rejects empty tables', () => {
  assert.equal(guard.shouldEnhanceTableInline(0, 10, 5, 12), false);
  assert.equal(guard.shouldEnhanceTableInline(3, 4, 5, 12), false);
  assert.equal(guard.shouldEnhanceTableInline(5, 2, 5, 12), true);
  assert.equal(guard.shouldEnhanceTableInline(2, 12, 5, 12), true);
});

test('hasExemptFrontmatterClass detects qs-off, qs-no-workbench, and qs-home on detached sections', () => {
  assert.equal(guard.hasExemptFrontmatterClass({ cssclasses: ['qs-off'] }), true);
  assert.equal(guard.hasExemptFrontmatterClass({ cssclasses: 'qs-wide qs-no-workbench' }), true);
  assert.equal(guard.hasExemptFrontmatterClass({ cssclass: 'qs-off' }), true);
  assert.equal(guard.hasExemptFrontmatterClass({ cssclasses: ['qs-wide'] }), false);
  assert.equal(guard.hasExemptFrontmatterClass({ cssclasses: ['qs-home'] }, ['qs-home']), true);
});
