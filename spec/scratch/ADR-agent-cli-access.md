# ADR: Agent Access to MEW Interactive CLI

**Status**: Draft
**Date**: 2025-01-06
**Decision Makers**: MEW Protocol Working Group

## Context

AI coding agents (like Claude Code) need programmatic access to the MEW interactive CLI to:
- Test the CLI functionality
- Debug issues by reproducing user scenarios
- Develop features that integrate with the CLI
- Validate end-to-end workflows

The current interactive CLI poses several challenges for agent access:

1. **Interactive Terminal UI** - Built with Ink (React for CLI), renders rich UI components
2. **Key-based Input** - Responds to keyboard events (arrows, enter, escape, etc.)
3. **ANSI Output** - Uses escape codes for colors, cursor positioning, animations
4. **Real-time Updates** - Dynamic UI updates (spinners, progress, streaming)
5. **Human-centric Design** - Optimized for human reading, not machine parsing

**The Question**: How can we enable AI agents to interact with the MEW CLI while maintaining the human-focused interactive experience?

## Decision Drivers

1. **Minimal CLI Changes** - Don't compromise the human UX
2. **Test Real Code Paths** - Solutions should test actual CLI logic, not mocks
3. **Developer Experience** - Easy for agents to use and understand
4. **Protocol Compliance** - Leverage MEW protocol where possible
5. **Maintainability** - Don't create parallel implementations

## Considered Options

### Option 1: Gateway HTTP API (Direct Protocol Access)

**Approach**: Agent bypasses CLI and communicates directly with gateway via HTTP.

```bash
# Agent workflow
mew space up -d  # Start space in background
curl -X POST http://localhost:8080/participants/agent/messages \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"protocol":"mew/v0.4","kind":"chat","payload":{"text":"hello"}}'
```

**Pros**:
- ✅ Already implemented - HTTP API exists
- ✅ Clean, structured JSON interface
- ✅ Full protocol access
- ✅ No CLI parsing complexity
- ✅ Easy to use from any environment

**Cons**:
- ❌ Doesn't test CLI at all
- ❌ Can't validate interactive features (themes, formatters, UI)
- ❌ Misses CLI-specific bugs
- ❌ No access to CLI commands (/help, /streams, etc.)

**Use Case**: Protocol testing, automation, CI/CD

---

### Option 2: CLI Test Mode (JSON Lines Interface)

**Approach**: Add special `--agent-mode` flag that transforms CLI into a JSON-RPC style interface.

```bash
# Agent workflow
mew space connect --agent-mode | jq -r '.output'
```

**Input** (stdin, one JSON object per line):
```json
{"action": "send_message", "text": "hello"}
{"action": "send_key", "key": "up"}
{"action": "get_screen"}
{"action": "send_command", "command": "/help"}
```

**Output** (stdout, JSON lines):
```json
{"type": "screen", "content": "...", "cursor": {"x": 0, "y": 5}}
{"type": "message", "envelope": {...}}
{"type": "ui_state", "reasoning": {"active": true, "elapsed": 1234}}
```

**Pros**:
- ✅ Tests actual CLI code paths
- ✅ Structured, parseable output
- ✅ Can simulate keyboard interactions
- ✅ Access to screen state and UI updates

**Cons**:
- ❌ Complex implementation (intercept Ink rendering)
- ❌ Requires maintaining parallel output mode
- ❌ ANSI parsing/stripping complexity
- ❌ Timing challenges (when is UI "ready"?)

**Use Case**: Full CLI testing, UI validation

---

### Option 3: MCP Server for CLI Control

**Approach**: Create an MCP server that provides tools to control a running CLI instance.

```typescript
// MCP tools
{
  "tools": [
    {
      "name": "cli_send_input",
      "description": "Send text or key input to CLI",
      "parameters": {
        "input": "string | {key: 'enter' | 'up' | 'down' | ...}"
      }
    },
    {
      "name": "cli_get_screen",
      "description": "Capture current CLI screen output",
      "returns": "string (ANSI or plain text)"
    },
    {
      "name": "cli_get_state",
      "description": "Get CLI internal state",
      "returns": {
        "messages": [...],
        "participants": [...],
        "reasoning_active": true
      }
    }
  ]
}
```

