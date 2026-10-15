# Mewpod v2: local workspace prototype

An isolated, runnable experiment based on the [MEW v2 proposal](../../spec/protocol/proposals/m2s-shared-work-record/proposal.md).
It connects a shared conversation to independent entity sessions, bounded worker
capacity, and visible background-task results. It does not change the released
MEW v0.4 wire protocol.

**Everything in the supplied demo is local and deterministic.** There are no
live Slack, Discourse, model, managed-provider, MCP-server, or Git operations.
The word “mock” is deliberate: this tests the integration contracts, not model
quality or a production service.

## Run it

From a checkout of `prototype/mewpod-v2`, use Node.js 24 and npm:

```sh
npm ci --ignore-scripts
npm run demo:mewpod
npm run mewpod
```

The first command installs the repository's existing locked dependencies. The
demo prints a conversation and three verified task completions, then exits.
The console opens at **http://127.0.0.1:8087**. Open that URL in a browser on the
same machine; it is deliberately not a hosted or remote-access service.

In the console, post `@builder prepare a change` in `project` / `ticket-a`.
The builder publishes progress and an ordinary visible review request. The
reviewer is activated by observing that message, and posts its own result in the
same thread. Add human corrections there too. Each task's result link points to
the exact verified completion message. Try another thread to see that a thread
does not automatically create a new runtime session.

Post `@catalog list the authorized projects` to exercise a resource participant
with two repository references. The synthetic credential value stays inside
that participant's mock harness. No repository is cloned and no credential is
returned to the requester. Requests for credentials or another example project
are refused by the demo; the resolver independently enforces exact entity,
repository, and operation grants. This is not a general disclosure classifier.

Use the capacity control to allow 0–4 concurrent workers. Zero pauses new work;
reducing capacity lets active turns finish. Capacity is allocated with demand and
released after turns, while entity identities and scope sessions remain distinct.
The budget is **abstract resource units**, not a real provider price or billing
estimate. Concurrent use cannot exceed the configured aggregate limit.

```sh
npm run mewpod -- --port 8090 --data .mewpod/experiment.json
npm run mewpod -- --new-scope
```

The work record defaults to `.mewpod/work-record.json`, ignored by Git. On restart,
old scopes are closed, interrupted work is marked uncertain, and native sessions
are not restored or replayed. `--new-scope` explicitly starts another generation
of the demo work period. Ending a scope stops routing; it does not prove a
runtime stopped. An already in-flight publication may still arrive, but its old
scope provenance cannot activate a successor scope or enter its turn context.

Stop with Ctrl+C. A single-process `.lock` prevents concurrent writers. If a
process crashes, first verify it is no longer running before manually removing
its stale lock. The prototype never steals a lock or kills an unrelated process.

## What is implemented

- Separate configured identities, desired/applied configuration, runtime session
  handles, work scopes, and transient worker reservations.
- Ordinary shared messages as the causal path for peer handoffs. No private
  peer-result callback supplies work that is absent from the conversation.
- Asynchronous progress, queued/running/blocked/terminal task states, and final
  publication checked against workspace, author, conversation, thread, text,
  kind, and scope provenance before claiming completion.
- Stable sessions per entity/work-scope generation across compatible threads.
  Exact audience snapshots prevent queued work from crossing membership changes.
- Duplicate input suppression, bounded turn chains and task retention, bounded
  history pagination, explicit missing-history gaps, and stale-generation gates.
- Honest adapter differences: the local mock confirms cancellation, while the
  queued mock only requests it and may still complete. Queueing is not steering.
- A loopback-only console with fixed-human posting, strict mutation schemas,
  same-origin/Host checks, nonce CSP, and text-only untrusted-content rendering.
- A local JSON work record with atomic replacement and a single-process lock.
  Storage failures pause intake and expose uncertain/failed outcomes.
- A separately callable management service with caller/action/typed-target/field
  limits, conditional request-bound approvals, CAS revisions, and redacted audits.
  `createPodManagement` binds it to real local pod operations and their outcomes.
