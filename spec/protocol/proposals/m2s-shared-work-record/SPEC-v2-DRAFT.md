# MEW v2 draft: shared workspaces, visible coordination

Status: **specification proposal for review; not accepted or implemented**.  
Working identifier: `mew/v2-draft`.  
Baseline: MEW wire protocol v0.4 at repository commit
`898f32e1a233bbd42a4fda0c4feb2367ea1c2b46`.

MUST, MUST NOT, SHOULD, and MAY express proposed normative requirements. They do
not turn an unresolved decision into an accepted one. The accompanying decision
document identifies the choices still requiring review.

## 1. Purpose

MEW gives humans, agents, and tools a shared workspace in which identity and
capability enforcement belong to the protocol boundary. V2 extends that model
to durable work conversations: participants coordinate through the record that
humans can read and join, rather than through hidden delegation later summarized
into a chat feed.

The protocol MUST distinguish four things:

1. **Visibility:** who can inspect a record.
2. **Addressing:** which participants a message concerns.
3. **Activation:** whether it requests a participant's next turn or operation.
4. **Authority:** whether that participant may perform the requested operation.

None implies the next. A visible request from another agent is not human approval;
receiving or reading it does not grant capabilities.

## 2. Layers and conformance

### 2.1 Core

Core defines authenticated participants, versioned envelopes, capability checks,
context and correlation, record references, and observable protocol outcomes.
Core MUST NOT depend on Slack IDs, ACP methods, model providers, database products,
container runtimes, or a particular hosting service.

### 2.2 Profiles

- **Shared work record:** durable admission, observable coordination, replay,
  bounded activation, history completeness, and uncertain-outcome handling.
- **MCP action/proposal:** v0.4-compatible request/proposal/fulfillment concepts
  with explicit operation authorization and effect reconciliation.
- **Runtime lifecycle:** maps admitted work to local or managed runtime turns,
  without equating context with a runtime session.
- **Streaming:** optional high-volume stream lifecycle and writer/target controls.
  It MUST NOT be an unrecorded delegation channel in a shared-work space.

A participant and gateway MUST advertise supported profiles and versions before
accepting their messages. Unsupported operations MUST fail explicitly. A system
MUST NOT claim full action-profile enforcement if some effectful tools bypass it.
Whether the shared-work profile is mandatory for every v2 space remains open.

### 2.3 Bindings

A binding maps core identities and records to a transport. The Slack binding in
§11 is an initial proposed binding. WebSocket/HTTP bindings can continue to exist;
they must satisfy the same advertised profile rather than silently weaken it.

## 3. Identity, workspace, context, and lifecycle

A **participant** is an authenticated human, agent, or tool principal. Its stable
ID MUST be assigned or verified by the gateway; names in message text, claimed
roles, and copied metadata MUST NOT establish identity.

A **workspace** is an authorized shared collaboration scope. A **context** groups
related records within it, such as a ticket conversation. A **lifecycle** is an
application-defined period of work, such as a sprint. A **runtime session** is a
provider-owned execution state for one participant.

These identifiers MUST remain distinct. In the initial runtime profile, the
session key is `(workspace, lifecycle, participant)`; each turn also carries its
context. Two ticket threads in the same sprint therefore share the participant's
runtime session, while retaining separate conversation history cursors. A new
lifecycle does not silently reuse the previous lifecycle's session.

A lifecycle session MUST have one compatible information-access boundary.
Sharing a session across contexts MUST NOT carry restricted history into a
conversation whose audience cannot receive it. The initial profile therefore
requires compatible readership and data-use permissions across its contexts;
otherwise the binding blocks the mapping or uses a separately authorized
lifecycle/isolation profile. A private message is not implicitly part of a shared
session, and thread-specific prompt filtering alone is not proof that earlier
runtime memory cannot leak. Visibility/grant changes require revalidation.

