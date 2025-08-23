# Quick Test Guide for MCPx Protocol

This guide helps you quickly test the MCPx multi-agent system with interactive examples.

## Prerequisites

Make sure you have the gateway running:
```bash
npm run dev:gateway
```

## Starting the Agents

Start each agent in a separate terminal:

### 1. Calculator Agent
Provides mathematical calculation tools (add, subtract, multiply, divide, sqrt, power).
```bash
cd examples/calculator-agent
npm start
```

### 2. Coordinator Agent
Orchestrates other agents by discovering and calling their tools.
```bash
cd examples/coordinator-agent
npm start
```

### 3. Echo Bot (Optional)
Simple agent that echoes messages with a counter.
```bash
cd examples/echo-bot
npm start
```

## Using the Interactive CLI

### Option 1: Blessed TUI (Better Terminal Handling)
The blessed-based CLI provides reliable terminal updates and a better interactive experience:

```bash
cd packages/cli
npm run cli:blessed ws://localhost:3000 test-room your-username
```

This will open a full-screen terminal UI with:
- Message log area with scrolling
- Status bar showing connection state
- Input area at the bottom
- Proper terminal refresh (no display issues)

### Option 2: Readline CLI  
The original readline-based CLI:
```bash
cd packages/cli
npm run cli
```

In the CLI, connect to the test room:
```
/connect ws://localhost:3000 test-room your-username
```

Note: Some terminals may have display refresh issues with the readline version where output doesn't appear until window resize. Use the blessed version for more reliable display.

## Test Commands

Once connected, try these commands:

### Basic Commands
```bash
# List all participants
/list

# Send a chat message
Hello everyone!

# Get help
/help
```

### Working with Tools
```bash
# List tools from calculator agent
/tools calculator-agent

# Call calculator tools directly
/call calculator-agent add {"a": 10, "b": 5}
/call calculator-agent multiply {"a": 7, "b": 8}
/call calculator-agent sqrt {"n": 25}
/call calculator-agent divide {"a": 100, "b": 4}

# Test error handling
/call calculator-agent divide {"a": 10, "b": 0}
```

### Testing Agent Coordination
The coordinator agent responds to natural language calculation requests:

```bash
# Basic calculations
calculate 15 + 20
calculate 100 - 45
calculate 7 * 9
calculate 144 / 12

# Square roots
sqrt 64
sqrt 100
```

## Expected Behavior

1. **Echo Bot**: Echoes every message with a counter (e.g., "[Echo #1] user said: 'Hello'")

2. **Calculator Agent**: 
   - Responds to tool calls with calculations
   - Shows results in chat (e.g., "📊 Calculation for user: 5 + 3 = 8")
   - Handles errors gracefully (division by zero, negative square roots)

3. **Coordinator Agent**:
   - Automatically discovers calculator agent on startup
   - Runs demo calculations after 3 seconds
   - Processes "calculate" and "sqrt" commands from chat
   - Shows processing messages before results

## Non-Interactive Testing (Using FIFOs)

If you prefer to test without an interactive terminal:

### 1. Start the FIFO Bridge
```bash
cd packages/cli
node cli-fifo-bridge.js
```

### 2. Send Commands
```bash
# Connect first
./fifo-send.sh "/connect ws://localhost:3000 test-room test-user"

# Send commands
./fifo-send.sh "/list"
./fifo-send.sh "/tools calculator-agent"
./fifo-send.sh "/call calculator-agent add {\"a\": 10, \"b\": 5}"
./fifo-send.sh "calculate 50 + 30"
```

### 3. View Output
```bash
# Watch real-time output
tail -f .cli-fifos/output.log

# Check recent messages
tail -50 .cli-fifos/output.log
```

## Troubleshooting

### Agent Not Responding
- Check if the agent process is running: `ps aux | grep agent-name`
- Kill stale processes if needed: `pkill -f agent-name`
- Restart the agent

### Connection Issues
- Ensure gateway is running on port 3000
- Check WebSocket URL is correct (ws://localhost:3000)
- Verify no firewall blocking local connections

### Tool Calls Timing Out
- This was a known bug that's been fixed in the latest version
- Make sure you've rebuilt packages: `npm run build`
- Check agent logs for error messages

## Architecture Notes

- All agents act as both MCP servers (exposing tools) and clients (calling tools)
- The gateway (MCPx server) handles message routing between agents
- Agents use correlation IDs to match request/response pairs
- Each agent must complete MCP handshake before tool calls work