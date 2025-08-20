# MCPx Architecture Guide

## Overview

MCPx creates a collaborative environment where humans, AI agents, and robots interact as peers through a shared messaging fabric. This document describes how the various components connect and interact in an MCPx-based system.

## Core Architecture Principles

1. **Peer Equality**: Every participant (human, agent, robot) is an MCP server capable of exposing and calling tools
2. **Topic-Based Routing**: All communication happens within named topics (rooms) where messages are visible to all participants
3. **Protocol Transparency**: MCP messages flow unchanged through the system, wrapped in thin routing metadata
4. **Decoupled Components**: Each component has a single responsibility and communicates through well-defined interfaces

## System Components

### 1. MCPx Gateway Server

The gateway is the central hub that manages topics and routes messages between participants.

```
┌────────────────────────────────────────┐
│           MCPx Gateway Server          │
│                                        │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │ WebSocket    │  │  REST API       │ │
│  │ Handler      │  │  (Optional)     │ │
│  └──────────────┘  └─────────────────┘ │
│         │                  │           │
│  ┌──────────────────────────────────┐  │
│  │     Topic Service                │  │
│  │  - Message routing               │  │
│  │  - Presence tracking             │  │
│  │  - History management            │  │
│  └──────────────────────────────────┘  │
│         │                              │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │ Auth Service │  │ Rate Limiter    │ │
│  └──────────────┘  └─────────────────┘ │
└────────────────────────────────────────┘
```

**Responsibilities:**
- Accept WebSocket connections with JWT authentication
- Validate and route message envelopes between participants
- Track participant presence (join/leave/heartbeat)
- Store message history for late-joining participants
- Enforce rate limits and security policies

**Key Design Decisions:**
- Stateless where possible (JWT auth, no session state)
- In-memory storage for v0 (can be replaced with persistent storage)
- No message transformation—purely routing and broadcasting

### 2. MCPx Bridge

The bridge connects existing MCP servers to MCPx topics, acting as a protocol translator.

```
┌───────────────────────────────────────┐
│            MCPx Bridge                │
│                                       │
│  ┌──────────────┐  ┌────────────────┐ │
│  │ MCPx Client  │  │  MCP Client    │ │
│  │ (WebSocket)  │  │  (stdio/ws/sse)│ │
│  └──────────────┘  └────────────────┘ │
│         │                  │          │
│  ┌──────────────────────────────────┐ │
│  │     Message Translator           │ │
│  │  - Envelope wrapping/unwrapping  │ │
│  │  - ID correlation                │ │
│  │  - Error handling                │ │
│  └──────────────────────────────────┘ │
│                                       │
│  ┌──────────────────────────────────┐ │
│  │     Configuration Manager        │ │
│  │  - Server connection details     │ │
│  │  - Participant identity          │ │
│  │  - Auth credentials              │ │
│  └──────────────────────────────────┘ │
└───────────────────────────────────────┘
```

**Responsibilities:**
- Maintain connections to both MCPx gateway and MCP server
- Wrap MCP messages in MCPx envelopes (outgoing)
- Unwrap MCPx envelopes to extract MCP messages (incoming)
- Handle the MCP handshake (initialize/initialized) on behalf of the server
- Broadcast tool capabilities on joining a topic
- Manage request/response correlation between protocols

**Key Design Decisions:**
- One bridge instance per MCP server
- Transparent proxy—no modification of MCP payloads
- Automatic reconnection on connection loss
- Configuration-driven deployment

### 3. Human Interface (Frontend)

The web interface allows humans to participate in topics and interact with agents.

