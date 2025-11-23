# Research: Stream Ownership Transfer

## Current Implementation Analysis

### Stream Creation (src/cli/commands/gateway.ts:378-430)

When a participant sends `stream/request`, the gateway:

```typescript
// Handle stream/request - gateway must respond with stream/open
if (envelope.kind === 'stream/request') {
  // Generate unique stream ID
  space.streamCounter++;
  const streamId = `stream-${space.streamCounter}`;

  // Track the stream - preserve ALL metadata from request payload [j8v]
  space.activeStreams.set(streamId, {
    requestId: envelope.id,
    participantId: participantId, // <-- Owner stored here
    created: new Date().toISOString(),
    ...envelope.payload // Spread all fields from request
  });

  // Send stream/open response
  const streamOpenEnvelope = {
    protocol: 'mew/v0.4',
    id: generateId(),
    ts: new Date().toISOString(),
    from: 'system:gateway',
    to: [participantId],
    kind: 'stream/open',
    correlation_id: [envelope.id],
    payload: {
      stream_id: streamId,
      encoding: 'utf-8'
    }
  };

  ws.send(JSON.stringify(streamOpenEnvelope));
}
```

**Key insights:**
1. Stream info stored in `space.activeStreams` Map
2. `participantId` field identifies the owner
3. All payload fields from request are preserved (spread operator)
4. Stream ID generated sequentially per space

### Stream Frame Validation (src/cli/commands/gateway.ts:998-1021)

When a participant publishes a stream frame:

```typescript
// Check if this is a stream data frame (format: #streamID#data)
if (dataStr.startsWith('#') && dataStr.indexOf('#', 1) > 0) {
  const secondHash = dataStr.indexOf('#', 1);
  const streamId = dataStr.substring(1, secondHash);

  // Forward stream data to all participants in the space
  if (spaceId && spaces.has(spaceId)) {
    const space = spaces.get(spaceId);

    // Verify stream exists and belongs to this participant
    const streamInfo = space.activeStreams.get(streamId);
    if (streamInfo && streamInfo.participantId === participantId) {
      // Forward to all participants
      for (const [pid, pws] of space.participants.entries()) {
        if (pws.readyState === WebSocket.OPEN) {
          pws.send(data); // Send raw data frame
        }
      }
    } else {
      console.log(`[GATEWAY WARNING] Invalid stream ID ${streamId} from ${participantId}`);
    }
  }
  return; // Don't process as JSON message
}
```

**Key insights:**
1. Validation is simple: `streamInfo.participantId === participantId`
2. Only owner can publish frames
3. Unauthorized frames are silently dropped (logged but not forwarded)
4. No error sent to unauthorized publisher

### Welcome Message with Active Streams (src/cli/commands/gateway.ts:717-797)

When a participant joins:

```typescript
const activeStreamsList = Array.from(space.activeStreams.entries()).map(([streamId, streamInfo]) => {
  return {
    stream_id: streamId,
    owner: streamInfo.participantId,
    direction: streamInfo.direction,
    created: streamInfo.created,
    // Spread ALL metadata fields from the original stream/request [j8v]
    ...(() => {
      const { requestId, participantId, created, direction, ...metadata } = streamInfo;
      return metadata;
    })()
  };
});

const welcomeEnvelope = {
  protocol: 'mew/v0.4',
  id: generateId(),
  ts: new Date().toISOString(),
  from: 'system:gateway',
  to: [participantId],
  kind: 'system/welcome',
  payload: {
    you: {
      id: participantId,
      capabilities: yourCapabilities
    },
    participants: participantsInfo,
    active_streams: activeStreamsList // <-- Late joiners see this
  }
};
```

**Key insights:**
1. All streams included in welcome message
2. Metadata from request is preserved and sent to late joiners
3. `owner` field shows who created the stream
4. No indication of additional writers (current limitation)

## Implementation Requirements

### 1. Gateway State Extension

**Current structure:**
```typescript
interface StreamInfo {
  requestId: string;
  participantId: string; // owner
  created: string;
  direction: 'upload' | 'download';
  // ... spread payload fields
}
```

**Proposed structure:**
```typescript
interface StreamInfo {
  requestId: string;
  participantId: string; // owner
  authorizedWriters: string[]; // NEW: list of authorized writers
  created: string;
  direction: 'upload' | 'download';
  // ... spread payload fields
}
```

### 2. Message Handlers

Need to add handlers for three new message kinds:

