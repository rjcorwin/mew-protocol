# MCPx v0.1 Protocol Specification

Status: v0.1  
Date: 2025-08-26  
Intended Status: Experimental  
Editors: MCPx Working Group

---

## Requirements Language

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119 and RFC 8174.

---

## 1. Abstract

MCPx defines a minimal, topic-based meta-message format and a realtime gateway API that allows multiple MCP servers (agents/humans/robots) to interoperate in shared "rooms" with built-in security through privilege separation.

- Every participant behaves like an MCP server
- Messages are published to a topic and are visible to all participants
- A gateway-enforced privilege system prevents unauthorized tool execution
- MCP (JSON-RPC 2.0) requests/responses are encapsulated inside a simple envelope

This v0.1 extends v0 with security mechanisms while maintaining backward compatibility for trusted environments.

---

## 2. Goals and Non-Goals

### 2.1 Goals
- **Security**: Prevent rogue agents from executing unauthorized tools through privilege separation
- **Simplicity**: Gateway remains tool-agnostic, tracking only connection privileges
- **Human oversight**: Enable human-in-the-loop patterns for untrusted agents
- **Backward compatibility**: Support both secure and open modes of operation
- **Interop**: Maintain MCP server model for all participants

### 2.2 Non-Goals
- End-to-end encryption or private DMs (use separate topics or higher-layer crypto)
- Fine-grained per-tool permissions at gateway level (gateway remains tool-agnostic)
- Schema registries or complex ACL systems
- Topic lifecycle management

---

## 3. Security Model

### 3.1 Privilege Levels

The gateway assigns one of two privilege levels to each connection:

1. **Full Privilege** (`full`):
   - Can send `mcp` messages (all MCP operations)
   - Can send `mcp/proposal` messages
   - Typically assigned to trusted agents and human users
   - Can fulfill proposals from restricted participants

2. **Restricted Privilege** (`restricted`):
   - CANNOT send `mcp` messages (gateway blocks them)
   - Can only send `mcp/proposal` messages
   - Requires a full-privilege participant to fulfill proposals
   - Assigned to untrusted or new agents

### 3.2 Gateway Enforcement

The gateway enforces privileges at the transport layer:
- Inspects the `kind` field of all messages
- Blocks `kind: "mcp"` messages from restricted participants
- Returns error responses for blocked attempts
- Remains completely MCP-agnostic (doesn't parse or understand MCP operations)

---

## 4. Message Envelope

All data flowing over a topic MUST be a single top-level JSON envelope:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "2f6b6e70-7b36-4b8b-9ad8-7c4f7d0e2d0b",
  "ts": "2025-08-26T14:00:00Z",
  "from": "robot-alpha",
  "to": ["coordinator"],
  "kind": "mcp",
  "correlation_id": "env-1",
  "payload": { /* kind-specific body */ }
}
```

Field semantics:
- `protocol`: MUST be `"mcpx/v0.1"` for this version
- `id`: globally unique message id (e.g., UUIDv4)
- `ts`: RFC3339 timestamp
- `from`: stable participant id within the topic
- `to`: array of participant ids (empty/omitted = broadcast)
- `kind`: one of `mcp`, `mcp/proposal`, `chat`, `presence`, `system`
- `correlation_id`: references the envelope being responded to
- `payload`: object; structure depends on `kind`

### 4.1 MCP Encapsulation (kind = "mcp")

The payload for `kind: "mcp"` MUST contain an embedded JSON-RPC 2.0 message exactly as defined by MCP. No custom methods are added to the MCP namespace.

#### 4.1.1 Tool Calls (Full Privilege Only)

Participants with full privilege can make direct MCP tool calls:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-call-1",
  "from": "trusted-agent",
  "to": ["target-agent"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": 42,
    "method": "tools/call",
    "params": {
      "name": "dangerous_operation",
      "arguments": {"target": "production"}
    }
  }
}
```

If a restricted participant attempts this, the gateway blocks it and returns an error (see Section 4.3.2).

### 4.2 MCP Proposals (kind = "mcp/proposal")

