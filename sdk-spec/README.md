# MCPx SDK Specifications

This directory contains the specifications for the MCPx SDK, which provides the libraries and tools for building MCPx applications.

## Structure

```
sdk-spec/
├── README.md                    # This file
├── mcpx-sdk-architecture.md    # Main SDK architecture specification
└── decisions/                  # Architecture Decision Records
    ├── README.md               # ADR index
    ├── 001-layered-architecture.md
    ├── 002-client-layer-design.md
    ├── 003-agent-memory-system.md
    └── 004-biome-participant-model.md
```

## Overview

The MCPx SDK is organized as a four-layer architecture:

1. **@mcpx-protocol/client** - Protocol handling layer
2. **@mcpx-protocol/agent** - Generic agent abstractions
3. **@mcpx-protocol/biome-agent** - Biomes-specific framework
4. **Concrete implementations** - Actual agents and applications

## Related Specifications

- **Protocol Specification**: See `../protocol-spec/` for the MCPx wire protocol
- **MCP Specification**: See `../../modelcontextprotocol/` for the base MCP protocol

## Quick Links

- [SDK Architecture](mcpx-sdk-architecture.md) - Full SDK design
- [Architecture Decisions](decisions/README.md) - Key design decisions
- [Protocol Spec](../protocol-spec/v0/SPEC.md) - MCPx protocol specification