# MEUP CLI Specification - Minimal Test Implementation

**Version:** draft (for v0.1.0)  
**Status:** Draft  
**Last Updated:** 2025-01-05

## Overview

The MEUP CLI (`@meup/cli`) provides minimal command-line tools needed to execute the test plan in `/tests/TEST_PLAN.md`. This is a focused implementation that prioritizes getting tests running.

## Scope

This specification covers:
- Gateway server with space configuration support
- Client connections with FIFO mode for automation
- Interactive space connection via terminal UI
- Capability management through space.yaml
- Process management for local agents

## Architecture

```
@meup/cli
├── Commands
│   ├── gateway.js    # Start gateway server
│   ├── client.js     # Connect as client (interactive or FIFO)
│   ├── space.js      # Space management (up/down/status)
│   └── token.js      # Generate test tokens
├── SDK Dependencies
│   ├── @meup/gateway
│   ├── @meup/client
│   ├── @meup/agent
│   └── @meup/capability-matcher
└── External Dependencies
    ├── pm2               # Process manager (embedded library)
    ├── js-yaml           # Parse space.yaml config
    ├── commander         # CLI argument parsing
    ├── ws                # WebSocket client
    └── readline          # Terminal UI
```

## Commands

### `meup gateway start`

Starts a gateway server.

```bash
meup gateway start [options]

Options:
  --port <port>          Port to listen on (default: 8080)
  --space-config <path>  Path to space.yaml (default: ./space.yaml)
  --log-level <level>    debug|info|warn|error (default: info)
```

**Example:**
```bash
meup gateway start --port 8080 --space-config ./space.yaml --log-level debug
```

### `meup client connect`

Connects to a gateway as a client. Supports interactive mode (default) or FIFO mode for automation.

```bash
meup client connect [options]

Options:
  --gateway <url>        WebSocket URL (required)
  --space <space>        Space to join (required)
  --token <token>        Authentication token
  --participant-id <id>  Participant ID
  --fifo-in <path>       Input FIFO for automation (optional)
  --fifo-out <path>      Output FIFO for automation (optional)
  --no-interactive       Disable interactive mode when using FIFOs
```

**Interactive Mode (default):**
- Uses readline-based terminal interface
- Plain text automatically becomes chat messages
- JSON envelopes can be sent for any message type
- Commands start with `/` (e.g., `/help`, `/exit`)
- See responses in real-time
- Press Ctrl+C to exit

**FIFO Mode (for automation):**
- Specify both --fifo-in and --fifo-out
- Send JSON messages to fifo-in
- Receive JSON messages from fifo-out
- Add --no-interactive to disable terminal input

**Examples:**
```bash
# Interactive mode (default)
meup client connect \
  --gateway ws://localhost:8080 \
  --space test-space \
  --participant-id human-user

# FIFO mode for automation
mkfifo cli-in cli-out
meup client connect \
  --gateway ws://localhost:8080 \
  --space test-space \
  --participant-id test-client \
  --fifo-in cli-in \
  --fifo-out cli-out \
  --no-interactive &
```

## Running Agents

Agents are standalone executables that connect to the gateway. They are NOT started through the CLI but run directly or via space.yaml configuration.

### Direct Execution

```bash
# Run example agents directly
node ./agents/echo.js --gateway ws://localhost:8080 --token echo-token
node ./agents/calculator.js --gateway ws://localhost:8080 --space test-space
python ./my-custom-agent.py --gateway ws://localhost:8080

# Each agent handles its own argument parsing
```

### Via Space Configuration

Agents can be auto-started when the gateway starts:

```yaml
# space.yaml
participants:
  echo-agent:
    command: "node"
    args: ["./agents/echo.js", "--gateway", "ws://localhost:8080"]
    auto_start: true
    tokens: ["echo-token"]
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


## FIFO Message Format

Messages sent to/from FIFOs use MEUP v0.2 protocol format.

**Input (to fifo-in):**
Simplified format - CLI adds protocol envelope fields:
```json
{
  "kind": "chat",
  "payload": {
    "text": "Hello world"
  }
}
```

**Output (from fifo-out):**
Full MEUP v0.2 envelope:
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

1. **Start Gateway (with space config):**
   ```bash
   meup gateway start --port 8080 --space-config ./space.yaml > gateway.log 2>&1 &
   ```

2. **Start Agents (if not auto-started):**
   ```bash
   # Agents are separate programs, not part of CLI
   # Example: node ./tests/agents/echo.js --gateway ws://localhost:8080 &
   # Or define in space.yaml with auto_start: true
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
- Load space.yaml for capability configuration
- Provide hooks for capability resolution

### Client
- Connect to gateway WebSocket
- Join specified space
- Support interactive mode (readline) by default
- Support FIFO mode for automation
- Read JSON from fifo-in, send to gateway (FIFO mode)
- Write received messages to fifo-out as JSON (FIFO mode)


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
      - kind: "mcp/*"
      - kind: "chat"

defaults:
  capabilities:
    - kind: "mcp/proposal"
    - kind: "chat"
```

#### Capability Patterns

Capabilities use JSON pattern matching as defined in MEUP v0.2:

**Simple patterns:**
```yaml
capabilities:
  - kind: "*"           # All capabilities
  - kind: "mcp/*"       # All MCP messages (request, response, proposal)
  - kind: "chat"        # Only chat messages
```

**Nested patterns for fine-grained control:**
```yaml
capabilities:
  - kind: "mcp/request"
    payload:
      method: "tools/call"
      params:
        name: "read_*"   # Only read tools
  - kind: "mcp/response"
  - kind: "chat"
