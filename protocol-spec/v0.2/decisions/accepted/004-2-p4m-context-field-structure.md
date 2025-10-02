# ADR-p4m: Context Field Structure and Patterns

**Status:** Accepted
**Date:** 2025-08-31
**Context:** MEUP/MEUP Protocol Draft Specification
**Incorporation:** Complete
**Parent ADR:** 005-1-k9j (Sub-Context Protocol Mechanics)

## Context

ADR-k9j established that we should use an optional `context` field in the envelope structure to support sub-contexts. This ADR focuses on defining the exact structure and contents of that context field, establishing patterns for its use, and ensuring it meets all requirements while remaining simple and extensible.

Key requirements for the context field:
- Support various context types (reasoning, workflow, delegation, etc.)
- Enable nesting and parent-child relationships
- Allow filtering and selective processing
- Maintain simplicity and avoid over-engineering
- Support both ephemeral and persistent contexts
- Enable correlation without confusion with correlation_id

### Decision Drivers
- Minimize field complexity while maintaining flexibility
- Clear semantics that don't overlap with existing fields
- Support common use cases without prescribing implementation
- Enable efficient filtering and processing
- Avoid ambiguity in field meanings
- Consider future extensibility

## Decision

**Use a simple string context field with path-based hierarchy**

The context field should be just a string that can optionally use path notation (e.g., `parent/child/grandchild`) to represent hierarchy.

## Options Considered

### Option 1: Simple String (Flat)

Context field is just a string identifier with no hierarchy.

```typescript
context?: string;  // Just an ID like "ctx-789" or "reasoning-abc"
```

**Pros:**
- Maximum simplicity
- No parsing required
- Smallest message size
- No schema validation needed

**Cons:**
- No built-in hierarchy (need separate parent tracking)
- No type information
- Relationships must use correlation_id

**Example:**
```json
{
  "context": "ctx-789",
  "kind": "reflection",
  "payload": {...}
}
```

### Option 2: Path-Based Hierarchy (Recommended)

Context ID uses forward-slash notation for natural hierarchy.

```typescript
context?: string;  // Path like "ctx-789" or "ctx-789/sub-abc" or "ctx-789/sub-abc/detail-xyz"
```

**Pros:**
- Still just a simple string field
- Natural hierarchy representation
- Easy to parse parent from path
- Familiar pattern (URLs, file paths)
- Self-documenting structure
- Can extract depth, parent, root easily

**Cons:**
- Need to parse for parent extraction
- Could get long with deep nesting
- Path separator choice matters

**Examples:**
```json
// Root context
{
  "context": "reason-789",
  "kind": "reflection",
  "payload": {"thought": "Starting analysis"}
}

// Nested context
{
  "context": "reason-789/security-check",
  "kind": "mcp/request:tools/call",
  "payload": {...}
}

// Deeply nested
{
  "context": "reason-789/security-check/permission-scan",
  "kind": "reflection",
  "payload": {"thought": "Checking file permissions"}
}
```

### Option 3: Object with ID and Type

Context object with id and type fields.

```typescript
context?: {
  id: string;
  type?: string;
}
```

**Pros:**
- Simple but useful
- Enables type-based filtering
- Clear semantics
- Small message size

**Cons:**
- No nesting support
- No additional metadata
- May need extension later

**Example:**
```json
{
  "context": {
    "id": "ctx-789",
    "type": "reasoning"
  },
  "kind": "reflection",
  "payload": {...}
}
```

### Option 4: Object Structure with Parent

Simple object with id, optional type, and optional parent for nesting.

```typescript
context?: {
  id: string;
  type?: string;
  parent?: string;  // Parent context ID
}
```

**Pros:**
- Supports all core use cases
- Simple and predictable
- Enables nesting without complexity
- Easy to filter and process
- No nested objects

**Cons:**
- No arbitrary metadata
- Parent is just an ID (no type info)

**Example:**
```json
{
  "context": {
    "id": "sub-ctx-abc",
    "type": "analysis",
    "parent": "ctx-789"
  },
  "kind": "reflection",
  "payload": {...}
}
```

### Option 4: Nested Parent Structure

Parent as an object with its own type.

```typescript
context?: {
  id: string;
  type?: string;
  parent?: {
    id: string;
    type?: string;
  }
}
```

**Pros:**
- Parent type information available
- More structured relationships

**Cons:**
- More complex
- Recursive structure implications
- Larger message size
- Over-engineered for most uses

**Example:**
```json
{
  "context": {
    "id": "sub-ctx-abc",
    "type": "analysis",
    "parent": {
      "id": "ctx-789",
      "type": "reasoning"
    }
  }
}
```

### Option 5: Full Metadata Support

Include arbitrary metadata field.

```typescript
context?: {
  id: string;
  type?: string;
  parent?: string;
  metadata?: Record<string, any>;
}
```

**Pros:**
- Maximum flexibility
- Extensible without schema changes
- Supports any future needs

**Cons:**
- Encourages inconsistency
- No schema validation
- Potential for abuse
- Larger messages
- Complexity creep

**Example:**
```json
{
  "context": {
    "id": "ctx-789",
    "type": "reasoning",
    "metadata": {
      "confidence": 0.95,
      "trigger": "security-check",
      "custom_field": "anything"
    }
  }
}
```

### Option 6: Labels/Tags Approach

Use labels array instead of type.

```typescript
context?: {
  id: string;
  labels?: string[];
  parent?: string;
}
```

**Pros:**
- Multiple categorizations possible
- Flexible tagging system
- Familiar from k8s/cloud systems

**Cons:**
- Array processing overhead
- Ambiguous semantics
- Harder to standardize

