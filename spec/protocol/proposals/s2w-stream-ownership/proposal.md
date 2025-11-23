# Proposal: Stream Ownership Transfer (s2w)

**Code:** s2w
**Status:** Draft
**Area:** Protocol
**Created:** 2025-11-23

## Summary

Enable streams to have multiple authorized writers and support ownership transfer. Currently, only the participant who requested a stream can publish frames to it. This proposal adds mechanisms for the stream owner to delegate write access to other participants and transfer ownership entirely.

## Motivation

MEW Protocol streams currently enforce strict single-writer semantics: only the participant who sent the `stream/request` can publish frames to that stream (src/cli/commands/gateway.ts:1009). This limitation prevents several important use cases:

### Use Case 1: Control Delegation in Games

In real-time games using MEW Protocol (like Seacat), characters need to transfer control between participants:

1. Character server requests a position stream for `character-player1`
2. Initially, no one controls the character (AI idle behavior)
3. Player joins and wants to control their character
4. Character server should delegate stream write access to the player
5. Later, AI agent might take over when player disconnects
6. Late joiners need to know who currently controls each character

**Current limitation:** The character server owns the stream and must relay all position updates. Players can't write directly to the character's position stream.

**Desired behavior:** Character server grants write access to the controlling participant, who then publishes position frames directly.

### Use Case 2: Collaborative Data Streams

Multiple agents collaborating on a shared output stream:

1. Orchestrator agent requests a results stream
2. Worker agents need to publish their results to the shared stream
3. Orchestrator grants write access to all workers
4. Workers publish results directly (no relay)

### Use Case 3: Ownership Transfer on Disconnect

When a stream owner disconnects:

1. Owner participant leaves the space
2. Another participant should be able to take over the stream
3. Stream should not become permanently read-only

## Goals

1. Enable stream owner to grant write access to other participants
2. Support ownership transfer (complete control handoff)
3. Maintain backward compatibility (existing streams work unchanged)
4. Preserve security (only authorized participants can write)
5. Provide late joiner visibility (who can write to each stream)

## Non-Goals

- Stream subscription/filtering (who receives frames)
- Stream data replay or history
- Multi-stream merge/split operations
- Read access control (streams remain broadcast by default)
- Automatic ownership transfer on disconnect (policy decision, not protocol)

## Proposal

### 1. New Message Kind: `stream/grant-write`

Owner grants write access to another participant:

```json
{
  "protocol": "mew/v0.4",
  "id": "grant-write-1",
  "from": "character-server",
  "to": ["gateway"],
  "kind": "stream/grant-write",
  "payload": {
    "stream_id": "stream-42",
    "participant_id": "player1",
    "reason": "Player claimed character control"
  }
}
```

**Fields:**
- `stream_id` (required): The stream to grant write access to
- `participant_id` (required): The participant receiving write access
- `reason` (optional): Human-readable explanation for audit trail

**Gateway behavior:**
1. Validate sender is current owner or authorized writer
2. Add participant to stream's authorized writers set
3. Broadcast acknowledgement (optional, for transparency)
4. Update `active_streams` metadata for late joiners

**Error conditions:**
- Stream does not exist → `system/error` with `stream_not_found`
- Sender not authorized → `system/error` with `unauthorized`
- Participant not in space → `system/error` with `participant_not_found`

### 2. New Message Kind: `stream/revoke-write`

Owner revokes write access from a participant:

```json
{
  "protocol": "mew/v0.4",
  "id": "revoke-write-1",
  "from": "character-server",
  "to": ["gateway"],
  "kind": "stream/revoke-write",
  "payload": {
    "stream_id": "stream-42",
    "participant_id": "player1",
    "reason": "Player disconnected"
  }
}
```

**Gateway behavior:**
1. Validate sender is current owner
2. Remove participant from authorized writers set
3. Subsequent frames from revoked participant are dropped
4. Broadcast acknowledgement (optional)

**Error conditions:**
- Stream does not exist → `system/error`
- Sender not authorized → `system/error`
- Participant not currently authorized → silent success (idempotent)

### 3. New Message Kind: `stream/transfer-ownership`

Transfer complete ownership of a stream:

```json
{
  "protocol": "mew/v0.4",
  "id": "transfer-1",
  "from": "character-server",
  "to": ["gateway"],
  "kind": "stream/transfer-ownership",
  "payload": {
    "stream_id": "stream-42",
    "new_owner": "player1",
    "reason": "Permanent control delegation"
  }
}
```

**Gateway behavior:**
1. Validate sender is current owner
2. Update stream owner to new participant
3. New owner inherits all permissions (grant/revoke/transfer/close)
4. Previous owner loses ownership (but may retain write access if granted)
5. Broadcast transfer event for transparency
6. Update `active_streams.owner` for late joiners

**Error conditions:**
- Stream does not exist → `system/error`
- Sender not current owner → `system/error`
- New owner not in space → `system/error`

### 4. Extended `system/welcome` Payload