Participants with restricted privilege MUST use the `mcp/proposal` kind instead of direct MCP operations:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-req-1",
  "from": "untrusted-agent",
  "to": ["target-agent"],
  "kind": "mcp/proposal",
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "dangerous_operation",
      "arguments": {"target": "production"}
    },
    "reason": "Need to perform maintenance"
  }
}
```

This is NOT an MCP message - it's an MCPx-specific protocol extension that proposes an MCP operation requiring fulfillment by a privileged participant. The payload includes:
- `method`: The MCP method being proposed (tools/call, resources/read, etc.)
- `params`: The parameters for that method
- `reason`: Optional human-readable justification for the proposal

#### 4.2.1 Proposal Fulfillment

A full-privilege participant can fulfill the proposal by making a real MCP call:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-fulfill-1",
  "from": "human-user",
  "to": ["target-agent"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": 44,
    "method": "tools/call",
    "params": {
      "name": "dangerous_operation",
      "arguments": {"target": "production"}
    }
  }
}
```

Note: The fulfillment is a standard MCP tool call. The target agent MAY include metadata in its response to indicate this was fulfilling a request:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-fulfill-resp-1",
  "from": "target-agent",
  "to": ["human-user", "untrusted-agent"],
  "kind": "mcp",
  "correlation_id": "env-fulfill-1",
  "payload": {
    "jsonrpc": "2.0",
    "id": 44,
    "result": {
      "content": [{
        "type": "text",
        "text": "Operation completed successfully"
      }]
    }
  }
}
```

### 4.3 Chat Messages (kind = "chat")

Chat messages are MCPx-specific and do not pollute the MCP namespace:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-chat-1",
  "from": "user-alice",
  "kind": "chat",
  "payload": {
    "text": "Hello everyone!",
    "format": "plain"
  }
}
```

- `text` (required): The message content
- `format` (optional): "plain" or "markdown", defaults to "plain"
- Chat messages are typically broadcast (empty/omitted `to` array)

### 4.4 System Messages (kind = "system")

#### 4.4.1 Welcome with Privilege Level

When a participant connects, the gateway sends a welcome message including their privilege level:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-welcome-1",
  "from": "system:gateway",
  "to": ["new-participant"],
  "kind": "system",
  "payload": {
    "event": "welcome",
    "participant": {
      "id": "new-participant",
      "privilege": "restricted"
    },
    "participants": [...],
    "protocol": "mcpx/v0.1"
  }
}
```

#### 4.4.2 Privilege Violation

When a restricted participant attempts a forbidden operation:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-violation-1",
  "from": "system:gateway",
  "to": ["violator"],
  "kind": "mcp",
  "correlation_id": "env-bad-call",
  "payload": {
    "jsonrpc": "2.0",
    "id": 45,
    "error": {
      "code": -32001,
      "message": "Privilege violation",
      "data": {
        "reason": "Restricted participants cannot send MCP messages directly",
        "suggestion": "Use kind: 'mcp/proposal' instead"
      }
    }
  }
}
```

---

## 5. Realtime Gateway API

### 5.1 Authentication and Privilege Assignment

The gateway determines privilege level during authentication:

1. **Token-based**: Different token types grant different privileges
   - Implementations may issue topic-specific tokens with varying privilege levels
2. **Identity-based**: Known/verified identities get full privilege
3. **Default restricted**: New/unknown participants start restricted
4. **Promotion**: Admins can promote participants from restricted to full

### 5.2 WebSocket Connection

Connect: `GET /v0/ws?topic=<name>` with Authorization header

The gateway:
1. Validates the bearer token
2. Assigns privilege level based on token/identity
3. Sends welcome message with privilege level
4. Enforces privilege rules on all messages

### 5.3 Message Filtering

For each incoming message from a participant:

```python
if message.kind == "mcp":
    if participant.privilege == "restricted":
        send_error("Privilege violation: use mcp/proposal instead")
        broadcast_violation_notice()  # optional
        return
send_to_topic(message)
```

---

## 6. Backward Compatibility

### 6.1 Open Mode

Gateways MAY operate in "open mode" where:
- All participants receive full privilege by default
- Maintains v0 behavior for trusted environments
- Enabled via gateway configuration

