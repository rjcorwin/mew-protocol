#!/usr/bin/env node
import readline from 'readline';
import { MCPxClient } from '@mcpx-protocol/client';
import { SystemWelcomePayload, ChatPayload, Peer, Envelope } from '@mcpx-protocol/client';
import chalk from 'chalk';

class TerminalCLI {
  private rl: readline.Interface;
  private client: MCPxClient | null = null;
  private peers: Map<string, Peer> = new Map();
  private isConnected = false;
  private gateway: string;
  private topic: string;
  private participantId: string;
  private token: string = '';
  private debugMode = false;
  private pendingRequests: Map<string, { method: string; to: string; timestamp: Date }> = new Map();

  constructor(gateway: string, topic: string, participantId: string) {
    this.gateway = gateway;
    this.topic = topic;
    this.participantId = participantId;

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('> ')
    });

    // Handle input
    this.rl.on('line', (line) => {
      this.handleInput(line);
      this.rl.prompt();
    });

    // Handle Ctrl+C
    this.rl.on('SIGINT', () => {
      this.log('info', 'System', 'Exiting...');
      if (this.client) {
        this.client.disconnect();
      }
      process.exit(0);
    });
  }

  async start() {
    console.clear();
    this.log('info', 'System', `MCPx Terminal Client`);
    this.log('info', 'System', `Connecting to ${this.gateway}...`);
    
    // Get token
    await this.getToken();

    // Initialize client
    this.client = new MCPxClient({
      gateway: this.gateway,
      topic: this.topic,
      token: this.token,
    });

    this.setupClientHandlers();

    // Connect
    try {
      await this.client.connect();
    } catch (err: any) {
      this.log('error', 'System', `Failed to connect: ${err.message}`);
    }

    // Show prompt
    this.rl.prompt();
  }

  private async getToken() {
    const gatewayUrl = this.gateway.replace('ws://', 'http://').replace('wss://', 'https://');
    
    try {
      const response = await fetch(`${gatewayUrl}/v0.1/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantId: this.participantId,
          topic: this.topic,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get token: ${response.statusText}`);
      }

      const data = await response.json() as { token: string };
      this.token = data.token;
      this.log('success', 'System', 'Got authentication token');
    } catch (error: any) {
      this.log('error', 'System', `Failed to get token: ${error.message}`);
      throw error;
    }
  }

  private setupClientHandlers() {
    if (!this.client) return;

    this.client.onWelcome((data: SystemWelcomePayload) => {
      this.isConnected = true;
      
      this.log('success', 'System', `Connected to topic: ${this.topic}`);
      this.log('info', 'System', `Your ID: ${data.you.id}`);
      this.log('info', 'System', `Capabilities: ${data.you.capabilities.join(', ')}`);
      
      // Update peers
      this.peers.clear();
      data.participants.forEach(p => this.peers.set(p.id, p));
      
      if (data.participants.length > 0) {
        this.log('info', 'System', `${data.participants.length} other participant(s) in topic`);
      }
      
      // Show help hint
      this.log('info', 'System', 'Type /help for commands');
      this.rl.prompt();
    });

    this.client.onChat((message: ChatPayload, from: string) => {
      const text = message.text || '';
      const displayFrom = from === this.participantId ? 'You' : from;
      this.log('chat', displayFrom, text);
      this.rl.prompt();
    });

    this.client.onPeerJoined((peer: Peer) => {
      this.peers.set(peer.id, peer);
      this.log('join', 'System', `${peer.id} joined`);
      this.rl.prompt();
    });

    this.client.onPeerLeft((peer: Peer) => {
      this.peers.delete(peer.id);
      this.log('leave', 'System', `${peer.id} left`);
      this.rl.prompt();
    });

    this.client.onMessage((envelope: Envelope) => {
      // In debug mode, show ALL envelopes
      if (this.debugMode) {
        this.logEnvelope(envelope);
        this.rl.prompt();
      } else if (envelope.kind.startsWith('mcp/') || envelope.kind === 'mcp') {
        // Show MCP activity in non-debug mode
        this.logMcpActivity(envelope);
        this.rl.prompt();
      }
    });

    this.client.onError((error: Error) => {
      this.log('error', 'System', `Error: ${error.message}`);
      this.rl.prompt();
    });

    this.client.onDisconnected(() => {
      this.isConnected = false;
      this.log('error', 'System', 'Disconnected');
      this.rl.prompt();
    });

    this.client.onReconnected(() => {
      this.isConnected = true;
      this.log('success', 'System', 'Reconnected');
      this.rl.prompt();
    });
  }

  private handleInput(input: string) {
    if (!input.trim()) return;

    if (input.startsWith('/')) {
      this.handleCommand(input);
    } else if (this.isConnected && this.client) {
      // Send chat message
      this.client.chat(input);
      if (!this.debugMode) {
        this.log('chat', 'You', input);
      }
    } else {
      this.log('error', 'System', 'Not connected');
    }
  }

  private async handleCommand(cmd: string) {
    const [command, ...args] = cmd.slice(1).split(' ');

    switch (command) {
      case 'help':
        this.showHelp();
        break;

      case 'list':
        this.listParticipants();
        break;

      case 'quit':
      case 'exit':
        if (this.client) {
          this.client.disconnect();
        }
        process.exit(0);
        break;

      case 'tools':
        if (!this.client || args.length === 0) {
          this.log('error', 'System', 'Usage: /tools <participant-id>');
          return;
        }
        await this.listTools(args[0]);
        break;

      case 'call':
        if (!this.client || args.length < 2) {
          this.log('error', 'System', 'Usage: /call <participant-id> <tool> <json-args>');
          return;
        }
        await this.callTool(args);
        break;

      case 'clear':
        console.clear();
        this.log('info', 'System', 'Screen cleared');
        break;

      case 'debug':
        this.debugMode = !this.debugMode;
        this.log('info', 'System', `Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`);
        break;

      default:
        this.log('error', 'System', `Unknown command: ${command}`);
    }
  }

  private showHelp() {
    console.log(chalk.cyan(`
Commands:
  /help              - Show this help
  /list              - List participants
  /tools <id>        - List tools from participant
  /call <id> <tool>  - Call a tool
  /clear             - Clear screen
  /debug             - Toggle debug mode (show raw envelopes)
  /quit              - Exit

Just type to send a chat message.
Use your terminal's native scrolling to view history.
`));
  }

  private listParticipants() {
    const peers = Array.from(this.peers.values());
    
    this.log('info', 'System', '=== Participants ===');
    
    if (peers.length === 0) {
      this.log('info', 'System', 'No other participants');
    } else {
      peers.forEach(peer => {
        const capabilities = peer.capabilities?.join(', ') || 'none';
        this.log('info', 'System', `  ${peer.id} [${capabilities}]`);
      });
    }
  }

  private async listTools(participantId: string) {
    if (!this.client) return;

    try {
      this.log('info', 'System', `Fetching tools from ${participantId}...`);
      const result = await this.client.request(participantId, 'tools/list', {});
      const tools = result.tools || [];
      
      if (tools.length === 0) {
        this.log('info', 'System', `No tools from ${participantId}`);
      } else {
        this.log('success', 'System', `Tools from ${participantId}:`);
        tools.forEach((tool: any) => {
          this.log('info', 'System', `  - ${tool.name}: ${tool.description || 'No description'}`);
        });
      }
    } catch (err: any) {
      this.log('error', 'System', `Failed to get tools: ${err.message}`);
    }
  }

  private async callTool(args: string[]) {
    if (!this.client) return;

    try {
      const [target, tool, ...jsonArgs] = args;
      const params = jsonArgs.length > 0 ? JSON.parse(jsonArgs.join(' ')) : {};
      
      this.log('info', 'System', `Calling ${tool} on ${target}...`);
      
      const result = await this.client.request(target, 'tools/call', {
        name: tool,
        arguments: params,
      });
      
      this.log('success', 'System', 'Tool result:');
      console.log(JSON.stringify(result, null, 2));
    } catch (err: any) {
      this.log('error', 'System', `Failed to call tool: ${err.message}`);
    }
  }

  private log(type: string, from: string, message: string) {
    const timestamp = new Date().toLocaleTimeString();
    let output = '';

    switch(type) {
      case 'chat':
        output = chalk.white(`[${timestamp}] `) + 
                (from === 'You' ? chalk.yellow(`${from}: `) : chalk.white(`${from}: `)) +
                chalk.white(message);
        break;
      case 'error':
        output = chalk.red(`[${timestamp}] ❌ ${message}`);
        break;
      case 'success':
        output = chalk.green(`[${timestamp}] ✅ ${message}`);
        break;
      case 'info':
        output = chalk.cyan(`[${timestamp}] ${message}`);
        break;
      case 'join':
        output = chalk.green(`[${timestamp}] → ${message}`);
        break;
      case 'leave':
        output = chalk.gray(`[${timestamp}] ← ${message}`);
        break;
      case 'mcp':
        output = chalk.magenta(`[${timestamp}] [MCP] ${from}: ${message}`);
        break;
      default:
        output = `[${timestamp}] ${from}: ${message}`;
    }

    // Clear the prompt line, print our message, then restore the prompt
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    console.log(output);
  }

  private logEnvelope(envelope: Envelope) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(chalk.gray('─'.repeat(80)));
    console.log(chalk.magenta(`[${timestamp}] DEBUG: ${chalk.bold(envelope.kind)} envelope`));
    console.log(chalk.gray(`From: ${envelope.from}`));
    if (envelope.to) {
      console.log(chalk.gray(`To: ${envelope.to.join(', ')}`));
    }
    if (envelope.correlation_id) {
      console.log(chalk.gray(`Correlation: ${envelope.correlation_id}`));
    }
    console.log(chalk.gray('Payload:'));
    console.log(JSON.stringify(envelope.payload, null, 2));
    console.log(chalk.gray('─'.repeat(80)));
  }

  private logMcpActivity(envelope: Envelope) {
    let description = '';
    
    if (envelope.kind.startsWith('mcp/request:')) {
      const method = envelope.kind.substring('mcp/request:'.length);
      description = `→ ${method}`;
    } else if (envelope.kind.startsWith('mcp/response:')) {
      const method = envelope.kind.substring('mcp/response:'.length);
      description = envelope.payload.error ? 
        `← ${method} error` : 
        `← ${method} response`;
    } else if (envelope.kind.startsWith('mcp/proposal:')) {
      const method = envelope.kind.substring('mcp/proposal:'.length);
      description = `? ${method} proposal`;
    }
    
    if (description) {
      this.log('mcp', envelope.from, description);
    }
  }
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('Usage: cli-terminal <gateway> <topic> <participant-id>');
    console.error('Example: cli-terminal ws://localhost:3000 test-room my-user');
    process.exit(1);
  }

  const [gateway, topic, participantId] = args;
  
  const cli = new TerminalCLI(gateway, topic, participantId);
  await cli.start();
}

main().catch(console.error);