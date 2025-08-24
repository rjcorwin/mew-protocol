# MCPx v0 Protocol Specification (Draft)

Status: Draft v0  
Date: 2025-08-17  
Intended Status: Informational  
Editors: MCPx Working Group (RJ Corwin)

---

## Requirements Language

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119 and RFC 8174.

---

## 1. Abstract

MCPx v0 defines a minimal, topic‑based meta‑message format and a realtime gateway API that allows multiple MCP servers (agents/humans/robots) to interoperate in shared “rooms.”

- Every participant behaves like an MCP server.  
- Messages are published to a topic and are visible to all participants.  
- A message’s intended recipient(s) is expressed as metadata; delivery is not private at the topic layer.  
- MCP (JSON‑RPC 2.0) requests/responses are encapsulated inside a simple envelope.

This v0 deliberately focuses on MCP tools. Resources/Prompts are out of scope unless they work transparently through the same mechanism.

---

## 2. Goals and Non‑Goals

### 2.1 Goals
- Simplicity: a "USB‑C for multi‑agent collaboration."
- Interop: treat all participants as MCP servers and let them call each other's tools.
- Transport: encourage realtime via WebSockets; clients can get presence and recent history easily.
- Security: require token‑based auth; make the non‑private nature explicit.
- Platform bridges: enable existing chat platforms (Slack, Discord, XMPP, Matrix) to implement MCPx gateways, allowing MCP agents to participate in their native channels.

### 2.2 Non‑Goals (v0)
- Built‑in task semantics (handled via MCP tools if desired).
- End‑to‑end encryption or private DMs (use separate topics or higher‑layer crypto if needed).
- Schema registries/ACL granularity beyond topic admission.
- Topic lifecycle management (creation, configuration, deletion) - topics are assumed to exist; management is implementation-specific.

---

## 3. Model Overview

- Topic: named room (e.g., `room:alpha`).
- Participant: any client (human UI, robot, agent) that joins a topic. Each participant SHOULD expose an MCP server interface to others.
- Visibility: all published messages in a topic are visible to all participants. “To” metadata is advisory routing metadata, not a privacy boundary.
- Addressing: participants can broadcast, or address one/many participants. Participants ignore messages not addressed to them.

---

## 4. Message Envelope

All data flowing over a topic MUST be a single top‑level JSON envelope. This enables multiplexing different kinds of payloads while keeping routing and correlation consistent.

```json
{
  "protocol": "mcp-x/v0",
  "id": "2f6b6e70-7b36-4b8b-9ad8-7c4f7d0e2d0b",
  "ts": "2025-08-17T14:00:00Z",
  "from": "robot-alpha",
  "to": ["coordinator"],
  "kind": "mcp",
  "correlation_id": "env-1",
  "payload": { /* kind-specific body (see below) */ }
}
```

Field semantics:
- protocol: MUST be `"mcp-x/v0"` for this version.
- id: globally unique message id (e.g., UUIDv4).
- ts: RFC3339 timestamp (producer clock).
- from: stable participant id within the topic (assigned on join or self‑asserted per deployment).
- to: array of participant ids indicating intended recipient(s); MAY be empty or omitted to indicate broadcast to all participants.
- kind: one of `mcp`, `presence`, or `system`.
- correlation_id: when a message semantically replies to another envelope, this field **MUST** be set to the target envelope `id`. Otherwise it MAY be omitted.
- payload: object; structure depends on `kind`.

### 4.1 MCP Encapsulation (kind = "mcp")

The payload MUST contain an embedded JSON‑RPC 2.0 message exactly as defined by MCP.

```json
{
  "payload": {
    "jsonrpc": "2.0",
    "id": 42,
    "method": "tools/call",
    "params": { /* MCP params */ }
  }
}
```

Rules:
- Requests (messages with `payload.id`) MUST set `to` to exactly one participant. Broadcasting requests is NOT supported as it breaks the MCP client/server model.
- Responses MUST carry the same `payload.id` as the request and MUST set `correlation_id` to the request envelope `id`.
- Notifications (no `payload.id`) MAY be broadcast (empty `to` array) or directed to specific participants.
- JSON‑RPC `payload.id` SHOULD be a number for consistency; clients MUST NOT coerce types and MUST echo the same type in responses.

