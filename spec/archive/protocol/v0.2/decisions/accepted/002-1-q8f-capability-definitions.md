# ADR-q8f: Capability Definition Conventions

**Status:** Accepted  
**Date:** 2025-09-01  
**Context:** MEUP Protocol Draft Specification
**Incorporation:** Complete
**Parent ADR:** 002-0-m3p (Message Kind Namespace Pattern)

## Context

With the adoption of minimal `kind` fields (Option 7 from ADR-m3p), the gateway needs a rich capability definition language to express fine-grained permissions based on payload inspection. This ADR defines conventions for how capabilities are specified, matched, and enforced.

### Decision Drivers
- Need for expressive permission rules
- Performance considerations for payload inspection
- Clarity for administrators configuring capabilities
- Flexibility for future permission patterns
- Caching and optimization opportunities

## Decision

**Option 1 (JSON Pattern Matching)** has been selected as the capability definition convention for the MEUP protocol.

## Options Considered

### Option 1: JSON Pattern Matching (Selected)

Capabilities are defined as JSON objects with pattern matching for both `kind` and payload fields.

**Example Structure:**
```json
{
  "kind": "mcp.request",
  "payload": {
    "method": "tools/*",
    "params": {
      "name": "read_*"
    }
  }
}
```

**Pattern Syntax:**
- `*` - Wildcard
- `**` - Deep match
- `!pattern` - Negative match
- `[value1, value2]` - One of
- `/regex/` - Regular expression

**Pros:**
- Very expressive and flexible
- Familiar JSON syntax
- Supports complex nested patterns
- Can represent any permission rule

**Cons:**
- Verbose configuration
- Performance overhead for deep inspection
- Complex to validate and debug
- Requires JSON parsing for every check

### Option 2: Path-Based Expressions

Use path expressions similar to JSONPath or XPath to define capabilities.

**Example Structure:**
```yaml
capabilities:
  - "mcp.request[method='tools/call'][params.name^='read_']"
  - "mcp.request[method='resources/*']"
  - "chat"
```

**Pros:**
- Compact syntax
- Familiar to developers (similar to CSS selectors, XPath)
- Single string per capability
- Easier to read in lists

**Cons:**
- Need to parse expression language
- Less expressive than full JSON
- Harder to represent complex conditions
- Custom syntax to learn

### Option 3: Simple String Patterns with Payload Hints

Keep string-based patterns but add payload hints in the string.

**Example Structure:**
```json
[
  "mcp.request:tools/call:read_*",
  "mcp.request:resources/read:/public/*",
  "mcp.proposal:*",
  "chat"
]
```

**Pattern Format:** `kind:method:context:arguments`

**Pros:**
- Minimal change from current approach
- Simple string matching
- Easy to understand
- Backward compatible

**Cons:**
- Limited expressiveness
- Can't handle nested conditions
- Ambiguous parsing with colons
- Not flexible enough for complex rules

### Option 4: Rule Engine DSL

Create a domain-specific language for expressing capabilities.

**Example Structure:**
```
allow mcp.request where 
  method matches "tools/*" and
  params.name starts_with "read_"

allow mcp.request where
  method = "resources/read" and
  params.uri matches "/public/**"

deny mcp.request where
  params.name starts_with "delete_"
```

**Pros:**
- Human-readable
- Very expressive
- Can express complex logic
- Clear intent

**Cons:**
- Requires DSL parser
- Another language to learn
- Harder to generate programmatically
- More complex implementation

### Option 5: Hybrid Approach

Use simple strings for common cases, JSON objects for complex patterns.

**Example Structure:**
```json
[
  "mcp.request:tools/list",  // Simple string for basic cases
  "chat",
  {
    "kind": "mcp.request",   // JSON object for complex patterns
    "payload": {
      "method": "tools/call",
      "params": {
        "name": "/^read_.*$/"
      }
    }
  }
]
```

**Pros:**
- Best of both worlds
- Simple cases stay simple
- Complex cases are possible
- Gradual complexity

**Cons:**
- Two formats to support
- Inconsistent configuration
- Harder to validate
- Migration complexity

## Comparison Matrix

| Aspect | JSON Pattern | Path Expression | String Pattern | Rule DSL | Hybrid |
|--------|--------------|-----------------|----------------|----------|--------|
| Expressiveness | High | Medium | Low | High | High |
| Simplicity | Low | Medium | High | Low | Medium |
| Performance | Medium | Medium | High | Low | Medium |
| Familiarity | High | Medium | High | Low | Mixed |
| Implementation | Medium | Hard | Easy | Hard | Hard |
| Debugging | Medium | Hard | Easy | Medium | Hard |
| Backward Compat | No | No | Yes | No | Partial |

## Implementation

The decision to use JSON Pattern Matching was validated through a prototype implementation (see `/sdk/typescript-sdk/capability-matcher`) that successfully demonstrates:

1. **Proven feasibility** - All pattern types work as specified using existing libraries
2. **Performance** - Built-in caching provides acceptable performance
3. **Simplicity** - Clean API with a simple `hasCapability(participant, message)` function
4. **Library support** - Leverages battle-tested libraries rather than custom implementations

### Implementation Libraries

The prototype successfully uses these existing libraries:

