# MCPx v0 Usage Patterns and Workflows (Draft)

Status: Draft  
Date: 2025-08-17  
Editors: MCPx Working Group (RJ Corwin)

---

## 1. Purpose

This document provides practical patterns for using the v0 SPEC in real systems. It shows how agents discover peers, establish MCP sessions, invoke tools (directed and broadcast), manage presence/history, and handle errors and reconnection.

---

## 2. Peer Discovery and Handshake

- On join, read the gateway welcome (`system` kind) and subsequent `presence` events to build the roster.
- Choose a handshake strategy:
  - Eager: handshake (`initialize` → `initialized`) with all MCP‑capable peers immediately.
  - Lazy: wait until the first interaction, then handshake with the target.
  - On‑demand: preselect a subset (e.g., by `kind`, name, or capability) and handshake only with them.
- Avoid handshake storms in large rooms by rate‑limiting and deduping parallel sessions.

Example initialize envelope (addressed):
```json
{
  "protocol": "mcp-x/v0",
  "id": "env-init-1",
  "ts": "2025-08-17T14:00:00Z",

  "from": "ui",
  "to": ["robot-alpha"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {"sampling": {}, "elicitation": {}, "roots": {}},
      "clientInfo": {"name": "UI", "version": "1.0.0"}
    }
  }
}
```

---

## 3. Directed Tool Call (1:1)

- Set `to` to the target participant. Others observe but ignore.
- Expect exactly one MCP response with matching `payload.id` and `correlation_id` set to your request envelope `id`.

```json
{
  "protocol": "mcp-x/v0",
  "id": "env-req-1",
  "ts": "2025-08-17T14:01:00Z",

  "from": "ui",
  "to": ["robot-alpha"],
  "kind": "mcp",
  "payload": {"jsonrpc": "2.0", "id": 42, "method": "tools/call", "params": {"name": "robot.move", "arguments": {"x":1,"y":2}}}
}
```

---

## 4. Broadcast Notifications

- Only notifications (no `payload.id`) may be broadcast by omitting `to` or leaving it empty.
- Requests MUST target exactly one participant to maintain MCP client/server semantics.
- For multi-participant queries, use a coordinator pattern (see §5) or send individual requests.

---

## 5. Coordinator/Mediator Pattern

- Introduce a coordinator agent that:
  - Handshakes with all peers and maintains a capability index (from `tools/list` and list_changed notifications).
  - Routes tool calls to the most appropriate peer(s) and aggregates replies.
  - Applies policies: rate limiting, retries, and backoff.

This reduces coupling between spontaneous participants and provides a single point for policy enforcement.

---

## 6. Presence, Roster, and History

- Presence: listen for `presence` join/leave/heartbeat to keep a live roster. Expose it via UI or a local MCP tool (e.g., `presence.get`).
- History: use `GET /v0/topics/{topic}/history` to fetch recent envelopes for context (size is deployment‑dependent). Merge with live stream by `ts` or `id`.

---

## 7. Reconnect and Resume

- On reconnect: fetch a small window of history, reconcile roster, and resubscribe.
- For outstanding MCP requests:
  - Track by `payload.id` and request envelope `id`.
  - If no responses arrive within timeout, send MCP cancellation and/or retry.

---

## 8. Capability Discovery and Caching

- After handshake, call `tools/list` and cache results per peer. Respect `notifications/tools/list_changed` to invalidate caches.
- Optionally broadcast a discovery notification on join with a summary of offered tool names to help UIs quickly populate menus.

---

## 9. Chat Implementation Patterns

### 9.1 Broadcast Chat Notifications (Recommended)

