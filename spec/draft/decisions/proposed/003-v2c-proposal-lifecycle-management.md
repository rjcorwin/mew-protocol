# ADR-v2c: Proposal Lifecycle Extensions

**Status:** Proposed  
**Date:** 2025-08-30  
**Context:** MEUP Protocol Draft Specification
**Incorporation:** Not Incorporated
**Related ADRs:** 002-0-m3p (Message Kind Namespace Pattern)

## Context

The current MEUP specification (SPEC.md Section 3.2) defines proposals as a way for capability-restricted participants to suggest operations. However, it only defines the basic propose→fulfill pattern without any lifecycle management.

### Current Spec Capabilities
- `mcp.proposal` message kind with method in payload
- Fulfillment via `mcp.request` with `correlation_id` 
- Capability-based access control with payload inspection

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
- Must use existing MEUP envelope structure

## Decision

Implement **Option 5: Progressive Lifecycle** with modifications:
1. **Optional targeting** via envelope's `to` field (already supported)
2. **Withdrawal messages** for proposers to cancel
3. **Rejection for ANY proposal** (not just targeted) to provide quick feedback

### Message Kind Design

Per ADR-m3p, we use minimal `kind` fields with payload inspection. Lifecycle messages use:
- `meup.lifecycle` - For MEUP-specific lifecycle operations

The actual operation (withdraw, reject) is specified in the payload, consistent with the minimal kind pattern.

**Note:** Option 9 presents a viable alternative using dedicated `mcp.withdraw` and `mcp.reject` kinds. This trades consistency with the minimal kind pattern for clearer message intent without payload inspection. The choice between Option 5 and Option 9 depends on whether we prioritize:
- **Option 5**: Consistency with minimal kind pattern (fewer kinds, more payload inspection)
- **Option 9**: Clarity of intent from kind alone (more kinds, less payload inspection)

This provides practical lifecycle management while maintaining protocol simplicity.

## Options Considered

### Option 1: Minimal Fire-and-Forget (Current State)

Keep the current spec as-is with no lifecycle management.

**Messages**: 
- `mcp.proposal` → `mcp.request` (fulfillment)

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
- `mcp.proposal` → `meup.lifecycle` (ack) → `mcp.request` or `meup.lifecycle` (decline)

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
- `mcp.proposal` → `meup.lifecycle` (claim) → `mcp.request` or `meup.lifecycle` (release)

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
- `mcp.proposal` → `meup.lifecycle` (bid) → `meup.lifecycle` (award) → `mcp.request`

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
  "protocol": "meup/v0.1",
  "id": "prop-123",
  "from": "untrusted-agent",
  "to": ["filesystem-agent"],  // Optional targeting
  "kind": "mcp.proposal",
  "payload": {
    "method": "tools/call",
    "params": { ... }
  }
}

// Withdrawal (proposer cancels)
{
  "protocol": "meup/v0.1",
  "id": "withdraw-456",
  "from": "untrusted-agent",
  "correlationId": "prop-123",
  "kind": "meup.lifecycle",
  "payload": {
    "operation": "withdraw",
    "target": "proposal",
    "reason": "No longer needed"
  }
}

// Rejection (only for targeted proposals)
{
  "protocol": "meup/v0.1",
  "id": "reject-789",
  "from": "filesystem-agent",
  "to": ["untrusted-agent"],
  "correlationId": "prop-123",
  "kind": "meup.lifecycle",
  "payload": {
    "operation": "reject",
    "target": "proposal",
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
- `mcp.proposal` → `meup.lifecycle` (prepare) → `meup.lifecycle` (commit/abort)

**Pros**:
- Strong consistency
- Full control

**Cons**:
- Very complex
- Multiple round trips
- Overkill for MEUP goals

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
  "kind": "meup.lifecycle",
  "correlationId": "prop-123",
  "payload": {
    "operation": "status",
    "target": "proposal",
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

### Option 9: Dedicated MCP Lifecycle Kinds

Use specific MCP kinds for lifecycle operations instead of generic `meup.lifecycle`.

**Messages**:
```json
// Proposal with optional targeting
{
  "protocol": "meup/v0.1",
  "id": "prop-123",
  "from": "untrusted-agent",
  "to": ["filesystem-agent"],  // Optional targeting
  "kind": "mcp.proposal",
  "payload": {
    "method": "tools/call",
    "params": { ... }
  }
}

// Withdrawal (proposer cancels)
{
  "protocol": "meup/v0.1",
  "id": "withdraw-456",
  "from": "untrusted-agent",
  "correlationId": "prop-123",
  "kind": "mcp.withdraw",
  "payload": {
    "target": "proposal",  // What we're withdrawing
    "reason": "No longer needed"
  }
}

// Rejection
{
  "protocol": "meup/v0.1",
  "id": "reject-789",
  "from": "filesystem-agent",
  "to": ["untrusted-agent"],
  "correlationId": "prop-123",
  "kind": "mcp.reject",
  "payload": {
    "target": "proposal",  // What we're rejecting
    "reason": "busy"
  }
}
```

**Pros**:
- Clear, specific message types
- Follows MCP namespace for MCP-related operations
- Simple to understand intent from `kind` alone
- No payload inspection needed for basic routing

**Cons**:
- More `kind` values to track
- Less consistent with minimal kind pattern from ADR-m3p
- Could proliferate into many specific kinds (mcp.withdraw, mcp.reject, mcp.status, etc.)

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
| 9. Dedicated Kinds | Low | Good | Yes | Yes (reject) | Alternative to #5 |

## Implementation Requirements

### New Capabilities Required

Using the JSON pattern matching from ADR-q8f:

```yaml
# Can withdraw own proposals
- kind: "meup.lifecycle"
  payload:
    operation: "withdraw"
    target: "proposal"

# Can reject proposals
- kind: "meup.lifecycle"
  payload:
    operation: "reject"
    target: "proposal"
```

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
   - Validates message structure per ADR-m3p
   - Routes based on minimal `kind` field
   - Inspects payload for capability matching per ADR-q8f
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

- MEUP SPEC.md Section 3.2 (Proposals)
- MCP Specification 2025-06-18 (Cancellation patterns)
- Supersedes: ADR-004, ADR-005, ADR-007