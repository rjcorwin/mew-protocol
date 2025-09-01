# ADR-h2n: Correlation ID Structure

**Status:** Proposed  
**Date:** 2025-09-01  
**Context:** MEUP Protocol Draft Specification
**Incorporation:** Not Incorporated

## Context

Currently, the MEUP specification uses a single string `correlationId` field to link related messages (responses to requests, rejections to proposals, etc.). However, there are scenarios where a message might need to correlate with multiple other messages, such as:

- A response that fulfills multiple proposals
- A reasoning conclusion that references multiple inputs
- A grant acknowledgment that responds to multiple grant attempts
- An aggregated result from multiple tool calls
- A message that's part of multiple conversation threads

### Current Limitations
- Can only reference one message at a time
- Forces artificial message chaining for multi-correlation
- No way to express "this responds to all of these"
- Makes it hard to track complex interaction patterns

### Requirements
- Maintain backward compatibility where possible
- Support both single and multiple correlations
- Keep the common case (single correlation) simple
- Clear semantics for multiple correlations

## Decision

**Implement Option 2: Always Array**

The `correlationId` field will always be an array of strings, even for single correlations.

```json
// Single correlation (common case)
{
  "correlationId": ["msg-123"],
  "kind": "mcp.response"
}

// Multiple correlations
{
  "correlationId": ["msg-123", "msg-456", "msg-789"],
  "kind": "mcp.response"
}
```

### Rationale

1. **Consistency**: One structure for all cases eliminates special-case handling
2. **Go Compatibility**: Critical for infrastructure likely to be written in Go, which handles arrays well but struggles with union types
3. **Signals Possibility**: Arrays immediately communicate that multiple correlations are possible
4. **Workflow-Ready**: Natural expression of fan-in patterns and dependency sets
5. **Minimal Overhead**: Just two extra characters (`[` and `]`) for tremendous simplification

## Options Considered

### Option 1: Single String (Status Quo)

Keep `correlationId` as a single string field.

```json
{
  "correlationId": "msg-123",
  "kind": "mcp.request",
  "payload": {...}
}
```

**Pros:**
- Simple and clear
- Already implemented
- Covers most use cases
- Minimal message size

**Cons:**
- Cannot express multi-correlation
- Forces workarounds for complex patterns
- Limited expressiveness

### Option 2: Always Array

Change `correlationId` to always be an array of strings.

```json
{
  "correlationId": ["msg-123"],  // Single correlation
  "kind": "mcp.request",
  "payload": {...}
}

{
  "correlationId": ["msg-123", "msg-456", "msg-789"],  // Multiple
  "kind": "chat",
  "payload": {"message": "Responding to all three requests"}
}
```

**Pros:**
- Consistent structure
- Supports multiple correlations
- No ambiguity about type

**Cons:**
- Breaking change
- More verbose for common case
- Arrays for single items feel awkward

### Option 3: String or Array (Union Type)

Allow `correlationId` to be either a string or an array of strings.

```json
// Single correlation (common case)
{
  "correlationId": "msg-123",
  "kind": "mcp.request",
  "payload": {...}
}

// Multiple correlations
{
  "correlationId": ["msg-123", "msg-456"],
  "kind": "chat",
  "payload": {"message": "Responding to both"}
}
```

**Pros:**
- Backward compatible
- Simple for common case
- Flexible for complex cases
- Natural syntax

**Cons:**
- Type checking more complex
- Two different structures to handle
- Potential confusion

### Option 4: Separate Fields

Keep `correlationId` for single, add `correlationIds` for multiple.

```json
// Single correlation
{
  "correlationId": "msg-123",
  "kind": "mcp.request",
  "payload": {...}
}

// Multiple correlations
{
  "correlationIds": ["msg-123", "msg-456"],
  "kind": "chat",
  "payload": {"message": "Responding to both"}
}
```

**Pros:**
- Backward compatible
- Clear intent from field name
- Type-safe

**Cons:**
- Two fields for same concept
- Confusion about which to use
- What if both are present?

### Option 5: Correlation Object

Use an object structure for more complex correlations.

```json
// Simple correlation
{
  "correlation": {"id": "msg-123"},
  "kind": "mcp.request",
  "payload": {...}
}

// Multiple correlations with types
{
  "correlation": {
    "ids": ["msg-123", "msg-456"],
    "type": "fulfills"  // or "responds_to", "aggregates", etc.
  },
  "kind": "mcp.request",
  "payload": {...}
}
```

**Pros:**
- Extensible for future needs
- Can express correlation type
- Rich semantics

**Cons:**
- More complex
- Breaking change
- Over-engineered for most uses

### Option 6: Primary and Additional

Keep single `correlationId` as primary, add optional `additionalCorrelations`.

```json
{
  "correlationId": "msg-123",  // Primary correlation
  "additionalCorrelations": ["msg-456", "msg-789"],  // Secondary
  "kind": "chat",
  "payload": {"message": "Mainly responding to first, but also others"}
}
```

**Pros:**
- Backward compatible
- Preserves primary relationship
- Clear hierarchy

