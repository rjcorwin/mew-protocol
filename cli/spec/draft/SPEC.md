# MEUP CLI Specification - Minimal Test Implementation

**Version:** draft  
**Status:** Draft  
**Last Updated:** 2025-01-05

## Overview

The MEUP CLI (`@meup/cli`) provides minimal command-line tools needed to execute the test plan in `/tests/TEST_PLAN.md`. This is a focused implementation that prioritizes getting tests running.

## Scope

This specification covers ONLY what's needed for testing:
- Gateway server startup
- Client connections with FIFO mode
- Three built-in test agents (echo, calculator, fulfiller)
- Basic token generation

This specification does NOT cover:
- Space configuration (deferred to next version)
- Advanced features
- Production deployment

## Architecture

```
@meup/cli
├── Commands
│   ├── gateway.js    # Start gateway server
│   ├── client.js     # Connect as client with FIFO
│   ├── agent.js      # Start built-in agents
│   └── token.js      # Generate test tokens
├── Agents
│   ├── echo.js       # Echo agent
│   ├── calculator.js # Calculator agent  
│   └── fulfiller.js  # Fulfiller agent
└── SDK Dependencies
    ├── @meup/gateway
    ├── @meup/client
    └── @meup/agent
```

## Commands

### `meup gateway start`

Starts a gateway server for testing.

```bash
meup gateway start [options]

Options:
  --port <port>          Port to listen on (default: 8080)
  --log-level <level>    debug|info|warn|error (default: info)
```

**Example:**
```bash
meup gateway start --port 8080 --log-level debug
```

### `meup client connect`

Connects to a gateway as a client with FIFO mode for test automation.

```bash
meup client connect [options]

Options:
  --gateway <url>        WebSocket URL (required)
  --space <space>        Space to join (required)
  --token <token>        Authentication token
  --participant-id <id>  Participant ID
  --fifo-in <path>       Input FIFO for receiving commands
  --fifo-out <path>      Output FIFO for sending messages
```

**FIFO Mode:**
- Input: Send JSON messages to `fifo-in`
- Output: Receive JSON messages from `fifo-out`
- Essential for test automation

**Example:**
```bash
# Create FIFOs
mkfifo cli-in cli-out

# Connect with FIFOs
meup client connect \
  --gateway ws://localhost:8080 \
  --space test-space \
  --participant-id test-client \
  --fifo-in cli-in \
  --fifo-out cli-out &
```

### `meup agent start`

Starts a built-in test agent.

```bash
meup agent start [options]

Options:
  --type <type>          Agent type: echo|calculator|fulfiller (required)
  --gateway <url>        WebSocket URL (required)
  --space <space>        Space to join (required)
  --token <token>        Authentication token
```

**Example:**
```bash
meup agent start --type echo --gateway ws://localhost:8080 --space test-space
```

### `meup token create`

Creates a simple test token.

```bash
meup token create [options]

Options:
  --participant-id <id>  Participant ID (required)
  --capabilities <json>  JSON array of capabilities (required)
```

**Example:**
```bash
meup token create \
  --participant-id echo-agent \
  --capabilities '[{"kind":"chat"}]'
```

## Built-in Test Agents

### Echo Agent

Automatically echoes any chat message with "Echo: " prefix.

**Behavior:**
```json
// Input
{"kind": "chat", "payload": {"text": "Hello"}}

// Output  
{"kind": "chat", "payload": {"text": "Echo: Hello"}}
```

### Calculator Agent

Provides three MCP tools: add, multiply, evaluate.

**Tools:**
- `add(a, b)` - Returns a + b
- `multiply(a, b)` - Returns a * b  
- `evaluate(expression)` - Evaluates math expression

**Example:**
```json
// Request
{
  "kind": "mcp/request",
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "add",
      "arguments": {"a": 5, "b": 3}
    }
  }
}

// Response
{
  "kind": "mcp/response",
  "payload": {
    "result": {
      "content": [{"type": "text", "text": "8"}]
    }
  }
}
```