**Pros**:
- ✅ Leverages existing MCP infrastructure
- ✅ Natural for agents (they already use MCP tools)
- ✅ Can run CLI in PTY and control it
- ✅ Flexible - can add more tools as needed

**Cons**:
- ❌ Requires running CLI in pseudo-terminal (PTY)
- ❌ Still needs ANSI parsing for screen capture
- ❌ Complex state management
- ❌ Overhead of MCP server process

**Use Case**: Agent-driven CLI testing

---

### Option 4: Hybrid - CLI Agent Commands

**Approach**: Add special agent-only slash commands to existing CLI.

```bash
# Normal human mode
mew space connect

# Agent can use special commands
/agent:inject {"kind":"chat","payload":{"text":"test"}}
/agent:get_state
/agent:expect "Processing..."
/agent:wait_for reasoning_complete
```

**Output modes**:
- `--output=json` - JSON lines for agent parsing
- `--output=interactive` - Normal human UI (default)

**Pros**:
- ✅ Minimal changes to existing CLI
- ✅ Agents can use real CLI commands too
- ✅ Can mix human and agent workflows
- ✅ Easy to test from agent side

**Cons**:
- ❌ Pollutes command namespace
- ❌ Limited screen/state introspection
- ❌ Still need output parsing logic

**Use Case**: Lightweight agent access

---

### Option 5: CLI HTTP Control Plane (Recommended)

**Approach**: When CLI runs, expose optional HTTP API for programmatic control alongside interactive UI.

```bash
# Start CLI with control plane
mew space connect --control-port 9090

# Agent interacts via HTTP while CLI runs interactively
curl http://localhost:9090/control/send_input -d '{"text":"hello"}'
curl http://localhost:9090/control/state
curl http://localhost:9090/control/screen  # Get current display
```

**API endpoints**:
```
POST   /control/send_input        # Send text or keys
POST   /control/send_message      # Send MEW protocol message
GET    /control/state             # Get CLI state (messages, participants, UI state)
GET    /control/screen            # Get current screen output (plain text or JSON)
GET    /control/messages          # Get message history
WS     /control/stream            # WebSocket for real-time updates
```

**Implementation**:
```typescript
// In CLI startup
if (options.controlPort) {
  const controlServer = express();

  controlServer.post('/control/send_input', (req, res) => {
    enhancedInput.inject(req.body.text || req.body.key);
    res.json({ ok: true });
  });

  controlServer.get('/control/state', (req, res) => {
    res.json({
      messages: messageHistory,
      participants: activeParticipants,
      ui: {
        reasoning_active: reasoningState.active,
        input_focused: true,
        screen_height: process.stdout.rows
      }
    });
  });

  controlServer.get('/control/screen', (req, res) => {
    const stripAnsi = require('strip-ansi');
    const rawScreen = captureInkOutput(); // Get Ink's rendered output
    res.json({
      raw: rawScreen,
      plain: stripAnsi(rawScreen),
      lines: stripAnsi(rawScreen).split('\n')
    });
  });

  controlServer.listen(options.controlPort);
}
```

**Pros**:
- ✅ Clean HTTP API for agents
- ✅ Doesn't interfere with interactive UI
- ✅ Can inspect real-time state
- ✅ WebSocket for streaming updates
- ✅ Optional - only enabled when needed
- ✅ Tests actual CLI running code
- ✅ Easy for agents to use (standard HTTP)

**Cons**:
- ❌ Requires capturing Ink output (some complexity)
- ❌ Need to expose internal state safely
- ❌ Additional port management

**Use Case**: Full-featured agent CLI testing and interaction

---

## Decision

**Recommended: Multi-tier Approach**

Implement multiple access methods for different use cases:

### Tier 1: Gateway HTTP API (Immediate - Already Available)
- **For**: Protocol-level testing, automation
- **Agent uses**: Direct HTTP to gateway
- **No changes needed**

### Tier 2: CLI Control Plane (Near-term - New Feature)
- **For**: CLI testing, interactive workflow validation
- **Implementation**: `--control-port` flag + HTTP API
- **Enables**: Screen capture, state inspection, input injection
- **Priority**: High - enables comprehensive agent testing

### Tier 3: MCP Server (Future - If Needed)
- **For**: Advanced agent workflows
- **Implementation**: Wrapper MCP server around control plane
- **Enables**: Natural tool-based agent interaction
- **Priority**: Low - evaluate after Tier 2

