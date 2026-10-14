# MEW v2 draft: multi-entity workspace integration

Status: **revised design contract for review; not a released wire protocol or
implementation**. This draft replaces the earlier control-plane-centered proposal.
The existing released specification remains unchanged.

MUST, SHOULD, and MAY below describe candidate integration requirements. They do
not imply that an adapter or provider already implements a capability.

## 1. Purpose and boundary

MEW connects shared human workspaces to autonomous entities running in modern
agent harnesses. Humans and entities communicate in the same ordinary channels,
topics, and threads. MEW's job is to connect those conversations to suitable
runtimes, manage entity/work-scope lifecycle, and support useful participation.

A developer machine running an orchestrator and several tmux-managed sessions
can establish that collaboration works, while remaining limited by that host's
compute and memory. A core motivation is demand-driven elasticity: add seats
when more work needs them and release capacity when demand falls. Replaceability
alone is not demand-driven scaling. Local-first operation remains useful, and
provider choice stays behind interchangeable adapters subject to actual cost,
quota, and availability constraints. No affordability or competition forecast is
part of this design.

Recovery is a nice-to-have capability of an underlying runtime/provider, outside
MEW's own problem to solve. MEW does not define a checkpoint, retained-state,
reconstruction, or failover system. It reports supported continuation and failure
limits accurately while focusing on higher-layer collaboration glue and scaling.

The design consists of three pieces:

1. Pluggable **workspace/runtime adapters**.
2. **Entity configuration, work scopes, session policy, and worker placement**.
3. A **participation model** using instructions, classifiers, messaging tools,
   and social conventions.

MEW is not, by default, a replacement permission system, tool execution gateway,
MCP resource mediator, or universal approval/proposal engine. The configured
workspace, harness, and provider remain the enforcement boundaries for their
own identities, access, tools, and operations. An integration MUST NOT claim that
participation instructions provide a security boundary.

MEW does not require a new public message envelope, request/ack/result handshake,
private coordination bus, or special subthread structure. Adapters can normalize
records internally without turning an internal record into a hidden conversation
or a new source of authority.

## 2. Terms that must remain distinct

- **Entity:** a configured participant with a stable identity and role. It may be
  backed by an agent runtime; humans remain ordinary workspace participants.
- **Workspace:** a collaboration service/account and its accessible surfaces.
- **Conversation:** an ordinary channel, topic, thread, or equivalent surface.
- **Work scope:** an explicitly started and ended period of related work. A
  sprint, project phase, or bounded assignment is an example.
- **Runtime session:** the harness/provider handle for continuing one entity's
  execution and conversation state.
- **Context window:** the finite information available to a model invocation.
  It can change or be compacted without ending the runtime session or work scope.
- **Worker:** a local process/host slot or managed execution allocation capable
  of running a runtime. A worker is not the entity identity or its session.
- **Participation policy:** the configured instructions and mechanisms used to
  choose engagement, silence, or handoff inside an authorized workspace.

A stable entity ID does not imply a permanent worker, infinite context, or a
portable provider session. A new thread does not imply a new entity or session.

## 3. Piece one: adapter interfaces

### 3.1 Workspace adapter

A workspace adapter SHOULD expose the following conceptual operations. These
are interface responsibilities, not a prescribed SDK or wire schema:

- Discover/read the conversations the configured account can actually access.
- Observe new messages and relevant changes with platform identity and references.
- Read conversation history with pagination, provenance, and explicit gaps.
- Send/reply under the configured entity's verified platform identity.
- Report delivery evidence, platform errors, and uncertain publication outcomes.
- Stop observation for a closed or revoked work-scope mapping.

An observed message MUST carry enough information to identify its workspace,
conversation/thread, source message/revision, author, and observation time. The
adapter MUST distinguish verified platform fields from author-written text.
These internal fields do not require humans or agents to author protocol JSON.

Slack and Discourse illustrate different conversation structures and bot/user
capabilities. Their adapters MUST declare the mapping and access available on
that platform instead of assuming every platform behaves like a Slack thread.

### 3.2 Runtime adapter

