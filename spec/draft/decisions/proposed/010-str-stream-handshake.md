# ADR-STR: Stream Handshake and Namespace

**Status:** Proposed
**Date:** 2025-09-17
**Context:** MEW Protocol Draft
**Incorporation:** Not Incorporated

## Context

The MEW Protocol currently treats the workspace as a single broadcast channel. Participants can emit discrete envelopes, but there is no negotiated mechanism for high-frequency or long-lived streams (e.g., multiplayer movement updates, audio/video feeds, incremental LLM tokens). Earlier discussions (see ADR-DSA) explored stream announcements, yet we still lack:

1. **Gateway Coordination** – the gateway cannot assign canonical stream identifiers or advertise them to the space, creating race conditions and name conflicts when multiple entities attempt similar streams.
2. **Namespace Consistency** – consumers need a predictable way to scope a stream inside a space. The request is to expose streams under `spaceId/streamId` so filtering or subscription logic remains aligned with existing MEW context semantics.
3. **Format Signalling** – participants ingesting a stream must know what is inside it (token text, positional updates, Opus audio, etc.) before committing resources. This is analogous to tool schemas: we want machine-readable descriptors of stream payloads.
4. **Lifecycle Events** – the protocol needs explicit transitions (intent → ready → live → complete) so implementations can provision buffers, capabilities and transport adapters.

## Options Considered

### Option 1: Ad-hoc Streams via Context Only
Allow participants to immediately emit `stream/data` envelopes and rely on the `context` field (e.g., `context: "space/stream"`) for discovery.

**Pros:**
- Zero additional handshake messages.
- Minimal gateway involvement.

**Cons:**
- Name collisions and inconsistent namespaces.
- No gateway acknowledgment or capability check before traffic begins.
- Consumers learn about streams only after data starts flowing.
- Impossible to reserve resources or validate formats in advance.

### Option 2: Participant-Managed Stream IDs
Have creators choose a unique `stream_id`, announce it with `stream/start`, and consider the gateway a dumb relay.

**Pros:**
- Simple gateway implementation.
- Immediate backwards compatibility with current message routing.

**Cons:**
- Still prone to collisions and spoofing.
- No guarantee of canonical `spaceId/streamId` names.
- Gateway cannot apply policy (quota, capability, auditing) before a stream becomes active.

### Option 3: Gateway-Mediated Stream Handshake (Chosen)
Introduce a three-step handshake: creator announces intent, gateway validates and replies with an assigned identifier, creator confirms readiness. Streams are represented as `spaceId/streamId` namespaces and carry structured format descriptors.

**Pros:**
- Deterministic namespaces issued by the gateway.
- Capability checks happen before activation.
- Consumers learn about new streams via gateway broadcast.
- Structured format descriptors allow automated routing and subscription.
- Supports future gateway features (throttling, history, replication).

**Cons:**
- Requires gateway state for active streams.
- Adds latency before the first data packet.
- Implementations must understand new envelope kinds.

## Decision

Adopt Option 3. MEW Protocol will add a mediated handshake for streams with the following envelope kinds:

- `stream/announce` – Creator declares intent and desired characteristics.
- `stream/ready` – Gateway response containing the assigned `stream_id` and namespace.
- `stream/start` – Creator confirms streaming has begun.
- `stream/data` – Payload envelopes scoped to the stream namespace.
- `stream/complete` – Creator indicates an orderly end of the stream.
- `stream/error` – Gateway or creator reports stream failure.

All stream envelopes share a `payload.stream` object that includes metadata and the canonical namespace.

### Handshake Sequence

1. **Announce** (`stream/announce`, from creator → broadcast)
   - `payload.intent` (optional string) describing purpose.
   - `payload.formats[]` describing the data shapes (see below).
   - `payload.desired_id` (optional hint for human-friendly aliases).
   - `payload.scope` (optional list) of participants who should be notified directly.
2. **Ready** (`stream/ready`, from `system:gateway` → broadcast)
   - Contains `payload.stream.stream_id` (gateway-assigned unique ID).
   - Includes `payload.stream.namespace` as `"${spaceId}/${streamId}"`.
   - Echoes formats and metadata; may include `payload.stream.capabilities` (read/write tokens).
3. **Start** (`stream/start`, from creator → broadcast)
   - References the `stream_id` and asserts the stream is now live.
   - MAY include `payload.start_ts` for precise activation timing.
4. **Data** (`stream/data`, creator or authorized writers → broadcast)
   - Must carry `payload.stream.stream_id` and `payload.sequence` (monotonic integer).
   - `payload.content` holds the actual sample/chunk.
   - `payload.format_id` points to one of the announced formats.
5. **Complete/Error** (`stream/complete` or `stream/error` → broadcast)
   - Signals normal termination or failure reason.

### Format Descriptors

Each entry in `payload.formats` mirrors tool schema metadata:

```json
{
  "id": "movement/2d",
  "description": "Normalized XY positions for a multiplayer session",
  "mime_type": "application/json",
  "schema": {
    "type": "object",
    "properties": {
      "entity": { "type": "string" },
      "position": {
        "type": "object",
        "properties": {
          "x": { "type": "number" },
          "y": { "type": "number" }
        }
      },
      "orientation": { "type": "number" }
    },
    "required": ["entity", "position"]
  }
}
```

Implementations may advertise multiple formats (e.g., `audio/opus`, `audio/transcript`, `llm/tokens`, `metrics/token-count`).

### Capability Model

- `stream/manage` – Can announce or complete streams.
- `stream/write:{streamId}` – Granted dynamically after `stream/ready` if the gateway wishes to authorize additional writers.
- `stream/read:{streamId}` – Optional capability for consumers (default broadcast remains visible, but capability gates may be applied in future versions).

The gateway MUST validate that the announcing participant has `stream/manage` (or a broader wildcard) before replying with `stream/ready`.

## Implementation Details

- Streams are tracked server-side with metadata (creator, namespace, formats, status).
- Gateway broadcasts `stream/ready` so all participants learn the namespace before data flows.
- All subsequent stream envelopes MUST include `payload.stream.namespace` so observers can filter by prefix.
- The `context` field MAY mirror the namespace (`context: "${spaceId}/${streamId}"`) to support existing filtering mechanisms.
- Sequence numbers are creator-assigned monotonic integers; gaps imply loss and allow consumers to detect drops.
- `stream/error` payloads include a mandatory `code` and `message` for diagnostics.
- The gateway may recycle IDs after `stream/complete`.

## Consequences

### Positive
- Deterministic `spaceId/streamId` namespaces enable tooling and UI to group stream traffic.
- Advanced consumers can subscribe to specific format IDs and prepare codecs upfront.
- Gateway-managed lifecycle allows enforcement of quotas and auditing of stream usage.
- Aligns stream metadata with existing tool schema patterns, enabling reuse of validation libraries.

### Negative
- Requires additional gateway bookkeeping and state synchronization.
- Introduces more message kinds for all implementations to understand.
- Adds a round trip before the first data packet, which may impact ultra-low-latency use cases.

