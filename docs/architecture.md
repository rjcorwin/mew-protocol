# MEW Protocol Architecture

This document explains how MEW Protocol works internally - the components, their interactions, and key design patterns.

## System Overview

MEW Protocol creates collaborative workspaces where humans, AI agents, and MCP servers work together with full visibility and control.

```
┌─────────────────────────────────────────────────────────┐
│                      MEW SPACE                          │
│                                                         │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐      │
│  │  Human   │◄────┤ Gateway  ├────►│   Agent  │      │
│  │  (You)   │     │          │     │  (MEW)   │      │
│  └──────────┘     └─────┬────┘     └──────────┘      │
│                          │                             │
│                    ┌─────┴─────┐                      │
│                    │           │                       │
│              ┌─────▼────┐ ┌────▼──────┐              │
│              │MCP Bridge│ │MCP Bridge │              │
│              │(Filesystem)│ │(Memory) │              │
│              └─────┬────┘ └────┬──────┘              │
│                    │           │                       │
│              ┌─────▼────┐ ┌────▼──────┐              │
│              │MCP Server│ │MCP Server │              │
│              │  (stdio) │ │  (stdio)  │              │
│              └──────────┘ └───────────┘              │
└─────────────────────────────────────────────────────────┘
```

All participants connect to the gateway via WebSocket. The gateway enforces capabilities and broadcasts messages.

## Core Components

### 1. Gateway (`src/gateway/`)

**Purpose**: Central message router and capability enforcer.

**Responsibilities**:
- Accept WebSocket connections from participants
- Authenticate using bearer tokens
- Enforce capability-based access control
- Route messages based on `to` field (or broadcast if empty)
- Log all envelopes to `.mew/logs/envelope-history.jsonl`
- Manage participant lifecycle (join, leave, pause, resume)

**Key Files**:
- `src/gateway/gateway.ts` - Main gateway implementation
- `src/gateway/capability-matcher.ts` - Capability pattern matching

**Capabilities Enforcement**:
The gateway checks every outgoing message against the sender's capabilities before routing:

```typescript
// Example capability check
if (!hasCapability(participant, envelope.kind, envelope.payload)) {
  sendError(participant, "capability_denied");
  return; // Message not delivered
}
```

Capabilities use pattern matching with wildcards:
- `"chat"` - Exact match for chat messages
- `"mcp/*"` - All MCP message kinds
- `"system/error"` - Specific system messages
- `"*"` - Everything (full access)

### 2. MEW Agent (`src/agent/`)

**Purpose**: AI assistant that participates in MEW spaces.

**Responsibilities**:
- Connect to gateway as a participant
- Respond to chat messages
- Call MCP tools (respecting capabilities)
- Create proposals for restricted operations
- Show transparent reasoning via `reasoning/*` messages
- Manage conversation context

**Key Files**:
- `src/agent/MEWAgent.ts` - Main agent class
- `src/agent/anthropic-client.ts` - Anthropic API integration

**Conversation Flow**:
1. Receive `chat` message from human
2. Send `chat/acknowledge` to confirm receipt
3. Send `stream/request` to gateway for stream ID
4. Send `reasoning/start` to begin thinking
5. Send multiple `reasoning/thought` messages (thinking out loud)
6. Send `mcp/request` or `mcp/proposal` for tool calls
7. Send `reasoning/conclusion` when done thinking
8. Send final `chat` response
9. Send `stream/close` to clean up

**Capability Awareness**:
The agent knows what it can and cannot do:
- Checks capabilities before sending requests
- Falls back to proposals if lacking capability
- Observes fulfillment responses via correlation chains

### 3. MCP Bridge (`src/bridge/`)

**Purpose**: Translate between MCP (Model Context Protocol) and MEW Protocol.

**Responsibilities**:
- Spawn and manage MCP server subprocess
- Perform MCP initialization handshake
- Discover tools from MCP server
- Register tools with MEWParticipant base class
- Translate MEW `mcp/request` → JSON-RPC requests
- Translate JSON-RPC responses → MEW `mcp/response`
- Handle MCP server crashes and restarts

**Key Files**:
- `src/bridge/MCPBridge.ts` - Bridge implementation
- `src/bridge/MCPClient.ts` - stdio JSON-RPC client

