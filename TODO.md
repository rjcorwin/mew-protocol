# MCPx Reference Implementation TODO

## Overview
This document outlines the implementation plan for the MCPx reference implementation, including:
1. **Reference Backend Server** - WebSocket gateway implementing the MCPx v0 specification
2. **Reference Frontend** - Human-friendly web interface for joining topics and interacting with MCP agents
3. **Bridge/Adapter Agent** - Standalone agent that connects existing MCP servers to MCPx topics

## Phase 1: Reference Backend Server

### Core Gateway Implementation
- [x] Set up Node.js/TypeScript project with WebSocket support (ws library)
- [x] Implement MCPx v0 message envelope validation and routing
- [x] Create topic-based message broadcasting system
- [x] Add Bearer token authentication system
- [x] Implement participant presence tracking (join/leave/heartbeat)
- [x] Add message history storage and retrieval (in-memory for reference implementation)

### WebSocket API Implementation
- [x] `GET /v0/ws?topic=<name>` WebSocket endpoint with auth
- [x] System welcome message on connection
- [x] Real-time bidirectional envelope forwarding
- [x] Connection lifecycle management (graceful disconnect, reconnection handling)

### REST API Implementation (Optional Helpers)
- [x] `GET /v0/topics` - list visible topics
- [x] `GET /v0/topics/{topic}/participants` - current presence
- [x] `GET /v0/topics/{topic}/history` - message history with pagination

### Security & Validation
- [x] Envelope schema validation (protocol, required fields)
- [x] Participant identity verification (`from` field matches auth)
- [x] Rate limiting per participant
- [x] Chat message spam prevention

## Phase 2: Reference Frontend

### Core Web Interface
- [x] Set up React/TypeScript project with WebSocket client
- [x] Topic selection and joining interface
- [x] Real-time message display with envelope details
- [x] Participant presence sidebar
- [x] Message history loading

### MCP Client Integration
- [x] MCP client library integration for tool discovery
- [x] Tool calling interface with parameter forms
- [x] MCP initialize/initialized handshake handling
- [x] Response and error display

### Chat Features
- [x] Chat message composition and sending
- [x] Broadcast chat notifications display
- [x] Message formatting support (plain/markdown)

### UX/UI Polish
- [x] Responsive design for desktop and mobile
- [x] Dark/light theme support
- [x] Message timestamps and participant colors
- [ ] Tool call confirmation dialogs for sensitive operations

## Phase 3: Bridge/Adapter Agent

### Configuration System
- [x] Command-line interface for initial setup
- [x] Configuration file format for connection details:
  - MCPx server URL and topic
  - Authentication token
  - Target MCP server connection (stdio/websocket/sse)
  - Participant identity and metadata

### MCP Server Bridging
- [x] Connect to existing MCP servers (stdio/websocket/sse transports)
- [x] Proxy MCP tool/resource/prompt capabilities to MCPx topic
- [x] Handle MCP lifecycle (initialize/initialized) for both sides
- [x] Bidirectional message routing with proper correlation

### MCPx Integration
- [x] Connect to MCPx gateway via WebSocket
- [x] Implement envelope wrapping/unwrapping
- [x] Presence management and discovery
- [x] Error handling and reconnection logic

### Agent Features
- [x] Tool discovery broadcasting on join
- [x] Automatic MCP handshake with interested participants
- [x] Health monitoring and status reporting
- [x] Graceful shutdown and cleanup

## Phase 4: Testing & Documentation

### Integration Testing
- [ ] End-to-end test scenarios with multiple participants
- [ ] MCP tool calling flows
- [ ] Error handling and edge cases
- [ ] Performance testing with message throughput

### Documentation
- [ ] API documentation with OpenAPI spec
- [ ] Getting started guide with examples
- [ ] Bridge/adapter setup tutorial
- [ ] Troubleshooting guide

### Example Implementations
- [ ] Simple calculator MCP server
- [ ] Weather service integration
- [ ] Multi-agent coordination examples

## Phase 5: Platform Integrations

### Slack Integration
- [ ] Create MCPx-Slack gateway server that translates between protocols
- [ ] Map Slack channels to MCPx topics
- [ ] Translate Slack users to MCPx participants
- [ ] Handle Slack slash commands as MCP tool invocations
- [ ] Render MCP tool responses as Slack blocks/attachments
- [ ] Support Slack apps/bots as MCP servers via the bridge
- [ ] Handle rate limiting and backpressure between systems
- [ ] Documentation for Slack workspace administrators

### Future Platform Integrations
- [ ] Discord integration (similar to Slack)
- [ ] XMPP/Jabber bridge for federated chat systems
- [ ] Matrix protocol bridge for decentralized communication
- [ ] Microsoft Teams integration
- [ ] IRC bridge for legacy systems

## Implementation Notes