- Secret-reference and multi-repository interfaces with scoped synthetic values.
  No single-repository assumption, checkout orchestrator, or real secret store.

## Extension boundaries

`src/types.ts` defines `WorkspaceAdapter`, `RuntimeAdapter`, `StateStore`, and
`SecretResolver`. `src/adapters.ts` supplies only mock implementations.

A future Slack or Discourse adapter must establish platform identity/access,
preserve event and history provenance, handle native retry/publication behavior,
and provide accurate readback. A future Claude Code, Codex, ACP, or managed-agent
adapter must map native sessions, configuration acknowledgments, permission
prompts, modalities, and actual cancellation semantics. Those adapters are not
implemented or verified here; matching interface names is not interoperability.

The runtime's `configure()` acknowledgment is separate from saving desired
configuration. A refusal or unknown result cannot advance the observed applied
revision. Tools and permissions stay with their harness/service. Instructions
in a conversation cannot grant management authority or direct resource access.

`ManagementService` is a callable service boundary, **not an MCP transport**.
Its caller context must come from a trusted authenticated host integration, not
JSON supplied by an agent. Grants are immutable snapshots: recreate the service
to revoke or change a grant. Required approvals are looked up afresh and bound
to caller, action, target, limits, exact request digest, and validity window.
Approval records and their issuer authentication are the trusted host's job.
Audits are in memory and omit prompts, credentials, raw payloads, and raw errors.
The console is a single local operator interface; it does not expose this admin
service to agents or implement multi-user login.

For repository work, an authorized runtime would use ordinary Git/network tools
and its scoped credential mechanism. Multiple `repositories` entries reference
the allowed URL/operation/secret scope. The prototype does not store real tokens,
inject credentials into processes, enroll providers, or clone projects.

## Verification

```sh
npm run build:mewpod
npm run lint:mewpod
npm run test:mewpod
npm run demo:mewpod
npm run build
npm test
```

The prototype tests exercise real asynchronous routing and HTTP handlers with
mock runtimes: human participation, same-thread handoffs, deduplication, loops,
history gaps, generation rollover, in-flight late publication, mismatched reply
evidence, queued membership changes, configuration acknowledgments, storage
failures, budget limits, cancellation, approval refusal, multi-repository secret
scope, and executable DOM/XSS cases. Existing CI also runs the repository's
legacy build/unit/integration suite. Check the exact draft-PR commit's CI result.
The root `npm run lint` currently lacks an ESLint 9 configuration; the isolated
`lint:mewpod` command checks this prototype without changing legacy lint policy.

## Deliberate limits and pilot gate

- No real agents are running. Scripted behavior does not validate model judgment,
  prompt-injection resistance, or social coordination quality.
- No live workspace bot, token, event subscription, or mention-to-runtime wake
  path is configured. The local console demonstration is not a Slack wake test.
- No MCP transport, production authorization service, vault, or external durable
  queue. Same-machine users/processes are trusted; do not expose the listener
  through a proxy or tunnel or use it on an untrusted shared host.
- Work records contain conversation/configuration text in plaintext local files.
  Do not put real secrets or sensitive production data in this demo. Local file
  persistence does not promise a database transaction, exactly-once effects,
  cross-process coordination, or native session recovery.
- The current participation policy is explicit `@entity-id` matching and a
  bounded chain limit. Unaddressed human messages remain visible context but do
  not automatically start another turn. Compaction and automatic affinity are
  not implemented.
- Retention is bounded (1,000 tasks and 10,000 messages by default); reaching a
  limit blocks work rather than silently evicting deduplication evidence.
- Scale-down drains, and scope-end withholds output that has not already begun
  publication. No rollback, failover, checkpoint system, arbitrary session
  migration, or universal provider-cost saving is promised.

A later one-machine workspace pilot needs separately authorized platform setup,
runtime choice, and secure credential configuration. Before claiming readiness,
test a real human request, visible peer handoff, actual background completion,
and reply in the original workspace thread, including interruption and failure.
