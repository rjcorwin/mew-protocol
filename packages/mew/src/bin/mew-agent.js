#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const agentEntry = path.join(__dirname, '..', 'agent', 'index.js');
const child = spawn(process.execPath, [agentEntry, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
