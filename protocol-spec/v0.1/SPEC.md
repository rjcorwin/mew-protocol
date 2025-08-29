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

MCPx enables untrusted AI agents to safely participate in complex workflows under human and orchestrator supervision.

The protocol extends the Model Context Protocol (MCP) by wrapping its messages in routing envelopes that add multi-agent coordination capabilities. While MCP defines client-server interactions with tools, MCPx transforms this into a multi-party system where any participant can offer services and call others' tools. The key innovation is capability-based security: agents can propose operations they lack permission to execute, enabling safe collaboration between components with different trust levels.

Messages use an extended kind format (e.g., `mcp/response:tools/call:read_file`) that embeds operation context directly in the envelope, making them self-documenting even when correlation history is lost. This pure wrapper approach - never modifying MCP payloads - ensures complete interoperability while enabling fine-grained access control, audit trails, and progressive automation where orchestrators learn which proposals to auto-approve over time.

---

## 2. Goals and Non-Goals

### 2.1 Goals
- **Collaborative Governance**: Enable multiple humans and AI systems to jointly supervise agent operations
- **Progressive Automation**: Allow orchestrators to learn from collective decisions over time
- **Security Through Isolation**: Untrusted agents propose rather than execute, maintaining safety
- **Scalable Oversight**: Support consensus mechanisms and specialized reviewers for complex decisions
- **Simplicity**: Gateway remains tool-agnostic, tracking only connection capabilities
- **Interoperability**: Every participant maintains the MCP server model

### 2.2 Non-Goals
- End-to-end encryption or private DMs (use separate topics or higher-layer crypto)
- Fine-grained per-tool permissions at gateway level (gateway remains tool-agnostic)
- Schema registries or complex ACL systems
- Topic lifecycle management

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

A participant with appropriate capabilities fulfills the proposal by making the real MCP call:

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

The response goes to both the fulfiller and the original proposer:

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

### 3.4 Presence Messages (kind = "presence")

Presence messages are broadcast to notify all participants about join/leave events:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-presence-1",
  "from": "system:gateway",
  "kind": "presence",
  "payload": {
    "event": "join",
    "participant": {
      "id": "new-agent",
      "capabilities": ["mcp/proposal:*", "chat", "presence"]
    }
  }
}
```

- `event` (required): Either `"join"` or `"leave"`
- `participant` (required): Information about the participant
  - `id`: The participant's identifier
  - `capabilities`: The participant's capabilities (for `join` events)

Note: Presence messages are broadcast to all participants. The joining participant also receives a private welcome message with their authoritative capabilities and the current participant list.

### 3.5 System Messages (kind = "system")

#### 3.5.1 Welcome Message

When a participant connects, the gateway MUST send a private welcome message to that participant only:

```json
{
  "protocol": "mcpx/v0.1",
  "id": "env-welcome-1",
  "from": "system:gateway",
  "to": ["new-participant"],
  "kind": "system",
  "payload": {
    "event": "welcome",
    "you": {
      "id": "new-participant",
      "capabilities": ["mcp/proposal:*", "chat", "presence"]
    },
    "participants": [
      {
        "id": "agent-1",
        "capabilities": ["mcp/*", "chat", "presence"]
      },
      {
        "id": "agent-2",
        "capabilities": ["mcp/response:*", "chat", "presence"]
      }
    ]
  }
}
```

- `you`: The joining participant's own information and authoritative capabilities
- `participants`: Current list of other participants in the topic and their capabilities
- Other participants can safely ignore this message (it's addressed specifically to the new participant)

#### 3.5.2 Capability Violation

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
    "your_capabilities": ["mcp/proposal:*", "chat", "presence"]
  }
}
```

---

## 4. Security Model

### 4.1 Capability-Based Access Control

The gateway assigns capabilities to each connection, determining which message kinds they can send. Capabilities support wildcards for flexible access control:

**Wildcard Patterns:**
- `mcp/*` - All MCP-related messages (requests, responses, proposals)
- `mcp/request:*` - All MCP requests/notifications
- `mcp/request:tools/*` - All tool operations (call, list)
- `mcp/request:resources/*` - All resource operations (read, list, subscribe)
- `mcp/response:*` - Can respond to any MCP request
- `mcp/proposal:*` - Can propose any MCP operation

**Example Capability Sets:**

Gateways may implement various capability profiles based on their security requirements:

1. **Full Access** example:
   - `["mcp/*", "chat", "presence"]`
   - Can initiate any MCP operations, respond, and fulfill proposals

2. **Proposal-Only** example:
   - `["mcp/proposal:*", "mcp/response:*", "chat", "presence"]`
   - Cannot send direct MCP requests, must use proposals
   - Can respond when their proposals are fulfilled

3. **Response-Only** example:
   - `["mcp/response:*", "chat", "presence"]`
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
- Check if `payload.method` matches the method in `kind`
- Understand MCP semantics

