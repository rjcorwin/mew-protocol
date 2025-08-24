# MCPx Protocol

**Multi-agent coordination through shared topics** - MCPx extends the Model Context Protocol (MCP) to enable real-time collaboration between AI agents, humans, and tools in shared communication spaces.

## What is MCPx?

MCPx allows multiple MCP servers to connect and interact in shared "topics" (rooms). Every participant can:
- 💬 Send and receive chat messages
- 🔧 Discover and call each other's tools
- 🤝 Coordinate complex multi-agent workflows
- 🌉 Bridge any existing MCP server into the network

## Quick Start (3 minutes)

```bash
# 1. Install and build
npm install
npm run build

# 2. Start everything with one command
npm run dev:gateway & npm run example:all

# 3. Connect and chat
npm run cli:test

# You're now chatting with AI agents! Try:
# - "calculate 42 * 17" (triggers calculator agent)
# - "what can you do?" (agents describe their capabilities)
```

## Documentation

- 📖 **[Tutorial](TUTORIAL.md)** - Step-by-step guide with protocol deep-dives
- 📋 **[Protocol Spec](protocol-spec/v0/SPEC.md)** - Complete protocol specification
- 🏗️ **[SDK Architecture](sdk-spec/)** - SDK design and patterns
- 🧪 **[Examples](examples/)** - Working example agents
- 🛠️ **[Bridge Guide](packages/bridge/)** - Bridging MCP servers

## Try the Examples

### 🤖 Basic Multi-Agent Chat
```bash
# Terminal 1: Start gateway
npm run dev:gateway

# Terminal 2: Start example agents
npm run example:echo        # Echoes messages
npm run example:calculator  # Provides math tools

# Terminal 3: Connect and interact
npm run cli:test
```

### 🧠 AI-Powered Assistant
```bash
# Set your OpenAI API key
export OPENAI_API_KEY=sk-...

# Start the OpenAI agent
npm run example:openai

# The AI agent can now orchestrate other agents' tools!
```

### 📁 Bridge Any MCP Server
```bash
# Bridge the filesystem MCP server into MCPx
npx @mcpx-protocol/bridge run \
  npx -y @modelcontextprotocol/server-filesystem /tmp \
  --participant fs-agent

# Now all agents can read/write files!
```

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   AI Agent   │     │ Human (CLI)  │     │  MCP Server  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  MCPx Gateway   │
                    │   (WebSocket)   │
                    └────────┬────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
         ┌──────▼──┐  ┌──────▼──┐  ┌──────▼──┐
         │ Topic A │  │ Topic B │  │ Topic C │
         └─────────┘  └─────────┘  └─────────┘
```

## Core Concepts

### Topics (Rooms)
Isolated spaces where participants interact. Messages and tool calls are scoped to topics.

### Participants
Any entity in a topic - can be an AI agent, human, or bridged MCP server. All participants can expose and call tools.

### Envelopes
MCPx wraps all messages in routing envelopes:
```json
{
  "protocol": "mcp-x/v0",
  "from": "agent-1",
  "to": ["agent-2"],  // Optional, broadcasts if omitted
  "kind": "mcp",
  "payload": { /* MCP message */ }
}
```

## Packages

| Package | Description | NPM |
|---------|-------------|-----|
| **@mcpx-protocol/client** | Core protocol client for WebSocket communication | [![npm](https://img.shields.io/npm/v/@mcpx-protocol/client)](https://npmjs.com/package/@mcpx-protocol/client) |
| **@mcpx-protocol/agent** | Base class for building MCPx agents | [![npm](https://img.shields.io/npm/v/@mcpx-protocol/agent)](https://npmjs.com/package/@mcpx-protocol/agent) |
| **@mcpx-protocol/bridge** | Bridge any MCP server to MCPx | [![npm](https://img.shields.io/npm/v/@mcpx-protocol/bridge)](https://npmjs.com/package/@mcpx-protocol/bridge) |
| **@mcpx-protocol/gateway** | WebSocket gateway server | [![npm](https://img.shields.io/npm/v/@mcpx-protocol/gateway)](https://npmjs.com/package/@mcpx-protocol/gateway) |
| **@mcpx-protocol/cli** | Interactive terminal client | [![npm](https://img.shields.io/npm/v/@mcpx-protocol/cli)](https://npmjs.com/package/@mcpx-protocol/cli) |

## Building Your Own Agent

```typescript
import { MCPxAgent } from '@mcpx-protocol/agent';

class MyAgent extends MCPxAgent {
  constructor() {
    super({
      url: 'ws://localhost:3000',
      topic: 'my-topic',
      agent: {
        name: 'my-agent',
        version: '1.0.0',
        description: 'My custom agent'
      }
    });
  }

  // Handle chat messages
  async onChatMessage(message: ChatMessage, from: string) {
    if (message.params.text.includes('hello')) {
      await this.chat('Hello! I can help with...');
    }
  }

  // Expose tools via MCP
  async handleToolCall(name: string, args: any) {
    if (name === 'my_tool') {
      return { result: 'Tool executed!' };
    }
  }
}

// Start the agent
const agent = new MyAgent();
await agent.start();
```

## Bridge Existing MCP Servers

Any MCP server that communicates via stdio can join MCPx:

```bash
# Bridge filesystem server
mcpx-bridge run npx -y @modelcontextprotocol/server-filesystem ./docs

# Bridge PostgreSQL server
mcpx-bridge run npx -y @modelcontextprotocol/server-postgres \
  --participant db-agent

# Bridge GitHub server
mcpx-bridge run npx -y @modelcontextprotocol/server-github \
  --participant github-agent
```

## Development

```bash
# Run tests
npm test

# Development mode (watch & rebuild)
npm run dev

# Lint and type-check
npm run lint

# Clean and rebuild everything
npm run clean && npm run build
```

### Debug Mode

The CLI includes a `/debug` command to inspect raw protocol messages:

```bash
npm run cli
# Type: /debug
# Now you see all protocol envelopes!
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT - See [LICENSE](LICENSE) for details.

## Links

- **Model Context Protocol**: [modelcontextprotocol.org](https://modelcontextprotocol.org)
- **MCPx Spec**: [protocol-spec/v0/SPEC.md](protocol-spec/v0/SPEC.md)
- **GitHub**: [github.com/mcpx-protocol/mcpx](https://github.com/mcpx-protocol/mcpx)