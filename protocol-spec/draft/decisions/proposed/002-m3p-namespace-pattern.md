# ADR-m3p: Message Kind Namespace Pattern

**Status:** Proposed  
**Date:** 2025-08-30  
**Context:** MCPx Protocol Draft Specification
**Incorporation:** Not Incorporated

## Context

The current spec uses various patterns for the `kind` field, leading to confusion about the namespace structure. We need a consistent, elegant pattern that clearly indicates:
1. What protocol/format is in the payload
2. What MCPx operation is being performed
3. Any additional context needed for routing/capabilities

### Current Issues
- Inconsistent patterns: `mcp/request:tools/call` vs `system/welcome` vs `chat`
- Unclear when to use `/` vs `:` separators
- Confusion about whether `mcp/proposal:withdraw` means MCP method "withdraw"
- No clear mental model for developers

## Decision

**Accepted: Option 2 (Three-Level Hierarchy) with server-side validation**

**Pattern:** `PAYLOAD_PROTOCOL.MCPX_OPERATION[.PAYLOAD_METHOD[:PAYLOAD_CONTEXT]]`

### Separator Rationale:
- **Dots (`.`)** separate hierarchical levels (protocol → operation → method)
- **Colon (`:`)** adds optional context/parameters to the final level
- **Slash (`/`)** preserved within MCP method names (e.g., `tools/call`)

This provides semantic clarity: dots for hierarchy, colon for context.

Where:
- **PAYLOAD_PROTOCOL**: What protocol/format is in the payload (`mcp`, `mcpx`, `system`, `chat`)
- **MCPX_OPERATION**: The MCPx-level operation (`request`, `response`, `proposal`, `withdraw`, `reject`, `welcome`, etc.)
- **PAYLOAD_METHOD**: (Optional third level with dot) The method within the payload protocol
  - For MCP: The actual method like `tools/call`, `resources/read`
  - For non-MCP: A target or subtype like `proposal`, `participant`
- **PAYLOAD_CONTEXT**: (Optional after colon) Additional context like specific tool or resource name

### Why Option 2 Wins:
- **Security**: Clean structure enables reliable validation
- **Performance**: Only 10μs overhead per message (negligible)
- **Clarity**: Unambiguous parsing with dot separators
- **Capabilities**: Excellent pattern matching with dots
- **Consistency**: Every message follows same structure

### Implementation Requirements:

**Gateway MUST validate:**
1. Split `kind` on dots to get [PROTOCOL, OPERATION, METHOD]
2. For `mcp.*` kinds:
   - Verify `payload.method` matches METHOD part
   - If CONTEXT present after `:`, verify `payload.params.name` matches
3. For other protocols:
   - Apply protocol-specific validation rules

**Examples with Clear Breakdown:**
```
kind: mcp.request.tools/call
      ^^^  ^^^^^^^  ^^^^^^^^^^
      |    |        └─ PAYLOAD_METHOD (MCP method)
      |    └─ MCPX_OPERATION (what MCPx is doing)
      └─ PAYLOAD_PROTOCOL (MCP protocol in payload)
validates: payload.method === "tools/call"

kind: mcp.request.tools/call:read_file  
      ^^^  ^^^^^^^  ^^^^^^^^^^  ^^^^^^^^^
      |    |        |           └─ PAYLOAD_CONTEXT (specific tool)
      |    |        └─ PAYLOAD_METHOD (MCP method)
      |    └─ MCPX_OPERATION (request)
      └─ PAYLOAD_PROTOCOL (MCP)
validates: payload.method === "tools/call" && 
           payload.params.name === "read_file"

kind: mcpx.withdraw.proposal
      ^^^^  ^^^^^^^^  ^^^^^^^^
      |     |         └─ What we're withdrawing (not a method)
      |     └─ MCPX_OPERATION (withdraw)
      └─ PAYLOAD_PROTOCOL (MCPx-specific)
validates: MCPx-specific validation

kind: system.welcome.participant
      ^^^^^^  ^^^^^^^  ^^^^^^^^^^^
      |       |        └─ Optional target/context
      |       └─ MCPX_OPERATION (welcome)
      └─ PAYLOAD_PROTOCOL (system messages)
validates: (reserved for gateway only)
```

### Migration from Current Spec:
- `mcp/request:tools/call` → `mcp.request.tools/call` (3 levels)
- `mcp/proposal:tools/call` → `mcp.proposal.tools/call` (3 levels)
- `system/welcome` → `system.welcome` (2 levels, no method needed)
- `system/presence` → `system.presence` (2 levels)
- `chat` → `chat.message` (2 levels sufficient)
- `proposal/withdraw` → `mcpx.withdraw.proposal` (3 levels)
- `proposal/reject` → `mcpx.reject.proposal` (3 levels)