A runtime adapter SHOULD expose, where supported:

- Create or attach to a session using approved entity configuration.
- Deliver selected conversation input and relevant context to that session.
- Observe output, status, tool/permission prompts, and terminal outcomes.
- Provide messaging tools that publish to the configured workspace.
- Queue, steer, cancel, pause, resume, or close only with the semantics the
  harness/provider actually supports.

Every adapter MUST describe its support and limits for session persistence,
concurrency, context/compaction visibility, interruption, tool permissions,
outcome lookup, and movement between workers. Unsupported means unsupported;
queueing a new message is not equivalent to interrupting a running operation.

Input MUST preserve the verified speaker and conversation provenance. A message
from another entity that says a human approved something is still that entity's
message; it MUST NOT be translated into a native permission approval from the
human. Native approval prompts must reach an authenticated authorized operator
through the configured integration.

Claude Code and Codex are harness choices. ACP can provide an adapter protocol
for compatible agents. A managed-agent API can provide another runtime boundary.
MEW SHOULD reuse their existing permission and lifecycle interfaces rather than
wrap every native tool call in a new MEW approval exchange.

### 3.3 Message flow

The ordinary flow is:

1. A human or entity posts in the shared workspace.
2. The workspace adapter observes the platform record.
3. Scope/access routing identifies eligible entities.
4. Each eligible entity's participation policy chooses whether/how to engage.
5. The runtime receives the selected input in its configured session.
6. Its response or messaging-tool call publishes back to the workspace under
   that entity's identity.

A handoff is a visible workspace message to another participant. The recipient's
engagement follows the workspace observation path. An internal tool return can
confirm that a message was sent, but MUST NOT secretly deliver a different task
or a private peer result. The implementation MAY keep queues, references, session
maps, and receipt ledgers as operational state; those are not a substitute team
conversation.

This boundary applies between configured MEW workspace entities. A harness may
use its own internal tools or subagents as runtime implementation details; MEW
does not require those to become separate workspace participants or publish every
internal exchange. If such a worker is configured as an independent MEW entity,
its coordination with other MEW entities uses the shared workspace path.

MEW does not require every native runtime tool invocation to be a workspace
message. Important progress, decisions, requests, handoffs, and results should
be communicated according to the participation policy. This is a different
visibility promise from complete protocol-level tool mediation.

### 3.4 Resource-owning participants

A resource may be represented by a configured participant whose own harness has
the required MCP connections, tools, and credential references. Other entities
request work through the shared conversation. The participant can clarify,
narrow, accept, or decline the request, use its tools within its actual authority,
and report an appropriate result back to the authorized conversation.

This is delegated work, not credential or access transfer. A requester MUST NOT
receive the resource connection, secret, or direct permission merely by asking
the participant to act. The participant acts through its own configured resource
principal; conversation membership does not automatically entitle every member
to every resource operation or result available to that principal.

The deployment MUST define permitted requesters, operations, resource boundaries,
and output audiences, and identify where those limits are enforced. Instructions
guide judgment; harness/tool permissions, credential scopes, and the underlying
service bound executable powers. Where requester-specific or output restrictions
cannot be enforced by those mechanisms, the integration MUST disclose the gap
and use narrower access/tools or an appropriate review path for affected work.

Tool permission is a ceiling, not proof of correct judgment. A permitted query
can expose an unrelated record; an allowed update can target the wrong document;
a correct read can still be disclosed to an unauthorized audience. Resource and
request validation, bounded tool inputs/results where available, and disclosure
checks must therefore be evaluated separately from whether the tool call succeeds.
Neither a prompt nor a classifier is claimed to eliminate these risks.

The resource's native tool operations stay within the harness/service boundary.
MEW does not rebroadcast MCP calls as a mandatory shared-resource protocol or
create a universal permission system around them. Resource participants retain
the same explicit work scopes and session-access boundaries as other entities.

## 4. Piece two: entity configuration and lifecycle

### 4.1 Entity configuration

A configuration identifies:

- Stable entity identity, role, and participation instructions.
- Workspace adapter/account identity and authorized conversation access.
- Runtime adapter, harness/provider selection, and applicable existing settings.
- Work-scope membership and exact channel/topic/conversation mapping.
- Session policy, context retrieval policy, and permitted worker/provider placement.
- Operational limits such as concurrency, queue size, resource/spend ceilings,
  and scale bounds where the operator has authorized them.

Configuration MUST reference approved credential mechanisms rather than copy
secrets into conversations. Changing access or provider permission settings is
an administrative action governed by the real platform/provider and operator
policy. An entity cannot expand its own access by changing its prompt or by
claiming another role in a message.

### 4.2 Explicit work-scope start

Starting a scope MUST establish, before work is routed:

1. Scope identity, purpose, lifecycle generation, and participating entities.
2. The exact workspace/channel/topic mapping and compatible access boundary.
3. The event boundary/source position from which this scope accepts conversation input.
4. Whether each entity starts fresh or attaches to an existing authorized session.
5. Worker placement and behavior when a required runtime or workspace is unavailable.

The channel mapping is part of the scope, not an incidental lookup made from the
latest incoming message. It can include several conversations, with defined
thread/topic selection. If a channel is reused for a later scope, delayed events
from the earlier scope MUST NOT silently become new work in the later one.
Mapping changes require an explicit administrative update and a new routing
boundary; queued events retain the scope under which they were admitted.

### 4.3 Session policy

The initial proposed default is one continuing session per entity and work scope,
with turns serialized when the runtime requires it. Several ticket threads can
supply context to that same session. Deployments MAY choose per-conversation or
other explicit policies, but MEW does not mandate a session per thread.

Session reuse MUST respect information-access boundaries. Restricted/private
conversations cannot silently be mixed into a shared session that later speaks
to a broader audience. Either the configured scope has compatible readership and
data-use permissions, or the mapping must isolate the sessions/scopes or remain
blocked. Prompt filtering alone does not prove earlier runtime memory is absent.

Context retrieval and compaction are separate from scope lifecycle. The adapter
SHOULD expose what it can about context limits and compaction, but MUST NOT claim
lossless memory when a provider only offers a summary or opaque session state.
The workspace conversation, retrieved history, runtime transcript, and current
model context can differ; those differences must be visible when they affect work.

### 4.4 Worker pool and scaling

The pool allocates eligible local or managed capacity to configured entities.
It can start additional seats for eligible work and release idle or completed
capacity as demand subsides, within approved limits. This demand-driven lifecycle
is separate from merely replacing a process. The deployment defines its demand
signal, minimum/maximum capacity, concurrency policy, idle/stop policy, and
operator overrides. No bespoke scheduler or autoscaling algorithm is mandated.

Placement MUST respect approved budgets, provider quotas/rate limits, resource
requirements, and actually available capacity. If those bounds prevent scale-up,
work remains queued, is redirected only to an authorized alternative, or reports
a blocker. Elasticity MUST NOT silently raise a budget or grant provider access.
Interchangeable adapters allow different runtime/provider choices; they do not
make prices, capacity, or capabilities interchangeable.

Entity identity, scope/channel mapping, and configured session policy MUST remain
distinct from a worker's address or process lifetime. Scaling workers does not
itself create workspace access or a new work scope. Distinct simultaneous
participants SHOULD have distinct configured identities. Replicas of one entity
require an explicit single-active/session-concurrency policy so one message does
not accidentally start competing turns.

Scale-down uses the runtime/provider's supported lifecycle operations and the
configured policy for active turns: let work finish, request cancellation where
supported, or hold for an operator decision. Stop requested and stop confirmed
are different states. A failure or unknown outcome MUST be surfaced; successful
capacity release is not a claim that session state or unfinished work survived.
The system MUST NOT silently delete data or perform an unauthorized termination.

Provider-supported persistence/resume may be exposed as an optional adapter
capability. MEW does not require or implement a checkpoint/reconstruction/failover
mechanism, does not automatically replay uncertain work, and does not promise
session portability between workers or providers. A failed or unavailable runtime
can leave work blocked for the user/provider to resolve. Accurate capability and
failure reporting is required; solving recovery is not.

