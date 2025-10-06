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

### CLI UI Surfaces (Advanced Mode)

The control plane must expose enough information for agents to validate the primary panes of the advanced Ink UI that is defined in [`spec/cli/SPEC.md`](../cli/SPEC.md). The capture needs to preserve ordering, colors (via ANSI), and layout hints so that tests can assert on structure as well as content.

| Surface | Description | Source in UI | Capture Expectation |
|---------|-------------|--------------|---------------------|
| **Transcript Pane** | Scrollback of protocol messages rendered with message bubbles, headers, timestamps, attachments, MCP prompts, etc. | `<Transcript>` subtree inside `AdvancedInteractiveUI` (driven by `messages` state). | Appears first in `lines` array; ANSI colors kept in `raw`, indentation preserved. |
| **Signal Board** | Dockable right-hand column showing acknowledgements, participant statuses, streams, and pause state. | `SignalBoard` component controlled by `signalBoardExpanded` / `signalBoardOverride`. | When expanded the capture includes a vertical divider (`│`). Summary chips appear in collapsed mode. |
| **Reasoning Bar** | 8-line cyan panel rendered when `activeReasoning` is set. | `ReasoningBar` component. | Capture must include spinner glyphs (⠋ etc.) and metrics lines. |
| **Input Composer** | Bottom multiline input with target badges, slash command hints, and editing state. | `EnhancedInput` component. | Capture must show caret placement via ANSI inverse highlight and include placeholder text when empty. |

> **Note**: The CLI renders using Ink, which repaints the entire screen on each frame. The control plane captures the final resolved frame (after Ink diffs are applied) rather than raw incremental writes, ensuring that agents receive a faithful snapshot of what a human user sees.

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
  },
  "last_frame": "2025-01-06T10:01:02.345Z",
  "frames_rendered": 245,
  "scrollback": {
    "buffer_size": 4000,
    "truncated": false
  }
}
```

**Fields**:
- `raw`: Full terminal output with ANSI codes, suitable for re-rendering in snapshot tests
- `plain`: ANSI-stripped text for simple assertions
- `lines`: Array of screen lines (post-ANSI strip) preserving padding
- `width`/`height`: Terminal dimensions reported by Ink (mirrors `stdout.columns/rows`)
- `cursor`: Cursor position (if available) relative to top-left origin (0-indexed)
- `last_frame`: ISO timestamp when this frame was committed to the buffer
- `frames_rendered`: Total number of Ink frames emitted since launch (monotonic)
- `scrollback`: Metadata describing the retained raw buffer length and truncation status

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
      "payload": { "text": "hello" },
      "sent": false,
      "receivedAt": "2025-01-06T10:00:00Z"
    }
  ],
  "participants": ["human", "agent", "mew"],
  "ui": {
    "reasoning": {
      "active": true,
      "participant": "mew",
      "elapsedMs": 3200,
      "tokens": 128,
      "preview": "thinking..."
    },
    "pendingOperation": null,
    "signalBoard": {
      "expanded": true,
      "override": "open",
      "ackCount": 2,
      "statusCount": 1,
      "pauseState": null
    },
    "verboseMode": false,
    "showStreams": true,
    "terminalWidth": 120
  },
  "streams": {
    "active": [
      {
        "streamId": "stream-1",
        "openedBy": "agent",
        "openedAt": "2025-01-06T09:59:58Z",
        "lastActivityAt": "2025-01-06T10:00:01Z"
      }
    ],
    "recentFrames": [
      {
        "streamId": "stream-1",
        "payload": { "type": "token", "value": "hel" },
        "timestamp": "2025-01-06T10:00:00Z"
      }
    ]
  },
  "acknowledgements": {
    "pending": [
      {
        "id": "ack-1",
        "from": "agent",
        "to": "human",
        "requestedAt": "2025-01-06T09:59:30Z",
        "status": "pending"
      }
    ],
    "myPending": []
  },
  "participantStatuses": {
    "agent": {
      "status": "thinking",
      "summary": "Processing query",
      "lastUpdated": "2025-01-06T10:00:00Z"
    }
  },
  "toolCatalog": {
    "agent": [
      {
        "name": "mcp-fs/read",
        "displayName": "Read file",
        "description": "Read file contents",
        "inputSchema": { "path": "string" }
      }
    ]
  },
  "pauseState": null
}
```