### Fulfiller Agent

Automatically fulfills any `mcp/proposal` it sees.

**Behavior:**
1. Observes: `{"kind": "mcp/proposal", "id": "prop-123", ...}`
2. Sends: `{"kind": "mcp/request", "correlation_id": ["prop-123"], ...}`

The fulfiller copies the proposal payload and adds the proposal ID as correlation_id.

## FIFO Message Format

Messages sent to/from FIFOs are MEUP v0.2 protocol envelopes.

**Input (to fifo-in):**
```json
{
  "kind": "chat",
  "payload": {
    "text": "Hello world"
  }
}
```

**Output (from fifo-out):**
```json
{
  "protocol": "meup/v0.2",
  "id": "msg-123",
  "ts": "2025-01-05T12:00:00Z",
  "from": "other-agent",
  "kind": "chat",
  "payload": {
    "text": "Response"
  }
}
```

## Test Execution Flow

The test plan uses the CLI as follows:

1. **Start Gateway:**
   ```bash
   meup gateway start --port 8080 --log-level debug > gateway.log 2>&1 &
   ```

2. **Start Test Agents:**
   ```bash
   meup agent start --type echo --gateway ws://localhost:8080 --space test-space &
   meup agent start --type calculator --gateway ws://localhost:8080 --space test-space &
   meup agent start --type fulfiller --gateway ws://localhost:8080 --space test-space &
   ```

3. **Connect Test Clients with FIFOs:**
   ```bash
   mkfifo cli-in cli-out
   meup client connect \
     --gateway ws://localhost:8080 \
     --space test-space \
     --fifo-in cli-in \
     --fifo-out cli-out &
   ```

4. **Send Test Messages:**
   ```bash
   echo '{"kind":"chat","payload":{"text":"test"}}' > cli-in
   ```

5. **Read Responses:**
   ```bash
   RESPONSE=$(timeout 5 cat cli-out | head -1)
   echo "$RESPONSE" | jq '.kind'
   ```

## Minimal Implementation Requirements

### Gateway
- Start WebSocket server on specified port
- Accept client connections
- Route messages between participants in same space
- No authentication required for initial version

### Client
- Connect to gateway WebSocket
- Join specified space
- Read JSON from fifo-in, send to gateway
- Write received messages to fifo-out as JSON

### Agents
- **Echo**: Listen for chat, respond with "Echo: " + text
- **Calculator**: Implement add, multiply, evaluate tools
- **Fulfiller**: Watch for proposals, auto-fulfill them

### Token
- Generate simple JWT or even just return the participant-id as token
- Gateway can ignore tokens initially

## Error Handling

Minimal error handling for test scenarios:
- Malformed JSON: Return system/error
- Missing fields: Return system/error
- Capability violations: Return system/error (if implemented)

## Dependencies

Minimal dependencies:
- `ws` - WebSocket client/server
- `commander` - Command parsing
- Core SDK packages (@meup/gateway, @meup/client, @meup/agent)

## Configuration

### Space Configuration (space.yaml)

The CLI manages participant capabilities through a `space.yaml` configuration file. This design separates authorization logic from the gateway implementation, allowing the gateway library to remain a pure protocol handler while the CLI manages the policy layer.

#### Configuration Structure

```yaml
space:
  id: space-identifier
  name: "Human Readable Space Name"
  description: "Space description"
  
participants:
  participant-id:
    tokens:
      - token-value-1
      - token-value-2
    capabilities:
      - capability-pattern-1
      - capability-pattern-2

defaults:
  capabilities:
    - default-capability  # Applied to unknown tokens
```

#### Capability Patterns

Capabilities support wildcard pattern matching:
- `*` - All capabilities
- `mcp/*` - All MCP-related capabilities  
- `context/*` - All context operations
- `chat` - Specific capability

