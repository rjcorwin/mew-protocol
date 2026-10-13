# [m2s] Decisions for review

Status: Proposed, not accepted. The draft uses MUST/SHOULD to make candidate
contracts reviewable; that language does not assert user approval.

## D1. Keep MEW's vocabulary and authority model

Propose retaining participants, spaces/workspaces, `from`, `to`, `kind`,
`correlation_id[]`, `context`, capabilities, and proposal/fulfillment. Do not reduce
the protocol to Slack handoffs or conflate addressing with permission.

Reason: these are existing MEW semantics and preserve tools, human control, and
multi-party workflows beyond a two-agent chat.

## D2. Shared work record is a profile; Slack is a binding

Propose a transport-independent core and an opt-in durable work-conversation
profile. Slack is the first binding. A binding must prove a visible record exists
before activating a peer. Private indexes, queues, leases, and runtime state are
allowed; private team conversation that bypasses the record is not.

Open: should durable work-record semantics become mandatory for every v2 space,
or remain a profile so game/telemetry use cases retain an ephemeral mode?

## D3. Preserve operation visibility without overstating runtime control

Propose requiring shared records for all MEW participant-to-participant requests,
decisions, tool requests/results, handoffs, and completions. Native runtime tools
must declare whether MEW mediates them. A runtime with hidden native tools cannot
claim full action-profile enforcement.

Open: should the initial runtime profile require full native-tool mediation, or
allow a clearly labeled collaboration-only profile? The latter is simpler but
offers weaker operation-level control than full MEW.

## D4. Keep runtime sessions lifecycle-scoped

Propose a runtime profile whose session key is `(workspace, lifecycle, participant)`.
A sprint is one lifecycle example. Thread/context identity is supplied per turn
and used for history cursors; changing threads does not create a new mind.

The shared session requires compatible readership and data-use permissions across
contexts. Private/restricted conversations cannot be silently folded into it;
otherwise the binding must block or use a separately authorized isolation policy.

Open: no unresolved default for the initial profile. Other session policies may
be negotiated in separate profiles, never inferred from a Slack thread ID.

## D5. Separate observation, activation, and authority

Propose explicit addressed activation, with acknowledgement/status/result
observation non-activating by default. A result intended to resume another agent
must explicitly request that continuation. Humans use the same conversation and
can explicitly address any permitted participant.

Addressing does not narrow the authorized shared observer audience. Empty/omitted
`to` is visible to that audience but does not automatically activate everyone.

Open: should unaddressed human replies inherit a last addressee? Initial
recommendation is no implicit affinity until its rules are specified and tested.

## D6. At-least-once transport, durable admission, explicit uncertainty

Propose durable dedupe plus idempotency/reconciliation contracts. Never promise
exactly-once arbitrary external effects. An unknown result is held and surfaced,
not blindly retried. Missing history is a blocker for action, not success with
truncated context.

Open: choose retention/checkpoint windows, root work budgets, and stale thresholds
in the deployment profile. They are policy values, not universal protocol numbers.

## D7. Cancellation has distinct observable states

Propose preserving `chat/cancel` as attention withdrawal and specifying runtime
cancel-requested versus cancel-confirmed versus unsupported/unknown separately.
Do not invent successful interruption when a provider only queues new input.

Open: exact new work/control kind names and provider conformance fixtures.

## D8. Draft version and release boundary

Propose `mew/v2-draft` in examples only and explicit profile negotiation. Do not
silently reinterpret v0.4 envelopes or publish a v2 release from this proposal.

Open: release numbering, final wire identifier, and whether migration is a native
v2 gateway or an explicitly versioned bridge. Review these after the core contract.
