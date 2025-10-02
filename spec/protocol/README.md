# MCPx Protocol Specifications

This directory contains the protocol specifications for MCPx (MCP Extension Protocol), which extends the Model Context Protocol for multi-agent coordination.

## Structure

```
protocol-spec/
├── README.md        # This file
└── v0/             # Version 0 of the protocol
    ├── SPEC.md     # Main protocol specification
    ├── PATTERNS.md # Common implementation patterns
    ├── ARCHITECTURE.md # System architecture
    └── decisions/  # Protocol design decisions
        └── decision-1.md
```

## Contents

### v0/
The initial version of the MCPx protocol specification:

- **[SPEC.md](v0/SPEC.md)** - The complete MCPx v0 protocol specification defining envelope format, messaging patterns, and gateway API
- **[PATTERNS.md](v0/PATTERNS.md)** - Common implementation patterns and best practices for MCPx
- **[ARCHITECTURE.md](v0/ARCHITECTURE.md)** - System architecture and implementation details
- **[decisions/](v0/decisions/)** - Architecture decision records documenting protocol design choices

## Overview

MCPx extends the Model Context Protocol (MCP) to enable multiple participants (humans, agents, robots) to coordinate in shared topics. It provides:

- **Topic-based rooms**: Named spaces where participants interact
- **Envelope protocol**: Message wrapping for routing and correlation
- **Peer-to-peer MCP**: All participants act as MCP servers
- **Real-time gateway**: WebSocket-based messaging with presence
- **Unified participation**: Humans, agents, and robots as equal peers

## Key Concepts

- **Topics**: Named rooms (e.g., `room:alpha`) where participants collaborate
- **Participants**: Any client that joins a topic and exposes MCP tools
- **Envelopes**: JSON wrappers containing MCP messages with routing metadata
- **Visibility**: All messages in a topic are visible to all participants (no privacy at protocol layer)

## Version History

- **v0** (Current) - Initial specification focusing on MCP tools, WebSocket transport, and core envelope format

## Related Specifications

- **SDK Specification**: See [`../sdk-spec/`](../sdk-spec/) for MCPx SDK architecture and client libraries
- **MCP Specification**: See [`../../modelcontextprotocol/`](../../modelcontextprotocol/) for the base Model Context Protocol

## Quick Links

- [Protocol Specification](v0/SPEC.md) - Main MCPx v0 specification
- [Implementation Patterns](v0/PATTERNS.md) - Common patterns and examples
- [System Architecture](v0/ARCHITECTURE.md) - Architecture overview
- [SDK Architecture](../sdk-spec/mcpx-sdk-architecture.md) - Client and agent libraries