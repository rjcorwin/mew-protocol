# MCPx Reference Server

A reference implementation of the MCPx v0 protocol server providing WebSocket-based real-time communication for multi-agent MCP collaboration.

## Features

- **MCPx v0 Protocol**: Full implementation of the MCPx specification
- **WebSocket Gateway**: Real-time bidirectional communication
- **Topic-based Messaging**: Participants join topics and exchange messages
- **Bearer Token Auth**: JWT-based authentication and authorization
- **Rate Limiting**: Configurable rate limits per participant
- **Message History**: Persistent message history with pagination
- **Presence Tracking**: Join/leave/heartbeat events
- **REST API**: Optional HTTP endpoints for topic management

## Quick Start

### Installation

```bash
cd server
npm install
```

### Configuration

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings, especially:
- `JWT_SECRET`: Set a secure secret for production
- `PORT`: Server port (default: 3000)

### Development

```bash
npm run dev
```

The server will start on `http://localhost:3000` with:
- WebSocket endpoint: `ws://localhost:3000/v0/ws`
- Health check: `http://localhost:3000/health`
- API base: `http://localhost:3000/v0/`

### Production

```bash
npm run build
npm start
```

## API Reference

### Authentication

Generate a token for testing:

```bash
curl -X POST http://localhost:3000/v0/auth/token \
  -H "Content-Type: application/json" \
  -d '{"participantId": "test-user", "topic": "room:test"}'
```

### WebSocket Connection

Connect to a topic:

```javascript
const ws = new WebSocket('ws://localhost:3000/v0/ws?topic=room:test', {
  headers: {
    'Authorization': 'Bearer your-jwt-token'
  }
});
```

### Message Format

All messages follow the MCPx v0 envelope format:

```json
{
  "protocol": "mcp-x/v0",
  "id": "uuid",
  "ts": "2025-08-19T...",
  "from": "participant-id",
  "to": ["target-id"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": { ... }
  }
}
```

### REST Endpoints

- `GET /v0/topics` - List topics
- `GET /v0/topics/{topic}/participants` - Get participants
- `GET /v0/topics/{topic}/history` - Get message history
- `POST /v0/auth/token` - Generate auth token (dev only)

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `JWT_SECRET` | `dev-secret...` | JWT signing secret |
| `TOKEN_EXPIRY` | `1h` | Token expiration time |
| `MAX_PARTICIPANTS_PER_TOPIC` | `50` | Max participants per topic |
| `HISTORY_LIMIT` | `1000` | Max stored messages per topic |
| `RATE_LIMIT_MESSAGES` | `60` | Messages per minute per participant |
| `RATE_LIMIT_CHAT` | `10` | Chat messages per minute per participant |
| `CORS_ORIGIN` | `localhost:3001,localhost:5173` | Allowed CORS origins |

## Development

### Project Structure

```
src/
├── types/          # TypeScript type definitions
│   ├── mcpx.ts     # MCPx protocol types
│   └── server.ts   # Server-specific types
├── services/       # Core business logic
│   ├── AuthService.ts    # JWT authentication
│   └── TopicService.ts   # Topic and message management
├── routes/         # API endpoints
│   ├── api.ts      # REST API routes
│   └── websocket.ts# WebSocket handling
├── config.ts       # Configuration loading
└── index.ts        # Main server entry point
```

### Testing

The server includes comprehensive unit and integration tests.

#### Run All Tests
```bash
npm test                    # Run all unit tests (48 tests)
```

#### Test Options
```bash
npm run test:watch          # Run tests in watch mode for development
npm run test:coverage       # Run tests with coverage report
npm run test:integration    # Run integration tests only (6 tests)
```

#### Test Categories

**Unit Tests** (48 tests - 100% passing)
- AuthService: JWT token generation and validation
- TopicService: Message routing, participant management
- MCPx Protocol: Schema validation, envelope handling

**Integration Tests** (6 tests - 5 passing)
- Server health and authentication workflows
- WebSocket connection establishment  
- End-to-end message exchange
- Data persistence and message history

#### Test Requirements
Tests require Node.js and npm dependencies. No external services needed - tests use in-memory configuration.

#### Troubleshooting Tests
- **Port conflicts**: Tests use random available ports
- **WebSocket timeouts**: Integration tests may be sensitive to system load
- **Jest warnings**: Some async cleanup warnings are expected after integration tests

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

## Example Usage

### Simple Chat Bot

```javascript
const ws = new WebSocket('ws://localhost:3000/v0/ws?topic=room:chat', {
  headers: { 'Authorization': 'Bearer your-token' }
});

ws.on('message', (data) => {
  const envelope = JSON.parse(data.toString());
  console.log('Received:', envelope);
});

// Send a chat message
const chatMessage = {
  protocol: 'mcp-x/v0',
  id: crypto.randomUUID(),
  ts: new Date().toISOString(),
  from: 'chat-bot',
  kind: 'mcp',
  payload: {
    jsonrpc: '2.0',
    method: 'notifications/chat/message',
    params: {
      text: 'Hello everyone!',
      format: 'plain'
    }
  }
};

ws.send(JSON.stringify(chatMessage));
```

## Security

- Use strong JWT secrets in production
- Implement proper token scoping for topics
- Consider rate limiting at the gateway level
- Validate all incoming message envelopes
- Messages are visible to all topic participants (not private)

## Contributing

1. Follow the existing TypeScript patterns
2. Add tests for new features
3. Update documentation
4. Ensure type checking passes