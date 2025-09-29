#!/usr/bin/env node

const path = require('path');
let bridgeModule;
try {
  bridgeModule = require('../bridge');
} catch (primaryError) {
  try {
    bridgeModule = require('../../dist/bridge');
  } catch (fallbackError) {
    console.error('Failed to load bridge runtime from dist/bridge. Run "npm run build" first.', fallbackError);
    process.exit(1);
  }
}

const { MCPBridge } = bridgeModule;
const { program } = require('commander');

program
  .description('MEW-MCP Bridge - Connect MCP servers to MEW spaces')
  .requiredOption('--gateway <url>', 'Gateway WebSocket URL')
  .requiredOption('--space <id>', 'Space ID to join')
  .requiredOption('--participant-id <id>', 'Participant ID for this bridge')
  .requiredOption('--token <token>', 'Authentication token')
  .requiredOption('--mcp-command <command>', 'MCP server command to run')
  .option('--mcp-args <args>', 'Comma-separated MCP server arguments', '')
  .option('--mcp-env <env>', 'Comma-separated environment variables (KEY=VALUE)', '')
  .option('--mcp-cwd <dir>', 'Working directory for MCP server')
  .option('--init-timeout <ms>', 'Initialization timeout in ms', '30000')
  .option('--reconnect <bool>', 'Auto-reconnect on disconnect', 'true')
  .option('--max-reconnects <n>', 'Maximum reconnect attempts', '3')
  .option('--capabilities <json>', 'JSON encoded capabilities to advertise when joining')
  .parse(process.argv);

const options = program.opts();

const mcpArgs = options.mcpArgs ? options.mcpArgs.split(',') : [];
const mcpEnv = {};
if (options.mcpEnv) {
  options.mcpEnv.split(',').forEach((pair) => {
    const [key, value] = pair.split('=');
    if (key && value) {
      mcpEnv[key] = value;
    }
  });
}

const mcpConfig = {
  command: options.mcpCommand,
  args: mcpArgs,
  env: Object.keys(mcpEnv).length > 0 ? mcpEnv : undefined,
  cwd: options.mcpCwd,
};

let capabilities;
if (options.capabilities) {
  try {
    capabilities = JSON.parse(options.capabilities);
  } catch (error) {
    console.error('Failed to parse --capabilities JSON:', error.message);
    process.exit(1);
  }
}

const bridge = new MCPBridge({
  gateway: options.gateway,
  space: options.space,
  participantId: options.participantId,
  token: options.token,
  initTimeout: parseInt(options.initTimeout, 10),
  mcpServer: mcpConfig,
  capabilities,
});

async function start() {
  try {
    console.log(`Starting MCP bridge for ${options.participantId}...`);
    console.log(`Connecting to gateway: ${options.gateway}`);
    console.log(`Space: ${options.space}`);
    console.log(`MCP server: ${options.mcpCommand} ${mcpArgs.join(' ')}`);

    await bridge.start();
    console.log('Bridge started successfully');

    process.on('SIGINT', async () => {
      console.log('\nShutting down bridge...');
      await bridge.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nShutting down bridge...');
      await bridge.shutdown();
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await bridge.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      await bridge.shutdown();
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start bridge:', error);
    process.exit(1);
  }
}

start();
