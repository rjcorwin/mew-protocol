# ADR-n5r: Protocol-Kind Separator Convention

**Status:** Proposed  
**Date:** 2025-09-03  
**Context:** MEUP Protocol Draft Specification
**Incorporation:** Not Incorporated
**Related ADRs:** 002-0-m3p (Namespace Pattern)

## Context

In ADR-m3p, we established minimal kinds for message types (e.g., `mcp.request` instead of `mcp/request:tools/call`). However, we inconsistently used dot notation for the separator between protocol namespace and kind (e.g., `mcp.request`, `meup.grant`).

MCP itself uses slash notation in its JSON-RPC methods (e.g., `tools/call`, `resources/read`). We should align with this established convention for consistency.

### Current State
- Using dot notation: `mcp.request`, `meup.grant`, `system.error`
- MCP uses slash: `tools/call`, `resources/read`, `prompts/list`

### Requirements
- Consistency with MCP conventions
- Clear visual separation between namespace and operation
- Easy to parse and understand
- Maintain minimal kind philosophy from ADR-m3p

## Decision

**Adopt slash notation between protocol namespace and kind**

All message kinds will use slash notation to separate the protocol namespace from the operation:
- `mcp/request` instead of `mcp.request`
- `meup/grant` instead of `meup.grant`
- `system/error` instead of `system.error`

This aligns with MCP's existing convention and provides clear visual separation between namespace and operation.

## Options Considered

### Option 1: Keep Dot Notation (Status Quo)

Continue using dots: `mcp.request`, `meup.grant`, `system.error`

**Pros:**
- Already implemented in current spec
- Common in many programming languages
- Single separator throughout

**Cons:**
- Inconsistent with MCP's slash convention
- Less visual distinction between namespace and operation
- Dots often imply property access rather than categorization

### Option 2: Slash Notation (Recommended)

Use slashes: `mcp/request`, `meup/grant`, `system/error`

**Pros:**
- **Consistent with MCP's existing convention** (`tools/call`, `resources/read`)
- Clear visual separation between namespace and operation
- Slashes commonly indicate categorization/hierarchy
- Aligns with URI/URL path conventions

**Cons:**
- Requires updating current spec
- Different from some programming language conventions

### Option 3: Colon Notation

Use colons: `mcp:request`, `meup:grant`, `system:error`

**Pros:**
- Clear namespace separation
- Used in XML namespaces
- Distinct from other separators

**Cons:**
- Not used by MCP
- Less common in modern APIs
- Could be confused with port notation

### Option 4: Double Colon

Use double colons: `mcp::request`, `meup::grant`, `system::error`

**Pros:**
- Very clear separation
- Used in some programming languages (C++, Rust)
- Unlikely to conflict

**Cons:**
- Verbose
- Not used by MCP
- Uncommon in protocols

## Comparison Matrix

| Option | MCP Consistency | Visual Clarity | Familiarity | Parse Simplicity |
|--------|----------------|----------------|-------------|------------------|
| 1. Dot | Poor | Medium | High | High |
| 2. Slash | **Excellent** | **High** | **High** | **High** |
| 3. Colon | Poor | High | Medium | High |
| 4. Double Colon | Poor | Very High | Low | Medium |

## Implementation Examples

### Before (Dot Notation)
```json
{
  "kind": "mcp.request",
  "payload": { "method": "tools/call" }
}

{
  "kind": "meup.grant",
  "payload": { "capabilities": [...] }
}

{
  "kind": "system.error",
  "payload": { "error": "capability_violation" }
}
```

### After (Slash Notation)
```json
{
  "kind": "mcp/request",
  "payload": { "method": "tools/call" }
}

{
  "kind": "meup/grant",
  "payload": { "capabilities": [...] }
}

{
  "kind": "system/error",
  "payload": { "error": "capability_violation" }
}
```

## Complete Kind List with Slash Notation

**MCP namespace:**
- `mcp/request` - MCP request/notification
- `mcp/response` - MCP response  
- `mcp/proposal` - MCP proposal for operations
- `mcp/withdraw` - Withdraw a proposal
- `mcp/reject` - Reject a proposal

**MEUP namespace:**
- `meup/grant` - Grant capabilities
- `meup/revoke` - Revoke capabilities
- `meup/grant-ack` - Acknowledge grant
- `meup/invite` - Invite participant
- `meup/kick` - Remove participant

**Reasoning namespace:**
- `reasoning/start` - Begin reasoning
- `reasoning/thought` - Reasoning step
- `reasoning/conclusion` - End reasoning

**System namespace:**
- `system/welcome` - Welcome message
- `system/presence` - Join/leave events
- `system/error` - Error messages

**No namespace:**
- `chat` - Chat messages (no namespace needed)

## Consequences

### Positive
- **Consistency** with MCP's established conventions
- **Clear separation** between namespace and operation
- **Familiar pattern** from URLs and file paths
- **Visual hierarchy** is immediately apparent
- **Future proof** for sub-namespacing if needed (e.g., `mcp/tools/call`)

### Negative
- **Breaking change** from current spec
- **Migration required** for any implementations
- **Documentation updates** needed throughout

## Security Considerations

- No security impact from separator choice
- Pattern matching for capabilities remains unchanged
- Reserved namespace enforcement unchanged

## Migration Path

1. Update all ADRs to use slash notation
2. Update SPEC.md with slash notation throughout
3. Update capability matching examples
4. Update any implementation code
5. Document as breaking change in v0.2

## Future Considerations

- Slash notation naturally extends to sub-namespaces if needed
- Could support hierarchical kinds like `mcp/tools/call` if we ever need more specificity
- Aligns with potential REST API mappings

## References

- MCP Specification (uses `tools/call`, `resources/read`, etc.)
- ADR-m3p (Minimal Kind pattern)
- URI/URL specifications (use slash for hierarchy)