#### Gateway Integration Architecture

The gateway library provides bidirectional hooks for capability management and participant lifecycle:

```javascript
// Gateway requests capability resolution from CLI
gateway.setCapabilityResolver(async (token, participantId, messageKind) => {
  // CLI loads from space.yaml (may return subset of configured capabilities)
  const config = await loadSpaceConfig();
  const participant = findParticipantByToken(config, token);
  
  // CLI can choose to return only relevant capabilities for this message
  const relevantCaps = filterCapabilitiesForMessage(
    participant?.capabilities || config.defaults.capabilities,
    messageKind
  );
  return relevantCaps;
});

// Gateway notifies CLI when participants join
gateway.onParticipantJoined(async (participantId, token, metadata) => {
  // CLI can update space.yaml with new participant
  if (!knownParticipant(participantId)) {
    await addParticipantToConfig(participantId, token, {
      type: 'key',
      capabilities: config.defaults.capabilities,
      first_seen: new Date().toISOString()
    });
  }
  // CLI may also spawn local agents based on space.yaml
  await spawnLocalAgents(config);
});

// Gateway provides authorization hook
gateway.setAuthorizationHook(async (participantId, messageKind, capabilities) => {
  const required = getRequiredCapability(messageKind);
  return hasCapability(capabilities, required);
});
```

#### Participant Lifecycle Management

The space.yaml can define how local participants should be started:

```yaml
participants:
  calculator-agent:
    type: local
    command: "meup agent start"
    args: ["--type", "calculator"]
    env:
      LOG_LEVEL: "debug"
      CACHE_DIR: "/tmp/calculator-cache"
    auto_start: true  # CLI spawns this when space starts
    restart_policy: "on-failure"
    tokens:
      - calculator-token
    capabilities:
      - kind: "mcp/*"
```

The CLI handles:
- **Process Management**: Starting/stopping local agents based on config
- **Environment Setup**: Passing environment variables to agents
- **Restart Policies**: Handling agent failures
- **Dynamic Registration**: Adding new participants as they join

The gateway only cares about:
- **Token Validation**: Is this token valid?
- **Capability Check**: Does this participant have this capability?
- **Message Routing**: Protocol-level concerns

This architecture enables:
- **Separation of Concerns**: Gateway handles protocol, CLI handles operations
- **Dynamic Participants**: New participants can be added at runtime
- **Flexible Deployment**: Different environments can have different startup configs
- **Testing**: Mock resolvers for unit tests
- **Capability Subsetting**: CLI can return only needed capabilities per request

#### Loading Configuration

The CLI loads space configuration in order of precedence:
1. Command-line flag: `--space-config path/to/space.yaml`
2. Environment variable: `MEUP_SPACE_CONFIG`
3. Default location: `./space.yaml`

Example:
```bash
meup gateway start --port 8080 --space-config ./configs/production.yaml
```

## Interactive Space Connection

### `meup space connect`

Connects to a running space interactively, allowing users to participate directly through various UI modes.

```bash
meup space connect [options]

Options:
  --space-config <path>   Path to space.yaml (default: ./space.yaml)
  --participant <id>      Participant ID to connect as
  --token <token>         Authentication token (prompts if not provided)
  --ui <mode>             UI mode: terminal|web|electron|game (default: terminal)
  --theme <theme>         UI theme name (UI-specific)
  --gateway <url>         Override gateway URL from config
```

### UI Modes

#### Terminal UI (Default)
The default interactive terminal interface for text-based interaction:

```bash
# Connect with default terminal UI
meup space connect --participant human-reviewer

# Terminal UI features:
# - Real-time message display
# - Command input with history
# - Syntax highlighting for code blocks
# - Tab completion for commands
# - Split panes for different contexts
```

#### Web UI
Browser-based interface accessible via localhost:

```bash
# Start web UI on default port 3000
meup space connect --ui web

# Opens browser to http://localhost:3000
# Features: Rich text, file uploads, visual tool results
```

