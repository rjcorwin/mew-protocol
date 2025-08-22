import { MCPxAgentClient, ChatMessage, Peer, Tool } from '@mcpx/agent-client';
import * as readline from 'readline';
import chalk from 'chalk';
import Debug from 'debug';

const debug = Debug('mcpx:chat:client');

export interface MCPxChatConfig {
  serverUrl: string;
  topic: string;
  participantId: string;
  participantName?: string;
  authToken?: string;
}

export class MCPxChatClient {
  private client: MCPxAgentClient;
  private config: MCPxChatConfig;
  private rl?: readline.Interface;
  private messageHistory: ChatMessage[] = [];
  
  constructor(config: MCPxChatConfig) {
    this.config = config;
    this.client = new MCPxAgentClient({
      serverUrl: config.serverUrl,
      topic: config.topic,
      participantId: config.participantId,
      participantName: config.participantName,
      authToken: config.authToken || ''
    });
    
    this.setupHandlers();
  }
  
  private setupHandlers(): void {
    // Handle incoming chat messages
    this.client.on('chat', (message: ChatMessage) => {
      this.messageHistory.push(message);
      
      // Don't show our own messages in interactive mode (we already see them)
      if (message.from === this.config.participantId && this.rl) {
        return;
      }
      
      this.displayMessage(message);
    });
    
    // Handle peer events
    this.client.on('peerJoined', (peer: Peer) => {
      if (this.rl) {
        console.log(chalk.gray(`→ ${peer.name || peer.id} joined the topic`));
      }
      debug(`Peer joined: ${peer.id}`);
    });
    
    this.client.on('peerLeft', (peerId: string) => {
      if (this.rl) {
        console.log(chalk.gray(`← ${peerId} left the topic`));
      }
      debug(`Peer left: ${peerId}`);
    });
    
    // Handle connection events
    let isFirstConnection = true;
    this.client.on('connected', () => {
      if (isFirstConnection) {
        console.log(chalk.green(`✓ Connected to ${this.config.topic} as ${this.config.participantName || this.config.participantId}`));
        isFirstConnection = false;
      }
      debug('Connected to MCPx server');
    });
    
    this.client.on('disconnected', () => {
      console.log(chalk.red('✗ Disconnected from server'));
      debug('Disconnected from MCPx server');
    });
    
    this.client.on('error', (error: Error) => {
      console.error(chalk.red('Error:'), error.message);
      debug('Error:', error);
    });
  }
  
  private displayMessage(message: ChatMessage): void {
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const from = message.from === this.config.participantId ? 'You' : message.from;
    
    console.log(
      chalk.gray(`[${timestamp}]`) + ' ' +
      chalk.cyan(from) + ': ' +
      message.text
    );
  }
  
  async connect(): Promise<void> {
    // If no auth token provided, generate one
    if (!this.config.authToken) {
      try {
        // Extract the host from the WebSocket URL for the auth endpoint
        const wsUrl = new URL(this.config.serverUrl);
        const authUrl = `http://${wsUrl.host}/v0/auth/token`;
        
        const response = await fetch(authUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId: this.config.participantId,
            topic: this.config.topic
          })
        });
        