```

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
    command: "node"
    args: ["./agents/calculator.js", "--gateway", "ws://localhost:8080"]
    env:
      LOG_LEVEL: "debug"
      CACHE_DIR: "/tmp/calculator-cache"
    auto_start: true  # CLI spawns this when space starts
    restart_policy: "on-failure"
    tokens:
      - calculator-token
    capabilities:
      - kind: "mcp/*"
      - kind: "chat"
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

## Process Management

The CLI uses PM2 as an embedded library for reliable process management. This ensures that gateway and agent processes remain running even after the parent CLI command exits.

### PM2 Integration Architecture

PM2 is used programmatically as a library, not as a global tool:

```javascript
// Each space gets its own isolated PM2 daemon
process.env.PM2_HOME = path.join(spaceDir, '.meup/pm2');

// Connect to space-specific PM2 daemon
const pm2 = require('pm2');
pm2.connect((err) => {
  // All PM2 operations are space-local
});
```

### Space-Local Process Management

Each space maintains complete isolation:

```
space-directory/
├── space.yaml           # Space configuration
├── .meup/              
│   ├── pm2/            # PM2 daemon for this space only
│   │   ├── pm2.log     # PM2 daemon logs
│   │   ├── pm2.pid     # Daemon process ID
│   │   └── pids/       # Managed process PIDs
│   └── pids.json       # Space metadata
├── logs/               # Process output logs
│   ├── gateway.log
│   └── agent-*.log
└── fifos/              # FIFO pipes if configured
```

Benefits of this approach:
- **No global PM2 required**: PM2 is bundled with the CLI
- **Complete isolation**: Multiple spaces can run simultaneously
- **Self-contained**: All artifacts stay within the space directory
- **Transparent**: Users don't need to know PM2 is being used
- **Reliable**: Processes survive parent CLI exit

## Space Management

### `meup space up`

Brings up all components of a space based on space.yaml configuration, optionally connecting interactively as a participant.

```bash
meup space up [options]

Options:
  --space-config <path>   Path to space.yaml (default: ./space.yaml)
  --participant <id>      Optional: Connect as this participant after bringing up space
  --detach, -d            Run in background without connecting
```

This command:
1. Creates space-local PM2 daemon in `.meup/pm2/`
2. Starts the gateway using PM2 for process management
3. Starts all agents with `auto_start: true` via PM2
4. Optionally connects you as a participant (see Participant Resolution below)

All processes are managed by PM2 and will continue running after the CLI exits. When connecting as a participant, tokens and capabilities come from space.yaml - no need to specify them.

#### Participant Resolution

The CLI automatically determines which participant to connect as using this precedence:

1. **Explicit flag**: `--participant <id>` always takes priority
2. **Space default**: `default_participant` field in space.yaml
3. **Single human**: Auto-selects if only one participant without a `command` field exists
4. **Interactive prompt**: Shows list of human participants to choose from
5. **System username**: Used if it matches a human participant (last resort)
6. **Detached mode**: Runs without connecting if no participant can be determined

Example space.yaml with participant resolution:
```yaml
space:
  id: my-space
  default_participant: developer  # Optional default
  
participants:
  developer:           # Human participant (no command)
    tokens: [...]
  echo-agent:         # Agent participant (has command)
    command: "node"
    args: ["./agents/echo.js"]
    auto_start: true
  rjcorwin:           # Matches system username
    tokens: [...]
```

### `meup space status`

Shows the status of running space processes.

```bash
meup space status [options]

Options:
  --space-config <path>   Path to space.yaml (default: ./space.yaml)
  --json                  Output as JSON
```

This command:
1. Connects to the space-local PM2 daemon
2. Lists all managed processes with their status
3. Shows gateway health check results
4. Displays connected participants

### `meup space down`

Stops all components of a running space.

```bash
meup space down [options]

Options:
  --space-config <path>   Path to space.yaml (default: ./space.yaml)
  --force                 Force kill processes if graceful shutdown fails
```

This command:
1. Disconnects all clients
2. Stops all PM2-managed processes for this space
3. Shuts down the space-local PM2 daemon
4. Cleans up FIFOs and temporary files
5. Preserves logs for debugging

### Terminal Interface

#### Input Handling

The terminal interface uses smart detection to handle both simple chat and full protocol messages:

1. **Commands** (start with `/`): Execute special actions
2. **JSON envelopes** (valid MEUP JSON): Send as-is for full protocol access  
3. **Plain text**: Automatically wrapped as chat messages

Examples:
```bash
> Hello everyone                    # Sends chat message
> {"kind": "mcp/request", ...}      # Sends JSON envelope as-is
> /help                              # Executes help command
> How's it going?                    # Sends chat message
> { invalid json                     # Sends as chat (not valid JSON)
```

#### Terminal Commands

Special commands available when connected interactively:

```
/help              Show available commands
/participants      List active participants
/capabilities      Show your current capabilities
/chat <text>       Force text to be sent as chat (edge cases)
/exit              Disconnect from space
```

### Example Sessions

#### Developer Review Session
```bash
# Bring up space and connect as developer
meup space up --space-config ./code-review.yaml --participant developer

# In another terminal, CI system connects with FIFOs for automation
mkfifo ci-in ci-out
meup client connect \
  --gateway ws://localhost:8080 \
  --space code-review \
  --participant ci-bot \
  --fifo-in ci-in \
  --fifo-out ci-out &
```

#### Test Automation Session
```bash
# Bring up the space in background
meup space up --detach

# Connect test clients with FIFOs
mkfifo client1-in client1-out
meup client connect \
  --gateway ws://localhost:8080 \
  --space test-space \
  --participant test-client-1 \
  --fifo-in client1-in \
  --fifo-out client1-out &

# Send test messages
echo '{"kind":"chat","payload":{"text":"test"}}' > client1-in
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