#### Electron App
Native desktop application with full system integration:

```bash
# Launch Electron desktop app
meup space connect --ui electron --theme dark

# Features: System notifications, file drag-drop, offline mode
```

#### Game UI (Experimental)
3D environment using Proton3 or similar game engine:

```bash
# Launch game-like 3D interface
meup space connect --ui game

# Features: Spatial audio, avatars, virtual workspace
```

### Space Configuration for UI

The space.yaml can specify default UI settings and allowed UI modes:

```yaml
# space.yaml
ui:
  default_mode: terminal  # Default UI when not specified
  allowed_modes:          # Restrict available UIs
    - terminal
    - web
    - electron
  terminal:
    theme: monokai
    font_size: 14
    show_timestamps: true
  web:
    port: 3000
    auto_open: true
    allow_file_uploads: true
  electron:
    window_size: [1200, 800]
    start_minimized: false
    system_tray: true
  game:
    engine: proton3
    world: collaborative_office
    vr_enabled: false

# Per-participant UI preferences
participants:
  human-reviewer:
    ui_preferences:
      default_mode: electron  # Override default for this participant
      terminal:
        theme: solarized-dark
```

### Connection Flow

1. **Load Configuration**: Read space.yaml to get gateway URL and participant settings
2. **Authenticate**: Use provided token or prompt for credentials
3. **Initialize UI**: Start selected UI mode with configured settings
4. **Connect to Gateway**: Establish WebSocket connection
5. **Join Space**: Send join message with participant ID
6. **Interactive Session**: Handle user input and display messages

### Terminal UI Commands

When connected via terminal UI, special commands are available:

```
/help              Show available commands
/participants      List active participants
/capabilities      Show your current capabilities
/tools             List available MCP tools
/context push      Push new context
/context pop       Pop current context
/context show      Display context stack
/file <path>       Send file content
/exit              Disconnect from space
```

### Example Sessions

#### Developer Review Session
```bash
# Start space with configuration
meup gateway start --space-config ./code-review.yaml &

# Developer connects with terminal UI
meup space connect --participant developer --ui terminal

# Manager connects with Electron app
meup space connect --participant manager --ui electron

# CI system connects programmatically (non-interactive)
meup client connect --participant ci-bot --token $CI_TOKEN
```

#### Collaborative Design Session
```bash
# Designer uses web UI for rich media
meup space connect --participant designer --ui web

# Engineer uses terminal for code focus
meup space connect --participant engineer --ui terminal

# Product manager uses game UI for spatial collaboration
meup space connect --participant pm --ui game
```

### Custom UI Integration

Third-party UIs can integrate by implementing the UI interface:

```typescript
interface SpaceUI {
  // Initialize UI with configuration
  init(config: UIConfig): Promise<void>;
  
  // Connect to gateway
  connect(gateway: string, token: string): Promise<void>;
  
  // Handle incoming messages
  onMessage(message: MEUPMessage): void;
  
  // Send user input as message
  sendMessage(message: MEUPMessage): void;
  
  // Clean shutdown
  disconnect(): Promise<void>;
}
```

Register custom UI:
```bash
meup ui register my-custom-ui ./my-ui-module.js
meup space connect --ui my-custom-ui
```

## Next Steps

After tests pass with this minimal implementation:
1. ~~Add proper authentication~~ ✓ Token-based auth via space.yaml
2. ~~Implement capability enforcement~~ ✓ Via resolver hooks
3. ~~Add space configuration support~~ ✓ space.yaml specification
4. Implement remaining features from `/cli/spec/next/SPEC.md`

## Success Criteria

This CLI successfully implements the test plan when:
1. All test scenarios in TEST_PLAN.md can be executed
2. Gateway starts and accepts connections
3. Agents respond appropriately
4. FIFO mode enables test automation
5. Messages flow correctly between participants