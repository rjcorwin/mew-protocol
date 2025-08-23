# MCPx Protocol Examples

This directory contains example agents demonstrating the MCPx multi-agent coordination protocol. Follow this guide to run all the examples and test their functionality.

## Prerequisites

Before starting, ensure you have:
1. Node.js 18+ installed
2. All dependencies installed (`npm install` in the root directory)
3. Built the packages (`npm run build` in the root)

## Quick Start - Simple Version

All commands can be run from the root `mcpx-protocol` directory:

```bash
# Terminal 1: Start the gateway
npm run dev:gateway

# Terminal 2: Start all example agents at once
npm run example:all

# Terminal 3: Connect with the CLI
npm run cli:test
```

That's it! You're connected and ready to test.

## Quick Start - Step by Step

### Step 1: Start the Gateway

The gateway is the central hub that all agents connect to:

```bash
# In terminal 1 (from mcpx-protocol root)
npm run dev:gateway
```

You should see:
```
MCPx Gateway starting on http://localhost:3000
```

### Step 2: Start the Example Agents

Option A - Start all at once:
```bash
# In terminal 2 (from mcpx-protocol root)
npm run example:all
```

Option B - Start individually in separate terminals:

```bash
# Terminal 2: Echo Bot
npm run example:echo

# Terminal 3: Calculator Agent
npm run example:calculator

# Terminal 4: Coordinator Agent
npm run example:coordinator
```

### Step 3: Connect with the Blessed CLI

```bash
# In terminal 5 (from mcpx-protocol root)
npm run cli:test

# Or specify custom parameters:
npm run cli:blessed -- ws://localhost:3000 test-room your-name
```

You'll see a full-screen terminal UI with:
- Messages area (top)
- Status bar (middle)
- Input area (bottom)

## Testing Agent Functionality

Once connected, test each agent's capabilities:

### 1. Echo Bot Test

The echo bot repeats every message with a counter:

```
Hello agents!
```

Expected response:
```
[Echo #1] your-name said: "Hello agents!"
```

### 2. Calculator Agent Tests

#### Direct Tool Calls

List available tools:
```
/tools calculator-agent
```

Expected output:
```
Tools from calculator-agent:
  - add: Add two numbers
  - subtract: Subtract two numbers
  - multiply: Multiply two numbers
  - divide: Divide two numbers
  - sqrt: Calculate square root
```

Test each operation:
```
/call calculator-agent add {"a": 10, "b": 5}
/call calculator-agent subtract {"a": 20, "b": 8}
/call calculator-agent multiply {"a": 7, "b": 6}
/call calculator-agent divide {"a": 100, "b": 4}
/call calculator-agent sqrt {"a": 144}
```

Expected results:
- add: 15
- subtract: 12
- multiply: 42
- divide: 25
- sqrt: 12

#### Natural Language Calculations

The calculator also responds to natural language:
```
calculate 25 + 17
what is 100 divided by 4?
compute sqrt(64)
```

### 3. Coordinator Agent Tests

The coordinator orchestrates other agents to complete tasks:

#### Basic Coordination
```
calculate 50 * 3
```

Expected: The coordinator will use the calculator agent to compute the result.

#### Complex Expressions
```
calculate (10 + 5) * 3
what is the square root of 625?
```

### 4. Multi-Agent Interaction

Test how agents work together:

```
Hey coordinator, can you ask the calculator to add 100 and 200?
```

The coordinator should:
1. Recognize the request
2. Call the calculator's add tool
3. Return the result

## Available Commands

