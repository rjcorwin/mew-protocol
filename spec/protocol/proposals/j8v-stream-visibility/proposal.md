# Proposal: Stream Visibility on Join (j8v)

**Code:** j8v
**Status:** Draft
**Area:** Protocol
**Created:** 2025-11-22

## Summary

When participants join a MEW Protocol space that has active streams, they should receive information about those streams in their `system/welcome` message. Currently, new joiners receive stream data frames without knowing what streams exist, violating the protocol's "Unified Context" goal.

## Motivation

MEW Protocol's first goal is "Unified Context: All participants share the same visible stream of interactions" (SPEC.md Section 2.1). However, participants who join mid-stream experience a visibility gap:

1. User A joins and requests a stream
2. Gateway broadcasts `stream/open` to all participants
3. User B joins (late joiner)
4. User B's welcome message contains participant list but **no stream information**
5. User B receives data frames `#stream-42#data` without context

This asymmetry between early and late joiners violates the unified context principle.

## Goals

1. Provide complete state snapshot to new participants on join
2. Maintain backward compatibility with MEW Protocol v0.4
3. Use existing gateway state (no new tracking required)
4. Follow established patterns for welcome messages

## Non-Goals

- Streaming data replay/history (streams are ephemeral)
- Stream subscription/filtering mechanisms
- Changes to stream lifecycle messages
- Prescribing specific stream types or formats (protocol remains unopinionated)

## Use Cases

The metadata preservation design supports diverse application scenarios:

### Real-time Game Movement

```json
{
  "kind": "stream/request",
  "payload": {
    "direction": "upload",
    "content_type": "application/x-game-positions",
    "format": "binary-vector3",
    "description": "Player movement updates",
    "metadata": {
      "update_rate_hz": 60,
      "coordinate_system": "world-space"
    }
  }
}
```

Late joiner receives in `active_streams`:
```json
{
  "stream_id": "stream-1",
  "owner": "player-1",
  "direction": "upload",
  "created": "2025-01-23T12:00:00Z",
  "content_type": "application/x-game-positions",
  "format": "binary-vector3",
  "description": "Player movement updates",
  "metadata": {
    "update_rate_hz": 60,
    "coordinate_system": "world-space"
  }
}
```

The late joiner knows:
- How to parse the data (binary-vector3 format)
- What the data represents (player positions)
- Update frequency (60 Hz)
- Coordinate system (world-space vs screen-space)

### Voice Chat Transcription

```json
{
  "kind": "stream/request",
  "payload": {
    "direction": "upload",
    "content_type": "text/plain",
    "format": "utf8-newline-delimited",
    "description": "Voice chat transcription",
    "metadata": {
      "language": "en-US",
      "speaker": "alice"
    }
  }
}
```

### AI Reasoning Trace

```json
{
  "kind": "stream/request",
  "payload": {
    "direction": "upload",
    "content_type": "application/json",
    "format": "jsonl",
    "description": "Chain-of-thought reasoning",
    "expected_size_bytes": 1048576
  }
}
```

### File Transfer

```json
{
  "kind": "stream/request",
  "payload": {
    "direction": "upload",
    "content_type": "image/png",
    "description": "Screenshot",
    "expected_size_bytes": 524288,
    "metadata": {
      "filename": "screenshot.png",
      "checksum_sha256": "abc123..."
    }
  }
}
```

In all cases, late joiners receive the complete context needed to understand and process the stream data.

## Technical Design

### Protocol Changes

Add `active_streams` field to `system/welcome` payload:

