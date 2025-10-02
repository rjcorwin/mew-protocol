# ADR-005: Proposal Cancellation Mechanism

**Status:** Superseded by ADR-006  
**Date:** 2025-08-30  
**Context:** MCPx Protocol Draft Specification

> **Note**: This ADR has been superseded by ADR-006: Proposal Lifecycle Management, which combines targeting and cancellation into a simpler, more cohesive design.

## Decision

We will implement **Option 1: Proposal Withdrawal Message** as the primary cancellation mechanism. This provides a simple, explicit way to withdraw proposals that follows the fire-and-forget pattern established by MCP's cancellation mechanism. No confirmation is sent for withdrawals, maintaining consistency with MCP patterns.

## Context

Proposals in MCPx are suggestions from untrusted participants for operations that trusted participants can review and execute. Unlike MCP requests which have defined cancellation via `notifications/cancelled`, proposals are MCPx-specific constructs that need their own cancellation mechanism.

Current challenges:
- Proposers may want to withdraw proposals before they're fulfilled
- Proposals may become irrelevant due to changing context
- No way to indicate a proposal is no longer needed
- Fulfillment attempts on cancelled proposals waste resources

## Decision Drivers

- Need to withdraw proposals that are no longer relevant
- Prevent unnecessary fulfillment attempts
- Maintain audit trail of proposal lifecycle
- Keep consistency with MCP cancellation patterns where applicable
- Support both manual and automatic cancellation scenarios

## Considered Options

### Option 1: Proposal Withdrawal Message

Introduce a dedicated message kind for withdrawing proposals.

```json
{
  "kind": "proposal/withdraw",
  "payload": {
    "proposalId": "original-proposal-id",
    "reason": "No longer needed"
  }
}
```

**Pros:**
- Clear and explicit intent
- Simple to implement
- Maintains proposal audit trail
- Can include reason for documentation

**Cons:**
- Adds new message kind to protocol
- Requires proposal ID tracking
- May arrive after fulfillment starts

### Option 2: Proposal with TTL (Time-To-Live)

Add optional TTL field to proposals that auto-expires them.

```json
{
  "kind": "proposal",
  "payload": {
    "method": "tools/call",
    "ttl": 30000,  // Expires after 30 seconds
    "params": { ... }
  }
}
```

**Pros:**
- Automatic cleanup
- No additional messages needed
- Predictable behavior
- Useful for time-sensitive operations

**Cons:**
- Not true cancellation (can't withdraw early)
- Requires time synchronization
- Fixed duration may not fit all scenarios
- No explicit withdrawal record

### Option 3: Proposal Status Updates

Implement a status system where proposers can update proposal state.

```json
{
  "kind": "proposal/status",
  "payload": {
    "proposalId": "original-proposal-id",
    "status": "withdrawn" | "expired" | "pending",
    "reason": "Context changed"
  }
}
```

**Pros:**
- Flexible status management
- Can handle multiple states
- Extensible for future needs
- Clear lifecycle tracking

**Cons:**
- More complex state machine
- Requires status synchronization
- May conflict with fulfillment status

### Option 4: Reuse MCP Cancellation Pattern

Treat proposals like requests and use MCP's cancellation pattern.

```json
{
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "method": "notifications/cancelled",
    "params": {
      "requestId": "proposal-id",
      "reason": "Proposal withdrawn"
    }
  }
}
```

**Pros:**
- Consistent with MCP patterns
- No new message types
- Familiar to MCP implementers
- Reuses existing infrastructure

**Cons:**
- Proposals aren't MCP requests
- Semantic mismatch
- May confuse MCP and MCPx layers
- Could break MCP compliance

### Option 5: Hybrid Approach with TTL and Withdrawal

Combine TTL for automatic expiry with explicit withdrawal capability.

```json
// Proposal with optional TTL
{
  "kind": "proposal",
  "payload": {
    "method": "tools/call",
    "ttl": 60000,  // Optional auto-expiry
    "params": { ... }
  }
}

// Explicit withdrawal (before TTL)
{
  "kind": "proposal/withdraw",
  "payload": {
    "proposalId": "proposal-123",
    "reason": "User cancelled"
  }
}
```

**Pros:**
- Maximum flexibility
- Handles both automatic and manual cases
- Clear semantics
- Progressive enhancement

**Cons:**
- Two mechanisms to implement
- Slightly more complex
- Need to handle interaction between TTL and withdrawal

## Recommendation

**Option 1: Proposal Withdrawal Message**

This approach is chosen for its simplicity and consistency with MCP's cancellation patterns. It provides clear, explicit withdrawal semantics without adding unnecessary complexity. TTL functionality can be added in a future iteration if needed, but starting simple allows us to validate the core pattern first.

## Implementation Notes

### Withdrawal Message Format
```json
{
  "protocol": "mcpx/v0.1",
  "id": "withdraw-456",
  "from": "untrusted-agent",
  "kind": "proposal/withdraw",
  "payload": {
    "proposalId": "prop-123",
    "reason": "Operation no longer needed"
  }
}
```

## Behavior Requirements

1. **Withdrawal Handling**:
   - Only the original proposer can withdraw their proposal
   - Withdrawal is immediate and irreversible
   - No confirmation is sent (fire-and-forget, like MCP cancellation)
   - Gateway may emit system notification for observability

2. **Race Conditions**:
   - Fulfillment may start before withdrawal arrives
   - Withdrawals after fulfillment are ignored
   - Participants should handle gracefully
   - No error is sent for late withdrawals

3. **State Tracking**:
   - Proposals can be: pending, withdrawn, or fulfilled
   - State transitions are one-way
   - History is maintained for audit
   - Withdrawn proposals remain visible (marked as withdrawn)

## Security Considerations

- Only proposal originator can withdraw their own proposals
- Withdrawal reasons should not leak sensitive information
- Gateway validates withdrawal authorization
- No denial-of-service via withdrawal spam (fire-and-forget pattern)

## Future Extensions

- TTL support for automatic expiry (if needed)
- Batch withdrawal for multiple proposals
- Proposal dependencies and cascading cancellation
- Proposal renewal mechanism

## Open Questions

1. Should we add TTL support in a future version?
2. How should proposal withdrawal interact with the targeted proposals feature (ADR-004)?
3. Should system emit notifications when proposals are withdrawn?
4. Should there be rate limiting on withdrawal messages?