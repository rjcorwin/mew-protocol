# ADR-j3k: Property Naming Convention

**Status:** Accepted  
**Date:** 2025-09-01  
**Context:** MEUP Protocol Draft Specification
**Incorporation:** Complete

## Context

The current MEUP specification has inconsistent property naming conventions:
- Some use camelCase: `correlationId`
- Some use snake_case: `attempted_kind`, `your_capabilities`
- The MCP protocol itself uses snake_case for JSON-RPC

This inconsistency creates confusion and makes the protocol feel unpolished. We need a consistent naming convention for all JSON properties in MEUP messages.

### Current State
- Envelope fields are mixed (mostly snake_case)
- System message payloads use snake_case
- Capability definitions are unclear
- No documented convention

### Requirements
- Consistency across all message types
- Clear guidance for extensions
- Compatibility consideration with MCP
- Easy to implement and validate

## Decision

**Implement Option 4: Follow MCP exactly**

MEUP will use snake_case for all JSON properties, following MCP's convention. Since MEUP extends MCP, maintaining consistency with the underlying protocol is paramount.

This means:
- All envelope fields use snake_case: `correlation_id`, `from`, `to`, `kind`
- All system message fields use snake_case: `attempted_kind`, `your_capabilities`
- All capability fields use snake_case: `grant_id`, `participant_id`
- MCP payloads naturally remain snake_case

Rationale:
- MEUP extends MCP, so following MCP conventions reduces cognitive load
- Single consistent rule throughout the entire protocol
- No conversion needed when bridging to/from MCP
- Eliminates any confusion about which convention to use where

## Options Considered

### Option 1: All snake_case

Use snake_case for all properties throughout MEUP.

```json
{
  "protocol": "meup/v0.1",
  "correlation_id": ["msg-123"],
  "from_participant": "agent",
  "attempted_kind": "mcp.request",
  "your_capabilities": [...]
}
```

**Pros:**
- Consistent with MCP's JSON-RPC which uses snake_case
- Python-friendly
- Common in REST APIs
- No conversion needed for MCP payloads

**Cons:**
- Less common in JavaScript/TypeScript ecosystems
- Differs from many web standards

### Option 2: All camelCase

Use camelCase for all properties throughout MEUP.

```json
{
  "protocol": "meup/v0.1",
  "correlationId": ["msg-123"],
  "fromParticipant": "agent",
  "attemptedKind": "mcp.request",
  "yourCapabilities": [...]
}
```

**Pros:**
- JavaScript/TypeScript native convention
- Common in modern web APIs
- Familiar to web developers
- Clean appearance

**Cons:**
- Inconsistent with MCP's snake_case
- Would need conversion for MCP payloads
- Less Python-friendly

### Option 3: Mixed - Envelope camelCase, Payloads preserve format

Use camelCase for MEUP envelope fields, preserve original format in payloads.

```json
{
  "protocol": "meup/v0.1",
  "correlationId": ["msg-123"],
  "kind": "mcp.request",
  "payload": {
    // MCP payload keeps snake_case
    "json_rpc": "2.0",
    "method": "tools/call",
    "params": {
      "tool_name": "read_file"
    }
  }
}
```

**Pros:**
- MEUP fields use modern convention
- MCP compatibility preserved
- Clear boundary between protocols
- No payload transformation needed

**Cons:**
- Two conventions in one message
- Potential confusion at boundaries
- Need clear documentation

### Option 4: Follow MCP exactly

Since MEUP extends MCP, follow MCP's snake_case convention everywhere.

**Pros:**
- Maximum consistency with MCP
- Single convention throughout
- No confusion about which to use

**Cons:**
- MCP isn't fully consistent itself
- Less appealing to JavaScript developers
- Perpetuates any MCP inconsistencies

### Option 5: Context-based

- MEUP-specific fields: camelCase
- MCP-related fields: snake_case
- System messages: snake_case

**Pros:**
- Semantic grouping
- Preserves compatibility
- Indicates field origin

**Cons:**
- Most complex rule
- Hard to remember
- Requires constant context awareness

## Comparison Matrix

| Option | Consistency | MCP Compatibility | Developer Experience | Implementation |
|--------|------------|-------------------|---------------------|----------------|
| 1. All snake_case | High | Perfect | Good (Python), OK (JS) | Simple |
| 2. All camelCase | High | Poor | Good (JS), OK (Python) | Simple |
| 3. Mixed by layer | Medium | Good | OK | Medium |
| 4. Follow MCP | High | Perfect | Same as MCP | Simple |
| 5. Context-based | Low | Good | Confusing | Complex |

## Examples

### Critical Fields to Standardize

Regardless of choice, these fields need consistent naming:

**Envelope fields:**
- correlation_id / correlationId
- from / fromParticipant  
- to / toParticipants

**System message fields:**
- attempted_kind / attemptedKind
- your_capabilities / yourCapabilities
- grant_id / grantId
- participant_id / participantId
- ban_duration / banDuration

**Capability fields:**
- allow_sub_delegation / allowSubDelegation
- usage_count / usageCount
- expires_at / expiresAt

## Consequences

### Positive
- **Maximum consistency** with MCP protocol
- **Single rule** - always use snake_case
- **No conversion** needed for MCP payloads
- **Clear convention** - no ambiguity
- **Python-friendly** - natural for Python implementations
- **REST API standard** - familiar to many developers

### Negative
- **Less JavaScript-idiomatic** - JS/TS developers prefer camelCase
- **Perpetuates MCP choices** - even if suboptimal
- **Framework friction** - some JS frameworks expect camelCase

## Security Considerations

- Property names shouldn't leak implementation details
- Consistent naming reduces parsing errors
- Clear conventions prevent injection attacks via property names

## Migration Path

1. Update all MEUP specification examples to use snake_case
2. Fix any camelCase properties currently in the spec:
   - Change `correlationId` to `correlation_id`
   - Already correct: `attempted_kind`, `your_capabilities`
3. Update all implementation code
4. Provide migration guide for early adopters
5. Add linting rules to enforce snake_case

## Future Enhancements

- Linting rules for property names
- Automatic conversion utilities
- Schema validation for naming conventions

## Implementation Details

### Standard Field Names

**Envelope fields:**
```json
{
  "protocol": "meup/v0.1",
  "id": "msg-123",
  "ts": "2025-09-01T12:00:00Z",
  "from": "participant-1",
  "to": ["participant-2"],
  "kind": "mcp.request",
  "correlation_id": ["msg-456"],
  "context": "ctx-789",
  "payload": {}
}
```

**System message fields:**
```json
{
  "attempted_kind": "mcp.request",
  "your_capabilities": [...],
  "grant_id": "grant-123",
  "participant_id": "agent-1",
  "ban_duration": "24h",
  "allow_sub_delegation": true,
  "usage_count": 10,
  "expires_at": "2025-12-31T23:59:59Z"
}
```

### Validation

Implementations SHOULD validate that all property names:
- Use lowercase letters, numbers, and underscores only
- Start with a letter
- Use underscores to separate words
- Match pattern: `^[a-z][a-z0-9_]*$`