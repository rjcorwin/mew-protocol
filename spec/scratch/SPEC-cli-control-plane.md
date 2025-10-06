# CLI Control Plane Specification

**Status**: Draft
**Version**: 0.1
**Target Release**: v0.6
**Related**: [ADR-agent-cli-access.md](./ADR-agent-cli-access.md)

## Overview

The CLI Control Plane enables programmatic access to the MEW interactive CLI for automated testing and agent-driven workflows. When enabled via `--control-port`, the CLI exposes an HTTP API for input injection, screen capture, and state inspection.

### Motivation

AI coding agents need to:
- Test CLI functionality programmatically
- Validate interactive features (themes, formatters, UI)
- Debug issues by reproducing user scenarios
- Develop features that integrate with the CLI

The current Ink-based terminal UI cannot be controlled programmatically, making automated testing difficult.

### Goals

1. **Enable Agent Testing**: Agents can fully test CLI without human interaction
2. **Minimal Impact**: Zero overhead when control plane is disabled
3. **Real Code Paths**: Tests actual CLI implementation, not mocks
4. **Developer Friendly**: Simple HTTP API, easy to use from any environment

### Non-Goals

- WebSocket streaming (future enhancement)
- Authentication/authorization (localhost-only, development tool)
- Production deployment (development/testing only)

## Architecture

### Components

```
┌─────────────────────────────────────────┐
│  MEW CLI (Ink React Terminal UI)       │
│                                         │
│  ┌─────────────────┐  ┌──────────────┐ │
│  │ Interactive UI  │  │ Control      │ │
│  │ (Ink)          │  │ Server       │ │
│  │                │  │ (Express)    │ │
│  │  - Messages    │  │              │ │
│  │  - Input       │  │  - /send     │ │
│  │  - State       │←→│  - /screen   │ │
│  │                │  │  - /state    │ │
│  └─────────────────┘  └──────────────┘ │
│          ↓                    ↑         │
│    stdout/stdin         HTTP API        │
└─────────────────────────────────────────┘
           ↓                    ↑
    Terminal Display      Agent/Test Client
```

### Data Flow

1. **Input Injection**: Agent → HTTP API → EnhancedInput → CLI Processing
2. **Screen Capture**: CLI → stdout interception → HTTP API → Agent
3. **State Access**: CLI React State → HTTP API → Agent

## API Specification

### Base Configuration

**Endpoint**: `http://localhost:{controlPort}`
**Transport**: HTTP/1.1
**Format**: JSON
**Port**: User-specified via `--control-port` flag

### Endpoints

#### 1. Health Check

```http
GET /control/health
```

**Response** (200 OK):
```json
{
  "ok": true,
  "version": "0.6.0",
  "uptime": 1234
}
```

**Purpose**: Readiness check for agents starting CLI in background

---

#### 2. Send Input

```http
POST /control/send_input
Content-Type: application/json
```

**Request Body**:
```json
{
  "text": "hello world"
}
```
Or for key events:
```json
{
  "key": "enter"
}
```

**Supported Keys**:
- `enter`, `escape`, `tab`
- `up`, `down`, `left`, `right`
- `backspace`, `delete`
- `home`, `end`
- `pageup`, `pagedown`
- Modifiers: `ctrl+c`, `ctrl+d`, `shift+enter`

**Response** (200 OK):
```json
{
  "ok": true,
  "injected": "hello world"
}
```

**Errors**:
- `400`: Invalid key name or missing input
- `503`: Input component not ready

---

#### 3. Get Screen

```http
GET /control/screen
```

**Response** (200 OK):
```json
{
  "raw": "...\u001b[32mtext\u001b[0m...",
  "plain": "...text...",
  "lines": ["line1", "line2", "..."],
  "width": 120,
  "height": 40,
  "cursor": {
    "x": 0,
    "y": 38
  }
}
```

**Fields**:
- `raw`: Full terminal output with ANSI codes
- `plain`: ANSI-stripped text
- `lines`: Array of screen lines
- `width`/`height`: Terminal dimensions
- `cursor`: Cursor position (if available)

---

#### 4. Get State

```http
GET /control/state
```

**Response** (200 OK):
```json
{
  "messages": [
    {
      "id": "msg-123",
      "kind": "chat",
      "from": "human",
      "to": ["agent"],
      "text": "hello",
      "timestamp": "2025-01-06T10:00:00Z"
    }
  ],
  "participants": ["human", "agent", "mew"],
  "ui": {
    "reasoning_active": true,
    "pending_operation": false,
    "signal_board_expanded": true,
    "layout_mode": "docked"
  },
  "active_streams": [
    {
      "id": "stream-1",
      "description": "reasoning:ctx-123",
      "opened_by": "agent"
    }
  ],
  "pending_acks": 2,
  "participant_statuses": {
    "agent": {
      "status": "thinking",
      "summary": "Processing query"
    }
  }
}
```