1. `stream/grant-write` - Add writer to authorized list
2. `stream/revoke-write` - Remove writer from authorized list
3. `stream/transfer-ownership` - Change owner

**Location:** src/cli/commands/gateway.ts (around line 378, near `stream/request` handler)

### 3. Frame Validation Update

**Current validation:**
```typescript
if (streamInfo && streamInfo.participantId === participantId) {
  // Forward
}
```

**Proposed validation:**
```typescript
const authorizedWriters = streamInfo?.authorizedWriters || [streamInfo?.participantId];

if (streamInfo && authorizedWriters.includes(participantId)) {
  // Forward
} else {
  console.log(`[GATEWAY WARNING] Unauthorized stream write: ${streamId} from ${participantId}`);

  // Optionally send error to sender
  ws.send(JSON.stringify({
    protocol: 'mew/v0.4',
    id: generateId(),
    from: 'system:gateway',
    to: [participantId],
    kind: 'system/error',
    correlation_id: [/* would need message ID from frame */],
    payload: {
      error: 'unauthorized_stream_write',
      stream_id: streamId,
      message: `You are not authorized to write to stream ${streamId}`
    }
  }));
}
```

**Challenge:** Stream frames don't have envelope IDs (they're raw `#streamID#data`), so correlation_id would be missing. Consider adding optional message ID to frame format.

### 4. Welcome Message Extension

**Current active_streams entry:**
```typescript
{
  stream_id: streamId,
  owner: streamInfo.participantId,
  direction: streamInfo.direction,
  created: streamInfo.created,
  ...metadata
}
```

**Proposed active_streams entry:**
```typescript
{
  stream_id: streamId,
  owner: streamInfo.participantId,
  authorized_writers: streamInfo.authorizedWriters, // NEW
  direction: streamInfo.direction,
  created: streamInfo.created,
  ...metadata
}
```

## TypeScript Type Updates

### New Protocol Types (src/types/protocol.ts)

```typescript
// Stream authorization messages
export interface StreamGrantWritePayload {
  stream_id: string;
  participant_id: string;
  reason?: string;
}

export interface StreamRevokeWritePayload {
  stream_id: string;
  participant_id: string;
  reason?: string;
}

export interface StreamTransferOwnershipPayload {
  stream_id: string;
  new_owner: string;
  reason?: string;
}

// Optional acknowledgement messages
export interface StreamWriteGrantedPayload {
  stream_id: string;
  participant_id: string;
  authorized_writers: string[];
}

export interface StreamOwnershipTransferredPayload {
  stream_id: string;
  previous_owner: string;
  new_owner: string;
  authorized_writers: string[];
}

// Update StreamMetadata in SystemWelcomePayload
export interface StreamMetadata {
  stream_id: string;
  owner: string;
  authorized_writers?: string[]; // NEW: optional for backward compatibility
  direction: 'upload' | 'download';
  created: string;
  expected_size_bytes?: number;
  description?: string;
  content_type?: string;
  format?: string;
  metadata?: Record<string, any>;
  [key: string]: any; // Allow additional custom fields
}

// Update Envelope kind union type
export type EnvelopeKind =
  | 'mcp/request'
  | 'mcp/response'
  | 'mcp/proposal'
  | 'mcp/withdraw'
  | 'mcp/reject'
  | 'stream/request'
  | 'stream/open'
  | 'stream/close'
  | 'stream/grant-write'     // NEW
  | 'stream/revoke-write'    // NEW
  | 'stream/transfer-ownership' // NEW
  | 'stream/write-granted'   // NEW (optional acknowledgement)
  | 'stream/ownership-transferred' // NEW (optional acknowledgement)
  | 'chat'
  | 'chat/acknowledge'
  | 'chat/cancel'
  | 'system/welcome'
  | 'system/presence'
  | 'system/error'
  // ... other kinds
```

## Security Analysis

### Threat Model

1. **Unauthorized Frame Publishing**
   - Attacker tries to publish frames to someone else's stream
   - **Mitigation:** Gateway checks authorized_writers array
   - **Impact:** Frame dropped, logged, sender may receive error

2. **Authorization Bypass**
   - Attacker sends grant-write for stream they don't own
   - **Mitigation:** Gateway verifies sender === stream.participantId
   - **Impact:** Request rejected with system/error

3. **Ownership Hijacking**
   - Attacker sends transfer-ownership for stream they don't own
   - **Mitigation:** Gateway verifies sender === stream.participantId
   - **Impact:** Request rejected with system/error