## Implementation Plan

### Phase 1: CLI Control Plane (v0.6)

1. **Add control server** (`src/cli/control-server.ts`):
   ```typescript
   export interface ControlServer {
     sendInput(text: string): void;
     sendKey(key: KeyPress): void;
     getState(): CLIState;
     getScreen(): ScreenCapture;
     getMessages(): Envelope[];
     subscribe(callback: (event: CLIEvent) => void): void;
   }
   ```

2. **Integrate with space connect**:
   ```bash
   mew space connect --control-port 9090
   ```

3. **Capture Ink output**:
   - Hook into Ink's render output
   - Store screen buffer
   - Expose via `/control/screen`

4. **Document agent workflow**:
   ```markdown
   # Agent CLI Testing

   1. Start CLI with control plane:
      mew space connect --control-port 9090

   2. Agent sends input:
      POST http://localhost:9090/control/send_input
      {"text": "hello"}

   3. Agent checks screen:
      GET http://localhost:9090/control/screen
      Returns: {plain: "...", lines: [...]}

   4. Agent inspects state:
      GET http://localhost:9090/control/state
      Returns: {messages: [...], ui: {...}}
   ```

### Phase 2: Testing Infrastructure (v0.6)

1. **Agent test helpers** (`src/cli/test/agent-helpers.ts`):
   ```typescript
   class CLITestClient {
     async start(options?: {controlPort?: number}): Promise<void>
     async sendMessage(text: string): Promise<void>
     async waitForMessage(filter: (env: Envelope) => boolean): Promise<Envelope>
     async expectScreen(pattern: string | RegExp): Promise<void>
     async getState(): Promise<CLIState>
     async stop(): Promise<void>
   }
   ```

2. **Example test**:
   ```typescript
   const cli = new CLITestClient();
   await cli.start({controlPort: 9090});

   await cli.sendMessage("hello");
   await cli.expectScreen(/◆.*hello/); // Diamond separator + message

   const state = await cli.getState();
   assert(state.messages.length > 0);

   await cli.stop();
   ```

### Phase 3: Documentation (v0.6)

Create `docs/agent-cli-access.md`:
- Control plane API reference
- Agent testing guide
- Example workflows
- Troubleshooting

## Consequences

### Positive
- ✅ Agents can fully test CLI functionality
- ✅ Validates interactive features programmatically
- ✅ Enables agent-driven development of CLI
- ✅ Clean HTTP API for external tools
- ✅ Optional feature - no impact when disabled

### Negative
- ❌ Additional complexity in CLI codebase
- ❌ Need to maintain control plane API
- ❌ Screen capture adds overhead
- ❌ Security consideration (local port exposure)

### Neutral
- ⚪ Can be extended with WebSocket for streaming
- ⚪ Foundation for future MCP server if needed
- ⚪ May inspire similar features in other CLIs

## Alternatives Considered But Rejected

1. **ANSI Terminal Emulation** - Too complex, brittle
2. **Playwright/Puppeteer for CLI** - Overkill, not well-supported for terminals
3. **Expect-style Scripting** - Limited, hard to maintain
4. **CLI Mocking** - Doesn't test real code paths

## References

- [MEW Protocol v0.4 Spec](../protocol/v0.4/SPEC.md)
- [CLI Spec](../cli/SPEC.md)
- [Ink Documentation](https://github.com/vadimdemedes/ink)
- [Similar: Cypress Component Testing](https://docs.cypress.io/guides/component-testing/overview)

## Open Questions

1. **Security**: Should control plane require authentication token?
2. **Concurrency**: Can multiple agents control same CLI instance?
3. **Recording**: Should we record agent interactions for debugging?
4. **Performance**: What's the overhead of screen capture on every render?

## Success Metrics

- [ ] Agent can start/stop CLI programmatically
- [ ] Agent can send messages and verify they appear
- [ ] Agent can test slash commands (/help, /streams, etc.)
- [ ] Agent can validate UI state (reasoning active, message count, etc.)
- [ ] Agent can capture and assert on screen output
- [ ] Zero impact on normal human CLI usage
- [ ] Documentation enables new contributors to write agent tests

---

**Next Steps**:
1. Review and approve ADR
2. Create implementation issue
3. Prototype control server MVP
4. Test with Claude Code agent
5. Iterate based on feedback