Handshake over topics:
- Before sending MCP requests to a participant, the caller MUST perform the MCP initialization flow with that participant:
  1) Send `initialize` (JSON‑RPC request) addressed via `to: ["<target>"]`.
  2) Receive `initialize` result from the target.
  3) Send `notifications/initialized` (JSON‑RPC notification) to the target.
- Version negotiation and capability exchange MUST follow MCP 2025‑06‑18.
- Other participants will observe these handshake messages but MUST ignore those not addressed to them.
- All MCP methods including `resources/*`, `prompts/*`, and `tools/*` are passed through unchanged in the envelope payload.

Example initialize request in an envelope:

```json
{
  "protocol": "mcp-x/v0",
  "id": "env-init-1",
  "ts": "2025-08-17T14:00:00Z",

  "from": "coordinator",
  "to": ["robot-alpha"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": { "sampling": {}, "elicitation": {}, "roots": {} },
      "clientInfo": { "name": "Coordinator", "version": "1.0.0" }
    }
  }
}
```

#### 4.1.1 Reply Semantics

A reply is any envelope that semantically responds to a previous envelope.

- The reply envelope MUST set `correlation_id` to the original envelope `id`.
- The reply SHOULD set `to` to the original `from` (or a subset thereof).
- For MCP JSON‑RPC responses:
  - `payload.id` MUST equal the original MCP request `payload.id`.
  - `from` MUST be the participant that received the request.
  - `to` SHOULD be the requestor participant.

MCP response example:
```json
{
  "protocol": "mcp-x/v0",
  "id": "env-2",
  "ts": "2025-08-17T14:00:00Z",

  "from": "robot-alpha",
  "to": ["coordinator"],
  "kind": "mcp",
  "correlation_id": "env-1",
  "payload": {
    "jsonrpc": "2.0",
    "id": 42,
    "result": { "status": "ok" }
  }
}
```

Non‑request reply example (notification acknowledging a previous message):
```json
{
  "protocol": "mcp-x/v0",
  "id": "env-3",
  "ts": "2025-08-17T14:00:05Z",
  "from": "coordinator",
  "to": ["robot-alpha"],
  "kind": "mcp",
  "correlation_id": "env-chat-1",
  "payload": { 
    "jsonrpc": "2.0",
    "method": "notifications/message_acknowledged",
    "params": { "original_id": "env-chat-1" }
  }
}
```

### 4.2 Presence (kind = "presence")

Gateway‑emitted join/leave/heartbeat messages.

Payload schema:
```json
{
  "event": "join" | "leave" | "heartbeat",
  "participant": {
    "id": "string",
    "name": "string",
    "kind": "human" | "agent" | "robot",
    "mcp": { "version": "2025-06-18" }
  }
}
```

Example:
```json
{
  "payload": { "event": "join", "participant": {"id": "robot-alpha", "name": "Robot Alpha", "kind": "robot", "mcp": {"version": "2025-06-18"} } }
}
```

---

## 5. Realtime Gateway API

Deployments SHOULD offer a simple gateway that provides auth, presence, history, and a realtime stream.

### 5.1 Authentication
- Bearer token via `Authorization: Bearer <token>`.
- Tokens SHOULD be short‑lived and audience‑scoped to topics.

### 5.2 WebSocket (recommended)
- Connect: `GET /v0/ws?topic=<name>` with Authorization header.
- On open: server sends a `system` welcome with assigned `participant.id`, current participants, and optional recent history.
- Bidirectional: clients send/receive envelope objects as text frames (JSON).

### 5.3 REST (optional helpers)
- `GET /v0/topics` → list of visible topics.
- `GET /v0/topics/{topic}/participants` → presence list.
- `GET /v0/topics/{topic}/history?limit=100&before=<ts|id>` → recent envelopes (most recent first).

Pagination SHOULD be based on the envelope `id` or `ts`. History MAY be capped or disabled.

