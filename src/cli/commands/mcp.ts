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
  .command('isometric-fleet')
  .description('Run MCP isometric fleet world server')
  .action(async () => {
    const serverPath = resolve(__dirname, '../../mcp-servers/isometric-fleet.js');

    const child = spawn('node', [serverPath], {
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
    console.log('  isometric-fleet    - Multiplayer isometric world with controllable ship');
    console.log('');
  });

export default mcp;