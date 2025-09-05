# MEUP CLI Specification

**Version:** draft  
**Status:** Draft  
**Last Updated:** 2025-01-05

## Overview

The MEUP CLI (`@meup/cli`) provides command-line tools for interacting with the MEUP protocol ecosystem. It serves as the primary interface for developers and operators to run gateways, connect clients, launch test agents, and perform integration testing.

## Scope

This specification covers:
- CLI command structure and interface
- Built-in test agents (echo, calculator, fulfiller)
- FIFO mode for programmatic control
- Gateway server management
- Client connection management
- Token generation and validation

This specification does NOT cover:
- Internal implementation details of the SDK packages
- Gateway protocol implementation (see gateway spec)
- Agent framework internals (see agent spec)

## Architecture

### Components

```
@meup/cli
├── CLI Interface Layer
│   ├── Command Parser (Commander.js)
│   ├── Input/Output Handler
│   └── Configuration Loader
├── Core Commands
│   ├── Gateway Command
│   ├── Client Command
│   ├── Agent Command
│   └── Token Command
├── Built-in Agents
│   ├── Echo Agent
│   ├── Calculator Agent
│   └── Fulfiller Agent
└── SDK Integration Layer
    ├── @meup/gateway wrapper
    ├── @meup/client wrapper
    └── @meup/agent wrapper
```

### Command Structure

All commands follow the pattern:
```
meup <command> [subcommand] [options]
```

## Interface

### 1. Gateway Commands

#### `meup gateway start`
Starts a MEUP gateway server using the `@meup/gateway` library.

```bash
meup gateway start [options]

Options:
  --port <port>              Port to listen on (default: 8080)
  --host <host>              Host to bind to (default: 0.0.0.0)
  --log-level <level>        debug|info|warn|error (default: info)
  --config <file>            Load configuration from JSON/YAML file
  --auth-mode <mode>         none|token|custom (default: token)
  --auth-secret <secret>     JWT signing secret (required for token mode)
```

The gateway determines participant capabilities based on the authentication token or configuration. Per the MEUP v0.2 spec, the gateway maps tokens to participant IDs and capability sets through its implementation-specific mechanism. The participant ID and capabilities are sent in the `system/welcome` message upon connection.

#### `meup gateway health`
Checks gateway health status via REST API.

```bash
meup gateway health [options]

Options:
  --url <url>                Gateway URL (default: http://localhost:8080)
  --format <format>          json|text (default: json)
```

Expected response format:
```json
{
  "status": "ok",
  "spaces": 1,
  "clients": 5,
  "uptime": 3600
}
```

### 2. Client Commands

#### `meup client connect`
Connects to a MEUP space as a client using the `@meup/client` library.

```bash
meup client connect [options]

Options:
  --gateway <url>            WebSocket URL (required)
  --space <space>            Space to join (required)
  --token <token>            Authentication token
  --fifo-in <path>           Input FIFO for programmatic control
  --fifo-out <path>          Output FIFO for message capture
  --format <format>          json|pretty (default: json)
```

FIFO mode enables programmatic control for testing:
- Input: Send JSON envelopes to `fifo-in`
- Output: Receive JSON envelopes from `fifo-out`

#### `meup client send`
Sends a single message and exits.

```bash
meup client send [options]

Options:
  --gateway <url>            WebSocket URL (required)
  --space <space>            Space to join (required)
  --token <token>            Authentication token
  --message <json>           JSON message to send (required)
```

### 3. Agent Commands

#### `meup agent start`
Starts a built-in or custom agent.

```bash
meup agent start [options]

Options:
  --type <type>              Agent type (required)
                            Built-in: echo|calculator|fulfiller
  --gateway <url>            WebSocket URL (required)
  --space <space>            Space to join (required)
  --token <token>            Authentication token
```

### 4. Token Commands

#### `meup token create`
Generates a JWT token for authentication.

```bash
meup token create [options]

Options:
  --participant-id <id>      Participant ID (required)
  --secret <secret>          JWT signing secret (required)
  --expires-in <duration>    1h, 7d, etc (default: 24h)
  --capabilities <json>      JSON array of capability objects (optional)
```

Note: Capabilities should be provided as JSON objects per the MEUP v0.2 spec:
```bash
--capabilities '[{"kind":"chat"},{"kind":"mcp/request"}]'
```

## Built-in Test Agents

### Echo Agent
Automatically echoes any chat message it receives.

**Behavior:**
- Receives: `{"kind": "chat", "payload": {"text": "Hello"}}`
- Responds: `{"kind": "chat", "payload": {"text": "Echo: Hello"}}`

**Purpose:** Tests basic message flow and gateway routing.

### Calculator Agent
Provides MCP tools for mathematical operations.

**Tools provided:**
- `add(a, b)` - Addition
- `multiply(a, b)` - Multiplication
- `evaluate(expression)` - Evaluate math expression

**Behavior:**
- Receives: `{"kind": "mcp/request", "payload": {"method": "tools/call", "params": {"name": "add", "arguments": {"a": 5, "b": 3}}}}`
- Responds: `{"kind": "mcp/response", "payload": {"result": {"content": [{"type": "text", "text": "8"}]}}}`

**Purpose:** Tests MCP tool integration and request/response handling.

### Fulfiller Agent
Automatically fulfills any `mcp/proposal` it observes.

**Behavior:**
- Observes: `{"kind": "mcp/proposal", "id": "prop-123", "payload": {...}}`
- Sends: `{"kind": "mcp/request", "correlation_id": ["prop-123"], "payload": {...}}`

**Note:** The fulfiller copies the proposal's payload to create the actual request, adding the proposal's ID as the correlation_id. This follows the MEUP v0.2 proposal fulfillment pattern (Section 3.2.1).

