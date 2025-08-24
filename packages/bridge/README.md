# @mcpx-protocol/bridge

Bridge any MCP (Model Context Protocol) server to the MCPx multi-agent network. This package allows standard MCP servers to participate in MCPx topics as full-fledged agents.

## Installation

```bash
npm install @mcpx-protocol/bridge
```

## Quick Start

### Using the CLI

The bridge provides a CLI for quickly connecting MCP servers to MCPx topics:

#### 1. Using a bridge configuration file

```bash
# With a bridge-config.json file
mcpx-bridge start bridge-config.json

# Example bridge-config.json:
{
  "server": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"]
  },
  "mcpx": {
    "url": "ws://localhost:3000",
    "topic": "test-room",
    "participantId": "filesystem-agent"
  }
}
```

#### 2. Direct command execution (run command)

```bash
# Run an MCP server command directly
mcpx-bridge run npx -y @modelcontextprotocol/server-filesystem /tmp \
  --server ws://localhost:3000 \
  --topic test-room \
  --participant filesystem-agent

# Short form with defaults
mcpx-bridge run npx -y @modelcontextprotocol/server-filesystem /tmp
# Defaults: server=ws://localhost:3000, topic=test-room, participant=auto-generated
```

## Configuration

### Bridge Configuration File

The bridge configuration file specifies how to start the MCP server and connect to MCPx:

```json
{
  "server": {
    "command": "node",
    "args": ["my-mcp-server.js"],
    "env": {
      "CUSTOM_VAR": "value"
    }
  },
  "mcpx": {
    "url": "ws://localhost:3000",
    "topic": "my-topic",
    "participantId": "my-agent",
    "auth": {
      "token": "optional-auth-token"
    }
  }
}
```

### Server Configuration

- `command`: The executable to run
- `args`: Array of command-line arguments
- `env`: Optional environment variables

### MCPx Configuration

- `url`: WebSocket URL of the MCPx gateway
- `topic`: The topic/room to join
- `participantId`: Unique identifier for this agent in the topic
- `auth.token`: Optional authentication token

## Programmatic Usage

```typescript
import { MCPxBridge } from '@mcpx-protocol/bridge';

const bridge = new MCPxBridge({
  server: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
  },
  mcpx: {
    url: 'ws://localhost:3000',
    topic: 'test-room',
    participantId: 'filesystem-agent'
  }
});

// Start the bridge
await bridge.start();

// The bridge will:
// 1. Start the MCP server process
// 2. Connect to the MCPx gateway
// 3. Join the specified topic
// 4. Expose the MCP server's tools to other participants
// 5. Route messages between MCPx and the MCP server

// Stop the bridge
await bridge.stop();
```

## How It Works

The bridge acts as a translator between two protocols:

1. **MCP Server Side**: Communicates with the MCP server via stdio (stdin/stdout)
2. **MCPx Network Side**: Connects to the MCPx gateway via WebSocket

The bridge:
- Wraps MCP messages in MCPx envelopes for routing
- Unwraps MCPx envelopes and forwards MCP messages to the server
- Manages participant discovery and tool exposure
- Handles connection lifecycle and error recovery

## Examples

### Bridge a Filesystem Server

```bash
# Expose a directory to the MCPx network
mcpx-bridge run npx -y @modelcontextprotocol/server-filesystem ./documents \
  --participant docs-agent \
  --topic collaboration-room
```

### Bridge a Database Server

```bash
# Create a config file for a database MCP server
cat > db-bridge.json << EOF
{
  "server": {
    "command": "mcp-postgres-server",
    "env": {
      "DATABASE_URL": "postgresql://localhost/mydb"
    }
  },
  "mcpx": {
    "url": "ws://gateway.example.com:3000",
    "topic": "data-team",
    "participantId": "database-agent"
  }
}
EOF

mcpx-bridge start db-bridge.json
```

### Bridge Multiple Servers

```bash
# Start multiple bridges in different terminals
mcpx-bridge run mcp-server-1 --participant agent-1 &
mcpx-bridge run mcp-server-2 --participant agent-2 &
mcpx-bridge run mcp-server-3 --participant agent-3 &
```

## Supported MCP Servers

Any MCP server that communicates via stdio can be bridged, including:

- `@modelcontextprotocol/server-filesystem` - File system operations
- `@modelcontextprotocol/server-github` - GitHub API access
- `@modelcontextprotocol/server-gitlab` - GitLab API access
- `@modelcontextprotocol/server-google-maps` - Google Maps services
- `@modelcontextprotocol/server-postgres` - PostgreSQL database access
- `@modelcontextprotocol/server-sqlite` - SQLite database access
- Custom MCP servers that follow the protocol specification

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Development mode with watch
npm run dev
```

## Architecture

```
┌─────────────┐         ┌──────────┐         ┌─────────────┐
│ MCP Server  │ <stdio> │  Bridge  │ <ws://> │ MCPx Gateway│
└─────────────┘         └──────────┘         └─────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              MCPServerClient    MCPxAgent
              (stdio transport)  (ws transport)
```

## Troubleshooting

### Common Issues

1. **MCP server not starting**: Check that the command and args are correct
2. **Connection refused**: Ensure the MCPx gateway is running
3. **Authentication errors**: Verify the participant ID and token (if required)
4. **Tool discovery failing**: The MCP server may need time to initialize

### Debug Mode

Set the `DEBUG` environment variable for detailed logging:

```bash
DEBUG=mcpx:bridge mcpx-bridge start config.json
```

## License

MIT