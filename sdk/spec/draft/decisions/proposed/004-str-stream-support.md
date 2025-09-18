# ADR-STR: SDK Stream Support

**Status:** Proposed
**Date:** 2025-09-17
**Context:** MEW SDK Draft
**Incorporation:** Not Incorporated

## Context

The MEW Protocol now defines a gateway-mediated stream handshake (`stream/announce → stream/ready → stream/start`) plus runtime envelopes (`stream/data`, `stream/complete`, `stream/error`). The TypeScript SDK currently exposes raw envelopes through `MEWClient` without any dedicated helpers. Implementers must:

- Manually correlate announcements with `stream/ready` replies to learn the assigned namespace.
- Track per-stream metadata (status, formats, last sequence) themselves.
- Build convenience APIs for emitting sequenced `stream/data` packets.
- Wire up event listeners for `stream/*` envelopes to drive agents.

Without first-class support, every client repeats the same bookkeeping, increasing bug risk (missing namespace context, sequence regressions, or ignoring stream termination).

## Options Considered

### Option 1: Leave Streams to Application Code
Expose raw envelopes only; developers build their own abstractions.

**Pros:**
- No SDK changes.
- Maximum flexibility for edge cases.

**Cons:**
- Duplicated handshake/registry logic across projects.
- High risk of inconsistent namespace handling.
- Difficult for new users to adopt stream features.

### Option 2: Minimal Event Forwarding
Have `MEWClient` emit `stream/*` events but keep registry/handshake out of scope.

**Pros:**
- Small implementation effort.
- Backward compatible with existing code.

**Cons:**
- Still leaves hard parts (handshake correlation, sequence tracking) to applications.
- No convenience methods for producers.

### Option 3: Full SDK Stream Abstractions (Chosen)
Extend all SDK layers to understand stream lifecycle:
- `MEWClient` maintains a stream registry and emits high-level events.
- `MEWParticipant` provides promise-based helpers for announcing, starting, and emitting stream data with automatic sequence management.
- `MEWAgent` consumes registry updates for logging, reasoning, and future automation.

**Pros:**
- Centralizes handshake logic and sequence tracking.
- Reduces boilerplate for both producers and consumers.
- Aligns SDK behaviour with the protocol specification.
- Establishes consistent telemetry for tools/tests.

**Cons:**
- More code surface area to maintain.
- Requires API additions that must remain stable.

## Decision

Adopt Option 3. The SDK will treat streams as first-class citizens:

- `MEWClient` keeps an in-memory registry of known streams keyed by `stream_id`, updates lifecycle state as envelopes arrive, normalises namespace information, and exposes helper events (`onStreamReady`, `onStreamData`, etc.).
- `MEWParticipant` offers producer utilities (`announceStream`, `startStream`, `sendStreamData`, `completeStream`) and consumer helpers (`getStream`, `listStreams`) built atop the client registry. Announcement helpers resolve once the gateway responds with `stream/ready` and automatically manage sequence counters.
- `MEWAgent` subscribes to the participant stream events for logging and future reasoning decisions, ensuring autonomous agents are aware of live telemetry feeds.

## Implementation Details

### MEWClient
- Maintain `Map<string, StreamRecord>` with fields: `stream_id`, `namespace`, `creator`, `status`, `formats`, `capabilities`, `intent`, `scope`, `lastSequence`, timestamps.
- Update registry on `stream/ready`, `stream/start`, `stream/data`, `stream/complete`, `stream/error`. Ensure incoming envelopes always include canonical namespace when emitted to subscribers.
- Emit dedicated events (`'stream/ready'`, `'stream/start'`, `'stream/data'`, `'stream/complete'`, `'stream/error'`), plus a convenience accessor `getStream(streamId)` and `listStreams()`.

### MEWParticipant
- Store pending announcement promises keyed by envelope ID. Resolve when matching `stream/ready` arrives (via `correlation_id`). Time out by default after configurable period.
- Provide:
  - `announceStream(options)` → `Promise<StreamHandle>` returning assigned `stream_id`, namespace, formats, and metadata.
  - `startStream(streamId, options)` to emit `stream/start`.
  - `sendStreamData(streamId, content, options)` with optional explicit sequence; falls back to auto-increment.
  - `completeStream(streamId, options)` and `failStream(streamId, error)` convenience methods.
- Track producer sequence numbers per stream and reset when stream completes or errors.

### MEWAgent
- Subscribe to stream events in `setupAgentBehavior`, logging lifecycle transitions at info/debug levels.
- Make the internal reasoning loop aware of live streams for future planning (initial implementation logs and caches registry entries).

## Consequences

### Positive
- Developers get a consistent, batteries-included API for creating and consuming streams.
- Registry state can be surfaced in diagnostics, tests, and higher-level tooling.
- Encourages correct namespace usage and sequence monotonicity through shared helpers.

### Negative
- Slightly increases memory footprint (registry cache) for long-lived clients.
- Requires documentation and versioning of the new APIs.
- Future protocol changes to streaming will necessitate SDK updates to stay in sync.

