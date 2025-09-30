# ADR-f4x: Safe FIFO Input Mechanism for Automated Agents

**Status:** Accepted
**Date:** 2025-01-11
**Context:** MEW CLI v0.2.0
**Incorporation:** Complete (v0.2.0)

## Context

The current FIFO (First In, First Out) mechanism for automated agent input in the MEW CLI frequently causes crashes when coding assistants (like Claude) attempt to send messages through the FIFO pipe. This is a critical issue that prevents reliable automated testing and agent development workflows.

### Current Problem
- When agents write to the FIFO pipe (`echo '{"kind":"chat",...}' > fifo-in`), the writing process often crashes
- This happens particularly with coding assistants that execute shell commands
- The crash disrupts the entire workflow, requiring manual restart
- This makes automated testing unreliable and development difficult

### Why This Needs to Be Fixed Now
1. **Testing Reliability**: Automated tests cannot run reliably if the input mechanism crashes
2. **Developer Experience**: Developers using coding assistants face constant disruptions
3. **CI/CD Integration**: Continuous integration pipelines need stable input mechanisms
4. **Agent Development**: Building and testing agents requires a robust communication channel

### Constraints
- Must maintain backward compatibility with existing FIFO-based tests
- Should not require changes to the MEW protocol itself
- Must work across different operating systems (Linux, macOS, Windows via WSL)
- Should support both interactive and non-interactive modes
- Must handle large message payloads without blocking

## Options Considered

### Option 1: Enhanced FIFO with Non-blocking Writes

Improve the existing FIFO mechanism to handle writes more safely.

**Implementation:**
```bash
# Use timeout and non-blocking write
timeout 1 bash -c 'echo "$MESSAGE" > fifo-in' || true

# Or use dd with non-blocking flag
echo "$MESSAGE" | dd of=fifo-in oflag=nonblock 2>/dev/null
```

**Pros:**
- Minimal changes to existing code
- Maintains compatibility with current tests
- Simple to implement

**Cons:**
- Still susceptible to reader-side issues
- Platform-specific behavior differences
- Doesn't address root cause of blocking

### Option 2: HTTP API Endpoint

Add an HTTP server to the client that accepts messages via POST requests.

**Implementation:**
```javascript
// In client.js
if (options.httpPort) {
  const express = require('express');
  const app = express();
  app.use(express.json());
  
  app.post('/message', (req, res) => {
    handleIncomingMessage(req.body);
    res.json({ success: true });
  });
  
  app.listen(options.httpPort);
}
```

**Usage:**
```bash
curl -X POST http://localhost:9090/message \
  -H "Content-Type: application/json" \
  -d '{"kind":"chat","payload":{"text":"Hello"}}'
```

**Pros:**
- Universal compatibility
- No blocking issues
- Easy to use from any language/tool
- Can add authentication/validation
- Supports request/response pattern

**Cons:**
- Adds HTTP dependency
- More complex setup
- Requires port management
- Overhead for simple messages

### Option 3: Unix Domain Socket

Replace FIFO with Unix domain sockets for more robust IPC.

**Implementation:**
```javascript
// In client.js
const net = require('net');

if (options.socketPath) {
  const server = net.createServer((socket) => {
    socket.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleIncomingMessage(message);
        socket.write(JSON.stringify({ success: true }));
      } catch (err) {
        socket.write(JSON.stringify({ error: err.message }));
      }
    });
  });
  
  server.listen(options.socketPath);
}
```

**Usage:**
```bash
echo '{"kind":"chat","payload":{"text":"Hello"}}' | \
  nc -U /tmp/mew-client.sock
```

**Pros:**
- More robust than FIFOs
- Bidirectional communication
- Built-in flow control
- No network overhead

**Cons:**
- Not available on Windows (without WSL)
- Requires socket file management
- More complex than FIFOs

### Option 4: File-based Message Queue

Use a directory of numbered message files that the client polls.