4. **Denial of Service**
   - Attacker grants write access to many participants
   - **Mitigation:** Consider limiting authorized_writers array size (future)
   - **Impact:** Memory usage per stream (currently unbounded)

5. **Late Joiner Confusion**
   - Late joiner receives stale authorized_writers (writer disconnected)
   - **Mitigation:** Auto-revoke on disconnect (see Open Questions)
   - **Impact:** Writer publishes but frames are dropped

### Security Properties

**Maintained:**
1. Only gateway can send `system/*` messages
2. Participants cannot spoof `from` field
3. Stream ownership explicitly tracked
4. All authorization changes are logged (protocol messages)

**New:**
1. Only stream owner can grant/revoke/transfer
2. Authorized writers are verified on every frame
3. Late joiners see current authorization state
4. Owner cannot lose write access (always in authorized_writers)

## Edge Cases

### 1. Owner Grants Self

```typescript
// Should be allowed (no-op)
{
  "kind": "stream/grant-write",
  "payload": {
    "stream_id": "stream-42",
    "participant_id": "character-server" // same as owner
  }
}
```

**Behavior:** Owner is already implicitly authorized. Grant succeeds (idempotent).

### 2. Owner Revokes Self

```typescript
// Should be rejected
{
  "kind": "stream/revoke-write",
  "payload": {
    "stream_id": "stream-42",
    "participant_id": "character-server" // same as owner
  }
}
```

**Behavior:** Reject with error. Owner cannot revoke own write access.

### 3. Grant to Disconnected Participant

```typescript
{
  "kind": "stream/grant-write",
  "payload": {
    "stream_id": "stream-42",
    "participant_id": "player-offline" // not in space
  }
}
```

**Behavior:** Error response. Participant must be connected to receive authorization.

**Alternative:** Allow grant, participant receives authorization when they reconnect. More complex but supports "pre-authorization".

### 4. Transfer to Disconnected Participant

Same as above. Should probably reject.

### 5. Writer Publishes After Revoke

1. Owner grants write access to player1
2. Player1 starts publishing frames
3. Owner revokes player1's write access
4. Player1's next frame arrives at gateway

**Behavior:** Frame is dropped (player1 no longer in authorized_writers).

**Question:** Should player1 receive notification of revoke?
- **Option A:** Yes, send `stream/write-revoked` message
- **Option B:** No, player1 discovers on next failed frame
- **Recommendation:** Option A for better UX

### 6. Ownership Transfer Loop

1. Owner transfers to participant A
2. Participant A immediately transfers back to original owner

**Behavior:** Allowed. No restrictions on transfer chains.

### 7. Multiple Simultaneous Grants

Owner sends multiple grant-write messages in rapid succession:

```typescript
// Message 1
{ "kind": "stream/grant-write", "payload": { "participant_id": "player1" } }

// Message 2 (arrives before Message 1 processed)
{ "kind": "stream/grant-write", "payload": { "participant_id": "player2" } }
```

**Behavior:** Both processed independently. authorized_writers becomes `[owner, player1, player2]`.

**Edge case:** Order matters if processing is async. Should use synchronous handling or locking.

### 8. Stream Close with Active Writers

1. Owner grants write access to player1
2. Owner closes stream with `stream/close`

**Behavior:** Stream removed from active_streams. Subsequent frames from anyone (including player1) are dropped.

**Question:** Should authorized writers be notified of close?
- Currently, stream/close is only sent to owner
- Could broadcast to all authorized_writers

## Performance Considerations

### Memory Impact

**Per stream overhead:**
```typescript
{
  requestId: string,          // ~40 bytes (UUID)
  participantId: string,      // ~20 bytes (participant ID)
  authorizedWriters: string[], // NEW: 20 bytes × N writers
  created: string,             // ~25 bytes (ISO timestamp)
  direction: string,           // ~8 bytes
  ...metadata                  // Variable
}
```

**Impact:** Each writer adds ~20 bytes to stream info. For 10 writers, ~200 bytes overhead.

**Concern:** If authorization is frequently granted/revoked, array grows. Should revoke actually remove from array (current proposal) or just mark as revoked (alternative).

**Recommendation:** Remove from array (cleaner, saves memory).

### CPU Impact

**Per frame validation:**
```typescript
const authorizedWriters = streamInfo?.authorizedWriters || [streamInfo?.participantId];

if (streamInfo && authorizedWriters.includes(participantId)) {
  // Forward
}
```