---

#### 5. Get Messages

```http
GET /control/messages?limit=50&kind=chat
```

**Query Parameters**:
- `limit`: Max messages to return (default: 100)
- `kind`: Filter by envelope kind (optional)
- `from`: Filter by sender (optional)
- `since`: Timestamp filter (ISO 8601)

**Response** (200 OK):
```json
{
  "messages": [...],
  "total": 150,
  "filtered": 50
}
```

---

#### 6. Wait For Condition (Optional)

```http
POST /control/wait
Content-Type: application/json
```

**Request Body**:
```json
{
  "condition": "message_count > 5",
  "timeout": 5000
}
```

Or predefined conditions:
```json
{
  "condition": "reasoning_complete",
  "timeout": 10000
}
```

**Supported Conditions**:
- `message_count > N`
- `screen_contains "text"`
- `reasoning_active`
- `reasoning_complete`
- `no_pending_operations`

**Response** (200 OK):
```json
{
  "ok": true,
  "matched": true,
  "elapsed": 234
}
```

**Response** (408 Timeout):
```json
{
  "ok": false,
  "matched": false,
  "elapsed": 5000,
  "error": "timeout"
}
```

## Implementation Details

### 1. Control Server Setup

**Location**: `src/cli/control-server.ts`

```typescript
import express from 'express';
import { stripAnsi } from './utils/ansi.js';

export interface ControlServerOptions {
  port: number;
  getState: () => CLIState;
  sendInput: (input: string | KeyPress) => void;
  getScreen: () => ScreenCapture;
}

export function startControlServer(options: ControlServerOptions) {
  const app = express();
  app.use(express.json());

  app.get('/control/health', (req, res) => {
    res.json({ ok: true, version: '0.6.0', uptime: process.uptime() });
  });

  app.post('/control/send_input', (req, res) => {
    const { text, key } = req.body;
    if (!text && !key) {
      return res.status(400).json({ error: 'Missing text or key' });
    }

    try {
      options.sendInput(text || { key });
      res.json({ ok: true, injected: text || key });
    } catch (err) {
      res.status(503).json({ error: 'Input component not ready' });
    }
  });

  app.get('/control/screen', (req, res) => {
    const screen = options.getScreen();
    res.json({
      raw: screen.raw,
      plain: stripAnsi(screen.raw),
      lines: stripAnsi(screen.raw).split('\n'),
      width: process.stdout.columns,
      height: process.stdout.rows
    });
  });

  app.get('/control/state', (req, res) => {
    const state = options.getState();
    res.json(state);
  });

  const server = app.listen(options.port, 'localhost');

  return {
    stop: () => server.close(),
    port: options.port
  };
}
```

### 2. Screen Capture

**Approach A: Stdout Interception** (Recommended for MVP)

```typescript
// In advanced-interactive-ui.ts startup
let screenBuffer = '';
const originalWrite = process.stdout.write.bind(process.stdout);

process.stdout.write = (chunk: any, ...args: any[]) => {
  if (typeof chunk === 'string') {
    screenBuffer += chunk;
    // Keep last 100KB only
    if (screenBuffer.length > 100000) {
      screenBuffer = screenBuffer.slice(-100000);
    }
  }
  return originalWrite(chunk, ...args);
};

export function getScreenCapture(): ScreenCapture {
  return {
    raw: screenBuffer,
    timestamp: new Date()
  };
}
```

**Approach B: Shadow State** (Future Enhancement)

```typescript
// Maintain parallel state structure
const uiShadow = {
  messages: [],
  reasoning: null,
  statusBar: {}
};

// Update alongside React state
setMessages(prev => {
  const next = [...prev, msg];
  uiShadow.messages = next; // Keep in sync
  return next;
});

// Reconstruct screen from state
export function getScreenCapture(): ScreenCapture {
  const lines = [];
  uiShadow.messages.forEach(msg => {
    lines.push(formatMessage(msg));
  });
  // ... add status bar, reasoning, etc.
  return { raw: lines.join('\n') };
}
```

### 3. Input Injection

**Modify EnhancedInput Component**:

```typescript
// In src/cli/ui/components/EnhancedInput.ts
export interface EnhancedInputRef {
  inject: (input: string | KeyPress) => void;
  clear: () => void;
}

const EnhancedInput = React.forwardRef((props, ref) => {
  // ... existing state

  React.useImperativeHandle(ref, () => ({
    inject: (input: string | KeyPress) => {
      if (typeof input === 'string') {
        setValue(prev => prev + input);
      } else {
        // Simulate key press
        handleKeyPress(input);
      }
    },
    clear: () => setValue('')
  }));

  // ... rest of component
});
```

