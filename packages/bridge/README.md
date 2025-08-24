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

### Prerequisites

- Node.js 18+ 
- Running MCPx server (see parent directory)
- An MCP server to connect (e.g., `@modelcontextprotocol/server-filesystem`)

### Installation

```bash
cd bridge
npm install
npm run build
```

### Option 1: Quick Run (Recommended)

The fastest way to bridge an MCP server is using the `run` command:

```bash
# Bridge any MCP server with a single command
npx mcpx-bridge run <mcp-command> [args...]

# Examples:

# Bridge the filesystem MCP server
npx mcpx-bridge run npx @modelcontextprotocol/server-filesystem /path/to/directory

# Bridge a Python MCP server
npx mcpx-bridge run python weather_server.py

# With custom options
npx mcpx-bridge run npx @modelcontextprotocol/server-filesystem ~/Documents \
  --server ws://localhost:3000 \
  --topic my-workspace \
  --name "My Files" \
  --verbose
```

### Option 2: Interactive Setup

For persistent configuration, use the interactive setup:

```bash
npm run cli setup
```

Example configuration for filesystem MCP server:
- **MCPx server URL**: `ws://localhost:3000`
- **Topic**: `room:general`
- **Participant ID**: `mcp-bridge` (or any unique name)
- **Display name**: `MCP Bridge`
- **Participant type**: `robot`
- **MCP transport**: `stdio`
- **Command**: `npx`
- **Arguments**: `@modelcontextprotocol/server-filesystem /absolute/path/to/directory`

Then start the bridge:

```bash
npm run cli start
```

The bridge will:
1. Connect to your MCP server
2. Initialize the MCP protocol
3. Connect to the MCPx topic
4. Announce available tools to other participants
5. Route MCP requests/responses between the topic and your server

### Testing with MCPx Frontend

1. **Start MCPx Server** (if not running):
   ```bash
   cd ../server && npm run dev
   ```

2. **Start Frontend** (if not running):
   ```bash
   cd ../frontend && npm run dev
   ```

3. **Connect to MCPx**:
   - Open frontend at `http://localhost:3002`
   - Connect with your participant details

4. **Test MCP Tools**:
   - Click **"Dev Tools"** tab
   - Select your bridge participant (e.g., `mcp-bridge`)
   - Try **"List Tools"** to see available MCP tools
   - Use **Custom Request** for specific tool calls:
     ```json
     {"name": "read_file", "arguments": {"path": "example.txt"}}
     ```
   - Check **"MCP"** tab for responses

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
# Quick run with MCP server command
mcpx-bridge run <mcp-command> [args...] [options]
  Options:
    -s, --server <url>    MCPx server URL (default: ws://localhost:3000)
    -t, --topic <name>    Topic to join (default: test-room)
    -i, --id <id>         Participant ID (auto-generated if not provided)
    -n, --name <name>     Display name (auto-generated if not provided)
    -v, --verbose         Enable verbose logging

# Interactive setup
mcpx-bridge setup [--file <config-path>]

# Start bridge service with config file
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

### Common Setup Issues

**"fetch failed" during setup**
- MCPx server might not be running
- Check: `curl http://localhost:3000/health`
- Start server: `cd ../server && npm run dev`

**"Invalid token" when connecting**
- Token may have expired (default: 1 hour)
- Run setup again to generate fresh token
- Or manually generate: `curl -X POST http://localhost:3000/v0/auth/token -H "Content-Type: application/json" -d '{"participantId":"your-id","topic":"room:general"}'`

**"Access denied - path outside allowed directories"**
- Use **absolute paths** in MCP server args, not `~/path`
- Example: `/Users/username/Desktop/folder` not `~/Desktop/folder`
- Bridge sets working directory to first arg for relative path resolution

### Connection Issues

**"MCPx server unreachable"**
- Verify server URL and port
- Check if MCPx server is running
- Test with curl: `curl http://localhost:3000/health`

**"MCP server connection failed"**
- For stdio: Check command and arguments
- For WebSocket/SSE: Verify URL and server availability
- Check MCP server logs for errors
- Ensure MCP server binary is in PATH

### Frontend Dev Tools Issues

**"Bridge not visible in participant dropdown"**
- Refresh browser page to update participant list
- Check bridge is connected (should see "Broadcast X tools" in logs)
- All participants now shown - look for your bridge ID

**"Relative paths not working"**
- Bridge now sets working directory to first MCP server arg
- Use relative paths like `"path": "file.txt"` 
- Or absolute paths: `"path": "/full/path/to/file.txt"`

### Authentication

**"Invalid token"**
- Regenerate token using setup command
- Verify participant ID matches token
- Check token expiration (1 hour default)

### Protocol Issues

**"Tool calls failing"**
- Verify MCP server implements required methods
- Check MCP server initialization logs
- Test MCP server independently
- Check request format in MCP tab

### Performance

**"High memory usage"**
- Monitor message history growth
- Consider reducing heartbeat interval
- Check for message processing bottlenecks

## Examples

### Filesystem Service Bridge

```bash
# Setup
npm run cli setup
# Server: ws://localhost:3000
# Topic: room:general
# Participant: mcp-bridge
# MCP: mcp-server-filesystem /Users/username/Desktop/hello-world

# Start
npm run cli start
```

**Test in frontend Dev Tools:**
```json
// List all available tools
{"method": "tools/list"}

// Read a file (relative path)
{"name": "read_file", "arguments": {"path": "example.txt"}}

// List directory contents
{"name": "list_directory", "arguments": {"path": "."}}

// Create a new file
{"name": "write_file", "arguments": {"path": "test.txt", "content": "Hello world!"}}
```

### Weather Service Bridge

```bash
# Setup
npm run cli setup
# Server: ws://localhost:3000
# Topic: room:weather
# Participant: weather-bot
# MCP: python weather_server.py

# Start
npm run cli start --verbose
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