# Ask: Targeted Stream Delivery

## Who Asked
RJ Corwin (MEW Protocol maintainer) - driven by Seacat game networking requirements

## What Was Asked
Add support for targeted stream delivery in MEW Protocol, where streams can optionally be delivered to a specific participant instead of broadcast to all.

## Context

### The Problem
MEW Protocol's current design broadcasts all stream data to all participants in a space. This is intentional per the spec's "Unified Context" goal (Section 2.1), but creates O(N²) message fan-out for high-frequency telemetry like game position updates.

With N entities publishing streams at R Hz:
```
Message deliveries/sec = N × R × (N-1)
```

At 6 entities × 10 Hz: 300 deliveries/sec (acceptable)
At 15 entities × 10 Hz: 2,100 deliveries/sec (problematic)
At 50 entities × 10 Hz: 24,500 deliveries/sec (unworkable)

### The Use Case
Seacat (a multiplayer game built on MEW Protocol) needs:
- Players to send position updates to a Game Server
- Game Server to aggregate and broadcast world state to all clients

Current architecture requires all player position streams to broadcast to everyone, even though only the Game Server needs them. This is wasteful and limits entity count.

### Proposed Solution
Add an optional `target` field to streams:
- If `target` is specified, gateway delivers stream data only to that participant
- If `target` is omitted/null, gateway broadcasts to all (existing behavior)

This enables:
```
Player streams (target: game-server) → Gateway → Game Server only [O(N)]
World state stream (no target) → Gateway → All clients [O(N)]
Total: O(N) instead of O(N²)
```

### Design Considerations
1. **Backward compatible** - No target = broadcast (existing behavior)
2. **Opt-in per stream** - Coordination messages still broadcast
3. **Specified at stream creation** - Via `stream/request` payload or space.yaml config
4. **Gateway enforced** - Target routing handled by gateway, transparent to participants

### Related Seacat Proposal
Full analysis in: `seacat/spec/proposals/n4s-network-scaling/decision-001-network-architecture.md`

This was selected as "Option I" after evaluating 9 different approaches to solving the O(N²) scaling problem.

## Deliverables Needed
1. `research.md` - Prior art, MEW Protocol philosophy considerations
2. `proposal.md` - Spec changes for targeted stream delivery
3. `decision-t5d-targeted-stream-delivery.md` - ADR documenting the decision
4. Implementation plan for gateway changes