**Wire to Control Server**:

```typescript
// In advanced-interactive-ui.ts
const inputRef = useRef<EnhancedInputRef>(null);

// Pass to control server
if (controlPort) {
  startControlServer({
    port: controlPort,
    sendInput: (input) => inputRef.current?.inject(input),
    getState: () => ({ messages, participants, ui: {...} }),
    getScreen: () => getScreenCapture()
  });
}

// Pass ref to input component
<EnhancedInput
  ref={inputRef}
  onSubmit={processInput}
  // ... other props
/>
```

### 4. CLI Integration

**Modify space.ts command**:

```typescript
// In src/cli/commands/space.ts
program
  .command('connect')
  .option('--control-port <port>', 'Enable control plane on port (for testing)', parseInt)
  // ... other options
  .action(async (options) => {
    // ... existing setup

    if (options.controlPort) {
      console.log(`Starting CLI with control plane on port ${options.controlPort}`);
    }

    startAdvancedInteractiveUI({
      ws,
      participantId,
      spaceId,
      controlPort: options.controlPort,
      // ... other options
    });
  });
```

### 5. Background Execution

**For Agent Usage**:

```bash
# Start in background
mew space connect --control-port 9090 > /dev/null 2>&1 &
CLI_PID=$!

# Wait for readiness
until curl -s http://localhost:9090/control/health > /dev/null 2>&1; do
  sleep 0.1
done

# Now ready for agent control
```

**Signal Handling**:

```typescript
// Clean shutdown on signals
process.on('SIGINT', () => {
  controlServer?.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  controlServer?.stop();
  process.exit(0);
});
```

## Usage Examples

### Example 1: Basic Message Send

```bash
# Start CLI with control plane
mew space connect --control-port 9090 &

# Wait for ready
sleep 1

# Send a message
curl -X POST http://localhost:9090/control/send_input \
  -H 'Content-Type: application/json' \
  -d '{"text":"hello world"}'

# Simulate Enter key
curl -X POST http://localhost:9090/control/send_input \
  -H 'Content-Type: application/json' \
  -d '{"key":"enter"}'

# Check screen output
curl http://localhost:9090/control/screen | jq '.plain'
```

### Example 2: Test Slash Command

```bash
# Send /help command
curl -X POST http://localhost:9090/control/send_input \
  -d '{"text":"/help"}'

curl -X POST http://localhost:9090/control/send_input \
  -d '{"key":"enter"}'

# Verify help text appears
curl http://localhost:9090/control/screen | \
  jq -r '.plain' | \
  grep "Available Commands"
```

### Example 3: Verify Reasoning Display

```bash
# Get current state
curl http://localhost:9090/control/state | jq '.ui.reasoning_active'

# Wait for reasoning to complete
while [ "$(curl -s http://localhost:9090/control/state | jq -r '.ui.reasoning_active')" = "true" ]; do
  sleep 0.5
done

# Check final state
curl http://localhost:9090/control/state | jq '.messages[-1]'
```

### Example 4: TypeScript Test Helper

```typescript
// Create reusable test client
class CLITestClient {
  private baseUrl: string;
  private process: ChildProcess | null = null;

  async start(port: number = 9090) {
    // Start CLI in background
    this.process = spawn('mew', [
      'space', 'connect',
      '--control-port', port.toString()
    ], {
      detached: true,
      stdio: 'ignore'
    });

    this.baseUrl = `http://localhost:${port}`;

    // Wait for ready
    await this.waitForReady();
  }

  private async waitForReady(timeout: number = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const res = await fetch(`${this.baseUrl}/control/health`);
        if (res.ok) return;
      } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('CLI not ready');
  }

  async sendText(text: string) {
    await fetch(`${this.baseUrl}/control/send_input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
  }

  async sendKey(key: string) {
    await fetch(`${this.baseUrl}/control/send_input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
  }

  async getScreen(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/control/screen`);
    const data = await res.json();
    return data.plain;
  }

  async getState(): Promise<CLIState> {
    const res = await fetch(`${this.baseUrl}/control/state`);
    return res.json();
  }

  async expectScreen(pattern: string | RegExp) {
    const screen = await this.getScreen();
    const matches = typeof pattern === 'string'
      ? screen.includes(pattern)
      : pattern.test(screen);

    if (!matches) {
      throw new Error(`Screen does not match ${pattern}\n\nActual:\n${screen}`);
    }
  }

  async stop() {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}

// Usage in test
const cli = new CLITestClient();
await cli.start(9090);

await cli.sendText('hello');
await cli.sendKey('enter');
await cli.expectScreen(/◆.*hello/);

await cli.stop();
```

## Testing Strategy

### Unit Tests

Test control server endpoints independently:

```typescript
import { startControlServer } from '../control-server.js';

describe('Control Server', () => {
  let server;
  let mockState = { messages: [], participants: [] };

  beforeEach(() => {
    server = startControlServer({
      port: 0, // Random port
      getState: () => mockState,
      sendInput: jest.fn(),
      getScreen: () => ({ raw: 'test' })
    });
  });

  it('should return health check', async () => {
    const res = await fetch(`http://localhost:${server.port}/control/health`);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  // ... more tests
});
```

### Integration Tests

Test full CLI with control plane:

```bash
# e2e/scenario-control-plane/test.sh
#!/bin/bash

