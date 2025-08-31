# @mcpx-protocol/client

Protocol layer implementation for MCPx - handles wire format, transport, and message correlation with type-safe event handling.

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

// Type-safe event handlers
const unsubscribe = client.onChat((message, from) => {
  // message is typed as ChatMessage
  // from is typed as string
  console.log(`${from}: ${message.params.text}`);
});

// Handle errors
client.onError((error) => {
  console.error('Error:', error);
});

// Track peers
client.onPeerJoined((peer) => {
  console.log('Peer joined:', peer.id);
});

// Send chat message
client.chat('Hello everyone!');

// Call a peer's tool
const result = await client.request('peer-id', 'tools/call', {
  name: 'my-tool',
  arguments: { param: 'value' }
});

// Cleanup - unsubscribe handlers
unsubscribe();

// Disconnect
client.disconnect();
```

## Features

- **Type-safe event handlers** with full TypeScript support
- WebSocket connection management with auto-reconnection
- Envelope creation and validation (MCPx v0 spec)
- Correlation tracking for request/response matching
- Peer registry management
- Chat support
- REST API integration for topics/participants/history
- TypeScript support with full type definitions

## Event Handlers

All event handlers are type-safe and return an unsubscribe function:

```typescript
// Chat messages
const unsubChat = client.onChat((message, from) => {
  console.log(`${from}: ${message.params.text}`);
});

// Error handling
const unsubError = client.onError((error) => {
  console.error(error);
});

// Welcome message from gateway
const unsubWelcome = client.onWelcome((data) => {
  console.log('Connected as:', data.participant.id);
});

// Peer tracking
client.onPeerJoined((peer) => {
  console.log('Peer joined:', peer.id);
});

client.onPeerLeft((peer) => {
  console.log('Peer left:', peer.id);
});

// Connection lifecycle
client.onConnected(() => {
  console.log('Connected to gateway');
});

client.onDisconnected(() => {
  console.log('Disconnected from gateway');
});

client.onReconnected(() => {
  console.log('Reconnected to gateway');
});

// Raw envelope messages
client.onMessage((envelope) => {
  console.log('Received envelope:', envelope);
});

// Cleanup when done
unsubChat();
unsubError();
unsubWelcome();
```

## API

### Connection Methods
- `connect(): Promise<void>` - Connect to the gateway
- `disconnect(): void` - Disconnect from the gateway
- `getParticipantId(): string` - Get current participant ID
- `getPeers(): Peer[]` - Get list of connected peers

### Communication Methods
- `chat(text: string, format?: 'plain' | 'markdown'): void` - Send chat message
- `request(to: string, method: string, params: any): Promise<any>` - Call a peer's MCP method
- `notify(to: string[], method: string, params: any): void` - Send notification to peers
- `send(envelope: PartialEnvelope): Promise<void>` - Send raw envelope

### Event Registration Methods
All return an unsubscribe function: `() => void`

- `onChat(handler: (message: ChatMessage, from: string) => void)`
- `onError(handler: (error: Error) => void)`
- `onWelcome(handler: (data: SystemWelcomePayload) => void)`
- `onPeerJoined(handler: (peer: Peer) => void)`
- `onPeerLeft(handler: (peer: Peer) => void)`
- `onMessage(handler: (envelope: Envelope) => void)`
- `onConnected(handler: () => void)`
- `onDisconnected(handler: () => void)`
- `onReconnected(handler: () => void)`

See the [TypeScript definitions](src/types.ts) for complete type information.

## License

MIT