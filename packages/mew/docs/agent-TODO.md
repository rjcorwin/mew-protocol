# MEWAgent v0.4 Upgrade TODO

1. **Pause-aware chat and tool handling**  
   - Surface participant pause state to the agent runtime.  
   - Block reasoning/message streaming while paused and queue outbound work.  
   - Emit an appropriate `participant/status` or acknowledgement explaining the paused state.
2. **Restart cleanup for active streams**  
   - Track open reasoning stream identifiers.  
   - On `participant/restart`, cancel outstanding operations and emit `stream/close` before clearing local state.
3. **Graceful shutdown workflow**  
   - Implement `onShutdown` to mark the agent inactive, close streams, and send a final acknowledgement/status.  
   - Ensure the participant disconnects cleanly after cleanup.
4. **Participant compaction handshake**
   - Handle `participant/compact` control envelopes by invoking the compaction routine when available.
   - Emit `participant/compact-done` with reclaimed token/message counts or a `skipped` reason when nothing changed.
   - Ensure existing status updates (`compacting`/`compacted`) accompany both automatic and requested compactions.
5. **Status and telemetry validation**
   - Verify token/context tracking hooks emit the status transitions (`compacting`, `compacted`, `near_limit`) expected by operators.
   - Add regression coverage for context usage reporting.
6. **Automatic resume timeout support**
   - Observe `timeout_seconds` on pause requests and trigger a self-resume when the window elapses.
   - Confirm status updates reflect the resume event.