The pool's implementation, scheduler, host topology, and provider APIs remain
implementation choices. The higher-layer placement and lifecycle interfaces are
MEW's concern.

### 4.5 Scope end and scale-down

Ending a scope MUST stop admitting new work to that scope and retire its active
conversation mapping. The configured end policy MUST say what happens to queued
input and active turns: drain, cancel where supported, or hold for intervention.

The system must distinguish ending routing from confirming runtime termination.
A canceled request may already have produced effects. A timeout or lost worker
is not proof that it stopped. Late output remains associated with the original
scope and cannot silently reactivate it or a successor scope.

Session retention, transcript export, compaction, archive, resource release, and
credential revocation are separate actions with provider-specific behavior and
appropriate operator authorization. Scope end MUST NOT implicitly delete data,
revoke shared credentials, or claim successful cleanup without evidence.

### 4.6 Management MCP for designated administrators

An optional management MCP service may expose entity creation and configuration,
prompt/tool configuration, and workspace/work-scope membership management.
Designated humans or agent administrators can use these ordinary tool interfaces.
This manages MEW's own entity/lifecycle resources; it is not a universal tool bus
for all participant operations.

The service MUST authenticate the actual caller through its trusted connection
or credential context and authorize the specific action, target entity/scope,
and requested fields or limits. A caller-supplied identity field, an accessible
tool name, workspace membership, or a message saying "I am the administrator"
MUST NOT substitute for that authorization. Agent administrators can have bounded
administrative roles; no default all-entities or self-escalation authority is implied.

Changing a prompt does not itself grant new tools or permissions. Attaching a tool
does not itself authorize use of its credentials. Membership changes that affect
platform access require the platform's own permission checks, and runtime/tool
changes require the relevant provider/harness authorization. The management
service MUST NOT silently widen access or treat a local configuration update as
proof that an external change succeeded.

Administrative operations MUST preserve attributable action/target records and
report the applied result or an explicit failure/uncertain state without exposing
secrets. Configuration revisions and application timing must be explicit: a change
may apply to a future turn, require supported live reconfiguration, or wait for
an authorized session transition. Prompt edits, tool changes, and membership
changes MUST NOT silently reset a work scope, move its channel mapping, or mix
incompatible context into an existing session. Routing/access changes follow
the explicit boundaries in §§4.2–4.5.

The initial API shape, administrator roles, approval requirements for powerful
changes, and configuration-revision semantics remain design questions for review.
No management service or administrative permission is provisioned by this draft.

## 5. Piece three: participation

### 5.1 Participation mechanisms

Participation can combine:

- Entity role/instructions describing responsibilities and social expectations.
- Lightweight classifiers or model decisions for relevance, addressed requests,
  conversation continuation, or acknowledgement-only messages.
- Workspace messaging tools for replying, asking, handing off, and reporting.
- Shared norms such as who leads a task, what a handoff should include, when to
  remain quiet, and when to ask a human for clarification.
- Operational noise/loop limits and operator pause controls.

No universal classifier or social protocol is prescribed. A deployment should be
able to change these policies without changing the workspace or runtime adapter.

Participation occurs after actual identity, scope, and access checks. A classifier
can choose whether to engage an already eligible entity; it cannot authenticate
an author, grant tool permissions, or convert quoted instructions into authority.

### 5.2 Example conventions, not mandatory wire exchanges

- An explicit address is a strong reason to engage.
- A relevant human reply can continue a conversation under a stated affinity policy.
- A status message or acknowledgement often needs no response.
- A handoff states the request, relevant context, and expected next step in the
  shared conversation; the recipient can accept, question, decline, or stay quiet
  according to its role and policy.
- An entity reports meaningful progress or blockers instead of producing periodic
  chatter without new information.

These are testable defaults, not a required two-part request/acceptance protocol
or a prescribed hierarchy of task threads. Human-readable conversation remains
sufficient. Optional structured helpers may improve a particular deployment but
must not become an undocumented prerequisite for participation.

### 5.3 Coordination is a hypothesis