**Bridge Flow**:
```
MEW Space                MCP Bridge              MCP Server
    │                        │                       │
    ├─mcp/request────────────►│                       │
    │ (MEW envelope)          │─tools/call────────────►│
    │                        │  (JSON-RPC)           │
    │                        │◄─result───────────────┤
    │◄─mcp/response──────────┤                       │
    │ (MEW envelope)          │                       │
```

**Tool Registration**:
On startup, the bridge:
1. Sends `tools/list` to MCP server
2. For each tool, registers with MEWParticipant base class
3. Creates executor function that forwards to MCP server
4. MEWParticipant handles incoming `mcp/request` automatically

**Extends MEWParticipant**:
The bridge extends `MEWParticipant` from the SDK, getting automatic:
- WebSocket connection management
- Tool request handling
- Capability inheritance
- Message correlation

### 4. MEWParticipant Base Class (`src/participant/`)

**Purpose**: Reusable base class for all MEW participants.

**Responsibilities**:
- WebSocket connection to gateway
- Automatic tool registration and handling
- Resource management (if applicable)
- Send/receive envelope helpers
- Reconnection logic
- Stream management

**Key Files**:
- `src/participant/MEWParticipant.ts` - Base class

**Tool Registration Pattern**:
```typescript
class MyParticipant extends MEWParticipant {
  constructor() {
    super({ gateway, space, participant_id, token });

    // Register tools - base class handles requests automatically
    this.registerTool({
      name: "my_tool",
      description: "Does something useful",
      inputSchema: { /* JSON Schema */ },
      execute: async (args) => {
        // Implement tool logic
        return { result: "done" };
      }
    });
  }
}
```

When an `mcp/request` for `my_tool` arrives, MEWParticipant:
1. Validates the request
2. Calls the registered `execute` function
3. Automatically sends `mcp/response` with result
4. Handles errors and sends error responses

### 5. CLI (`src/cli/`)

**Purpose**: Command-line interface for managing MEW workspaces.

**Responsibilities**:
- Initialize workspaces from templates
- Start/stop spaces (via PM2)
- Connect to spaces for interaction
- Manage space configuration

**Key Files**:
- `src/cli/index.ts` - CLI entry point
- `src/cli/commands/` - Command implementations

**Commands**:
- `mew` - Interactive setup and start
- `mew init <template>` - Initialize from template
- `mew space up` - Start workspace processes
- `mew space down` - Stop workspace processes
- `mew space status` - Check process health
- `mew client connect` - Interactive client

**Process Management**:
Uses PM2 for process lifecycle:
```bash
pm2 start gateway.js --name "my-space-gateway"
pm2 start agent.js --name "my-space-mew"
pm2 start bridge.js --name "my-space-mcp-fs"
```

PM2 provides:
- Process monitoring
- Auto-restart on crash
- Log aggregation
- Status checking

## Message Flow Patterns

### Pattern 1: Chat Interaction

**Human asks agent a question**:

```
Human ──chat──────────────► Gateway ──────► Agent
                                            ↓ (acknowledged)
Human ◄──chat/acknowledge── Gateway ────────┘
                                            ↓ (stream request)
Human ◄──stream/request──── Gateway ────────┘
                                            ↓ (thinking)
Human ◄──reasoning/start─── Gateway ────────┘
Human ◄──reasoning/thought─ Gateway ────────┘ (multiple thoughts)
Human ◄──reasoning/thought─ Gateway ────────┘
                                            ↓ (responds)
Human ◄──chat──────────────Gateway ────────┘
                                            ↓ (done)
Human ◄──stream/close────── Gateway ────────┘
```

All messages visible to all participants (broadcast by default).

### Pattern 2: Direct MCP Tool Call

**Agent with write capability calls tool**:

```
Agent ──mcp/request─────► Gateway ──────► MCP Bridge ──► MCP Server
(write_file)                                             (executes)
                                                             │
Agent ◄─mcp/response────◄ Gateway ◄──────┘                 │
(success)                                                   │
                                                             ▼
                                                      File written
```

The agent has the capability, so it calls the tool directly.

### Pattern 3: Proposal-Approval Flow

**Agent without capability proposes operation**:

```
Agent ──mcp/proposal─────► Gateway ──────► Broadcast (Human observes)
(write_file)
                                          Human reviews proposal

Human ──mcp/request──────► Gateway ──────► MCP Bridge ──► MCP Server
(write_file, correlates                                   (executes)
 to proposal)                                                │
                                                             │
Human ◄─mcp/response─────◄ Gateway ◄──────┘                 │
Agent observes broadcast ◄─────────────────────────────────┘ │
(traces via correlation_id)                                  ▼
                                                      File written
```