**Impact:** O(N) lookup where N = number of authorized writers.

**Optimization:** If N is typically small (<10), array lookup is fine. For larger N, could use Set.

**Alternative:**
```typescript
interface StreamInfo {
  authorizedWritersSet: Set<string>; // Use Set instead of Array
}

// Validation
if (streamInfo && streamInfo.authorizedWritersSet.has(participantId)) {
  // Forward
}
```

**Trade-off:** Set is faster for lookup (O(1) vs O(N)), but harder to serialize for welcome message (need to convert to array).

**Recommendation:** Use array initially, optimize to Set if benchmarks show performance issue.

## Testing Plan

### Unit Tests

**File:** `src/cli/commands/__tests__/gateway.stream-ownership.test.ts`

Test cases:
1. `grant-write` from owner → adds to authorized_writers
2. `grant-write` from non-owner → returns error
3. `grant-write` to non-existent participant → returns error
4. `grant-write` duplicate (already authorized) → idempotent success
5. `revoke-write` from owner → removes from authorized_writers
6. `revoke-write` of owner (self) → returns error
7. `revoke-write` of non-authorized participant → idempotent success
8. `transfer-ownership` from owner → changes owner
9. `transfer-ownership` from non-owner → returns error
10. `transfer-ownership` to non-existent participant → returns error

### Integration Tests

**File:** `e2e/scenario-16-stream-ownership/`

Scenario structure:
```
e2e/scenario-16-stream-ownership/
├── template/
│   ├── space.yaml           # Define participants
│   ├── agents/
│   │   ├── stream-owner.cjs  # Creates stream, grants access
│   │   └── stream-writer.cjs # Receives grant, publishes frames
│   └── clients/
│       └── verifier.cjs      # Late joiner, verifies authorized_writers
├── setup.sh                  # Start space
├── test.sh                   # Run test sequence
├── check.sh                  # Verify results
└── teardown.sh               # Cleanup
```

**Test sequence:**
1. stream-owner connects, requests stream
2. Verify stream-owner can publish frames
3. stream-writer connects (late joiner)
4. Verify stream-writer sees owner in authorized_writers
5. stream-writer attempts to publish → rejected
6. stream-owner grants write to stream-writer
7. stream-writer publishes frames → accepted
8. verifier connects (late joiner)
9. Verify verifier sees both owner and writer in authorized_writers
10. stream-owner revokes stream-writer
11. stream-writer attempts to publish → rejected
12. stream-owner transfers ownership to stream-writer
13. stream-writer (now owner) publishes frames → accepted
14. stream-owner attempts to publish → rejected (no longer owner)

### E2E Test Implementation

**stream-owner.cjs:**
```javascript
const { MEWClient } = require('@mew-protocol/mew');

async function main() {
  const client = new MEWClient({ /* config */ });
  await client.connect();

  // Request stream
  const streamReq = await client.send({
    kind: 'stream/request',
    to: ['gateway'],
    payload: {
      direction: 'upload',
      description: 'Test stream',
      content_type: 'text/plain'
    }
  });

  // Wait for stream/open
  const streamOpen = await client.waitFor(env =>
    env.kind === 'stream/open' &&
    env.correlation_id?.includes(streamReq.id)
  );

  const streamId = streamOpen.payload.stream_id;
  console.log(`Stream opened: ${streamId}`);

  // Publish test frame
  client.sendStreamFrame(streamId, 'Frame from owner');

  // Wait for signal to grant access
  await client.waitFor(env =>
    env.kind === 'chat' &&
    env.payload.text === 'grant-access'
  );

  // Grant write access to stream-writer
  await client.send({
    kind: 'stream/grant-write',
    to: ['gateway'],
    payload: {
      stream_id: streamId,
      participant_id: 'stream-writer'
    }
  });

  console.log('Granted write access to stream-writer');

  // Wait for signal to revoke
  await client.waitFor(env =>
    env.kind === 'chat' &&
    env.payload.text === 'revoke-access'
  );

  // Revoke access
  await client.send({
    kind: 'stream/revoke-write',
    to: ['gateway'],
    payload: {
      stream_id: streamId,
      participant_id: 'stream-writer'
    }
  });

  console.log('Revoked write access');

  // Wait for signal to transfer
  await client.waitFor(env =>
    env.kind === 'chat' &&
    env.payload.text === 'transfer-ownership'
  );

  // Transfer ownership
  await client.send({
    kind: 'stream/transfer-ownership',
    to: ['gateway'],
    payload: {
      stream_id: streamId,
      new_owner: 'stream-writer'
    }
  });

  console.log('Transferred ownership to stream-writer');
}

main().catch(console.error);
```

