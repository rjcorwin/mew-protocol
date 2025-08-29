# MCPx Portal Specification

## Overview

The MCPx Portal is an MCP server that acts as a gateway between local MCP clients (Cursor, Claude Desktop, Windsurf, etc.) and MCPx topics. It enables local development environments to access tools and resources from multiple agents participating in an MCPx topic.

## Architecture

```
┌─────────────────┐       MCP Protocol        ┌──────────────┐      MCPx Protocol      ┌─────────────┐
│                 │  ◄────────────────────►   │              │  ◄──────────────────►   │             │
│  Local Client   │       (stdio/SSE)          │  MCPx Portal │      (WebSocket)        │ MCPx Topic  │
│ (Cursor, etc.)  │                            │  (MCP Server)│                         │  (Gateway)  │
│                 │                            │              │                         │             │
└─────────────────┘                            └──────────────┘                         └─────────────┘
```

## Core Concepts

### 1. Dual Identity
- **As MCP Server**: Exposes standard MCP server interface to local clients
- **As MCPx Client**: Connects to MCPx topics and participates as a client

### 2. Tool Aggregation
The portal aggregates tools from all participants in an MCPx topic and exposes them as local MCP tools:
- Discovers available tools via MCPx presence/capability messages
- Dynamically updates tool list as participants join/leave
- Namespaces tools to avoid conflicts (e.g., `calculator.add`, `documents.read`)

### 3. Request Routing
When a local client calls a tool:
1. Portal receives MCP tool call request
2. Maps tool name to target participant
3. Sends MCPx envelope with MCP request to target
4. Waits for response with correlation ID
5. Returns MCP response to local client

## Implementation Requirements

### MCP Server Interface
The portal MUST implement:
- Tool discovery (`tools/list`)
- Tool execution (`tools/call`)
- Resource discovery (`resources/list`) - if aggregating resources
- Resource templates (`resources/templates/list`) - if applicable
- Prompts (`prompts/list`) - if aggregating prompts

### MCPx Client Behavior
The portal MUST:
- Connect to MCPx gateway via WebSocket
- Join specified topic with authentication
- Handle presence updates and capability discovery
- Send/receive MCPx envelopes
- Manage correlation IDs for request/response matching

### Tool Namespacing
To prevent conflicts when multiple agents expose tools with the same name:
- Option 1: Prefix with participant ID (e.g., `calculator_agent.add`)
- Option 2: Use dot notation (e.g., `calculator.add`)
- Option 3: Make configurable with conflict resolution strategy

## Configuration

```typescript
interface PortalConfig {
  // MCPx connection settings
  mcpx: {
    gateway: string;        // WebSocket URL
    topic: string;          // Topic to join
    participantId: string;  // Portal's identity in topic
    token?: string;         // Authentication token
  };
  
  // MCP server settings
  mcp: {
    transport: 'stdio' | 'sse';  // How local clients connect
    port?: number;                // For SSE transport
  };
  
  // Tool management
  tools: {
    namespacing: 'prefix' | 'dot' | 'none';
    conflictResolution: 'first' | 'last' | 'error';
    filterPattern?: string;  // Regex to filter tools
  };
}
```

## Usage Examples

### 1. Cursor Configuration
```json
{
  "mcpServers": {
    "mcpx-portal": {
      "command": "npx",
      "args": ["@mcpx-protocol/portal", "--topic", "dev-team", "--gateway", "ws://localhost:3000"],
      "env": {
        "MCPX_TOKEN": "your-token"
      }
    }
  }
}
```

### 2. Claude Desktop Configuration
```json
{
  "mcpServers": {
    "mcpx-portal": {
      "command": "mcpx-portal",
      "args": ["--config", "/path/to/portal-config.json"]
    }
  }
}
```

## Security Considerations

1. **Authentication**: Portal should authenticate both with MCPx gateway AND optionally require auth from local clients
2. **Tool Filtering**: Allow configuration to expose only specific tools/participants
3. **Rate Limiting**: Implement rate limiting for tool calls
4. **Audit Logging**: Log all tool calls for security monitoring

## Error Handling

The portal MUST handle:
- MCPx connection failures (reconnect with backoff)
- Participant offline/timeout scenarios
- Tool call failures
- Malformed messages
- Network interruptions

## Performance Considerations

1. **Caching**: Cache tool lists to reduce discovery overhead
2. **Timeouts**: Implement reasonable timeouts for tool calls
3. **Batching**: Support batched tool calls where possible
4. **Connection Pooling**: Efficiently manage WebSocket connections

## Future Enhancements

- **Resource Aggregation**: Expose MCPx topic resources as local MCP resources
- **Prompt Templates**: Aggregate and expose prompt templates from topic
- **Bidirectional Tools**: Allow topic participants to call tools exposed by local client
- **Multi-Topic Support**: Connect to multiple topics simultaneously
- **Tool Composition**: Create composite tools that orchestrate multiple topic tools