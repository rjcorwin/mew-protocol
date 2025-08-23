# @mcpx-protocol/cli

Interactive CLI chat client for MCPx protocol testing and interaction.

## Installation

```bash
npm install -g @mcpx-protocol/cli
```

## Usage

### Start Interactive Session

```bash
mcpx-chat
```

### Quick Connect

```bash
mcpx-chat quick -g ws://localhost:3000 -t my-topic -p my-id
```

## Interactive Commands

Once connected, you can use the following commands:

### Chat
- Just type any text to send as a chat message

### Commands
- `/help` - Show help message
- `/connect` - Connect to an MCPx gateway
- `/disconnect` - Disconnect from current topic
- `/list` - List all participants
- `/tools <peer>` - List tools available from a peer
- `/call <peer> <tool> <args>` - Call a peer's tool
- `/history` - Show message history
- `/status` - Show connection status
- `/save <name>` - Save current connection config
- `/load <name>` - Load a saved connection
- `/quit` - Exit the client

## Features

- **Interactive Chat**: Real-time chat with other participants
- **MCP Tool Discovery**: List available tools from MCP-enabled peers
- **Tool Invocation**: Call tools on remote peers with JSON arguments
- **Connection Management**: Save and reuse connection configurations
- **Message History**: View recent messages in the topic
- **Colored Output**: Easy-to-read color-coded messages
- **Auto-reconnection**: Automatically reconnect on connection loss
- **Token Authentication**: Secure connection with JWT tokens

## Examples

### Basic Chat Session

```bash
$ mcpx-chat
=== MCPx Chat Client ===
Type /help for commands or /connect to start

mcpx> /connect
? Gateway URL: ws://localhost:3000
? Topic: dev-room
? Participant ID: alice
✓ Connected to dev-room as alice

mcpx> Hello everyone!
[10:23:45] [You] Hello everyone!
→ bob joined the topic
[10:23:50] [bob] Hi Alice!

mcpx> /list
=== Participants ===
  bob (human) 
  weather-bot (agent) [MCP]
```

### Calling MCP Tools

```bash
mcpx> /tools weather-bot
✓ Tools from weather-bot:
  - getCurrentWeather: Get current weather for a location
  - getForecast: Get weather forecast

mcpx> /call weather-bot getCurrentWeather {"location": "New York"}
✓ Tool result from weather-bot:
{
  "temperature": 72,
  "conditions": "Partly cloudy",
  "humidity": 65
}
```

### Saving Connections

```bash
mcpx> /save work
✓ Configuration saved as "work"

mcpx> /disconnect
Disconnected.

mcpx> /load work
✓ Connected to dev-room as alice
```

## Development

### Running from Source

```bash
npm run cli
```

### Building

```bash
npm run build
```

## Configuration

Saved connections are stored in `~/.mcpx/connections.json`.

## License

MIT