        if (response.ok) {
          const data = await response.json() as { token: string };
          this.config.authToken = data.token;
          // Remove all listeners from old client
          this.client.removeAllListeners();
          // Update the client with the new token
          this.client = new MCPxAgentClient({
            serverUrl: this.config.serverUrl,
            topic: this.config.topic,
            participantId: this.config.participantId,
            participantName: this.config.participantName,
            authToken: data.token
          });
          this.setupHandlers();
        }
      } catch (error) {
        debug('Failed to get auth token:', error);
      }
    }
    
    await this.client.connect();
    
    // Wait longer for initial peer discovery and tool initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  async disconnect(): Promise<void> {
    if (this.rl) {
      this.rl.close();
    }
    this.client.disconnect();
  }
  
  async sendMessage(text: string): Promise<void> {
    this.client.sendChat(text);
  }
  
  async callTool(peerId: string, toolName: string, params: any): Promise<any> {
    return this.client.callTool(peerId, toolName, params);
  }
  
  showTools(filterPeerId?: string): void {
    const tools = this.client.listTools();
    
    if (tools.length === 0) {
      console.log(chalk.yellow('No tools available'));
      return;
    }
    
    // Group tools by peer
    const toolsByPeer = new Map<string, Tool[]>();
    for (const tool of tools) {
      if (filterPeerId && tool.peerId !== filterPeerId) continue;
      
      if (!toolsByPeer.has(tool.peerId)) {
        toolsByPeer.set(tool.peerId, []);
      }
      toolsByPeer.get(tool.peerId)!.push(tool);
    }
    
    console.log(chalk.bold('\nAvailable Tools:\n'));
    
    for (const [peerId, peerTools] of toolsByPeer) {
      console.log(chalk.cyan(`${peerId}:`));
      for (const tool of peerTools) {
        console.log(`  • ${chalk.green(tool.name)}${tool.description ? ': ' + tool.description : ''}`);
        if (tool.inputSchema) {
          const required = tool.inputSchema.required || [];
          const properties = tool.inputSchema.properties || {};
          const params = Object.keys(properties).map(key => {
            const isRequired = required.includes(key);
            return isRequired ? chalk.yellow(key) : chalk.gray(key);
          });
          if (params.length > 0) {
            console.log(`    Parameters: ${params.join(', ')}`);
          }
        }
      }
      console.log();
    }
  }
  
  showPeers(): void {
    const peers = this.client.getPeers();
    
    if (peers.length === 0) {
      console.log(chalk.yellow('No peers connected'));
      return;
    }
    
    console.log(chalk.bold('\nConnected Peers:\n'));
    
    for (const peer of peers) {
      const toolCount = peer.tools.length;
      console.log(
        `• ${chalk.cyan(peer.id)}` +
        (peer.name ? ` (${peer.name})` : '') +
        chalk.gray(` - ${toolCount} tool${toolCount !== 1 ? 's' : ''}`)
      );
    }
    console.log();
  }
  
  async startInteractive(): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.blue('> ')
    });
    
    console.log(chalk.gray('\nInteractive chat started. Type /help for commands.\n'));
    
    this.rl.prompt();
    
    this.rl.on('line', async (line) => {
      const trimmed = line.trim();
      
      if (!trimmed) {
        this.rl!.prompt();
        return;
      }
      
      // Handle commands
      if (trimmed.startsWith('/')) {
        await this.handleCommand(trimmed);
      } else {
        // Send as chat message
        await this.sendMessage(trimmed);
      }
      
      this.rl!.prompt();
    });
    
    this.rl.on('close', () => {
      console.log(chalk.gray('\nGoodbye!'));
      process.exit(0);
    });
    
    // Keep the process running
    await new Promise(() => {});
  }
  
  private async handleCommand(command: string): Promise<void> {
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    
    switch (cmd) {
      case '/help':
        console.log(chalk.bold('\nAvailable Commands:\n'));
        console.log('  /help              - Show this help message');
        console.log('  /tools [peer]      - List available tools');
        console.log('  /peers             - List connected peers');
        console.log('  /call <peer> <tool> <params> - Call a tool');
        console.log('  /history [n]       - Show last n messages (default: 10)');
        console.log('  /clear             - Clear the screen');
        console.log('  /quit              - Exit the chat');
        console.log();
        break;
        
      case '/tools':
        this.showTools(parts[1]);
        break;
        
      case '/peers':
        this.showPeers();
        break;
        
      case '/call':
        if (parts.length < 3) {
          console.log(chalk.red('Usage: /call <peer> <tool> [params as JSON]'));
          break;
        }
        
        const peerId = parts[1];
        const toolName = parts[2];
        const paramString = parts.slice(3).join(' ');
        
        try {
          const params = paramString ? JSON.parse(paramString) : {};
          console.log(chalk.gray(`Calling ${toolName} on ${peerId}...`));
          const result = await this.callTool(peerId, toolName, params);
          console.log(chalk.green('Result:'), result);
        } catch (error: any) {
          console.log(chalk.red('Error:'), error.message);
        }
        break;
        
      case '/history':
        const count = parseInt(parts[1]) || 10;
        const recent = this.messageHistory.slice(-count);
        console.log(chalk.bold(`\nLast ${recent.length} messages:\n`));
        recent.forEach(msg => this.displayMessage(msg));
        console.log();
        break;
        
      case '/clear':
        console.clear();
        break;
        
      case '/quit':
      case '/exit':
        this.rl!.close();
        break;
        
      default:
        console.log(chalk.red(`Unknown command: ${cmd}. Type /help for available commands.`));
    }
  }
  
  getClient(): MCPxAgentClient {
    return this.client;
  }
}