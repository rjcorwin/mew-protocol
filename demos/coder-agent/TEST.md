# Coder Agent Demo - Manual Testing Guide

This guide provides test envelopes for manually testing the MCP fileserver bridge in the coder demo.

## Prerequisites

1. Start the space:
   ```bash
   mew space up -f space.yaml
   ```

2. Connect as human:
   ```bash
   mew client connect --space coder-demo --token human-token
   ```

## Test Envelopes

### 1. List Available Tools
Discover what tools the fileserver provides:

```json
{
  "protocol": "mew/v0.3",
  "id": "test-1",
  "from": "human",
  "to": ["mcp-fs-bridge"],
  "kind": "mcp/request",
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }
}
```

### 2. List Available Resources
Check what resources are exposed:

```json
{
  "protocol": "mew/v0.3",
  "id": "test-2",
  "from": "human",
  "to": ["mcp-fs-bridge"],
  "kind": "mcp/request",
  "payload": {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "resources/list"
  }
}
```

### 3. List Directory Contents
List files in the current directory:

```json
{
  "protocol": "mew/v0.3",
  "id": "test-3",
  "from": "human",
  "to": ["mcp-fs-bridge"],
  "kind": "mcp/request",
  "payload": {
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "list_directory",
      "arguments": {
        "path": "."
      }
    }
  }
}
```

### 4. Read a File
Read contents of a specific file:

```json
{
  "protocol": "mew/v0.3",
  "id": "test-4",
  "from": "human",
  "to": ["mcp-fs-bridge"],
  "kind": "mcp/request",
  "payload": {
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "read_file",
      "arguments": {
        "path": "test.txt"
      }
    }
  }
}
```

### 5. Write a File
Create or update a file:

```json
{
  "protocol": "mew/v0.3",
  "id": "test-5",
  "from": "human",
  "to": ["mcp-fs-bridge"],
  "kind": "mcp/request",
  "payload": {
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "write_file",
      "arguments": {
        "path": "test-write.txt",
        "content": "Hello from MEW Protocol test!"
      }
    }
  }
}
```

### 6. Get File Info
Get metadata about a file:

```json
{
  "protocol": "mew/v0.3",
  "id": "test-6",
  "from": "human",
  "to": ["mcp-fs-bridge"],
  "kind": "mcp/request",
  "payload": {
    "jsonrpc": "2.0",
    "id": 6,
    "method": "tools/call",
    "params": {
      "name": "get_file_info",
      "arguments": {
        "path": "test.txt"
      }
    }
  }
}
```

### 7. Create Directory
Create a new directory:

```json
{
  "protocol": "mew/v0.3",
  "id": "test-7",
  "from": "human",
  "to": ["mcp-fs-bridge"],
  "kind": "mcp/request",
  "payload": {
    "jsonrpc": "2.0",
    "id": 7,
    "method": "tools/call",
    "params": {
      "name": "create_directory",
      "arguments": {
        "path": "test-dir"
      }
    }
  }
}
```

### 8. Move/Rename File
Move or rename a file:

```json
{
  "protocol": "mew/v0.3",
  "id": "test-8",
  "from": "human",
  "to": ["mcp-fs-bridge"],
  "kind": "mcp/request",
  "payload": {
    "jsonrpc": "2.0",
    "id": 8,
    "method": "tools/call",
    "params": {
      "name": "move_file",
      "arguments": {
        "source": "test.txt",
        "destination": "renamed-test.txt"
      }
    }
  }
}
```

### 9. Delete File
Delete a file:

```json
{
  "protocol": "mew/v0.3",
  "id": "test-9",
  "from": "human",
  "to": ["mcp-fs-bridge"],
  "kind": "mcp/request",
  "payload": {
    "jsonrpc": "2.0",
    "id": 9,
    "method": "tools/call",
    "params": {
      "name": "delete_file",
      "arguments": {
        "path": "test-write.txt"
      }
    }
  }
}
```

## Expected Response Format

Successful responses should look like:

```json
{
  "protocol": "mew/v0.3",
  "id": "resp-X",
  "from": "mcp-fs-bridge",
  "to": ["human"],
  "kind": "mcp/response",
  "correlation_id": ["test-X"],
  "payload": {
    "jsonrpc": "2.0",
    "id": X,
    "result": {
      // Response data here
    }
  }
}
```

Error responses will have an `error` field instead of `result`:

```json
{
  "protocol": "mew/v0.3",
  "id": "resp-X",
  "from": "mcp-fs-bridge",
  "to": ["human"],
  "kind": "mcp/response",
  "correlation_id": ["test-X"],
  "payload": {
    "jsonrpc": "2.0",
    "id": X,
    "error": {
      "code": -32602,
      "message": "File not found"
    }
  }
}
```

## Testing with curl (HTTP API)

The gateway provides an HTTP API endpoint for sending messages without a WebSocket connection. This is useful for quick testing with curl.

### HTTP API Endpoint
```
POST http://localhost:8080/participants/{participantId}/messages?space={spaceId}
```

### Authentication
Include the participant's token in the Authorization header:
```
Authorization: Bearer {token}
```

### Example curl Commands

#### 1. List Available Tools
```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder-demo' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer human-token' \
  -d '{
    "to": ["mcp-fs-bridge"],
    "kind": "mcp/request",
    "payload": {
      "jsonrpc": "2.0",
      "id": 1,
      "method": "tools/list"
    }
  }'
```

#### 2. List Resources
```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder-demo' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer human-token' \
  -d '{
    "to": ["mcp-fs-bridge"],
    "kind": "mcp/request",
    "payload": {
      "jsonrpc": "2.0",
      "id": 2,
      "method": "resources/list"
    }
  }'
```

