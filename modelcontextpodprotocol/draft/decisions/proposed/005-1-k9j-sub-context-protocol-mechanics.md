# ADR-k9j: Sub-Context Protocol Mechanics

**Status:** Proposed
**Date:** 2025-08-31
**Context:** MCPP/MCPx Protocol Draft Specification
**Incorporation:** Not Incorporated
**Parent ADR:** 005-0-t8k (Agent Reasoning Transparency)

## Context

ADR-t8k establishes that agents should be able to share reasoning transparently through sub-contexts. This ADR focuses on the protocol-level mechanics for implementing sub-contexts in MCPP. The key challenge is how to group related messages together while maintaining the broadcast nature of the protocol and allowing participants to filter or process sub-contexts differently from main context messages.

Sub-contexts are needed for:
- Agent reasoning chains (per ADR-t8k)
- Multi-step operations that should be grouped
- Nested workflows and delegated tasks
- Any scenario where message grouping provides value

### Decision Drivers
- Maintain simplicity of the envelope structure
- Allow efficient filtering of sub-context messages
- Support nested sub-contexts if needed
- Enable correlation between sub-contexts and main context
- Preserve broadcast-by-default semantics
- Minimize protocol complexity

## Decision

**Use envelope-level sub-context field with context IDs**

Add an optional `context` field to the envelope that indicates sub-context membership. Messages without this field are in the main context. This approach is simple, flexible, and maintains backward compatibility.

## Options Considered

### Option 1: Dedicated Message Kinds

Use special message kinds to denote sub-context messages (e.g., `subcontext/reasoning/start`).

**Pros:**
- Clear from the `kind` field that it's a sub-context message
- Can apply different capability rules to sub-context messages
- No envelope changes needed

**Cons:**
- Proliferation of message kinds (need sub-context version of everything)
- Complex kind parsing to extract context type
- Hard to support nested contexts
- Inflexible for future sub-context types

**Example:**
```json
{
  "kind": "subcontext/reasoning/step",
  "from": "agent-1",
  "payload": {
    "reasoning_id": "r-123",
    "content": "Analyzing input"
  }
}
```

### Option 2: Envelope Context Field (Recommended)

Add optional `context` field to the envelope structure.

**Pros:**
- Clean separation of context from message type
- Easy to filter messages by context
- Supports nested contexts naturally
- Backward compatible (optional field)
- Flexible for any message kind

**Cons:**
- Requires envelope structure change
- Slightly larger message size
- Need to track context IDs

**Example:**
```json
{
  "protocol": "mcpp/v0.1",
  "id": "msg-456",
  "from": "agent-1",
  "kind": "reflection",
  "context": {
    "id": "ctx-789",
    "type": "reasoning",
    "parent": "ctx-123"  // Optional for nested contexts
  },
  "payload": {
    "thought": "This seems like a security risk"
  }
}
```

### Option 3: Payload-Level Context Tracking

Keep context information entirely in the payload.

**Pros:**
- No envelope changes
- Complete flexibility in context structure
- Can be type-specific

**Cons:**
- Can't filter at gateway level
- Every message type needs context support
- No standard way to identify context messages
- Inconsistent implementation across message types

**Example:**
```json
{
  "kind": "mcp/request:tools/call",
  "from": "agent-1",
  "payload": {
    "context": {
      "id": "ctx-789",
      "type": "reasoning"
    },
    "method": "tools/call",
    "params": {...}
  }
}
```

### Option 4: Separate Context Messages

Use explicit messages to start/end contexts, with correlation IDs linking messages.

**Pros:**
- Very explicit context boundaries
- Can include metadata about context
- No envelope changes

**Cons:**
- Requires correlation ID tracking
- More messages (start/end overhead)
- Complex to manage nested contexts
- Messages between start/end need correlation

**Example:**
```json
// Start context
{
  "kind": "context/start",
  "id": "ctx-start-789",
  "payload": {
    "context_id": "ctx-789",
    "type": "reasoning"
  }
}

// Message in context (via correlation)
{
  "kind": "reflection",
  "correlation_id": "ctx-789",
  "payload": {...}
}

// End context
{
  "kind": "context/end",
  "correlation_id": "ctx-789"
}
```

### Option 5: Thread-Based Contexts

Use a `thread_id` field similar to chat applications.

**Pros:**
- Familiar concept from messaging apps
- Simple to implement
- Natural for conversation-like contexts

**Cons:**
- "Thread" implies linear conversation, not parallel reasoning
- Less suitable for nested contexts
- May confuse with chat functionality
- Still requires envelope change

**Example:**
```json
{
  "protocol": "mcpp/v0.1",
  "id": "msg-456",
  "thread_id": "thread-789",
  "kind": "reflection",
  "payload": {...}
}
```

