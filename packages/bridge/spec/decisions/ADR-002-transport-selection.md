# ADR-002: Transport Selection for MCP Server Mode

## Status
Proposed

## Context
When the bridge operates in `mcpx-topic-to-mcp-server` mode, it must act as an MCP server that local clients (Cursor, Claude Desktop, Windsurf, etc.) can connect to. The MCP specification supports multiple transport mechanisms, and we need to decide which to implement and how to prioritize them.

## Decision Drivers
- Compatibility with existing MCP clients
- Implementation complexity
- Performance characteristics
- Developer experience
- Platform compatibility

## Considered Options

### Option 1: stdio Only
Implement only stdio (standard input/output) transport.

**Pros:**
- Simplest implementation
- Universal support across all platforms
- Native support in all MCP clients
- No network configuration needed
- Process isolation provides security

**Cons:**
- Requires client to spawn bridge process
- One process per client connection
- No persistent daemon mode
- Harder to share between multiple clients

### Option 2: SSE (Server-Sent Events) Only
Implement only SSE transport over HTTP.

**Pros:**
- Supports multiple concurrent clients
- Can run as persistent daemon
- Web-friendly protocol
- Easy to debug with browser tools

**Cons:**
- Requires port configuration
- Some MCP clients may not support SSE
- More complex implementation than stdio
- Network security considerations

### Option 3: stdio + SSE (Dual Mode)
Support both transports with runtime selection.

**Pros:**
- Maximum compatibility
- Flexible deployment options
- Users can choose based on needs
- Future-proof design

**Cons:**
- More complex implementation
- More testing surface area
- Configuration complexity
- Maintenance of two code paths

### Option 4: stdio First, SSE Later
Start with stdio, add SSE in a future release.

**Pros:**
- Faster initial delivery
- Learn from stdio implementation
- Defer complexity
- Validate demand for SSE

**Cons:**
- May require refactoring later
- Users might need SSE immediately
- Two migration phases for users

### Option 5: Abstract Transport Layer
Build an abstract transport interface, implement stdio first, make SSE pluggable.

**Pros:**
- Clean architecture
- Easy to add new transports
- Good separation of concerns
- Testable transport layer

**Cons:**
- Over-engineering for initial release
- Additional abstraction complexity
- More initial development time

## Decision

Implement **Option 5 (Abstract Transport Layer)** with **stdio as the first implementation**.

The architecture will:
1. Define a transport interface
2. Implement stdio transport fully
3. Structure code to easily add SSE later
4. Document the transport interface for future additions

## Implementation Details

```typescript
interface Transport {
  start(): Promise<void>;
  stop(): Promise<void>;
  send(message: any): Promise<void>;
  onMessage(handler: (message: any) => void): void;
  onError(handler: (error: Error) => void): void;
  onClose(handler: () => void): void;
}

class StdioTransport implements Transport {
  // Implementation for stdio
}

class SSETransport implements Transport {
  // Future implementation for SSE
}

class BridgeServer {
  constructor(private transport: Transport) {}
  
  async start() {
    await this.transport.start();
    this.transport.onMessage(this.handleMessage.bind(this));
  }
}
```

CLI interface:
```bash
# stdio (default)
mcpx-bridge mcpx-topic-to-mcp-server --transport stdio

# SSE (future)
mcpx-bridge mcpx-topic-to-mcp-server --transport sse --port 3001
```

## Consequences

### Positive
- Clean, extensible architecture
- Quick initial release with stdio
- Foundation for future transport additions
- Good separation of transport and business logic

### Negative
- Slightly more initial complexity than pure stdio
- Need to design interface carefully upfront
- Some refactoring risk if interface proves inadequate

### Neutral
- Documentation needed for transport interface
- Testing strategy must cover transport abstraction

## Migration Path

1. **Phase 1**: Release with stdio transport only
2. **Phase 2**: Add SSE transport based on user feedback
3. **Phase 3**: Consider WebSocket or other transports if needed

## Notes
The abstract transport design also opens possibilities for:
- WebSocket transport (full duplex, better than SSE)
- Named pipe transport (Windows compatibility)
- Unix socket transport (local only, high performance)