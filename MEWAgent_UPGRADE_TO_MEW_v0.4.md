# MEWAgent Upgrade Assessment for MEW Protocol v0.4

## Scope of Review
- Read the released protocol spec and the CLI/spec drafts to inventory every envelope kind and control flow added in v0.4.【F:spec/v0.4/SPEC.md†L41-L108】【F:spec/draft/SPEC.md†L70-L150】
- Audited the TypeScript SDK packages (`types`, `participant`, `agent`, `client`), bridge, CLI gateway/UX, and existing tests for protocol drift or missing functionality against the v0.4 requirements.【F:packages/mew/src/types/protocol.ts†L21-L299】【F:packages/mew/src/participant/MEWParticipant.ts†L120-L879】【F:bridge/src/mcp-bridge.ts†L8-L337】【F:cli/src/commands/gateway.js†L235-L937】
- Reviewed prior notes in `packages/mew/src/agent/TODO.md` and previous upgrade research to align priorities and avoid duplication.【F:packages/mew/src/agent/TODO.md†L1-L34】

## SDK Gap Analysis

### `@mew-protocol/mew/types`
- ✅ `Envelope`/`PartialEnvelope` now enforce array `correlation_id`, and the message-kind catalog matches the v0.4 namespace. Payload types for capability and space management were expanded to the current schema, with legacy aliases preserved for gradual upgrades.【F:packages/mew/src/types/protocol.ts†L21-L348】
- ✅ Presence payloads now follow the spec’s `join`/`leave` vocabulary, eliminating the unofficial `update`/`heartbeat` entries.【F:packages/mew/src/types/protocol.ts†L121-L126】

### `@mew-protocol/mew/participant`
- ✅ Participant base now handles `participant/compact`/`participant/compact-done`, suppresses outbound traffic while paused, emits auto-resume events when timeouts elapse, and closes active streams on restart/shutdown in line with §3.9.【F:packages/mew/src/participant/MEWParticipant.ts†L120-L894】

### `@mew-protocol/mew/agent`
- ✅ Agent runtime now gates work while paused, awaits reasoning emissions, closes reasoning streams during lifecycle events, and responds to `participant/compact` with detailed `participant/compact-done` payloads.【F:packages/mew/src/agent/MEWAgent.ts†L320-L1428】

### `@mew-protocol/mew/client`
- 🔄 Follow-up: evaluate whether `MEWClient.send` should coerce legacy `correlation_id` strings now that the type signature enforces arrays, or whether callers should be required to update first.【F:packages/mew/src/client/MEWClient.ts†L68-L124】

### `@mew-protocol/mew/capability-matcher`
- No blocking spec deltas discovered; once capability payload shapes change, update the local `CapabilityPattern` type so downstream packages share the richer structure.【F:packages/mew/src/capability-matcher/types.ts†L1-L60】

## Bridge Gap Analysis
- ✅ Bridge no longer attempts `system/register` or other `system/*` emits; it now uses chat/status updates for diagnostics and treats gateway capabilities as authoritative.【F:bridge/src/mcp-bridge.ts†L8-L337】
- 🔄 Track outstanding capability grants to verify recipients issue their own acknowledgements (future enhancement for monitoring rather than gateway-sent acks).

## CLI Gap Analysis
- ✅ Gateway no longer accepts `system/register`, stops forging `capability/grant-ack`, and relies on static/granted capabilities while still refreshing welcome payloads for recipients.【F:cli/src/commands/gateway.js†L259-L940】
- ✅ Presence updates remain limited to join/leave, and the advanced UI gained `/compact` plus display of `participant/compact-done` summaries.【F:cli/src/utils/advanced-interactive-ui.js†L520-L1480】
- 🔄 Future improvement: enrich logs or health endpoints with capability change events now that presence updates no longer carry them.

## Test Coverage and Scenarios
- ✅ Scenario 13 now verifies `participant/compact` handshake and pause auto-resume alongside restart/clear/shutdown.
- ✅ Added gateway coverage: Scenario 4 now checks `system/register` rejection and Scenario 8 verifies participant-authored `capability/grant-ack` messages.
- 🔄 Consider an agent-focused test that exercises restart-driven `stream/close` emission under active reasoning.

## Summary Checklist
| Area | Spec Requirement | Current Status | Next Steps |
|------|------------------|----------------|------------|
| Types | Envelope + message kind schemas reflect v0.4 minimal set | ✅ Updated for v0.4 with legacy aliases retained | Monitor downstream package upgrades |
| Participant base | Handle compaction, pause timeouts, lifecycle cleanup | ✅ Pause-aware sending, compaction handshake, lifecycle stream cleanup | Follow-on: expose telemetry hooks for richer analytics |
| Agent runtime | Pause-aware reasoning + lifecycle hygiene | ✅ Chat queueing, awaited reasoning, compact-done responses | Add dedicated regression covering pause queue drainage |
| Bridge | Adhere to gateway-owned `system/*` namespace | ✅ No participant-originated `system/*`; diagnostics via chat/status | Optional: surface capability grants in status feed |
| CLI gateway/UX | Enforce v0.4 capability flow + control tooling | ✅ Rejects `system/register`, removes forged acks, adds `/compact` UI | Add CLI feedback when capability acknowledgements are missing |
| Tests | Validate new control flows + cleanup | ✅ Scenarios 4, 8, and 13 cover system-level controls, grant handshakes, and compaction/pause flows | Explore lighter-weight gateway unit tests for deeper capability auditing |
