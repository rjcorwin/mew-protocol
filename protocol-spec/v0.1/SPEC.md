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

MCPx defines a minimal, topic-based meta-message format and a realtime gateway API that allows multiple MCP servers (agents/humans/robots) to interoperate in shared "rooms" with built-in security through capability-based access control.

- Every participant behaves like an MCP server
- Messages are published to a topic and are visible to all participants
- A gateway-enforced capability system prevents unauthorized operations
- MCP (JSON-RPC 2.0) requests/responses are encapsulated inside a simple envelope

This v0.1 extends v0 with security mechanisms while maintaining backward compatibility for trusted environments.

---

## 2. Goals and Non-Goals

### 2.1 Goals
- **Security**: Prevent rogue agents from executing unauthorized operations through capability-based access control
- **Simplicity**: Gateway remains tool-agnostic, tracking only connection capabilities
- **Human oversight**: Enable human-in-the-loop patterns for untrusted agents
- **Interop**: Maintain MCP server model for all participants

### 2.2 Non-Goals
- End-to-end encryption or private DMs (use separate topics or higher-layer crypto)
- Fine-grained per-tool permissions at gateway level (gateway remains tool-agnostic)
- Schema registries or complex ACL systems
- Topic lifecycle management

---

## 3. Security Model

### 3.1 Capability-Based Access Control

The gateway assigns capabilities to each connection, determining which message kinds they can send. Capabilities support wildcards for flexible access control:

**Wildcard Patterns:**
- `mcp:*` - All MCP requests/notifications
- `mcp:tools/*` - All tool operations (call, list)
- `mcp:resources/*` - All resource operations (read, list, subscribe)
- `mcp/response:*` - Can respond to any MCP request
- `mcp/proposal:*` - Can propose any MCP operation

**Common Capability Sets:**

1. **Full Capabilities** (trusted agents/humans):
   - `["mcp:*", "mcp/response:*", "mcp/proposal:*", "chat", "presence"]`
   - Can initiate any MCP operations and fulfill proposals

2. **Restricted Capabilities** (untrusted agents):
   - `["mcp/proposal:*", "mcp/response:*", "chat", "presence"]`
   - Cannot send direct MCP operations, must use proposals
   - Can respond when their proposals are fulfilled

3. **Response-Only Capabilities** (service agents):
   - `["mcp/response:*", "chat", "presence"]`
   - Can only respond to MCP requests, cannot initiate

4. **Read-Only Capabilities** (monitor agents):
   - `["mcp:resources/read", "mcp:*/list", "mcp/response:*", "chat"]`
   - Can read resources and list anything, but cannot modify

5. **Tool-Only Capabilities** (action agents):
   - `["mcp:tools/*", "mcp/response:tools/*", "chat"]`
   - Can use tools but not access resources

**Progressive Trust Example:**

Participants can be granted additional capabilities as trust increases:
1. Initial: `["mcp/proposal:*", "chat"]` - Proposals only
2. Basic: Add `["mcp:resources/read"]` - Can read resources
3. Trusted: Add `["mcp:tools/*"]` - Can use tools
4. Full: Replace with `["mcp:*"]` - Unrestricted access

### 3.2 Gateway Enforcement (Lazy)

The gateway uses lazy enforcement for efficiency, only checking capabilities against the `kind` field:

**What the Gateway Does:**
- Pattern matches `kind` against participant's capabilities
- Blocks messages if no capability matches
- Returns error responses for capability violations
- **Does NOT validate that payload matches the kind**

**What the Gateway Does NOT Do:**
- Parse or validate JSON-RPC payloads
- Check if `payload.method` matches the method in `kind`
- Understand MCP semantics

**Pattern Matching Examples:**
- Kind `mcp:tools/call` matches capabilities: `mcp:*`, `mcp:tools/*`, `mcp:tools/call`
- Kind `mcp/response:tools/call` matches: `mcp/response:*`, `mcp/response:tools/*`
- Kind `chat` only matches exact: `chat`

### 3.3 Agent Validation (Strict)

Receiving agents MUST validate that messages are well-formed:
- Verify `payload.method` matches the method declared in `kind`
- Drop or report malformed messages
- MAY track misbehaving participants for reputation scoring

This lazy enforcement model keeps gateways fast while maintaining security through edge validation.

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
- `kind`: Message type with format:
  - `mcp:METHOD` - MCP request/notification (e.g., `mcp:tools/call`)
  - `mcp/response:METHOD` - MCP response (e.g., `mcp/response:tools/call`)
  - `mcp/proposal:METHOD` - MCP proposal (e.g., `mcp/proposal:tools/call`)
  - `chat` - Chat messages
  - `presence` - Join/leave events
  - `system` - Gateway system messages
- `correlation_id`: references the envelope being responded to
- `payload`: object; structure depends on `kind`

### 4.1 MCP Messages (kind = "mcp:METHOD")

MCP requests and notifications use the format `mcp:METHOD` where METHOD is the MCP method name.

#### 4.1.1 MCP Requests

Example tool call request:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-call-1",
  "from": "trusted-agent",
  "to": ["target-agent"],
  "kind": "mcp:tools/call",
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

