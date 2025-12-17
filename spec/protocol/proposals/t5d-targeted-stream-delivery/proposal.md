# Proposal: Targeted Stream Delivery (t5d)

**Code:** t5d
**Status:** Implemented (v0.11.0)
**Area:** Protocol
**Created:** 2025-12-16

## Summary

Add an optional `target` field to MEW Protocol streams. When specified, the gateway delivers stream data frames only to the targeted participant instead of broadcasting to all participants. When omitted, streams broadcast to all participants (existing behavior).

## Motivation

MEW Protocol's "Unified Context" goal drives broadcast-by-default behavior. This works well for coordination messages but creates O(N²) message fan-out for high-frequency telemetry streams.

With N entities publishing streams at R Hz, total deliveries = N × R × (N-1):
- 6 entities × 10 Hz: 300 deliveries/sec (acceptable)
- 15 entities × 10 Hz: 2,100 deliveries/sec (problematic)
- 50 entities × 10 Hz: 24,500 deliveries/sec (unworkable)

Many real-world applications follow an **aggregation pattern**: multiple publishers send data to a single aggregator, which then broadcasts combined results. Examples:

- **Game networking**: Players send positions to game server, which broadcasts world state
- **Sensor networks**: Sensors report to collector, which broadcasts dashboards
- **Log aggregation**: Services send logs to aggregator, which broadcasts alerts

Currently, MEW Protocol cannot express this pattern efficiently. All streams broadcast to all participants, even when only one needs the data.

## Goals

1. Enable O(N) message delivery for aggregation patterns
2. Preserve broadcast as the default behavior
3. Maintain backward compatibility with existing clients/gateways
4. Keep the change minimal and focused
5. Make targeting opt-in per stream

## Non-Goals

- Stream subscription/filtering mechanisms (complementary future feature)
- Changing default broadcast behavior
- Privacy or access control (target is routing optimization, not security)
- Changing envelope message delivery (this only affects stream data frames)

## Use Cases

### Game Position Aggregation

Players send position updates to a game server, which aggregates and broadcasts world state:

```
Player1 ──position-stream (target: game-server)──┐
Player2 ──position-stream (target: game-server)──┼──► Game Server
Player3 ──position-stream (target: game-server)──┘
                                                        │
                                                        ▼
                                            world-state-stream (broadcast)
                                                        │
                                           ┌────────────┼────────────┐
                                           ▼            ▼            ▼
                                       Player1      Player2      Player3
```

**Without targeted delivery:** Each position stream goes to all players = O(N²)
**With targeted delivery:** Position streams go only to game server = O(N)

### Sensor Data Collection

Multiple sensors report to a central collector:

```json
{
  "kind": "stream/request",
  "payload": {
    "direction": "upload",
    "content_type": "application/x-sensor-reading",
    "format": "jsonl",
    "target": ["sensor-collector"],
    "metadata": {
      "sensor_id": "temp-sensor-42",
      "unit": "celsius"
    }
  }
}
```

### Private AI Reasoning Trace

An AI agent shares its reasoning with its orchestrator but not other agents:

```json
{
  "kind": "stream/request",
  "payload": {
    "direction": "upload",
    "content_type": "application/json",
    "format": "jsonl",
    "target": ["orchestrator"],
    "description": "Chain-of-thought reasoning"
  }
}
```

### File Transfer to Specific Recipient

Send a file to one participant without broadcasting:

```json
{
  "kind": "stream/request",
  "payload": {
    "direction": "upload",
    "content_type": "application/octet-stream",
    "target": ["file-processor"],
    "expected_size_bytes": 10485760,
    "metadata": {
      "filename": "data.zip"
    }
  }
}
```

## Technical Design

### Protocol Changes

#### 1. Add `target` Field to `stream/request`

Extend the `stream/request` payload with an optional `target` field:

```json
{
  "protocol": "mew/v0.4",
  "kind": "stream/request",
  "from": "player1",
  "to": ["gateway"],
  "payload": {
    "direction": "upload",
    "content_type": "application/json",
    "format": "seacat/character-position-v1",
    "target": ["game-server"],
    "description": "Player position updates"
  }
}
```

**Field Definition:**
- `target` (array of strings, optional): Participant IDs to receive stream data frames
  - If specified and non-empty: Gateway delivers `#streamID#...` frames only to listed participants
  - If omitted, null, or empty array: Gateway broadcasts frames to all participants (existing behavior)
  - All targets must be valid participants in the space
  - Target can include the stream owner (self-targeted stream)
  - Single-element array `["game-server"]` is equivalent to targeting one participant
  - Consistent with envelope `to` field semantics

#### 2. Include `target` in `stream/open`

The gateway echoes back the target in the `stream/open` response:

