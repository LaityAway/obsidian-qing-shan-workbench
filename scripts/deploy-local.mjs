import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vaultRoot = process.env.OBSIDIAN_VAULT_PATH;

if (!vaultRoot) {
  console.error('Set OBSIDIAN_VAULT_PATH to your local vault directory before running deploy:local.');
  process.exit(1);
}

const targetDir = path.join(vaultRoot, '.obsidian', 'plugins', 'qing-shan-workbench');
fs.mkdirSync(targetDir, { recursive: true });
for (const file of ['main.js', 'styles.css', 'manifest.json']) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing release artifact: ${src}. Run npm run build first.`);
  }
  fs.copyFileSync(src, path.join(targetDir, file));
}
console.log(`Deployed release artifacts to ${targetDir}`);
