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

// Add aliases for common space commands
program
  .command('up')
  .description('Alias for "space up" - Start a space')
  .option('-c, --config <path>', 'Path to space.yaml (default: auto-detect)', './space.yaml')
  .option('-d, --space-dir <path>', 'Space directory', '.')
  .option('-p, --port <port>', 'Gateway port', '8080')
  .option('-l, --log-level <level>', 'Log level', 'info')
  .option('-i, --interactive', 'Connect interactively after starting space')
  .option('--detach', 'Run in background (default if not interactive)')
  .option('--participant <id>', 'Connect as this participant (with --interactive)')
  .option('--debug', 'Use simple debug interface instead of advanced UI')
  .option('--simple', 'Alias for --debug')
  .option('--no-ui', 'Disable UI enhancements, use plain interface')
  .option('--no-color', 'Disable colored output in interactive mode')
  .action(spaceCommand.spaceUpAction);

program
  .command('down')
  .description('Alias for "space down" - Stop a running space')
  .option('-d, --space-dir <path>', 'Space directory', '.')
  .action(spaceCommand.spaceDownAction);

// Helper function to check if space is running
function isSpaceRunning() {
  const runStatePath = path.join(process.cwd(), '.mew', 'run', 'state.json');
  if (!fs.existsSync(runStatePath)) {
    return false;
  }

  try {
    const state = JSON.parse(fs.readFileSync(runStatePath, 'utf8'));
    const pid = state?.gateway?.pid;
    if (!pid) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  } catch (error) {
    return false;
  }
}

// Default behavior when no command is provided
if (process.argv.length === 2) {
  (async () => {
    try {
      if (!checkSpaceExists()) {
        console.log('Welcome to MEW Protocol! Let\'s set up your space.');
        const initCommand = new InitCommand();
        await initCommand.execute({});
        console.log('\nSpace initialized! Starting interactive session...');
        await spaceCommand.spaceUpAction({ interactive: true });
        return;
      }

      if (isSpaceRunning()) {
        console.log('Space is running. Connecting interactively...');
        await spaceCommand.spaceConnectAction({});
        return;
      }

      console.log('Starting space and connecting interactively...');
      await spaceCommand.spaceUpAction({ interactive: true });
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
  return;
}

// Parse arguments
program.parse(process.argv);
