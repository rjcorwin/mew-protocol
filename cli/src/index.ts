#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { program } from 'commander';

import packageJson from '../package.json';
const gatewayCommand = require('./commands/gateway');
const clientCommand = require('./commands/client');
const agentCommand = require('./commands/agent');
const tokenCommand = require('./commands/token');
const spaceCommand = require('./commands/space');
const InitCommand = require('./commands/init');

function checkSpaceExists(): boolean {
  if (fs.existsSync(path.join(process.cwd(), '.mew/space.yaml'))) {
    return true;
  }
  if (fs.existsSync(path.join(process.cwd(), 'space.yaml'))) {
    return true;
  }
  return false;
}

program
  .name('mew')
  .description('MEW Protocol CLI - Minimal implementation for testing')
  .version(packageJson.version ?? '0.0.0');

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
  .action(async (template: string | undefined, options: Record<string, any>) => {
    const initCommand = new InitCommand();
    // eslint-disable-next-line no-param-reassign
    options.template = template;
    await initCommand.execute(options);
  });

program.addCommand(gatewayCommand);
program.addCommand(clientCommand);
program.addCommand(agentCommand);
program.addCommand(tokenCommand);
program.addCommand(spaceCommand);

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

function isSpaceRunning(): boolean {
  const pidFile = path.join(process.cwd(), '.mew', 'pids.json');
  if (!fs.existsSync(pidFile)) {
    return false;
  }

  try {
    const pids = JSON.parse(fs.readFileSync(pidFile, 'utf8')) as { gateway?: number };
    if (pids.gateway) {
      try {
        process.kill(pids.gateway, 0);
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

async function main(): Promise<void> {
  if (process.argv.length === 2) {
    if (checkSpaceExists()) {
      if (isSpaceRunning()) {
        console.log('Connecting to running space...');
        process.argv.push('space', 'connect');
      } else {
        console.log('Starting space and connecting interactively...');
        process.argv.push('space', 'up', '-i');
      }
    } else {
      console.log('Welcome to MEW Protocol! Let\'s set up your space.');
      const initCommand = new InitCommand();
      try {
        await initCommand.execute({});
      } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(1);
      }

      console.log('\nSpace initialized! Starting and connecting...');
      const { spawn } = require('child_process');
      const child = spawn(process.argv[0], [process.argv[1]!, 'space', 'up', '-i'], {
        stdio: 'inherit',
      });
      child.on('exit', (code: number | null) => {
        process.exit(code || 0);
      });
      return;
    }
  }

  program.parse(process.argv);
}

void main();
