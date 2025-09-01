# Decision 002: Including Request Context in Response Envelopes

## Status
Proposed

## Context

In the current v0.1 spec, response envelopes use `kind: "mcp/response:METHOD"` (e.g., `mcp/response:tools/call`), but this doesn't include enough context to interpret the response payload without the original request (which a client is not guaranteed to have because of history limits).

### Problem

When a response envelope is viewed in isolation (e.g., in logs, history replay, or debugging):
- We know it's a response to `tools/call`
- We don't know WHICH tool was called
- We can't properly parse the `result` structure without knowing the tool
- Different tools return different result structures (text, base64, structured data, etc.)

This is especially problematic in MCPx because:
1. **Late-joining participants** receive limited history and may never see the original request
2. **Broadcast nature** means many observers see responses without making the request
3. **History limits** mean the correlated request may have been dropped from the buffer
4. **Multi-agent scenarios** have many concurrent operations making correlation harder
5. **Audit logs** need to be self-contained for compliance and debugging

Example ambiguous response:
```json
{
  "kind": "mcp/response:tools/call",
  "correlation_id": "env-call-1",
  "payload": {
    "jsonrpc": "2.0",
    "id": 42,
    "result": {
      "content": [{
        "type": "text",
        "text": "Operation completed"
      }]
    }
  }
}
```

Without the original request, we don't know if this is from `read_file`, `execute_command`, `query_database`, etc.

## Options Considered

### Option 1: Include Full Method Path in Kind
Extend the kind to include the full method path:
```json
{
  "kind": "mcp/response:tools/call:read_file",
  "payload": { ... }
}
```

**Pros:**
- Complete context in the envelope metadata
- Easy to route and filter by specific tool
- No payload changes needed

**Cons:**
- Non-standard extension to MCP method names
- Breaks the clean METHOD mapping
- Requires parsing kind string to extract tool name

### Option 2: Add Request Context to Response Payload (RECOMMENDED)
Include the original method and params in the response payload:
```json
{
  "kind": "mcp/response:tools/call",
  "correlation_id": "env-call-1",
  "payload": {
    "jsonrpc": "2.0",
    "id": 42,
    "method": "tools/call",
    "params": {
      "name": "read_file",
      "arguments": { "path": "/tmp/test.txt" }
    },
    "result": {
      "content": [{
        "type": "text",
        "text": "File contents here"
      }]
    }
  }
}
```

**Pros:**
- Follows JSON-RPC patterns (some implementations include method in responses)
- Self-contained responses with full context
- Maintains clean kind format
- Useful for debugging and audit logs
- Supports history replay without correlation lookup

**Cons:**
- Increases message size (duplicates request info)
- Deviates from standard MCP response format
- Redundant when correlation_id is available

### Option 3: Status Quo with Documentation
Keep current format but document the limitation:
```json
{
  "kind": "mcp/response:tools/call",
  "correlation_id": "env-call-1",  // REQUIRED for context
  "payload": { ... standard MCP response ... }
}
```

**Pros:**
- No protocol changes needed
- Maintains pure MCP compatibility
- Smaller message size

**Cons:**
- Responses not self-contained
- Requires correlation lookup for context
- Poor debugging/observability experience
- History replay requires full message chain

## Recommendation

**Adopt Option 1**: Include full method path in kind.

### Proposed Implementation

1. **Extend the kind format** to include the full operation context:

For tool calls:
```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-resp-1",
  "from": "target-agent",
  "to": ["requester"],
  "kind": "mcp/response:tools/call:read_file",  // Extended with tool name
  "correlation_id": "env-call-1",
  "payload": {
    "jsonrpc": "2.0",
    "id": 42,
    "result": {                    // Pure MCP response, unchanged
      "content": [{
        "type": "text",
        "text": "File contents here"
      }]
    }
  }
}
```

For resource operations:
```json
{
  "kind": "mcp/response:resources/read:config.json",  // Extended with resource URI
  "payload": { /* standard MCP response */ }
}
```

For prompt operations:
```json
{
  "kind": "mcp/response:prompts/get:debug_prompt",  // Extended with prompt name
  "payload": { /* standard MCP response */ }
}
```

2. **Format specification**:
   - Tool operations: `mcp/[request|response|proposal]:tools/[call|list][:tool_name]`
   - Resource operations: `mcp/[request|response|proposal]:resources/[read|list|subscribe][:resource_uri]`
   - Prompt operations: `mcp/[request|response|proposal]:prompts/[get|list][:prompt_name]`
   - Completion operations: `mcp/[request|response|proposal]:completion/complete[:ref]`

3. **Capability implications**:
   Capabilities can now be more granular:
   ```json
   {
     "capabilities": [
       "mcp/request:tools/call:read_file",      // Can call read_file tool
       "mcp/request:tools/call:write_*",        // Can call any write tool
       "mcp/proposal:tools/call:delete_file",   // Can only propose delete_file
       "mcp/response:*"                         // Can send any response
     ]
   }
   ```

### Backward Compatibility

- Old format (`mcp/response:tools/call`) remains valid
- Extended format (`mcp/response:tools/call:read_file`) is RECOMMENDED for new implementations
- Capability matching supports wildcards for compatibility
- MCP payloads remain completely unchanged

### Implementation Guidelines

1. **When sending requests/responses**:
   - Include the specific tool/resource/prompt name in the kind
   - Use the extended format for better observability
   - Maintain correlation_id for request/response linking

2. **When matching capabilities**:
   - `mcp/request:tools/call:*` matches all tool calls
   - `mcp/request:tools/call:read_*` matches tools starting with "read_"
   - `mcp/request:tools/call` matches any tool call (backward compatible)

3. **Gateway behavior**:
   - Gateway remains simple - just matches kind against capabilities
   - No need to parse MCP payloads
   - No state tracking required

## Consequences

### Positive
- **Clean separation**: MCPx remains a pure wrapper, MCP payloads untouched
- **Self-contained messages**: Response kind tells you everything about the operation
- **Fine-grained capabilities**: Can control access to specific tools/resources
- **Better observability**: Can filter/route based on specific operations
- **Simpler clients**: Parse MCPx envelope OR MCP payload, never both for same info
- **Gateway simplicity**: No payload inspection needed

### Negative
- Kind strings become longer with full context
- Requires parsing kind string to extract operation details
- Need to standardize delimiter (`:`) usage

## Migration Path

1. **Phase 1**: Update spec to support extended kind format
2. **Phase 2**: Update agents to generate extended kinds
3. **Phase 3**: Update capability matching to leverage extended format
4. **Phase 4**: Deprecate short format in v0.2

## Decision Rationale

Option 1 is superior because:
1. **Maintains MCPx as pure wrapper**: No modifications to MCP payloads
2. **Enables capability granularity**: Can control access to specific tools
3. **Simpler mental model**: Kind describes the operation completely
4. **Better separation of concerns**: MCPx handles routing, MCP handles content
5. **Cleaner implementation**: Clients parse envelope XOR payload, not both