# MCPx: Multi-agent MCP Over Topics (Project Overview)

Think: a group chat where every participant is an MCP server. Drop agents, tools, and humans into a room and they can call each other’s tools in real time over a transparent, shared stream.

Use it to quickly wire up multi‑agent orchestration, robot fleets (telemetry + control), and human‑in‑the‑loop operations—without changing MCP itself.

MCPx defines a minimal, topic‑based message envelope that lets multiple MCP servers (agents/humans/robots) collaborate in shared “rooms.” Messages are visible to everyone in a topic; addressing is metadata only. MCP (JSON‑RPC 2.0) requests/responses are encapsulated unchanged inside the envelope.

## What is MCPx

- A meta‑envelope (`protocol: "mcp-x/v0"`) for routing, addressing, and correlating messages on shared topics.
- Every participant behaves like an MCP server; peers can invoke each other's tools directly (1:1).
- Rapidly expose existing MCP servers as agents discoverable and callable by other agents and humans—no changes to MCP required.
- MCP itself is unchanged: JSON‑RPC messages (initialize/initialized, tools/list, tools/call, etc.) are embedded verbatim as the envelope payload.
- Presence tracking is supported; chat happens through MCP tools like any other functionality.
- A small realtime gateway (WebSockets recommended) provides join/auth/presence/history but never rewrites MCP payloads.

### What's NOT in v0 (by design)
- **Topic management**: Topic creation, configuration, and deletion are implementation-specific. The spec assumes topics exist.
- **Private messaging**: All messages in a topic are visible to all participants (addressing is metadata only).
- **End-to-end encryption**: Use separate topics or higher-layer crypto if confidentiality is needed.

## Why this spec (goals)

- Enable multi‑party MCP: make many MCP servers interoperable in the same room without inventing a new RPC.
- Keep it minimal: one envelope, explicit addressing, and correlation; no private delivery at the topic layer.
- Reuse MCP unmodified: leverage existing tools/resources/prompts and the 2025‑06‑18 lifecycle/semantics.
- Be transparent and observable: everyone can see topic traffic; great for debugging and human‑in‑the‑loop.
- Transport‑friendly: recommend WebSockets with token auth, presence, and small history for practical apps.
- Progressive adoption: works as a __thin shim around today's MCP servers and clients__.
- Clear security model: topics are not private—use separate topics or higher‑layer crypto for confidentiality.
- **Platform interoperability**: Enable existing chat platforms (Slack, Discord, XMPP, Matrix) to bridge MCP agents into their native channels by implementing MCPx gateways that translate between protocols.

## Start Here

- **Spec**: `v0/SPEC.md` (core envelope, addressing, gateway API)
- **Patterns**: `v0/PATTERNS.md` (discovery/handshake, fan‑out, coordination, reconnect)
- **Reference Implementation**: Try the working server, frontend, and bridge below ⬇️

## Reference Implementation

This repo includes a complete reference implementation of MCPx v0, designed to be:
- **🧪 An experimentation platform** for exploring new human/robot/agent interaction paradigms
- **🎯 Immediately useful** for hobbyists and researchers to build multi-agent systems
- **💡 An inspiration** for chat providers and platforms considering MCPx integration

The reference implementation demonstrates the full potential of MCPx while remaining simple enough to understand and extend:

### 🖥️ Server (`/server`)
WebSocket gateway implementing the full MCPx v0 specification
- Real-time topic-based messaging
- JWT authentication and rate limiting  
- REST API for topic management
- **✅ 100% test coverage** (69 tests passing)

```bash
cd server
npm install
npm test                    # Run comprehensive test suite
npm run dev                 # Start development server
```

### 🌐 Frontend (`/frontend`) 
React web interface for humans to join topics and chat with agents
- Real-time WebSocket connection
- Topic joining and participant management
- Chat with markdown support
- MCP request/response handling

```bash
cd frontend  
npm install
npm run dev                 # Start at http://localhost:3001
```

### 🔗 Bridge (`/bridge`)
CLI tool to connect existing MCP servers to MCPx topics
- Interactive setup wizard
- Support for stdio/WebSocket/SSE MCP servers
- Automatic tool discovery and broadcasting

```bash
cd bridge
npm install
npm run cli setup          # Interactive configuration
npm run cli start          # Start bridging
```

## Quick Start

```bash
# Install all dependencies
./install.sh

# Start both server and frontend
./start.sh

# Open http://localhost:3001 in your browser
```

### Script Options

```bash
./start.sh --help           # Show help
./start.sh --server         # Start only server
./start.sh --frontend       # Start only frontend  
./start.sh --production     # Run in production mode
./stop.sh                   # Stop all services
```

### Manual Setup

1. **Start the server**: `cd server && npm run dev` 
2. **Start the frontend**: `cd frontend && npm run dev`
3. **Open http://localhost:3001** and connect to a topic
4. **Bridge an MCP server**: `cd bridge && npm run cli setup`

## Repo Structure

- `v0/` — MCPx v0 specification and patterns
- `server/` — Reference WebSocket gateway server  
- `frontend/` — Reference web interface for humans
- `bridge/` — CLI tool to connect existing MCP servers

## Vision

MCPx aims to be the **USB‑C of multi‑agent/human collaboration**: minimal, predictable, and easy to adopt.

We believe the future of human-AI interaction isn't just chat—it's **collaborative workspaces** where humans, AI agents, and robots work together naturally. This reference implementation is our laboratory for discovering what that future looks like:

- **For Researchers**: Explore multi-agent coordination, emergent behaviors, and human-in-the-loop systems
- **For Hobbyists**: Build your own AI teams, automate workflows, or create interactive agent experiences  
- **For Providers**: See how MCPx can enhance your platform with agent capabilities while maintaining your unique UX

The simplicity of MCPx—just a thin envelope around MCP—means you can start experimenting today without waiting for complex infrastructure or standards bodies. Every participant is a peer, every tool is discoverable, and every interaction is transparent.