### Technology Stack
- **Backend**: Node.js + TypeScript + ws (WebSocket) + express (REST)
- **Frontend**: React + TypeScript + WebSocket client
- **Bridge**: Node.js + TypeScript + MCP SDK

### Directory Structure
```
/
├── server/           # Reference backend server
├── frontend/         # Reference web frontend  
├── bridge/           # Bridge/adapter agent
├── examples/         # Example MCP servers and scenarios
├── docs/             # Implementation guides
└── tests/            # Integration tests
```

### Configuration Examples

#### Bridge Configuration (`bridge-config.json`)
```json
{
  "mcpx": {
    "server": "ws://localhost:3000",
    "topic": "room:dev",
    "token": "your-auth-token"
  },
  "participant": {
    "id": "weather-service",
    "name": "Weather Service",
    "kind": "agent"
  },
  "mcp_server": {
    "transport": "stdio",
    "command": "python",
    "args": ["weather-server.py"]
  }
}
```

#### Server Configuration (`server-config.json`)
```json
{
  "port": 3000,
  "auth": {
    "secret": "your-jwt-secret",
    "tokenExpiry": "1h"
  },
  "topics": {
    "maxParticipants": 50,
    "historyLimit": 1000
  },
  "rateLimit": {
    "messagesPerMinute": 60,
    "chatMessagesPerMinute": 10
  }
}
```

## Success Criteria
- [x] Multiple MCP servers can join a topic and discover each other
- [x] Human users can interact with agents through the web frontend
- [x] Tool calls flow correctly between participants
- [x] Bridge agent successfully exposes existing MCP servers to MCPx
- [x] All core MCPx v0 spec features are implemented and tested


## Wishlist
- [x] W001: Agent example that, given a user's suggestion in the chat, makes some MCP call.
- [ ] W002: agent config in ~/.mcpx/agent-config.json no scaleable to multiple agents, unless working in containers. Figure out the pattern. Explore patterns for managing agents. Something like mcpx-hub or something. Then mcpx-studio is a UI for managing it.
- [ ] W003: Organize folders. For example, the v0 folder no longer seems like it is a spec folder. Seems random. Then we have various pieces of software. Packages and specs maybe? Also there is this docs folder which needs to go somewhere else maybe.
- [ ] W004: More sophisticated agent that keeps calling tools until it has accomplished the task.
- [ ] W005: In frontend, only seeing initialized MCP messages. Where are the others? (what do I see in mcpx-chat cli?)
- [ ] W006: Code review!
- [ ] W007: Docs
- [ ] W008: Release npm packages?

- [ ] W009: Zen mode support for channels chat view that centers the chat with room to breath all around it.
- [ ] W010: Support for channel "scenes". A background image for a channel.
- [ ] W011: Support for animating the opening of channels.
- [ ] W012: Support for automatically generating an image for a channel based on its description (choose what art to base it on).
- [ ] W013: Pattern for managing bridges to number of MCP servers and getting them to start/stop with the MCPx as a whole.
- [ ] W014: Rejoin a session (password/token need when creating session?)
- [ ] W015: UI maintains session between reloads
- [ ] W016: Participant pictures (could be an MCP tool every participant has. MCP Bridge would supplement the MCP server it is representing with this tool and picture selection would be part of config).
- [ ] W017: UI support for dynamically injecting Web Components for interacting with specific MCP tool(s), AKA tool component (better name?).
- [ ] W018: Agent, that on request, generates a Tool Component for a user in the topic. User reviews, accepts, and then has it handy for using without having to go to the devtools.
- [ ] W019: Agents that set up a town and explore locations (topics), living out their life.
- [ ] W020: A simple robot MCP server that other agents can control around an environment. Can start with a simulation, even if that's a top down environment (ie. snake-game, legend of zelda SNES).
- [ ] W021: MCPx Studio for downloading MCP servers and connecting them. Managing topics. Creating new agents with specific prompts and names.
  - [ ] W021.1: UI for exploring channels, adding channels, joining channels, configuring channels.

## Known Issues to Investigate

### mcpx-cli Issues
- [ ] I001: Detached mode timing - Commands don't exit immediately in detached mode when starting server/frontend/agents (processes do start but command hangs)
- [ ] I002: Frontend script issue - Frontend manager uses `npm run dev` but no production build script exists
- [ ] I003: Server process cleanup - Server PID file sometimes persists after process dies, causing status command to show incorrect state
- [ ] I004: Agent stdio issues when started via `mcpx start --no-frontend` - Some agents fail to start with stdio errors

### Integration Issues  
- [ ] I005: Chat message event emitter - MCPxChatClient doesn't properly expose event emitter for message handling in non-interactive mode
- [ ] I006: Auth endpoint hardcoding - Some components still have hardcoded localhost:3000 instead of deriving from server URL