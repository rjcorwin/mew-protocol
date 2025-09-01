# MECP - Multi-Entity Context Protocol

MECP enables humans to participate directly inside shared contexts with AI agents, maintaining control through capability-based permissions and progressive trust.

## The Evolution

```
MCP:  human <--> context(agent <--> mcp server)
A2A:  human <--> context(agent <--> agent)
MECP: context(human <--> agent <--> mcp server <--> agent)
```

In MECP, humans move from **observing** to **participating** - joining agents inside shared contexts called "pods" where all operations are visible and controllable.

## Key Features

- **Humans as peers**: Direct participation, not just supervision
- **Capability control**: Participants can only propose operations until granted execution rights
- **Progressive trust**: Capabilities expand based on observed behavior
- **Full visibility**: All participants see all operations in real-time
- **Protocol bridging**: MCP and A2A agents can join via automatic translation

## How It Works

1. Participants join a pod with specific capabilities
2. Untrusted participants propose operations
3. Trusted participants (human or AI) approve and execute
4. Over time, safe patterns earn direct execution rights
5. Humans maintain ultimate control while automation grows

## Status

Draft specification in active development. See `/modelcontextpodprotocol/draft/` for details.

## Quick Start

```yaml
# pod.yaml - Configure a pod
participants:
  human:
    type: key
    capabilities: ["mcp/*", "chat"]
  
  untrusted-agent:
    type: local
    command: "./agent"
    capabilities: ["mcp/proposal:*", "chat"]
```

## Learn More

- [Protocol Specification](/modelcontextpodprotocol/draft/SPEC.md)
- [Architecture Decision Records](/modelcontextpodprotocol/draft/decisions/proposed/)
- [Examples](/examples/)
