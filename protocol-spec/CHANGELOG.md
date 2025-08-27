# MCPx Protocol Specification Changelog

All notable changes to the MCPx protocol specification will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.1] - 2025-08-27

### Added
- **Gateway-enforced privilege separation** for security against rogue agents
  - Two privilege levels: `full` (can send MCP messages) and `restricted` (cannot)
  - Restricted participants must use `mcp/proposal` messages instead
  - Full-privilege participants can fulfill proposals on behalf of restricted ones
- **New message kinds** to cleanly separate MCPx extensions from MCP protocol:
  - `mcp/proposal` - Proposed MCP operations requiring fulfillment
  - `chat` - Native chat messages (moved from MCP notifications)
- **Privilege information in welcome messages** - Participants know their access level
- **Security considerations section** documenting benefits and limitations

### Changed
- **Protocol identifier** simplified from `mcp-x` to `mcpx`
- **Chat messages** moved from MCP notification (`notifications/chat/message`) to dedicated `chat` kind
  - Prevents pollution of MCP namespace with custom methods
- **Gateway role** simplified to only check message kinds, not parse MCP content
  - Gateway remains MCP-agnostic for simpler implementation

### Security
- Prevents unauthorized tool execution at transport layer
- No token theft possible (privileges tied to connection)
- Enables human-in-the-loop oversight for untrusted agents
- Audit trail of all proposals and fulfillments

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