#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { MCPxClient, Envelope, Peer, SystemWelcomePayload, ChatPayload } from '@mcpx-protocol/client';
import readline from 'readline';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Config file path
const CONFIG_DIR = path.join(os.homedir(), '.mcpx');
const CONFIG_FILE = path.join(CONFIG_DIR, 'connections.json');

interface ConnectionConfig {
  name: string;
  gateway: string;
  topic: string;
  participantId: string;
  token?: string;
}

interface SavedConfigs {
  connections: ConnectionConfig[];
  lastUsed?: string;
}

class MCPxChatClient {
  private client: MCPxClient | null = null;
  private rl: readline.Interface;
  private isConnected = false;
  private peers: Map<string, Peer> = new Map();
  private currentConfig: ConnectionConfig | null = null;
  private isPrompting = false;
  private debugMode = false;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.gray('mcpx> '),
    });

    this.setupReadline();
  }

  private setupReadline(): void {
    this.rl.on('line', async (line) => {
      // Ignore input while prompting
      if (this.isPrompting) {
        return;
      }
      
      const trimmed = line.trim();
      
      if (!trimmed) {
        this.rl.prompt();
        return;
      }

      if (trimmed.startsWith('/')) {
        await this.handleCommand(trimmed);
      } else {
        // Send as chat message
        if (this.isConnected && this.client) {
          this.client.chat(trimmed);
          this.displayMessage('You', trimmed, 'chat');
        } else {
          console.log(chalk.red('Not connected. Use /connect to connect to a topic.'));
        }
      }

      // Ensure prompt is displayed with a small delay for terminal refresh
      setImmediate(() => {
        this.rl.prompt();
      });
    });

    this.rl.on('close', () => {
      if (this.client) {
        this.client.disconnect();
      }
      console.log(chalk.yellow('\nGoodbye!'));
    });
  }

  private async handleCommand(command: string): Promise<void> {
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case '/help':
      case '/?':
        this.showHelp();
        break;

      case '/connect':
        // Support quick connect: /connect gateway topic participant
        if (parts.length === 4) {
          await this.quickConnect(parts[1], parts[2], parts[3]);
        } else {
          await this.connect();
        }
        break;

      case '/disconnect':
        this.disconnect();
        break;

      case '/list':
      case '/participants':
        this.listParticipants();
        break;

      case '/tools':
        await this.listTools(parts[1]);
        break;

      case '/call':
        await this.callTool(parts.slice(1));
        break;

      case '/history':
        await this.showHistory();
        break;

      case '/status':
        this.showStatus();
        break;

      case '/save':
        await this.saveConfig(parts[1]);
        break;

      case '/load':
        await this.loadConfig(parts[1]);
        break;

      case '/debug':
        this.debugMode = !this.debugMode;
        console.log(chalk.yellow(`Debug mode ${this.debugMode ? 'enabled' : 'disabled'}${this.debugMode ? ' - showing raw protocol envelopes' : ''}`));
        break;
        
      case '/quit':
      case '/exit':
        this.rl.close();
        break;

      default:
        console.log(chalk.red(`Unknown command: ${cmd}. Type /help for available commands.`));
    }
  }

  private showHelp(): void {
    console.log(chalk.cyan('\n=== MCPx Chat Client Commands ===\n'));
    console.log(chalk.white('Chat:'));
    console.log('  Just type to send a chat message');
    console.log();
    console.log(chalk.white('Commands:'));
    console.log('  /help              - Show this help message');
    console.log('  /connect           - Connect to an MCPx gateway');
    console.log('  /disconnect        - Disconnect from current topic');
    console.log('  /list              - List all participants');
    console.log('  /tools <peer>      - List tools for a peer');
    console.log('  /call <peer> <tool> <args> - Call a peer\'s tool');
    console.log('  /history           - Show message history');
    console.log('  /status            - Show connection status');
    console.log('  /debug             - Toggle debug mode (show raw envelopes)');
    console.log('  /save <name>       - Save current connection config');
    console.log('  /load <name>       - Load a saved connection');
    console.log('  /quit              - Exit the client');
    console.log();
  }

  private async connect(): Promise<void> {
    if (this.isConnected) {
      console.log(chalk.yellow('Already connected. Use /disconnect first.'));
      return;
    }

    // Pause readline while prompting
    this.isPrompting = true;
    this.rl.pause();

    // Check for saved configs
    const configs = await this.loadConfigs();
    let config: ConnectionConfig;

    if (configs.connections.length > 0) {
      const { useSaved } = await inquirer.prompt([{
        type: 'confirm',
        name: 'useSaved',
        message: 'Use a saved connection?',
        default: true,
      }]);

      if (useSaved) {
        const { selected } = await inquirer.prompt([{
          type: 'list',
          name: 'selected',
          message: 'Select a connection:',
          choices: configs.connections.map(c => ({
            name: `${c.name} (${c.gateway} - ${c.topic})`,
            value: c,
          })),
        }]);
        config = selected;
      } else {
        config = await this.promptConnection();
      }
    } else {
      config = await this.promptConnection();
    }

    // Get token if not saved
    if (!config.token) {
      config.token = await this.getToken(config);
    }

    const spinner = ora('Connecting to MCPx gateway...').start();

    try {
      this.client = new MCPxClient({
        gateway: config.gateway,
        topic: config.topic,
        token: config.token,
      });

      this.setupClientHandlers();

      await this.client.connect();
      
      this.isConnected = true;
      this.currentConfig = config;
      
      spinner.succeed(chalk.green(`Connected to ${config.topic} as ${config.participantId}`));
      
    } catch (error) {
      spinner.fail(chalk.red(`Failed to connect: ${error}`));
      this.client = null;
    } finally {
      // Resume readline after prompting
      this.isPrompting = false;
      this.rl.resume();
    }
  }

  private async quickConnect(gateway: string, topic: string, participantId: string): Promise<void> {
    if (this.isConnected) {
      console.log(chalk.yellow('Already connected. Use /disconnect first.'));
      return;
    }

    const config: ConnectionConfig = {
      name: `${participantId}@${topic}`,
      gateway,
      topic,
      participantId,
    };

    // Get token
    config.token = await this.getToken(config);

    const spinner = ora('Connecting to MCPx gateway...').start();

    try {
      this.client = new MCPxClient({
        gateway: config.gateway,
        topic: config.topic,
        token: config.token,
      });

      this.setupClientHandlers();
      await this.client.connect();
      
      this.isConnected = true;
      this.currentConfig = config;
      
      spinner.succeed(chalk.green(`Connected to ${config.topic} as ${config.participantId}`));
    } catch (error) {
      spinner.fail(chalk.red(`Failed to connect: ${error}`));
      this.client = null;
    }
  }

  private async promptConnection(): Promise<ConnectionConfig> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'gateway',
        message: 'Gateway URL:',
        default: 'ws://localhost:3000',
      },
      {
        type: 'input',
        name: 'topic',
        message: 'Topic:',
        default: 'test-topic',
      },
      {
        type: 'input',
        name: 'participantId',
        message: 'Participant ID:',
        default: 'cli-user',
      },
    ]);

    return {
      name: `${answers.participantId}@${answers.topic}`,
      ...answers,
    };
  }

  private async getToken(config: ConnectionConfig): Promise<string> {
    const spinner = ora('Getting authentication token...').start();

    try {
      const gatewayUrl = config.gateway.replace('ws://', 'http://').replace('wss://', 'https://');
      const response = await fetch(`${gatewayUrl}/v0.1/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantId: config.participantId,
          topic: config.topic,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get token: ${response.statusText}`);
      }

      const data = await response.json() as { token: string };
      spinner.succeed('Got authentication token');
      return data.token;
    } catch (error) {
      spinner.fail(chalk.red(`Failed to get token: ${error}`));
      throw error;
    }
  }

  private setupClientHandlers(): void {
    if (!this.client) return;

    this.client.onWelcome((data: SystemWelcomePayload) => {
      console.log(chalk.green(`\n✓ Welcome!`));
      console.log(chalk.gray(`Your ID: ${data.you.id}`));
      console.log(chalk.gray(`Your capabilities: ${data.you.capabilities.join(', ')}`));
      console.log(chalk.gray(`Other participants: ${data.participants.length}`));
      
      // Update peer list
      this.peers.clear();
      data.participants.forEach(p => this.peers.set(p.id, p));
    });

    this.client.onChat((message: ChatPayload, from: string) => {
      // Don't show our own messages twice
      if (from !== this.currentConfig?.participantId) {
        const text = message.text || '';
        this.displayMessage(from, text, 'chat');
      }
    });

    this.client.onPeerJoined((peer: Peer) => {
      this.peers.set(peer.id, peer);
      console.log(chalk.green(`→ ${peer.id} joined (capabilities: ${peer.capabilities.join(', ')})`));
    });

    this.client.onPeerLeft((peer: Peer) => {
      this.peers.delete(peer.id);
      console.log(chalk.yellow(`← ${peer.id} left the topic`));
    });

    this.client.onMessage((envelope) => {
      // Show debug output if enabled
      if (this.debugMode) {
        console.log(chalk.gray('--- Debug: Raw Envelope ---'));
        console.log(chalk.gray(JSON.stringify(envelope, null, 2)));
        // Show parsed kind information for v0.1
        if (envelope.kind.includes(':')) {
          const parts = envelope.kind.split(':');
          console.log(chalk.gray(`Kind breakdown: base='${parts[0]}', method='${parts.slice(1).join(':')}'`));
        }
        if (envelope.correlation_id) {
          console.log(chalk.gray(`Correlation ID: ${envelope.correlation_id}`));
        }
        console.log(chalk.gray('--------------------------'));
      }
      
      // Handle non-chat MCP messages (v0.1)
      if (envelope.kind.startsWith('mcp/')) {
        this.displayEnvelope(envelope);
      }
    });

    this.client.onError((error) => {
      console.log(chalk.red(`Error: ${error.message}`));
    });

    this.client.onDisconnected(() => {
      console.log(chalk.yellow('Disconnected from gateway'));
      this.isConnected = false;
    });

    this.client.onReconnected(() => {
      console.log(chalk.green('Reconnected to gateway'));
      this.isConnected = true;
    });
  }

  private displayMessage(from: string, text: string, type: 'chat' | 'system' = 'chat'): void {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'system' ? chalk.blue('[System]') : chalk.cyan(`[${from}]`);
    
    // Clear current line and display message
    process.stdout.write('\r\x1b[K');
    console.log(`${chalk.gray(timestamp)} ${prefix} ${text}`);
    
    // Redraw the prompt
    this.rl.prompt(true);
  }

  private displayEnvelope(envelope: Envelope): void {
    const timestamp = new Date(envelope.ts).toLocaleTimeString();
    const from = chalk.cyan(`[${envelope.from}]`);
    
    if (envelope.kind === 'mcp') {
      const payload = envelope.payload;
      if ('method' in payload) {
        console.log(`${chalk.gray(timestamp)} ${from} ${chalk.magenta('MCP')} → ${payload.method}`);
      } else if ('result' in payload || 'error' in payload) {
        const status = 'error' in payload ? chalk.red('error') : chalk.green('result');
        console.log(`${chalk.gray(timestamp)} ${from} ${chalk.magenta('MCP')} ${status}`);
      }
    }
  }

  private disconnect(): void {
    if (!this.isConnected || !this.client) {
      console.log(chalk.yellow('Not connected.'));
      return;
    }

    this.client.disconnect();
    this.isConnected = false;
    this.client = null;
    this.peers.clear();
    console.log(chalk.yellow('Disconnected.'));
  }

  private listParticipants(): void {
    if (!this.isConnected) {
      console.log(chalk.red('Not connected.'));
      return;
    }

    // Build output string
    let output = '\n' + chalk.cyan('=== Participants ===') + '\n\n';
    
    if (this.peers.size === 0) {
      output += chalk.gray('No other participants') + '\n';
    } else {
      this.peers.forEach((peer, id) => {
        const caps = peer.capabilities ? chalk.gray(`[${peer.capabilities.join(', ')}]`) : '';
        output += `  ${id} ${caps}\n`;
      });
    }
    output += '\n';
    
    // Write directly to process.stdout, completely bypassing readline
    process.stdout.write(output);
    
    // Force flush
    if (process.stdout.isTTY) {
      process.stdout.write('');
    }
    
    // Redraw prompt on next tick
    process.nextTick(() => {
      this.rl.prompt(true);
    });
  }

  private async listTools(peerId: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      console.log(chalk.red('Not connected.'));
      return;
    }

    if (!peerId) {
      console.log(chalk.red('Usage: /tools <peer-id>'));
      return;
    }

    const spinner = ora(`Fetching tools from ${peerId}...`).start();

    try {
      const result = await this.client.request(peerId, 'tools/list', {});
      spinner.succeed(`Tools from ${peerId}:`);
      
      if (result.tools && result.tools.length > 0) {
        result.tools.forEach((tool: any) => {
          console.log(`  - ${chalk.cyan(tool.name)}: ${tool.description || 'No description'}`);
        });
      } else {
        console.log(chalk.gray('  No tools available'));
      }
    } catch (error: any) {
      spinner.fail(chalk.red(`Failed to get tools: ${error.message}`));
    }
  }

  private async callTool(args: string[]): Promise<void> {
    if (!this.isConnected || !this.client) {
      console.log(chalk.red('Not connected.'));
      return;
    }

    if (args.length < 2) {
      console.log(chalk.red('Usage: /call <peer-id> <tool-name> [args-json]'));
      return;
    }

    const [peerId, toolName, ...argsParts] = args;
    let toolArgs = {};

    if (argsParts.length > 0) {
      try {
        toolArgs = JSON.parse(argsParts.join(' '));
      } catch {
        console.log(chalk.red('Invalid JSON arguments'));
        return;
      }
    }

    const spinner = ora(`Calling ${toolName} on ${peerId}...`).start();

    try {
      const result = await this.client.request(peerId, 'tools/call', {
        name: toolName,
        arguments: toolArgs,
      });
      
      spinner.succeed(`Tool result from ${peerId}:`);
      console.log(JSON.stringify(result, null, 2));
    } catch (error: any) {
      spinner.fail(chalk.red(`Tool call failed: ${error.message}`));
    }
  }

  private async showHistory(): Promise<void> {
    if (!this.isConnected || !this.client) {
      console.log(chalk.red('Not connected.'));
      return;
    }

    const spinner = ora('Fetching history...').start();

    try {
      const history = await this.client.getHistory({ limit: 20 });
      spinner.succeed(`History (${history.length} messages):`);
      
      history.forEach(envelope => {
        this.displayEnvelope(envelope);
      });
    } catch (error: any) {
      spinner.fail(chalk.red(`Failed to get history: ${error.message}`));
    }
  }

  private showStatus(): void {
    console.log(chalk.cyan('\n=== Connection Status ===\n'));
    console.log(`Connected: ${this.isConnected ? chalk.green('Yes') : chalk.red('No')}`);
    
    if (this.currentConfig) {
      console.log(`Gateway: ${this.currentConfig.gateway}`);
      console.log(`Topic: ${this.currentConfig.topic}`);
      console.log(`Participant ID: ${this.currentConfig.participantId}`);
      console.log(`Peers: ${this.peers.size}`);
    }
    console.log();
  }

  private async saveConfig(name?: string): Promise<void> {
    if (!this.currentConfig) {
      console.log(chalk.red('No active connection to save.'));
      return;
    }

    const configName = name || this.currentConfig.name;
    this.currentConfig.name = configName;

    const configs = await this.loadConfigs();
    
    // Update or add config
    const index = configs.connections.findIndex(c => c.name === configName);
    if (index >= 0) {
      configs.connections[index] = this.currentConfig;
    } else {
      configs.connections.push(this.currentConfig);
    }
    
    configs.lastUsed = configName;

    await this.saveConfigs(configs);
    console.log(chalk.green(`Configuration saved as "${configName}"`));
  }

  private async loadConfig(name?: string): Promise<void> {
    const configs = await this.loadConfigs();
    
    if (configs.connections.length === 0) {
      console.log(chalk.red('No saved configurations.'));
      return;
    }

    let config: ConnectionConfig | undefined;

    if (name) {
      config = configs.connections.find(c => c.name === name);
      if (!config) {
        console.log(chalk.red(`Configuration "${name}" not found.`));
        return;
      }
    } else {
      // Show list to choose from
      const { selected } = await inquirer.prompt([{
        type: 'list',
        name: 'selected',
        message: 'Select a configuration:',
        choices: configs.connections.map(c => ({
          name: `${c.name} (${c.gateway} - ${c.topic})`,
          value: c,
        })),
      }]);
      config = selected;
    }

    // Disconnect if connected
    if (this.isConnected) {
      this.disconnect();
    }

    // Connect with loaded config
    this.currentConfig = config!;
    await this.connect();
  }

  private async loadConfigs(): Promise<SavedConfigs> {
    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return { connections: [] };
    }
  }

  private async saveConfigs(configs: SavedConfigs): Promise<void> {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(configs, null, 2));
  }

  async run(): Promise<void> {
    console.log(chalk.cyan('=== MCPx Chat Client ==='));
    console.log(chalk.gray('Type /help for commands or /connect to start\n'));
    
    this.rl.prompt();
    
    // Keep the process alive
    return new Promise((resolve) => {
      this.rl.on('close', () => {
        resolve();
      });
    });
  }
}

// CLI Program
const program = new Command();

program
  .name('mcpx-chat')
  .description('MCPx interactive chat client')
  .version('0.1.0');

// Default action when no command is specified
program
  .action(async () => {
    const client = new MCPxChatClient();
    await client.run();
  });

program
  .command('quick')
  .description('Quick connect with parameters')
  .option('-g, --gateway <url>', 'Gateway URL', 'ws://localhost:3000')
  .option('-t, --topic <name>', 'Topic name', 'test-topic')
  .option('-p, --participant <id>', 'Participant ID', 'cli-user')
  .action(async (_options) => {
    const client = new MCPxChatClient();
    // TODO: Implement quick connect
    await client.run();
  });

// Parse and handle commands
(async () => {
  await program.parseAsync();
})();