**Implementation:**
```javascript
// In client.js
if (options.messageDir) {
  const fs = require('fs');
  const path = require('path');
  
  setInterval(() => {
    const files = fs.readdirSync(options.messageDir)
      .filter(f => f.endsWith('.json'))
      .sort();
    
    for (const file of files) {
      const filepath = path.join(options.messageDir, file);
      const content = fs.readFileSync(filepath, 'utf8');
      handleIncomingMessage(JSON.parse(content));
      fs.unlinkSync(filepath); // Delete after processing
    }
  }, 100); // Poll every 100ms
}
```

**Usage:**
```bash
# Write message with timestamp-based filename
echo '{"kind":"chat","payload":{"text":"Hello"}}' > \
  /tmp/mew-messages/$(date +%s%N).json
```

**Pros:**
- Never blocks on write
- Simple to implement
- Works on all platforms
- Easy to debug (can inspect files)
- Natural message ordering

**Cons:**
- Polling overhead
- Filesystem cleanup needed
- Slight delay (polling interval)
- Not suitable for high throughput

### Option 5: Hybrid Approach (Recommended)

Support multiple input mechanisms simultaneously, allowing users to choose based on their needs.

**Implementation:**
```javascript
// In client.js
class MessageInputManager {
  constructor(options) {
    this.handlers = [];
    
    // FIFO support (backward compatibility)
    if (options.fifoIn) {
      this.setupFifo(options.fifoIn);
    }
    
    // HTTP endpoint (reliable for automation)
    if (options.httpPort) {
      this.setupHttp(options.httpPort);
    }
    
    // File queue (safe fallback)
    if (options.messageDir) {
      this.setupFileQueue(options.messageDir);
    }
    
    // Unix socket (performant option)
    if (options.socketPath) {
      this.setupSocket(options.socketPath);
    }
  }
  
  handleMessage(message, callback) {
    // Common message handling
    try {
      validateMessage(message);
      processMessage(message);
      callback?.({ success: true });
    } catch (error) {
      callback?.({ error: error.message });
    }
  }
}
```

**Usage:**
```bash
# Start client with multiple input options
mew client connect \
  --gateway ws://localhost:8080 \
  --space test \
  --fifo-in ./fifo-in \        # Legacy support
  --http-port 9090 \           # HTTP API
  --message-dir ./messages \   # File queue
  --socket-path ./client.sock  # Unix socket

# Use any mechanism
echo '{"kind":"chat"}' > ./fifo-in  # Traditional
curl -X POST localhost:9090/message -d '{"kind":"chat"}'  # HTTP
echo '{"kind":"chat"}' > ./messages/001.json  # File queue
```

## Decision

**Implement Option 5: Hybrid Approach** with HTTP as the primary recommended mechanism for automated agents.

### Rationale

1. **Backward Compatibility**: Existing FIFO-based tests continue to work
2. **Reliability**: HTTP endpoint provides a crash-resistant input method
3. **Flexibility**: Users can choose the best mechanism for their use case
4. **Progressive Enhancement**: Can start with HTTP and add other mechanisms as needed
5. **Platform Coverage**: HTTP works everywhere, with platform-specific optimizations available

### Implementation Details

#### Phase 1: HTTP Endpoint (Immediate)
```javascript
// cli/src/utils/message-input.ts
const express = require('express');

function setupHttpInput(port, messageHandler) {
  const app = express();
  app.use(express.json());
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '0.2.0' });
  });
  
  // Message endpoint
  app.post('/message', async (req, res) => {
    try {
      const result = await messageHandler(req.body);
      res.json(result || { success: true });
    } catch (error) {
      res.status(400).json({ 
        error: error.message,
        code: error.code || 'INVALID_MESSAGE'
      });
    }
  });
  
  // Batch messages
  app.post('/messages', async (req, res) => {
    const results = [];
    for (const message of req.body.messages) {
      try {
        const result = await messageHandler(message);
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }
    res.json({ results });
  });
  
  return app.listen(port);
}
```

#### Phase 2: Update CLI (Immediate)
```javascript
// cli/src/commands/client.ts
program
  .option('--http-port <port>', 'Enable HTTP input on port')
  .option('--http-bind <address>', 'Bind address (default: 127.0.0.1)')
  // ... existing options

if (options.httpPort) {
  const server = setupHttpInput(options.httpPort, (message) => {
    return clientConnection.send(message);
  });
  
  console.log(`HTTP input available at http://${options.httpBind}:${options.httpPort}/message`);
}
```

#### Phase 3: Helper Script (Immediate)
Create a helper script for safe message sending:

```bash
#!/bin/bash
# cli/bin/mew-send.sh

