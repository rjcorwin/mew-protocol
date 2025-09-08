# ADR-MBR: MCP Bridge Architecture

**Status:** Proposed  
**Date:** 2025-01-08  
**Incorporation:** Not Incorporated

## Context

We need to integrate existing MCP (Model Context Protocol) servers into MEUP spaces. MCP servers communicate via JSON-RPC over stdio or SSE, while MEUP uses a message-oriented protocol over WebSocket. 

Key constraints:
- Must not require modification of existing MCP servers
- Should be easy to configure in space.yaml
- Must handle process lifecycle management
- Should translate capabilities automatically
- Need to maintain protocol semantics in both directions

## Options Considered

### Option 1: Direct Integration in Gateway

Modify the gateway to support MCP protocol directly.

**Pros:**
- Single process, potentially more efficient
- Direct control over MCP communication
- No intermediate translation layer

**Cons:**
- Pollutes gateway with protocol-specific logic
- Harder to maintain separation of concerns
- Would need stdio handling in gateway
- Couples MEUP and MCP too tightly

### Option 2: Separate Bridge Process

Create a dedicated bridge process that translates between protocols.

**Pros:**
- Clean separation of concerns
- Bridge can be developed/tested independently
- Follows Unix philosophy (do one thing well)
- Easy to add more bridge types later
- Can be reused for other protocol bridges

**Cons:**
- Additional process overhead
- More complex process management
- Extra hop for messages

### Option 3: Library Integration

Provide a library that MCP servers can use to speak MEUP directly.

**Pros:**
- Most efficient communication
- No translation overhead

**Cons:**
- Requires modifying every MCP server
- Goes against goal of using existing MCP servers
- Much higher adoption barrier

## Decision

**Selected: Option 2 - Separate Bridge Process**

The bridge process architecture provides the best balance of:
- Clean architectural boundaries
- Zero modification to existing MCP servers
- Flexibility for future enhancements
- Testability and maintainability

### Implementation Details

1. **Bridge as Participant**: The bridge appears as a normal MEUP participant
2. **Subprocess Management**: Bridge spawns and manages MCP server subprocess
3. **Stdio Communication**: Bridge communicates with MCP server via stdin/stdout
4. **WebSocket to Gateway**: Bridge connects to MEUP gateway via WebSocket
5. **PM2 Integration**: CLI manages bridge process via PM2

Configuration in space.yaml:
```yaml
participants:
  my-mcp-server:
    type: mcp-bridge
    mcp_server:
      command: "node"
      args: ["./mcp-server.js"]
    auto_start: true
```

## Consequences

### Positive
- Existing MCP servers work without modification
- Clean architectural separation
- Easy to configure and use
- Bridge can add value (logging, monitoring, rate limiting)
- Can support multiple MCP servers in one space
- Bridge can be updated independently

### Negative
- Additional process overhead (bridge + MCP server)
- Slightly more complex debugging (two processes)
- Small latency added by translation layer
- More moving parts in the system