Add `authorized_writers` to active streams metadata:

```json
{
  "kind": "system/welcome",
  "payload": {
    "you": { "id": "player2", ... },
    "participants": [...],
    "active_streams": [
      {
        "stream_id": "stream-42",
        "owner": "character-server",
        "direction": "upload",
        "created": "2025-11-23T12:00:00Z",
        "content_type": "application/json",
        "format": "seacat/character-position-v1",
        "metadata": {
          "character_id": "character-player1"
        },
        "authorized_writers": ["character-server", "player1"]
      }
    ]
  }
}
```

**New field:**
- `authorized_writers` (optional): Array of participant IDs authorized to write to this stream
  - If omitted, defaults to `[owner]` (backward compatible)
  - Always includes owner (owner cannot revoke self)
  - Late joiners see current authorization state

### 5. Updated Stream Validation

Gateway validation logic (src/cli/commands/gateway.ts:1007-1018):

**Current:**
```typescript
const streamInfo = space.activeStreams.get(streamId);
if (streamInfo && streamInfo.participantId === participantId) {
  // Forward to all participants
}
```

**Proposed:**
```typescript
const streamInfo = space.activeStreams.get(streamId);
const authorizedWriters = streamInfo?.authorizedWriters || [streamInfo?.participantId];

if (streamInfo && authorizedWriters.includes(participantId)) {
  // Forward to all participants
} else {
  console.log(`[GATEWAY WARNING] Unauthorized stream write: ${streamId} from ${participantId}`);
  // Optionally send system/error to sender
}
```

## Benefits

1. **Direct Control**: Participants can write to streams without relay overhead
2. **Flexible Delegation**: Owner controls who can write, supports N writers
3. **Ownership Transfer**: Enables handoff scenarios (owner disconnect, role change)
4. **Late Joiner Visibility**: `authorized_writers` shows current state
5. **Backward Compatible**: Existing streams default to owner-only writes
6. **Audit Trail**: All grants/revokes/transfers are protocol messages (logged)

## Security Considerations

1. **Authorization Validation**: Gateway enforces that only owner can grant/revoke/transfer
2. **Writer Validation**: Gateway checks authorized writers on every frame
3. **Owner Privileges**: Owner cannot be revoked (always authorized)
4. **Circular Transfers**: New owner can immediately transfer back (no prevention needed)
5. **Broadcast Transparency**: All authorization changes visible to all participants

## Backward Compatibility

**Existing behavior preserved:**
- Streams without `authorized_writers` default to owner-only writes
- `stream/request`, `stream/open`, `stream/close` unchanged
- Stream data frame format unchanged (`#streamID#data`)
- Late joiners receive same `active_streams` structure (new field is additive)

**Migration path:**
- No changes required for existing implementations
- New features opt-in (send grant/revoke/transfer messages)
- Implementations can ignore new message kinds if not needed

## Alternative Approaches Considered

### Alternative 1: Metadata Updates Only

Use `stream/metadata_update` to store authorized writers in metadata:

```json
{
  "kind": "stream/metadata_update",
  "payload": {
    "stream_id": "stream-42",
    "metadata": {
      "authorized_writers": ["player1", "player2"]
    }
  }
}
```

**Pros:**
- Single mechanism for all metadata changes
- No new message kinds

**Cons:**
- Metadata is application-specific, not protocol enforcement
- Gateway would need to parse metadata for security decisions
- Violates separation: metadata is advisory, authorization is security-critical
- Less explicit than dedicated authorization messages

**Decision:** Rejected. Authorization is security-critical and should have dedicated protocol messages.

### Alternative 2: Close and Reopen Stream

To change writers, close the stream and open a new one with different owner:

**Pros:**
- Uses existing messages only
- No protocol changes needed

**Cons:**
- Stream ID changes (breaks client tracking)
- Data interruption during close/reopen
- Loses continuity for late joiners
- Awkward for temporary delegation (player control session)

**Decision:** Rejected. Too disruptive for common use cases.

### Alternative 3: Capability-Based Stream Access

Extend MEW Protocol capabilities to include stream-specific grants:

```json
{
  "kind": "capability/grant",
  "payload": {
    "recipient": "player1",
    "capabilities": [
      {
        "kind": "stream/write",
        "payload": {
          "stream_id": "stream-42"
        }
      }
    ]
  }
}
```

**Pros:**
- Reuses existing capability system
- Consistent with MEW Protocol security model

**Cons:**
- Stream capabilities don't fit existing patterns (message kind + payload)
- Capabilities are participant-wide, streams are resource-specific
- Would require new capability matching logic for stream IDs
- Late joiners need both capabilities and active streams (duplication)

**Decision:** Rejected. Streams are resources, not message kinds. Authorization should be stream-specific.

## Implementation Notes

### Gateway State Changes

**Current stream info:**
```typescript
{
  requestId: string,
  participantId: string, // owner
  created: string,
  // ... spread all payload fields
}
```

