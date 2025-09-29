# MEW-MCP Bridge Specification

**Version:** draft  
**Status:** Draft  
**Last Updated:** 2025-09-12

## Overview

The MEW-MCP Bridge (`@mew-protocol/bridge`) enables MCP (Model Context Protocol) servers to participate in MEW Protocol spaces. It acts as a translation layer between the MCP protocol (JSON-RPC over stdio) and the MEW Protocol (message-oriented over WebSocket), allowing existing MCP servers to be seamlessly integrated into MEW spaces without modification.

The bridge leverages the MEWParticipant base class from the MEW SDK to provide automatic tool registration and MCP request handling, making MCP servers appear as native MEW participants.

## Scope

This specification covers:
- Bridge process that translates between MCP and MEW protocols
- Configuration of MCP servers in space.yaml
- Automatic lifecycle management of MCP server processes
- Capability mapping from MCP server capabilities to MEW capabilities
- Tool discovery and registration
- Message translation and routing
- Error handling and recovery

Out of scope:
- Modification of existing MCP servers
- MCP client functionality for external use
- Custom MCP transports beyond stdio
- Direct MCP-to-MCP communication

## Architecture

### System Overview

```
MEW Space
    │
    ├── Gateway (WebSocket)
    │      ↕ MEW Protocol v0.4
    │
    ├── MCP Bridge Process (@mew-protocol/bridge)
    │   ├── MEWParticipant (SDK base class)
    │   │    └── Automatic tool/resource handling
    │   └── MCPClient (stdio manager)
    │        ↕ stdio (JSON-RPC)
    │
    └── MCP Server Process (any MCP server)
```

### Component Responsibilities

#### MCP Bridge (MCPBridge class)
- **Extends MEWParticipant**: Inherits WebSocket connection, message handling, and tool registration
- **MCP Server Management**: Spawns and manages MCP server subprocess lifecycle
- **Tool Discovery**: Queries MCP server for available tools and registers them with MEWParticipant
- **Resource Discovery**: Queries MCP server for available resources (if supported)
- **Capability Translation**: Maps MCP capabilities to MEW capabilities
- **Error Recovery**: Handles MCP server crashes and attempts restart

#### MCPClient
- **Process Management**: Spawns MCP server process with configured command/args
- **JSON-RPC Communication**: Handles stdio-based JSON-RPC protocol
- **Message Correlation**: Tracks request/response pairs with IDs
- **Initialization**: Performs MCP handshake sequence
- **Event Emission**: Emits notifications, errors, and lifecycle events

### Component Flow

1. **Startup**: Gateway reads space.yaml, identifies MCP bridge participants
2. **Bridge Launch**: Gateway spawns bridge process with MCP server configuration
3. **MEW Connection**: Bridge connects to gateway as MEWParticipant
4. **MCP Server Launch**: Bridge spawns MCP server subprocess
5. **MCP Initialization**: Bridge performs MCP handshake, discovers capabilities
6. **Tool Registration**: Bridge registers discovered MCP tools as MEWParticipant tools
7. **Ready State**: Bridge signals ready, begins handling requests
8. **Message Flow**: 
   - Incoming MCP requests automatically handled by MEWParticipant base class
   - Base class routes to registered tool executors
   - Tool executors forward to MCP server via MCPClient
9. **Shutdown**: Bridge manages graceful shutdown of MCP server

## Configuration

### Space Configuration (space.yaml)

```yaml
participants:
  filesystem:
    type: mcp-bridge
    mcp_server:
      command: "npx"
      args: 
        - "-y"
        - "@modelcontextprotocol/server-filesystem"
        - "/path/to/files"
      env:
        DEBUG: "mcp:*"
      cwd: "/working/directory"
    auto_start: true
    tokens: ["filesystem-token"]
    capabilities:
      - kind: "mcp/response"
      - kind: "system/*"
    bridge_config:
      init_timeout: 30000
      reconnect: true
      max_reconnects: 3
```

### Configuration Fields

#### `type: mcp-bridge`
Identifies this participant as an MCP bridge (required for gateway to use bridge launcher).

