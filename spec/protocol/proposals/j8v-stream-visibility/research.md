# Research: Stream Visibility on Join (j8v)

## Current State

### Gateway Implementation
- Gateway tracks active streams in `space.activeStreams` Map (gateway.ts:740, 752)
- Each stream entry contains:
  - `requestId`: The original stream/request envelope ID
  - `participantId`: Who requested the stream
  - `direction`: Upload/download direction
  - `created`: Timestamp
- Streams are created via `stream/request` → `stream/open` handshake
- Stream data flows via raw frames: `#streamID#data`

### Current Welcome Message Structure
From gateway.ts:939-958:
```json
{
  "protocol": "mew/v0.4",
  "kind": "system/welcome",
  "payload": {
    "you": {
      "id": "participant-id",
      "capabilities": [...]
    },
    "participants": [
      {
        "id": "other-participant",
        "capabilities": [...]
      }
    ]
  }
}
```

**Missing:** No information about active streams.

### Protocol Specification
MEW Protocol v0.4 SPEC.md Section 3.8.1 defines welcome message structure but does not include active streams.

Section 3.10 defines stream lifecycle:
- `stream/request` - Request stream creation
- `stream/open` - Gateway confirms with stream_id
- Stream data frames - Binary/chunked data without envelope
- `stream/close` - Terminate stream

## Problem Analysis

### The Visibility Gap
1. User A joins space, gets welcome (participants list, no streams)
2. User A requests stream: `stream/request`
3. Gateway broadcasts `stream/open` to all participants
4. User B joins space (mid-stream)
5. User B gets welcome with participants list, but **no stream info**
6. User B receives data frames `#stream-42#data` without context

### Impact
- Violates "Unified Context" goal (SPEC.md:26): "All participants share the same visible stream of interactions"
- New participants cannot make sense of incoming stream data
- No way to know:
  - Which streams are active
  - Who owns each stream
  - What direction (upload/download)
  - When stream started
- Creates asymmetry between early joiners (who saw `stream/open`) and late joiners

### Current Workarounds
None available. The information simply isn't provided.

## Constraints

### Protocol Compatibility
- Must remain backward compatible with v0.4
- Welcome message structure is extensible (can add fields)
- Clients that don't process `active_streams` will ignore it

### Implementation Constraints
- Gateway already tracks all necessary stream metadata
- No additional state tracking needed
- Simple addition to welcome message construction

### Security Considerations
- Stream visibility follows same model as other messages (all participants see everything)
- No new security concerns - participants already receive stream data frames
- Actually improves security by making stream ownership explicit

## Prior Art

### Standard Protocols
- IRC: JOIN responses include channel topic and user list (static snapshot)
- XMPP MUC: Presence broadcasts include full room state
- WebRTC: SDP exchange includes all media streams

### MEW Protocol Patterns
- `system/presence` broadcasts join/leave events with participant state
- `system/welcome` includes participant list with capabilities
- Pattern: Welcome messages provide full initial state snapshot

## Proposed Solution

Add `active_streams` array to `system/welcome` payload:

```json
{
  "protocol": "mew/v0.4",
  "kind": "system/welcome",
  "payload": {
    "you": { ... },
    "participants": [ ... ],
    "active_streams": [
      {
        "stream_id": "stream-42",
        "owner": "agent-1",
        "direction": "upload",
        "created": "2025-01-09T10:00:00Z"
      }
    ]
  }
}
```

### Why This Works
- Provides complete state snapshot on join (consistent with welcome message philosophy)
- Minimal change: just include existing tracked data
- Backward compatible: new field is optional
- Maintains protocol principle of transparency

## Alternatives Considered

### Alternative 1: Replay stream/open Messages
**Approach:** When participant joins, re-send all `stream/open` messages.

**Pros:**
- Reuses existing message format
- No protocol changes

**Cons:**
- Misleading: `stream/open` correlates to `stream/request` - replay creates fake correlation
- Violates correlation_id semantics
- Confusing for audit logs (duplicate stream/open with different timestamps)
- More complex implementation

**Verdict:** Rejected - breaks correlation semantics

### Alternative 2: New stream/list Message
**Approach:** Define new `stream/list` message type that participants can request.

**Pros:**
- Explicit request/response pattern
- Could be used for ongoing monitoring

**Cons:**
- Requires additional protocol message type
- All participants need stream list on join anyway (not really optional)
- Extra round-trip on connection
- More complex than including in welcome

**Verdict:** Rejected - over-engineering

### Alternative 3: Do Nothing
**Approach:** Document as known limitation.

**Cons:**
- Violates core "Unified Context" principle
- Poor developer experience
- No workaround available

**Verdict:** Rejected - unacceptable UX

## Decision

**Selected Approach:** Include `active_streams` in welcome message payload.

**Rationale:**
- Simplest solution
- Consistent with existing welcome message pattern
- Backward compatible
- Minimal implementation effort
- Directly addresses the visibility gap
