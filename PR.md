# Spec Backfill Notes

## Areas audited
- `spec/protocol/SPEC.md`
- `src/client/MEWClient.ts`
- `src/participant/MEWParticipant.ts`
- `spec/sdk/SPEC.md`

## Discrepancies found (before fix)
- **MEWClient handshake and envelope normalization**: Implementation auto-generates participant IDs, sends a `{type: "join"}` handshake, and normalizes envelopes (including enforcing `correlation_id` arrays). The SDK spec omitted these runtime behaviors.
- **Stream handling APIs**: Code exposes `sendStreamData()` (accepting strings or buffers) and an `onStreamData()` helper that surfaces decoded frames, plus emits `stream/data` events. The spec only mentioned raw events without listing the helper signatures.
- **Participant tool discovery return type**: `discoverTools()` and `getAvailableTools()` return objects annotated with `participantId`, `description`, and `inputSchema`. The spec still described plain `Tool[]` results and lacked the `DiscoveredTool` structure.
- **Proposal lifecycle helpers**: Runtime exposes `withdrawProposal()` and automatically withdraws timed-out proposals. Neither helper nor timeout behavior were captured in the spec.
- **Chat helpers and formatting**: Implementation supports markdown via a `format` parameter, defaults `acknowledgeChat()` status to `"received"`, and allows broadcast acknowledgements. Spec only referenced the helpers conceptually.
- **Pause enforcement**: Code suppresses (warns + drops) outbound traffic while paused instead of throwing. Spec stated it would throw.
- **Participant telemetry/stream helpers**: Public methods `requestParticipantStatus()`, `requestStream()` (returning the request ID), and participant-level `sendStreamData()` exist in code but were absent from the spec interface.

## Resolution
- Updated `spec/sdk/SPEC.md` to document the runtime behaviors above, expanding interface signatures and explanatory text so the SDK spec now matches the shipped code.
