#!/usr/bin/env node

const { program } = require('commander');
const packageJson = require('../package.json');

// Import commands
const gatewayCommand = require('./commands/gateway');
const clientCommand = require('./commands/client');
const agentCommand = require('./commands/agent');
const tokenCommand = require('./commands/token');
const spaceCommand = require('./commands/space');

// Setup CLI
program
  .name('meup')
  .description('MEUP CLI - Minimal implementation for testing')
  .version(packageJson.version);

// Add commands
program.addCommand(gatewayCommand);
program.addCommand(clientCommand);
program.addCommand(agentCommand);
program.addCommand(tokenCommand);
program.addCommand(spaceCommand);

// Parse arguments
program.parse(process.argv);