```json
{
  "protocol": "mew/v0.4",
  "kind": "stream/open",
  "from": "gateway",
  "to": ["player1"],
  "correlation_id": ["stream-req-1"],
  "payload": {
    "stream_id": "stream-42",
    "encoding": "binary",
    "target": ["game-server"]
  }
}
```

Note: The `stream/open` message itself is still delivered per normal envelope routing (to the requester). Only the stream data frames (`#streamID#...`) are affected by targeting.

#### 3. Include `target` in `active_streams` (Welcome Message)

Per [j8v], the `system/welcome` message includes `active_streams`. Add `target` to stream metadata:

```json
{
  "kind": "system/welcome",
  "payload": {
    "you": { ... },
    "participants": [ ... ],
    "active_streams": [
      {
        "stream_id": "stream-42",
        "owner": "player1",
        "direction": "upload",
        "created": "2025-01-09T10:00:00Z",
        "target": ["game-server"],
        "content_type": "application/json",
        "format": "seacat/character-position-v1"
      },
      {
        "stream_id": "stream-99",
        "owner": "game-server",
        "direction": "upload",
        "created": "2025-01-09T10:00:05Z",
        "content_type": "application/json",
        "format": "seacat/world-state-v1"
      }
    ]
  }
}
```

Note: Streams without a target (broadcast) simply omit the `target` field.

### Gateway Behavior

#### Stream Data Frame Routing

Current behavior:
```
Receive #streamID#data from owner
Broadcast to all connected participants
```

New behavior:
```
Receive #streamID#data from authorized writer
Look up stream metadata
If stream.target exists:
    Send frame only to target participant
Else:
    Broadcast to all connected participants
```

#### Validation

The gateway MUST validate:
1. All target participants exist in the space at stream creation time
2. Stream data frames come from authorized writer (owner or granted via [s2w])

The gateway SHOULD:
1. Return `system/error` if any target participant doesn't exist
2. Continue delivering to remaining targets if one disconnects (see Open Questions)

#### Target Validation Error

If `target` specifies any non-existent participant:

```json
{
  "protocol": "mew/v0.4",
  "kind": "system/error",
  "from": "system:gateway",
  "to": ["player1"],
  "correlation_id": ["stream-req-1"],
  "payload": {
    "error": "target_not_found",
    "targets": ["non-existent-participant"],
    "message": "One or more target participants do not exist in space"
  }
}
```

### Space Configuration (Optional)

Gateways MAY support pre-configuring stream targets in `space.yaml`:

```yaml
streams:
  player1-position:
    owner: player1
    direction: upload
    target: game-server
    content_type: application/json
    format: seacat/character-position-v1

  world-state:
    owner: game-server
    direction: upload
    # No target = broadcast to all
    content_type: application/json
    format: seacat/world-state-v1
```

This is implementation-specific and not part of the protocol spec.

### Interaction with Stream Write Grants [s2w]

Targeted delivery works with stream write grants:
- Stream owner sets target at creation
- Owner can grant write access to other participants
- All authorized writers' frames go to the target
- Target cannot be changed after stream creation

Example: Character server owns stream, grants write to player, frames go to game server:

```
Character Server: stream/request (target: game-server)
Character Server: stream/grant-write (to: player1)
Player1 writes: #streamID#position-data
Gateway delivers: → game-server only
```

## Backward Compatibility

### For Older Clients

- Clients unaware of `target` field can still request streams
- Their streams broadcast as usual (existing behavior)
- They receive `stream/open` responses normally
- No breaking changes

### For Newer Clients, Older Gateways

- Gateways unaware of `target` will ignore the field
- Streams will broadcast (degraded but functional)
- Clients should not assume targeting works without gateway support
- Feature detection: Check if `stream/open` echoes back `target`

### For Mixed Environments

- Targeted streams invisible to non-target participants
- Non-target participants still see stream metadata in `active_streams`
- They just don't receive the data frames
- This is intentional - they don't need the data

### Protocol Version

- Remains `mew/v0.4` (additive change)
- No version bump required for optional field addition

## Implementation Requirements

### Gateway Changes

**Location:** Stream handling and frame routing

1. **Stream creation** - Store targets when creating stream:
   ```typescript
   if (payload.target && payload.target.length > 0) {
     // Validate all targets exist
     const missing = payload.target.filter(t => !space.participants.has(t));
     if (missing.length > 0) {
       return sendError('target_not_found', { targets: missing });
     }
   }

   space.activeStreams.set(streamId, {
     owner: participantId,
     target: payload.target || [],
     ...payload
   });
   ```

