# [m2s] Research and compatibility assessment

Reviewed baseline: `rjcorwin/mew-protocol` main at
`898f32e1a233bbd42a4fda0c4feb2367ea1c2b46`.
The released wire protocol is **v0.4**; the npm package is **0.11.0**. These are
different version domains. “v2” is a working direction, not a released version.

## What the existing specification says

- [Protocol §§1–2](../../SPEC.md): unified context, capability-based control,
  human proposal/review, and MCP compatibility are foundational. Persistence,
  replay, and guaranteed delivery/ordering are explicitly non-goals.
- [Protocol §3](../../SPEC.md): `id`, `from`, `to`, `kind`, `correlation_id[]`,
  `context`, and `payload` are established envelope vocabulary. Correlation can
  describe a DAG; context groups a conversation and does not define a runtime
  session.
- [Protocol §§3.1–3.3](../../SPEC.md): a proposal cannot itself execute an
  operation. A capable fulfiller emits an actual request, correlated to the
  proposal. Responses correlate to that request. Withdrawal and rejection are
  distinct from fulfillment.
- [Protocol §§3.4, 3.9](../../SPEC.md): acknowledgement, chat cancellation,
  participant pause/resume, context management, restart, and shutdown already
  exist. Attention withdrawal is not proof that a process or external action
  stopped.
- [Protocol §§4, 7](../../SPEC.md): the gateway authenticates `from`, gates
  capabilities, and reserves `system/*`. Payload semantic checks currently sit
  mostly with participants. A durable action profile will need mandatory
  validation at the effect boundary, not merely a renamed kind.
- [SDK specification](../../../sdk/SPEC.md): client, participant, and agent are
  distinct layers. The new design should not collapse transport, protocol
  participant, and model runtime into a single “session.”
- [Bridge specification](../../../bridge/SPEC.md): MCP translation, subprocess
  lifecycle, and reconnection are adapter responsibilities.
- [CLI specification](../../../cli/SPEC.md): UI/process management is distinct
  from protocol semantics; Slack is an additional interaction surface.

## Relevant evolution already in the repository

- [j8v stream visibility](../j8v-stream-visibility/proposal.md) adds complete
  active-stream metadata for late joiners. Shared context requires enough
  information to interpret what is observed.
- [s2w stream ownership](../s2w-stream-ownership/proposal.md) separates ownership
  from authorized writers and makes authority changes visible.
- [t5d targeted streams](../t5d-targeted-stream-delivery/proposal.md) retains
  shared lifecycle messages while allowing data frames to go to specific targets.
  “Shared record” must therefore define its boundary, rather than falsely claim
  all bytes are always broadcast.
- [Secure invitations, commit 190819b](https://github.com/rjcorwin/mew-protocol/commit/190819bf51072ac6cb92b60186df4b67b6ca1044)
  keep credential-bearing invitation acknowledgements private while broadcasting
  non-sensitive presence. Visibility is not permission to expose credentials.
- [Spec-driven workflow, commit 5ab2f5a](https://github.com/rjcorwin/mew-protocol/commit/5ab2f5a50832a395bb49c0b935b7d3d86c37bb89)
  establishes proposal, decision, specification, and changelog before implementation.

## Intentional changes proposed for v2

1. Define a durable work-record profile with replay and explicit uncertainty,
   reversing v0.4's non-goals only for that negotiated profile.
2. Separate visibility, addressing, activation, and authority. Observing a
   message does not grant permission or demand another model turn.
3. Define transport-independent record evidence so a Slack binding cannot
   activate a recipient through an unpublished internal request.
4. Preserve lifecycle-scoped runtime continuity without equating each ticket
   thread with a new agent session.
5. Make partial history, late messages, ambiguous execution, and cancellation
   limitations observable protocol states.

## Unproven by this research

This is a repository/specification review, not a live Slack or provider trial.
The Slack binding still requires verification against current platform schemas,
permissions, retention, pagination, rate limits, metadata delivery, and edit/delete
events before implementation. No provider is claimed to support durable replay,
exactly-once effects, cancellation, or session recovery merely because an adapter
interface describes it. No implementation, deployment, or recovery test is part
of this specification-first deliverable.