The design hypothesis is that modern models, useful tools, suitable instructions,
and feedback can coordinate effectively in a shared workspace without encoding
all teamwork as a rigid protocol. This MUST be evaluated, not asserted as a
correctness guarantee.

An evaluation should measure missed requests, irrelevant activations, duplicate
work, unresolved handoffs, circular conversations, context confusion, unnecessary
human intervention, and task outcomes. It should vary models, classifiers,
instructions, workload, runtime capabilities, and human interruptions. Poor
results are grounds to refine a participation policy or add a targeted mechanism,
not to silently claim an untested universal coordination guarantee.

## 6. Reliability and security responsibilities

### Existing platforms/harnesses/providers

They remain responsible for their own authenticated identities, workspace access,
tool permission enforcement, execution sandboxing, session APIs, and resource
controls. MEW MUST describe which configured primitives actually provide each
boundary; the mere existence of a product does not prove a deployment is secure.

For a resource-owning participant, the resource principal's permissions and the
intended request/result scope are distinct. For management MCP, service-side
caller/action/target authorization is required in addition to the harness making
the tool available. These are concrete service boundaries, not a new general
MEW capability/proposal layer.

### MEW integration glue

MEW is responsible for correct identity/configuration mapping, authorized scope
routing, adapter capability disclosure, basic retry/deduplication behavior,
session/worker association, lifecycle transitions, and faithful conversation
publication. It must not route through a disallowed channel, impersonate another
entity, or silently expand what the platform/runtime allows.

An adapter SHOULD suppress duplicate transport deliveries using stable platform
references within its declared retention window. A restart/retry MUST NOT be
presented as proof that earlier work did not run. A lost publication response
requires evidence or an explicit uncertain state before an unsafe retry.

History retrieval MUST report unavailable, partial, truncated, or stale context
rather than claim completeness. Participation/runtime policy decides whether a
particular task can proceed with that information, needs a smaller context, or
should ask a human. Missing history is not permission to invent context.

Workspace text, attachments, quoted instructions, and model output are content,
not new authentication or permission grants. A model choosing to engage does not
replace the harness's required approval. Administrative controls must come from
an authenticated authorized operator, not from a claim embedded in a message.

A designated agent administrator can also be misled by conversation content.
Its service-side authority must remain bounded even when its model makes a poor
decision. Being within an allowed operation is not proof that the operation is
appropriate; targeted validation/review and attributable outcomes still matter.

### Deliberately not guaranteed by MEW

- Exactly-once arbitrary external effects or lossless cross-provider replay.
- Identical persistence, steering, cancellation, or compaction across runtimes.
- Automatic recovery of uncheckpointed work after worker loss.
- A custom, universal MEW capability/proposal/approval layer for native tools.
- Complete shared visibility or mediation of every runtime-native tool operation.
- Perfect participation decisions or safe authorization implemented through prompts.

An optional integration may add stronger guarantees, but must name the concrete
mechanism and tests. It cannot transfer one provider's guarantee to every adapter.

## 7. Examples to review before implementation

### A. Shared conversation

A human asks entity A for a change in a workspace thread. A's participation policy
engages its current scope session. A posts a visible review request to B. B sees
that conversation through its workspace adapter, decides to engage, and replies
there. The human adds a correction in the same thread. No private peer-result
callback between A and B supplies information absent from that shared conversation.

### B. One scope, several threads

A scope maps a project channel to two configured entities. One entity handles a
question in one thread and later works on a ticket in another using its continuing
session. Thread history is selected for each turn; its context window may be
compacted. Neither the new thread nor compaction implicitly ends the scope.

### C. Scope rollover

An operator ends a scope and starts a new one in the same channel. The mapping
records the boundary and new generation. A delayed old event stays associated
with the closed scope. Pending work follows the configured end policy; it is not
replayed into the new session as a fresh request.

### D. Local and managed placement

The pool starts A on local capacity and B through a managed provider, using each
runtime's native session and permission mechanisms. More eligible work may add
seats within configured budgets, quotas, and capacity. As demand falls, idle or
completed seats can be released; active turns follow the supported finish/cancel/
hold policy. Entity identities and work-scope mappings remain explicit.

