# ADR-005: Join Message Protocol Inconsistency Resolution

## Status
Proposed

## Context

The current implementation has a significant inconsistency in how participants join spaces. The MEW Protocol v0.4 specification does not define a join mechanism, leaving it as an implementation detail. However, the CLI implementation uses **two different join message formats** inconsistently across different components.

### Current Implementation Issues:

#### Format 1 - Legacy Gateway Format (`type: 'join'`):
```javascript
// Used in client.js and agent.js
{
  type: 'join',                    // NOT MEW v0.4 compliant
  participantId: 'participant-id',
  space: 'space-name',
  token: 'auth-token'
}
```

#### Format 2 - MEW-Style Format (`kind: 'system/join'`):
```javascript
// Used in space.js for interactive connections
{
  protocol: 'mew/v0.4',           // MEW v0.4 compliant envelope
  id: 'join-12345',
  ts: '2025-01-10T12:00:00Z',
  kind: 'system/join',
  payload: {
    space: 'space-name',
    participant: 'participant-id',
    token: 'auth-token',
    capabilities: [...]
  }
}
```

### Gateway Handling Inconsistency:
```javascript
// Gateway currently accepts BOTH formats
if (message.kind === 'system/join' || message.type === 'join') {
  // Handle both legacy and MEW-compliant formats
}
```

This creates confusion, maintenance burden, and protocol compliance issues.

## Decision

We will **standardize on the MEW v0.4 compliant `system/join` envelope format** and deprecate the legacy `type: 'join'` format.

### Standard Join Message Format:
```javascript
{
  protocol: 'mew/v0.4',
  id: `join-${uuidv4()}`,
  ts: new Date().toISOString(),
  from: participantId,              // NEW: sender identification
  kind: 'system/join',
  payload: {
    space: spaceId,
    participant: participantId,     // Redundant with 'from' but kept for clarity
    token: authToken,
    capabilities?: Capability[]     // Optional: requested capabilities
  }
}
```

### Rationale for MEW Compliance:
1. **Protocol Consistency**: All messages follow MEW v0.4 envelope format
2. **Future Compatibility**: Aligns with protocol evolution
3. **Tooling Compatibility**: Works with MEW protocol analyzers
4. **Audit Trail**: Standard envelope provides tracking fields (`id`, `ts`, `from`)

## Implementation Plan

### Phase 1: Gateway Support (Backward Compatibility)
```javascript
// Gateway continues accepting both formats during transition
if (message.kind === 'system/join') {
  // Standard MEW v0.4 format (preferred)
  handleMEWJoin(message);
} else if (message.type === 'join') {
  // Legacy format (deprecated, with warning)
  console.warn('Deprecated join format used. Please upgrade to system/join');
  handleLegacyJoin(message);
} else {
  // Invalid join format
  sendError('Invalid join message format');
}
```

### Phase 2: Client Migration
Update all clients to use MEW-compliant format:

#### client.js Update:
```javascript
// BEFORE (legacy)
ws.send(JSON.stringify({
  type: 'join',
  participantId,
  space: options.space,
  token: options.token,
}));

// AFTER (MEW v0.4 compliant)  
const joinMessage = {
  protocol: 'mew/v0.4',
  id: `join-${Date.now()}`,
  ts: new Date().toISOString(),
  from: participantId,
  kind: 'system/join',
  payload: {
    space: options.space,
    participant: participantId,
    token: options.token
  }
};
ws.send(JSON.stringify(joinMessage));
```

#### agent.js Update:
```javascript
// Similar transformation from type: 'join' to kind: 'system/join'
```

### Phase 3: Gateway Cleanup
Remove legacy format support after transition period:
```javascript
// Only accept MEW v0.4 compliant format
if (message.kind === 'system/join') {
  handleJoin(message);
} else {
  sendError('Invalid join message. Use kind: "system/join"');
}
```

## Protocol Extension Consideration

Since MEW Protocol v0.4 does not define join semantics, this is effectively a **protocol extension** that should be documented.

### Proposed MEW Protocol Extension:
```
Message Kind: system/join
Purpose: Participant joins a space
Direction: Client → Gateway
Response: system/welcome

Payload Schema:
{
  space: string,          // Space identifier to join
  participant: string,    // Participant identifier  
  token?: string,         // Authentication token
  capabilities?: Array    // Requested capabilities (optional)
}

Gateway Response:
- Success: system/welcome message
- Failure: system/error message
```

## Security Implications

### Token Handling:
```javascript
// Consistent token extraction across formats
function extractJoinToken(message) {
  if (message.kind === 'system/join') {
    return message.payload?.token;
  }
  // Legacy support (to be removed)
  if (message.type === 'join') {
    return message.token;
  }
  return null;
}
```

### Authentication Flow:
1. Client sends `system/join` with token
2. Gateway validates token
3. Gateway assigns capabilities based on token
4. Gateway sends `system/welcome` with assigned capabilities
5. Client starts normal message exchange

