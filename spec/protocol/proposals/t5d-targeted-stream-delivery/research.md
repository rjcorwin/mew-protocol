# Research: Targeted Stream Delivery

**Code:** t5d
**Created:** 2025-12-16

## Problem Statement

MEW Protocol's current stream design broadcasts all stream data to all participants. While this aligns with the "Unified Context" goal, it creates O(N²) message fan-out for high-frequency telemetry streams.

The math:
- N entities publishing streams at R Hz
- Each publish delivered to (N-1) recipients
- Total: N × R × (N-1) deliveries/second

At scale:
- 6 entities × 10 Hz: 300 deliveries/sec (acceptable)
- 15 entities × 10 Hz: 2,100 deliveries/sec (problematic)
- 50 entities × 10 Hz: 24,500 deliveries/sec (unworkable)

## MEW Protocol Philosophy Considerations

### The "Unified Context" Goal

From SPEC.md Section 2.1:
> **Unified Context**: All participants share the same visible stream of interactions

This goal drives MEW Protocol's broadcast-by-default design. The intent is transparency - all participants can observe all interactions, enabling:
- Audit trails
- Progressive automation (learning from observations)
- Debugging and monitoring
- AI agents observing human decisions

### When Broadcast Makes Sense

Broadcast is appropriate for:
- **Coordination messages** - Participants need shared context
- **Chat** - Everyone should see conversations
- **Proposals and fulfillment** - Transparency enables learning
- **System events** - Presence, errors, etc.

### When Broadcast Hurts

Broadcast becomes problematic for:
- **High-frequency telemetry** - Position updates, sensor data
- **Point-to-point data flows** - Player → Server aggregation
- **Large binary streams** - File transfers to specific recipient
- **Privacy-sensitive data** - Data intended for one participant

### The Tension

The O(N²) problem arises specifically when:
1. Multiple entities publish data frequently
2. Only one entity needs to consume each stream
3. All other recipients must process and discard

This is a classic aggregation pattern: N publishers → 1 aggregator → N consumers.

## Prior Art

### Traditional Game Networking

Game servers universally use targeted delivery:
- **Client → Server**: Player inputs sent only to server
- **Server → Clients**: World state broadcast to all

This is O(N) + O(N) = O(N), not O(N²).

Common patterns:
- **Authoritative server**: Clients send inputs, server validates and broadcasts state
- **Area of interest**: Only send data relevant to player's location
- **Relevance filtering**: Server decides what each client needs

### Pub/Sub Systems

Most messaging systems support targeted delivery alongside broadcast:
- **MQTT**: Topic-based routing with wildcards
- **RabbitMQ**: Direct exchanges for point-to-point, fanout for broadcast
- **Kafka**: Consumer groups for processing, broadcast via multiple consumers
- **Redis Pub/Sub**: Channel-based with subscription control

### WebRTC Data Channels

WebRTC explicitly supports:
- **Mesh**: All peers connect to all peers (O(N²))
- **SFU (Selective Forwarding Unit)**: Server routes selectively
- **MCU (Multipoint Control Unit)**: Server aggregates and broadcasts

SFU is the most common production pattern - selective forwarding based on need.

### Actor Model Systems

Actor systems (Akka, Orleans, Erlang) use targeted messaging:
- Messages sent to specific actor addresses
- Broadcast is explicit (send to all known actors)
- Natural fit for aggregation patterns

## Alternative Approaches Considered

### Stream Subscription (Rejected for t5d)

Add `stream/subscribe` and `stream/unsubscribe` messages:
- Participants explicitly subscribe to streams
- Gateway only delivers to subscribers

**Why not for t5d:**
- More complex protocol change
- Requires subscription management
- Overkill when target is known at stream creation
- Could be added later as complementary feature

### Client-Side Filtering (Insufficient)

Clients ignore streams they don't need:
- Gateway still broadcasts everything
- Bandwidth wasted
- Only reduces client CPU, not network

### Separate Transport (Complex)

Use different protocol for high-frequency data:
- Split client connections
- Complex client code
- Loses MEW Protocol benefits

### Gateway-Level ACLs (Heavy)

Define who can receive each stream via ACLs:
- More complex than single target
- Configuration overhead
- Better suited for security than efficiency

## Design Principles from Research

1. **Opt-in targeted delivery**: Preserve broadcast as default
2. **Declare target at stream creation**: No subscription dance
3. **Gateway enforcement**: Target routing transparent to participants
4. **Backward compatible**: Missing target = broadcast
5. **Per-stream choice**: Different streams can have different targets

## Key Insight: Aggregation Pattern

The driving use case is the **aggregation pattern**:
```
Publisher A ──┐
Publisher B ──┼──► Aggregator ──► All Consumers
Publisher C ──┘
```

In MEW Protocol terms:
- Publishers write streams targeted to aggregator
- Aggregator writes broadcast stream with combined data
- Total delivery: O(N) + O(N) = O(N)

This pattern appears in:
- Game position aggregation (players → game server → clients)
- Sensor data collection (sensors → collector → dashboards)
- Log aggregation (services → aggregator → monitors)
- Metrics collection (apps → metrics server → visualization)

## Recommendation

Add optional `target` field to streams. This:
- Preserves MEW Protocol philosophy for coordination
- Enables efficient aggregation patterns
- Minimal protocol surface change
- Natural extension of existing stream semantics

The key insight is that targeted delivery doesn't violate "unified context" - it's a routing optimization. The streams still exist, participants can still know about them (via `active_streams` in welcome), but the data flows efficiently to where it's needed.

## References

- MEW Protocol SPEC.md v0.4, Section 2.1 (Goals)
- MEW Protocol SPEC.md v0.4, Section 3.10 (Stream Lifecycle)
- Seacat decision-001-network-architecture.md (Options analysis)
- Glenn Fiedler's "Networking for Game Programmers" series
- MQTT Protocol Specification
- WebRTC SFU architectures
