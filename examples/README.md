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

# Terminal 5: Documents Agent (filesystem bridge)
npm run example:documents

# Terminal 6: OpenAI Agent (optional, requires API key)
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

### 4. Documents Agent Tests (Filesystem Bridge)

The documents agent exposes a filesystem folder through the MCP filesystem server, allowing all participants to access shared documents.

#### List Available Tools

```
/tools documents-agent
```

Expected tools include:
- `read_file` - Read file contents
- `write_file` - Write to a file
- `list_directory` - List folder contents
- `search_files` - Search for files

#### Read Sample Documents

```
/call documents-agent read_file {"path": "the-answer.txt"}
```
Expected: "42"

```
/call documents-agent read_file {"path": "example-data.json"}
```
Expected: JSON data with sample records

#### List Directory

```
/call documents-agent list_directory {"path": "."}
```

Shows all files in the documents folder.

#### Create New Files

```
/call documents-agent write_file {"path": "test.txt", "content": "Hello from MCPx!"}
```

#### Search Files

```
/call documents-agent search_files {"query": "answer", "path": "."}
```

This demonstrates:
- Bridging existing MCP servers to MCPx
- File system access for all participants
- Shared document workspace
- Integration with standard MCP tools

### 5. OpenAI Agent Tests (Optional - Requires API Key)

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

#### Cross-Agent File Access
With documents-agent running, the OpenAI agent can access shared files:
```
You: Hey OpenAI agent, can you read the file 'the-answer.txt' from the documents-agent?
OpenAI: 🤖 The allowed directory is:
- `/users/rj/git/rjcorwin/mcpx-monorepo/mcpx-protocol/examples/documents-agent/documents`

You: Perfect! Now please read the file at /users/rj/git/rjcorwin/mcpx-monorepo/mcpx-protocol/examples/documents-agent/documents/the-answer.txt
OpenAI: 🤖 The content of the file 'the-answer.txt' is: `42`. Let me know if there's anything else you need!

You: Can you also list all the files in that documents directory?
OpenAI: 🤖 Here are the files in the documents directory:
- `example-data.json`
- `readme.md`
- `test-write.txt`
- `the-answer.txt`

You: Could you read the example-data.json file and tell me what it contains?
OpenAI: 🤖 The `example-data.json` file contains the following data:
[Shows formatted JSON with sample dataset]
```

This demonstrates the OpenAI agent discovering and using the documents-agent's filesystem tools to access shared documents.

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
  documents-agent (agent) [MCP]
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
└─────────────┘
                                   ┌─────────────┐
               ◄──────────────────►│ Calculator  │
                                   └─────────────┘
                                   ┌─────────────┐
               ◄──────────────────►│ Coordinator │
                                   └─────────────┘
                                   ┌─────────────┐
               ◄──────────────────►│  CLI User   │
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

## Bridging Existing MCP Servers

The MCPx Bridge allows you to connect any existing MCP server to an MCPx topic, making its tools available to all participants. This is the easiest way to integrate existing MCP servers into the MCPx ecosystem.

### Quick Start with Common MCP Servers

#### 1. Filesystem MCP Server

Connect the popular `@modelcontextprotocol/server-filesystem` to MCPx:

```bash
# Install the MCP server globally (one-time setup)
npm install -g @modelcontextprotocol/server-filesystem

# Run the bridge with the filesystem server
cd packages/bridge
npm run build
npx mcpx-bridge run npx @modelcontextprotocol/server-filesystem /path/to/directory

# Or with custom parameters
npx mcpx-bridge run npx @modelcontextprotocol/server-filesystem /Users/you/Documents \
  --server ws://localhost:3000 \
  --topic my-workspace \
  --name "Filesystem Server"
```

Now all participants can read/write files through the bridge!

#### 2. GitHub MCP Server

```bash
# Install the GitHub MCP server
npm install -g @modelcontextprotocol/server-github

# Run with your GitHub token
GITHUB_TOKEN=your_token_here npx mcpx-bridge run npx @modelcontextprotocol/server-github
```

#### 3. Weather MCP Server (Example)

```bash
# If you have a weather MCP server
npx mcpx-bridge run python weather_server.py \
  --topic weather-room \
  --name "Weather Service"
```

#### 4. Custom Python MCP Server

```bash
# For any Python-based MCP server
npx mcpx-bridge run python /path/to/your/mcp_server.py \
  --id my-service \
  --name "My Custom Service" \
  --verbose
```

### Bridge CLI Options

The `run` command supports these options:

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --server <url>` | MCPx server URL | `ws://localhost:3000` |
| `-t, --topic <name>` | Topic to join | `test-room` |
| `-i, --id <id>` | Participant ID | Auto-generated from command |
| `-n, --name <name>` | Display name | Auto-generated from command |
| `-v, --verbose` | Enable verbose logging | Off |

### Testing Bridged MCP Servers

Once your MCP server is bridged:

1. **Connect with the CLI** in another terminal:
   ```bash
   npm run cli:test
   ```

2. **List available tools**:
   ```
   /list
   /tools filesystem-bridge
   ```

3. **Call MCP server tools**:
   ```
   /call filesystem-bridge read_file {"path": "README.md"}
   /call filesystem-bridge list_directory {"path": "."}
   ```

### Advanced Bridge Configuration

For more control, create a configuration file:

```bash
# Interactive setup
cd packages/bridge
npx mcpx-bridge setup

# Start with config
npx mcpx-bridge start --config bridge-config.json
```

See the [Bridge Documentation](../packages/bridge/README.md) for detailed configuration options.

## Available NPM Scripts

All these commands run from the root `mcpx-protocol` directory:

| Command | Description |
|---------|-------------|
| `npm run dev:gateway` | Start the MCPx gateway server |
| `npm run example:echo` | Start the echo bot example |
| `npm run example:calculator` | Start the calculator agent |
| `npm run example:coordinator` | Start the coordinator agent |
| `npm run example:documents` | Start the documents agent (filesystem bridge) |
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