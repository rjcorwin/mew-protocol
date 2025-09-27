# MEWAgent Upgrade Assessment for MEW Protocol v0.4

## Scope of Review
- Compared MEW Protocol v0.4 specification against v0.3 with emphasis on new participant control envelopes (`participant/pause`, `participant/resume`, `participant/request-status`, `participant/status`, `participant/forget`, `participant/compact`, `participant/compact-done`, `participant/clear`, `participant/restart`, `participant/shutdown`).【F:spec/v0.4/SPEC.md†L893-L1023】【F:spec/v0.3/SPEC.md†L44-L107】
- Audited current `MEWAgent` implementation to determine coverage of these behaviors, focusing on runtime telemetry, pause/resume handling, and lifecycle management.【F:sdk/typescript-sdk/agent/src/MEWAgent.ts†L300-L405】【F:sdk/typescript-sdk/agent/src/MEWAgent.ts†L1323-L1497】【F:sdk/typescript-sdk/participant/src/MEWParticipant.ts†L120-L138】【F:sdk/typescript-sdk/participant/src/MEWParticipant.ts†L720-L810】

## High-Priority Gaps

### 1. Respecting `participant/pause` While Processing Chats
- **Spec expectation:** Paused participants should halt outbound work except acknowledgements/cancellations until resumed.【F:spec/v0.4/SPEC.md†L808-L842】
- **Current behavior:** `handleChat` immediately emits reasoning events and attempts to send chat responses without checking pause state. When `MEWParticipant.send` rejects because the participant is paused, `MEWAgent` still runs reasoning loops and retries responses, resulting in repeated errors and potential unhandled rejections from `emitReasoning` (which does not await `send`).【F:sdk/typescript-sdk/agent/src/MEWAgent.ts†L350-L388】【F:sdk/typescript-sdk/agent/src/MEWAgent.ts†L1449-L1497】【F:sdk/typescript-sdk/participant/src/MEWParticipant.ts†L120-L138】
- **Needed work:**
  - Surface pause state to `MEWAgent` (e.g., protected accessor or event) so it can short-circuit chat handling, reasoning, and tool calls while paused.
  - Ensure queued messages remain pending until resume, and emit a `participant/status` (or `chat/acknowledge`) explaining the pause if appropriate.
  - Guard streaming helpers (`emitReasoning`, `pushReasoningStreamChunk`) to avoid kicking off new streams while paused and to prevent unhandled promise rejections when `send` is blocked.

### 2. Cleaning Up Streams and Workflows on `participant/restart`
- **Spec expectation:** Restarting should terminate outstanding workflows and streams.【F:spec/v0.4/SPEC.md†L988-L1004】
- **Current behavior:** `onRestart` simply calls `onClear` and the superclass implementation; `onClear` discards local state but does not close an active reasoning stream or send `stream/close`. Any open stream created for reasoning will be left dangling on restart, violating the spec and leaking resources.【F:sdk/typescript-sdk/agent/src/MEWAgent.ts†L1397-L1444】
- **Needed work:**
  - Track active stream IDs and emit `stream/close` during restart before clearing state.
  - Consider notifying orchestrators via `participant/status` that a restart reset state and streams.

### 3. Graceful Handling of `participant/shutdown`
- **Spec expectation:** Participants should acknowledge shutdown (chat ack or presence leave) and cease activity after completing cleanup.【F:spec/v0.4/SPEC.md†L1007-L1023】
- **Current behavior:** Base class reports status and disconnects, but `MEWAgent` has no `onShutdown` override. The agent never toggles `isRunning`, does not ensure outstanding reasoning/tool operations are cancelled, and may leave streams unclosed similar to the restart case.【F:sdk/typescript-sdk/agent/src/MEWAgent.ts†L68-L108】【F:sdk/typescript-sdk/agent/src/MEWAgent.ts†L1397-L1444】
- **Needed work:**
  - Implement `onShutdown` to set `isRunning = false`, cancel reasoning/tool tasks, close any open streams via `stream/close`, and optionally emit a `chat/acknowledge` with the shutdown reason before disconnecting.
  - Verify that the gateway emits the final `system/presence` leave event after the custom cleanup.

### 4. Compaction Handshake for `participant/compact`
- **Spec expectation:** When orchestrators issue `participant/compact`, participants SHOULD attempt to reclaim context, broadcast interim status, and MUST follow up with `participant/compact-done` (or a skipped acknowledgement) so controllers know the request is resolved.【F:spec/v0.4/SPEC.md†L893-L968】
- **Current behavior:** `MEWAgent` already performs automatic compaction via `ensureContextHeadroom`/`compactConversationHistory`, yet the control dispatcher never invokes these helpers when a compaction request arrives and does not emit `participant/compact-done`. The participant base class likewise lacks handlers for the new envelopes.【F:sdk/typescript-sdk/agent/src/MEWAgent.ts†L1342-L1379】【F:sdk/typescript-sdk/participant/src/MEWParticipant.ts†L830-L979】
- **Needed work:**
  - Extend `MEWParticipant`/`MEWAgent` to recognize `participant/compact`, trigger the compaction routine when available, and respond with `participant/compact-done` (including `skipped` metadata when nothing changes).
  - Ensure the existing status transitions (`compacting`/`compacted`) continue to publish during both automated and requested compactions so observers retain visibility.

## Additional Considerations (Lower Priority)
- **Telemetry completeness:** Context usage counters (`tokens`, `messages_in_context`) are already wired through `recordContextUsage`, `ensureContextHeadroom`, and compaction hooks, but we should validate that proactive `participant/status` updates include the status strings (`compacting`, `compacted`, `near_limit`) expected by operators.【F:sdk/typescript-sdk/agent/src/MEWAgent.ts†L1323-L1360】【F:sdk/typescript-sdk/participant/src/MEWParticipant.ts†L648-L720】 No code changes identified yet, but regression tests around these flows would be valuable.
- **Pause timeout auto-resume:** The spec allows `timeout_seconds` to trigger automatic resumption; the base class tracks `until` but `MEWAgent` currently lacks logic to broadcast a `participant/resume` when the timeout elapses. Evaluate whether this should be implemented in the agent or the shared participant layer.【F:spec/v0.4/SPEC.md†L808-L842】【F:sdk/typescript-sdk/participant/src/MEWParticipant.ts†L720-L810】

## Summary Checklist
| Capability | Spec Requirement | Current Status | Next Steps |
|------------|------------------|----------------|------------|
| Pause/Resume | Halt work while paused, resume cleanly | ⚠️ Paused agents still process chats and emit reasoning/streams | Add pause-awareness to chat/reasoning pipeline and guard stream emission |
| Restart | Terminate workflows & streams before reset | ⚠️ Active reasoning streams left open | Close streams, cancel work, emit status before clearing |
| Shutdown | Acknowledge & cleanly stop | ⚠️ No agent-level shutdown hook, streams/tasks may linger | Implement `onShutdown` cleanup + optional ack |
| Compaction Handshake | Respond to `participant/compact` and acknowledge with `participant/compact-done` | ⚠️ Control dispatcher ignores compact envelopes despite internal auto-compaction | Handle new control messages, trigger compaction, emit acknowledgement/status |

Addressing the high-priority items above should bring MEWAgent in line with the MEW Protocol v0.4 control semantics.
