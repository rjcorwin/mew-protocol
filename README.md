# MEW Protocol - Multi-Entity Workspace Protocol

MEW Protocol (pronounced like a cat's "mew") addresses the challenge of "herding cats" - coordinating multiple autonomous AI agents in a shared workspace while maintaining human control through capability-based permissions and progressive trust.

## The Evolution

```
MCP:  human <--> context(agent <--> mcp server)
A2A:  human <--> context(agent <--> agent)
MEW:  workspace(human <--> agent <--> mcp server <--> agent)
```

In MEW Protocol, humans move from **observing** to **participating** - joining agents inside shared workspaces where all operations are visible and controllable.

## Key Features

- **Humans as peers**: Direct participation, not just supervision
- **Capability control**: Participants can only propose operations until granted execution rights
- **Progressive trust**: Capabilities expand based on observed behavior
- **Full visibility**: All participants see all operations in real-time
- **Protocol bridging**: MCP and A2A agents can join via automatic translation

## How It Works

1. Participants join a workspace (or "space") with specific capabilities
2. Untrusted participants propose operations
3. Trusted participants (human or AI) approve and execute
4. Over time, safe patterns earn direct execution rights
5. Humans maintain ultimate control while automation grows

## Current Version

**v0.3** - Released 2025-01-09

MEW Protocol is in experimental phase (v0.x) with breaking changes allowed between versions. See [spec/v0.3/SPEC.md](/spec/v0.3/SPEC.md) for the current specification.

## Quick Start

```yaml
# space.yaml - Configure a workspace
participants:
  human:
    type: key
    capabilities: ["mcp/*", "chat"]
  
  untrusted-agent:
    type: local
    command: "./agent"
    capabilities: ["mcp/proposal", "chat"]
```

## Learn More

- [Current Specification (v0.3)](/spec/v0.3/SPEC.md)
- [Draft Specification (next version)](/spec/draft/SPEC.md)
- [Architecture Decision Records](/spec/v0.3/decisions/)
- [Changelog](/CHANGELOG.md)
- [Examples](/examples/)

## Why "MEW"?

The name playfully evokes "herding cats" - the quintessential challenge of coordinating multiple independent, autonomous agents. MEW Protocol provides the framework to bring order to this chaos, teaching the "cats" to work together effectively in a shared workspace.
