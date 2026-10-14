# [m2s] Design decisions and remaining questions

Status: revised proposal for review. The decisions below define the intended
shape; detailed interfaces and defaults still need review before implementation.

## D1. Compose modern primitives

Use existing workspace authentication/access and modern harness/provider tools,
permissions, sessions, and lifecycle APIs. MEW owns integration glue, not a blanket
replacement capability language, MCP resource mediation layer, or proposal engine.

Consequence: MEW cannot claim universal gateway control over every native tool
operation. Optional stronger integrations must identify their actual mechanism.

## D2. Three pieces

Separate workspace/runtime adapters; entity configuration, work scopes, sessions,
and worker placement; and participation policy. This keeps provider/platform
specifics and social behavior out of each other's contracts.

Remaining question: the smallest useful interface for each adapter, including
how permission prompts and unsupported lifecycle operations reach the operator.

## D3. Ordinary conversation is the coordination surface

Humans and entities use the same channel/topic/thread. A visible handoff can
prompt another entity to engage through its workspace adapter. Internal queues
and delivery receipts are acceptable; an unpublished peer task/result is not a
substitute conversation.

This applies between configured workspace entities. Native harness-internal
subagents/tools remain runtime implementation details unless explicitly exposed
as independent MEW entities; their internal exchanges are not newly standardized.

No mandatory public envelope, paired handshake, subthread protocol, or rigid
coordinator/worker role hierarchy is required. Optional structured helpers are
allowed only when their need and scope are explicit.

## D4. Work scope and channel mapping are first-class

Each scope has an explicit start/end, lifecycle generation, participating entities,
and workspace/channel/topic mapping. Scope rollover defines what happens to old
queues and late events. Routing cannot infer a new scope from whichever message
arrives most recently.

Remaining questions: exact start/end controls, drain/cancel/hold defaults, and
what evidence an adapter can expose for a channel's historical boundary.

## D5. Keep identity, session, context, and worker separate

The initial proposed session default is one continuing session per entity/scope
across compatible conversations. A thread is not automatically a new session.
Context-window compaction does not end a session or scope. Worker replacement
does not prove a session can be resumed or moved to another provider.

Remaining questions: provider-specific session retention/resume behavior,
compaction visibility, and which configurations need per-conversation isolation.

## D6. Scale within configured authority

The pool chooses eligible local or managed capacity within approved limits.
Scaling does not grant workspace access. Replicas of one entity need an explicit
single-active/concurrency policy; separate participants normally have separate
identities. Scope end must not imply unapproved deletion or credential revocation.

Remaining questions: minimum provider/pool status model, resource ceilings, and
what recovery choices can be automated for each supported runtime.

## D7. Participation is adaptable and evaluated

Use instructions, classifiers, messaging tools, and social norms to shape when an
entity engages, remains quiet, hands off, or seeks help. Actual authorization
continues to come from configured platforms and runtimes. Model coordination is
a hypothesis, with missed work, duplication, loops, and intervention measured.

Remaining questions: initial affinity/engagement defaults, evaluation tasks,
operational loop/noise limits, and acceptable tradeoffs between missed requests
and unnecessary turns. These should be learned through explicit evaluation.

## D8. Do not preserve old guarantees by implication

The old wire protocol's tool/proposal/capability mediation is not the default
foundation of this v2 direction. Complete native-tool observability, uniform
recovery, and universal session/interrupt semantics are not promised. V2 also
does not turn prompts into access control.

Remaining question: once this design is reviewed, choose versioning and any
migration bridge needed by existing implementations. No released wire identifier,
legacy compatibility promise, or automatic migration is established here.