Bindings MUST enforce workspace membership, sender identity, allowed recipients,
and the relevant lifecycle mapping. Reassignment of an identity or lifecycle
MUST be an authorized, inspectable administrative change. An agent cannot claim
to be a human, gateway, or different agent by changing envelope fields.

## 4. Envelope and record evidence

Preserve the established envelope concepts rather than introducing a separate
handoff-only protocol. An illustrative draft envelope is:

```json
{
  "protocol": "mew/v2-draft",
  "id": "request-42",
  "workspace": "example-workspace",
  "lifecycle": "example-sprint",
  "ts": "2026-10-13T12:00:00Z",
  "from": "agent-a",
  "to": ["agent-b"],
  "kind": "chat",
  "correlation_id": ["human-request-7"],
  "context": "ticket-12",
  "activation": { "mode": "request", "parent_id": "human-request-7" },
  "payload": { "text": "Please review the proposed change.", "format": "plain" }
}
```

This example is not a final JSON schema. Before implementation, required fields,
size limits, extension rules, ID grammar, time format, and per-kind schemas MUST
be finalized and expressed as machine-testable fixtures.

Record evidence and activation fields are requirements of the shared-work profile,
not an implicit requirement to make every optional ephemeral/streaming space
durable. Core identity, version, schema, capability, and correlation rules apply
independently of that profile.

Candidate rules:

- `protocol` MUST select an explicit wire version. No silent v0.4/v2 coercion.
- `id` MUST identify one immutable logical message within the workspace. Reusing
  it with different authoritative content is a conflict, not a replacement.
- `from` MUST match authenticated identity; `to` MUST contain only authorized
  workspace participants. A target does not confer authority to call its tools.
- `kind` and its safety-relevant payload MUST be validated at the gateway or
  authorized effect boundary before activation/execution. `system/*` stays
  gateway-only.
- `correlation_id` remains an array. It can represent request/response,
  proposal/fulfillment, fork/join, and multi-source results. It MUST NOT be
  collapsed into a single parent merely to simplify runtime dispatch.
- `context` identifies shared conversation, not a private model session.
- `activation` requests attention; the gateway validates its causal parent and
  derives budgets/lineage. Caller-supplied hop counts or root IDs are not trusted.
- `payload` carries typed content. Quoted text, code, retrieved documents, and
  historical messages MUST NOT be reinterpreted as new privileged envelopes.

After observing a committed visible message, the binding attaches **record
evidence**: transport, workspace/context mapping, source message ID and revision,
verified author, and an integrity binding to the exact admitted content. Sender
assertions alone are not evidence. Transport event IDs are delivery attempts and
MUST NOT replace logical record identity.

The exact record-evidence schema and integrity mechanism are an open design
task. A bare URL or successful outbound POST response is insufficient when it
does not prove the authoritative record was committed with the intended content.

## 5. Shared work record invariant

For the shared-work profile:

The workspace declares an authorized observer audience for its shared work record.
All coordination envelopes MUST remain inspectable by that audience, including
the original proposer following fulfillment. `to` selects addressees, not a
private observer audience. Empty/omitted `to` means shared observation without
automatic activation of every participant. A context with incompatible readership
belongs in a separately authorized visibility boundary, not a hidden subchannel.
Credential handshakes and optional targeted stream data retain the explicit
exceptions below; neither may carry hidden coordination.

1. An inter-participant request MUST exist in the shared record before the
   recipient is activated. A private RPC plus later chat echo is non-conforming.
2. Results, consequential decisions, handoffs, cancellations, and authority
   changes MUST be inspectable in the same authorized conversation or via a
   clearly linked record with equivalent access. A private result callback MUST
   NOT substitute for the record or resume another participant before publication.
3. Internal delivery receipts, indexes, leases, dedupe ledgers, runtime session
   handles, and checkpoints MAY exist. They are operational state, not an
   alternative conversation or a source of new task authority.
4. Large artifacts MAY be stored separately, provided their visible record
   identifies the artifact/version and authorized participants can inspect it.
   A link MUST NOT grant wider access than the user authorized.