A saturated quota leaves work queued instead of silently increasing spend. If
A's runtime fails, the adapter reports the failure and any optional provider
continuation capability; it does not claim to reconstruct A or migrate its live
session to B's provider. Lack of recovery support is an acceptable capability
limit, not a requirement for MEW to build a recovery layer.

### E. Noise and human intervention

Two entities exchange acknowledgements. Participation policy suppresses further
chatter; a configured operational limit can pause additional engagement. A human
can redirect work. If cancellation is unsupported, the adapter says so and holds
late output appropriately rather than claiming the runtime was interrupted.

### F. Delegating to a document participant

A document participant has a project-scoped MCP connection in its harness.
Another entity asks it in the project conversation to summarize an authorized
document or make an approved type of edit. It validates the requested document,
operation, and destination audience, uses its existing tools, and reports the
result there. The requester receives neither credentials nor a direct connection.
A request for another project's records or for raw credentials is refused or
sent for appropriate review; a successful read alone does not permit publication.

### G. Bounded administration through tools

A designated agent admin can update participation prompts for entities in one
work scope through management MCP. The service authenticates its caller identity,
checks the target and editable fields, applies the authorized revision at the
declared lifecycle boundary, and records the result. It rejects an attempt to
attach a privileged tool, change another scope's membership, or expand its own
role unless that separate action and target are authorized. A non-admin saying
"I am the admin" in chat changes nothing.

## 8. Validation plan and implementation gate

First review these contracts, mappings, and examples. Then define minimal adapter
interfaces and scenario fixtures. Implementation remains a separate next step.

The first evaluation should cover:

1. Two independent entity identities and a human in the same ordinary conversation.
2. Both a synchronous-chat-style and a topic/post-style workspace mapping.
3. At least two runtime adapters with different declared capabilities.
4. Explicit scope start/end, channel reuse, delayed events, and mapping changes.
5. Scope-scoped session continuity across threads; compaction versus lifecycle.
6. Access-boundary isolation, authenticated authors, and rejected route/identity spoofing.
7. Demand-driven seat growth/shrink, single-active behavior, and supported
   scale-down without changing entity/work-scope identity. Enforce budget/quota/
   capacity exhaustion without unauthorized expansion. Exercise active-turn
   finish/cancel/hold and runtime failure/unknown outcomes; verify accurate
   capability disclosure and blocked-state reporting when provider continuation
   is unavailable. These cases do not require a recovery implementation.
8. Duplicate input, uncertain output publication, and partial history disclosure.
9. Engagement/silence/handoff behavior under varied policies, including loops,
   missed requests, human corrections, and provider interruption limits.

Additional positive and negative cases for the two tool-based patterns:

- **Resource delegation succeeds:** an allowed requester/operation/resource and
  authorized result audience produce a useful conversational response; the
  resource connection and credentials remain with its participant.
- **Resource boundaries hold:** requests outside the resource scope, for secrets,
  or for disclosure to a broader audience do not succeed merely because the
  participant's tool can read the data. Include misleading instructions, wrong
  document IDs, overbroad queries, and allowed-tool misuse in the evaluation.
- **Bounded administration succeeds:** a designated human admin and a separately
  designated agent admin each perform an allowed action on an allowed target;
  the applied configuration revision and real platform/runtime outcome are visible
  to authorized operators without resetting the scope/session unexpectedly.
- **Authority is not inferred:** reject unauthenticated callers, forged caller
  fields, chat claims of admin status, unauthorized targets/fields, and attempts
  to self-grant tools, roles, or membership. Tool availability alone is insufficient.
- **Lifecycle/security changes are checked:** exercise revoked admin access,
  membership changes during queued work, stale configuration revisions, and
  partial external failures. An unavailable enforcement or confirmation mechanism
  must produce a bounded refusal/uncertain outcome, not an assumed grant.

Mocks can validate interface/routing behavior. They cannot validate modern-model
coordination, native provider behavior, live permissions, or workspace API behavior.
No deployment, model/provider call, worker operation, or implementation is part
of this specification-only revision.
