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
    // Dynamically import the filesystem server
    const serverPath = resolve(__dirname, '../../mcp-servers/filesystem.js');

    const child = spawn('node', [serverPath, path], {
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
    // Dynamically import the cat-maze server
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
  .command('list')
  .description('List available MCP servers')
  .action(() => {
    console.log('\nAvailable MCP servers:\n');
    console.log('  filesystem <path>  - Filesystem MCP server for file operations');
    console.log('  cat-maze           - Interactive maze game for AI agents');
    console.log('');
  });

export default mcp;