5. Secrets and credentials MUST NOT enter the shared work record. Authentication
   handshakes may use private secure channels; their non-sensitive lifecycle can
   be visible without exposing credentials.
6. Visibility requires useful action/status/evidence summaries, not disclosure of
   private model reasoning. No profile requires private chain-of-thought output.

MEW-coordinated tool requests and results are participant interactions and follow
the same invariant. Runtime-native tools are a declared conformance boundary
(§10), not an exception that can be hidden behind a full-enforcement claim.

## 6. Activation and human participation

Applicability: shared-work profile. Other profiles must separately define their
activation behavior and cannot claim these guarantees by default.

An addressed message MAY request a turn only when sender, recipient, context,
lifecycle, capability, record evidence, and causal constraints all pass. Merely
observing another participant's message MUST NOT require a model turn.

The initial proposed defaults are:

- Explicit human addressing can initiate work within existing capabilities.
- An authorized agent request/handoff can activate the named peer after record
  observation. Agent-created roots require an explicit standing capability;
  otherwise the activation must descend from admitted work.
- A result can request continuation by its recipient, but results are not
  automatically activating solely because they are results.
- Acknowledgements, presence, status, repeated delivery, and an agent's own echo
  MUST NOT recursively activate that agent by default.
- Unaddressed human contributions remain part of context. Automatic thread
  affinity is not assumed; a binding may define an explicit, tested policy.

The gateway MUST enforce bounded causal depth, fan-out, outstanding work, and
per-root activation budgets. A fresh message ID, runtime restart, delivery retry,
or transport reconnection MUST NOT reset a causal budget. Multi-parent
correlation remains valid, but does not mint additional activation authority.
Budgets and limits are profile/deployment settings and MUST be inspectable.

Human approval, capability grant, and ordinary human chat are distinct. A claimed
approval relayed by an agent MUST NOT become an approval by the human. Approval
and high-impact execution semantics remain subject to the action profile and
deployment policy, not informal natural-language claims.

## 7. Capabilities, proposals, and effects

Applicability: MCP action/proposal profile. The visible-record and durable-outcome
requirements below additionally apply when shared-work is negotiated. Core
identity and capability checks always apply.

V2 retains the v0.4 proposal sequence:

1. A proposal-only participant emits `mcp/proposal` with the proposed operation.
2. An authorized fulfiller may emit `mcp/request`, correlated to that proposal.
3. The effect boundary verifies the fulfiller's current capability and the exact
   operation/target before executing.
4. `mcp/response` correlates to the actual request. The original proposer can
   follow the visible chain without receiving a secret internal completion.

`mcp/withdraw` and `mcp/reject` remain distinct. Neither proves that an operation
already executing was rolled back. A capability revocation prevents new
unauthorized admissions/executions; it is not evidence of canceling work already
in flight. Authority MUST be revalidated at the point an effect can still be
prevented, including after queue delay or reconnection.

Capability changes MUST be authorized and visible. A payload MUST NOT override
gateway-owned identity, authorization, routing, or budget fields. Correlation to
an approved proposal alone MUST NOT authorize a changed operation. The profile
must bind fulfillment to the approved operation, target, and relevant limits.

Multiple authorized fulfillers racing to accept one proposal MUST NOT create
multiple executions of the same approved operation. The action profile MUST
define a stable operation identity and an atomic claim/idempotency rule at the
effect boundary, including recovery of an unknown first attempt. A new fulfillment
message ID alone is not a new authorization to repeat the operation.

No delivery mechanism can guarantee exactly-once arbitrary effects. Adapters
MUST declare their idempotency and reconciliation support. If an effect's outcome
is unknown, the system MUST hold dependent work and expose uncertainty rather
than infer success, failure, or permission to repeat it.

## 8. Durable admission, ordering, and replay

Applicability: shared-work profile. Ephemeral profiles must advertise weaker
guarantees explicitly and must not report these durable states without evidence.

### 8.1 Acceptance

