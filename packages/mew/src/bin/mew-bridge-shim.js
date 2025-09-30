// Thin shim that forwards to `mew bridge ...`
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the main mew CLI
const mewPath = resolve(__dirname, 'mew.js');

// Forward all arguments to `mew bridge`
const args = ['bridge', ...process.argv.slice(2)];
const child = spawn(process.execPath, [mewPath, ...args], {
  stdio: 'inherit',
  cwd: process.cwd()
});

child.on('exit', (code) => {
  process.exit(code || 0);
});