## Options Considered

### Option 1: Payload-First Pattern (Current-ish)

**Pattern:** `PAYLOAD_TYPE/OPERATION[:METHOD[:CONTEXT]]`

Examples:
- `mcp/request:tools/call` - MCP payload, request operation, tools/call method
- `mcp/proposal:tools/call` - MCP payload, proposal operation, tools/call method
- `mcp/response:tools/call` - MCP payload, response operation, tools/call method
- `proposal/withdraw` - Proposal payload, withdraw operation
- `proposal/reject` - Proposal payload, reject operation
- `system/welcome` - System payload, welcome operation
- `system/presence` - System payload, presence operation
- `system/error` - System payload, error operation
- `chat` - Chat payload (simple case)

**Capability Examples:**
- `mcp/*` - All MCP operations
- `mcp/request:*` - All MCP requests
- `mcp/request:tools/*` - All tool requests
- `proposal/*` - All proposal lifecycle operations
- `system/*` - Reserved for gateway only

**Pros:**
- First segment tells you payload structure
- Works for simple cases
- Decent capability pattern matching

**Cons:**
- Confusion when operation seems like a method (proposal:withdraw)
- Inconsistent depth (chat vs mcp/request:tools/call)
- Mixed separators confuse pattern matching

---

### Option 2: Strict Three-Level Hierarchy

**Pattern:** `PAYLOAD_PROTOCOL.MCPX_OPERATION[.PAYLOAD_METHOD[:PAYLOAD_CONTEXT]]`

Examples:
- `mcp.request.tools/call` - MCP protocol, request op, tools/call method
- `mcp.proposal.tools/call` - MCP protocol, proposal op, tools/call method
- `mcp.response.tools/call` - MCP protocol, response op, tools/call method
- `mcpx.withdraw.proposal` - MCPx protocol, withdraw op, proposal target
- `mcpx.reject.proposal` - MCPx protocol, reject op, proposal target
- `system.welcome.participant` - System protocol, welcome op, participant target
- `system.presence.join` - System protocol, presence op, join event
- `system.presence.leave` - System protocol, presence op, leave event
- `system.error.capability` - System protocol, error op, capability violation
- `chat.message.text` - Chat protocol, message op, text format

**Capability Examples:**
- `mcp.*` - All MCP operations
- `mcp.request.*` - All MCP requests
- `mcp.request.tools/*` - All tool requests
- `mcpx.withdraw.*` - Can withdraw proposals
- `system.*` - Reserved for gateway only
- `chat.*` - All chat operations

**Pros:**
- Completely consistent structure
- Clear hierarchy
- No ambiguity about separators
- Very clean capability patterns

**Cons:**
- Verbose for simple messages
- Dots might be confused with object notation
- Breaking change from current spec

---

### Option 3: Operation-First Pattern

**Pattern:** `OPERATION/TARGET[:DETAILS]`

Examples:
- `request/mcp:tools/call` - Request operation on MCP, tools/call method
- `proposal/mcp:tools/call` - Proposal operation on MCP, tools/call method
- `response/mcp:tools/call` - Response operation on MCP, tools/call method
- `withdraw/proposal` - Withdraw operation on proposal
- `reject/proposal` - Reject operation on proposal
- `welcome/participant` - Welcome operation for participant
- `presence/join` - Presence operation, join event
- `presence/leave` - Presence operation, leave event
- `error/capability` - Error operation, capability type
- `message/chat` - Message operation for chat

**Capability Examples:**
- `request/*` - All request operations
- `request/mcp:*` - All MCP requests
- `request/mcp:tools/*` - All tool requests
- `withdraw/*` - Can withdraw anything
- `welcome/*` - Reserved for gateway

**Pros:**
- Operation is always first (what are we doing?)
- Target is clear (what are we doing it to?)
- Flexible detail section

**Cons:**
- Breaks from current spec significantly
- Less clear what's in the payload
- Capability patterns less intuitive

---

### Option 4: Hybrid with Clear Rules

**Pattern:** `NAMESPACE/[SUBNAMESPACE/]OPERATION[:METHOD[:CONTEXT]]`

Rules:
- `/` separates protocol namespaces
- `:` separates operation details
- Never use `:` for MCPx-specific operations

