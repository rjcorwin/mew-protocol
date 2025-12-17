# Decision: Targeted Stream Delivery (t5d)

## Status
PROPOSED

## Context

MEW Protocol streams currently broadcast all data frames to all participants in a space. This aligns with the "Unified Context" goal but creates O(N²) message fan-out for high-frequency streams, limiting scalability for applications with many concurrent publishers.

The driving use case is the **aggregation pattern**: multiple entities publish streams to a single aggregator, which then broadcasts combined results. This pattern is fundamental to:
- Game networking (players → game server → world state → players)
- Sensor networks (sensors → collector → dashboard)
- Log aggregation (services → aggregator → alerts)

Without targeted delivery, these patterns require O(N²) bandwidth even when only one participant needs each input stream.

## Decision Drivers

1. **Scalability**: Enable O(N) delivery for aggregation patterns
2. **Simplicity**: Minimal protocol surface change
3. **Backward Compatibility**: Must work with existing implementations
4. **Philosophy Alignment**: Should complement, not conflict with, "Unified Context"
5. **Opt-in Design**: Default behavior must remain broadcast

## Options Considered

### Option 1: Add `target` Field to Streams

Add an optional `target` field (array of participant IDs) to `stream/request`. If specified and non-empty, gateway delivers data frames only to those participants.

**Pros:**
- Simple, focused change
- Declared at stream creation (no subscription dance)
- Gateway handles routing transparently
- Backward compatible (missing/empty target = broadcast)
- Supports single target `["game-server"]` or multiple `["player1", "player2"]`
- Consistent with envelope `to` field semantics

**Cons:**
- Target list immutable after creation

### Option 2: Stream Subscription Mechanism

Add `stream/subscribe` and `stream/unsubscribe` messages. Participants explicitly subscribe to streams they want.

**Pros:**
- Fine-grained control per participant
- Dynamic subscription changes
- Participants choose what they receive

**Cons:**
- More complex protocol surface
- Requires subscription management
- Race conditions with late subscribers
- Overkill for aggregation pattern

### Option 3: Gateway-Level ACLs

Define who can receive each stream via access control lists.

**Pros:**
- Maximum flexibility
- Security-oriented

**Cons:**
- Heavy configuration overhead
- Mixes routing with security concerns
- Complex for simple use cases

### Option 4: Client-Side Filtering

Clients ignore streams they don't need. Gateway still broadcasts everything.

**Pros:**
- No protocol change
- Works today

**Cons:**
- Doesn't solve bandwidth problem
- Only reduces client CPU, not network
- Still O(N²)

## Decision

**ACCEPTED: Option 1 - Add `target` Field to Streams (as array)**

The `target` field approach provides the simplest solution to the O(N²) problem while maintaining backward compatibility and protocol simplicity. Using an array rather than a single string provides flexibility without additional complexity.

### Rationale

1. **Right fit for aggregation pattern**: The primary use case is N publishers → 1 aggregator. `target: ["game-server"]` expresses this cleanly.

2. **Handles middle ground**: Array supports N→1, N→2, N→few without separate mechanisms. Sending to 2 of 50 participants doesn't require broadcast.

3. **Consistent with `to` field**: Envelope addressing already uses arrays. Same semantics for stream targeting.

4. **Minimal protocol surface**: One optional array field vs. multiple new message kinds. Easier to implement, document, and understand.

5. **No subscription complexity**: Targets declared upfront. No race conditions, no subscription management, no cleanup on disconnect.

6. **Transparent to publishers**: Writers send frames as before. Gateway handles routing. No client-side changes required for basic use.

7. **Complements unified context**: Streams still exist and are visible (in `active_streams`). Only the data frames are routed efficiently. Coordination messages remain broadcast.

8. **Future compatible**: Dynamic target modification can be added later if needed.

## Sub-Decisions

### SD-1: Target Immutability

**Decision:** Target list cannot be changed after stream creation.

**Rationale:**
- Simplifies implementation and reasoning
- Avoids race conditions with in-flight frames
- If redirection needed, close and create new stream
- Matches how most routing is configured (at creation time)

### SD-1b: Array vs String Type

**Decision:** Use `string[]` (array) rather than `string` for target field.

**Rationale:**
- Consistent with envelope `to` field semantics
- Handles middle ground (2-3 targets) without broadcast overhead
- Single-element array `["x"]` is simple for common case
- More flexible without additional complexity
- Empty array `[]` clearly means broadcast (same as omitted)

### SD-2: Target Disconnect Behavior

**Decision:** When a target disconnects, frames continue to be delivered to remaining targets. Gateway MAY notify owner.

**Rationale:**
- Simplest approach - no buffering, no state management
- Partial delivery better than total failure
- Disconnected target can reconnect and resume receiving
- Owner notification optional for debugging but not critical
- Stream remains open; if all targets disconnect, frames are dropped until one reconnects

Alternative considered: Close stream on any target disconnect. Rejected because it disrupts the owner and other targets when one has a brief network blip.

### SD-3: Lifecycle Message Visibility

**Decision:** `stream/open` and `stream/close` messages remain broadcast. Only data frames are targeted.

**Rationale:**
- Lifecycle messages are infrequent (once per stream)
- Valuable for observability and debugging
- Late joiners need to know streams exist (via `active_streams`)
- Only high-frequency data frames need optimization

### SD-4: Target Validation

**Decision:** Gateway validates all targets exist at stream creation. Returns error listing any missing targets.

**Rationale:**
- Fail fast on misconfiguration
- Better developer experience than silent frame drops
- All targets must exist to receive frames
- Error includes list of which targets are missing

### SD-5: Self-Targeting

**Decision:** Owner can include themselves in target list.

**Rationale:**
- No reason to prohibit
- Useful for testing
- Combined with other targets, owner receives their own frames

## Consequences

### Positive

- **O(N) delivery for aggregation patterns**: Primary goal achieved
- **MEW Protocol becomes viable for game networking**: 50+ entity scalability possible
- **Flexible targeting**: Single target, multiple targets, or broadcast all supported
- **Consistent semantics**: Array type matches envelope `to` field
- **Minimal learning curve**: One new optional field
- **Backward compatible**: Existing code continues to work
- **Foundation for future features**: Dynamic target modification could build on this

### Negative

- **Target list immutable**: Cannot add/remove targets mid-stream (close and recreate)
- **Slight philosophy tension**: Targeted streams less "visible" than broadcast

### Neutral

- **Gateway complexity**: Routing check per frame, iterate over target list (minimal overhead)
- **Observability preserved**: Streams visible in `active_streams` even if data is targeted
- **Optional feature**: No impact on users who don't need it

## Implementation Notes

Gateway implementation is straightforward:

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
      // If target disconnected, skip it (frame dropped for that target)
    }
  } else {
    // Existing broadcast behavior
    for (const conn of space.connections.values()) {
      conn.send(data);
    }
  }
}
```

## Related Decisions

- **[j8v] Stream Visibility on Join**: Adds `active_streams` to welcome. t5d adds `target` field to that structure.
- **[s2w] Stream Write Grants**: Multi-writer streams. t5d applies regardless of who writes - all frames go to target.

## References

- MEW Protocol SPEC.md v0.4, Section 2.1 (Unified Context goal)
- MEW Protocol SPEC.md v0.4, Section 3.10 (Stream Lifecycle)
- t5d research.md (Prior art and alternatives analysis)
- Seacat decision-001-network-architecture.md (Driving use case)
