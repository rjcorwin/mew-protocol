# MEWParticipant - Promise-based MEW Agent SDK

A high-level TypeScript SDK for building MEW participants with automatic MCP handling, capability awareness, and promise-based request/response tracking.

## Features

- **Promise-based Requests**: Async/await support for MCP tool calls
- **Automatic MCP Handling**: Tools and resources work out of the box
- **Smart Capability Switching**: Automatically uses proposals when direct requests aren't allowed  
- **Type Safety**: Full TypeScript support
- **Lifecycle Hooks**: Easy setup and teardown handling
- **Error Handling**: Proper timeout and connection error management

## Quick Start

### 1. Build the SDK

```bash
npm install
npm run build
```

### 2. Create a Simple Agent

```javascript
const { MEWParticipant } = require('@mew-protocol/participant');

class MyAgent extends MEWParticipant {
  constructor(options) {
    super(options);
    
    // Register a tool
    this.registerTool({
      name: 'greet',
      description: 'Say hello to someone',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      },
      execute: async (args) => `Hello, ${args.name}!`
    });
  }
  
  async onReady() {
    console.log('Agent ready with capabilities:', this.participantInfo.capabilities);
  }
}

const agent = new MyAgent({
  gateway: 'ws://localhost:8080',
  space: 'my-space',
  token: 'my-token',
  participant_id: 'my-agent'
});

await agent.connect();
```

### 3. Make Promise-based Requests

```javascript
// Simple tool call
const result = await agent.request('other-agent', 'tools/call', {
  name: 'calculate',
  arguments: { a: 5, b: 3 }
});

// Parallel requests
const [r1, r2, r3] = await Promise.all([
  agent.request('calc', 'tools/call', { name: 'add', arguments: { a: 1, b: 2 } }),
  agent.request('calc', 'tools/call', { name: 'multiply', arguments: { a: 3, b: 4 } }),
  agent.request('calc', 'tools/call', { name: 'divide', arguments: { a: 10, b: 2 } })
]);

// With custom timeout
const result = await agent.request('slow-agent', 'tools/call', {
  name: 'slow-operation'
}, {}, 60000); // 60 second timeout
```

## Promise-based API Benefits

### Before (Fire-and-forget)
```javascript
// Old client way - no way to get the result
client.send({
  kind: 'mcp/request',
  to: ['calculator'],
  payload: { method: 'tools/call', params: { name: 'add', arguments: { a: 5, b: 3 }}}
});

// Have to manually track responses in message handlers
client.onMessage((envelope) => {
  if (envelope.kind === 'mcp/response') {
    // Manual correlation tracking...
  }
});
```

### After (Promise-based)
```javascript
// New MEWParticipant way - clean async/await
const result = await agent.request('calculator', 'tools/call', {
  name: 'add',
  arguments: { a: 5, b: 3 }
});

console.log('5 + 3 =', result.content[0].text); // "8"
```

## Capability-Aware Requests

The participant automatically chooses between direct requests and proposals based on your capabilities:

```javascript
// If you have mcp/request capability - sends direct request
// If you only have mcp/proposal capability - sends proposal
// Works transparently with the same API
const result = await agent.request('target', 'tools/call', { name: 'operation' });
```

## Examples

- `examples/calculator-agent.js` - Tool provider using automatic MCP handling
- `examples/async-calculator-client.js` - Client using promise-based requests

## API Reference

### MEWParticipant

#### Constructor
```typescript
constructor(options: ParticipantOptions)
```

#### Methods
- `registerTool(tool: Tool)` - Register an MCP tool
- `registerResource(resource: Resource)` - Register an MCP resource  
- `request(target, method, params?, timeoutMs?)` - Promise-based MCP request
- `chat(text, to?)` - Send chat message
- `canSend(kind, payload?)` - Check if you have capability
- `connect()` - Connect to gateway
- `disconnect()` - Disconnect from gateway

#### Lifecycle Hooks
- `onReady()` - Called when connected and welcomed
- `onShutdown()` - Called before disconnect

### Error Handling

```javascript
try {
  const result = await agent.request('target', 'tools/call', { name: 'operation' });
} catch (error) {
  if (error.message.includes('timed out')) {
    // Handle timeout
  } else if (error.message.includes('MCP Error')) {
    // Handle MCP error response
  } else if (error.message.includes('Connection closed')) {
    // Handle disconnect during request
  }
}
```

## Architecture

MEWParticipant builds on top of MEWClient to provide:

1. **Request Tracking**: Maps outgoing request IDs to Promise resolvers
2. **Response Matching**: Matches incoming responses by correlation_id  
3. **Timeout Management**: Automatic cleanup of expired requests
4. **Error Translation**: Converts MCP errors to Promise rejections
5. **Capability Logic**: Smart switching between requests and proposals

This gives you a much cleaner API while preserving all the transparency and capability control of MEW.