**Purpose:** Tests the proposal-execute pattern for untrusted agents.

## FIFO Mode

FIFO mode enables programmatic control for integration testing.

### Setup
```bash
# Create named pipes
mkfifo client-in client-out

# Connect with FIFOs
meup client connect \
  --gateway ws://localhost:8080 \
  --space test-space \
  --token test-token \
  --fifo-in client-in \
  --fifo-out client-out &
```

### Message Format

Input (to `fifo-in`):
```json
{
  "kind": "chat",
  "payload": {
    "text": "Hello world"
  }
}
```

Output (from `fifo-out`):
```json
{
  "protocol": "meup/v0.2",
  "id": "msg-123",
  "ts": "2025-01-05T12:00:00Z",
  "from": "other-agent",
  "kind": "chat",
  "payload": {
    "text": "Response message"
  }
}
```

## Configuration

### Configuration File Format

The CLI accepts JSON or YAML configuration files:

```json
{
  "gateway": {
    "port": 8080,
    "authMode": "token",
    "authSecret": "your-secret-key"
  },
  "tokens": {
    "echo-token": {
      "participantId": "echo-agent",
      "capabilities": [
        {"kind": "chat"}
      ]
    },
    "calc-token": {
      "participantId": "calc-agent",
      "capabilities": [
        {"kind": "chat"},
        {"kind": "mcp/request"},
        {"kind": "mcp/response"}
      ]
    }
  }
}
```

### Environment Variables

- `MEUP_GATEWAY` - Default gateway URL
- `MEUP_TOKEN` - Default authentication token
- `MEUP_SPACE` - Default space name
- `MEUP_LOG_LEVEL` - Default log level
- `MEUP_CONFIG` - Default config file path

## Dependencies

The CLI depends on:
- `@meup/types` - Protocol type definitions
- `@meup/client` - Client implementation
- `@meup/gateway` - Gateway implementation
- `@meup/agent` - Agent framework
- `commander` - Command-line parsing
- `ws` - WebSocket client/server
- `jsonwebtoken` - JWT token handling

## Security Considerations

### Token Security
- Tokens should be kept secret and not logged
- Use environment variables or secure config files
- Tokens should have appropriate expiration times

### Gateway Security
- Always use auth-mode in production
- Configure TLS/SSL for WebSocket connections
- Implement rate limiting for production deployments

### FIFO Security
- FIFOs should be created with appropriate permissions
- Clean up FIFOs after use to prevent data leaks
- Validate all input from FIFOs

## Testing

The CLI is designed to facilitate testing:

1. **Unit Testing**: Test individual commands and agents
2. **Integration Testing**: Use FIFO mode for automated tests
3. **End-to-End Testing**: Full protocol testing with multiple agents

### Test Execution Flow

```bash
# Start gateway
meup gateway start --port 8080 &

# Start test agents
meup agent start --type echo --space test &
meup agent start --type calculator --space test &

# Run test client
mkfifo test-in test-out
meup client connect --space test --fifo-in test-in --fifo-out test-out &

# Send test messages
echo '{"kind":"chat","payload":{"text":"test"}}' > test-in

# Verify responses
cat test-out | jq '.kind'
```

## Error Handling

### Exit Codes
- `0` - Success
- `1` - General error
- `2` - Connection error
- `3` - Authentication error
- `4` - Capability violation
- `5` - Timeout error

### Error Messages
Errors are output to stderr in JSON format when `--format json` is used:
```json
{
  "error": "connection_failed",
  "message": "Could not connect to gateway",
  "details": {
    "url": "ws://localhost:8080",
    "code": "ECONNREFUSED"
  }
}
```

## Examples

### Example 1: Basic Gateway and Client
```bash
# Terminal 1: Start gateway
meup gateway start --port 8080 --auth-mode none

# Terminal 2: Connect client
meup client connect \
  --gateway ws://localhost:8080 \
  --space lobby
```

### Example 2: Testing with Agents
```bash
# Start gateway with token auth
meup gateway start \
  --port 8080 \
  --auth-mode token \
  --auth-secret "test-secret"

# Generate tokens
TOKEN1=$(meup token create --participant-id alice --secret "test-secret")
TOKEN2=$(meup token create --participant-id bob --secret "test-secret")

# Start echo agent
meup agent start \
  --type echo \
  --gateway ws://localhost:8080 \
  --space test \
  --token "$TOKEN1"

# Send message
meup client send \
  --gateway ws://localhost:8080 \
  --space test \
  --token "$TOKEN2" \
  --message '{"kind":"chat","payload":{"text":"Hello"}}'
```

### Example 3: FIFO Mode Testing
```bash
# Setup
mkfifo in out
meup client connect \
  --gateway ws://localhost:8080 \
  --space test \
  --fifo-in in \
  --fifo-out out &
CLIENT_PID=$!

# Send and receive
echo '{"kind":"chat","payload":{"text":"Test"}}' > in
RESPONSE=$(timeout 5 cat out | head -1)
echo "$RESPONSE" | jq '.kind'

# Cleanup
kill $CLIENT_PID
rm in out
```

## Migration

### From Development to Production
1. Switch from `--auth-mode none` to `--auth-mode token`
2. Use secure token generation with proper secrets
3. Enable TLS/SSL for WebSocket connections
4. Configure appropriate logging levels
5. Set up monitoring and alerting

## References

- [MEUP Protocol Specification v0.2](../../../spec/v0.2/SPEC.md)
- [@meup/gateway Specification](../../../sdk/typescript-sdk/gateway/spec/draft/SPEC.md)
- [@meup/client Documentation](../../../sdk/typescript-sdk/client/README.md)
- [@meup/agent Documentation](../../../sdk/typescript-sdk/agent/README.md)