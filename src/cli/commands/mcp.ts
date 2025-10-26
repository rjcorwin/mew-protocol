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
  .command('ship-server')
  .description('Run MCP ship server for MEW World game')
  .action(async () => {
    // __dirname is dist/cli/commands, ship-server is at dist/mcp-servers/ship-server/
    const serverPath = resolve(__dirname, '../../mcp-servers/ship-server/index.js');

    const child = spawn('node', [serverPath], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env  // Pass through all env vars (SHIP_ID, GATEWAY_URL, etc.)
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
  .command('list')
  .description('List available MCP servers')
  .action(() => {
    console.log('\nAvailable MCP servers:\n');
    console.log('  filesystem <path>  - Filesystem MCP server for file operations');
    console.log('  cat-maze           - Interactive maze game for AI agents');
    console.log('  ship-server        - Ship entity server for MEW World game');
    console.log('');
  });

export default mcp;