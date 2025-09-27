# MEWAgent Upgrade Assessment for MEW Protocol v0.4

## Scope of Review
- Read the released protocol spec and the CLI/spec drafts to inventory every envelope kind and control flow added in v0.4.【F:spec/v0.4/SPEC.md†L41-L108】【F:spec/draft/SPEC.md†L70-L150】
- Audited the TypeScript SDK packages (`types`, `participant`, `agent`, `client`), bridge, CLI gateway/UX, and existing tests for protocol drift or missing functionality against the v0.4 requirements.【F:sdk/typescript-sdk/types/src/protocol.ts†L21-L299】【F:sdk/typescript-sdk/participant/src/MEWParticipant.ts†L120-L879】【F:bridge/src/mcp-bridge.ts†L8-L337】【F:cli/src/commands/gateway.js†L235-L937】
- Reviewed prior notes in `sdk/typescript-sdk/agent/TODO.md` and previous upgrade research to align priorities and avoid duplication.【F:sdk/typescript-sdk/agent/TODO.md†L1-L34】

## SDK Gap Analysis

### `@mew-protocol/types`
- `Envelope.correlation_id` and `PartialEnvelope.correlation_id` still accept a string, but the v0.4 spec mandates an array in all envelopes.【F:sdk/typescript-sdk/types/src/protocol.ts†L21-L41】【F:spec/v0.4/SPEC.md†L41-L108】 Update the type signature (and downstream `d.ts`/`js`) to enforce `string[]`.
- `MessageKinds` retains legacy `mew/*` constants and omits new top-level kinds such as `capability/grant`, `participant/compact`, and `stream/*` that the spec lists as the minimal namespace.【F:sdk/typescript-sdk/types/src/protocol.ts†L268-L299】 Align the enum with the normative list in §3.1 and §3.9, and add payload interfaces for the new messages.【F:spec/v0.4/SPEC.md†L65-L108】【F:spec/v0.4/SPEC.md†L519-L968】
- Capability payload types (`MewCapabilityGrantPayload`, `MewCapabilityRevokePayload`) still model the v0.3 shape (`grant`, `from`, `to`) instead of the v0.4 structure that uses `recipient`, optional `grant_id`, pattern revocations, and `reason` fields.【F:sdk/typescript-sdk/types/src/protocol.ts†L142-L166】【F:spec/v0.4/SPEC.md†L549-L617】 Introduce proper interfaces for grant/revoke/grant-ack plus `space/invite`/`space/kick` payloads.
- `PresencePayload` allows `event: 'heartbeat' | 'update'`, but the v0.4 spec only blesses `join` and `leave`. Tighten the type or document the extension if we intend to keep `update`.【F:sdk/typescript-sdk/types/src/protocol.ts†L128-L136】【F:spec/v0.4/SPEC.md†L696-L719】

### `@mew-protocol/participant`
- Control dispatcher handles pause/resume/forget/clear/restart/shutdown but ignores `participant/compact` messages and never emits the mandatory `participant/compact-done`. Implement the request/ack handshake, including `skipped` reporting and reclaimed metrics per §3.9.6–3.9.7.【F:sdk/typescript-sdk/participant/src/MEWParticipant.ts†L963-L979】【F:spec/v0.4/SPEC.md†L919-L968】
- `send()` throws while paused which surfaces as unhandled rejections because most callers (e.g. `MEWAgent.emitReasoning`) do not await the promise. Add guard rails so paused sends queue or resolve gracefully, and ensure allowed kinds (status, cancel, compact-done) bypass the blockade.【F:sdk/typescript-sdk/participant/src/MEWParticipant.ts†L120-L128】【F:sdk/typescript-sdk/agent/src/MEWAgent.ts†L1454-L1493】
- Auto-resume on `timeout_seconds` silently clears `pauseState` without emitting the spec-required follow-up `participant/resume`. Add a timer to send the resume envelope (respecting capability checks) and a status update when the pause expires.【F:sdk/typescript-sdk/participant/src/MEWParticipant.ts†L817-L845】【F:spec/v0.4/SPEC.md†L808-L842】
- Restart/shutdown handlers delegate to subclass hooks but never close active reasoning streams or cancel pending work, leaving orphaned `stream/*` state on reset. Track active streams and emit `stream/close` before clearing context, and surface a final status or acknowledgement per §3.9.9-3.9.10.【F:sdk/typescript-sdk/participant/src/MEWParticipant.ts†L772-L782】【F:spec/v0.4/SPEC.md†L979-L1023】

### `@mew-protocol/agent`
- Chat handling and reasoning emission ignore the pause state: the agent still acknowledges, starts reasoning, and pushes stream frames even though the participant layer will reject the sends. Add a pause gate ahead of `handleChat`, `emitReasoning`, and tool execution so work is queued until resumed, matching §3.9.1 expectations.【F:sdk/typescript-sdk/agent/src/MEWAgent.ts†L330-L389】【F:sdk/typescript-sdk/participant/src/MEWParticipant.ts†L120-L128】
- `emitReasoning` fires `this.send()` without awaiting it, so pause-induced rejections turn into unobserved promise failures. Wrap sends in `try/await` and short-circuit when paused.【F:sdk/typescript-sdk/agent/src/MEWAgent.ts†L1454-L1493】
- Restarts and shutdowns only clear local state; they skip `stream/close`, do not cancel outstanding proposal/tool promises, and never emit a final status or acknowledgement. Extend the lifecycle hooks to close streams, cancel in-flight tasks, and optionally send a `chat/acknowledge` summarizing the reason before disconnecting.【F:sdk/typescript-sdk/agent/src/MEWAgent.ts†L1405-L1494】【F:spec/v0.4/SPEC.md†L988-L1023】
- Integrate the new compaction handshake so the agent responds to both orchestrator-initiated and self-initiated compactions with `participant/compact-done`, including reclaimed metrics to keep dashboards accurate.【F:spec/v0.4/SPEC.md†L919-L968】

