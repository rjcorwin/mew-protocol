# HTTP Input for MEW CLI

## Overview

The MEW CLI now supports HTTP input as a reliable alternative to FIFO pipes. This feature addresses the common issue of FIFO blocking that causes automated agents (like coding assistants) to crash when sending messages.

## Why HTTP Input?

### Problems with FIFO
- **Blocking writes**: Writing to a FIFO can block indefinitely if no reader is ready
- **Agent crashes**: Automated tools often crash when writing to FIFOs
- **Platform issues**: Inconsistent behavior across different operating systems
- **No feedback**: No way to know if message was received

### Benefits of HTTP
- **Non-blocking**: HTTP requests never block the sender
- **Reliable**: Clear success/failure responses
- **Universal**: Works with any HTTP client or tool
- **Feedback**: Returns status and errors
- **Batch support**: Can send multiple messages at once

## Usage

### Starting Client with HTTP Input

```bash
# Basic usage
mew client connect \
  --gateway ws://localhost:8080 \
  --space test-space \
  --http-port 9090

# With custom bind address
mew client connect \
  --gateway ws://localhost:8080 \
  --space test-space \
  --http-port 9090 \
  --http-bind 0.0.0.0  # Allow external connections

# Combined with other input methods
mew client connect \
  --gateway ws://localhost:8080 \
  --space test-space \
  --http-port 9090 \
  --fifo-in ./input.fifo  # Both HTTP and FIFO
```

### Sending Messages

#### Using curl

```bash
# Send a chat message
curl -X POST http://localhost:9090/message \
  -H "Content-Type: application/json" \
  -d '{"kind":"chat","payload":{"text":"Hello world"}}'

# Send an MCP request
curl -X POST http://localhost:9090/message \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "mcp/request",
    "to": ["agent-1"],
    "payload": {
      "jsonrpc": "2.0",
      "id": 1,
      "method": "tools/list",
      "params": {}
    }
  }'
```

#### Using the helper script

```bash
# Use mew-send.sh for automatic fallback
export MEW_HTTP_PORT=9090
./bin/mew-send.sh '{"kind":"chat","payload":{"text":"Hello"}}'

# With verbose output
MEW_VERBOSE=true ./bin/mew-send.sh '{"kind":"chat","payload":{"text":"Hello"}}'
```

#### From Python

```python
import requests
import json

# Send a message
message = {
    "kind": "chat",
    "payload": {
        "text": "Hello from Python"
    }
}

response = requests.post(
    "http://localhost:9090/message",
    json=message
)

if response.status_code == 200:
    print("Message sent:", response.json())
else:
    print("Error:", response.json())
```

#### From Node.js

```javascript
const axios = require('axios');

async function sendMessage(message) {
  try {
    const response = await axios.post(
      'http://localhost:9090/message',
      message
    );
    console.log('Message sent:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

sendMessage({
  kind: 'chat',
  payload: { text: 'Hello from Node.js' }
});
```

## API Endpoints

### GET /health

Check if the HTTP server is running and healthy.

```bash
curl http://localhost:9090/health
```

Response:
```json
{
  "status": "ok",
  "version": "0.2.0",
  "endpoints": ["/health", "/message", "/messages"]
}
```

### POST /message

Send a single message to the MEW gateway.

Request:
```json
{
  "kind": "chat",
  "payload": {
    "text": "Hello world"
  }
}
```

Success Response (200):
```json
{
  "success": true,
  "sent": true,
  "timestamp": "2025-01-11T10:30:00.000Z"
}
```

Error Response (400/500):
```json
{
  "error": "Message must have a 'kind' field",
  "code": "MISSING_KIND"
}
```

### POST /messages

Send multiple messages in a single request.

Request:
```json
{
  "messages": [
    {"kind": "chat", "payload": {"text": "Message 1"}},
    {"kind": "chat", "payload": {"text": "Message 2"}},
    {"kind": "chat", "payload": {"text": "Message 3"}}
  ]
}
```

Response:
```json
{
  "results": [
    {"success": true, "result": {"id": "msg-1"}},
    {"success": true, "result": {"id": "msg-2"}},
    {"success": false, "error": "Invalid message", "code": "INVALID_FORMAT"}
  ]
}
```

## Error Codes

| Code | Description |
|------|------------|
| `INVALID_FORMAT` | Message is not valid JSON or wrong type |
| `MISSING_KIND` | Message lacks required 'kind' field |
| `HANDLER_ERROR` | Error occurred while processing message |
| `BATCH_ERROR` | Error in batch processing |
| `NOT_FOUND` | Endpoint does not exist |
| `SERVER_ERROR` | Internal server error |

## Migration Guide

### For Existing FIFO Users

Your existing FIFO setup continues to work. To add HTTP support:

1. Add `--http-port 9090` to your client command
2. Update scripts to use HTTP instead of FIFO:
   ```bash
   # Old (FIFO)
   echo '{"kind":"chat","payload":{"text":"Hello"}}' > input.fifo
   
   # New (HTTP)
   curl -X POST localhost:9090/message \
     -d '{"kind":"chat","payload":{"text":"Hello"}}'
   ```

### For CI/CD Pipelines

Replace FIFO writes with HTTP calls:

```yaml
# GitHub Actions example
- name: Send test message
  run: |
    curl -X POST http://localhost:9090/message \
      -H "Content-Type: application/json" \
      -d '{"kind":"chat","payload":{"text":"CI test"}}'
```

## Security Considerations

1. **Local Only by Default**: HTTP server binds to 127.0.0.1
2. **No Authentication**: Currently no auth required (relies on local access)
3. **Input Validation**: All messages are validated before processing
4. **Size Limits**: 10MB maximum message size

## Best Practices

1. **Use HTTP for Automation**: More reliable than FIFO
2. **Keep FIFO for Simple Scripts**: FIFO still works for basic use cases
3. **Check Health First**: Verify server is running before sending messages
4. **Handle Errors**: Check response status and handle failures
5. **Use Batch for Multiple Messages**: More efficient than individual requests

## Troubleshooting

### Port Already in Use

```bash
Error: Port 9090 is already in use
```

Solution: Use a different port with `--http-port 9091`

### Connection Refused

```bash
curl: (7) Failed to connect to localhost port 9090: Connection refused
```

Solution: Ensure client is started with `--http-port` option

### WebSocket Not Connected

```json
{"error": "WebSocket not connected", "code": "HANDLER_ERROR"}
```

Solution: Wait for client to connect to gateway before sending messages

## Examples

See `/cli/examples/test-http-input.sh` for a complete working example.