# MCPx Development Guide

This guide documents how to run and test the MCPx protocol examples, including common issues and solutions.

## Quick Start: Running the TODO List Demo

This demo shows multiple agents collaborating to manage a TODO list.

### Prerequisites

```bash
# Install global dependencies
npm install -g @modelcontextprotocol/server-filesystem

# Build all packages
npm run build
```

### Step 1: Start the Gateway

```bash
npm run dev:gateway
```

The gateway runs on `ws://localhost:3000` and manages all agent connections.

### Step 2: Create TODO File

```bash
mkdir -p ~/Desktop/Notes
echo "# TODO List" > ~/Desktop/Notes/TODO.md
```

### Step 3: Start the Filesystem Bridge

**Important:** Use the direct `mcp-server-filesystem` command, NOT `npx`:

```bash
node packages/bridge/dist/cli.js run \
  -t quickstart \
  -i notes-agent \
  -n "Notes" \
  mcp-server-filesystem ~/Desktop/Notes
```

**Common Issues:**
- ❌ Don't use: `npx @modelcontextprotocol/server-filesystem` (argument parsing issues)
- ✅ Do use: `mcp-server-filesystem` (after global install)

### Step 4: Start the OpenAI Agent

```bash
# Set your OpenAI API key
export OPENAI_API_KEY=sk-your-key-here

# Run with custom TODO management prompt
OPENAI_MODEL=gpt-4o \
MCPX_TOPIC=quickstart \
OPENAI_SYSTEM_PROMPT="You are a helpful TODO list manager. You have access to a TODO.md file. When asked about TODO items, use the available tools to read and write the file." \
npm run example:openai
```

### Step 5: Connect and Interact

```bash
# Use the terminal CLI for best scrolling experience
npm run cli:terminal

# Or use blessed CLI for full-screen TUI
npm run cli

# Or simple CLI for automation/debugging
npm run cli:simple
```

**Available CLIs:**
- **cli:terminal** - Standard terminal output with native scrolling (recommended)
- **cli** - Blessed full-screen TUI with panels
- **cli:simple** - Simple readline for automation

Commands:
- `/connect ws://localhost:3000 quickstart user` (for simple CLI)
- `/debug` - Enable protocol debugging to see ALL envelopes
- `/list` - List participants
- `@openai-agent add milk to my TODO list` - Interact with the AI

**Debug Mode - Seeing All Messages:**
As of v0.1, the gateway broadcasts ALL messages to ALL participants in a topic. This means:
- Every participant sees every envelope (requests, responses, proposals)
- Debug mode shows the raw protocol envelopes
- No special "observer" capability needed
- Essential for multi-agent collaboration

```bash
# Connect with any participant ID
npm run cli:terminal
# Then type: /debug
# You'll see ALL envelopes in the topic
```

## Debugging

### Using the FIFO Bridge (Automated Testing)

The FIFO bridge allows programmatic interaction with the CLI:

```bash
# Terminal 1: Start FIFO bridge
cd packages/cli
node cli-fifo-bridge.js

# Terminal 2: Send commands
./fifo-send.sh "/connect ws://localhost:3000 quickstart user"
./fifo-send.sh "/debug"
./fifo-send.sh "@openai-agent help"
```

### Common Issues and Solutions

#### 1. Bridge Won't Start - "method:initialize: command not found"

**Problem:** Command arguments are being parsed incorrectly.

**Solution:** Install MCP servers globally and use direct commands:
```bash
# Install globally
npm install -g @modelcontextprotocol/server-filesystem

# Use direct command (not npx)
mcp-server-filesystem ~/Desktop/Notes
```

#### 2. Agents Can't Call Each Other's Tools

**Problem:** Default capabilities are proposal-only for security.

**Solution:** For development/testing, modify gateway to give full capabilities:

Edit `packages/gateway/src/services/AuthService.ts`:
```typescript
getDefaultCapabilities(participantId: string): string[] {
  // For testing only - gives all agents full access
  return ['mcp/*', 'chat'];
}
```

**Note:** Revert this for production use!

#### 3. Tool Discovery Timeouts

**Problem:** MCP initialize requests timeout after 30 seconds.