### `@mew-protocol/client`
- `MEWClient.send` currently trusts any `correlation_id` supplied by callers. After tightening the shared types, add runtime normalization (coerce string → array) so older call sites do not send malformed envelopes while we refactor.【F:sdk/typescript-sdk/client/src/MEWClient.ts†L68-L124】

### `@mew-protocol/capability-matcher`
- No blocking spec deltas discovered; once capability payload shapes change, update the local `CapabilityPattern` type so downstream packages share the richer structure.【F:sdk/typescript-sdk/capability-matcher/src/types.ts†L1-L60】

## Bridge Gap Analysis
- Bridge still self-registers capabilities via `system/register` and emits `system/log`/`system/error`, violating the v0.4 rule that only the gateway may send `system/*` messages.【F:bridge/src/mcp-bridge.ts†L8-L337】【F:spec/v0.4/SPEC.md†L1134-L1138】 Replace registration with reliance on welcome + `capability/grant`, and route diagnostics through chat or participant/status.
- When capabilities change (via grants or config), ensure the bridge updates internal capability caches without attempting another `system/register`, and send the appropriate `capability/grant-ack` from the participant side instead of assuming the gateway will do so.

## CLI Gap Analysis
- Gateway bootstrap still injects `system/register` into every participant capability set and accepts incoming `system/register` envelopes, contradicting the reserved-namespace rule.【F:cli/src/commands/gateway.js†L235-L266】【F:cli/src/commands/gateway.js†L748-L802】【F:spec/v0.4/SPEC.md†L1134-L1138】 Remove the legacy flow and rely on configured capabilities plus explicit grants.
- The gateway fabricates `capability/grant-ack` messages on behalf of recipients; per §3.6.3, acknowledgements must originate from the participant that received the grant. Delete the synthetic ack and, if desired, surface a reminder to recipients instead.【F:cli/src/commands/gateway.js†L831-L937】【F:spec/v0.4/SPEC.md†L624-L636】
- Presence updates use `event: 'update'`, which is outside the spec. Either switch to a documented kind (e.g., a dedicated capability change message) or propose an ADR to extend the presence vocabulary.【F:cli/src/commands/gateway.js†L780-L799】【F:spec/v0.4/SPEC.md†L696-L719】
- Advanced interactive UI exposes `/status`, `/pause`, `/resume`, `/forget`, `/clear`, `/restart`, `/shutdown`, but lacks helpers to issue `participant/compact` or send a `participant/compact-done`. Add commands for the new control surfaces and ensure they set correlation IDs correctly.【F:cli/src/utils/advanced-interactive-ui.js†L1297-L1452】【F:spec/v0.4/SPEC.md†L919-L968】

## Test Coverage and Scenarios
- Add an integration scenario that exercises the compaction handshake: orchestrator sends `participant/compact`, agent runs compaction, emits interim `participant/status`, and completes with `participant/compact-done` including reclaimed metrics.
- Update gateway tests to confirm `system/register` is rejected and that capability grants now require recipient acknowledgements.
- Extend streaming tests to cover restart/shutdown cleanup (ensure `stream/close` is broadcast when an agent restarts mid-reasoning) and pause/resume queuing behavior.

## Summary Checklist
| Area | Spec Requirement | Current Status | Next Steps |
|------|------------------|----------------|------------|
| Types | Envelope + message kind schemas reflect v0.4 minimal set | ❌ Legacy types (`correlation_id` strings, `mew/*` kinds, outdated capability payloads) | Refactor types/exports and regenerate build artifacts |
| Participant base | Handle compaction, pause timeouts, lifecycle cleanup | ⚠️ No `participant/compact` handling, pause expiry silent, streams leak on restart | Implement compaction handshake, auto-resume, and stream/status cleanup |
| Agent runtime | Pause-aware reasoning + lifecycle hygiene | ⚠️ Still processes chats and streams while paused; restart/shutdown skip cleanup | Gate work on pause state, await sends, close streams, emit compact-done |
| Bridge | Adhere to gateway-owned `system/*` namespace | ❌ Sends `system/register`, `system/log`, `system/error` | Remove system messages, rely on grants, send participant-sourced acks |
| CLI gateway/UX | Enforce v0.4 capability flow + control tooling | ⚠️ Accepts legacy `system/register`, forges grant-acks, lacks compact controls | Purge legacy path, add compact commands, update presence semantics |
| Tests | Validate new control flows + cleanup | ⚠️ No scenario for compaction handshake or pause-aware reasoning | Add targeted scenarios and update existing expectations |
