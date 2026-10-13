# [m2s] MEW v2: shared work record

Status: Draft for discussion. Spec first; no implementation approval is implied.

## Intent

Make the conversation where humans and agents collaborate the authoritative work
record. An agent's visible request starts another agent's turn; that agent's
visible result continues the conversation. A separate private delegation system
must not decide what happened and merely mirror a summary into the conversation.

MEW v0.4 already establishes the right foundation: authenticated participants,
gateway-enforced capabilities, shared context, and proposal/fulfillment chains.
This proposal extends that foundation to durable, transport-independent work
conversations. Slack is the first proposed binding, not the protocol itself.

## Documents

- [Draft normative contract](SPEC-v2-DRAFT.md)
- [Source research and compatibility assessment](research.md)
- [Decisions and open questions](decision-m2s-shared-work-record.md)

## Scope

The draft separates four concerns:

1. Core protocol: identity, envelopes, authority, shared records, causality,
   admission, delivery, and visible outcomes.
2. Work-conversation profile: explicit turn activation, loop bounds, late work,
   and participation by humans and agents.
3. Slack binding: platform identity, message/thread mapping, observed posts,
   metadata, retries, edits, and bounded history.
4. Runtime profile: lifecycle-scoped sessions, turn serialization, capabilities,
   cancellation, and uncertain outcomes across local or managed providers.

The existing MCP action/proposal semantics remain a first-class protocol profile.
Binary streaming, hosting, provider SDKs, deployment, model selection, credential
custody, and worker-pool recovery are separate implementation concerns. This is
not a new implementation of the current CLI or a replacement for the released
v0.4 specification.

## Review sequence

1. Agree on protocol boundaries and the open decisions.
2. Review example traces and conformance scenarios independently of code.
3. Define schemas and state-machine fixtures from the accepted specification.
4. Only then implement a narrow binding and runtime conformance slice.

Exploratory implementation work is not normative and is not included in this
specification proposal. An implementation must be evaluated against the eventual
contract, rather than the contract being shaped to ratify existing code.