**Correlation Chain**:
1. Agent sends `mcp/proposal` with id `"prop-123"`
2. Human sends `mcp/request` with `correlation_id: ["prop-123"]` and id `"req-456"`
3. Bridge sends `mcp/response` with `correlation_id: ["req-456"]`
4. Agent observes response and traces: `req-456` → `prop-123` (my proposal!)

### Pattern 4: Capability Grant

**Human grants additional capability to agent**:

```
Human ──capability/grant─► Gateway ──────► Agent
                                          ↓ (applies new capabilities)
Human ◄─system/welcome────◄ Gateway ◄─────┘ (updated capabilities)
                                          ↓ (acknowledges)
Human ◄─capability/grant-ack─◄ Gateway ◄──┘
```

After grant, agent can use new capabilities immediately.

### Pattern 5: Transparent Reasoning

**Agent thinking out loud**:

```
Agent ──reasoning/start────► Gateway ────► Broadcast
Agent ──reasoning/thought──► Gateway ────► Broadcast ("I need to...")
Agent ──reasoning/thought──► Gateway ────► Broadcast ("Let me check...")
Agent ──mcp/request─────────► Gateway ────► MCP Bridge
Agent ◄─mcp/response───────◄ Gateway ◄────┘
Agent ──reasoning/thought──► Gateway ────► Broadcast ("Got result...")
Agent ──reasoning/conclusion►Gateway ────► Broadcast
```

All participants see the agent's reasoning process in real-time.

## Key Design Patterns

### 1. Capability-Based Security

**Every message is checked against sender capabilities**:

```yaml
# space.yaml example
participants:
  mew:
    capabilities:
      - kind: "chat"
      - kind: "reasoning/*"
      - kind: "mcp/request"
        payload:
          method: "tools/call"
          params:
            name: "read_*"  # Only read tools
      - kind: "mcp/proposal"  # Must propose write operations
```

**Capability Patterns**:
- `"kind": "chat"` - Exact kind match
- `"kind": "mcp/*"` - Wildcard for all MCP messages
- `"payload.method": "tools/call"` - Match payload structure
- `"payload.params.name": "read_*"` - Pattern matching in nested fields

**Enforcement Location**: Gateway (centralized, cannot be bypassed)

### 2. Broadcast-by-Default

**All messages visible to all participants** (unless `to` field specifies recipients):

```json
{
  "to": [],  // Broadcast to all
  "kind": "chat",
  "payload": { "text": "Hello everyone!" }
}
```

**Why?**
- Full transparency
- All participants can observe and learn
- Correlation chains work (agent sees fulfillment responses)
- Audit trail in envelope history

**Direct Messages** (optional):
```json
{
  "to": ["specific-agent"],  // Only this agent receives
  "kind": "chat",
  "payload": { "text": "Private message" }
}
```

### 3. Correlation Chains

**Messages reference each other via correlation_id**:

```
Proposal (id: A) ──► Human observes
                     Human approves (id: B, correlation_id: [A])
                     Bridge executes
                     Response (id: C, correlation_id: [B])
                     Agent traces: C ──► B ──► A (my proposal!)
```

**Multi-Way Correlation** (supported but rare):
```json
{
  "correlation_id": ["req-1", "req-2", "req-3"],
  "payload": { "text": "Here's a summary of all three requests" }
}
```

### 4. Streams and Contexts

**Streams** group related messages:
```json
{ "kind": "stream/request" }  // Gateway assigns stream ID
{ "kind": "stream/open", "payload": { "stream_id": "stream-123" } }
// Agent sends messages with stream context
{ "kind": "stream/close", "payload": { "stream_id": "stream-123" } }
```

**Contexts** organize message trees:
```json
{
  "context": "reasoning/task-42/subtask-1",
  "kind": "reasoning/thought",
  "payload": { "text": "Working on subtask 1..." }
}
```

LLMs can filter contexts to reduce noise while still handling directed messages.

### 5. Progressive Trust

**Agents start restricted, earn capabilities**:

1. **Initial State** - Agent can chat and propose
2. **Observation** - Human watches agent behavior
3. **Grant** - Human grants specific capabilities
4. **Autonomous** - Agent executes without approval
5. **Revoke** - Human can revoke if agent misbehaves