**Cons:**
- Artificial distinction
- More complex than array
- Two fields to check

### Option 7: No Correlation IDs

Remove correlation IDs entirely and use context field for all relationships.

```json
{
  "context": "msg-123",  // Use context for correlation
  "kind": "mcp.request",
  "payload": {...}
}
```

**Pros:**
- Single mechanism for relationships
- Simpler protocol
- Already have context field

**Cons:**
- Loses semantic distinction
- Context has different meaning
- Breaking change

### Option 8: Keep Single, Use Message Aggregation

Keep single correlation but introduce aggregation messages for multi-correlation.

```json
// Aggregation message
{
  "id": "aggregate-1",
  "kind": "meup.aggregate",
  "payload": {
    "message_ids": ["msg-123", "msg-456", "msg-789"],
    "reason": "Batch processing"
  }
}

// Response correlates to the aggregation
{
  "correlationId": "aggregate-1",
  "kind": "mcp.response",
  "payload": {...}
}
```

**Pros:**
- Backward compatible
- Explicit aggregation semantics
- Single correlation maintained

**Cons:**
- Extra message overhead
- More complex pattern
- Indirect correlation

## Comparison Matrix

| Option | Backward Compatible | Complexity | Flexibility | Type Safety | Common Case |
|--------|-------------------|------------|-------------|-------------|-------------|
| 1. Single String | Yes | Very Low | Low | High | Perfect |
| 2. Always Array | No | Low | High | High | Verbose |
| 3. String or Array | Yes | Medium | High | Low | Perfect |
| 4. Separate Fields | Yes | Medium | High | Medium | Good |
| 5. Correlation Object | No | High | Very High | High | Complex |
| 6. Primary + Additional | Yes | Medium | High | High | Good |
| 7. No Correlation | No | Low | Low | High | N/A |
| 8. Aggregation | Yes | High | Medium | High | Perfect |

## Consequences

### Positive
- **Type Safety**: Single type to handle in all languages
- **Go-Friendly**: Clean implementation without type assertions
- **Workflow Support**: Natural fan-in and aggregation patterns
- **Clear Mental Model**: Arrays signal multi-correlation capability
- **No Surprises**: Developers always see arrays, never encounter unexpected type changes
- **Simple Validation**: One schema rule for all messages

### Negative
- **Breaking Change**: Existing implementations must update
- **Slight Verbosity**: Single correlations need array syntax
- **Migration Required**: All existing messages need updating

## Security Considerations

- Correlation IDs should not leak sensitive information
- Multiple correlations could enable correlation attacks
- Implementations must handle missing correlations gracefully

## Migration Path

1. **Transition Period**: Gateways temporarily accept both formats
   - If string received, convert to single-element array
   - Log deprecation warnings for string format
   
2. **Update Generators**: Modify all message producers to emit arrays

3. **Update Consumers**: Ensure all consumers handle arrays

4. **Cut-over**: After transition period, reject string format

5. **Helper Functions**: Provide utilities in SDKs:
   ```typescript
   // For convenience when you know it's single
   function getSingleCorrelation(msg: Message): string | undefined {
     return msg.correlationId?.[0];
   }
   ```

## Future Enhancements

- Correlation types (fulfills, responds_to, aggregates, etc.)
- Correlation weights or priorities
- Correlation metadata
- Correlation patterns for common scenarios

## Implementation Details

### Type Definitions

**TypeScript:**
```typescript
interface Message {
  correlationId?: string[];
  // ... other fields
}
```

**Go:**
```go
type Message struct {
    CorrelationID []string `json:"correlationId,omitempty"`
    // ... other fields
}
```

**Python:**
```python
class Message:
    correlation_id: Optional[List[str]]
```

### Validation Rules

1. **Optional Field**: `correlationId` may be omitted
2. **Empty Array**: `[]` is valid (no correlations)
3. **Single Element**: `["msg-123"]` for single correlation
4. **Multiple Elements**: `["msg-1", "msg-2", ...]` for multiple
5. **Unique Elements**: Implementations SHOULD deduplicate
6. **Order**: Arrays are unordered sets - order has no semantic meaning

### Workflow Patterns

**Fan-in Aggregation:**
```json
{
  "id": "aggregate-1",
  "correlationId": ["parallel-1", "parallel-2", "parallel-3"],
  "kind": "workflow.complete",
  "payload": {"merged_results": {...}}
}
```

**Dependency Satisfaction:**
```json
{
  "id": "step-5",
  "correlationId": ["prerequisite-1", "prerequisite-2"],
  "kind": "workflow.proceed",
  "payload": {"all_dependencies_met": true}
}
```

### Semantic Interpretation

The meaning of multiple correlations depends on the message kind:

- **`mcp.response`**: Fulfills all correlated requests
- **`mcp.reject`**: Rejects all correlated proposals
- **`meup.grant-ack`**: Acknowledges all correlated grants
- **`workflow.*`**: Depends on workflow semantics (wait-all, wait-any, etc.)
- **`chat`**: Responding to multiple messages in thread

The correlation array provides the structure; the kind and payload provide the semantics.