## Backward Compatibility Strategy

### Transition Period (6 months):
- Gateway accepts both formats
- Logs warnings for legacy format usage
- Documentation updated to show new format only
- Client libraries updated incrementally

### Breaking Change Timeline:
```
Month 1-2: Update CLI clients to new format
Month 3-4: Update external documentation  
Month 5-6: Add deprecation warnings
Month 7+: Remove legacy format support
```

## Testing Requirements

### Format Validation Tests:
```javascript
describe('Join Message Handling', () => {
  test('accepts MEW v0.4 compliant join', () => {
    const message = {
      protocol: 'mew/v0.4',
      id: 'join-123',
      ts: new Date().toISOString(),
      from: 'test-participant',
      kind: 'system/join',
      payload: { space: 'test-space', participant: 'test-participant' }
    };
    expect(gateway.handleMessage(message)).toBeSuccess();
  });

  test('rejects malformed join messages', () => {
    const message = { type: 'join' }; // Missing required fields
    expect(gateway.handleMessage(message)).toBeError();
  });

  test('warns on legacy format (during transition)', () => {
    const spy = jest.spyOn(console, 'warn');
    const message = { type: 'join', participantId: 'test' };
    gateway.handleMessage(message);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Deprecated'));
  });
});
```

### Integration Tests:
- Test both formats during transition period
- Verify capability assignment works with new format
- Test error handling for malformed messages

## Documentation Updates

### CLI Documentation:
```markdown
## Connecting to a Space

Send a join message to connect:

```json
{
  "protocol": "mew/v0.4",
  "id": "join-unique-id",
  "ts": "2025-01-10T12:00:00Z", 
  "from": "your-participant-id",
  "kind": "system/join",
  "payload": {
    "space": "space-id",
    "participant": "your-participant-id",
    "token": "auth-token"
  }
}
```

Gateway responds with `system/welcome` containing your capabilities.
```

### Migration Guide:
```markdown
## Migrating from Legacy Join Format

**Old Format (Deprecated):**
```json
{ "type": "join", "participantId": "...", "space": "...", "token": "..." }
```

**New Format (Required):**
```json
{
  "protocol": "mew/v0.4",
  "kind": "system/join", 
  "payload": { "space": "...", "participant": "...", "token": "..." }
}
```
```

## Alternative Approaches Considered

### Option 1: Keep Legacy Format
- **Pros**: No breaking changes
- **Cons**: Protocol inconsistency, technical debt
- **Verdict**: Rejected for long-term maintenance

### Option 2: Create New Join Kind
- **Pros**: Clear separation from system messages
- **Cons**: Not following MEW system message patterns
- **Verdict**: Rejected, system/* is appropriate namespace

### Option 3: Use MCP-Style Handshake
- **Pros**: Leverages MCP patterns
- **Cons**: Adds complexity, not aligned with MEW broadcast model
- **Verdict**: Rejected, MEW uses different paradigm

## Consequences

### Positive:
- **Protocol Consistency**: All messages follow MEW v0.4 envelope
- **Future Compatibility**: Aligned with protocol evolution
- **Maintainability**: Single format to test and support
- **Tooling**: Standard MEW analyzers can parse join messages

### Negative:
- **Breaking Change**: Requires client updates
- **Complexity**: Temporary dual-format support needed
- **Migration Burden**: External clients need updates
- **Timeline**: Coordination required across implementations

### Risks:
- **Client Breakage**: Legacy clients fail after transition
- **Gateway Complexity**: Dual format support introduces bugs
- **Coordination Failure**: Clients updated at different rates
- **Testing Gaps**: Miss edge cases during transition

## Monitoring and Observability

### Metrics to Track:
- Join message format distribution (legacy vs new)
- Join success/failure rates by format
- Capability assignment accuracy
- Client connection patterns

### Alerts:
- High legacy format usage after deprecation warnings
- Join failure rate increases
- Invalid join message frequency

## Future Considerations

### Protocol Standardization:
- Propose `system/join` addition to MEW Protocol specification
- Include capability negotiation semantics
- Define standard error responses

### Enhanced Join Features:
```javascript
// Future: Enhanced capability negotiation
{
  kind: 'system/join',
  payload: {
    space: 'space-id',
    participant: 'participant-id',
    token: 'auth-token',
    requested_capabilities: [
      { kind: 'mcp/*' },
      { kind: 'chat' }
    ],
    client_info: {
      version: '1.0.0',
      features: ['reasoning', 'mcp-confirmation']
    }
  }
}
```

## Status Tracking

- [ ] Update client.js to use system/join format
- [ ] Update agent.js to use system/join format  
- [ ] Add deprecation warnings to gateway
- [ ] Update documentation and examples
- [ ] Create migration timeline and communication plan
- [ ] Add comprehensive tests for both formats
- [ ] Monitor usage during transition period
- [ ] Remove legacy format support after transition