Transport receipt, durable admission, runtime start, visible result publication,
and verified task completion are different states. An “accepted” receipt MUST
state what has actually been persisted. A transport success MUST NOT be reported
as work completion.

The shared-work binding MUST persist authenticated intake and dedupe identity
before acknowledging responsibility for eventual processing. Delivery may be
at least once. Per-recipient admission MUST be idempotent across restarts and
transport retry/app-event variants. Conflicting content with the same logical
record identity MUST be rejected and surfaced.

### 8.2 Ordering and late work

The profile MUST define an ordering domain, normally a conversation, without
pretending there is a global total order across all workspaces. Sender wall-clock
timestamps alone MUST NOT determine causal authority. Explicit parent references
and transport record order/revisions must be considered.

A late event MUST NOT rewind a participant's context checkpoint. Before starting
queued work, the system MUST check expiration, cancellation, supersession,
current permissions, and history completeness. A later message is not
automatically a cancellation: explicit supersession/cancel semantics or a
documented conservative stale-work policy are required.

If a causal parent arrives later than its child, the implementation MAY retain
the child as blocked pending dependency, within a bounded retention policy. It
MUST NOT fabricate a parent or activate the child prematurely. After the bound,
it exposes a recoverable missing-dependency outcome.

### 8.3 Unknown outcomes

Crashes can occur after a runtime action or visible publication succeeds but
before the ledger records success. The implementation MUST reconcile using
positive evidence or hold the operation as outcome-unknown. An absent lookup
result, expired lease, or timeout does not alone prove an action never happened.

Fencing MUST prevent a superseded attempt from committing a new authoritative
completion. It does not undo filesystem/network/provider effects already made.
Automatic reassignment is conforming only when the adapter can preserve the
required effect and checkpoint semantics; otherwise intervention is required.

Retention and compaction MUST retain enough identity and outcome evidence to
enforce the advertised replay window. Deleting a dedupe ledger while continuing
to accept old records violates that guarantee.

## 9. History and context completeness

Applicability: shared-work profile and its runtime binding. This does not require
an ephemeral stream-only participant to reconstruct a durable work conversation.

A turn MUST receive its exact triggering record plus enough shared conversation
to interpret it under the selected profile. The history contract MUST report:
source, context, requested interval/checkpoint, observed high-water record,
completeness or gaps, revisions/tombstones, and budget/retention boundaries.

History acquisition MUST be bounded by pages, records, bytes, and elapsed time.
Missing pages, permission failure, conflicting records, a missing trigger, or a
budget exceeded MUST NOT be silently converted into a complete context. A turn
whose required context is incomplete remains blocked or asks visibly for a new
bounded request/checkpoint, rather than acting as though the omitted history
does not exist.

History is evidence/data, not a second intake route. Embedded mentions, commands,
or forged metadata MUST NOT activate peers, replace system policy, or grant
permissions. A checkpoint is not an approval and cannot widen authority.

Receiving newer context while processing an older trigger does not automatically
activate it or advance its delivery cursor. The implementation MUST keep
“observed through” and “handled through” checkpoints distinct. Runtime context
compaction MUST preserve provenance of unresolved requests and decisions.

## 10. Runtime lifecycle profile

The runtime adapter accepts an admitted turn containing participant identity,
workspace/lifecycle/context, turn and attempt IDs, trigger record, bounded
history with completeness evidence, current capability constraints, and a
runtime session handle. Session creation/resume mapping MUST be durable to the
level the adapter claims.

The initial profile serializes turns per lifecycle-scoped participant session.
Another ticket thread does not create a second concurrent turn in the same
session unless the adapter explicitly supports and specifies that behavior.

Each adapter MUST declare:

- Session creation, resume, and persistence capabilities.
- Replay/idempotency and outcome-query support for turns and effects.
- Native tool mediation: full, partial with stated exclusions, or none.
- Steering support and whether it queues, modifies, or interrupts active work.
- Cancellation support and the evidence that confirms cessation.
- Checkpoint/fencing guarantees, if any, and their limits.