MESSAGE="$1"
HTTP_PORT="${MEW_HTTP_PORT:-9090}"
FIFO_PATH="${MEW_FIFO_PATH:-}"

# Try HTTP first (most reliable)
if curl -sf -X POST "http://localhost:$HTTP_PORT/message" \
  -H "Content-Type: application/json" \
  -d "$MESSAGE" 2>/dev/null; then
  exit 0
fi

# Fallback to FIFO if available
if [ -n "$FIFO_PATH" ] && [ -p "$FIFO_PATH" ]; then
  if timeout 1 bash -c "echo '$MESSAGE' > '$FIFO_PATH'" 2>/dev/null; then
    exit 0
  fi
fi

echo "Failed to send message" >&2
exit 1
```

#### Phase 4: Documentation Update
Update documentation to recommend HTTP for automation:

```markdown
## Automated Agent Input

For automated agents and CI/CD pipelines, use the HTTP endpoint:

\`\`\`bash
# Start client with HTTP input
mew client connect \
  --gateway ws://localhost:8080 \
  --space test \
  --http-port 9090

# Send messages via HTTP (recommended)
curl -X POST http://localhost:9090/message \
  -H "Content-Type: application/json" \
  -d '{"kind":"chat","payload":{"text":"Hello"}}'
\`\`\`

For backward compatibility, FIFO mode is still supported but not recommended for new implementations.
```

## Consequences

### Positive
- **Reliability**: Eliminates crashes from FIFO blocking issues
- **Developer Experience**: Smooth workflow for coding assistants
- **Testing**: Stable automated test execution
- **Flexibility**: Multiple input options for different use cases
- **Debugging**: HTTP endpoint can return errors and status
- **Monitoring**: Can add logging, metrics to HTTP endpoint
- **Extensibility**: Easy to add authentication, rate limiting, etc.

### Negative
- **Complexity**: More code to maintain
- **Dependencies**: Adds express dependency for HTTP
- **Port Management**: Need to manage HTTP port allocation
- **Migration**: Existing scripts need updating (though old method still works)
- **Documentation**: Need to document multiple input methods

## Security Considerations

1. **Local Only by Default**: HTTP endpoint binds to 127.0.0.1 only
2. **No Authentication Initially**: Relies on local-only access for security
3. **Input Validation**: All messages validated before processing
4. **Rate Limiting**: Should add rate limiting in future iteration
5. **Future Enhancement**: Can add token-based auth for HTTP endpoint

## Migration Path

### For Existing Users
1. No immediate changes required - FIFO mode continues to work
2. Can optionally add `--http-port` to gain reliability benefits
3. Update CI/CD scripts to use HTTP when convenient

### For New Users
1. Documentation emphasizes HTTP endpoint as preferred method
2. Examples use HTTP by default
3. FIFO documented as legacy/compatibility option

### Timeline
- v0.2.0: Add HTTP endpoint alongside FIFO
- v0.3.0: HTTP becomes default in documentation
- v1.0.0: Consider deprecating FIFO (with long sunset period)

## Testing Plan

1. **Unit Tests**: Test each input mechanism independently
2. **Integration Tests**: Verify message flow through each mechanism
3. **Stress Tests**: Send rapid messages via HTTP to test reliability
4. **Compatibility Tests**: Ensure FIFO mode still works with existing tests
5. **Platform Tests**: Verify on Linux, macOS, and WSL

## References

- [Named Pipes (FIFOs) - Linux Documentation](https://man7.org/linux/man-pages/man7/fifo.7.html)
- [Express.js Documentation](https://expressjs.com/)
- [Unix Domain Sockets](https://man7.org/linux/man-pages/man7/unix.7.html)
- [MEW CLI Specification](../SPEC.md)
- [MEW Protocol v0.4 Specification](../../../../spec/v0.4/SPEC.md)