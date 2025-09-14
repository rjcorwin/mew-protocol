#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

// Import commands
const gatewayCommand = require('./commands/gateway');
const clientCommand = require('./commands/client');
const agentCommand = require('./commands/agent');
const tokenCommand = require('./commands/token');
const spaceCommand = require('./commands/space');
const InitCommand = require('./commands/init');

// Check if space configuration exists
function checkSpaceExists() {
  // Check .mew/space.yaml first (preferred location)
  if (fs.existsSync(path.join(process.cwd(), '.mew/space.yaml'))) {
    return true;
  }
  // Check space.yaml in root (legacy/compatibility)
  if (fs.existsSync(path.join(process.cwd(), 'space.yaml'))) {
    return true;
  }
  return false;
}

// Setup CLI
program
  .name('mew')
  .description('MEW Protocol CLI - Minimal implementation for testing')
  .version(packageJson.version);

// Add init command
program
  .command('init [template]')
  .description('Initialize a new MEW space from templates')
  .option('--name <name>', 'Space name (default: current directory name)')
  .option('--model <model>', 'AI model to use (default: gpt-5)')
  .option('--description <desc>', 'Space description')
  .option('--port <port>', 'Gateway port (default: 8080)')
  .option('--force', 'Overwrite existing space configuration')
  .option('--list-templates', 'Show available templates and exit')
  .option('--template-info <name>', 'Show details about a specific template')
  .action(async (template, options) => {
    const initCommand = new InitCommand();
    options.template = template;
    await initCommand.execute(options);
  });

// Add other commands
program.addCommand(gatewayCommand);
program.addCommand(clientCommand);
program.addCommand(agentCommand);
program.addCommand(tokenCommand);
program.addCommand(spaceCommand);

// Default behavior when no command is provided
if (process.argv.length === 2) {
  // No arguments provided - intelligent default behavior
  if (checkSpaceExists()) {
    // Space exists - start it interactively
    console.log('Starting space and connecting interactively...');
    process.argv.push('space', 'up', '-i');
  } else {
    // No space - run init
    console.log('Welcome to MEW Protocol! Let\'s set up your space.');
    const initCommand = new InitCommand();
    initCommand.execute({}).then(() => {
      process.exit(0);
    }).catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
    return; // Don't parse args since we're handling it
  }
}

// Parse arguments
program.parse(process.argv);
