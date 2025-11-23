# MEW Protocol v0.4 Specification

Version: v0.4  
Status: Released  
Release Date: 2025-09-26  
Intended Status: Experimental  
Editors: RJ Corwin (https://github.com/rjcorwin)

---

## Requirements Language

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119 and RFC 8174.

---

## 1. Abstract

MEW Protocol (Multi-Entity Workspace Protocol) provides a unified context where all agent-to-agent and agent-to-tool interactions are visible and controllable at the protocol layer. The name playfully evokes "herding cats" - the quintessential challenge of coordinating multiple independent, autonomous agents who each have their own goals and behaviors. Unlike traditional systems where AI coordination happens in hidden contexts, MEW Protocol broadcasts all messages within a shared workspace, enabling participants to observe everything and privileged users to approve or reject actions through a proposal-review pattern. The protocol extends MCP semantics while adding capability-based access control, allowing untrusted agents to propose operations that trusted participants execute. This transparency enables progressive automation, where systems learn from human decisions to safely expand their autonomous capabilities over time - essentially teaching the "cats" to work together effectively.

---

## 2. Goals and Non-Goals

### 2.1 Goals
- **Unified Context**: All participants share the same visible stream of interactions
- **Protocol-Level Control**: Control actions through capabilities and proposals, not application wrappers
- **Progressive Automation**: Learn from human decisions to safely expand autonomous operations
- **Tool Compatibility**: Preserve existing MCP tool and resource interfaces

### 2.2 Non-Goals
- End-to-end encryption or private channels (all messages visible within space)
- Message persistence or replay (spaces are ephemeral)
- Cross-space routing or participant discovery
- Guaranteed delivery or ordering (WebSocket best-effort)
- Application-specific semantics beyond MCP operations
- Configuration management (implementation-specific)

---

## 3. Message Envelope

All data flowing over a space MUST be a single top-level JSON envelope:

```json
{
  "protocol": "mew/v0.4",
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
- `protocol`: MUST be `"mew/v0.4"` for this version
- `id`: globally unique message id (e.g., UUIDv4)
- `ts`: RFC3339 timestamp
- `from`: stable participant id within the space
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
  - `reasoning/cancel` - Abort an in-progress reasoning sequence
  - `capability/grant` - Grant capabilities to participant
  - `capability/revoke` - Revoke capabilities from participant
  - `capability/grant-ack` - Acknowledge capability grant
  - `space/invite` - Invite participant to space
  - `space/kick` - Remove participant from space
  - `participant/pause` - Pause outbound activity from a participant
  - `participant/resume` - Resume a participant after a pause
  - `participant/status` - Report usage status (e.g., tokens consumed vs. maximum) including current message counts per context
  - `participant/request-status` - Ask a participant to emit its current status
  - `participant/forget` - Instruct a participant to drop cached context (oldest or newest data)
  - `participant/compact` - Request that a participant compact its working memory to free headroom
  - `participant/compact-done` - Participant acknowledgement that compaction is complete
  - `participant/clear` - Wipe the participant's entire conversational context or scratchpad
  - `participant/restart` - Restart a participant back to a known baseline state
  - `participant/shutdown` - Request an orderly shutdown that ends activity without restarting
  - `stream/request` - Ask the gateway to establish a new data stream
  - `stream/open` - Gateway confirms stream creation with assigned identifier
  - `stream/close` - Close a previously opened stream
  - `chat` - Chat messages
  - `chat/acknowledge` - Confirm receipt of a chat message
  - `chat/cancel` - Withdraw attention from a chat message that no longer needs action
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
  "protocol": "mew/v0.4",
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

Responses MUST include the `correlation_id` field referencing the original request's `id`. This is critical for translating MCP's client-server request/response model to MEW Protocol's multi-participant broadcast paradigm, allowing all participants to match responses to their corresponding requests.

Response to the above tool call:

```json
{
  "protocol": "mew/v0.4",
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
  "protocol": "mew/v0.4",
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

This is a MEW Protocol-specific extension that proposes an MCP operation requiring fulfillment by a participant with appropriate capabilities.

#### 3.2.1 Proposal Fulfillment

A participant with appropriate capabilities fulfills the proposal by making the real MCP call. The `correlation_id` field is critical for matching approvals to their original proposals:
- Proposals typically don't include `correlation_id` (they originate new workflows)
- Fulfillment messages MUST include `correlation_id` referencing the proposal's `id`
- This allows participants to track which fulfillment corresponds to which proposal
- The correlation chain enables audit trails and multi-step approval workflows

Example fulfillment:

```json
{
  "protocol": "mew/v0.4",
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
  "protocol": "mew/v0.4",
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

MEW Protocol extends the proposal pattern with lifecycle operations for cancellation and feedback.

#### 3.3.1 Withdraw Proposals (kind = "mcp/withdraw")

Proposers can withdraw their own proposals that are no longer needed:

```json
{
  "protocol": "mew/v0.4",
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
  "protocol": "mew/v0.4",
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

Lifecycle operations may use the following suggested reason codes (optional and non-normative):

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

These reason codes are suggestions only; participants MAY use other reason strings and MUST handle unknown codes gracefully.

Detailed explanations can be provided via follow-up chat messages using `correlation_id`:

```json
{
  "protocol": "mew/v0.4",
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

Chat messages are MEW Protocol-specific and do not pollute the MCP namespace:

```json
{
  "protocol": "mew/v0.4",
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

#### 3.4.1 Chat Acknowledge (kind = "chat/acknowledge")

Acknowledges receipt of a chat message without generating additional conversation content. Useful when participants need to
signal that they observed a chat entry but have no substantive reply:

```json
{
  "protocol": "mew/v0.4",
  "id": "chat-ack-1",
  "from": "agent-1",
  "kind": "chat/acknowledge",
  "correlation_id": ["env-chat-1"],
  "payload": {
    "status": "received"
  }
}
```

- `correlation_id` MUST reference the chat envelope being acknowledged
- `payload.status` conveys acknowledgement semantics (implementations MAY standardize values like `"received"` or
  `"read"`)
- Gateways MAY suppress broadcasting acknowledgements to reduce noise, but if delivered they provide an auditable confirmation
  that the message was seen
- User interfaces often surface a **queue of chat messages awaiting acknowledgement** so that humans and agents can close the
  loop explicitly. Clearing that queue SHOULD emit acknowledgements for each entry to provide an auditable trail.

#### 3.4.2 Chat Cancel (kind = "chat/cancel")

Signals that an earlier chat message no longer requires attention. This helps UIs and agents clear acknowledgement queues and
avoid stale follow-ups:

```json
{
  "protocol": "mew/v0.4",
  "id": "chat-cancel-1",
  "from": "user-alice",
  "kind": "chat/cancel",
  "to": ["agent-1"],
  "correlation_id": ["env-chat-1"],
  "payload": {
    "reason": "handled elsewhere"
  }
}
```

- `correlation_id` MUST reference the chat message that is being cancelled
- `payload.reason` SHOULD communicate why the message no longer needs attention (e.g., `"handled_elsewhere"`,
  `"duplicate"`, `"timeout"`)
- UIs MAY provide a shortcut to cancel **all** unacknowledged chat messages, emitting one cancellation per message to keep
  participants in sync

### 3.5 Reasoning Transparency

MEW Protocol supports transparent reasoning through dedicated message kinds and the context field. This allows agents to share their thinking process while maintaining clear boundaries between reasoning sequences and regular operations.

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
  "protocol": "mew/v0.4",
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
  "protocol": "mew/v0.4",
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
  "protocol": "mew/v0.4",
  "id": "reason-end-1",
  "from": "agent-1",
  "kind": "reasoning/conclusion",
  "context": "reason-start-1",
  "payload": {
    "message": "Configuration update is safe to proceed. The changes are valid YAML and won't break existing settings."
  }
}
```

#### 3.5.5 Reasoning Cancel (kind = "reasoning/cancel")

Terminates an active reasoning sequence without providing a conclusion. Useful when the initiating trigger is withdrawn or the
participant needs to abort due to higher-priority work:

```json
{
  "protocol": "mew/v0.4",
  "id": "reason-cancel-1",
  "from": "agent-1",
  "kind": "reasoning/cancel",
  "context": "reason-start-1",
  "payload": {
    "reason": "superseded"
  }
}
```

- `context` MUST reference the `reasoning/start` envelope establishing the sequence
- `correlation_id` MAY reference the triggering request/proposal if the reasoning was in response to another message
- `payload.reason` SHOULD use deployment-defined codes (e.g., `"timeout"`, `"superseded"`, `"error"`) to simplify monitoring
- Upon cancellation, participants SHOULD stop sending additional `reasoning/thought` messages for that context
- User-facing surfaces (CLIs, dashboards) SHOULD provide an explicit affordance to issue `reasoning/cancel` for any active
  reasoning sequence so humans can interrupt long-running work without crafting raw envelopes

#### 3.5.6 Context Behavior

- Messages with a `context` field are part of a sub-context
- Participants MAY filter out contexts when constructing prompts (e.g., excluding other agents' reasoning traces to reduce noise)
- **Exception**: Participants MUST NOT ignore `mcp/request` or `mcp/proposal` messages, even if they have a context field
- The context field supports hierarchical paths: `"parent/child/grandchild"`
- Context enables parallel reasoning by multiple agents without interference

### 3.6 Space Management Operations

A **space** in MEW Protocol is a communication context where participants exchange messages. It's analogous to a channel or room - a bounded environment where a specific set of participants collaborate. Each space has its own:
- Set of participants (who can send/receive messages)
- Capability assignments (what each participant can do)
- Message history (the stream of envelopes exchanged)

A gateway may manage multiple spaces, each isolated from the others. The gateway enforces capabilities and routing rules for all its spaces.

MEW Protocol extends with operations for managing these spaces dynamically. These operations use the `capability/*` and `space/*` namespaces to clearly indicate their purpose.

#### 3.6.1 Grant Capabilities (kind = "capability/grant")

Allows participants with appropriate capabilities to grant capabilities to other participants:

```json
{
  "protocol": "mew/v0.4",
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

**Capability Update Flow:**

When the gateway processes a `capability/grant`:

1. **Validate**: Check sender has `capability/grant` permission
2. **Store**: Add granted capabilities to recipient's runtime capability set
3. **Notify**: Send updated `system/welcome` to recipient with combined static + runtime capabilities
4. **Acknowledge**: Recipient sends `capability/grant-ack` after updating capabilities

**Important**: The gateway MUST resolve logical participant names to actual participant IDs when sending the updated welcome. If the recipient's participant ID differs from their logical name (e.g., "mew" vs "client-123"), the gateway must maintain a mapping (see Section 3.6.4).

**Example Flow**:

```
1. Human → Gateway: capability/grant (to: ["mew"])
2. Gateway: Validates, stores capabilities for "mew"
3. Gateway → Agent: system/welcome (to: ["client-123"], with new capabilities)
4. Agent: Updates participantInfo.capabilities
5. Agent → Gateway: capability/grant-ack (correlation_id: ["grant-789"])
```

#### 3.6.2 Revoke Capabilities (kind = "capability/revoke")

Revokes previously granted capabilities:

```json
{
  "protocol": "mew/v0.4",
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
  "protocol": "mew/v0.4",
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
  "protocol": "mew/v0.4",
  "id": "ack-001",
  "from": "agent",
  "correlation_id": ["grant-789"],
  "kind": "capability/grant-ack",
  "payload": {
    "status": "accepted"
  }
}
```

#### 3.6.4 Participant ID Resolution

Gateways MUST maintain a mapping between logical participant names (from configuration) and runtime participant IDs (from WebSocket connections):

- **Logical names** are defined in space configuration (e.g., "mew", "orchestrator")
- **Runtime IDs** are assigned during connection (e.g., "client-1234567-abc")
- Messages addressed to logical names must be resolved to runtime IDs for delivery

When processing `capability/grant`, `capability/revoke`, or other messages that reference participants by name, the gateway MUST:

1. Resolve the logical name to the actual runtime participant ID
2. Use the runtime ID to locate the participant's WebSocket connection
3. Deliver messages using the runtime ID

**Implementation Strategy:**

Gateways can maintain this mapping by:
- Creating a map of `logicalName → runtimeClientID` when participants join
- Looking up tokens: `logicalName → token` (from config) and `runtimeClientID → token` (from connection)
- Matching tokens to resolve logical names to runtime IDs

**Example:**

```
Space config defines: "mew" with token "abc123"
Agent connects with: participant_id = "client-1759310701273-q9i1e5jkg", token = "abc123"
Gateway stores: "mew" → "client-1759310701273-q9i1e5jkg"

When processing capability/grant with recipient="mew":
1. Look up logical name "mew" → token "abc123"
2. Find runtime participant with token "abc123" → "client-1759310701273-q9i1e5jkg"
3. Send system/welcome to "client-1759310701273-q9i1e5jkg"
```

#### 3.6.5 Invite Participant (kind = "space/invite")

Invites new participants to the space:

```json
{
  "protocol": "mew/v0.4",
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

#### 3.6.6 Remove Participant (kind = "space/kick")

Removes participants from the space:

```json
{
  "protocol": "mew/v0.4",
  "id": "kick-456",
  "from": "admin",
  "kind": "space/kick",
  "payload": {
    "participant_id": "misbehaving-agent",
    "reason": "Repeated capability violations"
  }
}
```

#### 3.6.7 Delegation Security

- Only participants with `capability/grant` capability can grant capabilities
- Participants cannot grant capabilities they don't possess
- Gateway SHOULD track grant chains for audit purposes
- Revocations take effect immediately
- All space management operations generate audit logs

### 3.7 Presence Messages (kind = "system/presence")

Presence messages are broadcast to notify all participants about join/leave events:

```json
{
  "protocol": "mew/v0.4",
  "id": "env-presence-1",
  "from": "system:gateway",
  "kind": "system/presence",
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
  "protocol": "mew/v0.4",
  "id": "env-welcome-1",
  "ts": "2025-01-09T10:00:00Z",
  "from": "system:gateway",
  "to": ["new-participant"],
  "kind": "system/welcome",
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
    ],
    "active_streams": [
      {
        "stream_id": "stream-42",
        "owner": "agent-1",
        "direction": "upload",
        "created": "2025-01-09T10:00:00Z",
        "content_type": "application/json",
        "format": "jsonl",
        "description": "Chain-of-thought reasoning",
        "expected_size_bytes": 1048576
      }
    ]
  }
}
```

- `you`: The joining participant's own information and authoritative capabilities
- `participants`: Current list of other participants in the space and their capabilities
- `active_streams` (optional): Array of currently active streams in the space [j8v]. Each stream object contains:
  - `stream_id` (required): Unique identifier for the stream
  - `owner` (required): Participant ID that requested the stream
  - `direction` (required): "upload" or "download"
  - `created` (required): ISO 8601 timestamp when the stream was opened
  - `expected_size_bytes` (optional): Size hint from original request
  - `description` (optional): Human-readable description from original request
  - `content_type` (optional): MIME type or format identifier (e.g., "application/json", "application/x-game-positions")
  - `format` (optional): Stream schema/encoding (e.g., "jsonl", "binary-vector3")
  - `metadata` (optional): Arbitrary key-value pairs from original request
  - Additional custom fields from the original `stream/request` are preserved
  - May be omitted or empty array if no streams are active
  - **Design principle:** All fields from the original `stream/request` payload are preserved to ensure late joiners have complete context about stream format and purpose

**Important:** Other participants SHOULD ignore welcome messages not addressed to them when constructing prompts, as these can cause significant bloat. The message is already targeted via the `to` field.

#### 3.8.2 Capability Violation (kind = "system/error")

When a participant attempts an operation they lack capability for:

```json
{
  "protocol": "mew/v0.4",
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

### 3.9 Participant Control Messages

Participant control envelopes allow coordinators and the gateway to modulate how agents operate in a space. They provide a
uniform mechanism for pausing work, requesting telemetry, and resetting state without overloading the MCP namespace.

#### 3.9.1 Pause Participant (kind = "participant/pause")

Requests that a participant temporarily stop emitting new work:

```json
{
  "protocol": "mew/v0.4",
  "id": "pause-1",
  "from": "orchestrator",
  "to": ["agent-1"],
  "kind": "participant/pause",
  "payload": {
    "reason": "rate_limit",
    "timeout_seconds": 60
  }
}
```

- Target participant SHOULD stop sending envelopes other than acknowledgements or cancellations until resumed
- `payload.timeout_seconds` MAY be provided so the participant can automatically resume if no explicit resume arrives
- Gateways MAY enforce pauses by rejecting other outbound traffic while in effect

#### 3.9.2 Resume Participant (kind = "participant/resume")

Lifts a previously applied pause:

```json
{
  "protocol": "mew/v0.4",
  "id": "resume-1",
  "from": "orchestrator",
  "to": ["agent-1"],
  "kind": "participant/resume",
  "correlation_id": ["pause-1"],
  "payload": {}
}
```

- `correlation_id` SHOULD reference the pause being cleared when known
- Participants MAY resume autonomously when a pause timeout expires, but SHOULD still emit a `participant/resume` to document
  the change in state

#### 3.9.3 Request Status (kind = "participant/request-status")

Asks a participant to emit its current utilization telemetry. Earlier drafts referenced this as `participant/requestStatus`; the
hyphenated name is normative:

```json
{
  "protocol": "mew/v0.4",
  "id": "status-request-1",
  "from": "orchestrator",
  "to": ["agent-1"],
  "kind": "participant/request-status",
  "payload": {
    "fields": ["tokens", "latency"]
  }
}
```

- `payload.fields` MAY limit which metrics are requested
- Participants SHOULD answer with `participant/status` promptly

#### 3.9.4 Participant Status (kind = "participant/status")

Reports runtime telemetry such as token consumption and context occupancy. This message is typically emitted in response to
`participant/request-status` but MAY be sent proactively:

```json
{
  "protocol": "mew/v0.4",
  "id": "status-1",
  "from": "agent-1",
  "kind": "participant/status",
  "correlation_id": ["status-request-1"],
  "payload": {
    "tokens": 12345,
    "max_tokens": 20000,
    "messages_in_context": 128,
    "latency_ms": 350
  }
}
```

- `tokens` and `max_tokens` provide the usage context introduced in this release
- `messages_in_context` MUST be included and counts envelopes currently retained for the active conversational context
- Additional metrics are allowed and should use descriptive snake_case keys
- Participants MAY broadcast status to improve observability, but gateways MAY limit dissemination to reduce noise
- Participants MAY also emit `participant/status` proactively when approaching a resource limit (for example, when only 10%
  of the context window remains) so orchestrators can intervene before prompts truncate unexpectedly

#### 3.9.5 Participant Forget (kind = "participant/forget")

Instructs a participant to drop cached context. The `payload.direction` field indicates whether to trim from the oldest or
newest data, corresponding to the `(Oldest|Newest)` notation in the request:

```json
{
  "protocol": "mew/v0.4",
  "id": "forget-1",
  "from": "orchestrator",
  "to": ["agent-1"],
  "kind": "participant/forget",
  "payload": {
    "direction": "oldest",
    "entries": 10
  }
}
```

- `direction` MUST be either `"oldest"` or `"newest"`
- `entries` (optional) specifies how many records or messages to discard; implementations MAY interpret as tokens
- Participants SHOULD emit a follow-up `participant/status` or `chat/acknowledge` once the context is dropped
- Agents SHOULD monitor their context usage and automatically trigger a forget/compaction cycle before hitting hard limits.
  When compacting autonomously, they MUST send a `participant/status` update indicating the compaction status and resulting
  resource headroom so observers understand why history changed.

#### 3.9.6 Participant Compact (kind = "participant/compact")

Requests that a participant run its compaction routine to free headroom in its working memory or conversational history:

```json
{
  "protocol": "mew/v0.4",
  "id": "compact-1",
  "from": "orchestrator",
  "to": ["agent-1"],
  "kind": "participant/compact",
  "payload": {
    "reason": "token_pressure",
    "target_tokens": 16000
  }
}
```

- `payload.reason` (optional) provides operator context the participant MAY log or surface in status updates
- `payload.target_tokens` (optional) indicates a desired ceiling after compaction; participants MAY ignore if unsupported
- Participants that maintain working memory SHOULD attempt compaction promptly and emit interim `participant/status` updates
  such as `compacting` / `compacted`
- Participants with no compactable state MAY ignore the request entirely or MAY reply with `participant/compact-done` including
  `"skipped": true` to document that nothing changed

#### 3.9.7 Participant Compaction Complete (kind = "participant/compact-done")

Acknowledges the completion (or intentional skip) of a requested compaction:

```json
{
  "protocol": "mew/v0.4",
  "id": "compact-done-1",
  "from": "agent-1",
  "to": ["orchestrator"],
  "kind": "participant/compact-done",
  "correlation_id": ["compact-1"],
  "payload": {
    "freed_tokens": 2048,
    "freed_messages": 12,
    "status": "compacted"
  }
}
```

- `correlation_id` MUST reference the originating `participant/compact` request when one exists
- `freed_tokens` / `freed_messages` (optional) report how much context was reclaimed
- When compaction is skipped, participants SHOULD include `"skipped": true` and MAY add a human-readable `"reason"`
- Participants MUST send `participant/compact-done` after completing work triggered by `participant/compact`, even if no context
  was removed, so orchestrators can clear pending actions

#### 3.9.8 Participant Clear (kind = "participant/clear")

Instructs a participant to wipe its entire retained conversational or working memory:

```json
{
  "protocol": "mew/v0.4",
  "id": "clear-1",
  "from": "orchestrator",
  "to": ["agent-1"],
  "kind": "participant/clear"
}
```

- `participant/clear` SHOULD be treated as stronger than `participant/forget` and MUST erase all cached context, scratchpads, and working memories
- No additional payload fields are required; implementations MAY omit the `payload` property or include an empty object if their transport requires it
- Participants SHOULD emit a follow-up `participant/status` confirming an empty context (e.g., `messages_in_context = 0`)

#### 3.9.9 Participant Restart (kind = "participant/restart")

Returns a participant to a known baseline configuration:

```json
{
  "protocol": "mew/v0.4",
  "id": "restart-1",
  "from": "orchestrator",
  "to": ["agent-1"],
  "kind": "participant/restart"
}
```

- No standard payload fields are required; implementations MAY include vendor-specific restart hints if all participants support them
- Participants SHOULD terminate outstanding workflows and streams when restarting
- Gateways MAY treat a restart as implicit acknowledgement that previous capability grants remain in effect unless explicitly
  revoked

#### 3.9.10 Participant Shutdown (kind = "participant/shutdown")

Requests that a participant cease all activity without restarting, allowing the orchestrator to keep the slot idle or replace it later:

```json
{
  "protocol": "mew/v0.4",
  "id": "shutdown-1",
  "from": "orchestrator",
  "to": ["agent-1"],
  "kind": "participant/shutdown"
}
```

- No standard payload fields are required; orchestrators MAY include optional context if their counterpart supports it
- Participants SHOULD acknowledge shutdown via `chat/acknowledge` or by emitting a terminal `system/presence` leave event
- After shutdown, gateways SHOULD reject further outbound envelopes from the participant until it rejoins the space

---

### 3.10 Stream Lifecycle Messages

Streaming envelopes coordinate high-volume or binary data transfer while keeping the core message bus lightweight.

#### 3.10.1 Stream Request (kind = "stream/request")

Sent by whichever entity initiates stream negotiation (typically a participant asking the gateway for bulk-transfer resources):

```json
{
  "protocol": "mew/v0.4",
  "id": "stream-req-1",
  "from": "agent-1",
  "to": ["gateway"],
  "kind": "stream/request",
  "payload": {
    "direction": "upload",
    "expected_size_bytes": 10485760,
    "description": "Large dataset export",
    "content_type": "application/json",
    "format": "jsonl",
    "metadata": {
      "compression": "gzip",
      "schema_version": "1.0"
    }
  }
}
```

**Payload Fields:**
- `direction` (required): "upload" or "download" - clarifies data flow direction
- `expected_size_bytes` (optional): Advisory size hint for the stream
- `description` (optional): Human-readable description of stream purpose
- `content_type` (optional): MIME type or custom format identifier (e.g., "application/json", "application/x-game-positions")
- `format` (optional): Stream schema/encoding specification (e.g., "jsonl", "binary-vector3", "utf8-newline-delimited")
- `metadata` (optional): Arbitrary key-value pairs for application-specific metadata
- Additional custom fields are allowed and will be preserved [j8v]

**Gateway Behavior:**
- The gateway MUST intercept all `stream/request` messages and reply with `stream/open` containing a unique `stream_id`
- The gateway MUST preserve ALL payload fields from the request and include them in `active_streams` when sending `system/welcome` to late joiners [j8v]
- The gateway is responsible for stream ID allocation and management, regardless of the request's `to` field
- `correlation_id` (not shown) MAY reference the message that motivated the stream (e.g., a proposal or request)

**Usage Notes:**
- Agents that expose long-form reasoning SHOULD consider issuing a `stream/request` alongside `reasoning/start` so subscribers can follow high-volume traces without bloating the shared envelope log
- Applications with custom stream formats (like games) SHOULD include `content_type` and `format` to enable late joiners to properly parse stream data

#### 3.10.2 Stream Open (kind = "stream/open")

Confirms that a stream has been established and assigns the identifier used for raw frames:

```json
{
  "protocol": "mew/v0.4",
  "id": "stream-open-1",
  "from": "gateway",
  "to": ["agent-1"],
  "kind": "stream/open",
  "correlation_id": ["stream-req-1"],
  "payload": {
    "stream_id": "stream-42",
    "encoding": "binary"
  }
}
```

- `payload.stream_id` MUST be unique per active stream on the connection
- Additional metadata such as `encoding` or `compression` MAY be provided for the receiver

#### 3.10.3 Stream Data Frames (no envelope)

Once a stream is open, binary or chunked data travels on the same WebSocket without the JSON envelope wrapper. Frames are prefixed using the pattern `#streamID#data`, matching the `#streamID#data` example provided with this update. Implementations MUST ensure framing preserves boundaries so receivers can demultiplex concurrent streams.

#### 3.10.4 Stream Close (kind = "stream/close")

Terminates a stream and releases associated resources:

```json
{
  "protocol": "mew/v0.4",
  "id": "stream-close-1",
  "from": "gateway",
  "to": ["agent-1"],
  "kind": "stream/close",
  "correlation_id": ["stream-open-1"],
  "payload": {
    "reason": "complete"
  }
}
```

- Either side MAY send `stream/close`
- `payload.reason` SHOULD distinguish between normal completion and errors (e.g., `"complete"`, `"cancelled"`, `"timeout"`)
- After closing, no additional `#streamID#...` frames MUST be sent

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
The `system/*` namespace is reserved exclusively for the gateway. Participants MUST NOT send messages with `kind` starting with `system/`. The gateway MUST reject any such attempts. Only the gateway can generate system messages (`system/welcome`, `system/presence`, `system/error`).

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
3. **Space access control**: Spaces may be public, private, or restricted
4. **Dynamic capabilities**: Capabilities may be modified during a session

### 5.2 WebSocket Connection

Connect: `GET /ws?space=<name>` with Authorization header

The gateway:
1. Validates the bearer token (if provided)
2. Maps the token to a participant ID (implementation-specific)
3. Determines capabilities based on implementation policy
4. **MUST** send welcome message with the assigned participant ID and accurate capabilities
5. **MUST** enforce capability rules on all subsequent messages

**Note:** Participants only provide their bearer token. The gateway is responsible for mapping tokens to participant IDs through its own implementation-specific mechanism.

The capabilities in the welcome message constitute the authoritative list of what operations the participant can perform. Participants SHOULD use this list to understand their allowed operations.

### 5.3 HTTP Message Injection (Optional)

Gateways MAY expose HTTP endpoints that let trusted callers inject MEW envelopes without maintaining a WebSocket connection. These endpoints mirror the WebSocket semantics and MUST enforce the same capability rules as live connections.

```
POST /participants/{participant_id}/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "kind": "chat",
  "payload": {
    "text": "Hello world"
  }
}
```

**Typical response**
```json
{
  "id": "msg-123",
  "status": "accepted",
  "timestamp": "2025-01-09T10:00:00Z"
}
```

Gateways MAY also expose a retrieval endpoint for polling scenarios:

```
GET /participants/{participant_id}/messages?since={timestamp}
Authorization: Bearer {token}
```

Responses MUST contain complete envelopes and respect the caller's capabilities; messages the caller lacks permission to view MUST be omitted.

### 5.4 Message Filtering

For each incoming message from a participant:

```python
if not matches_any_capability(message, participant.capabilities):
    send_error(f"Capability violation: you lack capability for this operation")
    broadcast_violation_notice()  # optional
    return
send_to_space(message)
```

---

## 6. Version Compatibility

### 6.1 Breaking Changes

This is a v0.x release. Breaking changes are expected between minor versions until v1.0:
- v0.4 is NOT backward compatible with v0.3
- Clients and gateways MUST use matching protocol versions
- No compatibility guarantees until v1.0 release

### 6.2 Migration from v0.3

Key updates in v0.4:
- Protocol identifier changed from `mew/v0.3` to `mew/v0.4`
- Added participant control messages for runtime management: `participant/request-status`, `participant/status`, `participant/forget`, `participant/clear`, `participant/restart`, and `participant/shutdown`
- Introduced stream lifecycle support (`stream/request`, `stream/open`, `stream/close`) plus binary frame guidance for high-volume data
- Documented optional HTTP message injection endpoints alongside the WebSocket channel

### 6.3 Migration from v0.2

Key breaking changes from v0.2 (cumulative):
- Protocol name changed from MEUP to MEW Protocol
- Protocol identifier changed from `meup/v0.2` to `mew/v0.4`
- Full name is now "Multi-Entity Workspace Protocol"

### 6.4 Migration from v0.0

Key breaking changes from v0.0 (cumulative):
- Protocol identifier changed from `mcp-x/v0` to `mew/v0.4`
- Message kinds now use slash notation (e.g., `mcp/request` instead of `mcp/request:tools/call`)
- Method information moved to payload
- Capabilities use JSON pattern matching instead of string wildcards
- `correlation_id` is now always an array
- Chat remains as dedicated `chat` kind

### 6.5 Future Compatibility

- v0.x series is experimental and subject to breaking changes
- v1.0 will establish stable protocol with compatibility guarantees
- Production deployments should pin specific v0.x versions

---

## 7. Security Considerations

MEW Protocol's security model relies on capability-based access control enforced by the gateway, with additional validation responsibilities distributed among participants.

### 7.1 Core Security Mechanisms

1. **Identity Validation**: Gateway MUST verify the `from` field matches the authenticated participant ID (Section 4.1)
2. **Capability Enforcement**: Gateway enforces JSON pattern-based capabilities on all messages (Section 4.1, 4.2)
3. **Reserved Namespaces**: Only the gateway can send `system/*` messages, preventing spoofing (Section 3.8)
4. **Proposal Isolation**: Untrusted agents use `mcp/proposal` to suggest rather than execute operations (Section 3.3)
5. **Lazy Gateway Enforcement**: Gateway validates message structure but not payload semantics (Section 4.2)

### 7.2 Security Boundaries

**Gateway Responsibilities:**
- Authenticate participants and assign stable IDs
- Enforce capability patterns on message kinds and payloads
- Prevent identity spoofing via `from` field validation
- Block `system/*` messages from participants

**Participant Responsibilities:**
- Validate envelope `kind` matches payload content
- Detect and report malformed or spoofed messages
- Parse messages defensively (schemas may differ from advertised)
- Track misbehaving participants for reputation scoring

### 7.3 Best Practices

1. **Start Restricted**: New agents begin with `mcp/proposal` capability only
2. **Progressive Trust**: Expand capabilities based on observed behavior over time
3. **Validate Strictly**: Check that `kind` matches the payload type (e.g., `mcp/request` for MCP requests)
4. **Monitor Proposals**: Log proposal/fulfillment patterns for audit trails
5. **Report Violations**: Track and broadcast capability violations for transparency

---

## 8. Implementation Checklist

### 8.1 Gateway Requirements
- [ ] **Connection Management**
  - [ ] WebSocket server at `GET /ws?space=<name>`
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
  - [ ] Preserve envelope structure without modification
  - [ ] NO payload parsing or validation (lazy enforcement)

### 8.2 Participant Requirements
- [ ] **Message Validation**
  - [ ] Verify envelope structure before processing
  - [ ] Validate `kind` matches the payload type (e.g., `mcp/request` for requests with `payload.method`)
  - [ ] Validate payload structure matches expected schema for the `kind`
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

The following examples demonstrate multi-agent orchestration patterns enabled by MEW Protocol's capability-based security model. The core pattern is **delegated fulfillment**, where untrusted agents propose operations that are reviewed and executed by trusted participants.

### 9.1 Proposal-Based Workflow Example

In this example, an agent with limited capabilities uses proposals:

1. Agent connects → receives proposal-only capabilities
2. Agent attempts MCP request → gateway blocks, returns error
3. Agent sends `mcp/proposal` → visible to all participants
4. Another participant with appropriate capabilities fulfills it
5. Fulfiller sends real `mcp/request` message to target
6. Target executes and returns result to fulfiller (proposer observes via broadcast)

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

All participants operate in the same space with their assigned capabilities.

### 9.4 Delegated Fulfillment Example

A human supervises an untrusted agent through intermediary agents:

1. **Proposer Agent** (capability: `mcp/proposal`) proposes writing a file
2. **Human** reviews the proposal and decides to approve it by directing the **Orchestrator Agent** (capability: `mcp/request`) to fulfill the proposal
3. **Orchestrator Agent** sends the MCP request to **Worker Agent**
4. **Worker Agent** executes the actual file write operation and responds
5. Over time, **Human** teaches **Orchestrator Agent** rules about which proposals to auto-approve
6. **Orchestrator Agent** begins autonomously fulfilling certain proposals without human intervention

This pattern demonstrates **progressive automation** - a key goal of MEW Protocol. As the orchestrator observes human decisions over time, it learns which types of proposals can be safely auto-approved. This transforms human judgment into automated policies, creating a system that becomes more autonomous while maintaining safety through learned boundaries.

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

---

## References

- MCP Specification 2025-06-18
- MEW v0.0 Specification (formerly MEUP)
- ADR-003: Tool Access Control
- OAuth 2.0 RFC 6749 (for token patterns)
