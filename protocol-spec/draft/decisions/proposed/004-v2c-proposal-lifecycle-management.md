# ADR-v2c: Proposal Lifecycle Extensions

**Status:** Proposed  
**Date:** 2025-08-30  
**Context:** MCPx Protocol Draft Specification
**Incorporation:** Not Incorporated

## Context

The current MCPx specification (SPEC.md Section 3.2) defines proposals as a way for capability-restricted participants to suggest operations. However, it only defines the basic propose→fulfill pattern without any lifecycle management.

### Current Spec Capabilities
- `mcp/proposal:METHOD[:CONTEXT]` message format
- Fulfillment via `mcp/request:METHOD` with `correlation_id` 
- Capability-based access control

### Problems with Current Design
1. **Waiting on dead proposals**: Proposers wait for timeout even when no one will fulfill
2. **No cancellation**: Can't withdraw proposals that are no longer needed
3. **No feedback mechanism**: Targeted participants can't indicate they won't fulfill
4. **Resource waste**: Proposals sit until timeout with no way to clean up

### Requirements for Extensions
- Must maintain fire-and-forget philosophy (like MCP)
- Must preserve stateless gateway design
- Should solve the waiting problem for targeted proposals
- Should allow proposal cancellation
- Must use existing MCPx envelope structure

## Decision

Implement **Option 5: Progressive Lifecycle** with modifications:
1. **Optional targeting** via envelope's `to` field (already supported)
2. **Withdrawal messages** for proposers to cancel
3. **Rejection for ANY proposal** (not just targeted) to provide quick feedback

### Namespace Question: Where do lifecycle messages belong?

**Option A: Under `mcpx.` (current choice)**
- `mcpx.withdraw.proposal` 
- `mcpx.reject.proposal`
- Logic: These are MCPx extensions, not MCP operations

**Option B: Under `mcp.` for consistency**
- `mcp.withdraw.proposal`
- `mcp.reject.proposal`  
- Logic: They operate on MCP proposals, should be in MCP namespace

**Recommendation**: Stay with `mcpx.` to clearly indicate these are protocol extensions not part of core MCP.

Note on namespace pattern: Per ADR-008, we use `PROTOCOL.OPERATION[.METHOD[:CONTEXT]]`

This provides practical lifecycle management while maintaining protocol simplicity.

## Options Considered

### Option 1: Minimal Fire-and-Forget (Current State)

Keep the current spec as-is with no lifecycle management.

**Messages**: 
- `mcp/proposal` → `mcp/request` (fulfillment)

**Pros**:
- Dead simple, already implemented
- No new message types
- Matches MCP philosophy

**Cons**:
- Proposers wait for timeout unnecessarily
- No way to cancel proposals
- No feedback mechanism

---

### Option 2: Acknowledgment-Based

Add acknowledgment messages to indicate consideration.

**Messages**:
- `mcp/proposal` → `mcp/proposal:ack` → `mcp/request` or `mcp/proposal:decline`

**Pros**:
- Proposer knows someone is considering
- Quick feedback on non-fulfillment

**Cons**:
- More complex state machine
- Ack doesn't guarantee fulfillment
- Breaks fire-and-forget pattern

---

### Option 3: Claim-Based (Exclusive)

Add exclusive claiming mechanism.

**Messages**:
- `mcp/proposal` → `mcp/proposal:claim` → `mcp/request` or `mcp/proposal:release`

**Pros**:
- No duplicate work
- Clear ownership

**Cons**:
- Requires coordination/locking
- Single point of failure
- Not truly decentralized

---

### Option 4: Bid-Based Competition

Add bidding mechanism for proposals.

**Messages**:
- `mcp/proposal` → `mcp/proposal:bid` → `mcp/proposal:award` → `mcp/request`

**Pros**:
- Best agent self-selects
- Market-like efficiency

**Cons**:
- Very complex coordination
- Delays start of work
- Overkill for most use cases

---

### Option 5: Progressive Lifecycle (Recommended)

Add minimal lifecycle extensions for practical needs.

