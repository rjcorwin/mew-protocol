#!/usr/bin/env node
import blessed from 'blessed';
import { MCPxClient } from '@mcpx-protocol/client';
import { SystemWelcomePayload, ChatMessage, Peer, Envelope } from '@mcpx-protocol/client';

class BlessedCLI {
  private screen: blessed.Widgets.Screen;
  private messages: blessed.Widgets.Log;
  private console: blessed.Widgets.Log;
  private input: blessed.Widgets.Textbox;
  private statusBar: blessed.Widgets.BoxElement;
  private client: MCPxClient | null = null;
  private peers: Map<string, Peer> = new Map();
  private isConnected = false;
  private gateway: string;
  private topic: string;
  private participantId: string;
  private token: string = '';
  private showConsole = false;
  private pendingRequests: Map<string, { method: string; to: string; timestamp: Date }> = new Map();

  constructor(gateway: string, topic: string, participantId: string) {
    this.gateway = gateway;
    this.topic = topic;
    this.participantId = participantId;

    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'MCPx Chat Client',
      fullUnicode: true,
    });

    // Create message log (left pane when console is shown)
    this.messages = blessed.log({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%-3',
      border: {
        type: 'line',
      },
      label: ' Messages ',
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true,
      style: {
        border: {
          fg: 'cyan',
        },
      },
    });

    // Create console log (right pane for protocol debugging)
    this.console = blessed.log({
      parent: this.screen,
      top: 0,
      left: '50%',
      width: '50%',
      height: '100%-3',
      border: {
        type: 'line',
      },
      label: ' Protocol Console (F2 to toggle) ',
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true,
      hidden: true, // Start hidden
      style: {
        border: {
          fg: 'yellow',
        },
      },
    });

    // Create status bar
    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 2,
      left: 0,
      width: '100%',
      height: 1,
      content: `MCPx | Disconnected | ${topic} | Peers: 0 | Console: OFF | F2: Toggle Console | Ctrl+C: Exit | /help for commands`,
      tags: false,
    });

    // Create input box
    this.input = blessed.textbox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      border: {
        type: 'line',
      },
      label: ' Input ',
      inputOnFocus: true,
      style: {
        border: {
          fg: 'cyan',
        },
      },
    });

    // Handle input submission
    this.input.on('submit', (value: string) => {
      this.handleInput(value);
      this.input.clearValue();
      this.input.focus();
      this.screen.render();
    });

    // Handle key bindings
    this.screen.key(['C-c'], () => {
      if (this.client) {
        this.client.disconnect();
      }
      process.exit(0);
    });

    // Toggle console view with F2
    this.screen.key(['f2'], () => {
      this.toggleConsole();
    });

    // Focus input by default
    this.input.focus();
  }

  async start() {
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
      this.addMessage('System', `Failed to connect: ${err.message}`, 'error');
    }

    // Render screen
    this.screen.render();
  }

  private async getToken() {
    const gatewayUrl = this.gateway.replace('ws://', 'http://').replace('wss://', 'https://');
    
    try {
      const response = await fetch(`${gatewayUrl}/v0/auth/token`, {
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
      this.addMessage('System', 'Got authentication token', 'success');
    } catch (error: any) {
      this.addMessage('System', `Failed to get token: ${error.message}`, 'error');
      throw error;
    }
  }

  private setupClientHandlers() {
    if (!this.client) return;

    this.client.on('welcome', (data: SystemWelcomePayload) => {
      this.isConnected = true;
      this.updateStatus();
      
      this.addMessage('System', `Welcome to ${data.topic}!`, 'success');
      this.addMessage('System', `Your ID: ${data.participant_id}`, 'info');
      
      // Update peers
      this.peers.clear();
      data.participants.forEach(p => this.peers.set(p.id, p));
      this.updateStatus();
      
      // Show history
      if (data.history && data.history.length > 0) {
        this.addMessage('System', `--- Recent History (${data.history.length} messages) ---`, 'info');
        data.history.forEach(env => {
          if (env.kind === 'mcp' && env.payload.method === 'notifications/chat/message') {
            const text = env.payload.params?.text || '';
            this.addMessage(env.from, text, 'chat');
          } else {
            this.displayEnvelope(env);
          }
        });
        this.addMessage('System', '--- End History ---', 'info');
      }
    });

    this.client.on('chat', (message: ChatMessage, from: string) => {
      if (from !== this.participantId) {
        const text = message.params?.text || '';
        this.addMessage(from, text, 'chat');
      }
    });

    this.client.on('peer-joined', (peer: Peer) => {
      this.peers.set(peer.id, peer);
      this.addMessage('System', `→ ${peer.id} joined`, 'join');
      this.updateStatus();
    });

    this.client.on('peer-left', (peer: Peer) => {
      this.peers.delete(peer.id);
      this.addMessage('System', `← ${peer.id} left`, 'leave');
      this.updateStatus();
    });

    this.client.on('message', (envelope: Envelope) => {
      // Log all protocol messages to console
      this.logToConsole(envelope);
      
      // Display MCP messages (non-chat) in main view
      if (envelope.kind === 'mcp' && envelope.payload.method !== 'notifications/chat/message') {
        this.displayEnvelope(envelope);
      }
    });

    this.client.on('error', (error: Error) => {
      this.addMessage('System', `Error: ${error.message}`, 'error');
    });

    this.client.on('disconnected', () => {
      this.isConnected = false;
      this.addMessage('System', 'Disconnected', 'error');
      this.updateStatus();
    });

    this.client.on('reconnected', () => {
      this.isConnected = true;
      this.addMessage('System', 'Reconnected', 'success');
      this.updateStatus();
    });
  }

  private handleInput(value: string) {
    if (!value.trim()) return;

    if (value.startsWith('/')) {
      this.handleCommand(value);
    } else if (this.isConnected && this.client) {
      // Send chat message
      this.client.chat(value);
      this.addMessage('You', value, 'chat');
    } else {
      this.addMessage('System', 'Not connected', 'error');
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
          this.addMessage('System', 'Usage: /tools <participant-id>', 'error');
          return;
        }
        await this.listTools(args[0]);
        break;

      case 'call':
        if (!this.client || args.length < 2) {
          this.addMessage('System', 'Usage: /call <participant-id> <tool> <json-args>', 'error');
          return;
        }
        await this.callTool(args);
        break;

      case 'clear':
        this.messages.setContent('');
        this.screen.render();
        break;

      case 'console':
        this.toggleConsole();
        break;

      default:
        this.addMessage('System', `Unknown command: ${command}`, 'error');
    }
  }

  private showHelp() {
    const help = `
Commands:
  /help              - Show this help
  /list              - List participants
  /tools <id>        - List tools from participant
  /call <id> <tool>  - Call a tool
  /clear             - Clear messages
  /console           - Toggle protocol console
  /quit              - Exit

Key Bindings:
  F2                 - Toggle protocol console
  Ctrl+C             - Exit

Examples:
  /tools calculator-agent
  /call calculator-agent add {"a": 5, "b": 3}
  calculate 10 + 20
`;
    this.addMessage('System', help, 'info');
  }

  private listParticipants() {
    const peers = Array.from(this.peers.values());
    
    this.addMessage('System', '=== Participants ===', 'info');
    
    if (peers.length === 0) {
      this.addMessage('System', '  No other participants', 'info');
    } else {
      peers.forEach(peer => {
        const role = peer.role || 'user';
        const capabilities = peer.capabilities?.join(', ') || 'none';
        this.addMessage('System', `  ${peer.id} (${role}) [${capabilities}]`, 'info');
      });
    }
  }

  private async listTools(participantId: string) {
    if (!this.client) return;

    try {
      this.addMessage('System', `Fetching tools from ${participantId}...`, 'info');
      const result = await this.client.request(participantId, 'tools/list', {});
      const tools = result.tools || [];
      
      if (tools.length === 0) {
        this.addMessage('System', `No tools from ${participantId}`, 'info');
      } else {
        this.addMessage('System', `Tools from ${participantId}:`, 'success');
        tools.forEach((tool: any) => {
          this.addMessage('System', `  - ${tool.name}: ${tool.description || 'No description'}`, 'info');
        });
      }
    } catch (err: any) {
      this.addMessage('System', `Failed to get tools: ${err.message}`, 'error');
    }
  }

  private async callTool(args: string[]) {
    if (!this.client) return;

    try {
      const [target, tool, ...jsonArgs] = args;
      const params = jsonArgs.length > 0 ? JSON.parse(jsonArgs.join(' ')) : {};
      
      this.addMessage('System', `Calling ${tool} on ${target}...`, 'info');
      
      const result = await this.client.request(target, 'tools/call', {
        name: tool,
        arguments: params,
      });
      
      this.addMessage('System', 'Tool result:', 'success');
      this.addMessage('System', JSON.stringify(result, null, 2), 'info');
    } catch (err: any) {
      this.addMessage('System', `Failed to call tool: ${err.message}`, 'error');
    }
  }

  private displayEnvelope(envelope: Envelope) {
    const timestamp = new Date().toLocaleTimeString();
    const method = envelope.payload.method || (envelope.payload.result ? 'result' : 'unknown');
    this.addMessage(envelope.from, `MCP ${method}`, 'mcp');
  }

  private addMessage(from: string, text: string, type: 'chat' | 'error' | 'success' | 'info' | 'mcp' | 'join' | 'leave') {
    const timestamp = new Date().toLocaleTimeString();
    
    // Build the formatted message without color tags
    let messageText = '';
    
    switch (type) {
      case 'chat':
        messageText = `${timestamp} [${from}] ${text}`;
        break;
      case 'error':
        messageText = `[ERROR] ${text}`;
        break;
      case 'success':
        messageText = `[SUCCESS] ${text}`;
        break;
      case 'info':
        messageText = from === 'System' ? text : `[${from}] ${text}`;
        break;
      case 'mcp':
        messageText = `${timestamp} [${from}] ${text}`;
        break;
      case 'join':
        messageText = text;
        break;
      case 'leave':
        messageText = text;
        break;
      default:
        messageText = `${timestamp} [${from}] ${text}`;
    }
    
    // For multiline content (like help), split and format each line
    const lines = messageText.split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        this.messages.log(line);
      }
    });
    
    this.screen.render();
  }

  private toggleConsole() {
    this.showConsole = !this.showConsole;
    
    if (this.showConsole) {
      // Split view: messages on left, console on right
      this.messages.width = '50%';
      this.console.show();
    } else {
      // Full width messages
      this.messages.width = '100%';
      this.console.hide();
    }
    
    this.screen.render();
  }

  private logToConsole(envelope: Envelope) {
    const timestamp = new Date().toISOString();
    const direction = envelope.to?.includes(this.participantId) ? '⬅️  IN' : '➡️  OUT';
    
    // Track requests for correlation
    if (envelope.payload.method && envelope.payload.id) {
      // This is a request
      this.pendingRequests.set(envelope.id, {
        method: envelope.payload.method,
        to: envelope.to?.[0] || 'broadcast',
        timestamp: new Date(),
      });
      
      const logLine = `${timestamp} ${direction} REQ [${envelope.from} → ${envelope.to?.[0] || 'broadcast'}] ${envelope.payload.method}`;
      this.console.log(logLine);
      
      // Show params if they exist
      if (envelope.payload.params) {
        this.console.log(`    Params: ${JSON.stringify(envelope.payload.params)}`);
      }
    } else if (envelope.payload.result !== undefined || envelope.payload.error) {
      // This is a response
      const correlationId = envelope.correlation_id;
      const pending = correlationId ? this.pendingRequests.get(correlationId) : null;
      
      if (pending) {
        const duration = Date.now() - pending.timestamp.getTime();
        const status = envelope.payload.error ? '❌ ERR' : '✅ OK';
        const logLine = `${timestamp} ${direction} RES [${envelope.from} → ${pending.to}] ${pending.method} ${status} (${duration}ms)`;
        this.console.log(logLine);
        
        if (envelope.payload.error) {
          this.console.log(`    Error: ${JSON.stringify(envelope.payload.error)}`);
        } else if (envelope.payload.result) {
          const resultStr = JSON.stringify(envelope.payload.result);
          const truncated = resultStr.length > 200 ? resultStr.substring(0, 200) + '...' : resultStr;
          this.console.log(`    Result: ${truncated}`);
        }
        
        this.pendingRequests.delete(correlationId);
      } else {
        const status = envelope.payload.error ? '❌ ERR' : '✅ RES';
        this.console.log(`${timestamp} ${direction} ${status} [${envelope.from}] (no correlation)`);
      }
    } else if (envelope.payload.method && !envelope.payload.id) {
      // This is a notification
      this.console.log(`${timestamp} ${direction} NOT [${envelope.from}] ${envelope.payload.method}`);
      
      if (envelope.payload.params) {
        this.console.log(`    Params: ${JSON.stringify(envelope.payload.params)}`);
      }
    } else {
      // Unknown message type
      this.console.log(`${timestamp} ${direction} ??? [${envelope.from}] ${envelope.kind}`);
    }
    
    // Auto-scroll if console is visible
    if (this.showConsole) {
      this.screen.render();
    }
  }

  private updateStatus() {
    const statusColor = this.isConnected ? 'green-fg' : 'red-fg';
    const statusText = this.isConnected ? 'Connected' : 'Disconnected';
    const consoleStatus = this.showConsole ? ' | Console: ON' : ' | Console: OFF';
    
    this.statusBar.setContent(
      `MCPx | ${statusText} | ${this.topic} | Peers: ${this.peers.size}${consoleStatus} | F2: Toggle Console | Ctrl+C: Exit | /help for commands`
    );
    
    this.screen.render();
  }
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('Usage: cli-blessed <gateway> <topic> <participant-id>');
    console.error('Example: cli-blessed ws://localhost:3000 test-room my-user');
    process.exit(1);
  }

  const [gateway, topic, participantId] = args;
  
  const cli = new BlessedCLI(gateway, topic, participantId);
  await cli.start();
}

main().catch(console.error);