For room-wide chat, use broadcast MCP notifications:

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
      "format": "plain",
      "thread_id": "general"
    }
  }
}
```

**Payload schema for `notifications/chat/message`:**
- `text` (string, required): The chat message content
- `format` (string, optional): "plain" or "markdown", defaults to "plain" 
- `thread_id` (string, optional): Thread/channel identifier for organizing conversations
- `mentions` (array[string], optional): Participant IDs mentioned in the message
- `reply_to` (string, optional): Message ID this is replying to

### 9.2 Chat Tools as Syntactic Sugar

Participants MAY provide `chat.say` tools that emit broadcast notifications:

```json
{
  "protocol": "mcp-x/v0",
  "id": "env-tool-1", 
  "ts": "2025-08-17T14:05:00Z",
  "from": "ui",
  "to": ["coordinator"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": 42,
    "method": "tools/call",
    "params": {
      "name": "chat.say",
      "arguments": {"text": "Hello!", "format": "plain"}
    }
  }
}
```

The coordinator then emits the corresponding broadcast notification.

### 9.3 Coordinator Chat Example

A coordinator that accepts `chat.say` tool calls and emits broadcast notifications:

**Tool call to coordinator:**
```json
{
  "protocol": "mcp-x/v0",
  "id": "env-req-1", 
  "from": "ui",
  "to": ["coordinator"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0", "id": 42,
    "method": "tools/call",
    "params": {"name": "chat.say", "arguments": {"text": "Meeting starts in 5 min"}}
  }
}
```

**Coordinator's broadcast response:**
```json
{
  "protocol": "mcp-x/v0",
  "id": "env-broadcast-1",
  "from": "coordinator", 
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "method": "notifications/chat/message",
    "params": {"text": "Meeting starts in 5 min", "format": "plain"}
  }
}
```

**Tool response to caller:**
```json
{
  "protocol": "mcp-x/v0",
  "id": "env-resp-1",
  "from": "coordinator",
  "to": ["ui"], 
  "kind": "mcp",
  "correlation_id": "env-req-1",
  "payload": {"jsonrpc": "2.0", "id": 42, "result": {"status": "broadcasted"}}
}
```

### 9.4 UI Integration

- Display notifications from `notifications/chat/message` in chat interfaces
- Agents without chat support simply ignore these notifications
- Consider visual indicators for mentions and threading
- UIs MAY provide both notification listening and `chat.say` tool calling for flexibility

---

## 10. Error Handling and Retries

- Distinguish between:
  - MCP protocol errors (JSON‑RPC error in `payload`)
  - Gateway/system errors (`system` kind with details)
- Apply exponential backoff for transient failures; surface actionable errors to users.

---

## 11. Topic Planning

- Keep rooms small for bandwidth and clarity; shard by task, team, or capability.
- For privacy, use separate topics (v0 topics are not private by default). Higher‑layer E2E encryption is out of scope.

---

## 12. Versioning and Compatibility

- Prefer MCP `2025-06-18`. If a peer offers an older MCP version, limit features accordingly.
- Expose your supported envelope `protocol` (`mcp-x/v0`) and MCP version in presence metadata.

---

## 13. Coordinator Aggregation Example

The coordinator sends individual requests to multiple participants:

Request 1:
```json
{
  "protocol": "mcp-x/v0",
  "id": "env-req-1",
  "ts": "2025-08-17T14:03:00Z",
  "from": "coordinator",
  "to": ["search-agent-1"],
  "kind": "mcp",
  "payload": {"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": {"name": "search", "arguments": {"q": "map zone7"}}}
}
```

Request 2:
```json
{
  "protocol": "mcp-x/v0",
  "id": "env-req-2",
  "ts": "2025-08-17T14:03:00Z",
  "from": "coordinator",
  "to": ["search-agent-2"],
  "kind": "mcp",
  "payload": {"jsonrpc": "2.0", "id": 8, "method": "tools/call", "params": {"name": "search", "arguments": {"q": "map zone7"}}}
}
```

Coordinator policy:
- Track responses by `correlation_id` matching request envelope ids.
- Apply aggregation strategy (first-wins, best-of, consensus, etc.).
