# [m2s] Mewpod v2 prototype and feedback

Status: exploratory implementation on a separate prototype branch; not a release
or live integration. See [setup and limits](../../../../prototypes/mewpod-v2/README.md).

## Bounded vertical slice

The prototype composes a local shared-conversation adapter, two deterministic
runtime adapters, entity/work-scope lifecycle, and a loopback work console. The
management service and mock secret resolver are separate callable boundaries.
No existing v0.4 gateway/tool mediation is reused as a new mandatory v2 layer.
The released protocol, CLI, SDK, and bridge specifications remain unchanged.

Configuration creates an identity without reserving compute. An ordinary
addressed message creates a task; bounded capacity starts it asynchronously.
Progress and handoffs publish under the entity identity. A peer sees the visible
message through the same adapter path. Final task completion requires matching
publication evidence. Human corrections remain in that shared conversation.

## What implementation clarified

1. **Applied configuration needs acknowledgment.** Saving desired revision is
   distinct from a runtime accepting it. A dedicated adapter acknowledgment
   keeps partial/refused updates from being reported as ready.
2. **Scope provenance must survive publication latency.** A scope can close while
   a publish is in flight. Internal scope/generation fields prevent a late commit
   from becoming work or context in a successor scope; they are not JSON that
   humans must write or a new public handshake.
3. **Publication readback needs exact matching.** Merely finding a valid message
   does not prove it is this entity's requested result in the right thread.
4. **Access is checked at dispatch, too.** A message admitted before a membership
   change cannot automatically run later. The prototype blocks changed audiences
   until explicit remapping; platforms remain responsible for actual access.
5. **Storage and cancellation can race with state changes.** Reserved capacity
   must be released if pre-start persistence fails. Cancellation must target the
   adapter that owns the active turn, not a newly desired runtime configuration.

These tests refine integration responsibilities; they do not settle the final
wire/API shape or prove equivalent behavior across providers. The local JSON
store retains the work record, closes old scopes after restart, and reports
interrupted work as uncertain. It is not a native-session recovery layer.

## Next review gate

Review the runnable local behavior and adapter boundaries before choosing a
first real runtime/workspace binding. Actual platform credentials, permissions,
model/provider calls, provisioning, and deployment remain separate decisions.