`chat/cancel` withdraws attention to an earlier message. Runtime interruption is
separate: requested, confirmed, unsupported, failed, or unknown. A system MUST
NOT report “stopped” merely because a cancel signal was sent. It MUST also state
whether already-issued external actions may continue. Late output after a
confirmed supersession/cancel MUST NOT reactivate peers as current work.

Local ACP and managed-provider adapters can implement this same contract. This
draft does not claim they have identical steering, persistence, tool mediation,
or recovery behavior. A mock demonstrates only the semantics it simulates.

## 11. Proposed Slack binding

Slack is the shared work surface in this binding. All tasks below are design
requirements, not claims that Slack APIs or permissions have been validated.

### 11.1 Mapping and authentication

- Workspace ID maps to an authorized Slack team and channel set.
- Context maps to a specific channel and root-thread timestamp.
- Human and agent participants map to verified platform identities. Each agent
  has its own distinguishable identity; custom names/avatars are not verification.
- The receiving Slack app is distinct from the authoring agent app. Authentication
  of a callback does not establish the callback receiver as message author.
- The binding MUST verify transport authenticity/freshness against raw input,
  then validate workspace, author identity, channel/lifecycle, recipients, and
  current capabilities. It MUST handle duplicates across event forms/apps.

### 11.2 Visible record and activation

An agent sends a visible message in the ticket thread with versioned MEW metadata
and visible addressee information. Metadata is part of that record; it MUST NOT
become a private authoritative envelope that bypasses Slack observation.

Only verified observation of the committed Slack record permits peer activation.
An Events API callback or a bounded authoritative reconciliation fetch may
provide that observation. A successful outbound publish call alone MUST NOT
directly invoke the recipient. If callbacks omit required metadata, the binding
must retrieve and validate it or block, not invent it from an internal send.

The exact Slack metadata schema, its relationship to the core envelope, and the
visible rendering of typed MCP actions/control requests must be specified before
implementation. Human plain-text addressing can map to `chat` activation under
an explicit policy; quoted/code mentions remain context-only. Human participation
must not require hand-authoring JSON.

### 11.3 Retries, edits, deletion, and history

The durable identity key includes team, channel, source message identity/revision,
and logical envelope identity where applicable. Event IDs identify delivery
attempts. A repeated app mention plus message event MUST NOT start two turns.

An edit MUST NOT silently replay an old request as new authority. A binding must
define whether it is a new revision requiring fresh admission or a correction
that blocks pending work. Deletion/redaction produces an observable tombstone
where permitted; it MUST NOT be interpreted as proof that prior effects vanished.
Exact revision/admission policy is an open decision.

Thread history must be paginated completely within declared bounds. Retention
limits, access loss, missing replies, and rate-limit exhaustion are explicit gaps.
An operational mirror can preserve admitted records for recovery, but MUST NOT
manufacture conversations or silently override the shared surface's later
corrections. Retention/privacy policies must govern that mirror.

### 11.4 Human controls

UI buttons or text controls must resolve to authenticated protocol actions and
the exact target request/attempt. Text that quotes a control is not a control.
Approvals must name the consequential operation and bind to its current contents.
Acknowledgement, reaction, cancellation, and approval MUST remain distinct.

## 12. Example traces

### A. Two agents and a human

1. Human posts an addressed request to agent A in a ticket thread.
2. Binding observes and durably admits it. A reads bounded thread context in its
   existing lifecycle session.
3. A publishes an addressed review request to B, correlated to the human request.
4. Until the visible record is observed and validated, B does not run.
5. Human adds a correction in that same conversation. It becomes shared context;
   explicit addressing or supersession determines its activation effect.
6. B publishes its result, with a continuation request to A when appropriate.
7. A's next turn follows observation of that result. No private worker completion
   callback substitutes for steps 6–7.

### B. A proposal needs authority