**Pattern Matching Examples:**
- Kind `mcp/request:tools/call` matches capabilities: `mcp/*`, `mcp/request:*`, `mcp/request:tools/*`, `mcp/request:tools/call`
- Kind `mcp/response:tools/call` matches: `mcp/*`, `mcp/response:*`, `mcp/response:tools/*`
- Kind `chat` only matches exact: `chat`

### 4.3 Agent Validation (Strict)

Receiving agents MUST validate that messages are well-formed:
- Verify `payload.method` matches the method declared in `kind`
- Drop or report malformed messages
- MAY track misbehaving participants for reputation scoring

This lazy enforcement model keeps gateways fast while maintaining security through edge validation.

---

## 5. Multi-Agent Orchestration

The capability-based security model enables sophisticated multi-agent collaboration patterns. The primary pattern that motivates this architecture is **delegated fulfillment**, where untrusted agents can propose operations that are reviewed and executed by trusted intermediaries.

### 5.1 Delegated Fulfillment Pattern

This pattern involves multiple types of participants:

1. **Proposer Agents** (`mcp/proposal:*`) - Can only propose operations, cannot execute
2. **Orchestrator Agents** (`mcp/request:*`) - Review proposals and coordinate execution
3. **Worker Agents** (tool/resource providers) - Execute actual operations
4. **Supervisors** (humans or AI) - Set policies and teach orchestrators
5. **Reviewers** (optional) - Analyze proposals for safety and compliance

**Workflow:**

```
Proposers → [proposals] → Orchestrator → [review] → Workers
                              ↑
                    Supervisors & Reviewers
                    (collaborate on policies)
```

This architecture provides:
- **Security isolation**: Untrusted code can't directly execute operations
- **Collaborative oversight**: Multiple humans and AI systems can participate in governance
- **Progressive automation**: Orchestrators learn which proposals to auto-approve
- **Consensus building**: Critical operations can require multiple approvals
- **Audit trail**: All proposals, reviews, and fulfillments are observable

### 5.2 Capability Progression

As trust is established, participants can be granted expanded capabilities:

```
Untrusted → Proposer → Limited Executor → Full Executor
   ∅       mcp/proposal:*   mcp/request:resources/*   mcp/*
```

Each level represents increased trust and autonomy:
- **Untrusted**: No capabilities, read-only observer
- **Proposer**: Can suggest operations for others to execute
- **Limited Executor**: Can perform specific safe operations
- **Full Executor**: Unrestricted access to all operations

### 5.3 Example Scenario

Consider an AI coding assistant helping with a project:

1. **Initial State**: AI assistant has `mcp/proposal:*` capabilities
2. **Operation**: Assistant proposes `write_file("config.json", {...})`
3. **Human Review**: Human sees proposal, deems it safe
4. **Delegation**: Human tells orchestrator to fulfill this proposal
5. **Execution**: Orchestrator sends request to filesystem agent
6. **Learning**: Human teaches orchestrator "always approve config file updates"
7. **Automation**: Future config proposals are auto-fulfilled

This pattern scales to complex multi-agent systems where:
- Multiple proposers suggest operations
- **Multiple supervisors** (humans or AI) collaborate on policy decisions
- **Intelligent reviewers** use classifiers and analysis tools to evaluate proposals
- Orchestrators route requests based on collectively learned policies
- Specialized workers handle different operation types
- **Consensus mechanisms** can require multiple approvals for sensitive operations

### 5.4 Implementation Considerations

When implementing multi-agent orchestration:

1. **Proposal Correlation**: Use `correlation_id` to link proposals to fulfillments
2. **Timeout Management**: Proposals should expire if not fulfilled
3. **Policy Storage**: Orchestrators need persistent rule storage
4. **Audit Logging**: Track all proposals, decisions, and executions
5. **Failure Handling**: Clear feedback when proposals are rejected

The capability system provides the security foundation, while orchestration patterns provide the workflow for safe, supervised multi-agent collaboration.

---

## 6. Realtime Gateway API

### 6.1 Authentication and Capability Assignment

The gateway determines capabilities during authentication. Implementation-specific policies may include:

1. **Token-based**: Tokens map to specific capability sets
   - Implementations may encode capabilities in tokens or map tokens to capability profiles
2. **Identity-based**: Map authenticated identities to capability sets
3. **Topic access control**: Topics may be public, private, or restricted
4. **Dynamic capabilities**: Capabilities may be modified during a session

### 6.2 WebSocket Connection

Connect: `GET /v0/ws?topic=<name>` with Authorization header

The gateway:
1. Validates the bearer token (if provided)
2. Determines capabilities based on implementation policy
3. **MUST** send welcome message with accurate capabilities
4. **MUST** enforce capability rules on all subsequent messages

The capabilities in the welcome message constitute the authoritative list of what operations the participant can perform. Participants SHOULD use this list to understand their allowed operations.

### 6.3 Message Filtering

For each incoming message from a participant:

```python
if not matches_any_capability(message.kind, participant.capabilities):
    send_error(f"Capability violation: you lack capability for '{message.kind}'")
    broadcast_violation_notice()  # optional
    return
send_to_topic(message)
```

