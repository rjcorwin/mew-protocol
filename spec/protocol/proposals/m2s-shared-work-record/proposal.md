# [m2s] MEW v2: glue for a multi-entity workspace

Status: **revised proposal for review; specification only**.

## The proposal

MEW v2 connects places where people talk to the runtimes where entities work.
Humans and agents share ordinary conversations. Each entity can participate,
work, report back, hand something to another entity, or stay quiet.

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
   Session policy belongs here. A topic/thread is context, not automatically a
   new runtime session; an ongoing scope can preserve one entity's session across
   several conversations when their access boundaries are compatible.
3. **Participation.** Instructions, classifiers, messaging tools, and shared
   social norms help an entity decide when to engage, stay quiet, ask a question,
   or hand work over. Modern models' ability to coordinate this way is a hypothesis
   to evaluate. Prompts and classifiers are not authentication or authorization.

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
before implementation. This revision contains no implementation or deployment.
