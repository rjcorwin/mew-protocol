#!/usr/bin/env node
import blessed from 'blessed';
import { MCPxClient } from '@mcpx-protocol/client';
import { SystemWelcomePayload, ChatPayload, Peer, Envelope } from '@mcpx-protocol/client';

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
  private debugMode = false;
  private pendingRequests: Map<string, { method: string; to: string; timestamp: Date }> = new Map();
  private consoleMessages: Array<{ timestamp: string; summary: string; fullEnvelope: any }> = [];

  constructor(gateway: string, topic: string, participantId: string) {
    this.gateway = gateway;
    this.topic = topic;
    this.participantId = participantId;

    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'MCPx Chat Client',
      fullUnicode: false, // Disable unicode to avoid character issues
      forceUnicode: false,
      dockBorders: true,
      ignoreDockContrast: true
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
      label: ' Protocol Console (F2 toggle, /d [n] for detail) ',
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true,
      hidden: true, // Start hidden
      style: {
        border: {
          fg: 'green',
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
      content: `MCPx | Disconnected | ${topic} | Peers: 0 | F2: Console | F3: Detail | /help: Commands | Ctrl+C: Exit`,
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
      keys: true,
      mouse: true,
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

    // Simple F3 shortcut to show last message detail
    this.screen.key(['f3'], () => {
      if (this.consoleMessages.length > 0) {
        this.showDetailInMessages(this.consoleMessages.length - 1);
      }
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
      this.addMessage('System', 'Got authentication token', 'success');
    } catch (error: any) {
      this.addMessage('System', `Failed to get token: ${error.message}`, 'error');
      throw error;
    }
  }

  private setupClientHandlers() {
    if (!this.client) return;

    this.client.onWelcome((data: SystemWelcomePayload) => {
      this.isConnected = true;
      this.updateStatus();
      
      this.addMessage('System', `Welcome!`, 'success');
      this.addMessage('System', `Your ID: ${data.you.id}`, 'info');
      this.addMessage('System', `Your capabilities: ${data.you.capabilities.join(', ')}`, 'info');
      
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

    this.client.onChat((message: ChatPayload, from: string) => {
      const text = message.text || '';
      // Always show chat messages in the main view
      // Now that the gateway broadcasts all messages to all participants,
      // we receive our own messages back, which provides confirmation they were sent
      const displayFrom = from === this.participantId ? 'You' : from;
      this.addMessage(displayFrom, text, 'chat');
    });

    this.client.onPeerJoined((peer: Peer) => {
      this.peers.set(peer.id, peer);
      this.addMessage('System', `→ ${peer.id} joined (${peer.capabilities.join(', ')})`, 'join');
      this.updateStatus();
    });

    this.client.onPeerLeft((peer: Peer) => {
      this.peers.delete(peer.id);
      this.addMessage('System', `← ${peer.id} left`, 'leave');
      this.updateStatus();
    });

    this.client.onMessage((envelope: Envelope) => {
      // Log all protocol messages to console
      this.logToConsole(envelope);
      
      // In debug mode, show ALL envelopes in main view
      if (this.debugMode) {
        // Add header with visual separator
        this.addMessage('System', '', 'info');
        this.addMessage('System', `=== DEBUG: ${envelope.kind} envelope from ${envelope.from}${envelope.to ? ` to ${envelope.to.join(',')}` : ' (broadcast)'}${envelope.correlation_id ? ` [corr: ${envelope.correlation_id}]` : ''} ===`, 'info');
        
        // Format the JSON with proper indentation
        const formatted = this.formatJsonForDisplay(envelope);
        
        // Add the formatted JSON with tree-like hierarchy markers
        const lines = formatted.split('\n');
        lines.forEach((line) => {
          // Count leading spaces to determine indent level
          const indent = line.match(/^(\s*)/)?.[1] || '';
          const indentLevel = Math.floor(indent.length / 2);
          
          // Create tree-like prefix
          let prefix = '';
          if (indentLevel > 0) {
            // Build the tree structure
            for (let i = 0; i < indentLevel - 1; i++) {
              prefix += '| ';
            }
            prefix += '|-';
          }
          
          const content = line.trim();
          if (content) {
            this.addMessage('System', prefix + content, 'info');
          }
        });
        
        // Add footer
        this.addMessage('System', '------', 'info');
      }
      
      // Display non-chat messages in main view when not in debug mode
      // (Chat messages are handled by onChat handler)
      if (!this.debugMode && envelope.kind !== 'chat') {
        // For MCP and system messages, show a formatted view
        if (envelope.kind.startsWith('mcp/') || envelope.kind === 'mcp' || envelope.kind.startsWith('system/')) {
          this.displayEnvelope(envelope);
        }
      }
    });

    this.client.onError((error: Error) => {
      this.addMessage('System', `Error: ${error.message}`, 'error');
    });

    this.client.onDisconnected(() => {
      this.isConnected = false;
      this.addMessage('System', 'Disconnected', 'error');
      this.updateStatus();
    });

    this.client.onReconnected(() => {
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
      // Only show immediate feedback if not in debug mode
      // (debug mode will show the full envelope)
      if (!this.debugMode) {
        this.addMessage('You', value, 'chat');
      }
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
      
      case 'debug':
        this.debugMode = !this.debugMode;
        this.addMessage('System', `Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`, 'info');
        if (this.debugMode) {
          this.addMessage('System', 'You will now see raw protocol envelopes in the main view', 'info');
        }
        break;

      case 'detail':
      case 'd':
        if (this.consoleMessages.length === 0) {
          this.addMessage('System', 'No protocol messages captured yet', 'info');
        } else if (args.length > 0 && !isNaN(parseInt(args[0]))) {
          // Show specific message number
          const msgNum = parseInt(args[0]) - 1; // Convert to 0-based index
          if (msgNum >= 0 && msgNum < this.consoleMessages.length) {
            this.showDetailInMessages(msgNum);
          } else {
            this.addMessage('System', `Message number out of range. Valid: 1-${this.consoleMessages.length}`, 'error');
          }
        } else {
          // Show last message
          this.showDetailInMessages(this.consoleMessages.length - 1);
        }
        break;

      case 'messages':
      case 'm':
        if (this.consoleMessages.length === 0) {
          this.addMessage('System', 'No protocol messages captured yet', 'info');
        } else {
          this.addMessage('System', `\n=== Protocol Messages (${this.consoleMessages.length} total) ===`, 'info');
          this.consoleMessages.forEach((msg, i) => {
            this.addMessage('System', `  ${i + 1}. ${msg.summary}`, 'info');
          });
          this.addMessage('System', 'Use /d <number> to view full details', 'info');
        }
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
  /debug             - Toggle debug mode (show raw envelopes)
  /console           - Toggle protocol console
  /detail or /d [n]  - Show detail view (last msg or msg #n)
  /quit              - Exit

Key Bindings:
  F2                 - Toggle protocol console
  F3 (or fn+F3)      - Show last message detail
  Ctrl+C             - Exit

Console Features:
  - View all protocol messages in real-time
  - Use /d to see full JSON of any message
  - Use /d <n> to see message number n
  - Use /m to list all captured messages
  - Truncated data shows "..." (use /d to see full content)

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
    const payload = envelope.payload;
    
    // Format based on the envelope kind (v0.1 hierarchical kinds)
    let description = '';
    
    // Handle v0.1 hierarchical kinds
    if (envelope.kind.startsWith('mcp/request:')) {
      const method = envelope.kind.substring('mcp/request:'.length);
      description = `→ ${method}`;
    } else if (envelope.kind.startsWith('mcp/response:')) {
      const method = envelope.kind.substring('mcp/response:'.length);
      if (payload.error) {
        description = `← ${method} error: ${payload.error.message}`;
      } else {
        description = `← ${method} response`;
      }
    } else if (envelope.kind.startsWith('mcp/proposal:')) {
      const method = envelope.kind.substring('mcp/proposal:'.length);
      description = `? ${method} proposal`;
    } else if (envelope.kind.startsWith('system/')) {
      const event = envelope.kind.substring('system/'.length);
      description = `[${event}]`;
    } else if (envelope.kind === 'mcp') {
      // Legacy v0 format
      if (payload.method) {
        description = payload.method.replace('notifications/', '').replace('tools/', '');
      } else if (payload.result) {
        description = 'response';
      } else if (payload.error) {
        description = `error: ${payload.error.message}`;
      }
    } else {
      description = envelope.kind;
    }
    
    // Add recipient info if targeted
    if (envelope.to && envelope.to.length > 0) {
      description += ` → ${envelope.to.join(',')}`;
    }
    
    this.addMessage(envelope.from, description, 'mcp');
  }

  private addMessage(from: string, text: string, type: 'chat' | 'error' | 'success' | 'info' | 'mcp' | 'join' | 'leave' | 'debug') {
    const timestamp = new Date().toLocaleTimeString();
    
    // Strip any control characters from the text
    const cleanText = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
    const cleanFrom = from.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
    
    // Build the formatted message with better visual separation
    let messageText = '';
    let prefix = '';
    
    switch (type) {
      case 'chat':
        // Add visual separator and clear formatting for chat messages
        prefix = cleanFrom === 'You' ? '> ' : '< ';
        messageText = `\n${timestamp} ${prefix}[${cleanFrom}]\n   ${cleanText}`;
        break;
      case 'error':
        messageText = `\n[X] ERROR: ${cleanText}`;
        break;
      case 'success':
        messageText = `\n[+] ${cleanText}`;
        break;
      case 'info':
        if (cleanFrom === 'System' && cleanText.startsWith('===')) {
          // Section headers
          messageText = `\n${cleanText}`;
        } else if (cleanFrom === 'System') {
          messageText = `   ${cleanText}`;
        } else {
          messageText = `\n[${cleanFrom}] ${cleanText}`;
        }
        break;
      case 'mcp':
        // MCP messages - more compact
        messageText = `\n${timestamp} [M] [${cleanFrom}]: ${cleanText}`;
        break;
      case 'join':
        messageText = `\n--> ${cleanText}`;
        break;
      case 'leave':
        messageText = `\n<-- ${cleanText}`;
        break;
      case 'debug':
        // Debug messages - show in gray/subdued
        messageText = `\n${timestamp} [DEBUG] ${cleanText}`;
        break;
      default:
        messageText = `\n${timestamp} [${cleanFrom}] ${cleanText}`;
    }
    
    // For multiline content, preserve formatting but indent continuation lines
    const lines = messageText.split('\n');
    lines.forEach((line, index) => {
      if (line.trim() || index === 0) {  // Always show first line even if empty (for spacing)
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
    // Shorter timestamp format (HH:MM:SS)
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    const direction = envelope.to?.includes(this.participantId) ? 'IN ' : 'OUT';
    
    // Store the full envelope for detail view
    let summary = '';
    
    // We'll add the message number after we store it
    const msgNum = this.consoleMessages.length + 1;
    
    // Track requests for correlation
    if (envelope.payload.method && envelope.payload.id) {
      // This is a request
      this.pendingRequests.set(envelope.id, {
        method: envelope.payload.method,
        to: envelope.to?.[0] || 'broadcast',
        timestamp: new Date(),
      });
      
      const method = envelope.payload.method.replace('notifications/', '').replace('tools/', '');
      const target = envelope.to?.[0] || 'broadcast';
      summary = `${timestamp} ${direction} REQ [${envelope.from} → ${target}] ${method}`;
      const logLine = `[${String(msgNum).padStart(3, ' ')}] ${summary}`;
      this.console.log(logLine);
      
      // Show params more compactly with indentation
      if (envelope.payload.params) {
        const paramsStr = JSON.stringify(envelope.payload.params);
        if (paramsStr.length > 65) {
          // For long params, truncate
          this.console.log(`       ${paramsStr.substring(0, 65)}...`);
        } else {
          this.console.log(`       ${paramsStr}`);
        }
      }
    } else if (envelope.payload.result !== undefined || envelope.payload.error) {
      // This is a response
      const correlationId = envelope.correlation_id;
      const pending = correlationId ? this.pendingRequests.get(correlationId) : null;
      
      if (pending) {
        const duration = Date.now() - pending.timestamp.getTime();
        const status = envelope.payload.error ? 'ERR' : 'OK ';
        const method = pending.method.replace('notifications/', '').replace('tools/', '');
        summary = `${timestamp} ${direction} RES [${status}] ${method} (${duration}ms)`;
        const logLine = `[${String(msgNum).padStart(3, ' ')}] ${summary}`;
        this.console.log(logLine);
        
        if (envelope.payload.error) {
          const errorStr = JSON.stringify(envelope.payload.error);
          this.console.log(`       Error: ${errorStr.substring(0, 60)}`);
        } else if (envelope.payload.result && JSON.stringify(envelope.payload.result) !== '{}') {
          const resultStr = JSON.stringify(envelope.payload.result);
          if (resultStr.length > 65) {
            this.console.log(`       ${resultStr.substring(0, 65)}...`);
          } else {
            this.console.log(`       ${resultStr}`);
          }
        }
        
        this.pendingRequests.delete(correlationId);
      } else {
        const status = envelope.payload.error ? 'ERR' : 'RES';
        summary = `${timestamp} ${direction} ${status} [${envelope.from}] (no correlation)`;
        const logLine = `[${String(msgNum).padStart(3, ' ')}] ${summary}`;
        this.console.log(logLine);
      }
    } else if (envelope.payload.method && !envelope.payload.id) {
      // This is a notification
      const method = envelope.payload.method.replace('notifications/', '').replace('tools/', '');
      summary = `${timestamp} ${direction} NOT [${envelope.from}] ${method}`;
      const logLine = `[${String(msgNum).padStart(3, ' ')}] ${summary}`;
      this.console.log(logLine);
      
      if (envelope.payload.params && envelope.payload.params.text) {
        // For chat messages, show text preview
        const text = envelope.payload.params.text;
        const preview = text.length > 45 ? text.substring(0, 45) + '...' : text;
        this.console.log(`       Text: "${preview}"`);
      } else if (envelope.payload.params) {
        const paramsStr = JSON.stringify(envelope.payload.params);
        if (paramsStr.length > 65) {
          this.console.log(`       ${paramsStr.substring(0, 65)}...`);
        } else if (paramsStr !== '{}') {
          this.console.log(`       ${paramsStr}`);
        }
      }
    } else if (envelope.kind === 'presence' || envelope.kind === 'system') {
      // System messages
      summary = `${timestamp} ${direction} ??? [${envelope.from}] ${envelope.kind}`;
      const logLine = `[${String(msgNum).padStart(3, ' ')}] ${summary}`;
      this.console.log(logLine);
    }
    
    // Store the message for detail view
    if (summary) {
      this.consoleMessages.push({
        timestamp,
        summary,
        fullEnvelope: envelope
      });
      
      // Keep only last 100 messages to avoid memory issues
      if (this.consoleMessages.length > 100) {
        this.consoleMessages.shift();
      }
    }
    
    // Add a subtle separator line
    this.console.log('');
    
    // Auto-scroll if console is visible
    if (this.showConsole) {
      this.screen.render();
    }
  }

  private showDetailInMessages(index: number) {
    if (index < 0 || index >= this.consoleMessages.length) return;
    
    // Clear messages first to avoid overflow
    this.messages.setContent('');
    
    const message = this.consoleMessages[index];
    let envelope = message.fullEnvelope;
    
    // Check if this is a system message with nested data
    if (envelope.kind === 'system' && envelope.payload) {
      // System messages might contain complex payloads
      // Check if payload has messages array
      if (Array.isArray(envelope.payload)) {
        // The payload itself is an array of messages - this is the history!
        this.addMessage('System', 'Note: This system message contains message history', 'info');
        // Show just the envelope metadata, not the full history
        envelope = {
          ...envelope,
          payload: `[Array of ${envelope.payload.length} messages - use /m to list]`
        };
      } else if (envelope.payload.messages) {
        // Payload has a messages field
        envelope = {
          ...envelope,
          payload: {
            ...envelope.payload,
            messages: `[${envelope.payload.messages.length} messages - use /m to list]`
          }
        };
      } else if (envelope.payload.history) {
        // Welcome message with history field!
        const historyLength = Array.isArray(envelope.payload.history) ? envelope.payload.history.length : 0;
        envelope = {
          ...envelope,
          payload: {
            ...envelope.payload,
            history: `[${historyLength} historical messages omitted]`
          }
        };
      }
    }
    
    // Format the JSON with proper indentation and cleaner output
    const formatted = this.formatJsonForDisplay(envelope);
    
    // Show detail with better formatting
    this.addMessage('System', '', 'info');
    this.addMessage('System', '=' + '='.repeat(78) + '=', 'info');
    this.addMessage('System', `  MESSAGE DETAIL (${index + 1} of ${this.consoleMessages.length})`, 'info');
    this.addMessage('System', '=' + '='.repeat(78) + '=', 'info');
    this.addMessage('System', '', 'info');
    this.addMessage('System', `  Summary: ${message.summary}`, 'info');
    this.addMessage('System', '', 'info');
    this.addMessage('System', '-' + '-'.repeat(78) + '-', 'info');
    this.addMessage('System', '  Full Envelope:', 'info');
    this.addMessage('System', '', 'info');
    
    // Add the formatted JSON with tree-like hierarchy markers
    const lines = formatted.split('\n');
    lines.forEach((line, index) => {
      // Count leading spaces to determine indent level
      const indent = line.match(/^(\s*)/)?.[1] || '';
      const indentLevel = Math.floor(indent.length / 2);
      
      // Create tree-like prefix
      let prefix = '';
      if (indentLevel > 0) {
        // Build the tree structure
        for (let i = 0; i < indentLevel - 1; i++) {
          prefix += '| ';
        }
        prefix += '|-';
      }
      
      const content = line.trim();
      if (content) {
        this.addMessage('System', prefix + content, 'info');
      }
    });
    
    this.addMessage('System', '', 'info');
    this.addMessage('System', '-' + '-'.repeat(78) + '-', 'info');
    this.addMessage('System', '  Commands: /d <n> for message n, /m to list all messages', 'info');
    this.addMessage('System', '=' + '='.repeat(78) + '=', 'info');
    this.addMessage('System', '', 'info');
    
    // Scroll to top to show the beginning of the detail
    this.messages.setScrollPerc(0);
    this.screen.render();
  }

  private formatJsonForDisplay(obj: any): string {
    // Pretty print with proper indentation preserved
    const cleanObj = this.removeEmptyFields(obj);
    return JSON.stringify(cleanObj, null, 2);
  }
  
  private removeEmptyFields(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    
    if (Array.isArray(obj)) {
      const filtered = obj.map(item => this.removeEmptyFields(item)).filter(item => item !== undefined);
      return filtered.length > 0 ? filtered : undefined;
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanValue = this.removeEmptyFields(value);
        if (cleanValue !== undefined && cleanValue !== '' && 
            !(Array.isArray(cleanValue) && cleanValue.length === 0) &&
            !(typeof cleanValue === 'object' && Object.keys(cleanValue).length === 0)) {
          cleaned[key] = cleanValue;
        }
      }
      return Object.keys(cleaned).length > 0 ? cleaned : undefined;
    }
    
    return obj;
  }

  private updateStatus() {
    const statusColor = this.isConnected ? 'green-fg' : 'red-fg';
    const statusText = this.isConnected ? 'Connected' : 'Disconnected';
    const consoleStatus = this.showConsole ? '[Console ON]' : '';
    
    this.statusBar.setContent(
      `MCPx | ${statusText} | ${this.topic} | Peers: ${this.peers.size} ${consoleStatus} | F2: Console | F3: Detail | /help: Commands | Ctrl+C: Exit`
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