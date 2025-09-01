# MCPx Draft Protocol Specification

Status: draft  
Date: TBD
Intended Status: Experimental  
Editors: RJ Corwin (https://github.com/rjcorwin)

---

## Requirements Language

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119 and RFC 8174.

---

## 1. Abstract

MCPx enables real-time collaboration between multiple AI agents and humans by extending the Model Context Protocol with broadcast messaging and capability-based security. The protocol wraps MCP messages in envelopes that include routing and permission metadata, allowing gateways to enforce access control without parsing payloads. Untrusted agents use proposals to suggest operations that trusted participants can review and execute, enabling progressive automation as orchestrators learn from human decisions over time.

---

## 2. Goals and Non-Goals

### 2.1 Goals
- **Collaborative Governance**: Enable multiple humans and AI systems to jointly supervise agent operations
- **Progressive Automation**: Allow orchestrators to learn from collective decisions over time
- **Security Through Isolation**: Untrusted agents propose rather than execute, maintaining safety
- **Observable Operations**: All messages broadcast by default, enabling auditing and pattern learning
- **Stateless Gateway**: Minimal gateway state for scalability, with lazy enforcement
- **MCP Compatibility**: Every participant implements standard MCP server interfaces

### 2.2 Non-Goals
- End-to-end encryption or private channels (all messages visible within topic)
- Payload validation at gateway (only validates `kind` field, not message contents)
- Message persistence or replay (topics are ephemeral)
- Cross-topic routing or participant discovery
- Guaranteed delivery (WebSocket best-effort)
- Application-layer semantics or business logic

---

## 3. Message Envelope

All data flowing over a topic MUST be a single top-level JSON envelope:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "2f6b6e70-7b36-4b8b-9ad8-7c4f7d0e2d0b",
  "ts": "2025-08-26T14:00:00Z",
  "from": "robot-alpha",
  "to": ["coordinator"],
  "kind": "mcp/request:tools/call",
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
  - `mcp/request:METHOD` - MCP request/notification (e.g., `mcp/request:tools/call`)
  - `mcp/response:METHOD` - MCP response (e.g., `mcp/response:tools/call`)
  - `mcp/proposal:METHOD` - MCP proposal (e.g., `mcp/proposal:tools/call`)
  - `chat` - Chat messages
  - `presence` - Join/leave events
  - `system` - Gateway system messages
- `correlation_id`: links related envelopes in a conversation chain
  - Response → Request: `mcp/response:METHOD` MUST reference the originating `mcp/request:METHOD`
  - Fulfillment → Proposal: `mcp/request:METHOD` MAY reference a `mcp/proposal:METHOD` when fulfilling it
  - Error → Trigger: `system` error messages SHOULD reference the envelope that caused the error
  - Reply → Message: Any envelope MAY reference another for threading/context
- `payload`: object; structure depends on `kind`

### 3.1 MCP Messages (kind = "mcp/request:METHOD[:CONTEXT]")

MCP requests and notifications use the format `mcp/request:METHOD[:CONTEXT]` where:
- METHOD is the MCP method name (e.g., `tools/call`, `resources/read`)
- CONTEXT is the specific operation (e.g., tool name, resource URI)

#### 3.1.1 MCP Requests

Example tool call request:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-call-1",
  "from": "trusted-agent",
  "to": ["target-agent"],
  "kind": "mcp/request:tools/call:dangerous_operation",
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

#### 3.1.2 MCP Responses (kind = "mcp/response:METHOD[:CONTEXT]")

Responses MUST include the `correlation_id` field referencing the original request's `id`. This is critical for translating MCP's client-server request/response model to MCPx's multi-participant broadcast paradigm, allowing all participants to match responses to their corresponding requests.

Response to the above tool call. The response SHOULD include the operation context in the kind:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-resp-1",
  "from": "target-agent",
  "to": ["trusted-agent"],
  "kind": "mcp/response:tools/call:dangerous_operation",
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

Note: The extended kind format (`METHOD:CONTEXT`) makes responses self-contained and enables fine-grained capability control. The MCP payload remains unchanged.

### 3.2 MCP Proposals (kind = "mcp/proposal:METHOD[:CONTEXT]")

Participants with restricted capabilities MUST use proposals instead of direct MCP operations:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-req-1",
  "from": "untrusted-agent",
  "to": ["target-agent"],
  "kind": "mcp/proposal:tools/call:dangerous_operation",
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

#### 3.2.1 Proposal Fulfillment

A participant with appropriate capabilities fulfills the proposal by making the real MCP call. The `correlation_id` field is critical for matching approvals to their original proposals:
- Proposals MUST NOT include a `correlation_id` (they originate new workflows)
- Fulfillment messages MUST include `correlation_id` referencing the proposal's `id`
- This allows participants to track which fulfillment corresponds to which proposal
- The correlation chain enables audit trails and multi-step approval workflows

Example fulfillment:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-fulfill-1",
  "from": "human-user",
  "to": ["target-agent"],
  "kind": "mcp/request:tools/call:dangerous_operation",
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

The response goes to both the fulfiller and the original proposer. Note that the response's `correlation_id` references the fulfillment message (`env-fulfill-1`), NOT the original proposal (`env-req-1`). This maintains the standard request/response pairing while the proposer can still receive the outcome:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-fulfill-resp-1",
  "from": "target-agent",
  "to": ["human-user", "untrusted-agent"],
  "kind": "mcp/response:tools/call:dangerous_operation",
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

### 3.3 Chat Messages (kind = "chat")

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

### 3.4 Presence Messages (kind = "system/presence")

Presence messages are broadcast to notify all participants about join/leave events:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-presence-1",
  "from": "system:gateway",
  "kind": "system/presence",
  "payload": {
    "event": "join",
    "participant": {
      "id": "new-agent",
      "capabilities": ["mcp/proposal:*", "chat"]
    }
  }
}
```

- `event` (required): Either `"join"` or `"leave"`
- `participant` (required): Information about the participant
  - `id`: The participant's identifier
  - `capabilities`: The participant's capabilities (for `join` events)

Note: Presence messages are broadcast to all participants. The joining participant also receives a welcome message addressed specifically to them (via the `to` field) with their authoritative capabilities and the current participant list.

### 3.5 System Messages (kind = "system/*")

#### 3.5.1 Welcome Message (kind = "system/welcome")

When a participant connects, the gateway MUST send a welcome message addressed specifically to that participant (using the `to` field):

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-welcome-1",
  "from": "system:gateway",
  "to": ["new-participant"],
  "kind": "system/welcome",
  "payload": {
    "you": {
      "id": "new-participant",
      "capabilities": ["mcp/proposal:*", "chat"]
    },
    "participants": [
      {
        "id": "agent-1",
        "capabilities": ["mcp/*", "chat"]
      },
      {
        "id": "agent-2",
        "capabilities": ["mcp/response:*", "chat"]
      }
    ]
  }
}
```