On open (welcome):
```json
{
  "protocol": "mcp-x/v0",
  "id": "env-welcome-1",
  "ts": "2025-08-17T14:00:00Z",

  "from": "system:gateway",
  "kind": "system",
  "payload": {
    "event": "welcome",
    "participant": {"id": "coordinator"},
    "participants": [
      {"id": "robot-alpha", "name": "Robot Alpha", "kind": "robot", "mcp": {"version": "2025-06-18"}}
    ],
    "history": { "enabled": true, "limit": 100 },
    "protocol": "mcp-x/v0"
  }
}
```

---

## 6. Participants and Presence

- Participant Identity: a stable `id` within the topic (e.g., `robot-alpha`). Display metadata MAY include `name`, `kind` (human/agent/robot), and `mcp.version`.
- Join/Leave: the gateway SHOULD emit `presence` events on joins and leaves. Heartbeats MAY be emitted for liveness.
- Discovery: participants MAY broadcast `mcp` notifications advertising MCP tool availability on join, or respond to discovery requests.

### 6.1 Peer Discovery and Handshake

See `PATTERNS.md` §2 for recommended discovery and handshake strategies (eager, lazy, on‑demand), concurrency/de‑duplication, and backoff guidance.

Briefly: discover peers from presence, then perform MCP `initialize` → `initialized` with selected peers via addressed `mcp` envelopes (others observe but ignore). Version negotiation MUST follow MCP 2025‑06‑18.

---

## 7. MCP Interop Rules

See `PATTERNS.md` §3–§5 for practical guidance on directed vs broadcast calls, aggregation, and coordinator patterns.

- Every participant SHOULD act as an MCP server.  
- Participants MAY also run an MCP client to invoke other participants’ tools.
- Addressing: when invoking a tool, set `to` to the target participant. Others MUST ignore MCP requests not addressed to them, but may observe them.
- Error Handling: MCP errors are returned as JSON‑RPC error objects inside `payload`. Gateways MUST NOT rewrite MCP payloads.

---

## 8. Chat Communication

See `PATTERNS.md` §9 for detailed chat implementation patterns.

### 8.1 Broadcast Chat Notifications (Recommended)

For room-wide chat messages, participants SHOULD use broadcast MCP notifications:

```json
{
  "protocol": "mcp-x/v0",
  "id": "env-chat-1",
  "ts": "2025-08-17T14:05:00Z",
  "from": "user-alice",
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "method": "notifications/chat/message",
    "params": {
      "text": "Hello everyone!",
      "format": "plain"
    }
  }
}
```

- Notifications with `method: "notifications/chat/message"` MAY be broadcast (empty or omitted `to` array).
- All participants SHOULD display/log these notifications if they support chat UX.
- Payload params MUST include `text` (string); `format` ("plain"|"markdown") is OPTIONAL and defaults to "plain".

### 8.2 Optional Chat Tools

Participants MAY provide these MCP tools as syntactic sugar:

- `chat.say` — params: `{ text: string, format?: "plain"|"markdown" }`; emits a `notifications/chat/message` broadcast.
- `presence.get` — returns the current presence list (equivalent to calling the REST API).

---

## 9. Security Considerations

Alignment with MCP security guidance (2025‑06‑18):
- Tool safety: UIs SHOULD require human confirmation for sensitive tools; treat tool annotations as untrusted unless verified.
- Data privacy: do not leak user data into public topics; hosts MUST obtain consent before exposing resources.
- Origin/transport: if using HTTP variants, validate `Origin`, prefer localhost binding for local servers, and authenticate all connections.
- Participant verification: gateways MUST verify that `from` matches the authenticated participant identity. Consider cryptographic signatures for high-security deployments.
- Rate limiting: implementations MAY apply per-participant rate limits to prevent abuse and implement backpressure.

---

## 10. Versioning and Negotiation

- The envelope `protocol` field MUST be `"mcp-x/v0"` for this version.
- Gateways SHOULD reject connects from clients that do not advertise support for `mcp-x/v0` (e.g., via a query param or first message).

---

## 11. Rationale (Pros/Cons)

- Single public stream per topic keeps implementations simple and auditable; addressing is metadata only.  
  - Pro: simple, observable, easy to debug; enables “peanut gallery.”  
  - Con: no privacy; bandwidth grows with participants. Use more topics or filtering if needed.
- MCP encapsulation avoids defining new RPC; client libraries can bridge JSON‑RPC requests/responses to the envelope with minimal glue.
- WebSockets provide low‑latency bidirectional streaming; SSE/HTTP polling MAY be supported but are discouraged for write paths.

