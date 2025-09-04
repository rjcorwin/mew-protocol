# @meup/gateway

Reference implementation of the MEUP (Multi-Entity Unified-context Protocol) gateway v0.2.

The MEUP gateway manages spaces where participants can communicate with unified context visibility. It provides:
- WebSocket server for real-time communication
- Space management with participant tracking
- Capability-based access control
- Message routing and history
- REST API for administration
- Metrics and monitoring

## Installation

```bash
npm install @meup/gateway
```

## Quick Start

### As a standalone server

```bash
# Clone and install
git clone https://github.com/rjcorwin/mcpx-protocol.git
cd sdk/typescript-sdk/gateway
npm install

# Configure
cp .env.example .env
# Edit .env with your settings

# Run
npm run start:dev
```

### As a library

```typescript
import { createGatewayServer } from '@meup/gateway';

const { app, server, gateway } = createGatewayServer({
  port: 8080,
  host: '0.0.0.0',
  authSecret: 'your-secret-key',
  enableRestApi: true,
  enableMetrics: true,
});

// Gateway is now running
console.log('Gateway running on ws://localhost:8080');
```

### Custom implementation

```typescript
import { MEUPGateway, SpaceManager, CapabilityChecker } from '@meup/gateway';
import { createServer } from 'http';

// Create components
const gateway = new MEUPGateway({
  maxSpaces: 100,
  maxClientsPerSpace: 100,
  heartbeatInterval: 30000,
});

// Handle events
gateway.on('client:connected', (client) => {
  console.log(`Client connected: ${client.participantId}`);
});

gateway.on('message:sent', (envelope, space) => {
  console.log(`Message in ${space.name}: ${envelope.kind}`);
});

// Start with HTTP server
const server = createServer();
gateway.start(server);
server.listen(8080);
```

## WebSocket Protocol

### Connection

Connect to a space via WebSocket:

```
ws://gateway.example.com/spaces/{spaceName}
```

Headers:
- `X-Participant-ID`: Your participant identifier (optional, auto-generated if not provided)
- `X-Capabilities`: JSON array of capabilities (optional, defaults to untrusted)
- `Authorization`: Bearer token (optional, for authenticated connections)

### Message Format

All messages follow the MEUP envelope format:

```json
{
  "protocol": "meup/v0.2",
  "id": "unique-message-id",
  "ts": "2025-01-03T12:00:00Z",
  "from": "participant-id",
  "to": ["target-id"],
  "kind": "chat",
  "payload": {
    "text": "Hello, world!",
    "format": "plain"
  }
}
```

### System Messages

The gateway sends system messages for:
- `system/welcome` - Sent when joining a space
- `system/presence` - Participant join/leave events
- `system/heartbeat` - Keep-alive messages
- `system/error` - Error notifications

## REST API

The gateway provides a REST API for administration and monitoring.

### Authentication

Create tokens for participants:

```bash
POST /api/tokens
Content-Type: application/json

{
  "participantId": "my-agent",
  "space": "my-space",
  "capabilities": [
    { "id": "chat", "kind": "chat" },
    { "id": "mcp", "kind": "mcp/*" }
  ],
  "admin": false,
  "expiresIn": "24h"
}
```

### Spaces

List all spaces:
```bash
GET /api/spaces
```

Get space info:
```bash
GET /api/spaces/{spaceName}
```

Get participants:
```bash
GET /api/spaces/{spaceName}/participants
```

Get message history:
```bash
GET /api/spaces/{spaceName}/messages?limit=100&before={messageId}
```

Create space (admin only):
```bash
POST /api/spaces
Authorization: Bearer {admin-token}

{
  "name": "new-space",
  "adminIds": ["admin-1", "admin-2"]
}
```

### Capabilities

Get default capabilities for a role:
```bash
GET /api/capabilities/trusted
GET /api/capabilities/untrusted
GET /api/capabilities/admin
```

### Monitoring

Health check:
```bash
GET /health
```

Metrics:
```bash
GET /metrics
```

## Capability System

The gateway enforces capability-based access control:

### Capability Format

```json
{
  "id": "unique-id",
  "kind": "message-kind-pattern",
  "to": "target-pattern",
  "payload": {
    "method": "pattern"
  }
}
```

### Pattern Matching