- `you`: The joining participant's own information and authoritative capabilities
- `participants`: Current list of other participants in the topic and their capabilities
- Other participants can safely ignore this message (it's addressed specifically to the new participant)

#### 3.5.2 Capability Violation (kind = "system/error")

When a participant attempts an operation they lack capability for:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-violation-1",
  "from": "system:gateway",
  "to": ["violator"],
  "kind": "system/error",
  "correlation_id": "env-bad-call",
  "payload": {
    "error": "capability_violation",
    "message": "You lack capability for 'mcp/request:tools/call'",
    "attempted_kind": "mcp/request:tools/call",
    "your_capabilities": ["mcp/proposal:*", "chat"]
  }
}
```

---

## 4. Security Model

### 4.1 Capability-Based Access Control

The gateway assigns capabilities to each connection, determining which message kinds they can send. Capabilities support wildcards for flexible access control.

**Wildcard Patterns:**
- `mcp/*` - All MCP-related messages (requests, responses, proposals)
- `mcp/request:*` - All MCP requests/notifications
- `mcp/request:tools/*` - All tool operations (call, list)
- `mcp/request:resources/*` - All resource operations (read, list, subscribe)
- `mcp/response:*` - Can respond to any MCP request
- `mcp/proposal:*` - Can propose any MCP operation

**Reserved Namespace:**
The `system/*` namespace is reserved exclusively for the gateway. Participants MUST NOT send messages with `kind` starting with `system/`. The gateway MUST reject any such attempts. Only the gateway can generate system messages (`system/welcome`, `system/presence`, `system/error`).

**Example Capability Sets:**

Gateways may implement various capability profiles based on their security requirements:

1. **Full Access** example:
   - `["mcp/*", "chat"]`
   - Can initiate any MCP operations, respond, and fulfill proposals

2. **Proposal-Only** example:
   - `["mcp/proposal:*", "mcp/response:*", "chat"]`
   - Cannot send direct MCP requests, must use proposals
   - Can respond when their proposals are fulfilled

3. **Response-Only** example:
   - `["mcp/response:*", "chat"]`
   - Can only respond to MCP requests, cannot initiate

4. **Read-Only** example:
   - `["mcp/request:resources/read", "mcp/request:*/list", "mcp/response:*", "chat"]`
   - Can read resources and list anything, but cannot modify