In the blessed CLI, use these commands:

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/list` | List all connected participants |
| `/tools <agent-id>` | List tools from an agent |
| `/call <agent-id> <tool> <json-args>` | Call a specific tool |
| `/clear` | Clear the message log |
| `/quit` or `/exit` | Exit the CLI |

## Understanding the Output

### Message Types

- **Chat messages**: Regular text from participants
- **System messages**: Connection/disconnection notices
- **MCP messages**: Tool calls and responses
- **Echo messages**: Prefixed with `[Echo #N]`
- **Calculator messages**: Prefixed with 📊
- **Coordinator messages**: Prefixed with 📋

### Participant Roles

When you run `/list`, you'll see:
```
=== Participants ===
  echo-bot (agent) [MCP]
  calculator-agent (agent) [MCP]
  coordinator-agent (agent) [MCP]
  your-name (user) [none]
```

- `(agent)` - Automated agent with MCP capabilities
- `(user)` - Human participant
- `[MCP]` - Has MCP tool capabilities
- `[none]` - No special capabilities

## Troubleshooting

### Agent won't connect
- Check the gateway is running on port 3000
- Verify no firewall blocking localhost connections
- Check for duplicate agent IDs (each must be unique)

### Calculator not responding
- Ensure calculator-agent shows "online" status
- Try `/list` to verify it's connected
- Check calculator terminal for error messages

### Coordinator not orchestrating
- Verify both coordinator and calculator are connected
- Check that messages contain calculation keywords
- Look for "Processing" messages from coordinator

### Display issues in CLI
- If using the readline CLI and output doesn't appear, resize the terminal window
- Use the blessed CLI (`cli:blessed`) for better display handling
- For automated testing, use the FIFO bridge (see `cli-fifo-bridge.js`)

## Architecture Overview

```
┌─────────────┐     WebSocket      ┌─────────────┐
│   Gateway   │◄──────────────────►│  Echo Bot   │
│  Port 3000  │                    └─────────────┘
└──────┬──────┘
       │         ◄──────────────────►┌─────────────┐
       │                             │ Calculator  │
       │                             └─────────────┘
       │         ◄──────────────────►┌─────────────┐
       │                             │ Coordinator │
       │                             └─────────────┘
       │         ◄──────────────────►┌─────────────┐
       └────────────────────────────►│  CLI User   │
                                     └─────────────┘
```

## Next Steps

After testing the examples:

1. **Modify an agent**: Try changing the echo bot's message format
2. **Create your own agent**: Copy an example and add new functionality
3. **Build complex interactions**: Have agents collaborate on tasks
4. **Explore the protocol**: Read the MCPx specification in `../protocol-spec/`

## Example Session

Here's a complete example session:

```
Connected to test-room

> Hello everyone!
[Echo #1] your-name said: "Hello everyone!"

> /list
=== Participants ===
  echo-bot (agent) [MCP]
  calculator-agent (agent) [MCP]
  coordinator-agent (agent) [MCP]

> /tools calculator-agent
Tools from calculator-agent:
  - add: Add two numbers
  - subtract: Subtract two numbers
  - multiply: Multiply two numbers
  - divide: Divide two numbers
  - sqrt: Calculate square root

> /call calculator-agent multiply {"a": 7, "b": 9}
Tool result: {
  "content": [
    {
      "type": "text",
      "text": "7 × 9 = 63"
    }
  ]
}

> calculate 100 + 50
[Echo #2] your-name said: "calculate 100 + 50"
[coordinator-agent] Processing "100 + 50" for your-name...
[calculator-agent] 📊 Calculation for coordinator-agent: 100 + 50 = 150

> what is the square root of 256?
[Echo #3] your-name said: "what is the square root of 256?"
[coordinator-agent] Processing "square root of 256" for your-name...
[calculator-agent] 📊 Calculation for coordinator-agent: √256 = 16
```

## Available NPM Scripts

All these commands run from the root `mcpx-protocol` directory:

| Command | Description |
|---------|-------------|
| `npm run dev:gateway` | Start the MCPx gateway server |
| `npm run example:echo` | Start the echo bot example |
| `npm run example:calculator` | Start the calculator agent |
| `npm run example:coordinator` | Start the coordinator agent |
| `npm run example:all` | Start all example agents |
| `npm run cli` | Start the readline CLI |
| `npm run cli:blessed` | Start the blessed TUI CLI |
| `npm run cli:test` | Quick connect to test-room as test-user |

## Contributing

To add a new example agent:

1. Create a new directory in `examples/`
2. Copy the structure from an existing agent
3. Implement your agent's functionality
4. Add a script to the root `package.json`:
   ```json
   "example:your-agent": "cd examples/your-agent && npm start"
   ```
5. Update this README with testing instructions
6. Submit a pull request

For more information, see the [MCPx Protocol Specification](../protocol-spec/v0/SPEC.md).