# @mcpx-protocol/client

Protocol layer implementation for MCPx - handles wire format, transport, and message correlation.

## Installation

```bash
npm install @mcpx-protocol/client
```

## Usage

```typescript
import { MCPxClient } from '@mcpx-protocol/client';

const client = new MCPxClient({
  gateway: 'ws://localhost:8080',
  topic: 'my-topic',
  token: 'my-token'
});

// Connect to gateway
await client.connect();

// Listen for messages
client.on('message', (envelope) => {
  console.log('Received:', envelope);
});

// Send chat message
client.chat('Hello everyone!');

// Call a peer's tool
const result = await client.request('peer-id', 'tools/call', {
  name: 'my-tool',
  arguments: { param: 'value' }
});

// Disconnect
client.disconnect();
```

## Features

- WebSocket connection management with auto-reconnection
- Envelope creation and validation (MCPx v0 spec)
- Correlation tracking for request/response matching
- Peer registry management
- Chat support
- REST API integration for topics/participants/history
- TypeScript support with full type definitions

## API

See the [TypeScript definitions](src/types.ts) for complete API documentation.

## License

MIT