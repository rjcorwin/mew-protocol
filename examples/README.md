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

# Terminal 5: OpenAI Agent (optional, requires API key)
npm run example:openai
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

#### Using the Calculator

**Direct tool calls (calculator agent only):**
```
/call calculator-agent add {"a": 25, "b": 17}
/call calculator-agent subtract {"a": 20, "b": 8}
/call calculator-agent multiply {"a": 7, "b": 6}
/call calculator-agent divide {"a": 100, "b": 4}
/call calculator-agent sqrt {"n": 64}
```

### 3. Coordinator Agent (Multi-Agent Orchestration)

The coordinator demonstrates how agents can work together by orchestrating calls to other agents' tools.

#### How It Works

When both coordinator and calculator are running:

1. **User sends**: `calculate 100 + 200`
2. **Coordinator responds**: `Processing "100 + 200" for user...`
3. **Coordinator calls**: calculator's add tool via MCP
4. **Calculator responds**: `📊 Calculation for coordinator: 100 + 200 = 300`

#### Supported Commands

```
calculate 50 * 3
calculate 100 + 200
calculate 75 - 25
calculate 10 / 2
sqrt 625
help
```

The coordinator recognizes these patterns:
- `calculate [number] [+|-|*|/] [number]`
- `sqrt [number]`
- Any message containing "help"

This demonstrates:
- Message routing between agents
- Tool discovery and invocation
- Coordinated task completion
- Agent-to-agent MCP communication

### 4. OpenAI Agent Tests (Optional - Requires API Key)

The OpenAI agent provides intelligent, context-aware responses using GPT models.

#### Setup
```bash
cd examples/openai-agent
cp .env.example .env
# Add your OpenAI API key to .env
```

#### Natural Conversations
```
You: What is machine learning?
OpenAI: 🤖 Machine learning is a subset of AI that enables systems to learn from data...

You: Explain it simpler
OpenAI: 🤖 It's like teaching a computer to recognize patterns by showing it examples...
```

#### Tool Orchestration
With calculator agent running:
```
You: Can you calculate 15 * 8 for me?
OpenAI: 🤖 Let me calculate that for you...
[Calls calculator agent]
OpenAI: 🤖 15 * 8 equals 120.
```

#### MCP Tools
```
/call openai-agent generate_text {"prompt": "Write a joke about debugging"}
/call openai-agent analyze_sentiment {"text": "This is fantastic!"}
/call openai-agent summarize {"text": "Long article...", "max_length": 30}
```

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
- **OpenAI messages**: Prefixed with 🤖

### Participant Roles

When you run `/list`, you'll see:
```
=== Participants ===
  echo-bot (agent) [MCP]
  calculator-agent (agent) [MCP]
  coordinator-agent (agent) [MCP]
  openai-agent (agent) [MCP]
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

> sqrt 256
[Echo #3] your-name said: "sqrt 256"
[coordinator-agent] Calculating √256 for your-name...
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