Examples:
- `mcp/request:tools/call` - MCP namespace, request:tools/call
- `mcp/proposal:tools/call` - MCP namespace, proposal:tools/call
- `mcp/response:tools/call` - MCP namespace, response:tools/call
- `mcpx/proposal/withdraw` - MCPx namespace, proposal namespace, withdraw
- `mcpx/proposal/reject` - MCPx namespace, proposal namespace, reject
- `system/welcome` - System namespace, welcome
- `system/presence` - System namespace, presence
- `system/error` - System namespace, error
- `chat` - Chat (top-level for simplicity)

**Capability Examples:**
- `mcp/*` - All MCP operations
- `mcp/request:*` - All MCP requests
- `mcp/request:tools/*` - All tool requests
- `mcpx/proposal/*` - All MCPx proposal lifecycle
- `system/*` - Reserved for gateway only
- `chat` - Chat capability

**Pros:**
- Clear rules
- Explicit about MCPx extensions
- Maintains most of current spec
- Good capability patterns

**Cons:**
- Still some inconsistency (chat vs others)
- Longer kinds for MCPx operations
- Two different separator meanings

---

### Option 5: Semantic Prefixing

**Pattern:** `[PREFIX]PROTOCOL:OPERATION[:DETAILS]`

Prefixes:
- `>` for requests/proposals (outgoing)
- `<` for responses (incoming)
- `!` for lifecycle/control
- `@` for system
- No prefix for simple messages

Examples:
- `>mcp:tools/call` - Request MCP tools/call
- `>proposal:tools/call` - Propose MCP tools/call
- `<mcp:tools/call` - Response from MCP tools/call
- `!withdraw:proposal` - Withdraw a proposal
- `!reject:proposal` - Reject a proposal
- `@welcome` - System welcome
- `@presence:join` - System presence join
- `@presence:leave` - System presence leave
- `@error:capability` - System error capability
- `chat` - Simple chat message

**Capability Examples:**
- `>mcp:*` - All MCP requests
- `>mcp:tools/*` - All tool requests
- `>proposal:*` - All proposals
- `!*` - All lifecycle operations
- `@*` - Reserved for gateway only
- `chat` - Chat capability

**Pros:**
- Visual distinction of operation types
- Compact
- Clear at a glance
- Unique capability patterns

**Cons:**
- Non-standard use of symbols
- Might complicate parsing/routing
- Too creative?
- Hard to type/remember symbols

---

### Option 6: Unified Verb-Based

**Pattern:** `VERB:TARGET[/DETAILS]`

Examples:
- `request:mcp/tools/call` - Request MCP tools/call
- `propose:mcp/tools/call` - Propose MCP tools/call
- `respond:mcp/tools/call` - Respond to MCP tools/call
- `withdraw:proposal` - Withdraw proposal
- `reject:proposal` - Reject proposal
- `welcome:participant` - Welcome participant
- `notify:presence/join` - Notify presence join
- `notify:presence/leave` - Notify presence leave
- `error:capability` - Error about capability
- `send:chat` - Send chat message

**Capability Examples:**
- `request:*` - Can make any request
- `request:mcp/*` - Can make MCP requests
- `request:mcp/tools/*` - Can make tool requests
- `withdraw:*` - Can withdraw anything
- `welcome:*` - Reserved for gateway
- `send:*` - Can send messages

**Pros:**
- Extremely consistent
- Verb always first (action-oriented)
- Self-documenting
- Clear capability semantics

**Cons:**
- Major breaking change
- Verbose for responses
- Doesn't indicate payload type clearly
- Capability overlap concerns

---

## Security & Parsing Analysis

### Spoofing Risks

**Key Risk**: Participant claims a `kind` they have capability for, but payload contains different operation.

| Option | Spoofing Risk | Example Attack | Mitigation |
|--------|---------------|----------------|------------|
| 1. Payload-First | **High** | Use `mcp/request:tools/read` kind with `tools/write` in payload | Must validate METHOD and CONTEXT match payload |
| 2. Three-Level | **Low** | Harder - dots create clear boundaries | Simple validation: split on dots, verify each part |
| 3. Operation-First | **Medium** | Use `request/mcp:tools/read` with different tool | Must parse after `:` carefully |
| 4. Hybrid Rules | **High** | Mixed separators confuse validation | Complex rules for different namespaces |
| 5. Semantic Prefix | **Low** | Prefix makes operation explicit | Prefix must match payload operation type |
| 6. Verb-Based | **Low** | Verb explicitly states operation | Verb must match payload action |

