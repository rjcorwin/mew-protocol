# MCP-MEUP Bridge Specification

**Version:** draft (for v0.1.0)  
**Status:** Draft  
**Last Updated:** 2025-01-08

## Overview

The MCP-MEUP Bridge (`@meup/bridge`) enables MCP (Model Context Protocol) servers to participate in MEUP spaces. It acts as a translation layer between the MCP protocol (JSON-RPC over stdio/SSE) and the MEUP protocol (message-oriented over WebSocket), allowing existing MCP servers to be seamlessly integrated into MEUP spaces without modification.

## Scope

This specification covers:
- Bridge process that translates between MCP and MEUP protocols
- Configuration of MCP servers in space.yaml
- Automatic lifecycle management of MCP server processes
- Capability mapping from MCP server capabilities to MEUP capabilities
- Message translation and routing

Out of scope:
- Modification of existing MCP servers
- MCP client functionality (bridge acts as MCP client, MEUP participant)
- Custom MCP transports beyond stdio

## Architecture

```
MEUP Space
    │
    ├── Gateway (WebSocket)
    │      ↕ MEUP Protocol
    │
    ├── MCP Bridge Process (@meup/bridge)
    │      ↕ stdio (JSON-RPC)
    │
    └── MCP Server Process (any MCP server)
```

### Component Flow

1. **Startup**: CLI reads space.yaml, identifies MCP bridge participants
2. **Bridge Launch**: CLI spawns bridge process with MCP server configuration
3. **MCP Server Launch**: Bridge spawns and manages MCP server subprocess
4. **Initialization**: Bridge performs MCP handshake, discovers server capabilities
5. **Registration**: Bridge connects to MEUP gateway, registers with translated capabilities
6. **Operation**: Bridge translates messages bidirectionally
7. **Shutdown**: Bridge manages graceful shutdown of MCP server

## Configuration

### Space Configuration (space.yaml)

MCP servers are configured as participants with type `mcp-bridge`:

```yaml
space:
  id: my-space
  name: "Space with MCP Server"
  
participants:
  # Standard MCP server from npm/github
  mcp-filesystem:
    type: mcp-bridge
    mcp_server:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"]
    auto_start: true
    tokens: ["filesystem-token"]
    
  # Local MCP server
  my-local-mcp:
    type: mcp-bridge
    mcp_server:
      command: "node"
      args: ["./my-mcp-server/index.js"]
      env:
        CONFIG_PATH: "./config.json"
    auto_start: true
    tokens: ["local-mcp-token"]
    
  # Python MCP server
  python-mcp:
    type: mcp-bridge
    mcp_server:
      command: "python"
      args: ["./mcp_server.py"]
    auto_start: true
    tokens: ["python-token"]
```

### Bridge Configuration Options

```yaml
participants:
  mcp-server-id:
    type: mcp-bridge
    
    # MCP server configuration (required)
    mcp_server:
      command: "string"           # Command to execute
      args: ["array", "of", "args"] # Command arguments
      env:                        # Environment variables (optional)
        KEY: "value"
      cwd: "./path"              # Working directory (optional)
      
    # Bridge behavior (optional)
    bridge_config:
      init_timeout: 30000        # MCP init timeout in ms (default: 30000)
      reconnect: true           # Auto-reconnect on failure (default: true)
      max_reconnects: 5         # Max reconnection attempts (default: 5)
      
    # Standard participant options
    auto_start: true            # Start with space (default: false)
    tokens: ["token1"]          # Authentication tokens
    
    # Capability overrides (optional, normally auto-discovered)
    capabilities:
      - kind: "mcp/request"
        payload:
          method: "tools/*"
```

## Bridge Process

### Startup Sequence

1. **Parse Arguments**: Bridge receives configuration from CLI
2. **Start MCP Server**: Spawn subprocess with stdio pipes
3. **MCP Handshake**: 
   - Send `initialize` request
   - Receive server capabilities
   - Send `initialized` notification
4. **Connect to MEUP**: Establish WebSocket connection to gateway
5. **Register Capabilities**: Translate and register MCP capabilities as MEUP capabilities

### Capability Translation

MCP capabilities are automatically translated to MEUP capabilities:

| MCP Capability | MEUP Capability |
|---------------|-----------------|
| `tools` (server has tools) | `mcp/response` |
| `tools` (can call tools) | `mcp/request` with `method: "tools/*"` |
| `resources` | `mcp/response` |
| `prompts` | `mcp/response` |
| `logging` | `system/log` |

