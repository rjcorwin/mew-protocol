// @ts-nocheck
import { Command } from 'commander';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mcp = new Command('mcp').description('Run built-in MCP servers');

mcp
  .command('filesystem <path>')
  .description('Run MCP filesystem server')
  .action(async (path) => {
    // Use the official @modelcontextprotocol/server-filesystem package
    // Force latest version to get edit_file tool
    const child = spawn('npx', ['-y', '@modelcontextprotocol/server-filesystem@latest', path], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });

    // Handle termination signals
    process.on('SIGINT', () => {
      child.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      child.kill('SIGTERM');
    });
  });

mcp
  .command('cat-maze')
  .description('Run MCP cat-maze game server')
  .action(async () => {
    // __dirname is dist/cli/commands, mcp-servers are at dist/mcp-servers (2 levels up to dist/)
    const serverPath = resolve(__dirname, '../../mcp-servers/cat-maze.js');

    const child = spawn('node', [serverPath], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });

    // Handle termination signals
    process.on('SIGINT', () => {
      child.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      child.kill('SIGTERM');
    });
  });

mcp
  .command('ship')
  .description('Run MEW World ship transport MCP server')
  .option('--id <participantId>', 'Participant ID used when joining the space', 'ship1')
  .option('--gateway <url>', 'Gateway WebSocket URL')
  .option('--space <space>', 'Space identifier')
  .option('--token <token>', 'Authentication token')
  .option('--deck-width <pixels>', 'Deck width in pixels', (value) => value, undefined)
  .option('--deck-height <pixels>', 'Deck height in pixels', (value) => value, undefined)
  .option('--margin <pixels>', 'Boarding margin in pixels', (value) => value, undefined)
  .option('--interval <ms>', 'Update interval in milliseconds', (value) => value, undefined)
  .action(async (options) => {
    const serverPath = resolve(__dirname, '../../mcp-servers/mew-world-transport.js');
    const args = [serverPath, '--kind', 'ship', '--id', options.id];

    if (options.gateway) {
      args.push('--gateway', options.gateway);
    }
    if (options.space) {
      args.push('--space', options.space);
    }
    if (options.token) {
      args.push('--token', options.token);
    }
    if (options.deckWidth) {
      args.push('--deckWidth', options.deckWidth);
    }
    if (options.deckHeight) {
      args.push('--deckHeight', options.deckHeight);
    }
    if (options.margin) {
      args.push('--margin', options.margin);
    }
    if (options.interval) {
      args.push('--interval', options.interval);
    }

    const child = spawn('node', args, {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });

    process.on('SIGINT', () => {
      child.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      child.kill('SIGTERM');
    });
  });

mcp
  .command('plane')
  .description('Run MEW World plane transport MCP server')
  .option('--id <participantId>', 'Participant ID used when joining the space', 'plane1')
  .option('--gateway <url>', 'Gateway WebSocket URL')
  .option('--space <space>', 'Space identifier')
  .option('--token <token>', 'Authentication token')
  .option('--deck-width <pixels>', 'Fuselage footprint width in pixels', (value) => value, undefined)
  .option('--deck-height <pixels>', 'Fuselage footprint height in pixels', (value) => value, undefined)
  .option('--margin <pixels>', 'Boarding margin in pixels', (value) => value, undefined)
  .option('--interval <ms>', 'Update interval in milliseconds', (value) => value, undefined)
  .action(async (options) => {
    const serverPath = resolve(__dirname, '../../mcp-servers/mew-world-transport.js');
    const args = [serverPath, '--kind', 'plane', '--id', options.id];

    if (options.gateway) {
      args.push('--gateway', options.gateway);
    }
    if (options.space) {
      args.push('--space', options.space);
    }
    if (options.token) {
      args.push('--token', options.token);
    }
    if (options.deckWidth) {
      args.push('--deckWidth', options.deckWidth);
    }
    if (options.deckHeight) {
      args.push('--deckHeight', options.deckHeight);
    }
    if (options.margin) {
      args.push('--margin', options.margin);
    }
    if (options.interval) {
      args.push('--interval', options.interval);
    }

    const child = spawn('node', args, {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });

    process.on('SIGINT', () => {
      child.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      child.kill('SIGTERM');
    });
  });

mcp
  .command('list')
  .description('List available MCP servers')
  .action(() => {
    console.log('\nAvailable MCP servers:\n');
    console.log('  filesystem <path>  - Filesystem MCP server for file operations');
    console.log('  cat-maze           - Interactive maze game for AI agents');
    console.log('  ship               - MEW World ship transport server');
    console.log('  plane              - MEW World plane transport server');
    console.log('');
  });

export default mcp;