**Implementation**:
```typescript
// Agent checks capabilities before acting
if (hasCapability("mcp/request", { method: "tools/call", name: "write_file" })) {
  // Direct call
  sendRequest({ method: "tools/call", params: { name: "write_file", ... } });
} else {
  // Proposal
  sendProposal({ method: "tools/call", params: { name: "write_file", ... } });
}
```

### 6. MEWParticipant Pattern

**All participants extend MEWParticipant base class**:

```typescript
class MyAgent extends MEWParticipant {
  constructor() {
    super({ gateway, space, participant_id, token });
    this.registerTools();
  }

  registerTools() {
    this.registerTool({
      name: "my_tool",
      execute: async (args) => { /* ... */ }
    });
  }

  onMessage(envelope) {
    // Handle custom messages
  }
}
```

**Benefits**:
- Consistent WebSocket handling
- Automatic tool request routing
- Built-in error handling
- Reconnection logic
- Reduces boilerplate

## Data Flow

### Startup Sequence

1. **Read Configuration**
   - CLI reads `.mew/space.yaml`
   - Parses participant definitions

2. **Start Gateway**
   - Gateway binds to port (8080 or next available)
   - Loads participant capabilities from space.yaml
   - Waits for connections

3. **Start Participants**
   - CLI spawns processes via PM2
   - Each participant connects to gateway WebSocket
   - Sends join/authentication message
   - Gateway responds with `system/welcome`

4. **MCP Bridges Initialize**
   - Bridge spawns MCP server subprocess
   - Performs MCP handshake (`initialize`, `initialized`)
   - Discovers tools via `tools/list`
   - Registers tools with MEWParticipant base

5. **Ready State**
   - All participants connected
   - All tools registered
   - Space ready for messages

### Runtime Message Processing

1. **Message Created**
   - Participant creates envelope
   - Sets `from`, `to`, `kind`, `payload`
   - Generates unique `id`

2. **Sent to Gateway**
   - WebSocket send
   - Gateway receives raw envelope

3. **Capability Check**
   - Gateway checks sender's capabilities
   - Matches envelope `kind` and `payload` structure
   - Rejects if no matching capability

4. **Routing**
   - If `to` is empty/omitted: broadcast to all
   - If `to` has recipients: send only to those
   - Gateway sends to each recipient's WebSocket

5. **Envelope Logging**
   - Gateway writes envelope to `.mew/logs/envelope-history.jsonl`
   - One envelope per line (JSONL format)

6. **Participant Receives**
   - WebSocket receives envelope
   - Participant's `onMessage` handler invoked
   - For tool calls: MEWParticipant automatically routes to executor

7. **Response (if applicable)**
   - Tool execution completes
   - MEWParticipant creates `mcp/response` envelope
   - Sets `correlation_id` to request's `id`
   - Sends to gateway → back to original requestor

### Shutdown Sequence

1. **Shutdown Command**
   - User runs `mew space down`

2. **PM2 Stops Processes**
   - Sends SIGTERM to each process
   - Waits for graceful shutdown (timeout: 30s)
   - Force kill (SIGKILL) if timeout exceeded

3. **Participants Cleanup**
   - MCP bridges stop MCP server subprocesses
   - Agents close LLM connections
   - All close WebSocket connections

4. **Gateway Cleanup**
   - Gateway closes all client connections
   - Flushes envelope log
   - Closes WebSocket server
   - Exits

## File System Layout

```
workspace/
├── .mew/                           # MEW configuration
│   ├── space.yaml                 # Participant definitions
│   ├── tokens/                    # Authentication tokens
│   │   ├── human.token
│   │   ├── mew.token
│   │   └── mcp-fs-bridge.token
│   └── logs/
│       └── envelope-history.jsonl # Complete message log
├── logs/                          # Process logs (PM2)
│   ├── gateway.log
│   ├── gateway-error.log
│   ├── mew.log
│   └── mcp-fs-bridge.log
└── [your files]                   # Workspace files
```

### Configuration: space.yaml

Defines all participants and their capabilities:

```yaml
gateway:
  port: 8080
  space: "my-workspace"

participants:
  mew:
    type: mew
    auto_start: true
    tokens: ["mew-token"]
    capabilities:
      - kind: "chat"
      - kind: "reasoning/*"
      - kind: "mcp/request"
      - kind: "mcp/proposal"

  mcp-fs-bridge:
    type: mcp-bridge
    auto_start: true
    tokens: ["fs-token"]
    mcp_server:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    capabilities:
      - kind: "mcp/response"
      - kind: "system/*"
```

### Envelope History Log