```
┌────────────────────────────────────────┐
│         Frontend Application           │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │        UI Components             │ │
│  │  - Chat interface                │ │
│  │  - Participant list              │ │
│  │  - MCP Dev Tools                 │ │
│  │  - Connection manager            │ │
│  └──────────────────────────────────┘ │
│                │                       │
│  ┌──────────────────────────────────┐ │
│  │      MCPx Client Hook            │ │
│  │  - WebSocket management          │ │
│  │  - Message handling              │ │
│  │  - State synchronization         │ │
│  └──────────────────────────────────┘ │
│                │                       │
│  ┌──────────────────────────────────┐ │
│  │    Local MCP Server (Optional)   │ │
│  │  - Human-specific tools          │ │
│  │  - UI interaction capabilities   │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

**Responsibilities:**
- Provide UI for joining topics and sending messages
- Display real-time messages and participant presence
- Offer developer tools for direct MCP interactions
- Optionally expose MCP tools (e.g., "approve_action", "provide_feedback")
- Handle authentication flow and connection management

**Key Design Decisions:**
- React-based for broad compatibility
- Real-time updates via WebSocket subscription
- Progressive disclosure (basic chat → dev tools → advanced features)
- Mobile-responsive design

## Data Flow Patterns

### 1. Message Flow: Agent to Agent

```
Agent A                Bridge A              Gateway              Bridge B                Agent B
   │                      │                     │                    │                      │
   │ MCP Request         │                     │                    │                      │
   ├────────────────────>│                     │                    │                      │
   │                     │                      │                    │                      │
   │                     │ Wrap in Envelope     │                    │                      │
   │                     ├───────────────────> │                    │                      │
   │                     │                      │                    │                      │
   │                     │                      │ Broadcast          │                      │
   │                     │                      ├──────────────────>│                      │
   │                     │                      │                    │                      │
   │                     │                      │                    │ Unwrap & Forward     │
   │                     │                      │                    ├────────────────────>│
   │                     │                      │                    │                      │
   │                     │                      │                    │                      │
   │                     │                      │                    │ MCP Response        │
   │                     │                      │                    │<────────────────────┤
   │                     │                      │                    │                      │
   │                     │                      │ Wrap & Route       │                      │
   │                     │                      │<───────────────────┤                      │
   │                     │                      │                    │                      │
   │                     │ Forward              │                    │                      │
   │                     │<─────────────────────┤                    │                      │
   │                     │                      │                    │                      │
   │ MCP Response        │                      │                    │                      │
   │<────────────────────┤                      │                    │                      │
```

### 2. Human Interaction Pattern

```
Human (Frontend)          Gateway            Bridge               MCP Server
       │                     │                  │                     │
       │ Join Topic         │                  │                     │
       ├──────────────────>│                  │                     │
       │                    │                  │                     │
       │ Welcome + History  │                  │                     │
       │<───────────────────┤                  │                     │
       │                    │                  │                     │
       │ Send Chat         │                  │                     │
       ├──────────────────>│                  │                     │
       │                    │                  │                     │
       │                    │ Broadcast        │                     │
       │                    ├────────────────>│                     │
       │                    │                  │                     │
       │                    │                  │ Process & Respond   │
       │                    │                  ├───────────────────>│
       │                    │                  │                     │
       │                    │                  │ Tool Response       │
       │                    │                  │<────────────────────┤
       │                    │                  │                     │
       │                    │ Route            │                     │
       │                    │<─────────────────┤                     │
       │                    │                  │                     │
       │ Display Response   │                  │                     │
       │<───────────────────┤                  │                     │
```

### 3. Multi-Agent Coordination

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Coordinator │     │   Agent 1   │     │   Agent 2   │
│   (Human)   │     │  (Weather)  │     │  (Calendar) │
└─────┬───────┘     └──────┬──────┘     └──────┬──────┘
      │                     │                    │
      │ "Schedule meeting   │                    │
      │  with good weather" │                    │
      ├────────────────────>│                    │
      │                     │                    │
      │                     │ Check weather      │
      │                     ├──────────────────>│
      │                     │                    │
      │                     │ Get availability   │
      │                     ├───────────────────>│
      │                     │                    │
      │                     │<───────────────────┤
      │                     │                    │
      │                     │ Coordinate          │
      │                     │<──────────────────>│
      │                     │                    │
      │ "Meeting scheduled  │                    │
      │  for sunny Tuesday" │                    │
      │<────────────────────┤                    │
```

## Deployment Architectures

### 1. Development/Research Setup

