# ADR-001: Tool Authorization in MCPx

## Status
PROPOSED

## Context

MCPx enables multiple agents to interact in shared topics/rooms, where agents can discover and invoke each other's tools. This creates a need for authorization mechanisms that go beyond what standard MCP provides.

In MCP, tool authorization is handled at the client implementation level with guidelines but no protocol-level enforcement. Clients are trusted to prompt users for confirmation on sensitive operations. This approach works well for single-client scenarios but is insufficient for MCPx's multi-agent environment where:

1. Tool calls cross agent boundaries
2. Authorization may need to come from the tool owner, not the caller
3. Multiple participants may need visibility into authorization decisions
4. Audit trails are required for compliance and debugging

## Decision

MCPx will implement protocol-level tool authorization through a new message flow that allows tool owners to approve, deny, or delegate authorization for incoming tool calls.

### Authorization Flow

#### 1. Authorization Request Message

When an agent receives a tool call that requires authorization, it can respond with an authorization request instead of immediately executing the tool:

```json
{
  "protocol": "mcp-x/v0",
  "id": "auth-req-123",
  "ts": "2024-01-01T12:00:00Z",
  "from": "agent-b",
  "to": ["agent-a"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": "original-request-id",
    "error": {
      "code": -32001,
      "message": "Authorization required",
      "data": {
        "authorizationRequest": {
          "id": "auth-123",
          "tool": "dangerous_operation",
          "arguments": {"target": "production"},
          "requester": "agent-a",
          "reason": "Tool requires user approval for production operations",
          "expiresAt": "2024-01-01T12:05:00Z"
        }
      }
    }
  }
}
```

#### 2. Authorization Decision Notification

The agent can then emit a notification to request authorization (potentially to a human operator or authorization service):

```json
{
  "protocol": "mcp-x/v0",
  "id": "auth-notify-123",
  "ts": "2024-01-01T12:00:01Z",
  "from": "agent-b",
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "method": "notifications/authorization/request",
    "params": {
      "id": "auth-123",
      "tool": "dangerous_operation",
      "arguments": {"target": "production"},
      "requester": "agent-a",
      "reason": "Tool requires user approval for production operations"
    }
  }
}
```

#### 3. Authorization Response

Once authorization is granted or denied, the authorizing party sends an authorization response:

```json
{
  "protocol": "mcp-x/v0",
  "id": "auth-resp-123",
  "ts": "2024-01-01T12:00:30Z",
  "from": "user-1",
  "to": ["agent-b"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "method": "authorization/respond",
    "params": {
      "authorizationId": "auth-123",
      "decision": "approve", // or "deny"
      "reason": "Approved for maintenance window",
      "validUntil": "2024-01-01T13:00:00Z"
      }
  }
}
```

#### 4. Tool Execution or Denial

Based on the authorization response, the agent either executes the tool or returns an error:

**If approved:**
```json
{
  "protocol": "mcp-x/v0",
  "id": "tool-resp-123",
  "ts": "2024-01-01T12:00:31Z",
  "from": "agent-b",
  "to": ["agent-a"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": "original-request-id",
    "result": {
      "content": [{
        "type": "text",
        "text": "Operation completed successfully"
      }]
    }
  }
}
```

**If denied:**
```json
{
  "protocol": "mcp-x/v0",
  "id": "tool-resp-123",
  "ts": "2024-01-01T12:00:31Z",
  "from": "agent-b",
  "to": ["agent-a"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": "original-request-id",
    "error": {
      "code": -32002,
      "message": "Authorization denied",
      "data": {
        "reason": "User denied authorization"
      }
    }
  }
}
```

### Authorization Modes

Agents can operate in different authorization modes:

1. **Always Allow**: Execute all tool calls immediately (default for backward compatibility)
2. **Always Prompt**: Require authorization for all tool calls
3. **Selective**: Require authorization based on tool configuration or caller identity
4. **Delegated**: Forward authorization decisions to another participant

### Tool Metadata Extension

Tools can declare their authorization requirements:

```json
{
  "name": "dangerous_operation",
  "description": "Performs a dangerous operation",
  "inputSchema": {...},
  "authorization": {
    "required": true,
    "mode": "user_approval", // or "automatic", "delegated"
    "timeout": 300, // seconds
    "message": "This operation affects production systems"
  }
}
```

## Consequences

### Positive
- **Enhanced Security**: Protocol-level authorization prevents unauthorized tool execution
- **Audit Trail**: All authorization decisions are captured in the message flow
- **Flexibility**: Supports multiple authorization patterns (immediate, async, delegated)
- **User Control**: Humans can maintain control over sensitive operations
- **Interoperability**: Standardized authorization ensures consistent behavior across implementations

### Negative
- **Increased Complexity**: Adds new message types and flows to implement
- **Latency**: Authorization adds delay to tool execution
- **State Management**: Agents must track pending authorizations
- **Backward Compatibility**: Need to maintain compatibility with agents that don't support authorization

### Neutral
- **Optional Implementation**: Authorization can be optional, with agents defaulting to "always allow"
- **MCP Alignment**: Diverges from MCP's client-centric approach but maintains compatibility
- **Gateway Role**: Gateways may need to participate in authorization flows for web-based users

## Implementation Considerations

1. **Timeout Handling**: Authorization requests should timeout to prevent indefinite blocking
2. **Caching**: Authorization decisions could be cached for repeated operations
3. **Revocation**: Need mechanism to revoke previously granted authorizations
4. **Policy Engine**: Agents could integrate with policy engines for automated decisions
5. **UI/UX**: Human-facing agents need clear UI for authorization prompts

## Alternatives Considered

1. **Client-Side Only** (MCP approach): Leave authorization to client implementation
   - Rejected: Insufficient for multi-agent scenarios

2. **Capability-Based Security**: Use capability tokens for authorization
   - Rejected: Too complex for initial implementation

3. **Role-Based Access Control**: Define roles and permissions
   - Rejected: Requires centralized authority, against MCPx's distributed nature

4. **Smart Contract Style**: Use blockchain or consensus mechanisms
   - Rejected: Over-engineered for the use case

## References

- MCP Tool Specification: `/modelcontextprotocol/docs/specification/draft/server/tools.mdx`
- MCP Authorization Specification: `/modelcontextprotocol/docs/specification/draft/basic/authorization.mdx`
- MCP Elicitation Pattern: `/modelcontextprotocol/docs/specification/draft/client/elicitation.mdx`
- Investigation Notes: `/protocol-spec/v0/adr/001-tool-authorization-investigation.md`