Complete audit trail of all messages:

```jsonl
{"envelope": {...}, "timestamp": "2025-09-26T10:00:00Z"}
{"envelope": {...}, "timestamp": "2025-09-26T10:00:01Z"}
{"envelope": {...}, "timestamp": "2025-09-26T10:00:02Z"}
```

Each line is a JSON object with:
- `envelope` - The complete envelope
- `timestamp` - When gateway processed it

**Analysis**:
```bash
# Count message types
cat .mew/logs/envelope-history.jsonl | jq -r '.envelope.kind' | sort | uniq -c

# Find proposals
cat .mew/logs/envelope-history.jsonl | jq 'select(.envelope.kind == "mcp/proposal")'

# Trace correlation chain
cat .mew/logs/envelope-history.jsonl | jq 'select(.envelope.id == "ABC" or .envelope.correlation_id[]? == "ABC")'
```

## Security Model

### Trust Boundaries

1. **Gateway ↔ Participants** - WebSocket with token authentication
2. **Bridge ↔ MCP Server** - stdio (subprocess, isolated)
3. **Agent ↔ LLM API** - HTTPS with API key
4. **All Communication** - Visible in envelope log

### Capability Enforcement

**Where**: Gateway (single enforcement point)

**When**: Before routing every message

**How**: Pattern matching against sender's capability list

**Bypass**: Not possible (all communication goes through gateway)

### Progressive Trust Model

- Agents start with minimal capabilities (chat, reasoning, proposals)
- Humans grant capabilities based on observed behavior
- Capabilities can be revoked instantly
- Audit trail in envelope history shows all grants/revokes

### Isolation

- MCP servers run as subprocesses (no shared memory)
- Communication only via stdio (read/write streams)
- MCP servers cannot connect to gateway directly
- Bridges act as sandboxed translators

## Performance Characteristics

### Message Throughput

- **Gateway**: ~1000 msg/sec (single-threaded Node.js)
- **WebSocket**: Low latency (<10ms local)
- **Bottleneck**: AI agent response time (seconds to minutes)

### Scalability Limits

- **Participants**: ~100 per space (WebSocket connections)
- **Message Size**: 16MB (WebSocket default)
- **Envelope History**: Grows unbounded (manual cleanup needed)

### Optimization Strategies

1. **Context Filtering**: Agents filter contexts to reduce prompt size
2. **Directed Messages**: Use `to` field to avoid broadcasting
3. **Stream Management**: Close streams promptly to free resources
4. **Log Rotation**: Archive/delete old envelope history

## Extension Points

### Custom Participants

Extend MEWParticipant:

```typescript
import { MEWParticipant } from '@mew-protocol/sdk';

class CustomAgent extends MEWParticipant {
  constructor() {
    super({ gateway, space, participant_id, token });
    this.registerTools();
  }

  registerTools() {
    this.registerTool({
      name: "custom_tool",
      description: "My custom tool",
      inputSchema: { type: "object", properties: {} },
      execute: async (args) => {
        // Tool implementation
        return { result: "done" };
      }
    });
  }

  onMessage(envelope) {
    // Handle custom message kinds
    if (envelope.kind === "custom/kind") {
      // Process custom message
    }
  }
}
```

### Custom MCP Servers

Any stdio MCP server works:

```yaml
participants:
  my-mcp:
    type: mcp-bridge
    mcp_server:
      command: "python"
      args: ["my_server.py"]
```

### Custom Message Kinds

Add new kinds to protocol:

```typescript
// In agent
sendEnvelope({
  kind: "custom/action",
  payload: { /* custom data */ }
});

// In receiver
if (envelope.kind === "custom/action") {
  // Handle custom action
}
```

**Note**: Custom kinds should follow namespace pattern: `namespace/action`

## Related Documentation

- **[Protocol Spec](../spec/protocol/v0.4/SPEC.md)** - Complete protocol reference
- **[SDK Spec](../spec/sdk/SPEC.md)** - SDK architecture and patterns
- **[Bridge Spec](../spec/bridge/SPEC.md)** - MCP-MEW bridge details
- **[CLI Spec](../spec/cli/SPEC.md)** - Command-line interface
- **[Development Guide](development.md)** - Build and contribute
- **[Testing Guide](testing.md)** - Test infrastructure

---

This architecture enables human-in-the-loop AI workflows with full transparency and control. The gateway enforces security at the protocol level, ensuring safe collaboration between humans, agents, and tools.