2. **Frame routing** - Check targets before delivery:
   ```typescript
   function routeStreamFrame(streamId: string, data: Buffer) {
     const stream = space.activeStreams.get(streamId);
     if (!stream) return;

     if (stream.target && stream.target.length > 0) {
       // Targeted delivery - send to each target
       for (const targetId of stream.target) {
         const targetConn = getConnection(targetId);
         if (targetConn) {
           targetConn.send(data);
         }
       }
     } else {
       // Broadcast
       for (const conn of space.connections.values()) {
         conn.send(data);
       }
     }
   }
   ```

3. **Welcome message** - Include target in active_streams:
   ```typescript
   active_streams: streams.map(s => ({
     stream_id: s.id,
     owner: s.owner,
     target: s.target,  // Include if present
     ...s.metadata
   }))
   ```

### Client Changes (Optional)

Clients may optionally:
- Process `target` in `stream/open` to confirm targeting
- Check `target` in `active_streams` to understand stream routing
- Filter stream processing based on whether they're the target

### Spec Updates

**File:** `spec/protocol/SPEC.md`

**Section 3.10.1** - Stream Request:
- Add `target` field to payload definition
- Document behavior and validation

**Section 3.10.2** - Stream Open:
- Add `target` field echoed from request

**Section 3.8.1** - Welcome Message:
- Add `target` to active_streams array items (per [j8v])

## Testing Strategy

### Unit Tests

1. **Stream creation with target**
   - Single target exists → stream created successfully
   - Multiple targets all exist → stream created successfully
   - Any target doesn't exist → error returned with list of missing
   - Empty target array → stream broadcasts (existing behavior)
   - No target field → stream broadcasts (existing behavior)

2. **Frame routing**
   - Single target → frames only to that target
   - Multiple targets → frames to each target
   - Broadcast stream → frames to all
   - One target disconnects → frames still delivered to remaining targets

3. **Welcome message**
   - Targeted streams include `target` in active_streams
   - Broadcast streams omit `target`

### Integration Tests

1. **Aggregation pattern test**:
   - 3 publishers create targeted streams to aggregator
   - Each publishes data
   - Verify only aggregator receives frames
   - Aggregator publishes broadcast stream
   - Verify all participants receive aggregator's frames

2. **Mixed streams test**:
   - Some targeted, some broadcast
   - Verify correct routing for each

3. **Late joiner test**:
   - Streams created before participant joins
   - New participant sees stream metadata with target
   - New participant doesn't receive targeted stream data

### Edge Cases

- One of multiple targets disconnects mid-stream
- Target reconnects after disconnect
- Owner changes (via [s2w] transfer) - targets unchanged
- Self-targeted stream (owner in target list)
- All targets disconnect (frames dropped, stream stays open)

## Open Questions

### 1. What happens when a target disconnects?

Options:
- **A) Continue delivering to remaining targets** - Simple, partial delivery
- **B) Close stream** - Clean, but disrupts owner and other targets
- **C) Buffer frames for disconnected target** - Complex, memory concerns
- **D) Notify owner** - Owner decides what to do

**Recommendation:** Option A (continue to remaining targets) for initial implementation. When target reconnects, they resume receiving. Optionally notify owner via `system/error` with `target_disconnected`. If all targets disconnect, frames are simply dropped until one reconnects.

### 2. Can targets be changed after stream creation?

**Recommendation:** No. Targets are set at creation and immutable. This is simpler and avoids race conditions. If redirection is needed, close and create new stream.

### 3. Should untargeted participants receive stream lifecycle messages?

Currently `stream/open` and `stream/close` are broadcast. Should they be targeted too?

**Recommendation:** Keep lifecycle messages broadcast. They're infrequent and valuable for observability. Only the high-frequency data frames are targeted.

## Success Criteria

1. Targeted streams deliver frames only to target participant
2. Broadcast streams continue to work unchanged
3. Late joiners see stream metadata including target
4. Backward compatible with existing clients/gateways
5. Gateway handles target validation gracefully
6. Test coverage for all routing scenarios

## Future Enhancements

Possible future additions (out of scope for this proposal):
- Dynamic target changes (add/remove targets after creation)
- Stream subscription mechanism (complementary feature for receiver-initiated)
- Target patterns/wildcards (e.g., `"player-*"`)

## References

- MEW Protocol v0.4 SPEC.md Section 2.1 (Goals - Unified Context)
- MEW Protocol v0.4 SPEC.md Section 3.10 (Stream Lifecycle)
- Proposal [j8v] - Stream Visibility on Join
- Proposal [s2w] - Stream Write Grants
- Seacat decision-001-network-architecture.md (Option I analysis)

## Related Proposals

- **[j8v] Stream Visibility on Join** - Adds `active_streams` to welcome; t5d adds `target` to that structure
- **[s2w] Stream Write Grants** - Adds multi-writer streams; t5d targets delivery regardless of writer
