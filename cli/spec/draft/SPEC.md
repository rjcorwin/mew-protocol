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