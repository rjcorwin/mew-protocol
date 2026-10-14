# [m2s] Existing primitives, MEW glue, and tradeoffs

Status: background for the revised specification-only proposal.
Official documentation checked on 2026-10-14. Adapter implementations must pin and
verify the actual protocol/API versions and configured permissions they use.

## Why the boundary changes

The earlier MEW design put capability enforcement, MCP proposals/fulfillment,
and shared operation visibility at its own gateway. The repository's released
wire specification is v0.4; the package version is 0.11.0. This v2 direction is a
conceptual redesign, not a promise to preserve every earlier guarantee under
new terminology.

Modern harnesses and managed runtimes already own substantial parts of execution,
tools, permissions, and session lifecycle. The useful integration question is how
to connect those primitives to shared conversations and entity lifecycles.

## Existing primitives

### Workspace platforms

Slack supplies authenticated account identity, scoped conversation access,
messages, history, and thread references. Its Events API uses best-effort delivery
with retries; a callback is not an exactly-once execution guarantee.
Sources: [auth.test](https://docs.slack.dev/reference/methods/auth.test/),
[Conversations API](https://docs.slack.dev/apis/web-api/using-the-conversations-api/),
[Events API](https://docs.slack.dev/apis/events-api/).

Discourse supplies topic/post resources and API posting identity. API keys can be
restricted to a user, and API scopes restrict rather than expand that user's
permissions. Its conversation structure should be mapped on its own terms rather
than forced into a Slack-shaped thread model.
Sources: [API identity and scopes](https://meta.discourse.org/t/create-and-configure-an-api-key/230124),
[official API examples](https://meta.discourse.org/t/discourse-rest-api-comprehensive-examples/274354).

### Harnesses and runtime protocols

ACP v1 defines session creation, prompt turns, streamed updates, permission
requests, and cancellation. Loading an existing session depends on the advertised
loadSession capability. Cancellation is a lifecycle exchange; updates can still
arrive before the cancelled prompt response.
Sources: [ACP session setup](https://agentclientprotocol.com/protocol/v1/session-setup),
[ACP prompt turns](https://agentclientprotocol.com/protocol/v1/prompt-turn).

Claude Code's programmatic interface exposes continuation, configuration, and
permission controls. Its SDK permission mechanisms include rules, modes, hooks,
and callbacks; their ordering matters. A routing classifier is not a substitute
for those mechanisms.
Sources: [programmatic Claude Code](https://code.claude.com/docs/en/headless),
[SDK permissions](https://code.claude.com/docs/en/agent-sdk/permissions).

Codex App Server exposes threads, turns, interruption, sandbox/approval policy,
and approval request/response lifecycles. An adapter can surface those native
controls instead of inventing a second approval protocol.
Source: [Codex App Server](https://learn.chatgpt.com/docs/app-server).

### Managed providers

Claude Managed Agents distinguishes agent configuration, environments, sessions,
and events, with managed or self-hosted execution options. Conversation persistence,
sandbox retention, and interruption have different semantics. An interrupt may
queue behind work and is not a universal termination/rollback primitive.
Sources: [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview),
[sessions](https://platform.claude.com/docs/en/managed-agents/sessions),
[events and streaming](https://platform.claude.com/docs/en/managed-agents/events-and-streaming).

## Responsibility map

| Concern | Reuse from existing systems | MEW integration responsibility |
| --- | --- | --- |
| Conversation identity/access | Workspace account identity, membership, token scopes, ACLs | Bind an entity to the correct account and allowed surfaces; preserve source attribution |
| Tools and permissions | Harness/provider tools, sandbox and permission/approval controls | Configure approved settings and relay native prompts/status accurately |
| Sessions | Runtime/provider session and continuation APIs | Choose a declared session policy; map entity, scope, context, and session handle |
| Conversation shape | Native channels, topics, posts, replies, and history | Map work scopes onto those surfaces without mandatory special subthreads |
| Capacity | Local processes/slots and managed execution resources | Allocate/scale eligible workers within authorized limits; report unsupported movement/resume |
| Work lifecycle | Provider start/stop/close operations where available | Define scope start/end, routing generation, queues, and late-output policy |
| Context limits | Harness/provider context management and compaction | Select relevant workspace context; disclose gaps and avoid conflating compaction with scope end |
| Participation | Models, classifiers, instructions, messaging tools | Configure/evaluate engagement, quiet, handoff, and social conventions |

The third column is a proposed architecture inference from these primitives, not
a claim that the providers already implement MEW or that every integration is
available without further engineering.

## Guarantees deliberately not carried forward by default

- One MEW-owned capability/proposal engine governing every native tool/resource.
- A complete shared protocol trace of all runtime-native operations.
- Mandatory structured handshakes or task/subthread hierarchies for conversation.
- Uniform durability, exactly-once effects, lossless replay, session mobility,
  interruption, or automatic worker recovery across providers.

Actual platform/harness enforcement remains essential. Participation instructions
and classifiers influence behavior; they do not authenticate authors, grant
access, or prove that a tool execution is permitted.

## What remains to validate

The documentation supports the adapter boundaries, not the behavioral claim that
entities will coordinate well. That needs evaluations of missed work, duplicate
work, noise, loops, handoff completion, context confusion, and human intervention.
The same scenarios should be tested across different participation policies and
runtime capabilities. Mock adapters alone cannot answer those questions.

No live account configuration, provider call, permission change, worker operation,
or implementation was performed for this revised specification proposal.
