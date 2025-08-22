#!/usr/bin/env node

import { Command } from 'commander';
import * as agentCommands from './commands/agent';
import * as serverCommands from './commands/server';
import * as frontendCommands from './commands/frontend';
import * as bridgeCommands from './commands/bridge';
import * as statusCommands from './commands/status';
import * as chatCommands from './commands/chat';
import * as studioServerCommands from './commands/studio-server';
import { getVersion } from './utils/version';

const program = new Command();

program
  .name('mcpx')
  .description('MCPx command-line interface for managing the entire MCPx ecosystem')
  .version(getVersion());

// Agent management commands
const agent = program
  .command('agent')
  .description('Manage MCPx agents');

agent
  .command('create <name>')
  .description('Create a new agent configuration')
  .option('-t, --template <template>', 'Use a template (basic, openai, claude)', 'basic')
  .option('-i, --interactive', 'Interactive configuration mode')
  .action(agentCommands.createAgent);

agent
  .command('start <name>')
  .description('Start an agent')
  .option('-d, --detached', 'Run in background')
  .option('--log-level <level>', 'Log level (debug, info, warn, error)', 'info')
  .action(agentCommands.startAgent);

agent
  .command('stop <name>')
  .description('Stop a running agent')
  .option('-f, --force', 'Force stop')
  .action(agentCommands.stopAgent);

agent
  .command('restart <name>')
  .description('Restart an agent')
  .action(agentCommands.restartAgent);

agent
  .command('list')
  .alias('ls')
  .description('List all agents')
  .option('-r, --running', 'Show only running agents')
  .option('-j, --json', 'Output as JSON')
  .action(agentCommands.listAgents);

agent
  .command('status <name>')
  .description('Show agent status')
  .action(agentCommands.statusAgent);

agent
  .command('logs <name>')
  .description('Show agent logs')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <lines>', 'Number of lines to show', '50')
  .action(agentCommands.logsAgent);

agent
  .command('config <name>')
  .description('Edit agent configuration')
  .option('-e, --editor <editor>', 'Editor to use', process.env.EDITOR || 'vi')
  .action(agentCommands.configAgent);

agent
  .command('remove <name>')
  .alias('rm')
  .description('Remove an agent')
  .option('-f, --force', 'Skip confirmation')
  .action(agentCommands.removeAgent);

// Chat commands (moved from mcpx-chat)
const chat = program
  .command('chat')
  .description('Chat with MCPx topics')
  .option('-s, --server <url>', 'MCPx server URL', 'ws://localhost:3000')
  .option('-t, --topic <topic>', 'Topic to join', 'room:general')
  .action(chatCommands.interactiveChat);

program
  .command('send <message>')
  .description('Send a message to a topic')
  .option('-s, --server <url>', 'MCPx server URL', 'ws://localhost:3000')
  .option('-t, --topic <topic>', 'Topic to send to', 'room:general')
  .option('--wait <ms>', 'Wait for responses (milliseconds)', '0')
  .action(chatCommands.sendMessage);

// Server management commands
const server = program
  .command('server')
  .description('Manage MCPx server');

server
  .command('start')
  .description('Start the MCPx server')
  .option('-d, --detached', 'Run in background')
  .option('--dev', 'Run in development mode')
  .action(serverCommands.startServer);

server
  .command('stop')
  .description('Stop the MCPx server')
  .option('-f, --force', 'Force stop')
  .action(serverCommands.stopServer);

server
  .command('restart')
  .description('Restart the MCPx server')
  .action(serverCommands.restartServer);

server
  .command('status')
  .description('Show server status')
  .action(serverCommands.statusServer);

server
  .command('logs')
  .description('Show server logs')
  .option('-n, --lines <lines>', 'Number of lines to show', '50')
  .action(serverCommands.logsServer);

server
  .command('config')
  .description('Configure server settings')
  .option('-p, --port <port>', 'Server port')
  .option('-h, --host <host>', 'Server host')
  .option('-l, --log-level <level>', 'Log level')
  .action(serverCommands.configServer);

// Frontend management commands
const frontend = program
  .command('frontend')
  .description('Manage MCPx frontend');

frontend
  .command('start')
  .description('Start the MCPx frontend')
  .option('-d, --detached', 'Run in background')
  .option('--dev', 'Run in development mode')
  .option('-p, --port <port>', 'Frontend port', '3001')
  .option('-s, --server-url <url>', 'MCPx server URL', 'ws://localhost:3000')
  .action(frontendCommands.startFrontend);

frontend
  .command('stop')
  .description('Stop the MCPx frontend')
  .option('-f, --force', 'Force stop')
  .action(frontendCommands.stopFrontend);

frontend
  .command('status')
  .description('Show frontend status')
  .action(frontendCommands.statusFrontend);

frontend
  .command('logs')
  .description('Show frontend logs')
  .option('-n, --lines <lines>', 'Number of lines to show', '50')
  .action(frontendCommands.logsFrontend);

// Bridge management commands
const bridge = program
  .command('bridge')
  .description('Manage MCP server bridges');

bridge
  .command('create <name>')
  .description('Create a new bridge configuration')
  .option('-c, --command <command>', 'MCP server command')
  .option('-a, --args <args>', 'MCP server arguments')
  .option('-s, --server <url>', 'MCPx server URL', 'ws://localhost:3000')
  .option('-t, --topic <topic>', 'MCPx topic', 'room:general')
  .action(bridgeCommands.createBridge);

bridge
  .command('start <name>')
  .description('Start a bridge')
  .option('-d, --detached', 'Run in background')
  .action(bridgeCommands.startBridge);

bridge
  .command('stop <name>')
  .description('Stop a bridge')
  .option('-f, --force', 'Force stop')
  .action(bridgeCommands.stopBridge);

bridge
  .command('list')
  .alias('ls')
  .description('List all bridges')
  .action(bridgeCommands.listBridges);

bridge
  .command('status <name>')
  .description('Show bridge status')
  .action(bridgeCommands.statusBridge);

bridge
  .command('logs <name>')
  .description('Show bridge logs')
  .option('-n, --lines <lines>', 'Number of lines to show', '50')
  .action(bridgeCommands.logsBridge);

bridge
  .command('remove <name>')
  .alias('rm')
  .description('Remove a bridge')
  .option('-f, --force', 'Skip confirmation and force stop if running')
  .action(bridgeCommands.removeBridge);

// Global system commands
program
  .command('start')
  .description('Start all MCPx components')
  .option('--no-frontend', 'Skip starting frontend')
  .option('--no-agents', 'Skip starting agents')
  .action(statusCommands.startAll);

program
  .command('stop')
  .description('Stop all MCPx components')
  .option('-f, --force', 'Force stop')
  .action(statusCommands.stopAll);

program
  .command('status')
  .description('Show status of all MCPx components')
  .option('-j, --json', 'Output as JSON')
  .action(statusCommands.showStatus);

// Studio backend server
program
  .command('studio-server')
  .description('Start the MCPx Studio backend server')
  .option('-p, --port <port>', 'Port to listen on', '3100')
  .action(studioServerCommands.startStudioServer);

// Utility commands
program
  .command('init')
  .description('Initialize MCPx configuration')
  .action(async () => {
    const { initConfig } = await import('./commands/init');
    await initConfig();
  });

program
  .command('migrate')
  .description('Migrate from old configuration format')
  .action(async () => {
    const { migrateConfig } = await import('./commands/migrate');
    await migrateConfig();
  });

program.parse();