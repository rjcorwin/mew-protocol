# MCPx Bridge

The MCPx Bridge connects existing MCP servers to MCPx topics, allowing them to participate in multi-agent conversations and expose their tools to other participants.

## Features

- **MCP Server Integration**: Connects to existing MCP servers via stdio, WebSocket, or SSE
- **MCPx Protocol**: Full MCPx v0 protocol support for topic participation
- **Tool Bridging**: Exposes MCP server tools to MCPx topic participants
- **Interactive Setup**: CLI wizard for easy configuration
- **Reconnection**: Automatic reconnection to both MCP and MCPx servers
- **Multiple Transports**: Support for stdio, WebSocket, and SSE MCP servers

## Quick Start

### Installation

```bash
cd bridge
npm install
npm run build
```

### Interactive Setup

```bash
npm run cli setup
```

This will guide you through configuring:
- MCPx server connection (URL, topic, authentication)
- Participant identity (ID, name, type)
- MCP server connection (transport, command/URL)

### Start Bridging

```bash
npm run cli start
```

The bridge will:
1. Connect to your MCP server
2. Initialize the MCP protocol
3. Connect to the MCPx topic
4. Announce available tools to other participants
5. Route MCP requests/responses between the topic and your server

## Usage

### Configuration File

The bridge uses a JSON configuration file (default: `bridge-config.json`):

```json
{
  "mcpx": {
    "server": "ws://localhost:3000",
    "topic": "room:general", 
    "token": "jwt-auth-token"
  },
  "participant": {
    "id": "weather-service",
    "name": "Weather Service",
    "kind": "agent"
  },
  "mcp_server": {
    "type": "stdio",
    "command": "python",
    "args": ["weather_server.py"]
  },
  "options": {
    "reconnectAttempts": 5,
    "reconnectDelay": 1000,
    "heartbeatInterval": 30000,
    "logLevel": "info"
  }
}
```

### CLI Commands

```bash
# Interactive setup
mcpx-bridge setup [--file <config-path>]

# Start bridge service
mcpx-bridge start [--config <config-path>] [--verbose]

# Validate configuration
mcpx-bridge validate [--config <config-path>]

# Test connections
mcpx-bridge test [--config <config-path>]
```

### MCP Server Types

#### Standard I/O (stdio)
```json
{
  "type": "stdio",
  "command": "python",
  "args": ["server.py"],
  "env": {
    "API_KEY": "your-key"
  }
}
```

#### WebSocket
```json
{
  "type": "websocket", 
  "url": "ws://localhost:8080/mcp"
}
```

#### Server-Sent Events
```json
{
  "type": "sse",
  "url": "http://localhost:8080/mcp/sse"
}
```

## How It Works

### Architecture

```
┌─────────────────┐    MCPx Protocol    ┌─────────────────┐
│                 │◄──────WebSocket────►│                 │
│  MCPx Server    │                     │  MCPx Bridge    │
│   (Gateway)     │                     │                 │
└─────────────────┘                     └─────────────────┘
                                                   │
                                        MCP Protocol │ stdio/ws/sse
                                                   ▼
                                        ┌─────────────────┐
                                        │                 │
                                        │   MCP Server    │
                                        │ (Your Service)  │
                                        └─────────────────┘
```

### Message Flow

1. **Tool Discovery**: Bridge lists tools from MCP server and announces to MCPx topic
2. **Request Routing**: MCPx participants send MCP requests addressed to the bridge
3. **Tool Execution**: Bridge forwards requests to MCP server and returns responses
4. **Notifications**: MCP server notifications are broadcast to the MCPx topic

### Example Flow

```
User in MCPx topic → tools/call → Bridge → MCP Server → Weather API
                  ←   result   ←       ←           ←
```

## Development

### Project Structure

```
src/
├── config/           # Configuration management
│   └── ConfigManager.ts
├── services/         # Core services  
│   ├── MCPxClient.ts      # MCPx WebSocket client
│   ├── MCPServerClient.ts # MCP server connection
│   └── BridgeService.ts   # Main bridge orchestration
├── types/           # TypeScript definitions
│   ├── config.ts    # Configuration schemas
│   └── mcpx.ts      # MCPx protocol types
├── cli.ts           # Command-line interface
└── index.ts         # Main entry point
```

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Type Checking

```bash
npm run typecheck
```

### Testing Configuration

```bash
npm run cli validate
npm run cli test
```

## Troubleshooting

### Connection Issues

**"MCPx server unreachable"**
- Verify server URL and port
- Check if MCPx server is running
- Test with curl: `curl http://localhost:3000/health`

**"MCP server connection failed"**
- For stdio: Check command and arguments
- For WebSocket/SSE: Verify URL and server availability
- Check MCP server logs for errors

### Authentication

**"Invalid token"**
- Regenerate token using setup command
- Verify participant ID matches token
- Check token expiration

### Protocol Issues

**"Tool calls failing"**
- Verify MCP server implements required methods
- Check MCP server initialization logs
- Test MCP server independently

### Performance

**"High memory usage"**
- Monitor message history growth
- Consider reducing heartbeat interval
- Check for message processing bottlenecks

## Examples

### Weather Service Bridge

```bash
# Setup
mcpx-bridge setup
# Server: ws://localhost:3000
# Topic: room:weather
# Participant: weather-bot
# MCP: python weather_server.py

# Start
mcpx-bridge start --verbose
```

### Calculator Service

```json
{
  "participant": {
    "id": "calc-service",
    "name": "Calculator",
    "kind": "agent"
  },
  "mcp_server": {
    "type": "stdio",
    "command": "node",
    "args": ["calculator.js"]
  }
}
```

### Robot Fleet Integration

```json
{
  "mcpx": {
    "topic": "fleet:robots"
  },
  "participant": {
    "id": "robot-alpha",
    "name": "Robot Alpha", 
    "kind": "robot"
  },
  "mcp_server": {
    "type": "websocket",
    "url": "ws://robot-alpha.local:8080/mcp"
  }
}
```

## Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Ensure CLI commands work correctly
5. Test with different MCP server types