#### 4.1.2 MCP Responses (kind = "mcp/response:METHOD")

Response to the above tool call:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-resp-1",
  "from": "target-agent",
  "to": ["trusted-agent"],
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

### 4.2 MCP Proposals (kind = "mcp/proposal:METHOD")

Participants with restricted capabilities MUST use proposals instead of direct MCP operations:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-req-1",
  "from": "untrusted-agent",
  "to": ["target-agent"],
  "kind": "mcp/proposal:tools/call",
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "dangerous_operation",
      "arguments": {"target": "production"}
    }
  }
}
```

This is an MCPx-specific protocol extension that proposes an MCP operation requiring fulfillment by a participant with appropriate capabilities.

#### 4.2.1 Proposal Fulfillment

A participant with appropriate capabilities fulfills the proposal by making the real MCP call:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-fulfill-1",
  "from": "human-user",
  "to": ["target-agent"],
  "kind": "mcp/request:tools/call",
  "correlation_id": "env-req-1",
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

The response goes to both the fulfiller and the original proposer:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-fulfill-resp-1",
  "from": "target-agent",
  "to": ["human-user", "untrusted-agent"],
  "kind": "mcp/response:tools/call",
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

#### 4.4.1 Welcome with Capabilities

When a participant connects, the gateway sends a welcome message including their capabilities:

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
      "capabilities": ["mcp/proposal", "chat", "presence"]
    },
    "participants": [...],
    "protocol": "mcpx/v0.1"
  }
}
```

#### 4.4.2 Capability Violation

When a participant attempts an operation they lack capability for:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-violation-1",
  "from": "system:gateway",
  "to": ["violator"],
  "kind": "system",
  "correlation_id": "env-bad-call",
  "payload": {
    "type": "error",
    "error": "capability_violation",
    "message": "You lack capability for 'mcp/request:tools/call'",
    "attempted_kind": "mcp/request:tools/call",
    "your_capabilities": ["mcp/proposal", "chat", "presence"]
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

## 6. Version Compatibility

### 6.1 Breaking Changes

This is a v0.x release. Breaking changes are expected between minor versions until v1.0:
- v0.1 is NOT backward compatible with v0.0
- Clients and gateways MUST use matching protocol versions
- No compatibility guarantees until v1.0 release

### 6.2 Migration from v0.0

Key breaking changes from v0.0:
- Protocol identifier changed from `mcp-x/v0` to `mcpx/v0.1`
- Message kinds now use namespacing (e.g., `mcp:tools/call`)
- Capabilities replace privilege levels
- Chat moved to dedicated `chat` kind

### 6.3 Future Compatibility

- v0.x series is experimental and subject to breaking changes
- v1.0 will establish stable protocol with compatibility guarantees
- Production deployments should pin specific v0.x versions

---

## 7. Security Considerations

### 7.1 Lazy Enforcement Model

The gateway uses lazy enforcement (validating `kind` but not payload) for efficiency:

**Benefits:**
- Gateway remains fast and scalable
- No deep packet inspection overhead
- Simple pattern matching instead of protocol parsing
- Follows industry patterns (HTTP routers, CDNs, load balancers)

**Security Implications:**
- Malicious agents could send mismatched kind/payload
- Receiving agents MUST validate messages
- Bad actors identified through behavior, not prevention
- Trust established through reputation over time

**Mitigation:**
- Agents drop invalid messages immediately
- Report persistent misbehavior to gateway
- Gateway can revoke capabilities for bad actors
- Optional strict mode for high-security deployments

### 7.2 Capability-Based Security Benefits

1. **No token theft**: Capabilities tied to connection, not transferable
2. **Fine-grained control**: Can limit access to specific MCP methods
3. **Progressive trust**: Capabilities can be expanded as trust grows
4. **Human oversight**: Natural pattern for reviewing proposals
5. **Audit trail**: All proposals and fulfillments are observable

### 7.3 Limitations

1. **Gateway trust**: Security depends on proper gateway implementation
2. **Lazy validation**: Malformed messages reach agents before being dropped
3. **Visibility**: All participants see all messages in topic (privacy consideration)

### 7.3 Best Practices

1. **Start restricted**: New agents should begin with minimal capabilities
2. **Promote carefully**: Only expand capabilities after establishing trust
3. **Monitor proposals**: Log and audit MCP proposal patterns
4. **Rate limiting**: Apply limits to prevent proposal spam
5. **Timeout proposals**: Unfulfilled proposals should expire

---

## 8. Implementation Guidance

### 8.1 Gateway Implementation
1. Pattern matching engine for capability wildcards
2. Connection-to-capability mapping
3. Lazy enforcement (no payload validation)
4. Configuration for default capability sets

### 8.2 Agent Implementation
1. Validate `payload.method` matches `kind` declaration
2. Handle `mcp/proposal:*` messages from restricted agents
3. Support for fulfilling proposals on behalf of others
4. Report malformed messages for reputation tracking

### 8.3 Deployment Patterns
1. **Development**: All agents get `mcp:*` capabilities
2. **Staging**: Mixed capabilities for testing
3. **Production**: Strict capabilities with proposals for untrusted agents
4. **High Security**: Response-only capabilities for most agents

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