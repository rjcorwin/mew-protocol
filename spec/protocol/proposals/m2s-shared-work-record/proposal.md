# [m2s] MEW v2: glue for a multi-entity workspace

Status: **proposal under review, with an isolated exploratory prototype**.

## The proposal

MEW v2 connects places where people talk to the runtimes where entities work.
Humans and agents share ordinary conversations. Each entity can participate,
work, report back, hand something to another entity, or stay quiet.

A local orchestrator with several sessions in tmux can demonstrate this workspace,
but capacity is capped by the available machines. A core motivation for MEW is
elasticity: add seats when work grows and release capacity when it subsides,
within approved budgets, provider quotas, and available capacity. Local-first
operation remains useful, and interchangeable runtime adapters leave room for
other providers as the ecosystem changes. Affordability is deployment-specific;
elasticity does not imply automatic cost savings or live session migration.
Recovery is a useful optional runtime/provider capability, not a problem MEW
sets out to solve. MEW works one layer higher: gluing entities together and
managing their participation and scale.

Modern harnesses already provide tools, permission controls, execution sessions,
and provider-specific lifecycle operations. MEW should compose those primitives
instead of recreating a general tool gateway, capability language, or mandatory
proposal/approval protocol.

The design has three pieces:

1. **Workspace/runtime adapters.** Pluggable interfaces connect workspaces such
   as Slack or Discourse with runtimes such as Claude Code, Codex, ACP-compatible
   agents, or a managed-agent provider. Messages enter through the workspace;
   replies return under the entity's configured identity. Another entity engages
   with the shared conversation, rather than a hidden delegation channel.
2. **Entity lifecycle and work scope.** Configure an entity, give it explicitly
   authorized workspace access, map its channels/topics, and start or end a work
   scope. A worker pool can place or scale entities on local or managed providers.
   Its demand-driven lifecycle keeps entity identity, work scope, and session
   policy distinct from worker placement. Scaling uses supported start/stop
   behavior and reports failures or provider limits without promising recovery.
   Session policy belongs here. A topic/thread is context, not automatically a
   new runtime session; an ongoing scope can preserve one entity's session across
   several conversations when their access boundaries are compatible.
3. **Participation.** Instructions, classifiers, messaging tools, and shared
   social norms help an entity decide when to engage, stay quiet, ask a question,
   or hand work over. Modern models' ability to coordinate this way is a hypothesis
   to evaluate. Prompts and classifiers are not authentication or authorization.

Two patterns fit within those pieces:

- **A resource can have a participant.** Its MCP connections, tools, and
  credentials stay in its own harness. Others ask it to use the resource through
  ordinary conversation; they do not inherit its credentials or direct access.
  Instructions guide its judgment, while harness/tool/service permissions bound
  its powers. An allowed tool can still be misused or return information that
  should not reach the conversation, so requester, operation, resource, and output
  scope need explicit constraints and positive/negative evaluation.
- **Administration can use a management MCP.** Designated human or agent admins
  can create entities and manage configuration, prompts, tools, and membership.
  The service authenticates the caller and checks each action and target; merely
  having the tool or claiming to be an admin grants no blanket authority. Existing
  platform/runtime permissions still govern the actual changes.

These are uses of existing tool primitives, not a universal protocol-level tool
bus. Resource collaboration belongs to adapters and participation; administration
belongs to entity lifecycle. Neither pattern changes work-scope/session boundaries.

The draft also distinguishes configured from ready entities, includes shared resource limits, and requires accurate adapter reporting and action/target matching for any required approval.

## What changes from the earlier design

The focus is integration and participation, not MEW-enforced control of every
operation. Workspace platforms govern conversation identity/access. Harnesses and
providers govern tools, permissions, and execution. MEW keeps the mappings and
lifecycle coherent and makes adapter limitations visible.

This deliberately gives up a universal MEW capability/proposal enforcement layer,
complete protocol-level visibility of every native tool call, and uniform
persistence/recovery guarantees. It does not promise exactly-once effects or
identical interruption behavior across providers. Ordinary conversations do not
need a mandatory envelope, two-part exchange, or special subthread hierarchy.

## Review first

- [Draft contract and scenarios](SPEC-v2-DRAFT.md)
- [Existing primitives and responsibilities](research.md)
- [Design decisions and remaining questions](decision-m2s-shared-work-record.md)

Review the adapter boundaries, work-scope lifecycle, and participation examples
alongside the [Mewpod prototype and feedback](implementation.md). This branch
contains an offline local experiment; it configures no live integration or deployment.