1. B can propose a tool operation but cannot execute it.
2. Human or authorized fulfiller publishes the exact fulfillment request.
3. Effect boundary revalidates current capability and approved contents.
4. Result is recorded and correlated before another participant continues.
5. If operation contents changed or approval was withdrawn before execution,
   it remains blocked; correlation alone does not rescue authorization.

### C. Publication outcome is unknown

1. A's visible post commits but the publish response is lost.
2. Sender records uncertainty; it does not immediately post another copy.
3. A verified callback or authoritative read finds the existing record.
4. Intake dedupes it and activates B once under the admission contract.
5. If evidence is unavailable, dependent work remains visibly blocked.

### D. Runtime cancellation is unsupported

1. Human withdraws a request while the runtime is working.
2. Gateway records attention withdrawal and asks the adapter to cancel.
3. Adapter reports unsupported or uncertain rather than “stopped.”
4. Late output is prevented from reviving canceled work. Possible already-issued
   effects are reported for reconciliation.

## 13. Conformance scenarios to define before coding

The eventual executable suite MUST derive from these contracts, not merely
exercise an implementation's convenient paths:

1. Two distinct agents and one human share a thread; only observed visible
   requests/results advance the coordination.
2. Authenticated identity mismatch, unknown channel, forbidden peer edge, or
   forged gateway fields cannot activate work.
3. Duplicate callbacks, app-event variants, restart, and replay preserve one
   logical admission per recipient; conflicting reuse is rejected.
4. Private outbound intent and an outbound receipt without record evidence do
   not invoke a peer.
5. Correlation preserves proposal/fulfillment/result and fork/join history while
   activation lineage/budgets cannot be reset.
6. Missing parent, stale event, explicit supersession, edit, delete, and late
   completion produce declared states, not silent reordered work.
7. Incomplete pagination, missing trigger, permission loss, retention gap, and
   bounded-history exhaustion block action with inspectable reasons.
8. Historical authored instructions remain data; they cannot mint an identity,
   capability, approval, or separate activation.
9. Several contexts in one lifecycle preserve one participant session; a new
   lifecycle does not inherit it accidentally.
10. Crash before/after intake persistence, runtime dispatch, effect, publication,
    and receipt persistence is reconciled without unsupported retry guarantees.
11. Revocation while queued and operation changes after approval are enforced at
    the effect boundary.
12. Cancellation requested/confirmed/unsupported/unknown states match actual
    adapter behavior; old attempts are fenced from new authoritative completion.
13. Streams and credentials cannot become hidden inter-agent coordination routes
    or accidentally leak into the shared record.
14. Unsupported profiles/versions fail explicitly; v0.4 traffic is not silently
    granted durable-work or operation-control guarantees.

## 14. Migration and next review

V0.4 remains authoritative for existing deployments. This proposal does not alter
its wire marker, CLI, SDK, MCP bridge, stream behavior, or current sessions.
Migration requires explicit version/profile negotiation and a bridge or native
binding that states which guarantees are preserved or unavailable.

The schema review MUST include a kind-by-kind compatibility inventory:

- `mcp/*`, proposal withdrawal/rejection, and capability grant/revoke: preserve
  the existing concepts, tightening authorization and replay semantics as above.
- `chat`, acknowledgement, and cancellation: preserve their distinct meanings;
  specify explicit activation instead of treating every observation as a turn.
- `participant/*` and `space/*`: classify each discovery, membership, lifecycle,
  status, and context-management operation as core, profile-specific, deferred,
  or removed with a migration reason. No current kind is silently discarded.
- `reasoning/*`: map useful public progress/conclusion summaries without requiring
  private model reasoning; final compatibility names remain to be reviewed.
- `stream/*` and raw frames: optional streaming profile with visible lifecycle,
  explicit ownership/targets, and no hidden work-coordination escape route.

Review D1–D8 before finalizing wire schemas. Then produce accepted state machines,
example traces, and conformance fixtures. Only afterward choose a first
implementation slice. Hosting and worker recovery plans can consume those
contracts; they must not dictate the protocol's authority or visibility model.