## Implementation Details

### Envelope Structure with Context Field

```typescript
interface Envelope {
  protocol: string;
  id: string;
  ts: string;
  from: string;
  to?: string[];
  kind: string;
  correlation_id?: string;
  context?: {
    id: string;           // Unique context identifier
    type?: string;        // Context type (reasoning, workflow, etc.)
    parent?: string;      // Parent context ID for nesting
    metadata?: Record<string, any>;  // Additional context metadata
  };
  payload: any;
}
```

### Context Lifecycle

1. **Context Creation**: Any message with a new context.id implicitly creates that context
2. **Context Membership**: Messages with same context.id belong to that context
3. **Context Conclusion**: Context ends when no more messages reference it (timeout-based)
4. **No Explicit Start/End**: Contexts are implicit through usage

### Example: Reasoning Context

```json
// First message creates the context
{
  "id": "msg-1",
  "kind": "reflection",
  "context": {
    "id": "reason-789",
    "type": "reasoning",
    "metadata": {
      "trigger": "security-analysis",
      "started_at": "2025-08-31T12:00:00Z"
    }
  },
  "payload": {
    "thought": "Starting security analysis"
  }
}

// Subsequent messages in same context
{
  "id": "msg-2",
  "kind": "mcp/proposal:tools/call",
  "context": {
    "id": "reason-789",
    "type": "reasoning"
  },
  "payload": {...}
}

// Final message still in context
{
  "id": "msg-3",
  "kind": "conclusion",
  "context": {
    "id": "reason-789",
    "type": "reasoning",
    "metadata": {
      "confidence": 0.95,
      "ended_at": "2025-08-31T12:00:30Z"
    }
  },
  "payload": {
    "decision": "Deny the operation"
  }
}

// Action based on reasoning (references context via correlation)
{
  "id": "msg-4",
  "kind": "mcp/response:tools/call",
  "correlation_id": "reason-789",  // Links to context
  "payload": {
    "error": "Operation denied after security analysis"
  }
}
```

### Nested Contexts Example

```json
{
  "id": "msg-10",
  "kind": "reflection",
  "context": {
    "id": "sub-reason-abc",
    "type": "reasoning",
    "parent": "reason-789"  // Nested within parent context
  },
  "payload": {
    "thought": "Deeper analysis needed"
  }
}
```

### Gateway Behavior

The gateway:
- MUST preserve the context field in envelopes
- MAY offer filtering based on context.type or context.id
- SHOULD NOT validate context structure beyond basic syntax
- MUST broadcast context messages normally (unless filtered)

### Participant Behavior

Participants:
- MAY ignore the context field entirely
- MAY filter messages based on context
- MAY use context for message grouping in UI
- SHOULD generate unique context IDs (UUIDs recommended)
- MAY include or exclude context messages when building prompts

### Filtering Strategies

Participants can implement various filtering strategies:

```typescript
// Include everything (default)
const allMessages = messages;

// Exclude all sub-contexts
const mainOnly = messages.filter(m => !m.context);

// Include only specific context types
const withReasoning = messages.filter(m => 
  !m.context || m.context.type === 'reasoning'
);

// Include only conclusion messages from contexts
const conclusions = messages.filter(m =>
  m.context && m.kind === 'conclusion'
);

// Get all messages from a specific context
const contextMessages = messages.filter(m =>
  m.context?.id === 'reason-789'
);
```

## Consequences

### Positive
- **Simple Implementation**: Single optional field in envelope
- **Flexible Filtering**: Participants choose what to include
- **Nested Support**: Natural parent/child relationship
- **Backward Compatible**: Optional field doesn't break existing implementations
- **Gateway Agnostic**: Gateway doesn't need to understand contexts
- **Type Agnostic**: Any message kind can be in a context

### Negative
- **Envelope Change**: Requires protocol version update
- **ID Management**: Participants must generate and track context IDs
- **No Enforcement**: Gateway can't enforce context structure
- **Implicit Lifecycle**: No explicit start/end may cause confusion
- **Memory Growth**: Long-running contexts could accumulate many messages

## Security Considerations

- Context IDs should be unguessable (use UUIDs)
- Malicious actors could create excessive contexts to consume memory
- Context metadata could leak sensitive information
- Rate limiting may need to consider contexts as units
- Nested contexts could be used for DoS attacks (depth limits needed)

## Migration Path

1. Add context field to envelope specification
2. Update SDKs to support context field (backward compatible)
3. Agents can start using contexts immediately
4. Observing participants can add context filtering gradually
5. UIs can add context visualization features

## Future Enhancements

- Context templates for common patterns
- Context compression for transmission
- Context search and replay capabilities
- Cross-pod context correlation
- Automatic context summarization
- Context-based capability rules