##### `CLIStateSnapshot` Schema

The state endpoint should expose the live React state used by `AdvancedInteractiveUI` in a serialisable form so that tests can assert on internal transitions without parsing the rendered screen.

```typescript
interface CLIStateSnapshot {
  messages: Array<{
    id: string;
    kind: string;
    from: string | null;
    to: string[] | null;
    payload: unknown;
    sent: boolean;
    receivedAt: string; // ISO timestamp when added to UI
  }>;
  participants: string[];
  chatTargets: {
    effective: string[] | null;
    override: string[] | null;
    participantDefault: string[] | null;
    globalDefault: string[] | null;
  };
  ui: {
    reasoning: {
      active: boolean;
      participant: string | null;
      elapsedMs: number;
      tokens: number | null;
      preview: string | null;
    };
    pendingOperation: null | {
      id: string;
      kind: string;
      requestedBy: string;
      createdAt: string;
    };
    signalBoard: {
      expanded: boolean;
      override: 'open' | 'close' | 'auto' | null;
      ackCount: number;
      statusCount: number;
      pauseState: null | { participant: string; reason: string | null };
    };
    verboseMode: boolean;
    showStreams: boolean;
    terminalWidth: number | null;
  };
  streams: {
    active: Array<{
      streamId: string;
      openedBy: string;
      openedAt: string;
      lastActivityAt: string;
    }>;
    recentFrames: Array<{
      streamId: string;
      payload: unknown;
      timestamp: string;
    }>;
  };
  acknowledgements: {
    pending: Array<{
      id: string;
      from: string;
      to: string;
      requestedAt: string;
      status: 'pending' | 'granted' | 'denied';
    }>;
    myPending: string[]; // ack ids assigned to current participant
  };
  participantStatuses: Record<string, {
    status: string;
    summary: string | null;
    lastUpdated: string | null;
  }>;
  toolCatalog: Record<string, Array<{
    name: string;
    displayName: string | null;
    description: string | null;
    inputSchema: unknown | null;
  }>>;
  pauseState: null | {
    active: boolean;
    requestedBy: string | null;
    expiresAt: string | null;
    reason: string | null;
  };
}
```

