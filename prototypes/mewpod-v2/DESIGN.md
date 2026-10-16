# Catbox: patterns, requirements, and replaceable choices

Catbox is a reference demo of MEW's collaboration ideas. Read it as a set of
observable examples, not an SDK to standardize around. The scenarios and their
requirements can be useful even when you replace every implementation detail.

## Follow one piece of work

1. A human posts `@builder prepare a change` in `project` / `ticket-a`.
2. The workspace records the ordinary message and the builder receives a task.
3. Capacity admits a turn into that entity's session for the current work scope.
4. The builder posts progress and an ordinary `@reviewer` message in the thread.
5. The reviewer observes that message through the same workspace path and runs
   its own turn when capacity allows.
6. Each final publication is read back and matched to its task before the task
   claims completion. Its result link points to that exact conversation message.

The routing, queue, validation, HTTP handlers, and local persistence execute real
code. The builder's work and the review are scripted; no change is made to a
repository and no model evaluates it. Human clarifications are visible context,
but these deterministic scripts do not demonstrate model reasoning about them.

## Experiments and the requirements they expose

### Shared participation and visible handoffs

**Try:** Send the builder request, then add a human clarification in the same
thread. Watch the builder's review request produce a reviewer task.

**Look for:** The reviewer task's source is the visible handoff message. Humans
can read and contribute to the same conversation. A private peer callback must
not supply work or results absent from that conversation.

**Inspect:** [demo.ts](src/demo.ts), [pod.ts](src/pod.ts), and the end-to-end
HTTP-to-work-record assertions in [console-integration.test.ts](tests/console-integration.test.ts).

### Identity, session, scope, and capacity are different things

**Try:** Set capacity to zero and post a request. Resume with one worker. Post
another request in `ticket-b` within the same active scope.

**Look for:** Queued work starts only when capacity permits. Configured entities
exist without a reserved worker. Compatible threads can share an entity's scope
session. A new conversation thread does not automatically create a new session.
Lowering capacity drains active turns rather than pretending to stop them.

**Inspect:** [types.ts](src/types.ts) and the session, queue, scope, audience-change,
and budget cases in [pod.test.ts](tests/pod.test.ts). Numeric resource units are
simulation limits, not provider prices or demonstrated cloud autoscaling.

### Completion needs evidence; interruption needs honest language

**Try:** Follow a completed task's result link. During another run, compare
requesting cancellation for the builder and reviewer. Read each runtime's
capability description; timing may allow a short task to finish first.

**Look for:** The final message matches workspace, entity, conversation, thread,
content, kind, and scope. A cancellation request remains distinct from a
confirmed stop. Ending a scope closes routing without proving a runtime stopped;
late output cannot activate a successor scope.

**Inspect:** [adapters.ts](src/adapters.ts), [adapters.test.ts](tests/adapters.test.ts),
and the publication/cancellation/generation tests in [pod.test.ts](tests/pod.test.ts).

### Resource participation does not transfer authority

**Try:** Ask `@catalog list the authorized projects`, then ask it for credentials
or the out-of-scope example `project-c`.

**Look for:** A resource participant can report a scoped result while its
synthetic credential stays inside its harness. Resolver grants independently
bound the entity, repository, and operation. Scripted refusal examples are not
proof of general disclosure safety or prompt-injection resistance.

**Inspect:** [demo.ts](src/demo.ts), [management.ts](src/management.ts), and
[management.test.ts](tests/management.test.ts). The separate administration
boundary has caller/action/target/field and approval checks; see
[admin.test.ts](tests/admin.test.ts). Conversation text grants no admin authority.

## Inspect, adapt, replace

Start with the smallest surface relevant to the question you want to explore:

| Surface | Where to look | What can change |
| --- | --- | --- |
| Cast and scenarios | [demo.ts](src/demo.ts) | Roles, scripted turns, delays, example resources |
| Collaboration contracts | [types.ts](src/types.ts) | Interface shapes; preserve provenance and honest capabilities |
| Workspace/runtime choices | [adapters.ts](src/adapters.ts) | Chat surfaces and harness bindings, with their actual access and semantics |
| Routing and lifecycle | [pod.ts](src/pod.ts) | Orchestration strategy, participation rules, scheduling |
| Work-record storage | [store.ts](src/store.ts) | Storage mechanism, with explicit failure/restart guarantees |
| Scoped resources/admin | [management.ts](src/management.ts), [admin.ts](src/admin.ts) | Trusted-host integrations and enforcement implementation |
| Demonstration surface | [server.ts](src/server.ts), [cli.ts](src/cli.ts) | This console, another UI, or a different scenario runner |
| Executable examples | [tests/](tests/) | Reuse or translate assertions into another implementation |

For a small local experiment, edit the scripted plans in `createDemo`, run
`npm run test:catbox`, and try `npm run demo:catbox`. Add a test when exploring a
different invariant or failure. The existing `mewpod` command names, paths,
internal classes, and record format are retained for compatibility, not as a
requirement for another implementation.

A replacement can use another language, harness, storage layer, or UI. Explain
which requirements it demonstrates, which assumptions changed, and what remains
unverified. Interface-name similarity alone does not prove interoperability.

## What this demonstration does not establish

Mocks exercise integration contracts, not real model judgment, platform identity,
live permission enforcement, native runtime recovery, or provider scaling.
Actual services need their own implementation and evidence, including failures
and interruption. Keep the demo local and synthetic; see the
[README's boundaries and limits](README.md#deliberate-limits-and-a-real-integration-evaluation).
