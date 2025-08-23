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
│   ├── web-client/    # Web interface
│   └── bridge/        # MCP-to-MCPx bridge
└── examples/          # Usage examples
```

## Quick Start

```bash
# Install dependencies
npm install

# Start the gateway server
npm run dev:gateway

# In another terminal, start the web client
npm run dev:web

# Connect an MCP server via bridge
npm run dev:bridge
```

## Packages

### Core SDK
- **@mcpx-protocol/client** - Protocol layer handling WebSocket, envelopes, and correlation
- **@mcpx-protocol/agent** - Agent abstractions for MCP server/client functionality

### Infrastructure
- **@mcpxp/gateway** - Reference gateway server implementation
- **@mcpxp/web-client** - Reference web client for testing
- **@mcpxp/bridge** - Bridge to connect MCP servers to MCPx topics

## Documentation

- [Protocol Specification](protocol-spec/v0/SPEC.md) - MCPx v0 protocol specification
- [SDK Architecture](sdk-spec/mcpx-sdk-architecture.md) - SDK layered architecture
- [Implementation Patterns](protocol-spec/v0/PATTERNS.md) - Common implementation patterns

## License

MIT