#### `mcp_server` (required)
- `command`: Executable to run the MCP server
- `args`: Array of command-line arguments
- `env`: Environment variables (optional)
- `cwd`: Working directory (optional)

#### `bridge_config` (optional)
- `init_timeout`: Maximum time to wait for MCP initialization (default: 30000ms)
- `reconnect`: Whether to reconnect on disconnect (default: true)
- `max_reconnects`: Maximum reconnection attempts (default: 3)

#### Standard MEW Participant Fields
- `tokens`: Authentication tokens for gateway
- `capabilities`: MEW capabilities (typically includes `mcp/response`)
- `auto_start`: Whether to start automatically
- `output_log`: Path to output log file

## Protocol Translation

### MCP to MEW Capability Mapping

| MCP Capability | MEW Capability |
|----------------|----------------|
| `tools` | `mcp/response` (automatic via tool registration) |
| `resources` | `mcp/response` (automatic via resource registration) |
| `prompts` | Not yet mapped |
| `logging` | `system/log` (notifications) |

### Message Translation Examples

#### Tools List Request
```javascript
// MEW Request (incoming)
{
  "protocol": "mew/v0.4",
  "id": "req-123",
  "from": "client",
  "to": ["filesystem"],
  "kind": "mcp/request",
  "payload": {
    "method": "tools/list",
    "params": {}
  }
}

// Handled automatically by MEWParticipant base class
// Returns registered tools without forwarding to MCP server
```

#### Tool Call Request
```javascript
// MEW Request (incoming)
{
  "protocol": "mew/v0.4",
  "id": "req-456",
  "from": "client",
  "to": ["filesystem"],
  "kind": "mcp/request",
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "read_text_file",
      "arguments": { "path": "/tmp/test.txt" }
    }
  }
}

// MCP Request (bridge to server)
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "read_text_file",
    "arguments": { "path": "/tmp/test.txt" }
  }
}

// MCP Response (server to bridge)
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "File contents..." }]
  }
}

// MEW Response (automatic from MEWParticipant)
{
  "protocol": "mew/v0.4",
  "id": "resp-789",
  "from": "filesystem",
  "to": ["client"],
  "correlation_id": ["req-456"],
  "kind": "mcp/response",
  "payload": {
    "result": {
      "content": [{ "type": "text", "text": "File contents..." }]
    }
  }
}
```

## Lifecycle Management

### Startup Sequence

1. **Bridge Process Start**
   - Parse command-line arguments
   - Create MCPBridge instance with configuration
   - Bridge extends MEWParticipant, initializes connection options

2. **MEW Connection**
   - Connect to gateway WebSocket
   - Send join message with space and token
   - Wait for welcome message

3. **MCP Server Initialization**
   - Spawn MCP server subprocess
   - Send `initialize` request
   - Receive server capabilities
   - Send `initialized` notification

4. **Tool Discovery and Registration**
   - Send `tools/list` request to MCP server
   - For each tool returned:
     - Register with MEWParticipant using `registerTool()`
     - Create executor function that forwards to MCP server
   
5. **Ready State**
   - `onReady()` callback triggered
   - Bridge operational, handling requests

### Shutdown Sequence

1. **Shutdown Trigger** (SIGINT/SIGTERM or error)
2. **MCP Server Shutdown**
   - Send shutdown notification if supported
   - Terminate MCP server process
   - Wait for process exit
3. **MEW Disconnection**
   - Disconnect from gateway
   - Clean up resources
4. **Process Exit**

### Error Recovery

#### MCP Server Crash
1. Detect process exit via `close` event
2. If not shutting down:
   - Log error
   - Attempt restart (if within max_reconnects)
   - Re-initialize and re-register tools
3. If max reconnects exceeded:
   - Send error to MEW space
   - Enter error state

#### Gateway Disconnection
- MEWParticipant base class handles reconnection automatically
- MCP server remains running
- Requests queued during reconnection

## Implementation Details

### Class Structure