### Parsing Complexity

| Option | Parse Complexity | Regex Example | Edge Cases |
|--------|-----------------|---------------|------------|
| 1. Payload-First | **Complex** | `/^([^\/]+)\/([^:]+)(:(.+))?$/` | Mixed separators, variable depth |
| 2. Three-Level | **Simple** | `/^([^.]+)\.([^.]+)\.([^:]+)(:(.+))?$/` | Fixed structure, clear boundaries |
| 3. Operation-First | **Medium** | `/^([^\/]+)\/([^:]+)(:(.+))?$/` | Must handle optional details |
| 4. Hybrid Rules | **Complex** | Multiple patterns needed | Different rules per namespace |
| 5. Semantic Prefix | **Simple** | `/^([><!@]?)([^:]+):(.+)$/` | Prefix is optional but clear |
| 6. Verb-Based | **Simple** | `/^([^:]+):(.+)$/` | Always verb:target pattern |

### Validation Requirements

| Option | Gateway Validation | Participant Validation |
|--------|-------------------|------------------------|
| 1. Payload-First | Pattern match + context check | Full payload structure validation |
| 2. Three-Level | Simple dot-split validation | Match each level to payload |
| 3. Operation-First | Check operation permissions | Verify target matches payload |
| 4. Hybrid Rules | Complex namespace rules | Different validation per namespace |
| 5. Semantic Prefix | Prefix determines validation | Prefix must match operation |
| 6. Verb-Based | Verb permission check | Verb must match payload action |

## Comparison Matrix

| Pattern | Consistency | Clarity | Breaking Change | Capability Matching | Parse Safety | Spoof Resist | Elegance |
|---------|------------|---------|-----------------|-------------------|--------------|--------------|----------|
| 1. Payload-First | Medium | Medium | Low | Medium | Complex | **Weak** | Medium |
| 2. Three-Level | High | High | High | Excellent | **Simple** | **Strong** | Low |
| 3. Operation-First | High | Medium | High | Poor | Medium | Medium | Medium |
| 4. Hybrid Rules | Medium | High | Low | Good | Complex | **Weak** | Medium |
| 5. Semantic Prefix | Medium | High | High | Unique | **Simple** | **Strong** | High? |
| 6. Verb-Based | High | High | High | Good | **Simple** | **Strong** | Medium |

## Gateway Validation Performance Analysis

### Lazy Gateway (Current Spec)
**Operations per message:**
1. Check `from` matches connection: ~1μs (hash lookup)
2. Check `kind` matches capabilities: ~5μs (pattern match)
3. Route to participants: ~10μs (websocket send)

**Total:** ~16μs per message
**Throughput:** ~62,500 messages/second per core

### Minimal Validation Gateway
**Additional operations:**
1. Parse `kind` into parts: ~2μs (string split)
2. Access `payload.method`: ~3μs (object access)
3. String compare method: ~1μs
4. If CONTEXT, access `payload.params.name`: ~3μs
5. String compare context: ~1μs

**Total:** ~26μs per message (+10μs)
**Throughput:** ~38,500 messages/second per core
**Overhead:** ~60% slower, but still very fast

### Full Validation Gateway
**Additional operations:**
1. Full JSON schema validation: ~500μs
2. Validate all parameters: ~200μs
3. Type checking: ~100μs

**Total:** ~816μs per message
**Throughput:** ~1,225 messages/second per core
**Overhead:** ~51x slower - significant impact

### Real-World Impact

**At 1,000 messages/second (typical):**
- Lazy: 1.6% CPU
- Minimal: 2.6% CPU  
- Full: 82% CPU

**At 10,000 messages/second (high load):**
- Lazy: 16% CPU
- Minimal: 26% CPU
- Full: Would need 9 cores

**Conclusion:** Minimal validation adds negligible overhead (10μs) while preventing entire attack classes. Full validation is prohibitively expensive.

### Memory Overhead

**All approaches need:**
- Connection tracking: ~1KB per connection
- Capability storage: ~500 bytes per connection
- Message buffer: ~4KB per message in flight

**Additional for validation:**
- Lazy: 0 bytes
- Minimal: 0 bytes (validation is stateless)
- Full: ~10KB per connection (schema cache)

**At 1,000 concurrent connections:**
- Lazy: ~5.5MB
- Minimal: ~5.5MB (no difference)
- Full: ~15.5MB

### Recommendation Based on Performance

