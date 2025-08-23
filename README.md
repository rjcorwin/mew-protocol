# MCPx Protocol

MCPx is a protocol specification that extends the Model Context Protocol (MCP) to enable multi-party interactions through topic-based communication.

## Repository Structure

```
mcpx-protocol/
├── protocol-spec/     # Protocol specification
├── sdk-spec/          # SDK architecture specification
├── packages/          # Reference implementations
│   ├── client/        # Protocol layer (WebSocket, envelopes)
│   ├── agent/         # Agent abstractions (MCP server/client)
│   ├── gateway/       # WebSocket gateway server
│   ├── cli/           # Interactive CLI for testing
│   ├── web-client/    # Web interface
│   └── bridge/        # MCP-to-MCPx bridge
└── examples/          # Example agents
    ├── echo-bot/      # Simple message echo agent
    ├── calculator-agent/ # MCP tool provider
    └── coordinator-agent/ # Multi-agent orchestrator
```

## Quick Start

### Minimal Example (3 commands)

```bash
# Terminal 1: Start the gateway
npm run dev:gateway

# Terminal 2: Start all example agents
npm run example:all

# Terminal 3: Connect with CLI
npm run cli:test
```

That's it! You're now connected to a room with three example agents.

### Step-by-Step

```bash
# Install dependencies
npm install

# Build packages
npm run build

# Start the gateway server
npm run dev:gateway

# Start individual examples (or use npm run example:all)
npm run example:echo        # Echo bot
npm run example:calculator  # Calculator with MCP tools
npm run example:coordinator # Multi-agent coordinator

# Connect with the CLI
npm run cli:blessed -- ws://localhost:3000 test-room your-name
```

## Packages

### Core SDK
- **@mcpx-protocol/client** - Protocol layer handling WebSocket, envelopes, and correlation
- **@mcpx-protocol/agent** - Agent abstractions for MCP server/client functionality

### Tools & Infrastructure
- **@mcpxp/gateway** - Reference gateway server implementation
- **@mcpx-protocol/cli** - Interactive terminal client with blessed TUI
- **@mcpxp/web-client** - Reference web client for testing
- **@mcpxp/bridge** - Bridge to connect MCP servers to MCPx topics

### Examples
- **echo-bot** - Simple chat echo agent demonstrating message handling
- **calculator-agent** - MCP tool provider with math operations
- **coordinator-agent** - Multi-agent orchestrator showing tool coordination

## Documentation

- [Protocol Specification](protocol-spec/v0/SPEC.md) - MCPx v0 protocol specification
- [SDK Architecture](sdk-spec/mcpx-sdk-architecture.md) - SDK layered architecture
- [Implementation Patterns](protocol-spec/v0/PATTERNS.md) - Common implementation patterns
- [Examples Guide](examples/README.md) - Detailed guide for running and testing examples

## License

MIT