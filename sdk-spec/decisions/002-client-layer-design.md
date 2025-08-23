# ADR-002: Client Layer Design

## Status
Proposed

## Context
The @mcpx/client package needs to handle MCPx protocol mechanics without imposing agent concepts. It should be useful for non-agent use cases like dashboards, bridges, and monitoring tools.

## Decision
Design the client as a thin, stateless protocol layer that:
- Manages WebSocket connections and welcome messages
- Handles envelope wrapping/unwrapping with validation
- Enforces MCPx rules (single recipient for requests)
- Manages MCP handshakes per peer
- Tracks correlation between requests and responses
- Maintains a peer registry with initialization state
- Provides chat notification helpers
- Emits typed events for all message kinds

The client will NOT include:
- Agent lifecycle concepts
- Memory or state management
- Behavior orchestration
- Domain-specific logic beyond protocol requirements

## Consequences

### Positive
- Can be used for any MCPx client (not just agents)
- Small, focused API surface
- Easy to mock for testing
- Protocol changes isolated here

### Negative
- More complexity than originally planned (MCP handshakes)
- Developers still need retry logic if not using agent layer
- Raw protocol exposure may be confusing
- Must track initialization state per peer

## Implementation
```typescript
const client = new MCPxClient({
  gateway: 'ws://localhost:3000',
  token: 'auth-token'
});

// Just protocol operations
await client.connect('room:general');
await client.send({
  to: ['peer-1'],
  kind: 'mcp',
  payload: { /* MCP JSON-RPC */ }
});

client.on('message', (envelope) => {
  // Handle raw envelopes
});
```

## Alternatives Considered
1. **Include basic agent features**: Memory, retry logic
   - Rejected: Violates single responsibility
2. **Multiple transport clients**: WebSocket, HTTP, SSE variants
   - Rejected: Complexity without clear need (v0 focuses on WebSocket)
3. **Built-in MCP parsing**: Parse JSON-RPC in client
   - Rejected: Keep it as passthrough for flexibility