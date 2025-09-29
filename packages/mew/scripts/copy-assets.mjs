import { cp, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const srcDir = path.join(packageRoot, 'src');
const distDir = path.join(packageRoot, 'dist');

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copy(from, to) {
  if (!(await pathExists(from))) {
    return;
  }
  await cp(from, to, { recursive: true });
}

await mkdir(distDir, { recursive: true });

const assets = [
  [path.join(srcDir, 'cli'), path.join(distDir, 'cli')],
  [path.join(srcDir, 'bin'), path.join(distDir, 'bin')],
  [path.join(packageRoot, 'templates'), path.join(distDir, 'templates')],
];

for (const [from, to] of assets) {
  await copy(from, to);
}
