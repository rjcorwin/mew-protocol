# ADR-004: Targeted Proposals and Rejection Mechanisms

**Status:** Superseded by ADR-006  
**Date:** 2025-08-30  
**Context:** MCPx Protocol Draft Specification

> **Note**: This ADR has been superseded by ADR-006: Proposal Lifecycle Management, which combines targeting and cancellation into a simpler, more cohesive design.

## Context

In the current MCPx protocol, proposals are broadcast to all participants. This creates inefficiencies when:
- A proposer knows which participant should handle a request
- Participants must wait for timeouts when no one will fulfill a proposal
- Load balancing or specific routing is desired
- Sensitive operations should be limited to trusted participants

There's a need to consider:
1. Allowing proposers to specify intended fulfiller(s)
2. Enabling timely rejection responses to avoid waiting for timeout
3. Maintaining the observable, learning-friendly nature of the protocol

## Decision Drivers

- Need for efficient proposal routing
- Reduction of unnecessary timeout waiting
- Support for both broadcast and targeted patterns
- Backward compatibility with existing implementations
- Maintaining system observability for learning

## Considered Options

### Option 1: Add Optional `fulfiller` Field to Proposals

Simple extension with an optional field specifying intended participants.

```json
{
  "kind": "proposal",
  "payload": {
    "method": "tools/call",
    "fulfiller": ["agent-1", "agent-2"],
    "params": { ... }
  }
}
```

**Pros:**
- Simple extension to existing protocol
- Maintains backward compatibility
- Clear intent signaling
- Multiple participants can be requested

**Cons:**
- No guarantee specified fulfillers will respond
- Other capable participants might be excluded unnecessarily
- No formal rejection mechanism
- Still requires timeout waiting

### Option 2: Request/Response Pattern with Accept/Reject

Formal request/response mechanism with explicit accept/reject messages.

```json
{
  "kind": "proposal",
  "payload": {
    "method": "tools/call",
    "request_response": true,
    "response_timeout": 5000,
    "preferred_fulfillers": ["agent-1"],
    "params": { ... }
  }
}
```

**Pros:**
- Explicit accept/reject mechanism
- Faster failure detection
- Enables negotiation patterns
- Can track who's considering the proposal

**Cons:**
- Adds significant protocol complexity
- Requires new message types
- Need to handle multiple responses
- Coordination overhead

### Option 3: Capability-Based Routing

Route based on required capabilities rather than specific participants.

```json
{
  "kind": "proposal",
  "payload": {
    "method": "tools/call",
    "required_capabilities": ["filesystem", "git"],
    "preferred_participant": "agent-1",
    "params": { ... }
  }
}
```

**Pros:**
- Semantic targeting based on capabilities
- Fallback to any capable participant
- Self-organizing system
- Maintains simplicity

**Cons:**
- Requires capability discovery mechanism
- Preferred participant is just a hint
- No rejection mechanism
- May not match proposer's intent

### Option 4: Bidding/Auction System

Market-like system where participants bid on proposals.

```json
{
  "kind": "proposal",
  "payload": {
    "method": "tools/call",
    "request_bids": true,
    "bid_timeout": 3000,
    "params": { ... }
  }
}
```

**Pros:**
- Market-like efficiency
- Best participant self-selects
- Provides metadata for decision making
- Enables load balancing

**Cons:**
- Most complex option
- Overhead for simple operations
- Requires bid evaluation logic
- May create competitive dynamics

### Option 5: Hybrid - Optional Targeting with Timeout Override

Flexible system supporting both broadcast and targeted patterns with optional quick rejection.

```json
{
  "kind": "proposal",
  "payload": {
    "method": "tools/call",
    "targeting": {
      "preferred": ["agent-1", "agent-2"],
      "exclusive": false,
      "quick_reject": true,
      "fallback_timeout": 5000
    },
    "params": { ... }
  }
}
```

**Pros:**
- Flexible targeting options
- Maintains broadcast nature
- Optional rejection for efficiency
- Graceful fallback behavior
- Progressive enhancement

**Cons:**
- More complex targeting configuration
- Needs careful timeout coordination
- Mixed paradigms (broadcast + targeting)

## Recommendation

**Option 5: Hybrid - Optional Targeting with Timeout Override**

This provides the best balance of flexibility, efficiency, and compatibility. It allows progressive enhancement from simple broadcast to sophisticated targeting while maintaining backward compatibility.

## Implementation Notes

### Phase 1: Simple Preference Field
Add optional `preferred` field to proposals:
```json
{
  "kind": "proposal",
  "payload": {
    "method": "tools/call",
    "preferred": "filesystem-agent",
    "params": { ... }
  }
}
```

### Phase 2: Quick Rejection Capability
Add optional rejection message:
```json
{
  "kind": "proposal-reject",
  "payload": {
    "proposal_id": "abc123",
    "reason": "busy" | "incapable" | "error"
  }
}
```

### Phase 3: Full Targeting Configuration
Complete targeting system with exclusive mode and fallback:
```json
{
  "kind": "proposal",
  "payload": {
    "method": "tools/call",
    "targeting": {
      "preferred": ["trusted-agent"],
      "exclusive": true,
      "exclusive_timeout": 3000,
      "fallback_to_broadcast": true
    },
    "params": { ... }
  }
}
```

## Example Flows

### Simple Preference
```
1. Proposer broadcasts proposal with preferred: "agent-1"
2. Agent-1 sees preference and prioritizes response
3. Other agents may still respond if agent-1 doesn't
```

### Quick Rejection
```
1. Proposer sends proposal with quick_reject: true
2. Agent-1 immediately rejects (busy)
3. Agent-2 accepts and fulfills
Total time: ~100ms vs 5000ms timeout
```

### Exclusive with Fallback
```
1. Proposer sends exclusive proposal to trusted-agent
2. Wait 3 seconds for response
3. If no response, fallback to broadcast
4. Any agent can now fulfill
```

## Design Principles

1. **Default to Broadcast**: Maintains current behavior without configuration
2. **Progressive Enhancement**: All features are optional
3. **Fail Open**: If targeting fails, fall back to broadcast
4. **Semantic Intent**: Express why, not just who
5. **Observability**: All decisions remain visible for learning

## Security Considerations

- Exclusive mode should not bypass permission checks
- Rejection messages should not leak sensitive information
- Targeting preferences are hints, not access control
- Gateway still enforces capability-based permissions

## Open Questions

1. Should rejection messages be required when quick_reject is enabled?
2. How to handle multiple simultaneous acceptances?
3. Should proposal state be tracked (pending/accepted/fulfilled)?
4. Is capability advertisement needed as part of peer-joined?
5. How does targeting interact with untrusted proposal routing?