**check.sh:**
```bash
#!/usr/bin/env bash

# Check envelope history for expected messages
ENVELOPE_LOG=".mew/logs/envelope-history.jsonl"

# 1. Verify stream/open was sent
if ! grep -q '"kind":"stream/open"' "$ENVELOPE_LOG"; then
  echo "FAIL: No stream/open message"
  exit 1
fi

# 2. Verify stream/grant-write was sent
if ! grep -q '"kind":"stream/grant-write"' "$ENVELOPE_LOG"; then
  echo "FAIL: No stream/grant-write message"
  exit 1
fi

# 3. Verify stream/revoke-write was sent
if ! grep -q '"kind":"stream/revoke-write"' "$ENVELOPE_LOG"; then
  echo "FAIL: No stream/revoke-write message"
  exit 1
fi

# 4. Verify stream/transfer-ownership was sent
if ! grep -q '"kind":"stream/transfer-ownership"' "$ENVELOPE_LOG"; then
  echo "FAIL: No stream/transfer-ownership message"
  exit 1
fi

# 5. Verify authorized_writers in welcome message
# Extract system/welcome payload and check for authorized_writers field
WELCOME=$(grep '"kind":"system/welcome"' "$ENVELOPE_LOG" | tail -1)
if ! echo "$WELCOME" | grep -q '"authorized_writers"'; then
  echo "FAIL: No authorized_writers in welcome message"
  exit 1
fi

echo "All checks passed!"
```

## Open Questions & Recommendations

### 1. Auto-revoke on disconnect?

**Question:** Should gateway automatically revoke write access when a writer disconnects?

**Options:**
- **A:** Auto-revoke when participant sends presence/leave or connection closes
- **B:** Keep authorization (writer can reconnect and resume)
- **C:** Owner decides (flag in grant message)

**Analysis:**
- **Option A** prevents zombie writers (security benefit)
- **Option B** supports temporary disconnects (UX benefit)
- **Option C** most flexible but adds complexity

**Recommendation:** Option A (auto-revoke) for Phase 1. Simpler and safer.

**Implementation:**
```typescript
// In participant disconnect handler
ws.on('close', () => {
  // ... existing disconnect logic

  // Revoke from all streams
  for (const [streamId, streamInfo] of space.activeStreams.entries()) {
    const index = streamInfo.authorizedWriters.indexOf(participantId);
    if (index !== -1 && streamInfo.participantId !== participantId) {
      streamInfo.authorizedWriters.splice(index, 1);
      console.log(`Auto-revoked ${participantId} from stream ${streamId} (disconnect)`);
    }
  }
});
```

### 2. Should revoked participants receive notification?

**Question:** When owner revokes a writer, should that writer receive a message?

**Options:**
- **A:** Yes, send `stream/write-revoked` to revoked participant
- **B:** No, participant discovers on next write attempt
- **C:** Broadcast revocation to all (transparency)

**Analysis:**
- **Option A** provides explicit notification (good UX)
- **Option B** is simpler (less messages)
- **Option C** provides full transparency (audit trail)

**Recommendation:** Option C (broadcast). Aligns with MEW Protocol's transparency goal.

**Implementation:**
```typescript
// After revoke-write processing
broadcastToSpace(space, {
  protocol: 'mew/v0.4',
  id: generateId(),
  from: 'system:gateway',
  kind: 'stream/write-revoked',
  correlation_id: [envelope.id],
  payload: {
    stream_id,
    participant_id: revoked_participant,
    authorized_writers: stream.authorizedWriters
  }
});
```

### 3. Maximum number of authorized writers?

**Question:** Should there be a limit on authorized_writers array size?

**Options:**
- **A:** Unlimited (owner can grant to all participants)
- **B:** Fixed limit (e.g., 10 writers)
- **C:** Configurable limit (gateway config)

**Analysis:**
- **Option A** most flexible but unbounded memory
- **Option B** prevents abuse, arbitrary number
- **Option C** allows operator control

**Recommendation:** Option A for Phase 1. Add limit (Option C) if needed in future.

### 4. Should transfers require acceptance?

**Question:** Should new owner confirm transfer before ownership changes?

**Options:**
- **A:** Require acceptance (two-phase protocol)
- **B:** Immediate transfer (current proposal)