#### JavaScript/TypeScript (Validated)
- **micromatch** - Fast glob pattern matching for wildcard patterns (`*`, `**`)
- **jsonpath-plus** - JSONPath expressions for deep object querying
- **lodash** - Utility functions for object comparison and traversal

#### Other Languages (Recommended)
- **Java**: Jayway JsonPath for JSONPath expressions
- **Python**: jsonpath-ng for JSONPath support
- **Go**: doublestar for glob patterns, gjson for JSON path queries
- **Rust**: glob for pattern matching, jsonpath for JSONPath expressions

The implementation combines glob pattern matching (for wildcards) with JSONPath expressions (for deep queries) to provide comprehensive pattern matching capabilities.

## Examples with Recommended Option

### Simple Examples
```json
{
  "kind": "mcp.request",
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "read_file"
    }
  }
}
```
Only allows calling the `read_file` tool.

#### 3. Pattern-Based Tool Permission
```json
{
  "kind": "mcp.request",
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "read_*"
    }
  }
}
```
Allows any tool starting with "read_".

#### 4. Resource Path Restrictions
```json
{
  "kind": "mcp.request",
  "payload": {
    "method": "resources/read",
    "params": {
      "uri": "/public/**"
    }
  }
}
```
Only allows reading resources under `/public/`.

#### 5. Negative Patterns
```json
{
  "kind": "mcp.request",
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "!delete_*"
    }
  }
}
```
Allows any tool EXCEPT those starting with "delete_".

#### 6. Multiple Options
```json
{
  "kind": "mcp.request",
  "payload": {
    "method": ["tools/call", "tools/list"],
    "params": {
      "name": ["read_file", "list_files"]
    }
  }
}
```
Allows specific combinations of methods and tools.

#### 7. Complex Nested Patterns
```json
{
  "kind": "mcp.request",
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "database_query",
      "arguments": {
        "query": "/^SELECT .* FROM public\\..*$/",
        "database": ["production", "staging"]
      }
    }
  }
}
```
Allows database queries only on public tables in specific databases.

## Capability Sets

Participants are assigned arrays of capabilities:

```json
{
  "participantId": "agent-1",
  "capabilities": [
    {
      "kind": "mcp.proposal"
      // No payload pattern = any proposal allowed
    },
    {
      "kind": "mcp.request",
      "payload": {
        "method": "resources/read"
      }
    },
    {
      "kind": "chat"
    }
  ]
}
```

## Evaluation Algorithm

```javascript
function hasCapability(participant, message) {
  for (const capability of participant.capabilities) {
    // Check kind match
    if (!matchesPattern(capability.kind, message.kind)) {
      continue;
    }
    
    // If no payload pattern, capability matches
    if (!capability.payload) {
      return true;
    }
    
    // Check payload pattern match
    if (matchesPayloadPattern(capability.payload, message.payload)) {
      return true;
    }
  }
  return false;
}
```

## Performance Optimizations

### Caching Strategy

1. **Pattern Compilation**: Compile patterns once during configuration
2. **Decision Caching**: Cache permission decisions by hash of (participant, kind, payload signature)
3. **Fast Path**: Check `kind` first before expensive payload inspection
4. **Pattern Indexing**: Build indexes for common patterns

### Example Cache Entry

```json
{
  "key": "agent-1:mcp.request:tools/call:read_file",
  "decision": "allow",
  "timestamp": "2025-08-26T14:00:00Z",
  "ttl": 300
}
```

## Migration from Current Spec

Current capability format:
```json
["mcp/request:tools/*", "chat"]
```

New capability format:
```json
[
  {
    "kind": "mcp.request",
    "payload": {
      "method": "tools/*"
    }
  },
  {
    "kind": "chat"
  }
]
```

### Backward Compatibility

Gateways MAY support both formats during transition:
- String format: Parse as before for simple patterns
- Object format: Use new payload inspection

## Security Considerations

1. **Pattern Complexity**: Complex patterns increase processing time and DoS risk
2. **Cache Poisoning**: Ensure cache keys include all relevant payload fields
3. **Pattern Overlap**: Multiple patterns might match; use first-match or most-specific
4. **Negative Patterns**: Be careful with `!` patterns as they can be confusing
5. **Regular Expressions**: Limit regex complexity to prevent ReDoS attacks

## Consequences

### Positive
- **Flexibility**: Can express complex permission rules
- **Granularity**: Fine-grained control over operations
- **Extensibility**: Easy to add new pattern types
- **Performance**: Caching mitigates inspection overhead
- **Library ecosystem**: Can leverage existing, well-tested pattern matching libraries
- **Proven implementation**: Prototype validates the approach works as designed

### Negative
- **Complexity**: More complex than simple string matching
- **Performance**: Payload inspection adds latency (mitigated by caching)
- **Debugging**: Harder to understand why permission was granted/denied
- **Configuration**: More verbose capability definitions

## Future Enhancements

1. **Capability Templates**: Reusable capability definitions
2. **Dynamic Capabilities**: Time-based or conditional capabilities
3. **Capability Inheritance**: Hierarchical capability sets
4. **Audit Integration**: Log which capability allowed/denied each operation
5. **GUI Builder**: Visual tool for creating capability patterns