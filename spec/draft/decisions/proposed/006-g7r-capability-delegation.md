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

**Implement capability delegation through grant/revoke messages**

Participants with delegation rights can grant scoped capabilities to other participants. Grants are explicit, auditable, and revocable.

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

### Option 4: Delegation Messages (Recommended)

Participants can grant capabilities through protocol messages.

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

### Option 5: Smart Contracts

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

### New Capability for Delegation

```yaml
# Capability to grant capabilities
capabilities:
  - "meup/delegate:*"  # Can delegate any capability
  - "meup/delegate:meup/request:*"  # Can only delegate request capabilities
  - "meup/delegate:meup/proposal:*"  # Can only delegate proposal capabilities
```

### Grant Message

```json
{
  "kind": "meup/grant",
  "from": "trusted-orchestrator",
  "to": ["untrusted-agent"],
  "payload": {
    "recipient": "untrusted-agent",
    "capabilities": [
      "meup/request:tools/read_file",
      "meup/request:tools/list"
    ],
    "scope": {
      "duration": "1h",  // Optional: Time-based expiry
      "usage_count": 100,  // Optional: Number of uses
      "context": "reason-789",  // Optional: Limited to context
      "resources": ["*.txt", "*.md"],  // Optional: Resource patterns
      "until_event": "task_complete"  // Optional: Event-based expiry
    },
    "reason": "Demonstrated safe file handling over 50 proposals"
  }
}
```

### Revoke Message

```json
{
  "kind": "meup/revoke",
  "from": "trusted-orchestrator",
  "to": ["untrusted-agent"],
  "payload": {
    "recipient": "untrusted-agent",
    "grant_id": "grant-123",  // Revoke specific grant
    "capabilities": ["meup/request:tools/write_file"],  // Or specific capabilities
    "reason": "Task completed"
  }
}
```

### Grant Acknowledgment

```json
{
  "kind": "meup/grant-ack",
  "from": "untrusted-agent",
  "correlation_id": "grant-msg-456",
  "payload": {
    "grant_id": "grant-123",
    "status": "accepted",
    "effective_capabilities": [
      "meup/request:tools/read_file",
      "meup/request:tools/list"
    ]
  }
}
```

### Capability Resolution

When checking capabilities:
1. Start with base capabilities from space configuration
2. Add granted capabilities that are still valid
3. Remove revoked capabilities
4. Apply scope restrictions (context, resources, etc.)

### Delegation Chain Example

```json
// Admin delegates to orchestrator
{
  "kind": "meup/grant",
  "from": "admin",
  "payload": {
    "recipient": "orchestrator",
    "capabilities": ["meup/delegate:meup/request:*"],
    "scope": {"allow_sub_delegation": true}
  }
}

// Orchestrator sub-delegates to agent
{
  "kind": "meup/grant",
  "from": "orchestrator",
  "payload": {
    "recipient": "agent",
    "capabilities": ["meup/request:tools/read_file"],
    "scope": {"allow_sub_delegation": false}  // Cannot delegate further
  }
}
```

### Gateway Behavior

The gateway:
- Tracks active grants per participant
- Validates capability checks include grants
- Enforces scope restrictions
- Removes expired grants
- Broadcasts grant/revoke messages for audit

### Scope Types

#### Duration-Based
```json
"scope": {
  "duration": "30m",  // ISO 8601 duration
  "expires_at": "2025-09-01T12:00:00Z"  // Absolute time
}
```

#### Usage-Based
```json
"scope": {
  "usage_count": 10,  // Number of times capability can be used
  "usage_tracking": "per_capability"  // or "total"
}
```

#### Context-Based
```json
"scope": {
  "context": "task-abc",  // Only within this context
  "context_pattern": "task-*"  // Pattern matching
}
```

#### Resource-Based
```json
"scope": {
  "resources": [
    "/tmp/*.txt",  // File patterns
    "table:users:read",  // Database access
    "api.example.com/public/*"  // API endpoints
  ]
}
```

### Security Rules

1. **No Self-Granting**: Participants cannot grant capabilities to themselves
2. **Delegation Limits**: Can only grant capabilities you possess
3. **Sub-Delegation Control**: Grants can prohibit further delegation
4. **Audit Required**: All grants/revokes must be logged
5. **Revocation Rights**: Grantor can always revoke their grants

### Example Workflow

```json
// 1. Agent has been making proposals
{
  "kind": "meup/proposal:tools/read_file",
  "from": "new-agent",
  "payload": {...}
}

// 2. Orchestrator recognizes pattern of safe usage
// Decides to grant temporary direct access
{
  "kind": "meup/grant",
  "from": "orchestrator",
  "payload": {
    "recipient": "new-agent",
    "capabilities": ["meup/request:tools/read_file"],
    "scope": {
      "duration": "1h",
      "resources": ["/project/docs/*.md"]
    },
    "reason": "20 successful file reads via proposals"
  }
}

// 3. Agent acknowledges grant
{
  "kind": "meup/grant-ack",
  "from": "new-agent",
  "payload": {
    "grant_id": "grant-789",
    "status": "accepted"
  }
}

// 4. Agent can now directly request (no proposal needed)
{
  "kind": "meup/request:tools/read_file",
  "from": "new-agent",
  "payload": {
    "path": "/project/docs/README.md"
  }
}

// 5. After 1 hour, capability automatically expires
// Or orchestrator can explicitly revoke
{
  "kind": "meup/revoke",
  "from": "orchestrator",
  "payload": {
    "recipient": "new-agent",
    "grant_id": "grant-789",
    "reason": "Session ended"
  }
}
```

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