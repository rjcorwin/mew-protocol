# [m2s] Catbox reference demo and feedback

Status: runnable reference demo on a separate prototype branch; not a release
or live integration. See [setup and limits](../../../../prototypes/mewpod-v2/README.md).

## Purpose of the reference

MEW's software has always been a way to express collaboration patterns and
requirements through concrete examples. Catbox makes those examples runnable,
inspectable, and easy to adapt or replace. It is successful when a reader can
identify the requirements and carry them into their own implementation; keeping
these classes or turning them into durable packages is not a requirement.

The [pattern guide and source map](../../../../prototypes/mewpod-v2/DESIGN.md)
connect scenarios to requirements and tests. The existing directory, internal
Mewpod names, commands, and data format remain compatible. Catbox names the demo,
not a new wire protocol or package contract.

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

## Questions to explore

Which collaboration requirements are clear in the runnable behavior? Which need
different examples? Which implementation choices would another harness or
workspace replace? Use the demo and tests to make those tradeoffs concrete.

A real runtime/workspace experiment is optional and requires its own evidence.
Actual platform credentials, permissions, model/provider calls, provisioning,
and deployment remain separate decisions.
