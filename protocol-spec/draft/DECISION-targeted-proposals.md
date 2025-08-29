# Decision: Targeted Proposals and Rejection Mechanisms

## Context

In the current MCPx protocol, proposals are broadcast to all participants. There's a need to consider:
1. Allowing proposers to specify intended fulfiller(s)
2. Enabling timely rejection responses to avoid waiting for timeout

## Options

### Option 1: Add Optional `fulfiller` Field to Proposals

**Implementation:**
```json
{
  "kind": "proposal",
  "payload": {
    "method": "tools/call",
    "fulfiller": ["agent-1", "agent-2"],  // Optional: specific participants
    "params": { ... }
  }
}
```

**Pros:**
- Simple extension to existing protocol
- Maintains backward compatibility (field is optional)
- Clear intent signaling
- Multiple participants can be requested

**Cons:**
- No guarantee specified fulfillers will respond
- Other capable participants might be excluded unnecessarily
- No formal rejection mechanism

---

### Option 2: Request/Response Pattern with Accept/Reject

**Implementation:**
```json
// Proposal with response request
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

// Response message
{
  "kind": "proposal-response",
  "payload": {
    "proposal_id": "abc123",
    "status": "accept" | "reject" | "defer",
    "reason": "Optional rejection reason"
  }
}
```

**Pros:**
- Explicit accept/reject mechanism
- Faster failure detection (no waiting for timeout)
- Enables negotiation patterns
- Can track who's considering the proposal

**Cons:**
- Adds protocol complexity
- Requires new message type
- Need to handle multiple responses
- Coordination overhead

---

### Option 3: Capability-Based Routing

**Implementation:**
```json
{
  "kind": "proposal",
  "payload": {
    "method": "tools/call",
    "required_capabilities": ["filesystem", "git"],
    "preferred_participant": "agent-1",  // Hint, not requirement
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

---

### Option 4: Bidding/Auction System

**Implementation:**
```json
// Proposal with bid request
{
  "kind": "proposal",
  "payload": {
    "method": "tools/call",
    "request_bids": true,
    "bid_timeout": 3000,
    "params": { ... }
  }
}

// Bid response
{
  "kind": "bid",
  "payload": {
    "proposal_id": "abc123",
    "confidence": 0.95,
    "estimated_time": 500,
    "capabilities": ["filesystem", "git"]
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

---

### Option 5: Hybrid - Optional Targeting with Timeout Override

**Implementation:**
```json
{
  "kind": "proposal",
  "payload": {
    "method": "tools/call",
    "targeting": {
      "preferred": ["agent-1", "agent-2"],
      "exclusive": false,  // Others can still fulfill
      "quick_reject": true,  // Allow immediate rejection
      "fallback_timeout": 5000  // Wait before others can fulfill
    },
    "params": { ... }
  }
}

// Optional quick rejection
{
  "kind": "proposal-reject",
  "payload": {
    "proposal_id": "abc123",
    "reason": "busy" | "incapable" | "error"
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

---

## Recommendation

**Recommended: Option 5 - Hybrid Approach**

This provides the best balance of:
1. **Flexibility**: Supports both broadcast and targeted patterns
2. **Efficiency**: Quick rejection avoids unnecessary waiting
3. **Compatibility**: All targeting features are optional
4. **Simplicity**: Doesn't require fundamental protocol changes
5. **Progressive**: Can start simple and add features as needed

### Implementation Strategy

1. **Phase 1**: Add optional `preferred` field (Option 1 subset)
   - Minimal change, backward compatible
   - Gather usage data

2. **Phase 2**: Add quick rejection capability
   - Optional `proposal-reject` message type
   - Reduces timeout waiting

3. **Phase 3**: Full targeting configuration
   - Exclusive mode for strict requirements
   - Fallback timeouts for flexibility

### Key Design Principles

1. **Default to Broadcast**: Maintains current behavior
2. **Progressive Enhancement**: Features are optional
3. **Fail Open**: If targeting fails, fall back to broadcast
4. **Semantic Intent**: Express why, not just who
5. **Observability**: All decisions remain visible for learning

---

## Examples

### Simple Preference
```json
{
  "kind": "proposal",
  "payload": {
    "method": "tools/call",
    "preferred": "filesystem-agent",
    "params": { "tool": "write_file" }
  }
}
```

### Exclusive with Fallback
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
    "params": { "tool": "execute_sensitive_operation" }
  }
}
```

### Quick Rejection Flow
```
1. Proposer -> Proposal with quick_reject: true
2. Agent-1 -> Immediate rejection (busy)
3. Agent-2 -> Accepts and fulfills
Total time: ~100ms vs 5000ms timeout
```

---

## Open Questions

1. Should rejection messages be required or optional?
2. How to handle multiple acceptances?
3. Should we track proposal state (pending/accepted/fulfilled)?
4. Do we need capability advertisement mechanism?
5. How does this interact with permission system?

---

## Next Steps

1. Prototype Phase 1 with simple `preferred` field
2. Test with coordinator-agent example
3. Gather feedback on rejection use cases
4. Design capability discovery if needed
5. Implement full targeting in Phase 3