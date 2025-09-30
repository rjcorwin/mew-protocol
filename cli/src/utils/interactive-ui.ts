// @ts-nocheck
/**
 * Interactive Terminal UI
 *
 * Provides a lightweight terminal interface for sending and receiving MEW protocol messages.
 * This is a protocol debugging tool with convenience features.
 */

const readline = require('readline');
const chalk = require('chalk');
const { v4: uuidv4 } = require('uuid');

class InteractiveUI {
  constructor(ws, participantId, spaceId) {
    this.ws = ws;
    this.participantId = participantId;
    this.spaceId = spaceId;
    this.verbose = false;
    this.messageHistory = [];
    this.rl = null;

    // Environment configuration
    this.showHeartbeat = process.env.MEW_INTERACTIVE_SHOW_HEARTBEAT === 'true';
    this.showSystem = process.env.MEW_INTERACTIVE_SHOW_SYSTEM !== 'false'; // default true
    this.useColor = process.env.MEW_INTERACTIVE_COLOR !== 'false'; // default true
  }

  /**
   * Starts the interactive UI
   */
  start() {
    this.setupReadline();
    this.setupWebSocketHandlers();
    this.showWelcome();
  }

  /**
   * Sets up readline interface for terminal input
   */
  setupReadline() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.useColor ? chalk.green('> ') : '> ',
    });

    this.rl.on('line', (input) => {
      this.processInput(input.trim());
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log('\nDisconnecting...');
      if (this.ws && this.ws.readyState === 1) {
        this.ws.close();
      }
      process.exit(0);
    });

    this.rl.prompt();
  }

  /**
   * Sets up WebSocket message handlers
   */
  setupWebSocketHandlers() {
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleIncomingMessage(message);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    });

    this.ws.on('close', () => {
      console.log('\nConnection closed');
      this.rl.close();
    });

    this.ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      this.rl.close();
    });
  }

  /**
   * Shows welcome message
   */
  showWelcome() {
    const header = `MEW Interactive (space: ${this.spaceId}, participant: ${this.participantId})`;
    if (this.useColor) {
      console.log(chalk.cyan('┌─ ' + header + ' ─'.repeat(Math.max(0, 60 - header.length)) + '┐'));
      console.log(chalk.cyan('│ Type /help for available commands' + ' '.repeat(25) + '│'));
      console.log(chalk.cyan('└' + '─'.repeat(62) + '┘'));
    } else {
      console.log('┌─ ' + header + ' ─'.repeat(Math.max(0, 60 - header.length)) + '┐');
      console.log('│ Type /help for available commands' + ' '.repeat(25) + '│');
      console.log('└' + '─'.repeat(62) + '┘');
    }
    console.log();
  }

  /**
   * Processes user input with smart detection
   * @param {string} input - User input
   */
  processInput(input) {
    if (!input) return;

    // 1. Commands (start with /)
    if (input.startsWith('/')) {
      this.handleCommand(input);
      return;
    }

    // 2. Try JSON
    try {
      const json = JSON.parse(input);
      if (this.isValidEnvelope(json)) {
        // Full envelope - send as-is
        this.sendMessage(json);
      } else if (json.kind) {
        // Partial envelope - add protocol fields
        this.sendMessage(this.wrapEnvelope(json));
      } else {
        // Not an envelope - treat as chat
        this.sendChat(JSON.stringify(json));
      }
    } catch {
      // 3. Plain text - send as chat
      this.sendChat(input);
    }
  }

  /**
   * Handles slash commands
   * @param {string} command - Command string
   */
  handleCommand(command) {
    const [cmd, ...args] = command.split(' ');
    const arg = args.join(' ');

    switch (cmd) {
      case '/help':
        this.showHelp();
        break;

      case '/participants':
        this.requestParticipants();
        break;

      case '/capabilities':
        this.showCapabilities();
        break;

      case '/verbose':
        this.verbose = !this.verbose;
        console.log(`Verbose mode: ${this.verbose ? 'ON' : 'OFF'}`);
        break;

      case '/json':
        if (arg) {
          try {
            const json = JSON.parse(arg);
            this.sendMessage(this.wrapEnvelope(json));
          } catch (err) {
            console.error('Invalid JSON:', err.message);
          }
        } else {
          console.log('Usage: /json <message>');
        }
        break;

      case '/chat':
        if (arg) {
          this.sendChat(arg);
        } else {
          console.log('Usage: /chat <text>');
        }
        break;

      case '/replay':
        this.replayMessages(parseInt(args[0]) || 10);
        break;

      case '/clear':
        console.clear();
        break;

      case '/exit':
        this.rl.close();
        break;

      default:
        console.log(`Unknown command: ${cmd}. Type /help for available commands.`);
    }
  }

  /**
   * Shows help message
   */
  showHelp() {
    console.log('\nAvailable commands:');
    console.log('  /help              Show this help message');
    console.log('  /participants      List active participants');
    console.log('  /capabilities      Show your capabilities');
    console.log('  /verbose           Toggle verbose output (show full JSON)');
    console.log('  /json <msg>        Force input as JSON protocol message');
    console.log('  /chat <text>       Force input as chat message');
    console.log('  /replay [n]        Show last n messages (default: 10)');
    console.log('  /clear             Clear screen');
    console.log('  /exit              Disconnect and exit');
    console.log();
  }

  /**
   * Sends a chat message
   * @param {string} text - Chat text
   */
  sendChat(text) {
    const message = {
      kind: 'chat',
      payload: { text },
    };
    this.sendMessage(this.wrapEnvelope(message));
  }

  /**
   * Sends a message to the WebSocket
   * @param {Object} message - Message to send
   */
  sendMessage(message) {
    if (this.ws.readyState !== 1) {
      console.error('WebSocket is not connected');
      return;
    }

    this.ws.send(JSON.stringify(message));
    this.displayMessage(message, true);
    this.messageHistory.push({ message, sent: true, timestamp: new Date() });
  }

  /**
   * Handles incoming WebSocket message
   * @param {Object} message - Received message
   */
  handleIncomingMessage(message) {
    // Filter messages based on configuration
    if (!this.showHeartbeat && message.kind === 'system/heartbeat') {
      return;
    }

    if (
      !this.showSystem &&
      message.kind?.startsWith('system/') &&
      message.kind !== 'system/error'
    ) {
      return;
    }

    this.displayMessage(message, false);
    this.messageHistory.push({ message, sent: false, timestamp: new Date() });
  }

  /**
   * Displays a message in the terminal
   * @param {Object} message - Message to display
   * @param {boolean} sent - Whether this was sent by us
   */
  displayMessage(message, sent) {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const direction = sent ? '→' : '←';
    const participant = sent ? 'you' : message.from || 'system';
    const kind = message.kind || 'unknown';

    if (this.verbose) {
      // Verbose mode - show full JSON
      const header = `[${timestamp}] ${direction} ${participant} ${kind}`;
      console.log(this.useColor ? chalk.gray(header) : header);
      console.log(JSON.stringify(message, null, 2));
    } else {
      // Normal mode - show summary
      const header = `[${timestamp}] ${direction} ${participant} ${kind}`;

      // Color based on message type
      let headerColor = (text) => text;
      if (this.useColor) {
        if (kind.startsWith('system/error')) {
          headerColor = chalk.red;
        } else if (kind.startsWith('system/')) {
          headerColor = chalk.gray;
        } else if (kind.startsWith('mcp/')) {
          headerColor = chalk.yellow;
        } else if (kind === 'chat') {
          headerColor = chalk.white;
        } else {
          headerColor = chalk.cyan;
        }
      }

      console.log(headerColor(header));

      // Show payload preview
      if (message.payload) {
        const preview = this.getPayloadPreview(message.payload, kind);
        console.log(`└─ ${preview}`);
      }
    }
    console.log();
  }

  /**
   * Gets a preview string for a payload
   * @param {*} payload - Message payload
   * @param {string} kind - Message kind
   * @returns {string} - Preview string
   */
  getPayloadPreview(payload, kind) {
    if (kind === 'chat' && payload.text) {
      return `"${payload.text}"`;
    }

    if (kind === 'mcp/request' && payload.method) {
      let preview = `method: "${payload.method}"`;
      if (payload.params?.name) {
        preview += `, name: "${payload.params.name}"`;
      }
      if (payload.to) {
        preview += `, to: ${JSON.stringify(payload.to)}`;
      }
      return preview;
    }

    if (kind === 'mcp/response') {
      if (payload.result) {
        if (Array.isArray(payload.result)) {
          return `[${payload.result.length} items]`;
        }
        if (typeof payload.result === 'object') {
          const keys = Object.keys(payload.result);
          return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
        }
        return `result: ${JSON.stringify(payload.result)}`;
      }
      if (payload.error) {
        return `error: ${payload.error.message || payload.error}`;
      }
    }

    // Generic preview
    if (typeof payload === 'string') {
      return `"${payload}"`;
    }
    if (Array.isArray(payload)) {
      return `[${payload.length} items]`;
    }
    if (typeof payload === 'object') {
      const keys = Object.keys(payload);
      if (keys.length <= 3) {
        return keys.map((k) => `${k}: ${JSON.stringify(payload[k])}`).join(', ');
      }
      return `{${keys.slice(0, 2).join(', ')}... +${keys.length - 2} more}`;
    }
    return String(payload);
  }

  /**
   * Replays recent messages
   * @param {number} count - Number of messages to replay
   */
  replayMessages(count) {
    const messages = this.messageHistory.slice(-count);
    if (messages.length === 0) {
      console.log('No messages to replay');
      return;
    }

    console.log(`\n=== Replaying last ${messages.length} messages ===\n`);
    messages.forEach(({ message, sent, timestamp }) => {
      const time = timestamp.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const direction = sent ? '→' : '←';
      const participant = sent ? 'you' : message.from || 'system';
      console.log(`[${time}] ${direction} ${participant} ${message.kind}`);
      if (this.verbose) {
        console.log(JSON.stringify(message, null, 2));
      }
    });
    console.log('\n=== End replay ===\n');
  }

  /**
   * Requests participant list
   */
  requestParticipants() {
    // This would typically send a system message to get participants
    // For now, just show a message
    console.log('Requesting participant list...');
    // TODO: Implement when system/participants message is supported
  }

  /**
   * Shows current capabilities
   */
  showCapabilities() {
    // This would show capabilities from the connection
    // For now, just show a placeholder
    console.log('Your capabilities:');
    console.log('  - chat');
    console.log('  - mcp/*');
    // TODO: Get actual capabilities from connection
  }

  /**
   * Checks if an object is a valid MEW envelope
   * @param {Object} obj - Object to check
   * @returns {boolean}
   */
  isValidEnvelope(obj) {
    return obj && obj.protocol === 'mew/v0.4' && obj.id && obj.ts && obj.kind;
  }

  /**
   * Wraps a partial message into a full MEW envelope
   * @param {Object} message - Partial message
   * @returns {Object} - Full envelope
   */
  wrapEnvelope(message) {
    return {
      protocol: 'mew/v0.4',
      id: `msg-${uuidv4()}`,
      ts: new Date().toISOString(),
      from: this.participantId,
      kind: message.kind,
      payload: message.payload,
      ...message,
    };
  }
}

module.exports = InteractiveUI;
