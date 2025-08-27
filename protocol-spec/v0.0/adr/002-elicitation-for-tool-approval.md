# ADR-002: Using Elicitation for Tool Approval in MCPx

## Status
PROPOSED

## Context

MCP's elicitation pattern allows servers to request structured information from users through clients during interactions. While designed for gathering user input (like forms), this pattern could potentially be adapted for tool approval workflows.

### Current MCP Elicitation Pattern

In MCP, elicitation works as follows:
1. Server sends `elicitation/create` request to client
2. Client presents UI to user
3. User responds with action: `accept`, `decline`, or `cancel`
4. Client returns response to server

### The Tool Approval Challenge in MCPx

In MCPx's multi-agent environment:
- Agent A wants to call Agent B's tool
- Agent B needs approval (possibly from a human) before executing
- The approval request needs to flow through the network to the appropriate authorizer

## Decision

MCPx will extend the elicitation pattern to support tool approval workflows, allowing agents to request approval for tool calls through the same mechanism used for gathering user input.

### Approach: Elicitation-Based Tool Approval

#### 1. Tool Call Interception

When Agent B receives a tool call requiring approval, instead of executing it immediately, it initiates an elicitation:

```json
{
  "protocol": "mcp-x/v0",
  "id": "msg-456",
  "ts": "2024-01-01T12:00:00Z",
  "from": "agent-b",
  "to": ["user-1"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": "elicit-123",
    "method": "elicitation/create",
    "params": {
      "message": "Agent A requests permission to execute 'dangerous_operation'",
      "requestedSchema": {
        "type": "object",
        "properties": {
          "approve": {
            "type": "boolean",
            "title": "Approve this tool call?",
            "description": "Tool: dangerous_operation\nCaller: agent-a\nArguments: {target: 'production'}"
          },
          "reason": {
            "type": "string",
            "title": "Reason (optional)",
            "description": "Provide a reason for your decision"
          }
        },
        "required": ["approve"]
      },
      "metadata": {
        "elicitationType": "tool_approval",
        "originalRequest": {
          "from": "agent-a",
          "tool": "dangerous_operation",
          "arguments": {"target": "production"},
          "requestId": "original-req-123"
        }
      }
    }
  }
}
```

#### 2. User Response

The user (or authorizing agent) responds through the standard elicitation response:

```json
{
  "protocol": "mcp-x/v0",
  "id": "msg-457",
  "ts": "2024-01-01T12:00:30Z",
  "from": "user-1",
  "to": ["agent-b"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": "elicit-123",
    "result": {
      "action": "accept",
      "content": {
        "approve": true,
        "reason": "Approved for scheduled maintenance"
      }
    }
  }
}
```

#### 3. Tool Execution Based on Elicitation

Agent B processes the elicitation response and either executes or rejects the original tool call:

```json
{
  "protocol": "mcp-x/v0",
  "id": "msg-458",
  "ts": "2024-01-01T12:00:31Z",
  "from": "agent-b",
  "to": ["agent-a"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": "original-req-123",
    "result": {
      "content": [{
        "type": "text",
        "text": "Operation completed (approved by user-1)"
      }]
    }
  }
}
```

### Enhanced Elicitation Patterns for MCPx

#### Pattern 1: Direct Approval Elicitation
Simple boolean approval with optional reason (as shown above).

#### Pattern 2: Detailed Parameter Review
Allow users to review and potentially modify tool parameters:

```json
{
  "requestedSchema": {
    "type": "object",
    "properties": {
      "approve": {
        "type": "boolean",
        "title": "Approve execution?"
      },
      "modifiedTarget": {
        "type": "string",
        "title": "Target system",
        "default": "production",
        "enum": ["production", "staging", "development"]
      },
      "timeout": {
        "type": "number",
        "title": "Timeout (seconds)",
        "default": 30,
        "minimum": 1,
        "maximum": 300
      }
    }
  }
}
```

#### Pattern 3: Delegated Approval Chain
Support for forwarding approval requests:

```json
{
  "requestedSchema": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["approve", "deny", "delegate"],
        "enumNames": ["Approve", "Deny", "Delegate to another user"]
      },
      "delegateTo": {
        "type": "string",
        "title": "Delegate to (participant ID)",
        "description": "Only required if action is 'delegate'"
      }
    }
  }
}
```

### Protocol Extensions

#### 1. Elicitation Metadata
Add optional `metadata` field to elicitation requests to indicate type and context:

```json
{
  "metadata": {
    "elicitationType": "tool_approval",
    "timeout": 300,
    "priority": "high",
    "originalRequest": {...}
  }
}
```

#### 2. Async Elicitation Support
Since tool approvals may take time, support async patterns:
- Elicitation requests can include correlation IDs
- Responses can arrive after significant delay
- Original caller can be notified of pending approval

## Consequences

### Positive
- **Reuses Existing Pattern**: Leverages MCP's elicitation mechanism rather than creating new protocol messages
- **Rich UI Support**: Elicitation's schema-based approach enables rich approval UIs
- **Flexible**: Can handle simple yes/no approvals or complex parameter reviews
- **User-Friendly**: Familiar form-like interface for approvals

### Negative  
- **Semantic Overload**: Elicitation was designed for gathering information, not authorization
- **Schema Limitations**: Elicitation schemas are limited to flat objects with primitives
- **No Native Audit**: Elicitation responses aren't inherently tracked as authorization decisions
- **Indirect Flow**: Approval happens through side-channel rather than inline with tool call

### Neutral
- **MCP Compatibility**: Uses standard MCP patterns but extends their semantics
- **Implementation Complexity**: Similar complexity to dedicated authorization messages

## Implementation Considerations

1. **Timeout Handling**: Tool calls blocked on elicitation need timeout management
2. **Response Correlation**: Must correctly map elicitation responses to pending tool calls  
3. **Error Handling**: Need clear errors when elicitation is declined/cancelled
4. **Audit Logging**: Should log tool approval decisions separately from regular elicitations
5. **Performance**: Elicitation adds latency to tool calls

## Alternatives Considered

1. **Dedicated Authorization Protocol** (See ADR-001)
   - Pros: Cleaner semantics, purpose-built for authorization
   - Cons: New protocol messages to implement

2. **Client-Side Only** (MCP approach)
   - Pros: Simple, no protocol changes needed
   - Cons: Doesn't work for cross-agent tool calls in MCPx

3. **Hybrid Approach**
   - Use elicitation for user approvals
   - Use dedicated protocol for agent-to-agent authorization
   - Pros: Best of both worlds
   - Cons: More complex, two patterns to maintain

## Recommendation

While elicitation CAN be used for tool approval, it may be better to:

1. **Short term**: Use elicitation for tool approval as it requires no new protocol messages
2. **Long term**: Develop dedicated authorization protocol (ADR-001) for cleaner semantics
3. **Consider hybrid**: Use elicitation for human approvals, dedicated protocol for automated/policy-based authorization

The elicitation approach is particularly well-suited for scenarios requiring human review and approval, where the form-like interface is beneficial.

## References

- MCP Elicitation Specification: `/modelcontextprotocol/docs/specification/draft/client/elicitation.mdx`
- MCP Tools Specification: `/modelcontextprotocol/docs/specification/draft/server/tools.mdx`
- ADR-001 Tool Authorization: `/protocol-spec/v0/adr/001-tool-authorization.md`