Given the negligible performance impact (10μs = 0.01ms per message):
- **Minimal validation is worth it** for the security benefit
- At typical loads (<1,000 msg/s), the CPU difference is imperceptible
- Even at high loads (10,000 msg/s), it's just 10% more CPU
- No additional memory required
- Prevents entire classes of attacks

The 60% throughput reduction sounds scary but in absolute terms (62k→38k msgs/sec) both are far beyond typical needs.

## Spoofing Attack Examples

### Current Pattern Vulnerability (Option 1/4)
```json
// Attacker has capability: mcp/request:tools/read
// Sends this message:
{
  "kind": "mcp/request:tools/read",  // Passes gateway check
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "write_file",  // Actually calling write!
      "arguments": {"path": "/etc/passwd", "content": "..."}
    }
  }
}
```
**Problem**: Gateway only checks `kind`, doesn't validate payload matches.

### Three-Level Protection (Option 2)
```json
// With clear structure: mcp.request.tools/read
// Gateway can validate each level:
// - Protocol: mcp (check)
// - Operation: request (check) 
// - Method: tools/read (check - must match payload.params.name)
```

### Verb-Based Protection (Option 6)
```json
// Kind: request:mcp/tools/read
// Gateway knows:
// - Verb is "request" (must be a request in payload)
// - Target is "mcp/tools/read" (must match payload method and tool)
// Easier to validate verb matches payload operation
```

## Recommendation

Based on security and parsing analysis, **Option 2 (Three-Level Hierarchy)** or **Option 6 (Verb-Based)** provide the best security:

- **Option 2**: Cleanest structure, easiest parsing, strongest validation
- **Option 6**: Clear operation semantics, simple parsing, good validation

**Option 1/4** (current patterns) have significant spoofing risks due to mixed separators and unclear validation boundaries.

If breaking changes are acceptable for v0.x, **Option 2** is recommended for its simplicity and security.

## Implementation Impact

### For Gateway
- Pattern matching for capabilities
- Routing logic updates
- Backward compatibility handling

### For Participants  
- Message generation
- Message parsing
- Capability understanding

## Questions to Resolve

1. How important is backward compatibility vs elegance?
2. Should we optimize for human readability or machine parsing?
3. Do we want visual distinction between operation types?
4. Should payload type or operation type come first?
5. Is consistency worth verbosity?

## Examples Side-by-Side

| Use Case | Current/Option 1 | Option 2 | Option 4 | Option 6 |
|----------|-----------------|----------|----------|----------|
| MCP Request | `mcp/request:tools/call` | `mcp.request.tools/call` | `mcp/request:tools/call` | `request:mcp/tools/call` |
| MCP Proposal | `mcp/proposal:tools/call` | `mcp.proposal.tools/call` | `mcp/proposal:tools/call` | `propose:mcp/tools/call` |
| MCP Response | `mcp/response:tools/call` | `mcp.response.tools/call` | `mcp/response:tools/call` | `respond:mcp/tools/call` |
| Withdraw | `proposal/withdraw` | `mcpx.withdraw.proposal` | `mcpx/proposal/withdraw` | `withdraw:proposal` |
| Reject | `proposal/reject` | `mcpx.reject.proposal` | `mcpx/proposal/reject` | `reject:proposal` |
| Welcome | `system/welcome` | `system.welcome.participant` | `system/welcome` | `welcome:participant` |
| Join | `system/presence` | `system.presence.join` | `system/presence` | `notify:presence/join` |
| Error | `system/error` | `system.error.capability` | `system/error` | `error:capability` |
| Chat | `chat` | `chat.message.text` | `chat` | `send:chat` |

### Capability Pattern Examples

| Intent | Option 1 | Option 2 | Option 4 | Option 6 |
|--------|----------|----------|----------|----------|
| All MCP | `mcp/*` | `mcp.*` | `mcp/*` | `request:mcp/*` + `respond:mcp/*` |
| All requests | `mcp/request:*` | `mcp.request.*` | `mcp/request:*` | `request:*` |
| Tool requests | `mcp/request:tools/*` | `mcp.request.tools/*` | `mcp/request:tools/*` | `request:mcp/tools/*` |
| Withdrawals | `proposal/withdraw` | `mcpx.withdraw.*` | `mcpx/proposal/withdraw` | `withdraw:*` |
| System (gateway) | `system/*` | `system.*` | `system/*` | `welcome:*` + `notify:*` + `error:*` |

## Next Steps

1. Evaluate each option against real use cases
2. Consider migration path from current spec
3. Test pattern matching complexity
4. Get feedback on readability/usability