Simple single-machine deployment for experimentation:

```
┌──────────────────────────────────────┐
│         Local Machine                │
│                                      │
│  ┌────────┐  ┌────────┐  ┌────────┐  │
│  │Gateway │  │Frontend│  │Bridge 1│  │
│  │ :3000  │  │ :3001  │  │        │  │
│  └────────┘  └────────┘  └────────┘  │
│                           │          │
│  ┌────────┐  ┌────────┐   │          │
│  │Bridge 2│  │Bridge 3│   │          │
│  │        │  │        │   │          │
│  └────────┘  └────────┘   │          │
│       │          │        │          │
│  ┌────────┐  ┌────────┐  ┌────────┐  │
│  │MCP Srv1│  │MCP Srv2│  │MCP Srv3│  │
│  └────────┘  └────────┘  └────────┘  │
└──────────────────────────────────────┘
```

### 2. Cloud Deployment

Scalable cloud architecture for production:

```
┌─────────────────────────────────────────────┐
│              Load Balancer                  │
└─────────────────┬───────────────────────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
┌────▼────┐  ┌────▼────┐  ┌────▼────┐
│Gateway 1│  │Gateway 2│  │Gateway 3│
└─────────┘  └─────────┘  └─────────┘
     │            │            │
     └────────────┼────────────┘
                  │
          ┌───────▼────────┐
          │  Redis/Kafka   │  (Message Bus)
          │  Pub/Sub       │
          └───────┬────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
┌────▼────┐  ┌────▼────┐  ┌────▼────┐
│Bridge   │  │Bridge   │  │Bridge   │
│Pool 1   │  │Pool 2   │  │Pool 3   │
└─────────┘  └─────────┘  └─────────┘
```

### 3. Platform Integration

Bridging MCPx into existing chat platforms:

```
┌──────────────┐     ┌──────────────┐
│    Slack     │     │   Discord    │
│  Workspace   │     │    Server    │
└──────┬───────┘     └──────┬───────┘
       │                    │
┌──────▼───────┐     ┌──────▼───────┐
│ Slack-MCPx   │     │Discord-MCPx  │
│   Adapter    │     │   Adapter    │
└──────┬───────┘     └──────┬───────┘
       │                    │
       └──────────┬─────────┘
                  │
          ┌───────▼────────┐
          │  MCPx Gateway  │
          └───────┬────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
┌────▼────┐  ┌────▼────┐  ┌────▼────┐
│ Agent 1 │  │ Agent 2 │  │ Agent 3 │
└─────────┘  └─────────┘  └─────────┘
```

## Security Architecture

### Authentication Flow

```
Client              Gateway            Auth Service
  │                    │                    │
  │ Request Token      │                    │
  ├───────────────────>│                    │
  │                    │ Validate           │
  │                    ├──────────────────> │
  │                    │                    │
  │                    │ Generate JWT       │
  │                    │<───────────────────┤
  │ JWT Token          │                    │
  │<───────────────────┤                    │
  │                    │                    │
  │ Connect (Bearer)   │                    │
  ├───────────────────>│                    │
  │                    │ Verify JWT         │
  │                    ├──────────────────> │
  │                    │                    │
  │ Connected          │ Valid              │
  │<───────────────────┤<───────────────────┤
```

### Trust Boundaries

```
┌─────────────────────────────────────────┐
│          Trusted Zone (Internal)        │
│                                         │
│  ┌─────────────┐    ┌─────────────┐     │
│  │   Gateway   │─── │Auth Service │     │
│  └─────────────┘    └─────────────┘     │
│         │                               │
└─────────┼───────────────────────────────┘
          │
    TLS/JWT Boundary
          │
┌─────────┼───────────────────────────────┐
│         │    Untrusted Zone             │
│   ┌─────▼─────┐    ┌─────────────┐      │
│   │  Clients  │    │   Bridges   │      │
│   └───────────┘    └─────────────┘      │
│                                         │
└─────────────────────────────────────────┘
```

## Extension Points

### 1. Custom Message Kinds

While v0 focuses on MCP messages, the envelope supports extension:

```json
{
  "protocol": "mcp-x/v0",
  "kind": "custom:video-stream",
  "payload": {
    "stream_url": "rtsp://...",
    "codec": "h264"
  }
}
```

### 2. Gateway Plugins

Gateways can add functionality without breaking compatibility:

- **Persistence plugins**: Store messages in PostgreSQL/MongoDB
- **Analytics plugins**: Track usage patterns and metrics
- **Filter plugins**: Content moderation or PII detection
- **Transform plugins**: Message enrichment (timestamps, metadata)

### 3. Bridge Extensions

Bridges can enhance MCP servers with additional capabilities:

- **Caching layer**: Cache tool responses for performance
- **Rate limiting**: Protect MCP servers from overload
- **Tool augmentation**: Add wrapper tools (logging, permissions)
- **Protocol adapters**: Support non-MCP protocols

### 4. UI Components

Frontends can create rich interactions beyond chat:

- **Tool-specific widgets**: Custom UI for specific MCP tools
- **Visualization panels**: Real-time graphs and dashboards
- **Workflow builders**: Visual programming for agent coordination
- **AR/VR interfaces**: Spatial computing for multi-agent interaction

## Performance Considerations

### Scalability Patterns

1. **Horizontal Scaling**: Multiple gateway instances behind load balancer
2. **Topic Sharding**: Distribute topics across gateway instances
3. **Message Bus**: Use Redis/Kafka for inter-gateway communication
4. **Connection Pooling**: Reuse WebSocket connections in bridges
5. **Caching**: Cache MCP tool schemas and frequent responses

### Optimization Points

- **Message Batching**: Group multiple messages in single WebSocket frame
- **Compression**: Enable WebSocket compression for large payloads
- **Lazy Loading**: Load message history on demand
- **Rate Limiting**: Prevent cascade failures from misbehaving participants
- **Circuit Breakers**: Isolate failing MCP servers

## Monitoring and Observability

### Key Metrics

```
Gateway Metrics:
- Active connections
- Messages per second
- Topic participant count
- Message latency (p50, p95, p99)
- Error rate by type

Bridge Metrics:
- MCP server health
- Request/response times
- Queue depth
- Reconnection rate

System Metrics:
- CPU/Memory usage
- Network I/O
- WebSocket frame size
- JWT validation time
```

### Distributed Tracing

```
Trace ID: abc123
├─ Client Send (0ms)
├─ Gateway Receive (10ms)
├─ Auth Verify (12ms)
├─ Topic Broadcast (15ms)
├─ Bridge A Receive (18ms)
├─ MCP Server A Process (20ms-150ms)
├─ Bridge A Response (152ms)
├─ Gateway Route (155ms)
└─ Client Receive (160ms)
```

## Future Architecture Directions

### Federation

Connect multiple MCPx deployments:

```
┌──────────────┐         ┌──────────────┐
│  MCPx Cloud  │◄───────►│  MCPx Edge   │
│   Region A   │         │   Region B   │
└──────────────┘         └──────────────┘
        ▲                        ▲
        │                        │
        └────────┬───────────────┘
                 │
         ┌───────▼────────┐
         │  MCPx Private  │
         │   Deployment   │
         └────────────────┘
```

### Semantic Routing

Intelligence layer for message routing:

- Route by capability matching
- Load balance by server specialization
- Priority queues for time-sensitive operations
- Semantic deduplication of similar requests

### Native Platform SDKs

Direct integration without bridges:

- Python/JavaScript/Go client libraries
- Mobile SDKs (iOS/Android)
- Game engine plugins (Unity/Unreal)
- IoT frameworks (ROS, Arduino)

## Conclusion

The MCPx architecture prioritizes simplicity, transparency, and extensibility. By treating all participants as peers and maintaining a thin protocol layer, it enables rich multi-agent interactions while remaining easy to understand, implement, and debug. The modular design allows each component to evolve independently while maintaining compatibility through the stable message envelope format.

This architecture serves as both a practical system for today's needs and a foundation for exploring the future of human-AI-robot collaboration.