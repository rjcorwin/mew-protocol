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

**Implement Option 6: Delegation with MEUP Namespace**

We will use dedicated kinds in the MEUP namespace for capability delegation and space management operations:
- `meup.grant` - Grant capabilities to participants
- `meup.revoke` - Revoke previously granted capabilities
- `meup.grant-ack` - Acknowledge capability grants
- `meup.invite` - Invite new participants to the space
- `meup.kick` - Remove participants from the space

This decision establishes a clear architectural separation:
- **MCP namespace**: Core protocol operations (request, proposal, withdraw, reject)
- **MEUP namespace**: Space management operations (grant, revoke, invite, kick)

Capability delegation is not fundamental to the MCP protocol itself - it's a space management feature that MEUP adds on top of MCP. This layering keeps the MCP protocol focused and allows MEUP to extend it with collaboration features.

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

### Option 5: Delegation with MCP Namespace

Use dedicated kinds in the MCP namespace for delegation.

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
- Consistent with ADR-v2c pattern (mcp.withdraw, mcp.reject)
- Suggests delegation is core to MCP protocol
- Simple routing without payload inspection

**Cons:**
- Mixes MCP operations with MEUP extensions
- MCP namespace getting crowded
- Delegation might not be MCP-specific

### Option 6: Delegation with MEUP Namespace

Use dedicated kinds in the MEUP namespace for delegation.

```json
{
  "kind": "meup.grant",
  "payload": {
    "recipient": "agent",
    "capabilities": [...]
  }
}
```

**Pros:**
- Clear separation: MCP for core protocol, MEUP for space management
- Delegation is MEUP-specific feature
- Leaves MCP namespace clean
- Clear intent from kind alone

**Cons:**
- Inconsistent with mcp.withdraw/reject pattern
- Two namespaces to consider
- More kinds to track

### Option 7: Smart Contracts

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

### Option 8: Proposal-Based Delegation

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

### Option 9: Hybrid Approach

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

| Option | Complexity | Security | Flexibility | Audit | Performance | Namespace |
|--------|------------|----------|-------------|-------|-------------|----------|
| 1. No Delegation | Very Low | High | None | Simple | Fast | N/A |
| 2. Automatic | High | Low | High | Hard | Medium | N/A |
| 3. Admin API | Medium | High | Medium | Good | Slow | External |
| 4. Generic Lifecycle | Medium | Medium | High | Good | Fast | meup |
| 5. MCP Namespace | Low | Medium | Medium | Good | Fast | mcp |
| 6. MEUP Namespace | Low | Medium | Medium | Good | Fast | meup |
| 7. Smart Contracts | Very High | High | Very High | Excellent | Slow | Various |
| 8. Proposal-Based | Low | High | Medium | Excellent | Medium | mcp |
| 9. Hybrid | High | Medium | High | Good | Medium | Mixed |

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

## Implementation Details

### Message Kinds for Space Management

#### Capability Delegation

**Grant Message:**
```json
{
  "kind": "meup.grant",
  "from": "trusted-orchestrator",
  "to": ["untrusted-agent"],
  "payload": {
    "recipient": "untrusted-agent",
    "capabilities": [
      {
        "kind": "mcp.request",
        "payload": {
          "method": "tools/call",
          "params": {
            "name": "read_file"
          }
        }
      }
    ],
    "scope": {
      "duration": "1h",
      "context": "task-123",
      "resources": ["*.md"]
    },
    "reason": "Demonstrated safe file handling"
  }
}
```

**Revoke Message:**
```json
{
  "kind": "meup.revoke",
  "from": "orchestrator",
  "payload": {
    "recipient": "agent",
    "grant_id": "grant-123",
    "reason": "Task completed"
  }
}
```

**Grant Acknowledgment:**
```json
{
  "kind": "meup.grant-ack",
  "from": "agent",
  "correlationId": "grant-msg-456",
  "payload": {
    "grant_id": "grant-123",
    "status": "accepted"
  }
}
```

#### Space Membership Management

**Invite Message:**
```json
{
  "kind": "meup.invite",
  "from": "space-admin",
  "payload": {
    "participant_id": "new-agent",
    "capabilities": [
      {
        "kind": "mcp.proposal"
      },
      {
        "kind": "chat"
      }
    ],
    "role": "contributor",
    "reason": "Joining development team"
  }
}
```

**Kick Message:**
```json
{
  "kind": "meup.kick",
  "from": "space-admin",
  "payload": {
    "participant_id": "misbehaving-agent",
    "reason": "Violating space policies",
    "ban_duration": "24h"  // Optional: temporary ban
  }
}
```

### Capability Requirements

Using JSON pattern matching from ADR-q8f:

```json
// Can grant any capability
{"kind": "meup.grant"}

// Can revoke capabilities
{"kind": "meup.revoke"}

// Can invite participants
{"kind": "meup.invite"}

// Can remove participants
{"kind": "meup.kick"}

// Can acknowledge grants (implicit for all participants)
{"kind": "meup.grant-ack"}
```

### Gateway Behavior

1. **For capability operations (grant/revoke):**
   - Track active grants per participant
   - Validate capability checks include grants
   - Enforce scope restrictions
   - Remove expired grants
   - Audit all changes

2. **For membership operations (invite/kick):**
   - Update participant roster
   - Assign initial capabilities from invite
   - Disconnect kicked participants
   - Enforce ban durations
   - Notify other participants of membership changes

### Security Rules

1. **No Self-Operations**: Can't grant to yourself, can't kick yourself
2. **Delegation Limits**: Can only grant capabilities you possess
3. **Hierarchy Respect**: Can't kick participants with higher privileges
4. **Audit Trail**: All operations must be logged
5. **Revocation Rights**: Grantor can always revoke their grants