**Solution:** 
- Wait for full timeout cycle before expecting responses
- Check that agents have correct capabilities (`mcp/request:*`)
- Ensure bridge is properly handling MCP messages (check for v0.1 compatibility)

#### 4. OpenAI Agent Not Making Tool Calls

**Problem:** Tools aren't being discovered or passed to OpenAI correctly.

**Debugging Steps:**
1. Enable debug mode in CLI: `/debug`
2. Check if tools are discovered: Look for "Discovered X tools from Y" in agent logs
3. Verify the ReAct loop is working: Should see "[ReAct iteration X]" in logs
4. Check OpenAI API response: Tools might not be formatted correctly

**Common Fixes:**
- Ensure MCP request/response kinds use full method names (not truncated)
- Verify bridge is checking `envelope.kind.startsWith('mcp/')` not `envelope.kind !== 'mcp'`
- Make sure agents have `mcp/request:*` capability, not just `mcp/proposal:*`

## Protocol Changes (v0.1)

Key changes from v0 to v0.1:

1. **Message Kinds**: Now hierarchical
   - Old: `kind: 'mcp'`
   - New: `kind: 'mcp/request:tools/list'`

2. **Capabilities**: Wildcard patterns
   - Old: Privilege levels
   - New: `['mcp/*', 'chat']` or `['mcp/proposal:*', 'mcp/response:*', 'chat']`

3. **Correlation IDs**: Required for responses
   - Responses must include `correlation_id` referencing the request's `id`

## Example Agents

### Echo Bot
Simple agent that echoes messages:
```bash
npm run example:echo
```

### Calculator Agent
Provides math tools:
```bash
npm run example:calculator
```

### OpenAI Agent
AI-powered assistant with tool use:
```bash
OPENAI_API_KEY=sk-xxx npm run example:openai
```

## Development Workflow

### 1. Making Changes

After modifying any package:
```bash
# Build specific package
npm run build:client
npm run build:agent
npm run build:bridge
npm run build:gateway

# Or build all
npm run build
```

### 2. Testing Changes

Use the gateway in dev mode for hot-reloading:
```bash
npm run dev:gateway
```

### 3. Debugging Protocol Messages

Enable debug mode in CLI to see raw envelopes:
```
/debug
```

Example output:
```json
{
  "protocol": "mcpx/v0.1",
  "id": "...",
  "from": "agent-1",
  "to": ["agent-2"],
  "kind": "mcp/request:tools/list",
  "payload": {...}
}
```

## Architecture Notes

### Message Flow (Broadcast-All Architecture)
1. Agent sends envelope to gateway via WebSocket
2. Gateway checks capabilities (lazy enforcement)
3. **Gateway broadcasts ALL messages to ALL participants** (v0.1 change)
4. Recipients process messages relevant to them
5. Responses include correlation_id for matching

**Why Broadcast-All?**
- Ensures all participants see responses to proposals
- Enables proper multi-agent collaboration
- Allows humans to observe all agent interactions
- Critical for orchestrator patterns where proposals need responses visible to all

Example scenario:
- Agent A proposes an operation
- Agent B fulfills it by making the actual request
- Agent C responds with the result
- **All agents (including A) need to see C's response**

### Tool Discovery Flow
1. Agent joins topic
2. After 2 seconds, attempts to discover tools from peers
3. Sends `initialize` MCP request to each peer
4. On success, sends `tools/list` request
5. Registers discovered tools for OpenAI function calling
6. 30-second timeout for each request

## Troubleshooting Checklist

- [ ] Gateway running on port 3000?
- [ ] All packages built with latest changes?
- [ ] Agents have correct capabilities?
- [ ] MCP servers installed globally (not using npx)?
- [ ] Environment variables set (OPENAI_API_KEY, etc.)?
- [ ] Using v0.1 protocol endpoints (/v0.1/auth/token)?
- [ ] Bridge handling hierarchical kinds correctly?
- [ ] Correlation IDs included in responses?
- [ ] Gateway broadcasting ALL messages to ALL participants?
- [ ] Client NOT filtering messages by 'to' field?

## Contributing

When debugging issues:
1. Enable debug mode to see protocol messages
2. Check agent console logs for errors
3. Verify capability requirements
4. Test with simple echo bot first
5. Document any new issues/solutions in this file