# MCPx Protocol Specification Changelog

All notable changes to the MCPx protocol specification will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## Versioning Policy

- **v0.x series**: Experimental releases with breaking changes between minor versions
- **v1.0+**: Will follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
- Breaking changes are expected in v0.x releases as the protocol evolves

## [v0.4] - 2025-09-26

### Added
- Participant runtime management messages: `participant/request-status`, `participant/status`, `participant/forget`, `participant/clear`, `participant/restart`, `participant/shutdown`
- Stream lifecycle guidance including `stream/request`, `stream/open`, `stream/close`, and associated binary framing semantics
- Optional HTTP message injection endpoints for gateways that need polling workflows

### Changed
- Protocol identifier bumped to `mew/v0.4`; clients and gateways must agree on the new version identifier

## [v0.1] - 2025-08-27

### Breaking Changes from v0.0
- Protocol identifier changed from `mcp-x/v0` to `mcpx/v0.1`
- Complete restructure of message kinds to namespaced format
- Privilege levels replaced with capability-based access control
- Not backward compatible - v0.0 clients cannot connect to v0.1 gateways

### Added
- **Capability-based access control** replacing binary privilege levels
  - Fine-grained control using wildcard patterns (e.g., `mcp/*`, `mcp/request:tools/*`, `mcp/response:*`)
  - Hierarchical wildcards: `mcp/*` grants all MCP-related capabilities
  - Progressive trust model with expanding capabilities
  - Support for method-specific restrictions
- **Namespaced message kinds** with MCP method information:
  - `mcp/request:METHOD` - MCP requests/notifications (e.g., `mcp/request:tools/call`)
  - `mcp/response:METHOD` - MCP responses (e.g., `mcp/response:tools/call`)
  - `mcp/proposal:METHOD` - Proposed operations (e.g., `mcp/proposal:tools/call`)
- **Self-describing envelopes** - Can parse messages without payload inspection
- **Lazy enforcement model** - Gateway validates capabilities only, agents validate payloads
  - Follows industry patterns (HTTP routers, CDNs, load balancers)
  - Keeps gateway fast and scalable

### Changed
- **Protocol identifier** simplified from `mcp-x` to `mcpx`
- **Chat messages** moved from MCP notification (`notifications/chat/message`) to dedicated `chat` kind
  - Prevents pollution of MCP namespace with custom methods
- **Welcome messages** now include capability list instead of privilege level
- **Gateway role** uses pattern matching on `kind` field only
  - No payload parsing or validation required
  - Remains completely MCP-agnostic

### Security
- **Capability-based security** provides fine-grained access control
- **Lazy enforcement** keeps infrastructure efficient while maintaining security at edges
- **No token theft** - Capabilities tied to connection, not transferable
- **Human-in-the-loop** patterns through proposal/fulfillment model
- **Progressive trust** through incremental capability grants

## [v0.0] - 2025-08-17

### Initial Release
- Topic-based message routing for multi-agent collaboration
- MCP server model for all participants
- WebSocket-based realtime communication
- Simple envelope format with correlation support
- Broadcast and directed messaging patterns
- Presence notifications (join/leave/heartbeat)
- Chat communication via MCP notifications
- Basic token-based authentication

### Key Design Decisions
- All messages visible to all participants (no privacy within topics)
- Focus on MCP tools (resources/prompts out of scope for v0)
- Gateway provides auth, presence, and history
- No built-in task semantics or end-to-end encryption
