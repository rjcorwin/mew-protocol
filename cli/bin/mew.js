#!/usr/bin/env node

/**
 * Stable CLI wrapper for development and testing.
 *
 * This wrapper provides a stable path (cli/bin/mew.js) for local development
 * and testing, forwarding all commands to the consolidated package implementation.
 *
 * Usage from spaces/ or tests/:
 *   ../../cli/bin/mew.js space init .
 *   ../../cli/bin/mew.js space up
 *   ../../cli/bin/mew.js space connect
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the consolidated package's CLI implementation
const cliPath = resolve(__dirname, '../../packages/mew/src/bin/mew.js');

// Forward all arguments to the real CLI
const child = spawn('node', [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: process.cwd()
});

child.on('exit', (code) => {
  process.exit(code || 0);
});