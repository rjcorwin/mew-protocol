# ADR-002: Join Protocol Extension for Space Participation

**Status:** Proposed
**Date:** 2025-01-15
**Context:** MEW Protocol Draft (post v0.3)
**Incorporation:** Not Incorporated

## Context

MEW Protocol v0.3 defines message exchange semantics but does not specify how participants initially join spaces. The protocol assumes participants are already connected and authenticated, leaving the join mechanism as an implementation gap.

Current implementations have created inconsistent join patterns:
- Legacy format: `{"type": "join", "participantId": "...", "space": "...", "token": "..."}`
- MEW-style format: `{"kind": "system/join", "payload": {...}}`

This inconsistency creates protocol compliance issues and interoperability problems between implementations.

## Decision

Extend MEW Protocol with a standardized `system/join` message kind for space participation.

### Join Message Format:
```json
{
  "protocol": "mew/v0.3",
  "id": "join-{uuid}",
  "ts": "{iso8601-timestamp}",
  "from": "{participant-id}",
  "kind": "system/join",
  "payload": {
    "space": "{space-identifier}",
    "participant": "{participant-id}",
    "token": "{authentication-token}",
    "capabilities": ["{requested-capabilities}"]
  }
}
```

### Gateway Response:
Success: `system/welcome` with assigned capabilities
Failure: `system/error` with rejection reason

## Rationale

1. **Protocol Consistency**: All messages follow MEW envelope format
2. **Authentication Integration**: Token-based auth fits MEW security model
3. **Capability Negotiation**: Supports MEW's capability-based access control
4. **Audit Trail**: Standard envelope provides message tracking
5. **Implementation Guidance**: Removes ambiguity for new implementations

## Impact

### Protocol Changes:
- **New Message Kind**: `system/join` joins the `system/*` namespace
- **Authentication Semantics**: Defines token-based participant authentication
- **Response Pattern**: Standardizes `system/welcome` response with capabilities

### Implementation Requirements:
- Gateways MUST handle `system/join` messages
- Gateways MUST respond with `system/welcome` or `system/error`
- Clients MUST use proper MEW envelope format for join requests

### Backward Compatibility:
- Existing v0.3 implementations may continue using implementation-specific join
- New implementations SHOULD adopt standardized format
- Transition period allows dual format support

## Alternatives Considered

### Option 1: Keep Implementation-Specific
**Rejected**: Creates interoperability issues and protocol fragmentation

### Option 2: MCP-Style Handshake
**Rejected**: MEW uses broadcast model, not client-server handshake

### Option 3: HTTP-Only Authentication
**Rejected**: Doesn't align with WebSocket-primary MEW transport model

## Consequences

### Positive:
- **Interoperability**: Standard join mechanism across implementations
- **Protocol Completeness**: Addresses missing authentication semantics
- **Tooling Support**: Protocol analyzers can parse join sequences
- **Security Clarity**: Well-defined authentication flow

### Negative:
- **Breaking Change**: Existing implementations need updates
- **Complexity**: Requires capability negotiation logic
- **Specification Growth**: Adds protocol surface area

### Migration Path:
1. **Phase 1**: Add to draft specification
2. **Phase 2**: Update reference implementations
3. **Phase 3**: Deprecate non-standard formats
4. **Phase 4**: Include in next major protocol version

## Related Decisions

- Links to capability assignment mechanisms
- Relates to authentication and authorization patterns
- Connects to space management semantics

## References

- MEW Protocol v0.3 Specification: Message envelope format
- Implementation analysis: CLI gateway join handling inconsistencies