# MCPx Reference Implementation TODO

## Overview
This document outlines the implementation plan for the MCPx reference implementation, including:
1. **Reference Backend Server** - WebSocket gateway implementing the MCPx v0 specification
2. **Reference Frontend** - Human-friendly web interface for joining topics and interacting with MCP agents
3. **Bridge/Adapter Agent** - Standalone agent that connects existing MCP servers to MCPx topics

## Phase 1: Reference Backend Server

### Core Gateway Implementation
- [ ] Set up Node.js/TypeScript project with WebSocket support (ws library)
- [ ] Implement MCPx v0 message envelope validation and routing
- [ ] Create topic-based message broadcasting system
- [ ] Add Bearer token authentication system
- [ ] Implement participant presence tracking (join/leave/heartbeat)
- [ ] Add message history storage and retrieval (in-memory for reference implementation)

### WebSocket API Implementation
- [ ] `GET /v0/ws?topic=<name>` WebSocket endpoint with auth
- [ ] System welcome message on connection
- [ ] Real-time bidirectional envelope forwarding
- [ ] Connection lifecycle management (graceful disconnect, reconnection handling)

### REST API Implementation (Optional Helpers)
- [ ] `GET /v0/topics` - list visible topics
- [ ] `GET /v0/topics/{topic}/participants` - current presence
- [ ] `GET /v0/topics/{topic}/history` - message history with pagination

### Security & Validation
- [ ] Envelope schema validation (protocol, required fields)
- [ ] Participant identity verification (`from` field matches auth)
- [ ] Rate limiting per participant
- [ ] Chat message spam prevention

## Phase 2: Reference Frontend

### Core Web Interface
- [ ] Set up React/TypeScript project with WebSocket client
- [ ] Topic selection and joining interface
- [ ] Real-time message display with envelope details
- [ ] Participant presence sidebar
- [ ] Message history loading

### MCP Client Integration
- [ ] MCP client library integration for tool discovery
- [ ] Tool calling interface with parameter forms
- [ ] MCP initialize/initialized handshake handling
- [ ] Response and error display

### Chat Features
- [ ] Chat message composition and sending
- [ ] Broadcast chat notifications display
- [ ] Message formatting support (plain/markdown)

### UX/UI Polish
- [ ] Responsive design for desktop and mobile
- [ ] Dark/light theme support
- [ ] Message timestamps and participant colors
- [ ] Tool call confirmation dialogs for sensitive operations

## Phase 3: Bridge/Adapter Agent

### Configuration System
- [ ] Command-line interface for initial setup
- [ ] Configuration file format for connection details:
  - MCPx server URL and topic
  - Authentication token
  - Target MCP server connection (stdio/websocket/sse)
  - Participant identity and metadata

### MCP Server Bridging
- [ ] Connect to existing MCP servers (stdio/websocket/sse transports)
- [ ] Proxy MCP tool/resource/prompt capabilities to MCPx topic
- [ ] Handle MCP lifecycle (initialize/initialized) for both sides
- [ ] Bidirectional message routing with proper correlation

### MCPx Integration
- [ ] Connect to MCPx gateway via WebSocket
- [ ] Implement envelope wrapping/unwrapping
- [ ] Presence management and discovery
- [ ] Error handling and reconnection logic

### Agent Features
- [ ] Tool discovery broadcasting on join
- [ ] Automatic MCP handshake with interested participants
- [ ] Health monitoring and status reporting
- [ ] Graceful shutdown and cleanup

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
- [ ] Multiple MCP servers can join a topic and discover each other
- [ ] Human users can interact with agents through the web frontend
- [ ] Tool calls flow correctly between participants
- [ ] Bridge agent successfully exposes existing MCP servers to MCPx
- [ ] All core MCPx v0 spec features are implemented and tested


## Wish list
- [ ] UI for exploring channels, adding channels, joining channels, configuring channels.
- [ ] Zen mode support for channels chat view that centers the chat with room to breath all around it.
- [ ] Support for channel "scenes". A background image for a channel.
- [ ] Support for animating the opening of channels.
- [ ] Support for automatically generating an image for a channel based on its description (choose what art to base it on).
- [ ] Pattern for managing bridges to number of MCP servers and getting them to start/stop with the MCPx as a whole.
- [ ] Rejoin a session (password/token need when creating session?)
- [ ] UI maintains session between reloads
- [ ] Agent example that, given a user's suggestion in the chat, makes some MCP call.
- [ ] UI support for dynamically injecting Web Components for interacting with specific MCP tool(s), AKA tool component (better name?).
- [ ] Agent, that on request, generates a Tool Component for a user in the topic. User reviews, accepts, and then has it handy for using without having to go to the devtools.
- [ ] Agents that set up a town and explore locations (topics), living out their life.
- [ ] A simple robot MCP server that other agents can control around an environment. Can start with a simulation, even if that's a top down environment (ie. snake-game, legend of zelda SNES).