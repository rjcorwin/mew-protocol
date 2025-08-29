# MCPx Bridge Bidirectional Specification

## Overview

The MCPx Bridge provides bidirectional bridging between MCP servers and MCPx topics:
1. **mcp-server-to-mcpx-topic**: Exposes an existing MCP server as an agent in an MCPx topic
2. **mcpx-topic-to-mcp-server**: Exposes an MCPx topic as a local MCP server

## Architecture

### Mode 1: MCP Server → MCPx Topic
```
┌─────────────┐      stdio       ┌─────────────┐      WebSocket      ┌─────────────┐
│             │  ◄─────────────►  │             │  ◄───────────────►  │             │
│ MCP Server  │                   │   Bridge    │                      │ MCPx Topic  │
│             │                   │  (Client)   │                      │             │
└─────────────┘                   └─────────────┘                      └─────────────┘
```

### Mode 2: MCPx Topic → MCP Server  
```
┌─────────────┐      stdio/SSE    ┌─────────────┐      WebSocket      ┌─────────────┐
│             │  ◄─────────────►  │             │  ◄───────────────►  │             │
│ MCP Client  │                   │   Bridge    │                      │ MCPx Topic  │
│ (Cursor)    │                   │  (Server)   │                      │             │
└─────────────┘                   └─────────────┘                      └─────────────┘
```

## Command Interface

### Subcommand: mcp-server-to-mcpx-topic
```bash
mcpx-bridge mcp-server-to-mcpx-topic \
  --server-command "command arg1 arg2" \
  --gateway ws://localhost:3000 \
  --topic my-topic \
  --participant-id my-agent \
  --token optional-auth-token
```

This mode:
- Spawns the MCP server as a subprocess
- Connects to MCPx gateway as a client
- Translates between stdio (MCP) and WebSocket (MCPx)
- Exposes server's tools to topic participants

### Subcommand: mcpx-topic-to-mcp-server
```bash
mcpx-bridge mcpx-topic-to-mcp-server \
  --gateway ws://localhost:3000 \
  --topic my-topic \
  --participant-id bridge-server \
  --token optional-auth-token \
  --transport stdio|sse \
  --port 3001  # for SSE transport
```

This mode:
- Acts as an MCP server (stdio or SSE transport)
- Connects to MCPx gateway as a client
- Aggregates tools from topic participants
- Routes tool calls from local MCP client to topic participants

## Core Functionality

### Tool Discovery and Aggregation

#### In mcp-server-to-mcpx-topic mode:
1. Bridge queries MCP server for available tools
2. Announces tools via MCPx presence/capabilities
3. Handles incoming tool calls from topic participants
4. Routes responses back through MCPx

#### In mcpx-topic-to-mcp-server mode:
1. Bridge discovers tools from topic participants
2. Aggregates and namespaces tools (see ADR-001)
3. Exposes aggregated tools to local MCP client
4. Routes tool calls to appropriate participants

### Message Translation

The bridge handles protocol translation between:
- MCP's JSON-RPC 2.0 messages
- MCPx's envelope format with routing metadata

### Connection Management

- Reconnection logic for WebSocket disconnections
- Process management for spawned MCP servers
- Graceful shutdown handling

## Configuration

### Environment Variables
```bash
MCPX_GATEWAY_URL=ws://localhost:3000
MCPX_AUTH_TOKEN=secret-token
MCPX_PARTICIPANT_ID=my-bridge
MCPX_LOG_LEVEL=debug|info|warn|error
```

### Configuration File (optional)
```json
{
  "gateway": "ws://localhost:3000",
  "topic": "development",
  "participantId": "bridge-01",
  "token": "auth-token",
  "transport": "stdio",
  "toolNamespacing": "prefix",
  "reconnect": {
    "maxAttempts": 10,
    "backoffMs": 1000
  }
}
```

## Implementation Phases

### Phase 1: Enhance Existing Bridge
- Refactor current bridge code to support subcommands
- Clean separation between the two modes
- Shared utilities for WebSocket and protocol handling

### Phase 2: Add mcpx-topic-to-mcp-server Mode
- Implement MCP server interface
- Tool aggregation and namespacing
- Request routing with correlation IDs
- Support stdio transport first

### Phase 3: Advanced Features
- SSE transport support
- Resource and prompt aggregation
- Bidirectional tool exposure
- Multi-topic support

## Error Handling

The bridge must handle:
- Connection failures (both MCP and MCPx sides)
- Protocol mismatches
- Tool call timeouts
- Participant disconnections
- Malformed messages

See ADR-003 for detailed error handling strategy.

## Security Considerations

1. **Authentication**: Support token-based auth for MCPx gateway
2. **Process Isolation**: Spawned MCP servers run in isolated processes
3. **Input Validation**: Validate all messages before forwarding
4. **Rate Limiting**: Optional rate limiting for tool calls
5. **Audit Logging**: Log all tool invocations for monitoring

## Testing Strategy

1. **Unit Tests**: Protocol translation, message handling
2. **Integration Tests**: End-to-end flow with mock servers
3. **Compatibility Tests**: Test with various MCP servers
4. **Performance Tests**: Load testing for tool aggregation

## Architectural Decisions

See the `decisions/` directory for detailed ADRs:
- ADR-001: Tool Namespacing Strategy
- ADR-002: Transport Selection for MCP Server Mode
- ADR-003: Error Handling and Retry Strategy