```typescript
// Main bridge class
class MCPBridge extends MEWParticipant {
  private mcpClient?: MCPClient;
  private mcpCapabilities: any[] = [];
  
  constructor(options: MCPBridgeOptions) {
    // Initialize MEWParticipant base
    super({
      gateway: options.gateway,
      space: options.space,
      participant_id: options.participantId,
      token: options.token
    });
    
    // Start MCP server
    this.startMCPServer(options.mcpServer);
  }
  
  // Tool registration via base class
  private async registerMCPTools() {
    const tools = await this.mcpClient.request('tools/list');
    for (const tool of tools) {
      this.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: async (args) => {
          return await this.mcpClient.request('tools/call', {
            name: tool.name,
            arguments: args
          });
        }
      });
    }
  }
}
```

### Key Design Decisions

1. **Extends MEWParticipant**: Leverages existing SDK functionality for tool handling
2. **Automatic Tool Registration**: Tools discovered from MCP server are registered with base class
3. **No Custom Request Handler**: Base class handles all MCP requests automatically
4. **Stateless Bridge**: Bridge doesn't maintain state beyond connection status
5. **Process Lifecycle Tied**: MCP server lifecycle tied to bridge process

## Security Considerations

### Process Isolation
- MCP servers run as separate processes
- Communication only via stdio
- No shared memory or file descriptors

### Capability Enforcement
- Bridge inherits MEW capability system
- Gateway enforces capabilities on all messages
- MCP servers cannot bypass MEW security

### Authentication
- Bridge authenticates to gateway with tokens
- MCP servers have no direct gateway access
- All communication proxied through bridge

## Error Handling

### MCP Server Errors
- JSON-RPC errors translated to MEW error responses
- Server crashes trigger recovery attempts
- Persistent failures reported to space

### Protocol Errors
- Invalid JSON-RPC handled gracefully
- Malformed messages logged and dropped
- Request timeouts configurable

### Resource Limits
- Maximum message size enforced
- Process memory limits via OS
- Connection limits at gateway level

## Testing

### Unit Tests
- MCPClient: Mock stdio streams
- MCPBridge: Mock MCPClient and MEWParticipant
- Message translation validation

### Integration Tests
- Real MCP servers (filesystem, memory)
- End-to-end message flow
- Error recovery scenarios
- Tool discovery and registration

### Test Scenarios
- Scenario 7: Basic MCP bridge functionality
- Tool listing and execution
- File operations via filesystem server
- Error handling and recovery

## Future Enhancements

### Planned Features
1. **Resource Support**: Full resource discovery and serving
2. **Prompt Support**: MCP prompt template handling
3. **Streaming Responses**: Support for MCP streaming
4. **Multiple MCP Servers**: Single bridge managing multiple servers
5. **Dynamic Tool Updates**: Re-registration on capability changes

### Potential Optimizations
1. **Connection Pooling**: Reuse MCP server processes
2. **Response Caching**: Cache immutable responses
3. **Batch Operations**: Group multiple requests
4. **Lazy Initialization**: Defer MCP start until first use

## Appendix A: MCP Server Examples

### Filesystem Server
```yaml
filesystem:
  type: mcp-bridge
  mcp_server:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
```

### Memory Server
```yaml
memory:
  type: mcp-bridge
  mcp_server:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-memory"]
```

### Custom Server
```yaml
custom:
  type: mcp-bridge
  mcp_server:
    command: "python"
    args: ["my-mcp-server.py"]
    env:
      API_KEY: "${MY_API_KEY}"
```

## Appendix B: Debug Logging

Enable debug logging:
```bash
DEBUG=mew:bridge npm start
```

Log categories:
- `mew:bridge` - Main bridge operations
- `mew:bridge:mcp` - MCP client operations
- `mew:bridge:msg` - Message translation

## References

- [MEW Protocol Specification v0.4](../../spec/v0.4/SPEC.md)
- [MCP Specification](https://modelcontextprotocol.org)
- [MEW SDK Documentation](../../sdk/spec/draft/SPEC.md)
- [Test Scenarios](../../tests/scenario-7-mcp-bridge/)