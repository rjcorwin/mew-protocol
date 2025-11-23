# Decision: Stream Ownership Transfer (s2w)

**Status:** Draft
**Created:** 2025-11-23
**Proposal:** s2w-stream-ownership
**MEW Protocol Version:** 0.9.0+ (requires j8v stream visibility)

## Context

MEW Protocol 0.8.0 introduced stream visibility with metadata preservation ([j8v]), enabling late joiners to see active streams and their metadata. However, streams currently have a critical limitation: only the participant who created the stream can publish frames to it.

This limitation blocks important use cases:

1. **Game Character Control** - Character servers create position streams but need to delegate write access to the player or AI currently controlling the character
2. **Collaborative Workflows** - Multiple agents need to publish to a shared output stream
3. **Ownership Transfer** - When a stream creator disconnects, another participant should be able to take over

The Seacat RTS game (mew-protocol's original test case, now standalone) specifically needs this feature for character control delegation, as documented in their decision record.

## Decision

Implement stream ownership transfer with three new message kinds:

1. **`stream/grant-write`** - Owner grants write access to another participant
2. **`stream/revoke-write`** - Owner revokes write access from a participant
3. **`stream/transfer-ownership`** - Owner transfers complete ownership to another participant

Additionally:
- Extend `system/welcome.active_streams` with `authorized_writers` field
- Update gateway frame validation to check authorized writers list
- Auto-revoke write access when participants disconnect

## Design Principles

### 1. Owner-Centric Authorization

The stream owner has complete control over who can write:
- Only owner can grant/revoke/transfer
- Owner cannot revoke self (always authorized)
- Owner can transfer ownership entirely to another participant
- After transfer, previous owner loses control (but may retain write access if granted)

**Rationale:** Clear authority model prevents authorization conflicts.

### 2. Explicit Authorization Messages

Authorization changes use dedicated message kinds, not metadata updates:

```json
// Preferred (this proposal)
{
  "kind": "stream/grant-write",
  "payload": {
    "stream_id": "stream-42",
    "participant_id": "player1"
  }
}

// Rejected alternative
{
  "kind": "stream/metadata_update",
  "payload": {
    "stream_id": "stream-42",
    "metadata": {
      "authorized_writers": ["player1"]
    }
  }
}
```

**Rationale:** Authorization is security-critical and should have explicit protocol semantics, not be buried in arbitrary metadata.

### 3. Backward Compatible Extension

- Existing streams default to owner-only writes (current behavior)
- New `authorized_writers` field is optional in welcome message
- Unknown message kinds are ignored by older gateways
- No breaking changes to existing stream lifecycle

**Rationale:** Gradual adoption without forcing upgrades.

### 4. Late Joiner Transparency

Late joiners see current authorization state in welcome message:

```json
{
  "kind": "system/welcome",
  "payload": {
    "active_streams": [
      {
        "stream_id": "stream-42",
        "owner": "character-server",
        "authorized_writers": ["character-server", "player1"]
      }
    ]
  }
}
```

**Rationale:** Maintains MEW Protocol's "Unified Context" goal. Late joiners have same visibility as early joiners.

### 5. Broadcast Transparency

Authorization changes should be visible to all participants (not just direct notifications):

```json
// Gateway broadcasts after processing grant-write
{
  "kind": "stream/write-granted",
  "from": "system:gateway",
  "payload": {
    "stream_id": "stream-42",
    "participant_id": "player1",
    "authorized_writers": ["character-server", "player1"]
  }
}
```

**Rationale:** Aligns with MEW Protocol's transparency and observability goals. All participants can monitor authorization changes.

## Alternatives Considered

### Alternative 1: Capability-Based Stream Access

Extend MEW Protocol capabilities to include stream-specific grants:

```json
{
  "kind": "capability/grant",
  "payload": {
    "recipient": "player1",
    "capabilities": [
      {
        "kind": "stream/write",
        "payload": { "stream_id": "stream-42" }
      }
    ]
  }
}
```

**Pros:**
- Reuses existing capability system
- Consistent with MEW Protocol security model

**Cons:**
- Stream capabilities don't fit existing patterns (capabilities match message kinds + payload)
- Capabilities are participant-wide, streams are resource-specific
- Would require new capability matching logic for stream IDs
- Late joiners need both capabilities and active_streams (duplication)

**Decision:** Rejected. Streams are resources with instance-specific authorization, not participant-wide permissions.

### Alternative 2: Close and Reopen Stream

To change writers, close the stream and reopen with different owner:

**Pros:**
- Uses existing messages only
- No protocol changes needed

**Cons:**
- Stream ID changes (breaks client tracking)
- Data interruption during close/reopen
- Loses continuity for late joiners
- Awkward for temporary delegation (player takes control for 5 minutes)

**Decision:** Rejected. Too disruptive for common use cases like temporary control delegation.

### Alternative 3: Metadata-Only Authorization

Store authorization in stream metadata, don't enforce at protocol level:

```json
{
  "kind": "stream/request",
  "payload": {
    "metadata": {
      "authorized_writers": ["player1", "player2"]
    }
  }
}
```

**Pros:**
- No gateway changes needed
- Flexible metadata format

**Cons:**
- Gateway must parse application-specific metadata for security decisions
- Violates separation: metadata is advisory, authorization is security-critical
- No enforcement (any participant could still publish frames)
- Less discoverable (clients must know to check metadata)

**Decision:** Rejected. Authorization is too important to be advisory-only.

## Implementation Strategy

### Phase 1: Core Authorization (v0.9.0)

1. Add `authorized_writers` array to gateway stream tracking
2. Implement `stream/grant-write` handler
3. Implement `stream/revoke-write` handler
4. Implement `stream/transfer-ownership` handler
5. Update frame validation to check `authorized_writers`
6. Add `authorized_writers` to `system/welcome.active_streams`
7. Add TypeScript types for new message kinds
8. Create e2e test scenario

### Phase 2: Auto-Revoke and Notifications (v0.9.1)

1. Auto-revoke write access when participant disconnects
2. Broadcast `stream/write-granted` acknowledgements
3. Broadcast `stream/write-revoked` notifications
4. Broadcast `stream/ownership-transferred` events

### Phase 3: Advanced Features (Future)

1. Conditional grants (time-based, frame-count-limited)
2. Read access control (`authorized_readers`)
3. Stream templates for common patterns
4. Performance optimizations (Set instead of Array for large writer lists)

## Open Questions & Decisions

### 1. Auto-revoke on disconnect?

**Question:** Should gateway automatically revoke write access when a writer disconnects?

**Decision:** Yes (Phase 2)

**Rationale:**
- Prevents zombie writers (security benefit)
- Simplifies ownership tracking (no stale authorizations)
- Aligns with presence system (participant leaves = loses access)
- Writers who reconnect must be re-granted (explicit re-authorization)

### 2. Should revoked participants receive notification?

**Question:** When owner revokes a writer, should that writer receive a direct message?

**Decision:** Broadcast to all participants (Phase 2)

**Rationale:**
- Aligns with MEW Protocol's transparency goal
- Enables all participants to monitor authorization state
- Audit trail for security monitoring
- Revoked participant sees notification along with everyone else

### 3. Maximum number of authorized writers?

**Question:** Should there be a limit on `authorized_writers` array size?

**Decision:** No limit initially (Phase 1), add configurable limit if needed (Phase 3)

**Rationale:**
- Most use cases have small writer sets (<10)
- Premature optimization
- Can add limit later if memory usage becomes concern
- Array lookup is O(N) but fast for small N

### 4. Should transfers require acceptance?

**Question:** Should new owner confirm transfer before ownership changes?

**Decision:** No, immediate transfer (Phase 1)

**Rationale:**
- Simpler protocol (one message instead of two-phase)
- New owner can immediately transfer back if unwanted
- Trust model: owner trusts participant they're transferring to
- Can add confirmation in future if needed

### 5. Error reporting for unauthorized frames?

**Question:** Should gateway send error when unauthorized participant publishes frame?

**Decision:** Yes, send `system/error` to sender (Phase 1)

**Rationale:**
- Helps sender debug authorization issues
- Better UX than silent failure
- Stream frames don't have envelope IDs, so error can't include `correlation_id` (acceptable limitation)

## Security Considerations

### Threat Model

1. **Unauthorized Frame Publishing**
   - **Threat:** Attacker publishes frames to stream they don't own
   - **Mitigation:** Gateway checks `authorized_writers` on every frame
   - **Impact:** Frame dropped, logged, sender receives error

2. **Authorization Bypass**
   - **Threat:** Attacker sends grant-write for stream they don't own
   - **Mitigation:** Gateway verifies sender === stream owner
   - **Impact:** Request rejected with `system/error`

3. **Ownership Hijacking**
   - **Threat:** Attacker transfers ownership of stream they don't own
   - **Mitigation:** Gateway verifies sender === stream owner
   - **Impact:** Request rejected with `system/error`

4. **Denial of Service**
   - **Threat:** Attacker grants write to many participants (memory exhaustion)
   - **Mitigation:** Future: limit `authorized_writers` array size
   - **Impact:** Currently unbounded (acceptable for v0.9.0)

### Security Properties

**Maintained:**
- Only gateway can send `system/*` messages
- Participants cannot spoof `from` field
- Stream ownership explicitly tracked
- All authorization changes are logged

**New:**
- Only stream owner can grant/revoke/transfer
- Authorized writers verified on every frame
- Late joiners see current authorization state
- Owner cannot lose write access (always authorized)

## Benefits

1. **Direct Control** - Participants write to streams without relay overhead
2. **Flexible Delegation** - Owner controls authorization, supports multiple writers
3. **Ownership Transfer** - Enables handoff when owner disconnects or changes role
4. **Late Joiner Visibility** - `authorized_writers` shows current state
5. **Backward Compatible** - Existing streams work unchanged
6. **Audit Trail** - All authorization changes are protocol messages (logged)
7. **Transparent** - All participants observe authorization changes

## Use Cases Enabled

### 1. Game Character Control (Seacat RTS)

Character server creates position stream, delegates write to controlling player:

1. Character server requests stream for character position
2. Player claims control via MCP tool
3. Character server grants write access to player
4. Player publishes position frames directly (no relay)
5. Late joiner sees `authorized_writers: ["character-server", "player1"]`
6. Player disconnects
7. Gateway auto-revokes player's write access
8. AI agent claims control
9. Character server transfers ownership to AI agent

### 2. Collaborative Output Stream

Orchestrator creates results stream, grants write to all workers:

1. Orchestrator requests shared results stream
2. Worker-1 and Worker-2 join
3. Orchestrator grants write to both workers
4. Workers publish results directly to stream
5. Late joiner sees all three participants in `authorized_writers`
6. Orchestrator aggregates results without relaying

### 3. Ownership Handoff on Disconnect

Stream owner leaves, another participant takes over:

1. Owner creates critical monitoring stream
2. Backup participant monitors stream activity
3. Owner disconnects unexpectedly
4. Backup detects absence (presence event)
5. Gateway auto-revokes owner's write access (on disconnect)
6. Backup requests new stream OR owner pre-transferred ownership
7. Stream continues operating without interruption

## Testing Strategy

### E2E Scenario: Character Control Delegation

File: `e2e/scenario-16-stream-ownership/`

**Test sequence:**
1. Character server creates position stream
2. Verify character server can publish frames
3. Player connects (late joiner)
4. Verify player sees owner in `authorized_writers`
5. Player attempts to publish → rejected
6. Character server grants write to player
7. Player publishes frames → accepted
8. Verifier connects (late joiner)
9. Verify verifier sees both in `authorized_writers`
10. Character server revokes player
11. Player attempts to publish → rejected
12. Character server transfers ownership to player
13. Player (now owner) publishes → accepted
14. Character server attempts to publish → rejected

**Assertions:**
- 17+ checks covering all authorization states
- Validate frame acceptance/rejection
- Validate welcome message `authorized_writers` field
- Validate broadcast acknowledgements

## Next Steps

1. ✅ Create proposal.md (this document)
2. ✅ Create research.md with implementation details
3. ✅ Create decision-s2w-stream-ownership.md (this document)
4. [ ] Update CHANGELOG.md with proposal entry
5. [ ] Implement gateway handlers (src/cli/commands/gateway.ts)
6. [ ] Add TypeScript types (src/types/protocol.ts)
7. [ ] Create e2e test scenario (e2e/scenario-16-stream-ownership/)
8. [ ] Update SPEC.md with new message kinds
9. [ ] Submit PR with proposal + implementation

## References

- Stream visibility proposal: spec/protocol/proposals/j8v-stream-visibility/
- Current stream implementation: src/cli/commands/gateway.ts:378-430, 998-1021
- MEW Protocol SPEC: spec/protocol/SPEC.md Section 3.10
- Seacat RTS decision: Provided in context (r7c-rts-character-control)
