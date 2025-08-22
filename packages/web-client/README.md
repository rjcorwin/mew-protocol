# MCPx Reference Frontend

A React-based web interface for connecting to MCPx topics and interacting with MCP agents in real-time.

## Features

- **Real-time Communication**: WebSocket connection to MCPx server
- **Topic-based Chat**: Join topics and chat with multiple participants
- **MCP Integration**: Send MCP requests and view responses
- **Participant Management**: See who's online and their capabilities
- **Message Filtering**: View chat messages, MCP calls, or all messages
- **Responsive Design**: Works on desktop and mobile
- **Dark/Light Theme**: Automatic theme detection

## Quick Start

### Prerequisites

- Node.js 18+ 
- MCPx server running (see `../server`)

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Production Build

```bash
npm run build
npm run preview
```

## Usage

### Connecting to a Topic

1. Enter the server URL (e.g., `http://localhost:3000`)
2. Choose a participant ID (your unique identifier)
3. Enter a topic name (e.g., `room:general`)
4. Click "Connect"

The frontend will authenticate with the server and join the topic.

### Chatting

- Type messages in the input field at the bottom
- Choose between "Plain text" and "Markdown" formatting
- Press Enter to send (Shift+Enter for new lines)

### MCP Interactions

- Switch to the "MCP" tab to see MCP requests/responses
- Click the lightning bolt icon next to participants to list their tools
- View detailed message envelopes in the "All" tab

### Participants

- See all topic participants in the sidebar
- View their type (human/agent/robot) and MCP version
- Toggle the sidebar with the users icon

## Configuration

The frontend connects to the MCPx server and handles authentication automatically. No additional configuration is needed for development.

### Environment Variables

Create `.env.local` for custom settings:

```bash
VITE_DEFAULT_SERVER_URL=http://localhost:3000
VITE_DEFAULT_PARTICIPANT_ID=user-1
VITE_DEFAULT_TOPIC=room:general
```

## Architecture

### Project Structure

```
src/
├── components/          # React components
│   ├── ConnectionForm.tsx    # Server connection form
│   ├── ChatInterface.tsx     # Main chat interface
│   ├── MessagesList.tsx      # Message display
│   ├── ParticipantsList.tsx  # Participants sidebar
│   └── ConnectionStatus.tsx  # Connection indicator
├── hooks/               # React hooks
│   └── useMCPx.ts       # MCPx client hook
├── services/            # API clients
│   ├── MCPxClient.ts    # WebSocket client
│   └── AuthService.ts   # Authentication
├── types/               # TypeScript types
│   └── mcpx.ts          # MCPx protocol types
└── utils/               # Utilities
```

### Key Components

#### `useMCPx` Hook
Manages the WebSocket connection, message handling, and participant state.

#### `MCPxClient`
WebSocket client that handles:
- Connection management and reconnection
- Message envelope serialization
- Event emission for UI updates

#### `ConnectionForm`
Handles initial connection setup and authentication token generation.

#### `ChatInterface`
Main UI component with:
- Message display and filtering
- Chat input with format selection
- Participants sidebar
- Connection status

## Development

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

### Building

```bash
npm run build
```

## Message Types

The frontend handles all MCPx v0 message types:

### Chat Messages
```json
{
  "kind": "mcp",
  "payload": {
    "method": "notifications/chat/message",
    "params": { "text": "Hello!", "format": "plain" }
  }
}
```

### MCP Requests/Responses
```json
{
  "kind": "mcp", 
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }
}
```

### Presence Events
```json
{
  "kind": "presence",
  "payload": {
    "event": "join",
    "participant": { "id": "user-1", "name": "Alice" }
  }
}
```

## Troubleshooting

### Connection Issues

- **"Invalid token"**: Check server URL and ensure server is running
- **"WebSocket error"**: Verify server WebSocket endpoint is accessible
- **Connection drops**: Check network connectivity; client will auto-reconnect

### Message Issues

- **Messages not sending**: Ensure connection status shows "Connected"
- **Missing messages**: Check message filters in the tabs
- **Formatting issues**: Verify markdown syntax if using markdown format

### Performance

- **Slow UI**: Large message history may slow rendering; clear messages periodically
- **High memory**: WebSocket client caches all messages; implement pagination for production

## Contributing

1. Follow React/TypeScript best practices
2. Use the existing component patterns
3. Add prop types and JSDoc comments
4. Test on different screen sizes
5. Ensure accessibility (keyboard navigation, screen readers)