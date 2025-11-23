# Decision Record: Stream Visibility on Join (j8v)

## Status

Draft

## Context

MEW Protocol supports streaming large volumes of data through the stream lifecycle pattern (`stream/request`, `stream/open`, stream data frames, `stream/close`). The gateway tracks active streams in a Map that stores metadata about each stream.

When a participant joins a space, they receive a `system/welcome` message containing:
- Their own ID and capabilities
- List of other participants and their capabilities

However, the welcome message does **not** include information about active streams. This means:
- Participants who join mid-stream have no context for incoming data frames
- Late joiners cannot distinguish stream ownership or purpose
- The protocol violates its "Unified Context" goal

## Decision

We will add an `active_streams` array to the `system/welcome` message payload.

**Rationale:**
1. **Consistency with welcome pattern**: Welcome messages provide initial state snapshots (participants, capabilities). Streams are part of space state.
2. **Minimal implementation**: Gateway already tracks all needed metadata in `space.activeStreams`.
3. **Backward compatibility**: New field is optional; old clients ignore it.
4. **Unified context**: New joiners get complete visibility into ongoing activities.

## Alternatives Considered

### Alternative 1: Replay stream/open Messages
Rejected because:
- Creates misleading correlation chains (stream/open without corresponding stream/request)
- Confuses audit logs with duplicate events
- Violates semantic meaning of stream/open

### Alternative 2: Add stream/list Request Message
Rejected because:
- Over-engineering (all participants need this info on join)
- Extra round-trip on connection
- More protocol complexity for no benefit

### Alternative 3: Document as Limitation
Rejected because:
- Violates core protocol goal (Unified Context)
- No reasonable workaround
- Poor developer experience

## Consequences

### Positive
- New participants have complete visibility on join
- Consistent with MEW Protocol transparency goals
- Simple to implement (gateway already has the data)
- Backward compatible

### Negative
- Adds small overhead to welcome message (typically minimal - most spaces have 0-2 active streams)
- Clients need updates to benefit (though optional)

### Neutral
- Sets precedent for including ephemeral state in welcome messages
- Future state types (e.g., active reasoning contexts) might follow same pattern

## Implementation Notes

**Gateway changes:**
- Extract stream metadata from `space.activeStreams` Map
- Format as array and include in welcome payload
- Estimated effort: ~10 lines of code

**Client changes (optional enhancement):**
- Process `active_streams` if present
- Emit events for UI awareness
- Estimated effort: ~5 lines of code

**Spec changes:**
- Update Section 3.8.1 with new field definition
- Add example showing active streams

## Date

2025-11-22

## Deciders

RJ Corwin

## Tags

protocol, streams, welcome-message, visibility, unified-context
