# Decision: Fulfill Message Kind

**Date**: 2025-08-27  
**Status**: Decided  
**Outcome**: No separate `mcp/fulfill:METHOD` kind needed

## Context

When a participant with appropriate capabilities wants to fulfill a proposal from a restricted participant, they need to execute the actual operation that was proposed. The question arose whether we need a separate message kind `mcp/fulfill:METHOD` to explicitly mark fulfillment actions.

## Options Considered

### Option 1: Add `mcp/fulfill:METHOD` kind
Create a new message kind specifically for fulfillment:
```json
{
  "kind": "mcp/fulfill:tools/call",
  "correlation_id": "proposal-123",
  "payload": { ... }
}
```

**Pros:**
- Explicit semantic marking of fulfillment actions
- Could enable special gateway handling of fulfillments
- Clear audit trail of what's a fulfillment vs independent action

**Cons:**
- Adds complexity to the protocol
- Requires new capability patterns (`mcp/fulfill:*`)
- Semantically redundant - fulfillment IS just executing the operation
- Gateway would need to track proposal state

### Option 2: Use existing `mcp/request:METHOD` with correlation_id (CHOSEN)
Fulfillment is simply executing the proposed operation with correlation:
```json
{
  "kind": "mcp/request:tools/call",
  "correlation_id": "proposal-123",
  "payload": { ... }
}
```

**Pros:**
- No new message kinds needed
- Simpler capability model
- Clear semantics: fulfillment = execution
- Correlation already provides the linkage
- Gateway remains stateless about proposals

**Cons:**
- Less explicit about fulfillment intent
- Requires agents to infer fulfillment from correlation

## Decision

We will **NOT** introduce a separate `mcp/fulfill:METHOD` kind. Fulfillment is accomplished by sending the actual `mcp/request:METHOD` with a `correlation_id` referencing the proposal.

## Rationale

1. **Simplicity**: The protocol remains minimal without additional message types
2. **Clear semantics**: Fulfilling a proposal means executing it - they're the same action
3. **Gateway simplicity**: No need for gateways to track proposal state
4. **Correlation is sufficient**: The `correlation_id` field already provides the linkage needed for audit trails
5. **Capability model stays clean**: No need for additional `mcp/fulfill:*` capability patterns

## Implementation Notes

When implementing fulfillment:
1. Copy the proposed operation's method and params
2. Create a new `mcp/request:METHOD` message
3. Set `correlation_id` to the proposal's message ID
4. The response can include both the fulfiller and original proposer in the `to` field

## Example

Proposal:
```json
{
  "id": "prop-123",
  "kind": "mcp/proposal:tools/call",
  "from": "untrusted-agent",
  "payload": {
    "method": "tools/call",
    "params": { "name": "write_file", "arguments": {...} }
  }
}
```

Fulfillment:
```json
{
  "id": "fulfill-456",
  "kind": "mcp/request:tools/call",
  "correlation_id": "prop-123",
  "from": "human",
  "to": ["target-agent"],
  "payload": {
    "jsonrpc": "2.0",
    "id": 789,
    "method": "tools/call",
    "params": { "name": "write_file", "arguments": {...} }
  }
}
```

The correlation_id clearly indicates this request fulfills the proposal, without needing a separate message kind.