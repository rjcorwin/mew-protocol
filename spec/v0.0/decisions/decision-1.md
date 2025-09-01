# Decision 1: How to Send Chat to All Participants without Broadcasting Requests

Status: Proposed  
Date: 2025-08-17  
Owners: MCPx WG

## Context

- MCPx v1 intentionally disallows broadcasting JSON-RPC requests because it breaks MCP’s client/server model and complicates response handling.
- We still want a simple way to send "chat messages" to everyone in a room.
- MCP tools remain the focus; the envelope supports notifications (no `payload.id`) that can be broadcast.

## Decision (proposed)

Use broadcast MCP notifications for room-wide chat. Define a canonical notification method (e.g., `notifications/chat/message`) that any participant MAY emit with an empty `to` array, and that all participants SHOULD display/log if they support chat UX.

- This preserves MCP purity (no broadcast requests), keeps the envelope small, and avoids reintroducing a `chat` envelope kind.
- Tools like `chat.say` MAY exist as syntactic sugar that emit the notification under the hood.

## Options Considered

### Option A — Broadcast MCP Notification (recommended)
- Description: Send a JSON-RPC notification (`payload.method = "notifications/chat/message"`) with no `payload.id` and no `to` (broadcast). Content carries `{ text, format? }`.
- Pros:
  - Aligns with v1 rule: only notifications can be broadcast
  - Minimal surface area; no new envelope kinds
  - Easy to implement and interoperable (any client can listen)
- Cons:
  - Not a tool call; no tool schema validation pathway
  - No per-recipient delivery guarantees (consistent with room visibility)

### Option B — `chat.say` Tool to a Coordinator (fan-out server-side)
- Description: Caller invokes `chat.say` on a coordinator agent; coordinator emits a broadcast notification to the room.
- Pros:
  - Retains tool semantics for the caller (familiar MCP flow)
  - Centralizes moderation, formatting, and rate limiting
- Cons:
  - Requires a coordinator role and extra hop
  - Coordinator becomes a dependency and potential bottleneck

### Option C — Client-Side Fan-out of `chat.say` Tool Calls (unicast many)
- Description: Caller lists participants and sends a 1:1 `tools/call` to each with `chat.say`.
- Pros:
  - Pure MCP tool semantics; no broadcast
  - Per-recipient responses/acks possible
- Cons:
  - N network sends; O(N) overhead and duplication
  - Message ordering inconsistencies across recipients

### Option D — Reintroduce `chat` Envelope Kind (non-MCP)
- Description: Keep a simple `chat` envelope kind for human-readable messages.
- Pros:
  - Very simple to consume; no MCP processing
  - Clear separation from tool traffic
- Cons:
  - Expands envelope surface area again
  - Diverges from “MCP-first” principle; duplicate representation of chat (tool vs kind)

### Option E — Gateway Broadcast API (system-side fan-out)
- Description: Gateway accepts a single authenticated submit (REST/WS control), then emits a broadcast notification to the room.
- Pros:
  - Efficient; avoids client-side N-way sends
  - Consistent moderation and rate limiting
- Cons:
  - Out-of-band relative to MCP traffic (separate API surface)
  - Adds gateway complexity and policy surface

### Option F — Topic-Per-Channel for Chat
- Description: Use a separate room-level chat topic; participants subscribe; gateway bridges from MCP tool calls.
- Pros:
  - Isolation of chat traffic; scalable retention policy
  - Can be bridged to existing chat systems
- Cons:
  - Multiple topics to manage; more moving parts
  - Still requires a bridge layer for MCP-first apps

### Option G — Event-Sourced Chat Stream
- Description: Treat chat as an immutable event log within the topic. Participants append chat events using a standardized notification method and maintain local chat state by replaying events.
- Pros:
  - Naturally handles message ordering; provides replay capability
  - Fits well with distributed systems patterns
- Cons:
  - Requires more complex state management on client side
  - Potentially higher memory usage

### Option H — Chat as MCP Resource  
- Description: Model the chat room as an MCP resource that participants can subscribe to and update. Chat messages become resource update notifications.
- Pros:
  - Leverages existing MCP resource patterns
  - Provides structured subscription model
- Cons:
  - Resource model might be overkill for simple chat
  - Adds complexity to resource management

### Option I — Hybrid Notification + Tool Pattern
- Description: Support both broadcast notifications (Option A) AND `chat.say` tools. Tools validate schema and provide responses, while notifications handle the actual broadcast.
- Pros:
  - Best of both worlds—tool validation for senders, efficient broadcast for recipients
- Cons:
  - Dual pathways could cause confusion
  - Slight increase in spec complexity

### Option J — Message Relay Pattern
- Description: Participants send directed `chat.relay` tool calls to designated relay participants who then emit broadcast notifications.
- Pros:
  - Maintains tool semantics; allows for distributed relay architecture
- Cons:
  - Requires relay participant designation
  - Adds network hops

### Option K — Topic Metadata Channel
- Description: Use a separate metadata/control channel within the same WebSocket connection for chat, parallel to the main MCP envelope stream.
- Pros:
  - Complete separation of concerns; optimized for each use case
- Cons:
  - Violates the "single envelope" design principle
  - Increases connection complexity

## Implications
- Choosing A (recommended) keeps v1 simple: broadcast notifications for chat, no broadcast requests.
- B can layer moderation and formatting policies without changing the core spec.
- C is simplest to implement without broadcast but is inefficient and can cause fragmentation.
- D increases spec surface area; likely not aligned with v1 simplification goals.
- E/F are operational patterns that can be documented in PATTERNS.md as alternatives.
- G-K represent more complex architectural patterns that may suit specific use cases but add implementation overhead.

## Follow-ups
- Specify a minimal payload schema for `notifications/chat/message` in PATTERNS.md (text, format, optional meta like mentions/thread id).
- Add rate limit guidance for chat notifications in Security.
- Provide a coordinator example that accepts `chat.say` and emits the corresponding notification.
