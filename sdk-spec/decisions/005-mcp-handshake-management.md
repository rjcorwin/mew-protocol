# ADR-005: MCP Handshake Management

## Status
Proposed

## Context
The MCPx v0 specification requires that before sending MCP requests to a participant, the caller MUST perform the MCP initialization flow:
1. Send `initialize` request
2. Receive `initialize` response
3. Send `notifications/initialized` notification

This handshake establishes capability negotiation and protocol version agreement. The SDK needs to handle this transparently while avoiding redundant handshakes.

## Decision
Implement automatic MCP handshake management in the client layer:
- Track initialization state per peer
- Queue tool requests until handshake completes
- Perform handshake lazily on first tool call
- Cache capabilities from handshake response
- Handle concurrent handshake requests (deduplication)

The agent layer will trigger handshakes automatically when calling tools, making it transparent to agent developers.

## Consequences

### Positive
- Developers don't need to manually manage handshakes
- Prevents protocol violations (calling tools before init)
- Efficient - only handshake with peers we interact with
- Capability information cached for tool discovery

### Negative
- Adds state to the "stateless" client (initialization tracking)
- Potential delays on first tool call (handshake latency)
- Complex edge cases (peer disconnect during handshake)
- Memory overhead for tracking all peer states

## Implementation
```typescript
// In MCPxClient
private peerStates = new Map<string, PeerState>();

async callTool(peerId: string, tool: string, params: any) {
  // Ensure handshake is complete
  await this.ensureInitialized(peerId);
  
  // Now safe to call tool
  return this.request(peerId, 'tools/call', { name: tool, arguments: params });
}

private async ensureInitialized(peerId: string) {
  const state = this.peerStates.get(peerId);
  
  if (state?.initialized) return;
  if (state?.initializing) return state.initPromise;
  
  // Start handshake
  const initPromise = this.performHandshake(peerId);
  this.peerStates.set(peerId, { initializing: true, initPromise });
  
  await initPromise;
  this.peerStates.set(peerId, { initialized: true });
}
```

## Alternatives Considered

1. **Eager initialization**: Handshake with all peers on join
   - Rejected: Wasteful for peers we never interact with
   
2. **Manual initialization**: Require developers to call `initializePeer()`
   - Rejected: Error-prone, violates principle of least surprise
   
3. **Server-side handshake**: Gateway manages handshakes
   - Rejected: Violates MCPx principle of peer-to-peer MCP

## References
- MCPx v0 Specification, Section 4.1 (Handshake over topics)
- MCP Specification 2025-06-18 (initialization flow)