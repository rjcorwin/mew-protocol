#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const packageDir = path.join(rootDir, 'packages', 'mew');
const srcDir = path.join(packageDir, 'src');
const distDir = path.join(packageDir, 'dist');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  ensureDir(path.dirname(dest));
  fs.cpSync(src, dest, { recursive: true });
}

function makeExecutable(filePath) {
  fs.chmodSync(filePath, 0o755);
}

copyDir(path.join(srcDir, 'cli'), path.join(distDir, 'cli'));
copyDir(path.join(srcDir, 'bin'), path.join(distDir, 'bin'));

for (const file of fs.readdirSync(path.join(distDir, 'bin'))) {
  makeExecutable(path.join(distDir, 'bin', file));
}