**Analysis:**
- **Option A** prevents unwanted ownership (protection)
- **Option B** simpler protocol (fewer messages)

**Recommendation:** Option B (immediate). Ownership comes with responsibility, but owner can immediately transfer back if unwanted.

### 5. Error reporting for unauthorized frames?

**Question:** Should gateway send error when unauthorized participant publishes frame?

**Options:**
- **A:** Send system/error to sender
- **B:** Silent drop (just log)
- **C:** Broadcast violation (transparency)

**Analysis:**
- **Option A** helps sender debug (good UX)
- **Option B** simpler (less messages)
- **Option C** alerts all participants (security monitoring)

**Recommendation:** Option A (error to sender). Stream frames don't have envelope IDs, so error can't include correlation_id (acceptable).

## Backward Compatibility Analysis

### Existing Gateways

**v0.8.0 gateways (before this proposal):**
- Ignore unknown message kinds (gateway/grant-write, etc.)
- Continue enforcing owner-only writes
- Don't include authorized_writers in welcome

**Impact:** New authorization messages are silently ignored. No errors.

### Existing Clients

**Clients expecting only owner writes:**
- Receive welcome with authorized_writers field → ignored (extra field)
- Observe grant/revoke/transfer messages → ignored (unknown kinds)

**Impact:** No breaking changes. Extra fields are ignored.

### Migration Path

**Phase 1:** Deploy gateway with new features
**Phase 2:** Update clients to use grant/revoke/transfer
**Phase 3:** Update clients to display authorized_writers

**Rollback:** Remove grant/revoke/transfer handlers from gateway. Streams revert to owner-only.

## Future Extensions

### 1. Read Access Control

Currently, all stream frames are broadcast to all participants. Future proposal could add:

- `stream/grant-read` - Allow specific participants to receive frames
- `stream/revoke-read` - Remove read access
- `authorized_readers` array in stream metadata

**Use case:** Private streams (e.g., direct messages, sensitive data)

### 2. Conditional Grants

Grant write access with conditions:

```json
{
  "kind": "stream/grant-write",
  "payload": {
    "stream_id": "stream-42",
    "participant_id": "player1",
    "conditions": {
      "expires_at": "2025-11-23T13:00:00Z",
      "max_frames": 100
    }
  }
}
```

**Use case:** Temporary access, rate limiting

### 3. Stream Templates

Pre-configured authorization for common patterns:

```json
{
  "kind": "stream/request",
  "payload": {
    "template": "collaborative",
    "auto_grant": ["team-member-1", "team-member-2"]
  }
}
```

**Use case:** Simplify multi-writer setup

### 4. Delegation Chains

Writer grants write to another participant (not just owner):

**Challenge:** Security implications. Would need capability-based authorization.

**Use case:** Hierarchical delegation (manager → team lead → developer)

## Implementation Checklist

Gateway changes:
- [ ] Add authorized_writers array to stream info on create
- [ ] Implement stream/grant-write handler
- [ ] Implement stream/revoke-write handler
- [ ] Implement stream/transfer-ownership handler
- [ ] Update frame validation to check authorized_writers
- [ ] Add authorized_writers to welcome message active_streams
- [ ] Add auto-revoke on disconnect
- [ ] Add error responses for unauthorized operations
- [ ] Add optional broadcast acknowledgements

Type changes:
- [ ] Add StreamGrantWritePayload type
- [ ] Add StreamRevokeWritePayload type
- [ ] Add StreamTransferOwnershipPayload type
- [ ] Add authorized_writers to StreamMetadata
- [ ] Add new kinds to EnvelopeKind union

Tests:
- [ ] Unit tests for grant/revoke/transfer handlers
- [ ] Integration tests for frame validation
- [ ] E2E scenario for ownership transfer workflow
- [ ] Performance benchmarks for authorized_writers lookup

Documentation:
- [ ] Update SPEC.md with new message kinds
- [ ] Update SPEC.md Section 3.10 (Stream Lifecycle)
- [ ] Update SPEC.md Section 3.8.1 (Welcome Message)
- [ ] Add examples to SPEC.md Section 9
- [ ] Update CHANGELOG.md

## References

- Current stream implementation: src/cli/commands/gateway.ts:378-430, 998-1021
- Stream visibility proposal: spec/protocol/proposals/j8v-stream-visibility/
- MEW Protocol SPEC: spec/protocol/SPEC.md Section 3.10
- Seacat RTS decision: (provided in context)
