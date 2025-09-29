import { cp, mkdir, access } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const entries = [
  { source: 'src/bin', target: 'dist/bin' },
  { source: 'src/cli', target: 'dist/cli' },
  { source: 'src/gateway', target: 'dist/gateway' },
  { source: 'templates', target: 'dist/templates', optional: true },
  { source: 'config', target: 'dist/config', optional: true },
  { source: 'examples', target: 'dist/examples', optional: true }
];

async function exists(relPath) {
  try {
    await access(path.join(rootDir, relPath), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyEntry({ source, target, optional = false }) {
  if (!(await exists(source))) {
    if (!optional) {
      throw new Error(`Missing required asset directory: ${source}`);
    }
    return;
  }

  const src = path.join(rootDir, source);
  const dest = path.join(rootDir, target);
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true, force: true });
}

for (const entry of entries) {
  await copyEntry(entry);
}
