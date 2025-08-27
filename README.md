# MCPx Protocol

**Collaborative AI Governance Through Multi-Agent Orchestration** 

MCPx extends the Model Context Protocol (MCP) to enable secure, supervised collaboration between AI agents, humans, and tools - transforming isolated AI systems into collaborative intelligence networks.

## Beyond Simple Agent Communication

MCPx isn't just about connecting agents - it's a framework for **collaborative AI governance** where multiple intelligent participants work together to safely orchestrate complex operations at scale.

### 🤝 Collaborative Governance
Not just one human supervisor, but potentially:
- Multiple humans reviewing different aspects
- AI safety classifiers checking for harmful operations
- Compliance agents verifying regulatory requirements
- Security scanners analyzing for vulnerabilities

### 🧠 Emergent Intelligence
Orchestrator agents learn from:
- Multiple teachers with different expertise
- Statistical patterns across many decisions
- AI-powered policy recommendations
- Consensus mechanisms for critical operations

### 📈 Scalable Oversight
As systems grow:
- Specialized reviewers focus on their domains
- AI handles routine approvals
- Humans focus on policy and exceptions
- The system becomes more intelligent over time

## What is MCPx?

At its core, MCPx enables multiple MCP servers to connect in shared "topics" (rooms) with capability-based security. This creates an environment where:

- 🔒 **Untrusted agents** can safely propose operations without executing them
- 👥 **Multiple supervisors** collaborate on what to approve
- 🤖 **Orchestrators** progressively learn which operations are safe
- 🔧 **Worker agents** execute approved operations with appropriate tools
- 📝 **Every action** is auditable and reversible

## Quick Start: TODO App Demo (2 minutes)

Build a working AI-powered TODO app in under 2 minutes! This demo shows how MCPx enables AI agents to interact with your local files.

```bash
# 1. Install MCPx globally
npm install -g @mcpx-protocol/gateway @mcpx-protocol/cli @mcpx-protocol/bridge
npm install -g @modelcontextprotocol/server-filesystem

# 2. Create a Notes folder on your Desktop
mkdir ~/Desktop/Notes
echo "# TODO List" > ~/Desktop/Notes/TODO.md

# 3. Start the gateway (Terminal 1)
mcpx-gateway

# 4. Bridge your Notes folder as an agent (Terminal 2)
mcpx-bridge run -t quickstart -i notes-agent -n "Notes" \
  -- npx @modelcontextprotocol/server-filesystem ~/Desktop/Notes

# 5. Start the OpenAI agent (Terminal 3)
# Install the OpenAI agent globally first
npm install -g @mcpx-protocol/openai-agent

# Run with your OpenAI API key and TODO-specific prompt
OPENAI_API_KEY=your-key \
OPENAI_MODEL=gpt-4o \
MCPX_TOPIC=quickstart \
OPENAI_SYSTEM_PROMPT="You are a helpful TODO list manager. You have access to a TODO.md file located at /Users/$USER/Desktop/Notes/TODO.md. When asked about TODO items, ALWAYS: 1) First use notes-agent.read_text_file tool to read the file, 2) Then immediately use notes-agent.write_file tool with the full path /Users/$USER/Desktop/Notes/TODO.md to save changes. Never just show changes without saving. Always maintain markdown format with '# TODO List' as the header and items as bullet points." \
mcpx-openai-agent

# 6. Connect and interact (Terminal 4)
mcpx-chat ws://localhost:3000 quickstart user
# Type: @openai-agent please add "pick up milk" to my TODO list
# The AI understands TODO context and manages your file!

# Check your TODO.md - the AI has updated it!
cat ~/Desktop/Notes/TODO.md
```

That's it! You've just created a multi-agent system where an AI can manage your TODO list. The OpenAI agent discovered the filesystem tools from the Notes agent and used them to update your file.

## Advanced Demo: Orchestrated AI with Human Oversight (Coming Soon)

This demo showcases the full power of MCPx's collaborative governance model, where an AI proposes operations that an orchestrator reviews and executes based on human-defined policies.

```bash
# 1. Start the gateway with capability-based security
mcpx-gateway --secure

# 2. Bridge your Notes folder (Terminal 2)
mcpx-bridge run -t orchestrated -i notes-agent -n "Notes" \
  --capabilities "mcp/request:*" \
  -- npx @modelcontextprotocol/server-filesystem ~/Desktop/Notes

# 3. Start the OpenAI agent with proposal-only capabilities (Terminal 3)
OPENAI_API_KEY=your-key \
OPENAI_MODEL=gpt-4o \
MCPX_TOPIC=orchestrated \
MCPX_CAPABILITIES="mcp/proposal:*,chat" \
OPENAI_SYSTEM_PROMPT="You are a helpful assistant. You can propose operations but cannot execute them directly. Always explain what you want to do and why." \
mcpx-openai-agent

# 4. Start the Orchestrator agent (Terminal 4)
# The orchestrator reviews proposals and decides what to execute
mcpx-orchestrator \
  --topic orchestrated \
  --id orchestrator \
  --capabilities "mcp/request:*" \
  --auto-approve "read_*" \
  --require-human "write_*,delete_*"

# 5. Connect as a human supervisor (Terminal 5)
mcpx-chat ws://localhost:3000 orchestrated human --capabilities "mcp/*"

# Now when you ask the AI to modify files:
# Type: @openai-agent please add "buy groceries" to my TODO list
# 
# The AI will PROPOSE the operation
# The Orchestrator will see it needs human approval for writes
# You'll be prompted to approve/deny
# If approved, the Orchestrator executes the operation

# Over time, you can teach the orchestrator patterns:
# Type: @orchestrator always approve TODO.md updates from openai-agent
# Now future TODO updates will be automatic!
```

This demonstrates:
- 🔒 **Capability-based security**: AI can only propose, not execute
- 👤 **Human-in-the-loop**: Critical operations require your approval
- 🧠 **Progressive automation**: Orchestrator learns what to auto-approve
- 📊 **Audit trail**: Every proposal and decision is logged

> **Note**: The `mcpx-orchestrator` agent is under development. Check back soon or contribute to the project!

## Documentation

- 📖 **[Tutorials](tutorials/)** - Complete learning path from basics to production
  - [Getting Started](tutorials/01-getting-started.md) - Hands-on introduction with protocol deep-dives
  - [Build Your Agent](tutorials/02-build-your-agent.md) - Create custom MCPx agents
  - [More tutorials...](tutorials/README.md)
- 📋 **[Protocol Spec](protocol-spec/v0/SPEC.md)** - Complete protocol specification
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
# Install globally
npm install -g @mcpx-protocol/openai-agent

# Basic usage
OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-4o mcpx-openai-agent

# Custom system prompt for specialized behavior
OPENAI_API_KEY=sk-... \
OPENAI_MODEL=gpt-4o \
OPENAI_SYSTEM_PROMPT="You are a helpful TODO list manager..." \
mcpx-openai-agent

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