# ADR-g7r: Capability Delegation

**Status:** Proposed  
**Date:** 2025-08-31  
**Context:** MEUP Protocol Draft Specification
**Incorporation:** Not Incorporated

## Context

Currently, capabilities in MEUP are statically assigned when participants join a space. However, during collaboration, situations arise where a participant fulfilling proposals wants to grant temporary or scoped capabilities to the proposing participant. This enables progressive trust without requiring administrative intervention.

### Current Limitations
- Capabilities are fixed at join time
- No way to grant capabilities dynamically
- Proposals must continue indefinitely even for trusted operations
- No mechanism for temporary elevation of privileges
- Administrative burden for capability changes

### Use Cases
1. **Progressive Trust**: After successfully fulfilling many proposals, grant direct execution rights
2. **Temporary Elevation**: Grant capabilities for a specific task/duration
3. **Scoped Permissions**: Grant capabilities limited to specific resources
4. **Delegation Chain**: Allow trusted participants to sub-delegate capabilities

### Requirements
- Must maintain security boundaries
- Should support revocation
- Must be auditable
- Should integrate with existing capability system
- Must prevent privilege escalation attacks

## Decision

**To be determined** - Evaluating options for dynamic capability delegation in MEUP spaces.

## Options Considered

### Option 1: No Delegation (Status Quo)

Capabilities remain static, set only at join time.

**Pros:**
- Simple security model
- No privilege escalation risks
- Easy to audit

**Cons:**
- No progressive trust
- Administrative overhead
- Inefficient proposal patterns continue

### Option 2: Automatic Promotion

System automatically grants capabilities based on behavior patterns.

**Pros:**
- No manual intervention
- Progressive trust emerges naturally
- Reduces proposal overhead over time

**Cons:**
- Complex to implement
- Security risks from automated elevation
- Hard to predict or control
- Difficult to audit

### Option 3: Administrative API

External admin API for capability changes.

**Pros:**
- Clear separation of concerns
- Centralized control
- Full audit trail

**Cons:**
- Requires external intervention
- Breaks space autonomy
- Slower response times
- Additional infrastructure

### Option 4: Delegation Messages with Generic Lifecycle Kind

Use a generic `meup.lifecycle` kind with operation field in payload.

```json
{
  "kind": "meup.lifecycle",
  "payload": {
    "operation": "grant",
    "recipient": "agent",
    "capabilities": [...]
  }
}
```

**Pros:**
- In-band capability management
- Immediate effect
- Full audit trail in space
- Supports automation
- Enables delegation chains

**Cons:**
- More complex security model
- Risk of privilege escalation
- Need careful permission design

### Option 5: Delegation Messages with Dedicated Kinds

Use dedicated MCP kinds for each delegation operation.

```json
{
  "kind": "mcp.grant",
  "payload": {
    "recipient": "agent",
    "capabilities": [...]
  }
}
```

**Pros:**
- Clear intent from kind alone
- Consistent with ADR-v2c pattern
- Simple routing without payload inspection
- Explicit capability requirements

**Cons:**
- More kinds to track
- Less flexible for future operations
- Proliferation of kinds

### Option 6: Smart Contracts

Capability changes through programmable rules.

**Pros:**
- Flexible logic
- Automated enforcement
- Transparent rules

**Cons:**
- Very complex
- Requires contract runtime
- Hard to debug
- Over-engineered for most uses

## Implementation Details

*To be determined based on selected option*

### Option 7: Proposal-Based Delegation

Instead of direct grants, use proposals for capability requests.

```json
// Agent proposes to get capability
{
  "kind": "mcp.proposal",
  "payload": {
    "method": "capability/request",
    "params": {
      "capabilities": [...],
      "justification": "..."
    }
  }
}

// Admin fulfills by granting
{
  "kind": "mcp.request",
  "correlationId": "proposal-123",
  "payload": {
    "method": "capability/grant",
    "params": {...}
  }
}
```

**Pros:**
- Uses existing proposal pattern
- No new top-level mechanisms
- Natural audit trail

**Cons:**
- Indirect and slower
- Requires proposal capability
- Less intuitive

### Option 8: Hybrid Approach

Combine static base capabilities with dynamic adjustments.

**Pros:**
- Best of both worlds
- Gradual migration path
- Fallback to static model

**Cons:**
- Two systems to manage
- Potential confusion
- Complex capability resolution

## Comparison Matrix

| Option | Complexity | Security | Flexibility | Audit | Performance |
|--------|------------|----------|-------------|-------|-------------|
| 1. No Delegation | Very Low | High | None | Simple | Fast |
| 2. Automatic | High | Low | High | Hard | Medium |
| 3. Admin API | Medium | High | Medium | Good | Slow |
| 4. Generic Lifecycle | Medium | Medium | High | Good | Fast |
| 5. Dedicated Kinds | Low | Medium | Medium | Good | Fast |
| 6. Smart Contracts | Very High | High | Very High | Excellent | Slow |
| 7. Proposal-Based | Low | High | Medium | Excellent | Medium |
| 8. Hybrid | High | Medium | High | Good | Medium |

## Consequences

### Positive
- **Progressive Trust**: Capabilities can grow based on behavior
- **Reduced Proposals**: Trusted operations become direct
- **Flexible Security**: Fine-grained, scoped permissions
- **Autonomy**: Spaces self-manage without external admin
- **Audit Trail**: All changes tracked in space messages
- **Automation**: Orchestrators can implement trust policies

### Negative
- **Complexity**: More complex security model
- **Attack Surface**: Potential for privilege escalation
- **State Management**: Gateway must track grants
- **Revocation Challenges**: Ensuring revocation is honored
- **Audit Overhead**: More messages to track and analyze

## Security Considerations

- **Privilege Escalation**: Carefully limit delegation capabilities
- **Grant Flooding**: Rate limit grant messages
- **Scope Bypass**: Validate all scope restrictions
- **Delegation Chains**: Limit depth to prevent abuse
- **Revocation Timing**: Ensure immediate revocation
- **Audit Requirements**: All grants must be logged
- **Token Leakage**: Granted capabilities shouldn't be transferable

## Migration Path

1. Initial implementation without delegation (current state)
2. Add grant/revoke messages as experimental
3. Implement basic duration and usage scopes
4. Add resource and context scopes
5. Enable sub-delegation with controls
6. Deprecate unlimited static capabilities

## Future Enhancements

- Delegation templates for common patterns
- Machine learning for trust scoring
- Automatic revocation on anomaly detection
- Capability marketplace for space templates
- Federation of trust across spaces
- Zero-trust progressive capability systems