5. **Tool-Only** example:
   - `["mcp/request:tools/*", "mcp/response:tools/*", "chat"]`
   - Can use tools but not access resources

**Progressive Trust Example:**

One possible pattern is to expand capabilities as trust increases:
1. Initial: `["mcp/proposal:*", "chat"]` - Proposals only
2. Basic: Add `["mcp/request:resources/read"]` - Can read resources
3. Trusted: Add `["mcp/request:tools/*"]` - Can use tools
4. Full: Replace with `["mcp/*"]` - Unrestricted access

### 4.2 Gateway Enforcement (Lazy)

The gateway uses lazy enforcement for efficiency, only checking capabilities against the `kind` field:

**What the Gateway Does:**
- Pattern matches `kind` against participant's capabilities
- Blocks messages if no capability matches
- Returns error responses for capability violations
- **Does NOT validate that payload matches the kind**

**What the Gateway Does NOT Do:**
- Parse or validate JSON-RPC payloads
- Understand MCP semantics
- Detect spoofing (where `kind` doesn't match payload content)

**Security Model:** The gateway relies on receiving participants to detect and reject spoofed messages where the envelope `kind` doesn't match the actual payload. This division of responsibility keeps the gateway lightweight while maintaining security.

**Pattern Matching Examples:**
- Kind `mcp/request:tools/call` matches capabilities: `mcp/*`, `mcp/request:*`, `mcp/request:tools/*`, `mcp/request:tools/call`
- Kind `mcp/response:tools/call` matches: `mcp/*`, `mcp/response:*`, `mcp/response:tools/*`
- Kind `chat` only matches exact: `chat`

### 4.3 Participant Validation (Strict)

Receiving participants MUST validate that messages are well-formed:
- **CRITICAL**: Verify both METHOD and CONTEXT from `kind` match the payload
  - For `kind: "mcp/request:tools/call:read_file"`, validate:
    - `payload.method` is `"tools/call"`
    - `payload.params.name` is `"read_file"`
- Drop or report malformed messages
- MAY track misbehaving participants for reputation scoring

**Security Note:** Participants MUST validate that the envelope `kind` (including both METHOD and CONTEXT) matches the payload content before accepting any message. Without this validation, malicious participants could spoof operations by using a `kind` they have capabilities for while sending a payload for operations they don't have permission to perform (e.g., using `kind: "mcp/request:tools/call:safe_tool"` while `payload.params.name` is actually `"dangerous_tool"`).

**Schema Mismatch Warning:** Participants may observe messages with schemas that differ from what was advertised:
- Other participants might advertise one tool schema in their capabilities but send different parameters
- Participants joining mid-conversation may see responses to requests they never observed
- The gateway doesn't validate payload contents, only the `kind` field
- Always parse messages defensively and validate `kind` matches payload structure before processing

This lazy enforcement model keeps gateways fast while maintaining security through edge validation.

---

## 5. Realtime Gateway API

### 5.1 Authentication and Capability Assignment

The gateway determines capabilities during authentication. Implementation-specific policies may include:

1. **Token-based**: Tokens map to specific capability sets
   - Implementations may encode capabilities in tokens or map tokens to capability profiles
2. **Identity-based**: Map authenticated identities to capability sets
3. **Topic access control**: Topics may be public, private, or restricted
4. **Dynamic capabilities**: Capabilities may be modified during a session

### 6.2 WebSocket Connection

Connect: `GET /ws?topic=<name>` with Authorization header

The gateway:
1. Validates the bearer token (if provided)
2. Maps the token to a participant ID (implementation-specific)
3. Determines capabilities based on implementation policy
4. **MUST** send welcome message with the assigned participant ID and accurate capabilities
5. **MUST** enforce capability rules on all subsequent messages

**Note:** Participants only provide their bearer token. The gateway is responsible for mapping tokens to participant IDs through its own implementation-specific mechanism.

The capabilities in the welcome message constitute the authoritative list of what operations the participant can perform. Participants SHOULD use this list to understand their allowed operations.

### 6.3 Message Routing

Participants can configure their message routing preference (implementation-specific):

**Routing Modes:**
- **All**: Receive every message in the topic (default)
- **Directed**: Only receive messages where:
  - `to` field includes their participant ID, OR
  - `to` field is empty/omitted (broadcast)

This allows participants to reduce noise while still receiving broadcasts and messages directed to them. The gateway MUST respect these preferences when routing messages.

### 6.4 Message Filtering

For each incoming message from a participant:

```python
if not matches_any_capability(message.kind, participant.capabilities):
    send_error(f"Capability violation: you lack capability for '{message.kind}'")
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
- Message kinds now use hierarchical namespacing (e.g., `mcp/request:tools/call`)
- Capabilities replace privilege levels
- Chat moved to dedicated `chat` kind

### 6.3 Future Compatibility

- v0.x series is experimental and subject to breaking changes
- v1.0 will establish stable protocol with compatibility guarantees
- Production deployments should pin specific v0.x versions

---

## 7. Security Considerations

The security model for MCPx is detailed in Section 4. Key considerations include:

- **Capability-based access control** enforced by the gateway (Section 4.1)
- **Lazy enforcement** at the gateway level for performance (Section 4.2)
- **Strict validation** requirements for all participants (Section 4.3)
- **Reserved namespaces** preventing participant spoofing of system messages (Section 4.1)

Implementers MUST pay particular attention to the participant validation requirements to prevent spoofing attacks where the envelope `kind` doesn't match the payload content.

### 7.1 Best Practices

1. **Start restricted**: New agents should begin with minimal capabilities (`mcp/proposal:*`)
2. **Validate strictly**: All participants MUST validate both METHOD and CONTEXT match payload
3. **Monitor proposals**: Log and audit proposal/fulfillment patterns
4. **Progressive trust**: Expand capabilities only after establishing trust through observed behavior
5. **Report misbehavior**: Track and report participants sending malformed messages

---

## 8. Implementation Checklist

### 8.1 Gateway Requirements
- [ ] **Connection Management**
  - [ ] WebSocket server at `GET /ws?topic=<name>`
  - [ ] Bearer token validation from Authorization header
  - [ ] Token-to-participant-ID mapping (implementation-specific)
  - [ ] Connection state tracking per participant
  
- [ ] **Capability Enforcement**
  - [ ] Pattern matching engine for wildcard capabilities
  - [ ] Validate message `kind` against sender's capabilities
  - [ ] Block messages that don't match capabilities
  - [ ] Return `system/error` for capability violations
  
- [ ] **System Messages**
  - [ ] Send `system/welcome` with participant ID and capabilities on connect
  - [ ] Broadcast `system/presence` for join/leave events
  - [ ] Generate `system/error` for protocol violations
  - [ ] Ensure only gateway can send `system/*` messages
  
- [ ] **Message Routing**
  - [ ] Route messages based on `to` field (broadcast if empty/omitted)
  - [ ] Support participant routing preferences (All vs Directed mode)
  - [ ] Preserve envelope structure without modification
  - [ ] NO payload parsing or validation (lazy enforcement)

### 8.2 Participant Requirements
- [ ] **Message Validation**
  - [ ] Verify envelope structure before processing
  - [ ] Validate `kind` METHOD matches `payload.method`
  - [ ] Validate `kind` CONTEXT matches payload content (e.g., tool name)
  - [ ] Drop messages that fail validation
  - [ ] Track/report misbehaving participants
  
- [ ] **MCP Integration**
  - [ ] Implement MCP server capabilities
  - [ ] Handle incoming MCP requests/responses
  - [ ] Generate proper correlation IDs for responses
  - [ ] Include correlation ID in all response messages
  
- [ ] **Proposal Handling** (if applicable)
  - [ ] Recognize `mcp/proposal:*` messages
  - [ ] Implement fulfillment logic for approved proposals
  - [ ] Include proposal ID as correlation_id when fulfilling
  
- [ ] **Connection Behavior**
  - [ ] Process `system/welcome` to learn own ID and capabilities
  - [ ] Handle `system/presence` to track other participants
  - [ ] Respect capability restrictions from welcome message

---

## 9. Examples

The following examples demonstrate multi-agent orchestration patterns enabled by MCPx's capability-based security model. The core pattern is **delegated fulfillment**, where untrusted agents propose operations that are reviewed and executed by trusted participants.

### 9.1 Proposal-Based Workflow Example

In this example, an agent with limited capabilities uses proposals:

1. Agent connects → receives proposal-only capabilities
2. Agent attempts MCP request → gateway blocks, returns error
3. Agent sends `mcp/proposal:METHOD` → visible to all participants
4. Another participant with appropriate capabilities fulfills it
5. Fulfiller sends real `mcp/request:METHOD` message to target
6. Target executes and returns result to fulfiller (and optionally to proposer)

### 9.2 Capability Expansion Example

One possible administrative workflow:

1. Agent operates successfully over time
2. Administrator observes behavior patterns
3. Administrator expands agent capabilities
4. Agent gains access to additional operations

### 9.3 Mixed Environment Example

A gateway might assign different capability profiles:

- Administrative users: `mcp/*` (full access)
- Service agents: `mcp/response:*` (response-only)
- New agents: `mcp/proposal:*` (proposal-only)
- Monitoring tools: `mcp/request:*/list` (read-only)

All participants operate in the same topic with their assigned capabilities.

### 9.4 Delegated Fulfillment Example

A human supervises an untrusted agent through intermediary agents:

1. **Proposer Agent** (`mcp/proposal:*`) proposes writing a file
2. **Human** reviews the proposal and decides to approve it by directing the **Orchestrator Agent** (`mcp/request:*`) to fulfill the proposal
4. **Orchestrator Agent** sends the MCP request to **Worker Agent**
5. **Worker Agent** executes the actual file write operation and responds
6. Over time, **Human** teaches **Orchestrator Agent** rules about which proposals to auto-approve
7. **Orchestrator Agent** begins autonomously fulfilling certain proposals without human intervention

This pattern demonstrates **progressive automation** - a key goal of MCPx. As the orchestrator observes human decisions over time, it learns which types of proposals can be safely auto-approved. This transforms human judgment into automated policies, creating a system that becomes more autonomous while maintaining safety through learned boundaries.

---

## 10. Appendix: Implementation Notes

### 10.1 Gateway State

Minimal state required per connection:
```json
{
  "connectionId": "ws-123",
  "participantId": "agent-a",
  "capabilities": ["mcp/proposal:*", "chat"],
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

### 11.3 Capability Promotion API

Optional admin endpoint:
```
POST /admin/participants/{id}/capabilities
Authorization: Bearer <admin-token>

Request:
{
  "add": ["mcp/request:tools/*"],
  "remove": []
}

Response:
{
  "participantId": "agent-a",
  "oldCapabilities": ["mcp/proposal:*", "chat"],
  "newCapabilities": ["mcp/proposal:*", "mcp/request:tools/*", "chat"],
  "modifiedBy": "admin-user",
  "modifiedAt": "2025-08-26T14:30:00Z"
}
```

---

## References

- MCP Specification 2025-06-18
- MCPx v0.0 Specification
- ADR-003: Tool Access Control
- OAuth 2.0 RFC 6749 (for token patterns)