---

## 7. Version Compatibility

### 7.1 Breaking Changes

This is a v0.x release. Breaking changes are expected between minor versions until v1.0:
- v0.1 is NOT backward compatible with v0.0
- Clients and gateways MUST use matching protocol versions
- No compatibility guarantees until v1.0 release

### 7.2 Migration from v0.0

Key breaking changes from v0.0:
- Protocol identifier changed from `mcp-x/v0` to `mcpx/v0.1`
- Message kinds now use hierarchical namespacing (e.g., `mcp/request:tools/call`)
- Capabilities replace privilege levels
- Chat moved to dedicated `chat` kind

### 7.3 Future Compatibility

- v0.x series is experimental and subject to breaking changes
- v1.0 will establish stable protocol with compatibility guarantees
- Production deployments should pin specific v0.x versions

---

## 8. Security Considerations

### 8.1 Lazy Enforcement Model

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

### 8.2 Capability-Based Security Benefits

1. **No token theft**: Capabilities tied to connection, not transferable
2. **Fine-grained control**: Can limit access to specific MCP methods
3. **Progressive trust**: Capabilities can be expanded as trust grows
4. **Human oversight**: Natural pattern for reviewing proposals
5. **Audit trail**: All proposals and fulfillments are observable

### 8.3 Limitations

1. **Gateway trust**: Security depends on proper gateway implementation
2. **Lazy validation**: Malformed messages reach agents before being dropped
3. **Visibility**: All participants see all messages in topic (privacy consideration)

### 8.4 Best Practices

1. **Start restricted**: New agents should begin with minimal capabilities
2. **Promote carefully**: Only expand capabilities after establishing trust
3. **Monitor proposals**: Log and audit MCP proposal patterns
4. **Rate limiting**: Apply limits to prevent proposal spam
5. **Timeout proposals**: Unfulfilled proposals should expire

---

## 9. Implementation Guidance

### 9.1 Gateway Implementation
1. Pattern matching engine for capability wildcards
2. Connection-to-capability mapping
3. Lazy enforcement (no payload validation)
4. Configuration for default capability sets

### 9.2 Agent Implementation
1. Validate `payload.method` matches `kind` declaration
2. Handle `mcp/proposal:*` messages from restricted agents
3. Support for fulfilling proposals on behalf of others
4. Report malformed messages for reputation tracking

### 9.3 Example Deployment Patterns

Gateways may implement different security profiles based on environment:

1. **Development**: All agents get `mcp/*` capabilities
2. **Staging**: Mixed capabilities for testing
3. **Production**: Strict capabilities with proposal-based workflows
4. **High Security**: Response-only capabilities for most agents

---

## 10. Examples

### 10.1 Proposal-Based Workflow Example

In this example, an agent with limited capabilities uses proposals:

1. Agent connects → receives proposal-only capabilities
2. Agent attempts MCP request → gateway blocks, returns error
3. Agent sends `mcp/proposal:METHOD` → visible to all participants
4. Another participant with appropriate capabilities fulfills it
5. Fulfiller sends real `mcp/request:METHOD` message to target
6. Target executes and returns result to fulfiller (and optionally to proposer)

### 10.2 Capability Expansion Example

One possible administrative workflow:

1. Agent operates successfully over time
2. Administrator observes behavior patterns
3. Administrator expands agent capabilities
4. Agent gains access to additional operations

### 10.3 Mixed Environment Example

A gateway might assign different capability profiles:

- Administrative users: `mcp/*` (full access)
- Service agents: `mcp/response:*` (response-only)
- New agents: `mcp/proposal:*` (proposal-only)
- Monitoring tools: `mcp/request:*/list` (read-only)

All participants operate in the same topic with their assigned capabilities.

### 10.4 Delegated Fulfillment Example

A human supervises an untrusted agent through intermediary agents:

1. **Proposer Agent** (`mcp/proposal:*`) proposes writing a file
2. **Human** reviews the proposal and decides to approve it by directing the **Orchestrator Agent** (`mcp/request:*`) to fulfill the proposal
4. **Orchestrator Agent** sends the MCP request to **Worker Agent**
5. **Worker Agent** executes the actual file write operation and responds
6. Over time, **Human** teaches **Orchestrator Agent** rules about which proposals to auto-approve
7. **Orchestrator Agent** begins autonomously fulfilling certain proposals without human intervention

This pattern enables progressive automation while maintaining human oversight through a trusted orchestration layer.

---

## 11. Appendix: Implementation Notes

### 11.1 Gateway State

Minimal state required per connection:
```json
{
  "connectionId": "ws-123",
  "participantId": "agent-a",
  "capabilities": ["mcp/proposal:*", "chat", "presence"],
  "connectedAt": "2025-08-26T14:00:00Z"
}
```

### 11.2 Proposal Tracking

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
  "oldCapabilities": ["mcp/proposal:*", "chat", "presence"],
  "newCapabilities": ["mcp/proposal:*", "mcp/request:tools/*", "chat", "presence"],
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