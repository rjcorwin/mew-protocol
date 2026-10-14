# [m2s] Design decisions and remaining questions

Status: revised proposal for review. The decisions below define the intended
shape; detailed interfaces and defaults still need review before implementation.

Refinement: expose desired versus applied configuration and readiness, include shared supporting-resource limits, disclose adapter differences, and validate typed targets and applicable approvals with attributable outcomes.

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

Resource-owning participants compose adapters and participation; management MCP
belongs to entity lifecycle/configuration. These are patterns inside the three
pieces, not additional mandatory protocol layers.

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

## D6. Scale seats with demand; leave recovery to providers

The core goal is higher-layer collaboration glue and demand-driven elasticity
beyond one fixed developer host. Add eligible seats as work grows and release
idle/completed capacity as demand subsides, within approved budgets, quotas, and
available capacity. Replaceability alone is not elasticity. Local-first operation
and different local/managed providers remain valid choices; no affordability or
cost-saving guarantee follows.

Keep entity identity, work-scope mappings, and session policy distinct from worker
placement. Scaling grants no new workspace access. Replicas need an explicit
single-active/concurrency policy; distinct participants normally have distinct
identities. Active turns follow supported finish/cancel/hold behavior, with
failures and uncertain outcomes reported accurately.

Recovery is a nice-to-have underlying runtime/provider capability, not a MEW
requirement. Do not add a custom checkpoint, retained-state, reconstruction,
failover, or automatic replay layer. Optional provider persistence/resume may be
reported without promising native session migration or unfinished-work recovery.
A blocked failure is acceptable when the provider cannot continue.

Remaining questions: minimum pool/status interface, demand signals, capacity
ceilings, idle/stop policy, and how unsupported or failed provider operations
reach the operator. Validate scaling and honest failure disclosure, not a bespoke
scheduler or recovery solution.

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

## D9. Keep resource access with its participant

A resource-owning participant holds its MCP connection, tools, and credentials
in its harness and acts on conversational requests using its own configured
resource principal. Requesters receive useful work/results, not inherited direct
access or credential transfer.

Instructions guide judgment; real harness/tool/service controls bound powers.
Neither proves that every permitted use is appropriate or safe to disclose.
Define requester/action/resource/output scope and test allowed-tool misuse as
well as denied operations. Where the required restriction is not enforceable,
use narrower access/tools or appropriate review rather than claim prompt-based
security.

Remaining questions: initial resource/tool scope, handling requester-specific
entitlements, output disclosure checks, and evidence for a safe delegation policy.

## D10. Expose bounded administration through management MCP

Designated human or agent admins can use management tools to create/configure
entities and manage prompts, tools, and membership. The management service
authenticates its caller and enforces the specific action, target, and editable
fields/limits. Tool access or a claim of being an admin grants no blanket role;
self-escalation is not assumed. Platform/runtime permissions still govern the
actual changes.

Record attributable outcomes and explicit configuration revisions/application
timing. Administrative changes preserve work-scope channel mappings, session
boundaries, and existing access isolation unless an authorized transition changes
them. An agent admin can still make a bad choice within its allowed powers, so
validation and review requirements remain relevant.

Remaining questions: API/role boundaries, sensitive-change approval requirements,
live versus next-turn configuration application, concurrent/stale edits, and
partial failures. This manages MEW's entity resources, not all native tool use.
