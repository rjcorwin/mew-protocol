# MEUP Draft Protocol Specification

Status: draft  
Date: TBD
Intended Status: Experimental  
Editors: RJ Corwin (https://github.com/rjcorwin)

---

## Requirements Language

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119 and RFC 8174.

---

## 1. Abstract

MEUP (Multi-Entity Unified Protocol) enables real-time collaboration between multiple AI agents and humans by extending the Model Context Protocol with broadcast messaging and capability-based security. The protocol wraps MCP messages in envelopes that include routing and permission metadata, allowing gateways to enforce access control without parsing payloads. Untrusted agents use proposals to suggest operations that trusted participants can review and execute, enabling progressive automation as orchestrators learn from human decisions over time.

---

## 2. Goals and Non-Goals

### 2.1 Goals
- **Collaborative Governance**: Enable multiple humans and AI systems to jointly supervise agent operations
- **Progressive Automation**: Allow orchestrators to learn from collective decisions over time
- **Security Through Isolation**: Untrusted agents propose rather than execute, maintaining safety
- **Observable Operations**: All messages broadcast by default, enabling auditing and pattern learning
- **Stateless Gateway**: Minimal gateway state for scalability
- **MCP Compatibility**: Every participant implements standard MCP server interfaces

### 2.2 Non-Goals
- End-to-end encryption or private channels (all messages visible within topic)
- Message persistence or replay (topics are ephemeral)
- Cross-topic routing or participant discovery
- Guaranteed delivery (WebSocket best-effort)
- Application-layer semantics or business logic

---

## 3. Message Envelope

All data flowing over a topic MUST be a single top-level JSON envelope:

```json
{
  "protocol": "meup/v0.1",
  "id": "2f6b6e70-7b36-4b8b-9ad8-7c4f7d0e2d0b",
  "ts": "2025-08-26T14:00:00Z",
  "from": "robot-alpha",
  "to": ["coordinator"],
  "kind": "mcp/request",
  "correlation_id": ["env-1"],
  "context": "workflow-123/step-1",
  "payload": { /* kind-specific body */ }
}
```

Field semantics:
- `protocol`: MUST be `"meup/v0.1"` for this version
- `id`: globally unique message id (e.g., UUIDv4)
- `ts`: RFC3339 timestamp
- `from`: stable participant id within the topic
- `to`: array of participant ids (empty/omitted = broadcast)
- `kind`: Message type using minimal kinds:
  - `mcp/request` - MCP request/notification
  - `mcp/response` - MCP response
  - `mcp/proposal` - MCP proposal for operations
  - `mcp/withdraw` - Withdraw a proposal
  - `mcp/reject` - Reject a proposal
  - `reasoning/start` - Begin reasoning sequence
  - `reasoning/thought` - Reasoning monologue (thinking out loud)
  - `reasoning/conclusion` - End reasoning sequence
  - `capability/grant` - Grant capabilities to participant
  - `capability/revoke` - Revoke capabilities from participant
  - `capability/grant-ack` - Acknowledge capability grant
  - `space/invite` - Invite participant to space
  - `space/kick` - Remove participant from space
  - `chat` - Chat messages
  - `system/presence` - Join/leave events
  - `system/welcome` - Welcome message for new participants
  - `system/error` - System error messages
- `correlation_id`: array of message IDs this message relates to (always an array, even for single values)
  - Response → Request: `mcp/response` MUST reference the originating `mcp/request`
  - Fulfillment → Proposal: `mcp/request` MAY reference a `mcp/proposal` when fulfilling it
  - Withdraw → Proposal: `mcp/withdraw` MUST reference the proposal being withdrawn
  - Reject → Proposal: `mcp/reject` MUST reference the proposal being rejected
  - Error → Trigger: `system/error` messages SHOULD reference the envelope that caused the error
  - Reply → Message: Any envelope MAY reference others to indicate explicit reply intent (use `context` field for threading)
  - Workflow → Multiple: Messages in complex workflows MAY reference multiple related messages (e.g., a summary referencing several analyses, a decision based on multiple proposals, a response addressing multiple questions)
  - Fork/Join → Multiple: A response that combines results from multiple parallel requests
  - The array structure supports complex multi-party coordination and DAG-like message flows
- `context`: (optional) string representing the context or sub-context for this message
  - Path-based hierarchy using forward slashes: `"parent/child/grandchild"`
  - Messages in sub-contexts (reasoning, workflows) include this field for organization
  - Context groups related messages together (e.g., all thoughts in a reasoning sequence)
  - When prompting LLMs, implementations MAY filter contexts to reduce noise
  - IMPORTANT: Messages addressed to a participant (via `to` field) MUST be handled regardless of context
- `payload`: object; structure depends on `kind`

### 3.1 MCP Messages

MCP messages use minimal kinds with method information in the payload:
- `kind: "mcp/request"` for requests/notifications
- `kind: "mcp/response"` for responses
- `kind: "mcp/proposal"` for proposals
- `kind: "mcp/withdraw"` for withdrawing proposals
- `kind: "mcp/reject"` for rejecting proposals
- The specific method (e.g., `tools/call`, `resources/read`) is in `payload.method`

#### 3.1.1 MCP Requests

Example tool call request:

```json
{
  "protocol": "meup/v0.1",
  "id": "env-call-1",
  "from": "trusted-agent",
  "to": ["target-agent"],
  "kind": "mcp/request",
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

#### 3.1.2 MCP Responses

Responses MUST include the `correlation_id` field referencing the original request's `id`. This is critical for translating MCP's client-server request/response model to MEUP's multi-participant broadcast paradigm, allowing all participants to match responses to their corresponding requests.

Response to the above tool call:

```json
{
  "protocol": "meup/v0.1",
  "id": "env-resp-1",
  "from": "target-agent",
  "to": ["trusted-agent"],
  "kind": "mcp/response",
  "correlation_id": ["env-call-1"],
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

Note: The MCP payload structure remains unchanged from standard MCP.

### 3.2 MCP Proposals

Participants with restricted capabilities MUST use proposals instead of direct MCP operations. Proposals have the same payload structure as requests:

```json
{
  "protocol": "meup/v0.1",
  "id": "env-req-1",
  "from": "untrusted-agent",
  "to": ["target-agent"],
  "kind": "mcp/proposal",
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "dangerous_operation",
      "arguments": {"target": "production"}
    }
  }
}
```

This is a MEUP-specific protocol extension that proposes an MCP operation requiring fulfillment by a participant with appropriate capabilities.

#### 3.2.1 Proposal Fulfillment

A participant with appropriate capabilities fulfills the proposal by making the real MCP call. The `correlation_id` field is critical for matching approvals to their original proposals:
- Proposals typically don't include `correlation_id` (they originate new workflows)
- Fulfillment messages MUST include `correlation_id` referencing the proposal's `id`
- This allows participants to track which fulfillment corresponds to which proposal
- The correlation chain enables audit trails and multi-step approval workflows

Example fulfillment:

```json
{
  "protocol": "meup/v0.1",
  "id": "env-fulfill-1",
  "from": "human-user",
  "to": ["target-agent"],
  "kind": "mcp/request",
  "correlation_id": ["env-req-1"],
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

The response goes only to the fulfiller who made the request. The response's `correlation_id` references the fulfillment message (`env-fulfill-1`), maintaining the standard request/response pairing. The original proposer can observe the outcome since messages are broadcast by default:

```json
{
  "protocol": "meup/v0.1",
  "id": "env-fulfill-resp-1",
  "from": "target-agent",
  "to": ["human-user"],
  "kind": "mcp/response",
  "correlation_id": ["env-fulfill-1"],
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

The proposer can follow the correlation chain to track the outcome:
1. Proposer sends proposal (`env-req-1`)
2. Fulfiller sends request with `correlation_id: ["env-req-1"]` (`env-fulfill-1`)
3. Target sends response with `correlation_id: ["env-fulfill-1"]` (`env-fulfill-resp-1`)
4. Proposer observes the broadcast response and can trace back through the correlation chain

### 3.3 Proposal Lifecycle Operations

MEUP extends the proposal pattern with lifecycle operations for cancellation and feedback.

#### 3.3.1 Withdraw Proposals (kind = "mcp/withdraw")

Proposers can withdraw their own proposals that are no longer needed:

```json
{
  "protocol": "meup/v0.1",
  "id": "withdraw-456",
  "from": "untrusted-agent",
  "correlation_id": ["env-req-1"],
  "kind": "mcp/withdraw",
  "payload": {
    "reason": "no_longer_needed"
  }
}
```

- Only the original proposer can withdraw their proposals
- `correlation_id` MUST reference the proposal being withdrawn
- `reason` field uses standardized codes (see below)

#### 3.3.2 Reject Proposals (kind = "mcp/reject")

Any participant with the capability can reject proposals. Rejections provide early feedback to avoid unnecessary waiting:

```json
{
  "protocol": "meup/v0.1",
  "id": "reject-789",
  "from": "filesystem-agent",
  "to": ["untrusted-agent"],
  "correlation_id": ["env-req-1"],
  "kind": "mcp/reject",
  "payload": {
    "reason": "unsafe"
  }
}
```

**Purpose and Behavior:**
- Prevents proposers from waiting unnecessarily for fulfillment that won't come
- Particularly important when explicitly targeted in a proposal's `to` field
- Proposers MAY give up after the first rejection (fail-fast approach)
- Proposers MAY continue waiting for other participants to fulfill (resilient approach)
- The choice depends on the proposer's implementation and use case
- Multiple participants may reject the same proposal for different reasons

**Requirements:**
- `correlation_id` MUST reference the proposal being rejected
- `reason` field uses standardized codes (see below)

#### 3.3.3 Standardized Reason Codes

Lifecycle operations use standardized reason codes:

- `"disagree"` - Don't agree with the proposed action
- `"inappropriate"` - Not suitable for the current context
- `"unsafe"` - Could cause harm or unintended consequences
- `"busy"` - Currently handling other work
- `"incapable"` - Don't have the required tools/access
- `"policy"` - Violates security or operational policy
- `"duplicate"` - Already being handled by another participant
- `"invalid"` - Proposal is malformed or impossible
- `"timeout"` - Too old or expired
- `"resource_limit"` - Would exceed resource constraints
- `"no_longer_needed"` - Proposer no longer needs the operation
- `"other"` - Reason not covered above

Detailed explanations can be provided via follow-up chat messages using `correlation_id`:

```json
{
  "protocol": "meup/v0.1",
  "id": "chat-790",
  "from": "filesystem-agent",
  "to": ["untrusted-agent"],
  "correlation_id": ["reject-789"],
  "kind": "chat",
  "payload": {
    "text": "I'm currently processing a large batch operation that requires exclusive file access. Please retry in about 5 minutes.",
    "format": "plain"
  }
}
```

**Important timing consideration:** The reject message with a reason code should be sent immediately for fast feedback. Detailed explanations may arrive later as generating them (especially with LLMs) can take time. Participants implementing proposers should:
- Process the reject immediately upon receipt
- Optionally wait for follow-up explanations if they need details
- Not block on explanations that may never come

### 3.4 Chat Messages (kind = "chat")

Chat messages are MEUP-specific and do not pollute the MCP namespace:

```json
{
  "protocol": "meup/v0.1",
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

### 3.5 Reasoning Transparency

MEUP supports transparent reasoning through dedicated message kinds and the context field. This allows agents to share their thinking process while maintaining clear boundaries between reasoning sequences and regular operations.

#### 3.5.1 Reasoning Pattern

Common patterns for transparent reasoning:

**Response Pattern:**
1. Agent receives a request (e.g., `mcp/request`)
2. Agent sends `reasoning/start` with `correlation_id` referencing the request
3. The `reasoning/start` message ID becomes the `context` for subsequent messages
4. Agent MAY send `reasoning/thought` messages for internal monologue (optional)
5. Agent MAY use `chat` messages within context for dialogue with other participants
6. Agent MAY send `reasoning/conclusion` to summarize findings (optional)
7. Agent sends final response with `correlation_id` to original request

**Autonomous Pattern:**
- Agent sends `reasoning/start` at any time (e.g., periodic analysis, monitoring)
- The `reasoning/start` creates a context for transparent thinking
- Agent shares thoughts as they occur
- No response required - purely for transparency

Note: `reasoning/start` creates a context for transparency. Whether responding to requests or reasoning autonomously, it lets other participants observe the agent's thinking process.

#### 3.5.2 Reasoning Start (kind = "reasoning/start")

Signals the beginning of a reasoning sequence:

```json
{
  "protocol": "meup/v0.1",
  "id": "reason-start-1",
  "from": "agent-1",
  "kind": "reasoning/start",
  "correlation_id": ["req-123"],
  "payload": {
    "message": "Analyzing the request to modify the configuration file..."
  }
}
```

#### 3.5.3 Reasoning Thought (kind = "reasoning/thought")

Shares internal reasoning steps (monologue, no reply expected):

```json
{
  "protocol": "meup/v0.1",
  "id": "thought-1",
  "from": "agent-1",
  "kind": "reasoning/thought",
  "context": "reason-start-1",
  "payload": {
    "message": "The configuration file appears to use YAML format. I should validate the syntax before making changes."
  }
}
```

#### 3.5.4 Reasoning Conclusion (kind = "reasoning/conclusion")

Concludes the reasoning sequence:

```json
{
  "protocol": "meup/v0.1",
  "id": "reason-end-1",
  "from": "agent-1",
  "kind": "reasoning/conclusion",
  "context": "reason-start-1",
  "payload": {
    "message": "Configuration update is safe to proceed. The changes are valid YAML and won't break existing settings."
  }
}
```

#### 3.5.5 Context Behavior

- Messages with a `context` field are part of a sub-context
- Participants MAY filter out contexts when constructing prompts (e.g., excluding other agents' reasoning traces to reduce noise)
- **Exception**: Participants MUST NOT ignore `mcp/request` or `mcp/proposal` messages, even if they have a context field
- The context field supports hierarchical paths: `"parent/child/grandchild"`
- Context enables parallel reasoning by multiple agents without interference

### 3.6 Space Management Operations

A **space** in MEUP is a communication context where participants exchange messages. It's analogous to a channel, room, or topic - a bounded environment where a specific set of participants collaborate. Each space has its own:
- Set of participants (who can send/receive messages)
- Capability assignments (what each participant can do)
- Message history (the stream of envelopes exchanged)

A gateway may manage multiple spaces, each isolated from the others. The gateway enforces capabilities and routing rules for all its spaces.

MEUP extends the protocol with operations for managing these spaces dynamically. These operations use the `capability/*` and `space/*` namespaces to clearly indicate their purpose.

#### 3.6.1 Grant Capabilities (kind = "capability/grant")

Allows participants with appropriate capabilities to grant capabilities to other participants:

```json
{
  "protocol": "meup/v0.1",
  "id": "grant-789",
  "from": "trusted-orchestrator",
  "to": ["untrusted-agent"],
  "kind": "capability/grant",
  "payload": {
    "recipient": "untrusted-agent",
    "capabilities": [
      {
        "kind": "mcp/request",
        "payload": {
          "method": "tools/call",
          "params": {
            "name": "read_file"
          }
        }
      }
    ],
    "reason": "Demonstrated safe file handling"
  }
}
```

- The grant message ID becomes the `grant_id` for future revocation
- Capabilities use the same JSON pattern matching format from Section 4.1
- Gateway SHOULD add granted capabilities to recipient's capability set
- Multiple grants are cumulative

#### 3.6.2 Revoke Capabilities (kind = "capability/revoke")

Revokes previously granted capabilities:

```json
{
  "protocol": "meup/v0.1",
  "id": "revoke-123",
  "from": "orchestrator",
  "kind": "capability/revoke",
  "payload": {
    "recipient": "agent",
    "grant_id": "grant-789",
    "reason": "Task completed"
  }
}
```

Alternatively, revoke by capability pattern (removes ALL matching capabilities):

```json
{
  "protocol": "meup/v0.1",
  "id": "revoke-456",
  "from": "orchestrator",
  "kind": "capability/revoke",
  "payload": {
    "recipient": "agent",
    "capabilities": [
      {
        "kind": "mcp/request",
        "payload": {
          "method": "tools/*"
        }
      }
    ],
    "reason": "No longer needed"
  }
}
```

#### 3.6.3 Grant Acknowledgment (kind = "capability/grant-ack")

Recipients acknowledge capability grants:

```json
{
  "protocol": "meup/v0.1",
  "id": "ack-001",
  "from": "agent",
  "correlation_id": ["grant-789"],
  "kind": "capability/grant-ack",
  "payload": {
    "status": "accepted"
  }
}
```

#### 3.6.4 Invite Participant (kind = "space/invite")

Invites new participants to the space:

```json
{
  "protocol": "meup/v0.1",
  "id": "invite-123",
  "from": "admin",
  "kind": "space/invite",
  "payload": {
    "participant_id": "new-agent",
    "email": "agent-operator@example.com",  // Optional
    "initial_capabilities": [
      {"kind": "mcp/proposal"},
      {"kind": "chat"}
    ],
    "reason": "Adding specialized analysis agent"
  }
}
```

**Fields:**
- `participant_id`: Identifier for the new participant
- `email`: (optional) Email address to send invitation to
- `initial_capabilities`: Capabilities the participant will have when they join
- `reason`: Explanation for the invitation

**Note:** This message is broadcast within the space to inform existing participants. If `email` is provided, the gateway SHOULD send an invitation email with connection details. Additional notification methods (webhook, token generation, etc.) are gateway implementation-specific.

#### 3.6.5 Remove Participant (kind = "space/kick")

Removes participants from the space:

```json
{
  "protocol": "meup/v0.1",
  "id": "kick-456",
  "from": "admin",
  "kind": "space/kick",
  "payload": {
    "participant_id": "misbehaving-agent",
    "reason": "Repeated capability violations"
  }
}
```

#### 3.6.6 Delegation Security

- Only participants with `capability/grant` capability can grant capabilities
- Participants cannot grant capabilities they don't possess
- Gateway SHOULD track grant chains for audit purposes
- Revocations take effect immediately
- All space management operations generate audit logs

### 3.7 Presence Messages (kind = "system/presence")

Presence messages are broadcast to notify all participants about join/leave events:

```json
{
  "protocol": "meup/v0.1",
  "id": "env-presence-1",
  "from": "system:gateway",
  "kind": "system.presence",
  "payload": {
    "event": "join",
    "participant": {
      "id": "new-agent",
      "capabilities": [
        {"kind": "mcp/proposal"},
        {"kind": "chat"}
      ]
    }
  }
}
```

- `event` (required): Either `"join"` or `"leave"`
- `participant` (required): Information about the participant
  - `id`: The participant's identifier
  - `capabilities`: The participant's capabilities (for `join` events)

Note: Presence messages are broadcast to all participants. The joining participant also receives a welcome message addressed specifically to them (via the `to` field) with their authoritative capabilities and the current participant list.

### 3.8 System Messages

#### 3.8.1 Welcome Message (kind = "system/welcome")

When a participant connects, the gateway MUST send a welcome message addressed specifically to that participant (using the `to` field):

```json
{
  "protocol": "meup/v0.1",
  "id": "env-welcome-1",
  "from": "system:gateway",
  "to": ["new-participant"],
  "kind": "system.welcome",
  "payload": {
    "you": {
      "id": "new-participant",
      "capabilities": [
        {"kind": "mcp/proposal"},
        {"kind": "chat"}
      ]
    },
    "participants": [
      {
        "id": "agent-1",
        "capabilities": [
          {"kind": "mcp/*"},
          {"kind": "chat"}
        ]
      },
      {
        "id": "agent-2",
        "capabilities": [
          {"kind": "mcp/response"},
          {"kind": "chat"}
        ]
      }
    ]
  }
}
```

- `you`: The joining participant's own information and authoritative capabilities
- `participants`: Current list of other participants in the topic and their capabilities

**Important:** Other participants SHOULD ignore welcome messages not addressed to them when constructing prompts, as these can cause significant bloat. The message is already targeted via the `to` field.

#### 3.8.2 Capability Violation (kind = "system/error")

When a participant attempts an operation they lack capability for:

```json
{
  "protocol": "meup/v0.1",
  "id": "env-violation-1",
  "from": "system:gateway",
  "to": ["violator"],
  "kind": "system/error",
  "correlation_id": ["env-bad-call"],
  "payload": {
    "error": "capability_violation",
    "attempted_kind": "mcp/request",
    "your_capabilities": [
      {"kind": "mcp/proposal"},
      {"kind": "chat"}
    ]
  }
}
```

---

## 4. Security Model

### 4.1 Capability-Based Access Control

The gateway enforces security through two mechanisms:

1. **Identity Validation**: The gateway MUST verify that the `from` field matches the authenticated participant's ID. Participants cannot spoof messages from other participants.

2. **Capability Matching**: The gateway assigns capabilities to each connection using JSON pattern matching. Capabilities are JSON objects that match against the message structure (kind and payload).

**Capability Pattern Structure:**
```json
{
  "kind": "pattern",
  "payload": {
    "field": "pattern"
  }
}
```

**Pattern Types:**
- String with wildcards: `"mcp/*"` matches `mcp/request`, `mcp/response`, etc.
- Exact match: `"chat"` only matches `"chat"`
- Nested patterns: Match specific payload fields

**Reserved Namespace:**
The `system.*` namespace is reserved exclusively for the gateway. Participants MUST NOT send messages with `kind` starting with `system.`. The gateway MUST reject any such attempts. Only the gateway can generate system messages (`system.welcome`, `system.presence`, `system.error`).

**Example Capability Sets:**

Gateways may implement various capability profiles using JSON patterns:

1. **Full Access** example:
   ```json
   [
     {"kind": "mcp/*"},
     {"kind": "chat"}
   ]
   ```
   Can send any MCP messages (requests, responses, proposals)

2. **Proposal-Only** example:
   ```json
   [
     {"kind": "mcp/proposal"},
     {"kind": "mcp/response"},
     {"kind": "chat"}
   ]
   ```
   Cannot send direct MCP requests, must use proposals

3. **Tool-Specific** example:
   ```json
   [
     {
       "kind": "mcp/request",
       "payload": {
         "method": "tools/call",
         "params": {
           "name": "read_*"
         }
       }
     },
     {"kind": "mcp/response"},
     {"kind": "chat"}
   ]
   ```
   Can only call tools matching `read_*` pattern

**Progressive Trust Example:**

Capabilities can be expanded as trust increases:
1. Initial: `[{"kind": "mcp/proposal"}, {"kind": "chat"}]` - Proposals only
2. Basic: Add read capabilities with payload patterns
3. Trusted: Add tool usage with specific tool patterns
4. Full: Replace with `[{"kind": "mcp/*"}]` - Unrestricted MCP access

### 4.2 Gateway Enforcement

The gateway enforces capabilities using JSON pattern matching against the message structure:

**What the Gateway Does:**
- Matches the message's `kind` and `payload` against participant's capability patterns
- Uses wildcards, regex patterns, and JSONPath for flexible matching
- Blocks messages if no capability matches
- Returns error responses for capability violations

**What the Gateway Does NOT Do:**
- Parse or validate JSON-RPC payloads
- Understand MCP semantics
- Detect spoofing (where `kind` doesn't match payload content)

**Pattern Matching Examples:**
- Message with `kind: "mcp/request"` and `payload.method: "tools/call"` matches:
  - `{"kind": "mcp/*"}`
  - `{"kind": "mcp/request"}`
  - `{"kind": "mcp/request", "payload": {"method": "tools/*"}}`
- Message with `kind: "chat"` only matches:
  - `{"kind": "chat"}`
  - `{"kind": "*"}` (wildcard for all kinds)

### 4.3 Participant Validation

Receiving participants SHOULD validate message structure:
- Verify `kind` is appropriate for the message type
- Validate payload structure matches expected schema
- Drop or report malformed messages
- MAY track misbehaving participants for reputation scoring

**Schema Mismatch Warning:** Participants may observe messages with schemas that differ from what was advertised:
- Other participants might advertise one tool schema but send different parameters
- Participants joining mid-conversation may see responses to requests they never observed
- Always parse messages defensively and validate structure before processing

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
if not matches_any_capability(message, participant.capabilities):
    send_error(f"Capability violation: you lack capability for this operation")
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
- Protocol identifier changed from `mcp-x/v0` to `meup/v0.1`
<<<<<<< HEAD
- Message kinds now use slash notation (e.g., `mcp/request` instead of `mcp/request:tools/call`)
=======
- Message kinds now use dot notation (e.g., `mcp.request` instead of `mcp/request:tools/call`)
>>>>>>> origin
- Method information moved to payload
- Capabilities use JSON pattern matching instead of string wildcards
- `correlation_id` is now always an array
- Chat remains as dedicated `chat` kind

### 6.3 Future Compatibility

- v0.x series is experimental and subject to breaking changes
- v1.0 will establish stable protocol with compatibility guarantees
- Production deployments should pin specific v0.x versions

---

## 7. Security Considerations

The security model for MEUP is detailed in Section 4. Key considerations include:

- **Capability-based access control** enforced by the gateway (Section 4.1)
- **Lazy enforcement** at the gateway level for performance (Section 4.2)
- **Strict validation** requirements for all participants (Section 4.3)
- **Reserved namespaces** preventing participant spoofing of system messages (Section 4.1)

Implementers MUST pay particular attention to the participant validation requirements to prevent spoofing attacks where the envelope `kind` doesn't match the payload content.

### 7.1 Best Practices

1. **Start restricted**: New agents should begin with minimal capabilities (`mcp.proposal`)
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
  - [ ] Recognize `mcp.proposal` messages
  - [ ] Implement fulfillment logic for approved proposals
  - [ ] Include proposal ID as correlation_id when fulfilling
  
- [ ] **Connection Behavior**
  - [ ] Process `system/welcome` to learn own ID and capabilities
  - [ ] Handle `system/presence` to track other participants
  - [ ] Respect capability restrictions from welcome message

---

## 9. Examples

The following examples demonstrate multi-agent orchestration patterns enabled by MEUP's capability-based security model. The core pattern is **delegated fulfillment**, where untrusted agents propose operations that are reviewed and executed by trusted participants.

### 9.1 Proposal-Based Workflow Example

In this example, an agent with limited capabilities uses proposals:

1. Agent connects → receives proposal-only capabilities
2. Agent attempts MCP request → gateway blocks, returns error
3. Agent sends `mcp.proposal` → visible to all participants
4. Another participant with appropriate capabilities fulfills it
5. Fulfiller sends real `mcp/request` message to target
6. Target executes and returns result to fulfiller (and optionally to proposer)

### 9.2 Capability Expansion Example

One possible administrative workflow:

1. Agent operates successfully over time
2. Administrator observes behavior patterns
3. Administrator expands agent capabilities
4. Agent gains access to additional operations

### 9.3 Mixed Environment Example

A gateway might assign different capability profiles:

- Administrative users: `{"kind": "mcp/*"}` (full access)
- Service agents: `{"kind": "mcp/response"}` (response-only)
- New agents: `{"kind": "mcp/proposal"}` (proposal-only)
- Monitoring tools: `{"kind": "mcp/request", "payload": {"method": "*/list"}}` (read-only)

All participants operate in the same topic with their assigned capabilities.

### 9.4 Delegated Fulfillment Example

A human supervises an untrusted agent through intermediary agents:

1. **Proposer Agent** (capability: `mcp.proposal`) proposes writing a file
2. **Human** reviews the proposal and decides to approve it by directing the **Orchestrator Agent** (capability: `mcp/request`) to fulfill the proposal
4. **Orchestrator Agent** sends the MCP request to **Worker Agent**
5. **Worker Agent** executes the actual file write operation and responds
6. Over time, **Human** teaches **Orchestrator Agent** rules about which proposals to auto-approve
7. **Orchestrator Agent** begins autonomously fulfilling certain proposals without human intervention

This pattern demonstrates **progressive automation** - a key goal of MEUP. As the orchestrator observes human decisions over time, it learns which types of proposals can be safely auto-approved. This transforms human judgment into automated policies, creating a system that becomes more autonomous while maintaining safety through learned boundaries.

---

## 10. Appendix: Implementation Notes

### 10.1 Gateway State

Minimal state required per connection:
```json
{
  "connection_id": "ws-123",
  "participant_id": "agent-a",
  "capabilities": [{"kind": "mcp/proposal"}, {"kind": "chat"}],
  "connected_at": "2025-08-26T14:00:00Z"
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
  "add": [{"kind": "mcp/request", "payload": {"method": "tools/*"}}],
  "remove": []
}

Response:
{
  "participant_id": "agent-a",
  "old_capabilities": [{"kind": "mcp/proposal"}, {"kind": "chat"}],
  "new_capabilities": [
    {"kind": "mcp/proposal"},
    {"kind": "mcp/request", "payload": {"method": "tools/*"}},
    {"kind": "chat"}
  ],
  "modified_by": "admin-user",
  "modified_at": "2025-08-26T14:30:00Z"
}
```

---

## References

- MCP Specification 2025-06-18
- MEUP v0.0 Specification
- ADR-003: Tool Access Control
- OAuth 2.0 RFC 6749 (for token patterns)