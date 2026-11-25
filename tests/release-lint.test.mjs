import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('manifest.json complies with Obsidian community directory guidelines', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const versions = JSON.parse(fs.readFileSync(path.join(root, 'versions.json'), 'utf8'));
  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');

  assert.equal(manifest.id, 'qing-shan-workbench');
  assert.doesNotMatch(manifest.id, /^obsidian|obsidian$/i);
  assert.doesNotMatch(manifest.name, /obsidian|plugin/i);
  assert.equal(manifest.isDesktopOnly, false);
  assert.doesNotMatch(manifest.description, /obsidian/i);
  assert.ok(manifest.description.length <= 250, `Description exceeds 250 chars: ${manifest.description.length}`);
  assert.ok(manifest.description.endsWith('.'), 'Description should end with a period');
  assert.equal(manifest.version, pkg.version);
  assert.equal(versions[manifest.version], manifest.minAppVersion);
  assert.ok(changelog.includes(`## [${manifest.version}]`));
});

test('built main.js avoids deprecated activeLeaf, innerHTML, console.log, and Node-only APIs', () => {
  const mainJs = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  assert.doesNotMatch(mainJs, /\bactiveLeaf\b/);
  assert.doesNotMatch(mainJs, /\binnerHTML\b/);
  assert.doesNotMatch(mainJs, /\bouterHTML\b/);
  assert.doesNotMatch(mainJs, /\bconsole\.log\(/);
  assert.doesNotMatch(mainJs, /require\(["'](?:fs|node:fs|child_process|node:child_process|os|path|electron)["']\)/);
});

test('built styles.css hides all workbench controls under @media print and .print', () => {
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  assert.match(css, /@media print[\s\S]*\.qs-wb-overlay[\s\S]*display:\s*none\s*!important/);
  assert.match(css, /\.print\s+\.qs-wb-overlay/);
});

test('public repository contains no local machine paths or personal vault references', () => {
  const scanDirs = ['src', 'scripts', 'tests'];
  const scanFiles = ['README.md', 'CHANGELOG.md', 'manifest.json', 'package.json'];
  const forbidden = [/\/Users\/[a-z0-9_-]+\//i, /iCloud~md~obsidian/i];

  const checkFile = absPath => {
    if (absPath.endsWith('release-lint.test.mjs')) return;
    const text = fs.readFileSync(absPath, 'utf8');
    for (const re of forbidden) {
      assert.doesNotMatch(text, re, `Found private reference ${re} in ${path.relative(root, absPath)}`);
    }
  };

  for (const rel of scanFiles) checkFile(path.join(root, rel));
  const walk = dir => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/\.(ts|js|mjs|css|json|md)$/.test(ent.name)) checkFile(p);
    }
  };
  for (const d of scanDirs) walk(path.join(root, d));
});
