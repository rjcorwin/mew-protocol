# CLAUDE.md - Project Guidelines for AI Assistants

## Protocol Overview

This repository implements MCPx (Model Context Protocol Extension), a multi-agent coordination protocol that extends the Model Context Protocol (MCP) to enable real-time collaboration between multiple AI agents and humans.

### MCP (Model Context Protocol)
MCP is the foundational protocol developed by Anthropic that defines how AI models interact with tools, resources, and prompts. Key aspects:
- Uses JSON-RPC 2.0 for client-server communication
- Defines standard interfaces for tool calling, resource access, and prompt management
- Enables AI models to interact with external systems in a standardized way
- Each MCP server exposes capabilities that clients can discover and use

### MCPx (MCP Extension Protocol)
MCPx extends MCP to enable multi-agent coordination in shared topics/rooms:
- **Protocol specification**: `protocol-spec/v0/SPEC.md` - Complete protocol definition
- **Implementation patterns**: `protocol-spec/v0/PATTERNS.md` - Best practices and patterns
- **SDK specification**: `sdk-spec/` - Architecture for building MCPx applications
- Adds envelope-based messaging for routing between multiple participants
- All participants act as MCP servers and can call each other's tools
- Enables real-time collaboration through WebSocket gateways
- Maintains compatibility with standard MCP - any MCP server can be bridged to MCPx

## Project Structure

```
mcpx-protocol/
├── protocol-spec/          # Protocol specifications
│   └── v0/
│       ├── SPEC.md        # Main protocol specification
│       └── PATTERNS.md    # Implementation patterns
├── sdk-spec/              # SDK architecture specifications
├── packages/              # NPM packages (@mcpx-protocol/*)
│   ├── client/           # Protocol client implementation
│   ├── agent/            # Agent abstractions
│   ├── bridge/           # MCP-to-MCPx bridge
│   ├── cli/              # Command-line interface
│   └── gateway/          # WebSocket gateway server
├── examples/             # Example agents and implementations
│   ├── echo-bot/         # Simple echo agent
│   ├── calculator-agent/ # Math operations agent
│   ├── coordinator-agent/# Multi-agent orchestration
│   ├── documents-agent/  # Filesystem bridge example
│   └── openai-agent/     # AI-powered assistant
├── docs/                 # Additional documentation
├── TUTORIAL.md          # Step-by-step tutorial
├── QUICK-TEST.md        # Quick testing guide
└── README.md            # Project overview
```

## Development Guidelines

### Testing
Always run tests before committing:
```bash
npm test
npm run lint
```

### Building
After modifying packages, rebuild:
```bash
npm run build:client  # After client changes
npm run build:agent   # After agent changes
npm run build        # Build all packages
```

### Running Examples
```bash
# Start the gateway (required)
npm run dev:gateway

# Start example agents
npm run example:echo
npm run example:calculator
npm run example:coordinator
npm run example:documents
npm run example:openai    # Requires OpenAI API key

# Connect with CLI
npm run cli:test
```

## MCPx Architecture

### Layered SDK Architecture
Packages are published under the `@mcpx-protocol` npm organization:

1. **@mcpx-protocol/client**: Protocol layer
   - Handles MCPx envelopes and WebSocket connections
   - Manages correlation IDs for request/response matching
   - Provides event-based API for messages

2. **@mcpx-protocol/agent**: Agent layer
   - Implements MCP server/client capabilities
   - Manages agent context and state
   - Provides base class for building agents

3. **@mcpx-protocol/bridge**: Bridge layer
   - Connects standard MCP servers to MCPx network
   - Translates between stdio and WebSocket transports
   - Enables any MCP server to join MCPx topics

4. **@mcpx-protocol/cli**: Command-line interface
   - Interactive chat client
   - Protocol debugging tools (/debug command)
   - Testing and development utilities

## Key Concepts

### Envelopes
MCPx wraps MCP messages in envelopes for routing:
```typescript
{
  protocol: "mcp-x/v0",
  id: string,           // Unique message ID
  ts: string,           // ISO timestamp
  from: string,         // Sender participant ID
  to?: string[],        // Optional recipients (broadcast if omitted)
  kind: "mcp" | "chat" | "system",
  payload: any          // MCP message or other content
}
```

### Participants
- Every participant has a unique ID within a topic
- Participants can be agents, humans, or services
- All participants expose MCP server capabilities
- Participants discover each other through system messages

### Topics/Rooms
- Isolated communication spaces
- Participants join topics to interact
- Messages are scoped to topics
- Gateway manages topic membership

## Debugging

### CLI Versions
There are two versions of the CLI:

1. **Blessed CLI** (default, for humans):
   - Full-screen TUI with better UX
   - Enhanced `/debug` command with formatted output
   - Run with: `npm run cli` or `mcpx-chat`

2. **Simple CLI** (for AI coding agents):
   - Line-based readline interface
   - Works with FIFO bridge for automation
   - Also includes `/debug` command for protocol inspection
   - Run with: `npm run cli:simple` or `mcpx-chat-simple`

### Interactive CLI Testing (for AI Agents)
When testing with AI coding agents, use the FIFO bridge with the simple CLI:
```bash
# Terminal 1: Start gateway (if not already running)
npm run dev:gateway

# Terminal 2: Start FIFO bridge
cd packages/cli
node cli-fifo-bridge.js  # Uses cli:simple automatically

# Terminal 3: Send commands
./fifo-send.sh "/connect ws://localhost:3000 test-room user1"
./fifo-send.sh "Hello from AI agent"
./fifo-send.sh "/list"
```

**Note:** The `fifo-send.sh` script uses dynamic path detection to find its location, making it portable across different systems. The FIFO bridge creates named pipes at `.cli-fifos/` relative to the CLI package directory.

### Debug Mode
Both CLIs include a `/debug` command that shows raw protocol envelopes:
```bash
# In blessed CLI (formatted with tree structure)
npm run cli
# Then type: /debug

# In simple CLI (plain JSON output)
npm run cli:simple
# Then type: /debug
```

### Common Issues

1. **Authentication Issues**
   - Check token generation in gateway
   - Verify participant ID is set after welcome message

2. **Event Handler Mismatches**
   - Ensure event names match between emitter and listener
   - Common issue: 'peer-joined' vs 'peer_joined'

3. **Message Structure**
   - Chat events pass `(message: ChatMessage, from: string)`
   - Access text via: `message.params.text`

## Important Notes

- NEVER proactively create documentation files unless explicitly requested
- ALWAYS prefer editing existing files over creating new ones
- Maintain consistency with existing code patterns and style
- Follow security best practices - never expose or commit secrets
- When implementing features, check the protocol spec first