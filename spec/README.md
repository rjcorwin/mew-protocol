# MCPx Specification

This directory contains the specification and architecture documents for MCPx (Model Context Protocol Extension).

## Contents

### v0/
The initial version of the MCPx specification:

- **[SPEC.md](v0/SPEC.md)** - The complete MCPx v0 specification defining the protocol for multi-party MCP communication
- **[ARCHITECTURE.md](v0/ARCHITECTURE.md)** - Architectural design and implementation details
- **[PATTERNS.md](v0/PATTERNS.md)** - Common patterns and best practices for implementing MCPx
- **[decisions/](v0/decisions/)** - Architecture decision records (ADRs) documenting key design choices

## Overview

MCPx extends the Model Context Protocol (MCP) to enable multiple participants (humans and agents) to communicate in shared topics. It provides:

- Topic-based communication channels
- Participant discovery and presence
- Tool and capability sharing between MCP servers
- WebSocket-based real-time messaging
- Authentication and authorization

## Version History

- **v0** (Current) - Initial specification supporting WebSocket transport, JWT authentication, and core messaging patterns

## Contributing

To propose changes or additions to the specification, please open an issue or pull request in the main MCPx repository.