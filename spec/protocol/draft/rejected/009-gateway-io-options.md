# ADR-009: Gateway I/O Options for Participant Communication

## Status
Rejected

**Rejection Date:** 2025-09-26  
**Rejection Rationale:** Gateway I/O expansion is deferred; v0.4 only documents existing WebSocket interface while we validate desired operational requirements.

## Context
Currently, the MEW Protocol gateway only accepts WebSocket connections for participants. This creates limitations:
1. Testing is complex - requires WebSocket clients or FIFO workarounds
2. CLI tools need WebSocket support to interact with spaces
3. Simple scripts can't easily send messages without WebSocket libraries
4. No way to inject messages for testing or debugging

## Decision
Add two additional I/O mechanisms to the gateway alongside WebSocket:

### 1. HTTP REST API for Message Injection
The gateway will expose HTTP endpoints for sending messages on behalf of participants:

```
POST /participants/{participant_id}/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "kind": "chat",
  "payload": {
    "text": "Hello world"
  }
}
```

### 2. Stdio Support for Direct Process Communication
The gateway can spawn participant processes with stdio communication:

```yaml
participants:
  my-agent:
    command: "./my-agent"
    args: ["--mode", "stdio"]
    io: stdio  # Uses stdin/stdout instead of WebSocket
```

## Implementation Details

### HTTP API Endpoints
```
POST /participants/{participant_id}/messages  # Send a message
GET  /participants/{participant_id}/messages  # Poll for messages (long-polling)
GET  /participants                            # List active participants
```

### Message Flow
1. **HTTP Input**: Messages posted to HTTP endpoint are validated and injected as if from that participant
2. **Stdio Input**: Messages from process stdout are parsed as JSON envelopes
3. **WebSocket**: Existing bidirectional communication continues unchanged

### Authentication
- HTTP: Bearer token in Authorization header
- Stdio: Implicit trust (process spawned by gateway)
- WebSocket: Existing token-based auth

### Configuration
```yaml
# space.yaml
gateway:
  http:
    enabled: true
    port: 8080
    bind: "127.0.0.1"
  
participants:
  websocket-agent:
    tokens: ["token-1"]
    # Default: connects via WebSocket
    
  stdio-agent:
    command: "./agent"
    io: stdio
    # Spawned process, communicates via stdin/stdout
    
  http-client:
    tokens: ["token-2"]
    io: http
    # Expects HTTP API calls
```

## Consequences

### Positive
- **Simpler Testing**: Tests can use curl/HTTP instead of WebSocket clients
- **Better CLI Integration**: Command-line tools can POST messages easily
- **Debugging**: Can inject test messages via HTTP during development
- **Process Management**: Gateway can spawn and manage participant processes
- **Flexibility**: Participants can choose the most appropriate I/O mechanism

### Negative
- **Complexity**: Gateway must handle three different I/O mechanisms
- **Security**: HTTP endpoint needs careful authentication/authorization
- **Message Ordering**: HTTP polling may miss messages or receive out-of-order
- **Resource Usage**: Long-polling connections consume server resources

### Neutral
- HTTP is request-response, not bidirectional like WebSocket
- Stdio requires gateway to manage process lifecycle
- Different I/O mechanisms have different performance characteristics

## Alternatives Considered

1. **FIFO Pipes Only**: Too platform-specific, blocking issues
2. **Message Queue (RabbitMQ/Redis)**: Additional infrastructure dependency
3. **gRPC**: More complex than needed for simple message passing
4. **Socket Files**: Platform-specific, similar issues to FIFOs

## Migration Path

1. Phase 1: Add HTTP API to gateway (backward compatible)
2. Phase 2: Add stdio support for spawned processes
3. Phase 3: Update tests to use HTTP instead of FIFOs
4. Phase 4: Document patterns for each I/O mechanism

## Decision Outcome
Implement HTTP REST API first for testing simplification, then add stdio support for process management. This provides maximum flexibility while maintaining backward compatibility with existing WebSocket participants.
