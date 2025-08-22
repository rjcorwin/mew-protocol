# MCPx Protocol

MCPx is a protocol specification that extends the Model Context Protocol (MCP) to enable multi-party interactions through topic-based communication.

## Repository Structure

```
mcpx/
├── spec/           # Protocol specification
├── packages/       # Reference implementations
│   ├── gateway/    # WebSocket gateway server
│   ├── web-client/ # Web interface
│   ├── bridge/     # MCP-to-MCPx bridge
│   └── sdk-typescript/ # TypeScript SDK
└── examples/       # Usage examples
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

- **@mcpx/gateway** - Reference gateway server implementation
- **@mcpx/web-client** - Reference web client for testing
- **@mcpx/bridge** - Bridge to connect MCP servers to MCPx topics
- **@mcpx/sdk-typescript** - TypeScript SDK for building MCPx clients

## Documentation

See the [spec/](spec/) directory for the protocol specification.

## License

MIT