# Start CLI with control
mew space connect --control-port 9090 &
CLI_PID=$!

# Wait for ready
until curl -s http://localhost:9090/control/health > /dev/null; do
  sleep 0.1
done

# Send message
curl -X POST http://localhost:9090/control/send_input -d '{"text":"test"}'
curl -X POST http://localhost:9090/control/send_input -d '{"key":"enter"}'

# Verify
SCREEN=$(curl -s http://localhost:9090/control/screen | jq -r '.plain')
if echo "$SCREEN" | grep -q "test"; then
  echo "✓ Message appeared on screen"
else
  echo "✗ Message not found"
  exit 1
fi

# Cleanup
kill $CLI_PID
```

### Agent Test Workflow

```typescript
// Agent-driven test
const cli = new CLITestClient();

// 1. Start CLI
await cli.start();

// 2. Send various inputs
await cli.sendText('/help');
await cli.sendKey('enter');

// 3. Verify help displayed
await cli.expectScreen('Available Commands');

// 4. Test slash commands
await cli.sendText('/participants');
await cli.sendKey('enter');
await cli.expectScreen(/human|agent|mew/);

// 5. Test chat
await cli.sendText('hello world');
await cli.sendKey('enter');
await cli.expectScreen('hello world');

// 6. Verify state
const state = await cli.getState();
assert(state.messages.length > 0);

// 7. Cleanup
await cli.stop();
```

## Security Considerations

1. **Localhost Only**: Control server binds to `127.0.0.1` only
2. **No Authentication**: Intentional - development/testing tool
3. **No TLS**: HTTP only - local communication
4. **Port Conflicts**: User chooses port, should check availability
5. **Process Isolation**: Each CLI instance has separate control server

**Warning in Docs**:
> ⚠️ The control plane is for development and testing only. Do not expose control ports to networks or use in production.

## Success Criteria

### Functional Requirements

- [ ] `mew space connect --control-port 9090` starts without errors
- [ ] Health endpoint returns 200 OK when ready
- [ ] POST /control/send_input accepts text and key inputs
- [ ] GET /control/screen returns current display
- [ ] GET /control/state returns accurate CLI state
- [ ] Agent can start CLI in background and control it
- [ ] Screen capture includes last N chars of output
- [ ] Input injection works for text and special keys
- [ ] No impact on CLI when `--control-port` not used

### Non-Functional Requirements

- [ ] Screen buffer max 100KB (performance)
- [ ] API responds in < 100ms (responsiveness)
- [ ] Graceful shutdown on SIGTERM/SIGINT
- [ ] No memory leaks from screen buffering
- [ ] Works on macOS, Linux, Windows (if applicable)

### Documentation Requirements

- [ ] API reference in `docs/agent-cli-access.md`
- [ ] Usage examples for common scenarios
- [ ] TypeScript types exported for test helpers
- [ ] Security warnings about localhost-only use
- [ ] Troubleshooting section

## Future Enhancements

1. **WebSocket Streaming**: Real-time event stream via `/control/stream` (WS)
2. **Record/Replay**: Capture interaction sessions for debugging
3. **Visual Regression**: Screenshot comparison for UI tests
4. **Performance Metrics**: Track render times, input latency
5. **Multi-instance**: Control multiple CLI instances from one client
6. **Authentication**: Optional token-based auth for remote access

## References

- [ADR-agent-cli-access.md](./ADR-agent-cli-access.md) - Architecture decision
- [Ink Documentation](https://github.com/vadimdemedes/ink) - CLI framework
- [MEW Protocol v0.4](../protocol/v0.4/SPEC.md) - Protocol spec
- [Express.js](https://expressjs.com/) - HTTP server framework

---

**Version History**:
- 0.1 (2025-01-06): Initial draft specification