### 6.2 Mixed Mode

Gateways SHOULD support mixed environments:
- Trusted participants get full privilege
- New/unknown participants get restricted privilege
- Allows gradual migration to secure model

### 6.3 Protocol Version Negotiation

- Clients supporting v0.1 SHOULD send `protocol: "mcpx/v0.1"`
- Gateways MUST accept both `"mcp-x/v0"` and `"mcpx/v0.1"`
- v0 clients in v0.1 gateways operate based on gateway policy

---

## 7. Security Considerations

### 7.1 Privilege Separation Benefits

1. **No token theft**: Privileges tied to connection, not transferable
2. **Gateway enforcement**: Transport-layer blocking of unauthorized MCP messages
3. **MCP agnostic**: Gateway doesn't need to understand MCP operations
4. **Human oversight**: Natural pattern for reviewing untrusted operations
5. **Audit trail**: All proposals and fulfillments are observable

### 7.2 Limitations

1. **Gateway trust**: Security depends on proper gateway implementation
2. **No fine-grained control**: Binary privilege model (can extend with capabilities later)
3. **Visibility**: All participants see pending proposals (privacy consideration)

### 7.3 Best Practices

1. **Start restricted**: New agents should begin with restricted privilege
2. **Promote carefully**: Only promote after establishing trust
3. **Monitor proposals**: Log and audit MCP proposal patterns
4. **Rate limiting**: Apply limits to prevent proposal spam
5. **Timeout proposals**: Unfulfilled proposals should expire

---

## 8. Migration Path

### Phase 1: Gateway Implementation
1. Implement privilege tracking in gateway
2. Default to open mode for compatibility
3. Add configuration for privilege assignment

### Phase 2: Client Support
1. Update clients to handle `mcp/proposal` kind
2. Implement fulfillment UI for human users
3. Add proposal monitoring dashboards

### Phase 3: Secure by Default
1. Switch default to restricted for new participants
2. Require explicit configuration for open mode
3. Provide migration tools for existing deployments

---

## 9. Examples

### 9.1 Restricted Agent Workflow

1. Untrusted agent connects → receives restricted privilege
2. Agent attempts MCP operation → gateway blocks, returns error
3. Agent sends `mcp/proposal` → visible to all participants
4. Human user sees the proposal and decides to fulfill it
5. Human sends real `mcp` message to target
6. Target executes and returns result to human (and optionally to proposer)

### 9.2 Trust Promotion

1. Restricted agent operates successfully over time
2. Human admin observes good behavior
3. Admin promotes agent to full privilege
4. Agent can now make direct tool calls

### 9.3 Mixed Environment

- Human users: full privilege
- Established agents: full privilege
- New AI agents: restricted privilege
- External integrations: restricted privilege

All operate in same topic with appropriate access controls.

---

## 10. Appendix: Implementation Notes

### 10.1 Gateway State

Minimal state required per connection:
```json
{
  "connectionId": "ws-123",
  "participantId": "agent-a",
  "privilege": "restricted",
  "connectedAt": "2025-08-26T14:00:00Z"
}
```

### 10.2 Proposal Tracking

Optional proposal tracking for fulfillment (maintained by agents, not gateway):
```json
{
  "proposalId": "env-proposal-1",
  "proposer": "untrusted-agent",
  "target": "target-agent",
  "method": "tools/call",
  "params": {"name": "dangerous_operation", "arguments": {...}},
  "status": "pending",
  "createdAt": "2025-08-26T14:00:00Z",
  "expiresAt": "2025-08-26T14:05:00Z"
}
```

### 10.3 Privilege Promotion API

Optional admin endpoint:
```
POST /admin/participants/{id}/promote
Authorization: Bearer <admin-token>

Response:
{
  "participantId": "agent-a",
  "oldPrivilege": "restricted",
  "newPrivilege": "full",
  "promotedBy": "admin-user",
  "promotedAt": "2025-08-26T14:30:00Z"
}
```

---

## References

- MCP Specification 2025-06-18
- MCPx v0 Specification
- ADR-003: Tool Access Control
- OAuth 2.0 RFC 6749 (for token patterns)