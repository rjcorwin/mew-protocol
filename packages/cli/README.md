# @mcpx-protocol/cli

Interactive CLI chat client for the MCPx protocol with two interfaces: a rich TUI for humans and a FIFO-based interface for AI coding agents.

## Installation

```bash
npm install -g @mcpx-protocol/cli
```

## Two Interfaces

### 1. Blessed CLI (For Humans)

A full-screen terminal UI with enhanced user experience:

```bash
mcpx-chat  # or npm run cli
```

Features:
- Full-screen TUI with input area and scrollable message history
- Color-coded messages by participant
- Real-time status indicators
- `/debug` command with formatted protocol inspection
- Auto-reconnection on connection loss
- Save/load connection configurations

### 2. Simple CLI (For AI Coding Agents)

A line-based readline interface that works with automation:

```bash
mcpx-chat-simple  # or npm run cli:simple
```

Features:
- Simple line-based I/O (works with pipes and automation)
- Compatible with FIFO bridge for AI agent integration
- `/debug` command for protocol inspection
- All core functionality without TUI overhead

## Commands

Both interfaces support these commands:

- `/help` - Show available commands
- `/connect [url] [topic] [participant-id]` - Connect to MCPx gateway
- `/disconnect` - Disconnect from current topic
- `/list` - List all participants in the topic
- `/tools <peer>` - List MCP tools available from a peer
- `/call <peer> <tool> <args>` - Call a peer's MCP tool with JSON arguments
- `/history` - Show recent message history
- `/status` - Show connection status
- `/debug` - Toggle debug mode to see raw protocol envelopes
- `/save <name>` - Save current connection config
- `/load <name>` - Load a saved connection
- `/quit` or `/exit` - Exit the client

## Usage Examples

### Interactive Human Usage

```bash
$ mcpx-chat
=== MCPx Chat Client ===
Type /help for commands

mcpx> /connect ws://localhost:3000 dev-room alice
✓ Connected to dev-room as alice

mcpx> Hello everyone!
[10:23:45] [alice] Hello everyone!

mcpx> /list
=== Participants (2) ===
  alice (human) 
  calculator-agent (agent) [MCP]

mcpx> /tools calculator-agent
✓ Tools from calculator-agent:
  - add: Add two numbers
  - multiply: Multiply two numbers

mcpx> /call calculator-agent add {"a": 5, "b": 3}
✓ Result: {"result": 8}
```

### AI Agent Usage (FIFO Bridge)

For AI coding agents that need to interact with the CLI programmatically:

```bash
# Terminal 1: Start the gateway (if not already running)
npm run dev:gateway

# Terminal 2: Start the FIFO bridge
cd packages/cli
node cli-fifo-bridge.js

# Terminal 3: Send commands via FIFO
./fifo-send.sh "/connect ws://localhost:3000 test-room agent1"
./fifo-send.sh "Hello from automated agent"
./fifo-send.sh "/tools calculator-agent"
./fifo-send.sh "/call calculator-agent add {\"a\": 10, \"b\": 20}"
```

The FIFO bridge:
- Creates named pipes at `.cli-fifos/input.fifo`
- Logs all output to `.cli-fifos/output.log`
- Maintains state in `.cli-fifos/state.txt`
- Auto-generates `fifo-send.sh` helper script with correct paths

## Development

### Running from Source

```bash
# Blessed CLI (for humans)
npm run cli

# Simple CLI (for automation)
npm run cli:simple

# Build the package
npm run build

# Run tests
npm test
```

### Programmatic Testing

The `test-cli.js` script provides programmatic testing of the MCPx client:

```bash
node test-cli.js  # Gateway must be running
```

## Configuration

Saved connections are stored in `~/.mcpx/connections.json`

## Files

- `src/cli-blessed.ts` - Blessed TUI interface (for humans)
- `src/cli.ts` - Simple readline interface (for automation)
- `cli-fifo-bridge.js` - FIFO bridge for AI agent integration
- `fifo-send.sh` - Helper script for sending commands via FIFO
- `test-cli.js` - Programmatic testing script

## License

MIT