**Messages**:
```json
// Proposal with optional targeting
{
  "protocol": "mcpx/v0.1",
  "id": "prop-123",
  "from": "untrusted-agent",
  "to": ["filesystem-agent"],  // Optional targeting
  "kind": "mcp.proposal.tools/call",
  "payload": {
    "method": "tools/call",
    "params": { ... }
  }
}

// Withdrawal (proposer cancels)
{
  "protocol": "mcpx/v0.1",
  "id": "withdraw-456",
  "from": "untrusted-agent",
  "correlationId": "prop-123",
  "kind": "mcpx.withdraw.proposal",
  "payload": {
    "reason": "No longer needed"
  }
}

// Rejection (only for targeted proposals)
{
  "protocol": "mcpx/v0.1",
  "id": "reject-789",
  "from": "filesystem-agent",
  "to": ["untrusted-agent"],
  "correlationId": "prop-123",
  "kind": "mcpx.reject.proposal",
  "payload": {
    "reason": "busy"
  }
}
```

**Pros**:
- Solves waiting problem for targeted case
- Allows cancellation
- Fire-and-forget pattern maintained
- Simple to implement

**Cons**:
- No feedback for broadcast proposals
- No coordination between fulfillers

---

### Option 6: Two-Phase Commit Style

Add two-phase commit pattern.

**Messages**:
- `mcp/proposal` → `mcp/proposal:prepare` → `mcp/proposal:commit` or `mcp/proposal:abort`

**Pros**:
- Strong consistency
- Full control

**Cons**:
- Very complex
- Multiple round trips
- Overkill for MCPx goals

---

### Option 7: TTL-Based Expiration

Add time-to-live to proposals.

**Messages**:
- `mcp.proposal` (with TTL field) → auto-expiration

**Pros**:
- Automatic cleanup
- Simple time-based logic

**Cons**:
- Can't cancel early
- No rejection mechanism
- Requires time sync

---

### Option 8: Lightweight Status Updates (New consideration)

Add optional status messages for transparency.

**Messages**:
```json
// Status update
{
  "kind": "mcpx.status.proposal",
  "correlationId": "prop-123",
  "payload": {
    "status": "considering" | "queued" | "processing" | "unable"
  }
}
```

**Pros**:
- Provides feedback without commitment
- Helps proposers understand delays
- Lightweight and optional

**Cons**:
- More message types
- Not a guarantee of fulfillment
- Could become chatty

---

## Comparison Matrix

| Option | Complexity | Efficiency | Cancellable | Feedback | Recommendation |
|--------|------------|------------|-------------|----------|----------------|
| 1. Minimal | Very Low | Poor | No | None | Current state |
| 2. Ack-Based | Medium | Good | No | Good | Too complex |
| 3. Claim-Based | Medium | Good | Via release | Good | Too coordinated |
| 4. Bid-Based | High | Excellent | Before award | Excellent | Overkill |
| **5. Progressive** | **Low** | **Good** | **Yes** | **Yes (reject)** | **✓ Recommended** |
| 6. Two-Phase | Very High | Good | Yes | Excellent | Way too complex |
| 7. TTL | Low | Fair | No | None | Future addition? |
| 8. Status Updates | Low | Good | No | Good | Consider adding? |

## Implementation Requirements

### New Capabilities Required
- `mcpx.withdraw.proposal` - Can withdraw own proposals
- `mcpx.reject.proposal` - Can reject targeted proposals

### Behavior Rules
1. **Withdrawal**:
   - Only original proposer can withdraw
   - Fire-and-forget (no confirmation)
   - Uses `correlationId` to reference proposal

2. **Rejection** (Updated):
   - Can reject ANY proposal (not just targeted ones)
   - Particularly useful when explicitly targeted
   - Fire-and-forget (no confirmation)
   - Should include reason ("busy", "incapable", "policy", etc.)
   - Helps prevent unnecessary waiting

3. **Gateway**:
   - Validates message structure per ADR-008
   - Routes based on `kind` and capabilities
   - Remains stateless

## Security Considerations

- Only proposer can withdraw their own proposals
- Rejection doesn't grant any execution capability
- Gateway validates message `kind` against capabilities
- No DoS via message spam (fire-and-forget limits impact)

## Future Extensions

- TTL support could be added later if needed
- Capability-based routing (e.g., find agents with specific tools)
- Batch operations (withdraw multiple proposals)

## Migration Impact

These are additive changes:
- Existing proposals continue to work
- New message types are optional
- Backward compatible with current spec

## Open Questions

1. Should system emit notifications when proposals expire?
2. Should rejection be required for targeted proposals?
3. How do orchestrators learn from rejection patterns?

## References

- MCPx SPEC.md Section 3.2 (Proposals)
- MCP Specification 2025-06-18 (Cancellation patterns)
- Supersedes: ADR-004, ADR-005, ADR-007