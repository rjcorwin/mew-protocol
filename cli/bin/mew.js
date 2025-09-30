#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const candidates = [
  path.resolve(__dirname, '../../packages/mew/dist/bin/mew.js'),
  path.resolve(__dirname, '../../packages/mew/src/bin/mew.js'),
];

for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    require(candidate);
    return;
  }
}

console.error('Unable to locate MEW CLI binary. Run `npm run build` first.');
process.exit(1);