### Message Translation

#### MEUP → MCP

```javascript
// MEUP mcp/request message
{
  "kind": "mcp/request",
  "id": "msg-123",
  "from": "client-1",
  "to": ["mcp-filesystem"],
  "payload": {
    "method": "tools/list",
    "params": {}
  }
}

// Translated to MCP JSON-RPC
{
  "jsonrpc": "2.0",
  "id": "bridge-req-1",
  "method": "tools/list",
  "params": {}
}
```

#### MCP → MEUP

```javascript
// MCP JSON-RPC response
{
  "jsonrpc": "2.0",
  "id": "bridge-req-1",
  "result": {
    "tools": [...]
  }
}

// Translated to MEUP mcp/response
{
  "kind": "mcp/response",
  "id": "resp-456",
  "from": "mcp-filesystem",
  "to": ["client-1"],
  "correlation_id": ["msg-123"],
  "payload": {
    "jsonrpc": "2.0",
    "result": {
      "tools": [...]
    }
  }
}
```

### Error Handling

- **MCP Server Crash**: Bridge reports error to MEUP, attempts reconnection
- **Invalid JSON-RPC**: Bridge returns MEUP error message
- **Timeout**: Bridge enforces timeouts on MCP operations
- **Capability Violation**: Bridge validates before forwarding to MCP

## Implementation

### Bridge Executable

The bridge is provided as an executable that can be spawned by the CLI:

```bash
meup-bridge \
  --gateway ws://localhost:8080 \
  --space my-space \
  --participant-id mcp-filesystem \
  --token filesystem-token \
  --mcp-command "npx" \
  --mcp-args "-y,@modelcontextprotocol/server-filesystem,/path"
```

### Process Management

The bridge is managed by PM2 (via the CLI) along with other space participants:

1. CLI reads space.yaml
2. For each `type: mcp-bridge` participant:
   - Spawns bridge process via PM2
   - Bridge spawns MCP server as subprocess
   - Bridge manages MCP server lifecycle

### Logging

- Bridge logs to `logs/{participant-id}-bridge.log`
- MCP server stdout/stderr captured in `logs/{participant-id}-mcp.log`
- Structured logging with levels: debug, info, warn, error

## Examples

### Example 1: File System MCP Server

```yaml
participants:
  filesystem:
    type: mcp-bridge
    mcp_server:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/documents"]
    auto_start: true
    tokens: ["fs-token"]
```

This configuration:
1. Installs and runs the filesystem MCP server
2. Provides file access to `/home/user/documents`
3. Exposes file operations as MCP tools in the MEUP space

### Example 2: Custom Python MCP Server

```yaml
participants:
  data-analyzer:
    type: mcp-bridge
    mcp_server:
      command: "python"
      args: ["./mcp_servers/analyzer.py"]
      env:
        PYTHONPATH: "./lib"
        DATA_DIR: "./data"
    auto_start: true
    tokens: ["analyzer-token"]
```

### Example 3: Multiple MCP Servers

```yaml
participants:
  # GitHub MCP server
  github:
    type: mcp-bridge
    mcp_server:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-github"]
      env:
        GITHUB_TOKEN: "${GITHUB_TOKEN}"
    auto_start: true
    tokens: ["github-token"]
    
  # Postgres MCP server  
  postgres:
    type: mcp-bridge
    mcp_server:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    auto_start: true
    tokens: ["postgres-token"]
```

## Security Considerations

1. **Process Isolation**: Each MCP server runs in separate process
2. **Token Validation**: Bridge validates tokens before connecting
3. **Capability Enforcement**: Bridge respects MEUP capability model
4. **Resource Limits**: Bridge can enforce limits on MCP operations
5. **Sandboxing**: MCP servers can be run with restricted permissions

## Testing

Test scenarios should include:
1. Basic MCP server integration
2. Multiple concurrent MCP servers
3. MCP server crash recovery
4. Capability translation verification
5. Message translation accuracy
6. Performance with high message volume

## Future Enhancements

Potential future additions:
- Support for MCP SSE transport
- Direct stdio mode (bypass WebSocket for local use)
- MCP server discovery/registry
- Capability caching and optimization
- Advanced error recovery strategies
- Monitoring and metrics

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/docs)
- [MEUP v0.2 Protocol Specification](../../protocol-spec/spec/v0.2/SPEC.md)
- [MEUP CLI Specification](../../cli/spec/draft/SPEC.md)