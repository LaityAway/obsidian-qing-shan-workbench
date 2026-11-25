import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const cssFiles = [
  'src/ui/styles/base.css',
  'src/ui/styles/mermaid.css',
  'src/ui/styles/table.css',
];

function buildStyles() {
  const banner = '/* Qing Shan Workbench — Generated from src/ui/styles/*.css. Do not edit directly. */\n';
  const parts = cssFiles.map(rel => {
    const abs = path.join(root, rel);
    return `/* --- ${rel} --- */\n` + fs.readFileSync(abs, 'utf8').trim();
  });
  fs.writeFileSync(path.join(root, 'styles.css'), banner + parts.join('\n\n') + '\n', 'utf8');
}

async function build() {
  await esbuild.build({
    entryPoints: [path.join(root, 'src/main.ts')],
    bundle: true,
    external: ['obsidian', 'electron', '@codemirror/view', '@codemirror/state', '@codemirror/language'],
    format: 'cjs',
    target: 'es2022',
    platform: 'browser',
    logLevel: 'info',
    sourcemap: false,
    treeShaking: true,
    outfile: path.join(root, 'main.js'),
  });
  buildStyles();
  const mainBytes = fs.statSync(path.join(root, 'main.js')).size;
  const cssBytes = fs.statSync(path.join(root, 'styles.css')).size;
  console.log(`Built main.js (${(mainBytes / 1024).toFixed(1)} KB) and styles.css (${(cssBytes / 1024).toFixed(1)} KB)`);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
