# ADR-001: Request Cancellation Mechanism

**Status:** Resolved  
**Date:** 2025-08-30  
**Context:** MCPx Protocol Draft Specification

## Context

MCP specification 2025-06-18 already defines cancellation through `notifications/cancelled` messages. MCPx needs to determine how to handle these MCP cancellation messages within its envelope-based routing system.

The MCP cancellation mechanism:
- Uses `notifications/cancelled` with a `requestId` parameter
- Is a fire-and-forget notification (no response expected)
- Can include an optional reason string
- Handles race conditions gracefully

## Decision Drivers

- Alignment with existing MCP specification
- Maintaining protocol compatibility
- Proper routing of cancellation notifications in multi-participant environments
- Correlation ID tracking across the MCPx envelope system

## Considered Options

### Option 1: Direct Pass-Through of MCP Cancellation

Route MCP `notifications/cancelled` messages as-is within MCPx envelopes.

```json
{
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "method": "notifications/cancelled",
    "params": {
      "requestId": "123",
      "reason": "User requested cancellation"
    }
  }
}
```

**Pros:**
- Full MCP compatibility maintained
- No translation needed
- Follows MCP specification exactly
- Simple implementation

**Cons:**
- Requires tracking MCP request IDs at MCPx layer
- May need correlation between MCPx envelope IDs and MCP request IDs

### Option 2: MCPx-Level Cancellation Wrapper

Create an MCPx-specific cancellation kind that wraps the envelope ID.

```json
{
  "kind": "mcpx/cancel",
  "payload": {
    "envelopeId": "original-envelope-id",
    "reason": "User requested cancellation"
  }
}
```

**Pros:**
- Clear separation between MCPx and MCP layers
- Can cancel non-MCP messages
- Simpler correlation tracking

**Cons:**
- Duplicates MCP functionality
- Requires translation between layers
- Not MCP-compliant

### Option 3: Dual-Layer Approach

Support both MCP cancellation for MCP messages and MCPx cancellation for other message types.

**Pros:**
- Maximum flexibility
- MCP compliance for MCP messages
- Can handle all message types

**Cons:**
- Complex implementation
- Two cancellation mechanisms to maintain
- Potential confusion

## Recommendation

**Option 1: Direct Pass-Through of MCP Cancellation**

Since MCPx is designed to extend MCP, we should use MCP's existing cancellation mechanism directly. This maintains full compatibility and avoids reinventing established patterns.

## Implementation Notes

### Cancellation Message Format
```json
{
  "protocol": "mcpx/v0.1",
  "id": "cancel-123",
  "from": "participant-1",
  "to": ["participant-2"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "method": "notifications/cancelled",
    "params": {
      "requestId": "original-mcp-request-id",
      "reason": "User cancelled operation"
    }
  }
}
```

### Progress Support
MCP also defines `notifications/progress` for tracking long-running operations. MCPx should pass these through as well:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "progress-456",
  "from": "participant-2",
  "to": ["participant-1"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "method": "notifications/progress",
    "params": {
      "progressToken": "abc123",
      "progress": 50,
      "total": 100,
      "message": "Processing..."
    }
  }
}
```

### Key Requirements
- MCPx envelopes must preserve MCP request IDs for correlation
- Gateways route cancellation notifications without interpretation
- Participants handle race conditions per MCP specification
- Progress tokens are included in request metadata when progress tracking is desired
- **No cancellation confirmation**: Following MCP specification, cancellations are fire-and-forget notifications with no acknowledgment or confirmation response

## References
- MCP Specification 2025-06-18: Cancellation utility
- MCP Specification 2025-06-18: Progress utility