#### 3. List Directory Contents
```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder-demo' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer human-token' \
  -d '{
    "to": ["mcp-fs-bridge"],
    "kind": "mcp/request",
    "payload": {
      "jsonrpc": "2.0",
      "id": 3,
      "method": "tools/call",
      "params": {
        "name": "list_directory",
        "arguments": {
          "path": "."
        }
      }
    }
  }'
```

#### 4. Read a File
```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder-demo' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer human-token' \
  -d '{
    "to": ["mcp-fs-bridge"],
    "kind": "mcp/request",
    "payload": {
      "jsonrpc": "2.0",
      "id": 4,
      "method": "tools/call",
      "params": {
        "name": "read_file",
        "arguments": {
          "path": "test.txt"
        }
      }
    }
  }'
```

#### 5. Write a File
```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder-demo' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer human-token' \
  -d '{
    "to": ["mcp-fs-bridge"],
    "kind": "mcp/request",
    "payload": {
      "jsonrpc": "2.0",
      "id": 5,
      "method": "tools/call",
      "params": {
        "name": "write_file",
        "arguments": {
          "path": "test-write.txt",
          "content": "Hello from MEW Protocol test!"
        }
      }
    }
  }'
```

### Monitoring Responses

To see the responses, you need to have a WebSocket client connected to observe the messages. You can:

1. Use the MEW CLI client in another terminal:
```bash
mew client connect --gateway ws://localhost:8080 --space coder-demo --token human-token
```

2. Or use the HTTP API to check participants:
```bash
curl 'http://localhost:8080/participants?space=coder-demo'
```

### Response Format

The HTTP API returns a simple acknowledgment:
```json
{
  "id": "http-{timestamp}-{random}",
  "status": "accepted",
  "timestamp": "2025-09-13T22:23:09.792Z"
}
```

The actual MCP response will be broadcast to all participants in the space via WebSocket.

## Testing Workflow

1. **Discovery Phase**
   - Send envelope #1 (tools/list) to see available tools
   - Send envelope #2 (resources/list) to see available resources
   - Note the actual tool names from the response

2. **Read Operations**
   - Send envelope #3 (list_directory) to see what files exist
   - Send envelope #4 (read_file) to read an existing file
   - Send envelope #6 (get_file_info) to get file metadata

3. **Write Operations**
   - Send envelope #5 (write_file) to create a new file
   - Verify creation with envelope #3 (list_directory)
   - Read back the file with envelope #4 (read_file)

4. **File Management**
   - Send envelope #7 (create_directory) to create a directory
   - Send envelope #8 (move_file) to rename a file
   - Send envelope #9 (delete_file) to clean up test files

## Troubleshooting

- **No response**: Check that mcp-fs-bridge is running (`pm2 list` or check space status)
- **Tool not found**: Use tools/list first to get the exact tool names
- **Permission errors**: Check the workspace directory permissions
- **Path issues**: Paths are relative to `/Users/rj/Git/rjcorwin/mew-protocol/demos/coder-agent/workspace`

## Debugging with PM2 Logs

The demo uses PM2 to manage processes. Use these commands to monitor and debug:

### View Logs
```bash
# View all logs
pm2 logs

# View specific participant logs
pm2 logs coder-agent      # Coder agent logs
pm2 logs mcp-fs-bridge    # MCP bridge logs
pm2 logs gateway          # Gateway logs

# View last N lines
pm2 logs --lines 100

# Stream logs in real-time
pm2 logs --stream

# Clear logs
pm2 flush
```

### Process Management
```bash
# List all processes
pm2 list

# Restart a specific process
pm2 restart coder-agent

# Stop/start processes
pm2 stop coder-agent
pm2 start coder-agent

# Monitor resources
pm2 monit
```

## Simulating Human Interactions

You can simulate being the human participant to test agent behavior:

### Send Chat Messages as Human
```bash
# Ask the agent to perform a task
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder-demo' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer human-token' \
  -d '{
    "to": ["coder-agent"],
    "kind": "chat",
    "payload": {
      "text": "Please write a file called hello.txt with the content: Hello World"
    }
  }'
```

### Fulfill Agent Proposals as Human

When the coder agent creates proposals (because it lacks direct tool capabilities), you can fulfill them as the human:

1. First, observe proposals in the logs:
```bash
pm2 logs | grep "mcp/proposal"
```

2. Then fulfill a proposal by copying its content and sending as human:
```bash
# Example: Fulfill a write_file proposal
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder-demo' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer human-token' \
  -d '{
    "to": ["mcp-fs-bridge"],
    "kind": "mcp/request",
    "correlation_id": ["PROPOSAL_ID_HERE"],
    "payload": {
      "jsonrpc": "2.0",
      "id": 999,
      "method": "tools/call",
      "params": {
        "name": "write_file",
        "arguments": {
          "path": "hello.txt",
          "content": "Hello World"
        }
      }
    }
  }'
```

### Testing the ReAct Loop

To test if the agent properly continues its ReAct loop:

```bash
# Ask it to do something that requires multiple steps
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder-demo' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer human-token' \
  -d '{
    "to": ["coder-agent"],
    "kind": "chat",
    "payload": {
      "text": "Create a file called test.txt with some content, then read it back to verify"
    }
  }'

# Watch the logs to see the reasoning steps
pm2 logs coder-agent --stream | grep -E "(reasoning|ReAct|Thought)"
```

## Notes

- The exact tool names may vary depending on the MCP fileserver implementation
- Always start with `tools/list` to discover the actual available operations
- The workspace directory is configured in `space.yaml` as the MCP server's working directory
- The coder agent uses proposals when it lacks direct tool capabilities (see space.yaml for capability configuration)