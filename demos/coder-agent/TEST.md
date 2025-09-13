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

## Notes

- The exact tool names may vary depending on the MCP fileserver implementation
- Always start with `tools/list` to discover the actual available operations
- The workspace directory is configured in `space.yaml` as the MCP server's working directory