**Proposed stream info:**
```typescript
{
  requestId: string,
  participantId: string, // owner
  authorizedWriters: string[], // NEW: authorized writers (includes owner)
  created: string,
  // ... spread all payload fields
}
```

### Initialization

When stream is opened:
```typescript
space.activeStreams.set(streamId, {
  requestId: envelope.id,
  participantId: participantId,
  authorizedWriters: [participantId], // Initially just owner
  created: new Date().toISOString(),
  ...envelope.payload
});
```

### Grant Write Access

```typescript
if (envelope.kind === 'stream/grant-write') {
  const { stream_id, participant_id } = envelope.payload;
  const stream = space.activeStreams.get(stream_id);

  if (!stream) {
    sendError(ws, 'stream_not_found', envelope.id);
    return;
  }

  if (stream.participantId !== participantId) {
    sendError(ws, 'unauthorized', envelope.id);
    return;
  }

  if (!stream.authorizedWriters.includes(participant_id)) {
    stream.authorizedWriters.push(participant_id);
  }

  // Optional: broadcast acknowledgement
  broadcastToSpace(space, {
    protocol: 'mew/v0.4',
    id: generateId(),
    from: 'system:gateway',
    kind: 'stream/write-granted',
    correlation_id: [envelope.id],
    payload: {
      stream_id,
      participant_id,
      authorized_writers: stream.authorizedWriters
    }
  });
}
```

### Transfer Ownership

```typescript
if (envelope.kind === 'stream/transfer-ownership') {
  const { stream_id, new_owner } = envelope.payload;
  const stream = space.activeStreams.get(stream_id);

  if (!stream) {
    sendError(ws, 'stream_not_found', envelope.id);
    return;
  }

  if (stream.participantId !== participantId) {
    sendError(ws, 'unauthorized', envelope.id);
    return;
  }

  // Transfer ownership
  const previousOwner = stream.participantId;
  stream.participantId = new_owner;

  // Ensure new owner is in authorized writers
  if (!stream.authorizedWriters.includes(new_owner)) {
    stream.authorizedWriters.push(new_owner);
  }

  // Broadcast transfer
  broadcastToSpace(space, {
    protocol: 'mew/v0.4',
    id: generateId(),
    from: 'system:gateway',
    kind: 'stream/ownership-transferred',
    correlation_id: [envelope.id],
    payload: {
      stream_id,
      previous_owner: previousOwner,
      new_owner,
      authorized_writers: stream.authorizedWriters
    }
  });
}
```

## Testing Strategy

### Unit Tests

1. Grant write access to participant → verify authorized writers array
2. Revoke write access → verify removal from array
3. Transfer ownership → verify owner change and authorized writers update
4. Non-owner attempts grant → verify error response
5. Grant to non-existent participant → verify error response

### Integration Tests

1. Owner publishes frame → accepted
2. Granted writer publishes frame → accepted
3. Revoked writer publishes frame → rejected
4. New owner publishes frame → accepted
5. Previous owner (after transfer) publishes frame → requires grant
6. Late joiner sees authorized_writers in welcome message

### E2E Test Scenario

**Scenario: Character Control Delegation**

1. Character server connects and requests position stream
2. Player1 joins (late joiner sees stream with owner=character-server)
3. Player1 claims control via MCP tool
4. Character server grants write access to player1
5. Player1 publishes position frames → accepted
6. Player2 joins (late joiner sees authorized_writers=[character-server, player1])
7. Player2 attempts to publish → rejected
8. Player1 disconnects
9. Character server revokes player1's write access
10. AI agent claims control
11. Character server transfers ownership to AI agent
12. AI agent publishes position frames → accepted

## Open Questions

1. **Should revoked participants receive notification?**
   - Option A: Yes, send `stream/write-revoked` to revoked participant
   - Option B: No, they discover on next write attempt
   - **Recommendation:** Option A for better UX

2. **Should owner auto-revoke on disconnect?**
   - Option A: Gateway auto-revokes when participant leaves
   - Option B: Owner must explicitly revoke (manual management)
   - **Recommendation:** Option A for safety (prevents zombie writers)

3. **Should there be a maximum number of writers?**
   - Option A: Unlimited writers (array grows unbounded)
   - Option B: Limit to N writers (e.g., 10)
   - **Recommendation:** Option A initially, add limits if needed

4. **Should transfers be confirmable?**
   - Option A: New owner must accept transfer
   - Option B: Transfer is immediate (current proposal)
   - **Recommendation:** Option B for simplicity

## Next Steps

1. Create `research.md` with implementation details
2. Create `decision-s2w-stream-ownership.md` documenting decision
3. Update CHANGELOG.md with proposal entry
4. Implement in gateway (src/cli/commands/gateway.ts)
5. Add TypeScript types (src/types/protocol.ts)
6. Create e2e test scenario
7. Update SPEC.md with new message kinds
8. Submit PR with proposal + implementation