**Example:**
```json
{
  "context": {
    "id": "ctx-789",
    "labels": ["reasoning", "security", "critical"],
    "parent": "ctx-456"
  }
}
```

## Implementation Details

### Recommended Context Field Structure

```typescript
interface Envelope {
  // ... other fields ...
  context?: string;  // Path-based hierarchy like "parent/child/grandchild"
  // ... other fields ...
}
```

### Path-Based Hierarchy Format

Use forward slashes for hierarchy, similar to URL paths:

```
<root-id>[/<child-id>[/<grandchild-id>...]]
```

Rules:
- Forward slash (`/`) as separator
- No leading or trailing slashes
- Each segment should be a valid identifier (alphanumeric + dash/underscore)
- Maximum depth is implementation-specific (suggest 5 levels)
- IDs should be short but meaningful

### Context Operations

```typescript
// Get root context from path
function getRootContext(context: string): string {
  return context.split('/')[0];
}

// Get parent context (if any)
function getParentContext(context: string): string | null {
  const parts = context.split('/');
  return parts.length > 1 
    ? parts.slice(0, -1).join('/')
    : null;
}

// Check if context is nested
function isNestedContext(context: string): boolean {
  return context.includes('/');
}

// Get context depth
function getContextDepth(context: string): number {
  return context.split('/').length;
}

// Check if one context is ancestor of another
function isAncestor(ancestor: string, descendant: string): boolean {
  return descendant.startsWith(ancestor + '/');
}
```

### Context Examples

#### Simple Reasoning Context

```json
// Start reasoning
{
  "id": "msg-1",
  "context": "reason-789",
  "kind": "reflection",
  "payload": {"thought": "Analyzing request"}
}

// Nested analysis
{
  "id": "msg-2", 
  "context": "reason-789/security",
  "kind": "mcp/request:tools/call",
  "payload": {...}
}

// Even deeper
{
  "id": "msg-3",
  "context": "reason-789/security/permissions",
  "kind": "reflection",
  "payload": {"thought": "Insufficient permissions"}
}

// Back to main reasoning
{
  "id": "msg-4",
  "context": "reason-789",
  "kind": "conclusion",
  "payload": {"decision": "Deny due to permissions"}
}
```

#### Workflow with Subtasks

```json
// Main workflow
{
  "context": "deploy-abc",
  "kind": "workflow/start",
  "payload": {...}
}

// Subtask 1
{
  "context": "deploy-abc/build",
  "kind": "mcp/request:tools/call",
  "payload": {...}
}

// Subtask 2 (parallel with 1)
{
  "context": "deploy-abc/test",
  "kind": "mcp/request:tools/call",
  "payload": {...}
}

// Nested in subtask 2
{
  "context": "deploy-abc/test/unit-tests",
  "kind": "reflection",
  "payload": {...}
}
```

### Filtering Strategies

```typescript
// All messages in a context tree
function getContextTree(messages: Message[], rootContext: string) {
  return messages.filter(m => 
    m.context === rootContext || 
    m.context?.startsWith(rootContext + '/')
  );
}

// Direct children only
function getDirectChildren(messages: Message[], parentContext: string) {
  const parentDepth = parentContext.split('/').length;
  return messages.filter(m => {
    if (!m.context?.startsWith(parentContext + '/')) return false;
    const childDepth = m.context.split('/').length;
    return childDepth === parentDepth + 1;
  });
}

// Exclude all sub-contexts
function mainContextOnly(messages: Message[]) {
  return messages.filter(m => !m.context);
}

// Get root contexts only (no parent)
function getRootContexts(messages: Message[]) {
  return messages.filter(m => 
    m.context && !m.context.includes('/')
  );
}
```

### Relationship to correlation_id

The `context` and `correlation_id` fields serve different purposes:

- **context**: Groups related messages into logical units (hierarchical)
- **correlation_id**: Links responses to requests or actions to triggers (point-to-point)

A message can have both:

```json
{
  "id": "msg-123",
  "context": "reason-789/security",  // Part of reasoning hierarchy
  "correlation_id": "proposal-456",    // Fulfills this proposal
  "kind": "mcp/request:tools/call",
  "payload": {...}
}
```

## Consequences

### Positive
- **Maximum Simplicity**: Just a string field, no objects or arrays
- **Natural Hierarchy**: Path notation is familiar and intuitive
- **Self-Contained**: Hierarchy encoded in the ID itself
- **Efficient**: Fast string operations, minimal parsing
- **Human-Readable**: Paths are self-documenting
- **Flexible**: Can embed type info in segment names if needed

### Negative
- **No Explicit Type**: Must infer from ID or use conventions
- **String Parsing**: Need to split strings for hierarchy operations
- **Length Concerns**: Deep nesting creates longer strings
- **No Validation**: Any string is valid (could be garbage)
- **Convention-Based**: Relies on consistent path formatting

## Security Considerations

- Path traversal attacks not applicable (these aren't file paths)
- Maximum depth should be enforced to prevent DoS (suggest 5 levels)
- IDs should be sanitized if displayed in UIs
- Avoid sensitive information in context IDs
- Consider length limits for context strings (suggest 255 chars)

## Migration Path

1. Update envelope schema to simple string context field
2. Document path-based hierarchy convention
3. Provide helper functions in SDKs
4. Existing messages work unchanged (field is optional)
5. Establish conventions for common context patterns

## Future Enhancements

- Context templates for common patterns
- Context-aware capabilities (e.g., can filter by context prefix)
- Context summarization for long chains
- Cross-space context correlation
- Context visualization standards
- Optional type prefixes in path segments