---

## 12. Reference Client (Library Guidance)

A standard client library SHOULD:
- Expose a local MCP client that presents remote participants as selectable MCP servers.
- Handle envelope creation, addressing, correlation, and response matching.
- Provide helpers for presence, history, and chat notifications (`notifications/chat/message` listening and broadcast).
- Offer pluggable auth token providers and reconnection with backoff.

---

## 13. Appendix: Minimal Examples

For additional end‑to‑end example flows (broadcast + aggregation, reconnect), see `PATTERNS.md` §13.

### 13.1 MCP tool call request → response

Request (to robot):
```json
{
  "protocol": "mcp-x/v0",
  "id": "env-1",
  "ts": "2025-08-17T14:00:00Z",

  "from": "coordinator",
  "to": ["robot-alpha"],
  "kind": "mcp",
  "payload": { "jsonrpc": "2.0", "id": "42", "method": "tools/call", "params": { "name": "robot.move", "arguments": {"x":1, "y":2} } }
}
```

Response (from robot):
```json
{
  "protocol": "mcp-x/v0",
  "id": "env-2",
  "ts": "2025-08-17T14:00:00Z",

  "from": "robot-alpha",
  "to": ["coordinator"],
  "kind": "mcp",
  "correlation_id": "env-1",
  "payload": { "jsonrpc": "2.0", "id": "42", "result": { "status": "ok" } }
}
```

### 13.2 Presence join
```json
{
  "protocol": "mcp-x/v0",
  "id": "env-join-1",
  "ts": "2025-08-17T13:59:59Z",
  "from": "system:gateway",
  "kind": "presence",
  "payload": { "event": "join", "participant": {"id": "coordinator", "name": "Coordinator"} }
}
```

### 13.3 Progress notification
```json
{
  "protocol": "mcp-x/v0",
  "id": "env-progress-1",
  "ts": "2025-08-17T14:00:10Z",
  "from": "robot-alpha",
  "to": ["coordinator"],
  "kind": "mcp",
  "correlation_id": "env-1",
  "payload": {
    "jsonrpc": "2.0",
    "method": "notifications/progress",
    "params": {
      "progressToken": 42,
      "progress": 0.5,
      "total": 1.0
    }
  }
}
```

### 13.4 Cancellation notification
```json
{
  "protocol": "mcp-x/v0",
  "id": "env-cancel-1",
  "ts": "2025-08-17T14:00:15Z",
  "from": "coordinator",
  "to": ["robot-alpha"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "method": "notifications/cancelled",
    "params": {
      "requestId": 42,
      "reason": "User cancelled operation"
    }
  }
}
```

---

## 14. Future Directions

The following areas are intentionally not covered in MCPx v0 but represent potential areas for future specification versions:

### 14.1 Topic Management
- **Topic Creation**: Standardized APIs for creating new topics with configuration
- **Topic Discovery**: Mechanisms for finding and browsing available topics
- **Topic Metadata**: Schemas for topic descriptions, permissions, and settings
- **Topic Lifecycle**: Rules for topic archival, deletion, and migration
- **Topic Federation**: Cross-gateway topic bridging and routing

### 14.2 Enhanced Security
- **E2E Encryption**: End-to-end encryption for sensitive communications
- **Granular Permissions**: Fine-grained ACLs beyond topic-level admission
- **Identity Verification**: Cryptographic identity and signature verification

### 14.3 Advanced Features
- **Private Messaging**: Direct messages outside the public topic stream
- **Message Editing/Deletion**: Protocols for modifying historical messages
- **Presence Status**: Rich presence states beyond join/leave/heartbeat
- **File Transfer**: Standardized binary data and large file handling

### 14.4 Platform Integration Specifications
- **Platform Adapters**: Standardized patterns for bridging MCPx to existing chat platforms
- **UI Extensions**: Guidelines for native MCP tool rendering in chat UIs
- **Identity Mapping**: Protocols for mapping platform users to MCPx participants
- **Rate Limit Coordination**: Harmonizing MCPx and platform rate limits

These features may be addressed in future versions as the protocol matures and implementation experience provides guidance on requirements.