```json
{
  "protocol": "mew/v0.4",
  "kind": "system/welcome",
  "payload": {
    "you": {
      "id": "new-participant",
      "capabilities": [...]
    },
    "participants": [
      {
        "id": "other-participant",
        "capabilities": [...]
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

Note: All fields from the original `stream/request` payload are preserved and included in the stream metadata.

### Field Definitions

**`active_streams`** (array, optional):
- Array of stream metadata objects
- Empty array if no streams active
- May be omitted if no streams active (for backward compatibility)

**Stream metadata object:**
- `stream_id` (string, required): Unique stream identifier
- `owner` (string, required): Participant ID that requested the stream
- `direction` (string, required): "upload" or "download"
- `created` (string, required): ISO 8601 timestamp when stream was opened
- `expected_size_bytes` (number, optional): Size hint from original request
- `description` (string, optional): Human-readable description from original request
- `content_type` (string, optional): MIME type or format identifier (e.g., "text/plain", "application/x-game-positions")
- `format` (string, optional): Stream format/schema identifier (e.g., "utf8-newline-delimited", "binary-vector3")
- `metadata` (object, optional): Arbitrary key-value pairs from original request
- Additional fields from original `stream/request` are preserved

**Design Principle: Metadata Preservation**

All metadata provided in the original `stream/request` payload MUST be included in the stream metadata sent to late joiners. This ensures:

1. **Zero information loss**: Late joiners get the same context as participants who witnessed the `stream/open`
2. **Format discoverability**: Participants can determine how to parse stream data (text vs binary, encoding, schema)
3. **Application extensibility**: Apps can define custom metadata fields without protocol changes
4. **Use case flexibility**: Supports diverse scenarios (games, chat, file transfer, telemetry) without opinionated stream types

### Implementation Requirements

#### Gateway (gateway.ts)

**Location:** Welcome message construction (around line 946)

**Changes:**

1. **Stream creation** (around line 385): Store entire payload when creating stream
   ```typescript
   // Store ALL metadata from the original request
   space.activeStreams.set(streamId, {
     requestId: envelope.id,
     participantId: participantId,
     created: new Date().toISOString(),
     ...envelope.payload  // Preserve all fields from stream/request
   });
   ```

2. **Welcome message construction**: Extract and transform stream metadata
   ```typescript
   function buildActiveStreamsArray(space): StreamMetadata[] {
     return space.activeStreams
       ? Array.from(space.activeStreams.entries()).map(([streamId, info]) => {
           const { requestId, participantId, created, ...metadata } = info;
           return {
             stream_id: streamId,
             owner: participantId,
             created: created,
             ...metadata  // Spread all metadata from original request
           };
         })
       : [];
   }

   const welcomeMessage = {
     protocol: 'mew/v0.4',
     // ... other fields
     payload: {
       you: { ... },
       participants: [ ... ],
       active_streams: buildActiveStreamsArray(space)  // NEW
     }
   };
   ```

This approach ensures that **all metadata** from the original `stream/request` (including `description`, `content_type`, `format`, `metadata`, and any custom fields) is preserved and sent to late joiners.

#### Client (MEWClient.ts)

**Location:** Welcome message handler (around line 218)

**Changes:**
- Process `active_streams` if present
- Emit event for stream awareness
- Store stream metadata for reference

**Example code:**
```typescript
private handleMessage(message: any): void {
  if (message.kind === 'system/welcome') {
    this.state = 'ready';
    this.emit('welcome', message.payload);

    // Process active streams if present
    if (message.payload.active_streams) {
      for (const stream of message.payload.active_streams) {
        this.emit('stream/active', stream);
      }
    }
    return;
  }
  // ... rest
}
```

#### Spec Updates

**File:** `spec/protocol/SPEC.md`

**Section 3.8.1** - Welcome Message:
- Add `active_streams` to payload structure
- Document field semantics
- Add example showing streams

## Backward Compatibility

### For Older Clients
- New `active_streams` field is optional
- Clients that don't recognize it will ignore it
- No breaking changes to existing fields
- Stream data frames work the same way

### For Newer Clients, Older Gateways
- Clients should handle missing `active_streams` gracefully
- Degraded experience (same as current behavior)
- Feature detection via field presence

### Protocol Version
- Remains `mew/v0.4` (additive change)
- No version bump required for optional field addition

## Testing Strategy

### Unit Tests
- Gateway: Verify welcome includes active streams
- Gateway: Verify empty array when no streams
- Client: Process active_streams correctly
- Client: Handle missing active_streams gracefully

### Integration Tests
1. Start space, user A joins
2. User A requests stream
3. Verify `stream/open` broadcast
4. User B joins
5. Verify user B's welcome includes active stream
6. User B receives stream data
7. Stream closes
8. User C joins
9. Verify user C's welcome has no active streams

### Edge Cases
- Multiple simultaneous streams
- Stream closes during join handshake
- Participant disconnects with active stream

## Migration Path

### Phase 1: Gateway Implementation
1. Update gateway to include active_streams
2. Deploy gateway changes

### Phase 2: Client Awareness (Optional)
1. Update clients to process active_streams
2. Emit events for UI/logging
3. Clients remain compatible with old gateways

### Deployment
- Gateway change is backward compatible (clients ignore new field)
- Client updates are optional enhancement
- No coordination required between gateway and client deployments

## Open Questions

None at this time.

## Success Criteria

1. New participants receive complete stream state on join
2. No breaking changes to existing protocol behavior
3. Backward compatible with existing clients
4. Test coverage for all scenarios
5. Spec updated with clear documentation

## Future Enhancements

Possible future additions (out of scope for this proposal):
- Stream data history/replay
- Stream filtering/subscription
- Stream bandwidth metrics
- Stream priority/QoS

## References

- MEW Protocol v0.4 SPEC.md Section 3.8.1 (Welcome Message)
- MEW Protocol v0.4 SPEC.md Section 3.10 (Stream Lifecycle)
- gateway.ts lines 1380-1434 (Stream handling)
- MEWClient.ts lines 82-89 (Stream data parsing)

## Related Proposals

None at this time.
