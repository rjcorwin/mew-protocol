#!/usr/bin/env node

const { program } = require('commander');
const { MCPBridge } = require('../src/index');
const debug = require('debug')('meup:bridge');

program
  .name('meup-bridge')
  .description('MCP-MEUP Protocol Bridge')
  .version('0.1.0')
  .requiredOption('--gateway <url>', 'MEUP gateway WebSocket URL')
  .requiredOption('--space <space>', 'Space ID to join')
  .requiredOption('--participant-id <id>', 'Participant ID for this bridge')
  .option('--token <token>', 'Authentication token')
  .requiredOption('--mcp-command <command>', 'MCP server command to execute')
  .option('--mcp-args <args>', 'MCP server arguments (comma-separated)', '')
  .option('--mcp-env <env>', 'MCP server environment variables (KEY=value,KEY2=value2)', '')
  .option('--mcp-cwd <cwd>', 'MCP server working directory')
  .option('--init-timeout <ms>', 'MCP initialization timeout', '30000')
  .option('--log-level <level>', 'Log level (debug|info|warn|error)', 'info')
  .option('--reconnect', 'Auto-reconnect on failure', true)
  .option('--max-reconnects <n>', 'Maximum reconnection attempts', '5')
  .parse(process.argv);

const options = program.opts();

// Parse MCP args
const mcpArgs = options.mcpArgs ? options.mcpArgs.split(',') : [];

// Parse MCP environment variables
const mcpEnv = {};
if (options.mcpEnv) {
  options.mcpEnv.split(',').forEach(pair => {
    const [key, value] = pair.split('=');
    if (key && value) {
      mcpEnv[key] = value;
    }
  });
}

// Configure debug based on log level
if (options.logLevel === 'debug') {
  process.env.DEBUG = 'meup:*';
}

async function main() {
  debug('Starting MCP-MEUP bridge with options:', {
    gateway: options.gateway,
    space: options.space,
    participantId: options.participantId,
    mcpCommand: options.mcpCommand,
    mcpArgs
  });

  const bridge = new MCPBridge({
    // MEUP connection options
    gateway: options.gateway,
    space: options.space,
    participantId: options.participantId,
    token: options.token,
    
    // MCP server options
    mcpServer: {
      command: options.mcpCommand,
      args: mcpArgs,
      env: { ...process.env, ...mcpEnv },
      cwd: options.mcpCwd || process.cwd()
    },
    
    // Bridge options
    initTimeout: parseInt(options.initTimeout),
    reconnect: options.reconnect,
    maxReconnects: parseInt(options.maxReconnects)
  });

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down bridge...');
    await bridge.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down bridge...');
    await bridge.shutdown();
    process.exit(0);
  });

  try {
    await bridge.start();
    console.log(`Bridge running for ${options.participantId}`);
  } catch (error) {
    console.error('Failed to start bridge:', error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});