- The snapshot should reuse existing TypeScript types where available (e.g. `UIMessage`, `ReasoningState`).
- Avoid leaking unserialisable structures (Maps/Sets). Convert to arrays or plain objects before returning.
- Time values must be ISO 8601 strings to allow deterministic assertions.

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
  getState: () => CLIStateSnapshot;
  sendInput: (input: string | KeyPress) => void;
  getScreen: () => ScreenSnapshot;
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
    const plain = stripAnsi(screen.raw);
    res.json({
      raw: screen.raw,
      plain,
      lines: plain.split('\n'),
      width: screen.dimensions.width,
      height: screen.dimensions.height,
      cursor: screen.cursor ?? null,
      last_frame: screen.lastFrame.toISOString(),
      frames_rendered: screen.framesRendered,
      scrollback: {
        buffer_size: screen.bufferSize,
        truncated: screen.truncated
      }
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

**Objective**: Mirror the terminal output that a human sees without breaking Ink's rendering model.

#### ControlPlaneStdout Multiplexer

```typescript
// src/cli/utils/control-plane-stdout.ts
import { Writable } from 'node:stream';

export interface ScreenSnapshot {
  raw: string;
  lastFrame: Date;
  framesRendered: number;
  bufferSize: number;
  truncated: boolean;
  dimensions: { width: number; height: number };
  cursor?: { x: number; y: number };
}

export class ControlPlaneStdout extends Writable {
  #target: NodeJS.WriteStream;
  #buffer = '';
  #frames = 0;
  #lastFrame = new Date(0);
  #maxBuffer = Number(process.env.CONTROL_PLANE_BUFFER ?? 4000);
  #cursor: { x: number; y: number } | undefined;

  constructor(target: NodeJS.WriteStream) {
    super();
    this.#target = target;
    this.columns = target.columns;
    this.rows = target.rows;

    target.on?.('resize', () => {
      this.columns = target.columns;
      this.rows = target.rows;
    });
  }

  _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.#frames += 1;
    this.#lastFrame = new Date();

    if (typeof chunk === 'string') {
      this.#buffer += chunk;
      if (this.#buffer.length > this.#maxBuffer) {
        this.#buffer = this.#buffer.slice(-this.#maxBuffer);
      }
    }

    this.#target.write(chunk, encoding, callback);
  }

  snapshot(): ScreenSnapshot {
    return {
      raw: this.#buffer,
      lastFrame: this.#lastFrame,
      framesRendered: this.#frames,
      bufferSize: this.#buffer.length,
      truncated: this.#buffer.length >= this.#maxBuffer,
      dimensions: {
        width: this.columns ?? this.#target.columns ?? 0,
        height: this.rows ?? this.#target.rows ?? 0
      },
      cursor: this.#cursor
    };
  }

  setCursor(cursor: { x: number; y: number } | undefined) {
    this.#cursor = cursor;
  }
}
```

- Buffer retains the last ~4k characters (configurable via `CONTROL_PLANE_BUFFER` env var).
- Cursor info is optional; `EnhancedInput` will call `controlStdout.setCursor({x,y})` whenever caret moves.
- Multiplexer proxies terminal resize events to keep Ink layout stable.

#### Wiring into Ink Render

```typescript
// src/cli/utils/advanced-interactive-ui.ts
import { ControlPlaneStdout } from './control-plane-stdout.js';

interface ControlPlaneOptions {
  stdout?: ControlPlaneStdout;
  stdin?: NodeJS.ReadStream;
  registerScreen?: (getter: () => ScreenSnapshot) => void;
  inputHandle?: React.RefObject<ControlInputHandle>;
  publishState?: (state: CLIStateSnapshot) => void;
  onShutdown?: () => void;
}

interface ControlInputHandle {
  send: (input: string | KeyPress) => void;
}

// KeyPress type should align with Ink's handler signature (e.g., `import type { Key } from 'ink'; type KeyPress = Key & { input?: string };`).

function startAdvancedInteractiveUI(ws, participantId, spaceId, themeName, defaultChatTargets, controlOptions?: ControlPlaneOptions) {
  const stdin = controlOptions?.stdin ?? process.stdin;
  const controlEnabled = Boolean(controlOptions);
  const inkStdout = controlEnabled
    ? controlOptions?.stdout ?? new ControlPlaneStdout(process.stdout)
    : process.stdout;

  if (controlEnabled && !(inkStdout instanceof ControlPlaneStdout)) {
    throw new Error('controlOptions.stdout must be ControlPlaneStdout when control plane enabled');
  }

  const instance = render(
    React.createElement(AdvancedInteractiveUI, { ws, participantId, spaceId, themeName, defaultChatTargets }),
    { stdout: inkStdout as unknown as NodeJS.WriteStream, stdin, patchConsole: true }
  );

  if (controlEnabled) {
    controlOptions?.registerScreen?.(() => (inkStdout as ControlPlaneStdout).snapshot());
  }

  process.on('SIGINT', () => {
    instance.unmount();
    controlOptions?.onShutdown?.();
    process.exit(0);
  });

  return instance;
}
```

- When control plane disabled we simply call `render(...);` without wrapping output (zero cost).
- When enabled we pass `registerScreen` from `space connect` to expose snapshots.
- Control server uses the registered closure to service `/control/screen`.
- TypeScript cast (`as unknown as NodeJS.WriteStream`) bridges Ink's type expectations with the custom `ControlPlaneStdout` implementation.

### 3. Input Injection

**Modify EnhancedInput Component**:

```typescript
// In src/cli/ui/components/EnhancedInput.ts
export interface EnhancedInputHandle {
  inject: (input: string | KeyPress) => void;
  clear: () => void;
  getCursor: () => { x: number; y: number };
}

type EnhancedInputProps = {
  // existing props ...
  onCursorChange?: (cursor: { x: number; y: number }) => void;
};

const EnhancedInput = React.forwardRef<EnhancedInputHandle, EnhancedInputProps>((props, ref) => {
  const { onCursorChange, ...rest } = props;
  const bufferRef = useRef(new TextBuffer());

  const emitCursor = useCallback(() => {
    const position = bufferRef.current.getCursorPosition?.();
    if (position && onCursorChange) {
      onCursorChange({ x: position.column, y: position.line });
    }
  }, [onCursorChange]);

  useEffect(() => {
    emitCursor();
  }, [emitCursor, updateCounter]);

  useImperativeHandle(ref, () => ({
    inject: (input) => {
      if (typeof input === 'string') {
        bufferRef.current.insert?.(input);
      } else {
        handleKeyPress(input);
      }
      emitCursor();
      setUpdateCounter(c => c + 1);
    },
    clear: () => {
      bufferRef.current.clear();
      emitCursor();
      setUpdateCounter(c => c + 1);
    },
    getCursor: () => {
      const position = bufferRef.current.getCursorPosition?.();
      return position ? { x: position.column, y: position.line } : { x: 0, y: 0 };
    }
  }));

  // ... rest of component using `rest`
});
```

**Expose Handle to Control Plane**:

```typescript
// In advanced-interactive-ui.ts
const inputRef = useRef<EnhancedInputHandle>(null);

useEffect(() => {
  controlOptions?.publishState?.(buildSnapshot());
}, [messages, pendingOperation, activeReasoning, controlOptions]);

useImperativeHandle(controlOptions?.inputHandle, () => ({
  send: (payload) => inputRef.current?.inject(payload)
}));

<EnhancedInput
  ref={inputRef}
  onSubmit={processInput}
  onCursorChange={(cursor) => controlOptions?.stdout?.setCursor(cursor)}
  {...enhancedInputProps}
/>
```

### 4. State Publication

**Goal**: Provide `/control/state` with an up-to-date snapshot without re-render side effects.

```typescript
// In advanced-interactive-ui.ts
const latestStateRef = useRef<CLIStateSnapshot | null>(null);

const buildSnapshot = useCallback((): CLIStateSnapshot => ({
  messages: messages.map(entry => ({
    id: entry.id,
    kind: entry.message.kind,
    from: entry.message.from ?? null,
    to: entry.message.to ?? null,
    payload: entry.message.payload ?? null,
    sent: entry.sent,
    receivedAt: entry.timestamp.toISOString()
  })),
  participants: knownParticipants,
  chatTargets: {
    effective: getEffectiveChatTargets(),
    override: chatTargetOverride,
    participantDefault: participantDefaultTargets,
    globalDefault: globalDefaultTargets
  },
  ui: {
    reasoning: serializeReasoning(activeReasoning),
    pendingOperation,
    signalBoard: serializeSignalBoard(),
    verboseMode: verbose,
    showStreams,
    terminalWidth
  },
  streams: {
    active: Array.from(activeStreams.values()).map(stream => ({
      streamId: stream.streamId,
      openedBy: stream.openedBy,
      openedAt: stream.openedAt.toISOString(),
      lastActivityAt: stream.lastActivityAt.toISOString()
    })),
    recentFrames: streamFrames.map(frame => ({
      streamId: frame.streamId,
      payload: safeParse(frame.payload),
      timestamp: frame.timestamp.toISOString()
    }))
  },
  acknowledgements: {
    pending: pendingAcknowledgements.map(ack => ({
      id: ack.id,
      from: ack.from,
      to: ack.to,
      requestedAt: ack.requestedAt,
      status: ack.status
    })),
    myPending: myPendingAcknowledgements.map(ack => ack.id)
  },
  participantStatuses: Object.fromEntries(Array.from(participantStatuses.entries()).map(([id, status]) => [id, {
    status: status.status,
    summary: status.summary ?? null,
    lastUpdated: status.updatedAt ?? null
  }])),
  toolCatalog: Object.fromEntries(Array.from(toolCatalog.entries())),
  pauseState: pauseState ? {
    active: pauseState.active,
    requestedBy: pauseState.requestedBy ?? null,
    expiresAt: pauseState.expiresAt ?? null,
    reason: pauseState.reason ?? null
  } : null
})), [
  messages,
  knownParticipants,
  chatTargetOverride,
  participantDefaultTargets,
  globalDefaultTargets,
  activeReasoning,
  pendingOperation,
  pendingAcknowledgements,
  myPendingAcknowledgements,
  participantStatuses,
  toolCatalog,
  pauseState,
  activeStreams,
  streamFrames,
  verbose,
  showStreams,
  terminalWidth
]);

useEffect(() => {
  const snapshot = buildSnapshot();
  latestStateRef.current = snapshot;
  controlOptions?.publishState?.(snapshot);
}, [buildSnapshot, controlOptions]);
```

- `serializeReasoning`, `serializeSignalBoard`, and `safeParse` are helper functions to normalise Ink-only data.
- `toolCatalog` and `participantStatuses` are Maps in the UI; convert to serialisable structures when building the snapshot.
- `latestStateRef` feeds `/control/state` via `controlOptions.publishState` (see CLI integration snippet).

```typescript
const safeParse = (value: unknown) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const serializeSignalBoard = () => ({
  expanded: signalBoardExpanded,
  override: signalBoardOverride,
  ackCount: pendingAcknowledgements.length,
  statusCount: participantStatuses.size,
  pauseState: pauseState
    ? { participant: pauseState.participant, reason: pauseState.reason ?? null }
    : null
});

const serializeReasoning = (state: ReasoningState | null) => state ? ({
  active: true,
  participant: state.participant,
  elapsedMs: state.elapsedMs,
  tokens: state.tokens ?? null,
  preview: state.preview ?? null
}) : ({ active: false, participant: null, elapsedMs: 0, tokens: null, preview: null });
```

> `ReasoningState` refers to the existing UI type that tracks reasoning progress within `AdvancedInteractiveUI`.

### 5. CLI Integration

**Modify space.ts command**:

```typescript
// In src/cli/commands/space.ts
import { ControlPlaneStdout } from '../utils/control-plane-stdout.js';
import { startControlServer } from '../control-server.js';

program
  .command('connect')
  .option('--control-port <port>', 'Enable control plane on port (for testing)', parseInt)
  // ... other options
  .action(async (options) => {
    // ... existing setup

    let latestScreen: () => ScreenSnapshot = () => ({
      raw: '',
      lastFrame: new Date(0),
      framesRendered: 0,
      bufferSize: 0,
      truncated: false,
      dimensions: { width: process.stdout.columns ?? 0, height: process.stdout.rows ?? 0 }
    });
    let latestState: CLIStateSnapshot = createInitialSnapshot();
    const inputHandle = React.createRef<ControlInputHandle>();
    let controlServer: ReturnType<typeof startControlServer> | null = null;
    let controlStdout: ControlPlaneStdout | undefined;

    if (options.controlPort) {
      controlStdout = new ControlPlaneStdout(process.stdout);
      controlServer = startControlServer({
        port: options.controlPort,
        sendInput: (payload) => inputHandle.current?.send(payload),
        getState: () => latestState,
        getScreen: () => latestScreen()
      });

      console.log(`Starting CLI with control plane on port ${controlServer.port}`);
    }

    const ui = startAdvancedInteractiveUI(ws, participantId, spaceId, themeName, defaultChatTargets, options.controlPort ? {
      stdout: controlStdout,
      inputHandle,
      registerScreen: (getter) => { latestScreen = getter; },
      publishState: (state) => { latestState = state; },
      onShutdown: () => controlServer?.stop()
    } : undefined);

    if (!options.controlPort) {
      return ui;
    }

    // Clean up when WebSocket closes
    ws.on('close', () => controlServer?.stop());
  });
```

- `createInitialSnapshot()` should return a minimal `CLIStateSnapshot` (empty arrays, default UI flags) to satisfy the control server before the first render publishes state.
- Ensure the command tears down `controlServer` on process exit and when the WebSocket errors, to avoid orphan listeners.

### 6. Background Execution

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

# Check screen output and frame metadata
curl http://localhost:9090/control/screen | jq '{plain, frames_rendered, last_frame}'
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
curl http://localhost:9090/control/state | jq '.ui.reasoning.active'

# Wait for reasoning to complete
while [ "$(curl -s http://localhost:9090/control/state | jq -r '.ui.reasoning.active')" = "true" ]; do
  sleep 0.5
done

# Check final state
curl http://localhost:9090/control/state | jq '.messages[-1]'
```

### Example 4: TypeScript Test Helper

```typescript
// Create reusable test client
interface ScreenResponse {
  raw: string;
  plain: string;
  lines: string[];
  width: number;
  height: number;
  cursor: { x: number; y: number } | null;
  last_frame: string;
  frames_rendered: number;
  scrollback: { buffer_size: number; truncated: boolean };
}

type CLIState = CLIStateSnapshot;

class CLITestClient {
  private baseUrl: string;
  private process: ChildProcess | null = null;
  private lastScreen: ScreenResponse | null = null;

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
    const data: ScreenResponse = await res.json();
    this.lastScreen = data;
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

  async waitForFrameChange(previousFrame: number, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const res = await fetch(`${this.baseUrl}/control/screen`);
      const data: ScreenResponse = await res.json();
      if (data.frames_rendered > previousFrame) {
        this.lastScreen = data;
        return data;
      }
      await new Promise(r => setTimeout(r, 50));
    }
    throw new Error('Timed out waiting for new frame');
  }

  getLastFrameCount() {
    return this.lastScreen?.frames_rendered ?? 0;
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
await cli.waitForFrameChange(cli.getLastFrameCount());
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
  let mockState: CLIStateSnapshot = {
    messages: [],
    participants: [],
    chatTargets: {
      effective: null,
      override: null,
      participantDefault: null,
      globalDefault: null
    },
    ui: {
      reasoning: { active: false, participant: null, elapsedMs: 0, tokens: null, preview: null },
      pendingOperation: null,
      signalBoard: { expanded: false, override: null, ackCount: 0, statusCount: 0, pauseState: null },
      verboseMode: false,
      showStreams: false,
      terminalWidth: 80
    },
    streams: { active: [], recentFrames: [] },
    acknowledgements: { pending: [], myPending: [] },
    participantStatuses: {},
    toolCatalog: {},
    pauseState: null
  };

  beforeEach(() => {
    server = startControlServer({
      port: 0, // Random port
      getState: () => mockState,
      sendInput: jest.fn(),
      getScreen: () => ({
        raw: '\u001b[32mtest\u001b[0m',
        lastFrame: new Date(),
        framesRendered: 1,
        bufferSize: 4,
        truncated: false,
        dimensions: { width: 80, height: 24 },
        cursor: null
      })
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

# Verify plain text and frame metadata
INITIAL_FRAMES=$(curl -s http://localhost:9090/control/screen | jq '.frames_rendered')
SCREEN=$(curl -s http://localhost:9090/control/screen | jq -r '.plain')
if echo "$SCREEN" | grep -q "test"; then
  echo "✓ Message appeared on screen"
else
  echo "✗ Message not found"
  exit 1
fi

UPDATED_FRAMES=$(curl -s http://localhost:9090/control/screen | jq '.frames_rendered')
if [ "$UPDATED_FRAMES" -le "$INITIAL_FRAMES" ]; then
  echo "✗ frames_rendered did not increase"
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
- [ ] GET /control/screen returns current display with `frames_rendered`, `last_frame`, `cursor`, and `scrollback` metadata
- [ ] GET /control/state returns serialised CLI state matching `CLIStateSnapshot`
- [ ] Agent can start CLI in background and control it
- [ ] Screen capture includes last N chars of output (default 4k, configurable)
- [ ] Frame counter increases whenever Ink paints a new frame
- [ ] Input injection works for text and special keys
- [ ] No impact on CLI when `--control-port` not used

### Non-Functional Requirements

- [ ] Screen buffer capped at 4k characters by default (`CONTROL_PLANE_BUFFER` env override)
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
