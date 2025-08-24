# MCPx Protocol Tutorial

Welcome to the MCPx multi-agent coordination platform! This tutorial will guide you through running and understanding the example agents, from simple message handling to sophisticated AI-powered collaboration.

## What You'll Learn

By the end of this tutorial, you'll understand how to:
- Run a multi-agent system with MCPx
- Connect agents that expose MCP tools
- Enable agents to discover and use each other's capabilities
- Bridge existing MCP servers into the MCPx ecosystem
- Build collaborative AI workflows

## The Story

Imagine you're building a collaborative workspace where multiple AI agents work together. Each agent has specialized capabilities - one handles calculations, another manages files, and an AI assistant orchestrates everything. MCPx makes this possible by providing a shared communication layer where agents can discover and use each other's tools.

Let's build this system step by step.

## Understanding MCPx Envelopes

Before we dive in, here's what you need to know: MCPx uses **envelopes** to wrap all messages. Think of an envelope as a shipping package with:
- **from**: Who sent it
- **to**: Who should receive it (optional, omit for broadcast)
- **kind**: Type of content (chat, mcp, system)
- **payload**: The actual message

We'll inspect these envelopes as we go to understand the protocol!

### 🔍 CLI Inspection Tools

The CLI has built-in commands to see the actual protocol messages:
- **`/debug`** - Toggle debug mode to see raw envelopes in real-time
- **`/detail`** or **`/d`** - Show full JSON of the last message (or `/d <n>` for message #n)
- **`/console`** - Toggle split view with protocol console

Try these as you follow the tutorial to see what's really happening!

## Prerequisites

Before we begin, ensure you have:
- Node.js 18+ installed
- A terminal (we'll use multiple terminal windows)
- About 15 minutes to explore

### Initial Setup

From the `mcpx-protocol` directory, install dependencies and build the packages:

```bash
# Install all dependencies
npm install

# Build the packages
npm run build
```

## Step 1: Starting the Gateway

The MCPx Gateway is the central hub that all agents connect to. Think of it as a conference room where agents meet to collaborate.

**Terminal 1:**
```bash
npm run dev:gateway
```

You should see:
```
MCPx Gateway starting on http://localhost:3000
WebSocket server listening on ws://localhost:3000
Health check endpoint: http://localhost:3000/health
```

✅ **Gateway is running!** Leave this terminal open - it's now waiting for agents to connect.

## Step 2: Your First Agent - Echo Bot

Let's start with the simplest agent - an echo bot that demonstrates basic message handling.

**Terminal 2:**
```bash
npm run example:echo
```

You'll see:
```
Echo Bot Agent starting...
Connecting to ws://localhost:3000
✓ Connected to test-room
Echo bot is online and ready!
```

The echo bot is now listening for messages. Let's test it!

**Terminal 3 - Connect as a user:**
```bash
npm run cli:test
```

You're now in the MCPx CLI. Try sending a message:
```
> Hello agents!
```

You should see:
```
[Echo #1] test-user said: "Hello agents!"
```

🎉 **Success!** You've just witnessed your first agent interaction. The echo bot received your message and responded.

**💡 Try this:** Type `/debug` to enable debug mode, then send another message. You'll see the actual envelopes! Type `/debug` again to turn it off.

### What Just Happened?

1. The echo bot connected to the gateway and joined the `test-room` topic
2. You connected as a user to the same topic
3. Your message was broadcast to all participants
4. The echo bot received it and sent its response
5. Everyone in the topic saw both messages

### 🔍 Protocol Deep Dive: Chat Envelopes

When you sent "Hello agents!", here's what actually happened:

**Your message envelope:**
```json
{
  "from": "test-user",
  "kind": "chat",
  "payload": {
    "params": {
      "text": "Hello agents!",
      "format": "plain"
    }
  }
}
```

**Echo bot's response envelope:**
```json
{
  "from": "echo-bot",
  "kind": "chat",
  "payload": {
    "params": {
      "text": "[Echo #1] test-user said: \"Hello agents!\"",
      "format": "plain"
    }
  }
}
```

Notice: No `to` field means these are **broadcast** to everyone in the topic!

### Stopping the Echo Bot

The echo bot has served its purpose - it showed us basic message handling. Since it responds to EVERY message, it can get noisy when we add more agents. Let's stop it now:

**In Terminal 2:** Press `Ctrl+C` to stop the echo bot.

You should see:
```
^C
Shutting down...
Echo bot disconnected
```

In your **CLI (Terminal 3)**, you might see:
```
→ echo-bot left the topic
```

Good! The echo bot is gone, and we can continue without the noise.

## Step 3: Adding Intelligence - Calculator Agent

Now let's add an agent with actual capabilities. The calculator agent exposes MCP tools that other participants can use.

**Terminal 4:**
```bash
npm run example:calculator
```

Back in **Terminal 3 (CLI)**, let's explore what the calculator can do:

```
/list
```

You'll see:
```
=== Participants ===
  calculator-agent (agent) [MCP]
  test-user (user) [none]
```

Notice the `[MCP]` tag? That means these agents expose MCP tools. Let's see what tools the calculator offers:

```
/tools calculator-agent
```

Output:
```
Tools from calculator-agent:
  - add: Add two numbers
  - subtract: Subtract two numbers
  - multiply: Multiply two numbers
  - divide: Divide two numbers
  - sqrt: Calculate square root
```

### Using MCP Tools

Now let's use these tools:

```
/call calculator-agent add {"a": 25, "b": 17}
```

Result:
```
{
  "content": [
    {
      "type": "text",
      "text": "25 + 17 = 42"
    }
  ]
}
```

**💡 Pro tip:** Turn on `/debug` before calling tools to see the MCP envelopes with their JSON-RPC payloads! You can also use `/m` to review the message history.

Try a few more:
```
/call calculator-agent multiply {"a": 7, "b": 6}
/call calculator-agent sqrt {"n": 144}
```

### Understanding MCP Tools

The calculator agent demonstrates a key MCPx concept:
- Agents expose **tools** via the MCP protocol
- Other participants can **discover** these tools
- Anyone can **call** these tools with proper parameters
- Results are returned in a **standardized format**

### 🔍 Protocol Deep Dive: MCP Tool Calls

When you called the calculator's add tool, here's the envelope exchange:

**Your tool call request:**
```json
{
  "from": "test-user",
  "to": ["calculator-agent"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "add",
      "arguments": {"a": 25, "b": 17}
    }
  }
}
```

**Calculator's response:**
```json
{
  "from": "calculator-agent",
  "to": ["test-user"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "content": [{
        "type": "text",
        "text": "25 + 17 = 42"
      }]
    }
  }
}
```

Key differences from chat:
- **`to` field**: Direct messaging between specific participants
- **`kind: "mcp"`**: Contains MCP protocol messages
- **JSON-RPC format**: Standard request/response structure
- **Correlation**: Response `id` matches request `id`

## Step 4: Multi-Agent Coordination

The coordinator agent shows how agents can work together. It listens for calculation requests in chat and automatically uses the calculator agent's tools.

**Terminal 5:**
```bash
npm run example:coordinator
```

In the **CLI**, send a natural language request:

```
calculate 100 + 200
```

Watch what happens:
```
[coordinator-agent] Processing "100 + 200" for test-user...
[calculator-agent] 📊 Calculation for coordinator-agent: 100 + 200 = 300
```

### The Coordination Flow

1. **You** sent a chat message with "calculate"
2. **Coordinator** recognized the pattern and extracted the operation
3. **Coordinator** called the calculator's `add` tool via MCP
4. **Calculator** performed the calculation and returned the result
5. **Calculator** also sent a chat message with the answer

Try more complex examples:
```
calculate 50 * 3
sqrt 625
```

This demonstrates **agent orchestration** - agents working together without direct user intervention.

### 🔍 Protocol Deep Dive: Agent-to-Agent Communication

Here's the complete envelope flow when you said "calculate 100 + 200":

**1. Your chat message (broadcast):**
```json
{
  "from": "test-user",
  "kind": "chat",
  "payload": {
    "params": {"text": "calculate 100 + 200"}
  }
}
```

**2. Coordinator calls calculator (directed MCP):**
```json
{
  "from": "coordinator-agent",
  "to": ["calculator-agent"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "add",
      "arguments": {"a": 100, "b": 200}
    }
  }
}
```

**3. Calculator responds to coordinator:**
```json
{
  "from": "calculator-agent",
  "to": ["coordinator-agent"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "content": [{"type": "text", "text": "100 + 200 = 300"}]
    }
  }
}
```

**4. Calculator announces result (broadcast chat):**
```json
{
  "from": "calculator-agent",
  "kind": "chat",
  "payload": {
    "params": {"text": "📊 Calculation for coordinator-agent: 100 + 200 = 300"}
  }
}
```

Notice the mix of broadcast chat and directed MCP messages!

## Step 5: Bridging External Services - Documents Agent

So far, our agents have been custom-built for MCPx. But what if you want to use an existing MCP server? The documents agent shows how to bridge any MCP server into MCPx.

**Terminal 6:**
```bash
npm run example:documents
```

This agent bridges the standard `@modelcontextprotocol/server-filesystem` MCP server, exposing a documents folder to all participants.

### Exploring Shared Documents

In the **CLI**, check what tools are available:

```
/tools documents-agent
```

You'll see filesystem tools like:
- `read_file` - Read file contents
- `write_file` - Create or update files
- `list_directory` - List folder contents
- `search_files` - Search for files

### Working with Files

First, find out what files are available:

```
/call documents-agent list_allowed_directories {}
```

This shows the accessible directory. Now list its contents:

```
/call documents-agent list_directory {"path": "/users/rj/git/rjcorwin/mcpx-monorepo/mcpx-protocol/examples/documents-agent/documents"}
```

Read a file:
```
/call documents-agent read_file {"path": "/users/rj/git/rjcorwin/mcpx-monorepo/mcpx-protocol/examples/documents-agent/documents/the-answer.txt"}
```

Result: `"42"` - The answer to life, the universe, and everything!

### Creating New Files

You can also write files that all agents can access:

```
/call documents-agent write_file {"path": "/users/rj/git/rjcorwin/mcpx-monorepo/mcpx-protocol/examples/documents-agent/documents/shared-note.txt", "content": "This file was created through MCPx!"}
```

Now any agent (or user) in the topic can read this file. You've just created a shared workspace!

### 🔍 Protocol Deep Dive: Bridge Translation

The bridge translates between MCPx envelopes and the filesystem MCP server. When you call a tool:

**MCPx envelope (what you send):**
```json
{
  "from": "test-user",
  "to": ["documents-agent"],
  "kind": "mcp",
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "read_file",
      "arguments": {"path": "..."}
    }
  }
}
```

The bridge:
1. **Extracts** the MCP payload from the envelope
2. **Forwards** it to the filesystem MCP server via stdio
3. **Wraps** the response back in an MCPx envelope
4. **Routes** it back to you

This is how ANY MCP server can join the MCPx ecosystem!

## Step 6: AI-Powered Collaboration - OpenAI Agent

Now for the grand finale - an AI agent that can use other agents' tools intelligently.

**Note:** This requires an OpenAI API key. If you don't have one, you can still observe the interactions from the previous steps.

**Terminal 7 (if you have an API key):**
```bash
cd examples/openai-agent
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
npm start
```

### Natural Language File Access

With both the documents-agent and openai-agent running, try this natural conversation in the **CLI**:

```
Hey OpenAI agent, can you read the file 'the-answer.txt' from the documents-agent?
```

The OpenAI agent will:
1. Understand your request
2. Discover the documents-agent's capabilities
3. Find the correct path
4. Call the appropriate tool
5. Return the result in natural language

Example response:
```
🤖 The content of the file 'the-answer.txt' is: `42`. Let me know if there's anything else you need!
```

### Intelligent Multi-Tool Usage

Try asking for more complex operations:

```
Can you list all files in the documents folder and tell me what example-data.json contains?
```

The OpenAI agent will:
1. Call `list_directory` to get all files
2. Call `read_file` to read the JSON
3. Format and present the information clearly

### Cross-Agent Calculation

With the calculator also running:

```
What's 156 multiplied by 89?
```

The OpenAI agent recognizes this needs calculation and automatically uses the calculator agent:
```
🤖 Let me calculate that for you...
[Calls calculator agent]
🤖 156 × 89 = 13,884
```

## Observing the System

At this point, you have a complete multi-agent system running:

1. **Gateway** - Central communication hub
2. **Calculator** - Provides mathematical tools
3. **Coordinator** - Orchestrates calculation requests
4. **Documents** - Bridges filesystem access
5. **OpenAI** - Provides intelligent assistance (optional)
6. **You** - Interacting via the CLI

Remember, we stopped the echo bot earlier to reduce noise!

Try this to see everyone:
```
/list
```

## Understanding the Architecture

```
┌──────────────────────────────────────────────┐
│                MCPx Gateway                   │
│              (ws://localhost:3000)            │
└────┬──────┬──────┬──────┬──────┬──────┬──────┘
     │      │      │      │      │      │
     ▼      ▼      ▼      ▼      ▼      ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│  Calc  │ │ Coord  │ │  Docs  │ │ OpenAI │ │  CLI   │
│        │ │        │ │        │ │        │ │  User  │
│ Math   │ │ Routes │ │ Files  │ │   AI   │ │  You   │
│ Tools  │ │ Calcs  │ │ Bridge │ │ Agent  │ │        │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘

Each agent connects independently to the gateway
and can discover and use other agents' tools
```

### Key Concepts Demonstrated

1. **Topic-Based Communication**: All agents join the same "room" to collaborate
2. **Tool Discovery**: Agents can query what tools others provide
3. **Cross-Agent Calling**: Any agent can use another agent's tools
4. **Protocol Bridging**: External MCP servers integrate seamlessly
5. **Natural Language Processing**: AI agents understand context and intent
6. **Shared Resources**: Files and data accessible to all participants

### 🔍 Protocol Summary: Envelope Types

Through this tutorial, you've seen three envelope types in action:

| Kind | Purpose | To Field | Example Use |
|------|---------|----------|-------------|
| **chat** | Human-readable messages | Optional (broadcast) | User messages, agent announcements |
| **mcp** | MCP protocol (tools, resources) | Usually specific | Tool calls, responses |
| **system** | Gateway control messages | N/A | Welcome, participant join/leave |

**Key Protocol Patterns:**
- **Broadcast**: Omit `to` field → everyone receives it
- **Direct**: Include `to: ["participant-id"]` → only they receive it
- **Request/Response**: MCP messages include `id` for correlation
- **JSON-RPC**: MCP payloads follow JSON-RPC 2.0 specification

You now understand how MCPx orchestrates multi-agent collaboration!

## Experiments to Try

Now that you understand the system, try these experiments:

### 1. Message Chains
Send a message and watch it cascade through the agents:
```
Hello everyone! Can someone calculate 5 + 5 and save the result to a file?
```

### 2. Tool Chaining
Ask the OpenAI agent to:
```
Read all JSON files, perform calculations on any numbers you find, and summarize the results
```

### 3. Collaborative Creation
```
OpenAI agent, create a markdown file with the results of calculating squares from 1 to 10
```

### 4. System Introspection
```
/tools documents-agent
/call documents-agent get_file_info {"path": "/users/rj/git/rjcorwin/mcpx-monorepo/mcpx-protocol/examples/documents-agent/documents/readme.md"}
```

## Troubleshooting

### Agent Won't Connect
- Check the gateway is running (Terminal 1)
- Verify the WebSocket URL: `ws://localhost:3000`
- Ensure no firewall is blocking port 3000

### Tools Not Working
- Use `/list` to verify the agent is connected
- Use `/tools <agent-name>` to see available tools
- Check the JSON format in your `/call` commands

### File Access Issues
- Use `list_allowed_directories` to find the correct path
- Note that paths might be lowercase (`/users` not `/Users`)
- Use absolute paths for file operations

### OpenAI Agent Issues
- Verify your API key is set in `.env`
- Check you have API credits available
- Monitor the agent's terminal for error messages

## What's Next?

### Build Your Own Agent

1. Copy one of the example agents as a template
2. Modify its capabilities
3. Add new MCP tools
4. Connect it to the system

### Bridge More MCP Servers

Try bridging other MCP servers:
- `@modelcontextprotocol/server-github` - GitHub operations
- `@modelcontextprotocol/server-sqlite` - Database access
- Custom MCP servers for your services

### Create Complex Workflows

Combine agents to build:
- Data processing pipelines
- Automated research systems
- Collaborative document generation
- Multi-source information aggregation

### Explore the Protocol

- Read the [MCPx Specification](protocol-spec/v0/SPEC.md)
- Understand [Implementation Patterns](protocol-spec/v0/PATTERNS.md)
- Review the [SDK Architecture](sdk-spec/README.md)

## Summary

Congratulations! You've successfully:
- ✅ Run a complete multi-agent system
- ✅ Used MCP tools across agents
- ✅ Witnessed agent coordination
- ✅ Bridged external MCP servers
- ✅ Enabled AI-powered collaboration

MCPx provides the foundation for building sophisticated multi-agent systems where specialized agents collaborate to solve complex problems. Each agent contributes its unique capabilities while the protocol ensures seamless communication and tool sharing.

## Commands Reference

### Basic Commands
| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/list` | List all connected participants |
| `/tools <agent>` | Show tools from an agent |
| `/call <agent> <tool> <json>` | Call a specific tool |
| `/clear` | Clear the message log |
| `/quit` | Exit the CLI |

### Inspection Commands
| Command | Description |
|---------|-------------|
| `/debug` | Toggle debug mode (see raw envelopes) |
| `/detail` or `/d [n]` | Show full JSON of last message or message #n |
| `/console` | Toggle protocol console split view |

Use these inspection commands to understand the protocol as you learn!

## Quick Start Commands

For reference, here are all the commands to start everything:

```bash
# Terminal 1: Gateway
npm run dev:gateway

# Terminal 2: All agents at once
npm run example:all

# Terminal 3: CLI
npm run cli:test

# Or start agents individually:
npm run example:echo
npm run example:calculator
npm run example:coordinator
npm run example:documents
npm run example:openai  # (requires API key)
```

---

Thank you for exploring MCPx! We're excited to see what you'll build with multi-agent coordination.