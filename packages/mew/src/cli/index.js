#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const packageJson = require('../../package.json');

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
  .action(spaceCommand.spaceUpAction);

program
  .command('down')
  .description('Alias for "space down" - Stop a running space')
  .option('-d, --space-dir <path>', 'Space directory', '.')
  .action(spaceCommand.spaceDownAction);

// Helper function to check if space is running
function isSpaceRunning() {
  const pidFile = path.join(process.cwd(), '.mew', 'pids.json');
  if (!fs.existsSync(pidFile)) {
    return false;
  }

  try {
    const pids = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
    // Check if gateway process is still running
    if (pids.gateway) {
      try {
        process.kill(pids.gateway, 0); // Check if process exists
        return true;
      } catch {
        return false;
      }
    }
  } catch {
    return false;
  }
  return false;
}

// Default behavior when no command is provided
if (process.argv.length === 2) {
  // No arguments provided - intelligent default behavior
  if (checkSpaceExists()) {
    // Space exists - check if it's running
    if (isSpaceRunning()) {
      // Space is running - connect to it
      console.log('Connecting to running space...');
      process.argv.push('space', 'connect');
    } else {
      // Space exists but not running - start it interactively
      console.log('Starting space and connecting interactively...');
      process.argv.push('space', 'up', '-i');
    }
  } else {
    // No space - run init, then connect
    console.log('Welcome to MEW Protocol! Let\'s set up your space.');
    const initCommand = new InitCommand();
    initCommand.execute({}).then(() => {
      console.log('\nSpace initialized! Starting and connecting...');
      // After init, start the space interactively by spawning a new process
      const { spawn } = require('child_process');
      const child = spawn(process.argv[0], [process.argv[1], 'space', 'up', '-i'], {
        stdio: 'inherit'
      });
      child.on('exit', (code) => {
        process.exit(code || 0);
      });
    }).catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
    return; // Don't parse args since we're handling it
  }
}

// Parse arguments
program.parse(process.argv);
