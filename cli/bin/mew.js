#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const sourceCli = path.join(__dirname, '../../packages/mew/src/cli/index.js');
const distCli = path.join(__dirname, '../../packages/mew/dist/cli/index.js');

const entry = fs.existsSync(distCli) ? distCli : sourceCli;
require(entry);