Kind patterns support wildcards:
- `*` - Matches everything
- `chat` - Exact match
- `mcp/*` - Prefix match
- `*/request` - Suffix match
- `mcp/*/request` - Middle wildcard

### Default Roles

**Admin** - Full access:
```json
[{ "id": "admin", "kind": "*" }]
```

**Trusted** - Can execute MCP operations:
```json
[
  { "id": "mcp-all", "kind": "mcp/*" },
  { "id": "meup-proposals", "kind": "meup/proposal/*" },
  { "id": "chat", "kind": "chat" }
]
```

**Untrusted** - Limited to proposals:
```json
[
  { "id": "chat", "kind": "chat" },
  { "id": "propose", "kind": "meup/proposal" }
]
```

## Configuration

Environment variables or config object:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | Server port |
| `HOST` | 0.0.0.0 | Server host |
| `CORS_ORIGINS` | * | CORS allowed origins |
| `AUTH_SECRET` | change-me | JWT signing secret |
| `ENABLE_REST_API` | true | Enable REST API |
| `ENABLE_METRICS` | true | Enable metrics |
| `LOG_LEVEL` | info | Logging level |
| `MAX_SPACES` | 100 | Maximum spaces |
| `MAX_CLIENTS_PER_SPACE` | 100 | Max clients per space |
| `MAX_MESSAGE_SIZE` | 1MB | Maximum message size |
| `MAX_HISTORY_SIZE` | 1000 | Messages to keep |
| `HEARTBEAT_INTERVAL` | 30000 | Heartbeat interval (ms) |

## Events

The gateway emits events for monitoring:

```typescript
gateway.on('space:created', (space) => {});
gateway.on('space:deleted', (spaceId) => {});
gateway.on('client:connected', (client) => {});
gateway.on('client:disconnected', (client) => {});
gateway.on('message:sent', (envelope, space) => {});
gateway.on('message:blocked', (envelope, reason) => {});
gateway.on('error', (error, client?) => {});
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  gateway:
    image: meup-gateway
    ports:
      - "8080:8080"
    environment:
      - AUTH_SECRET=your-secret-key
      - LOG_LEVEL=info
    restart: unless-stopped
```

### Production Recommendations

1. **Use HTTPS/WSS**: Deploy behind a reverse proxy (nginx, Caddy) with SSL
2. **Set strong AUTH_SECRET**: Use a cryptographically secure secret
3. **Enable monitoring**: Use metrics endpoint for monitoring
4. **Scale horizontally**: Use Redis for shared state across instances
5. **Rate limiting**: Implement rate limiting at proxy level
6. **Logging**: Use structured logging with log aggregation

## Examples

### Creating a Custom Gateway

```typescript
import { MEUPGateway, CapabilityChecker } from '@meup/gateway';

class CustomGateway extends MEUPGateway {
  constructor(config) {
    super(config);
    
    // Custom initialization
    this.setupCustomHandlers();
  }
  
  private setupCustomHandlers() {
    this.on('message:sent', (envelope, space) => {
      // Custom logging
      this.logToDatabase(envelope, space);
      
      // Custom filtering
      if (this.shouldFilter(envelope)) {
        this.blockMessage(envelope);
      }
    });
  }
  
  private logToDatabase(envelope, space) {
    // Implementation
  }
  
  private shouldFilter(envelope) {
    // Custom filtering logic
    return false;
  }
}
```

### Adding Custom REST Endpoints

```typescript
import { createGatewayServer } from '@meup/gateway';

const { app, server, gateway } = createGatewayServer();

// Add custom endpoints
app.post('/api/custom/broadcast', (req, res) => {
  const { spaceName, message } = req.body;
  
  const space = gateway.getSpaceManager().getSpaceByName(spaceName);
  if (!space) {
    return res.status(404).json({ error: 'Space not found' });
  }
  
  // Broadcast custom message
  const envelope = {
    protocol: 'meup/v0.2',
    id: generateId(),
    ts: new Date().toISOString(),
    from: 'system',
    kind: 'custom/announcement',
    payload: { message }
  };
  
  gateway.getSpaceManager().broadcast(space, envelope);
  res.json({ success: true });
});

server.listen(8080);
```

## Protocol Version

This gateway implements MEUP v0.2. See the [specification](https://github.com/rjcorwin/mcpx-protocol/blob/main/spec/v0.2/SPEC.md) for protocol details.

## License

MIT