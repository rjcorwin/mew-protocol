# MEW Client SDK

TypeScript client SDK for MEW (Multi-Entity Workspace Protocol) v0.2.

MEW provides a unified context where all agent-to-agent and agent-to-tool interactions are visible and controllable at the protocol layer. Unlike traditional systems where AI coordination happens in hidden contexts, MEW broadcasts all messages within a shared space.

## Installation

```bash
npm install @mew-protocol/mew
```

## Quick Start

```typescript
import { MEWClient } from '@mew-protocol/mew/client';

// Create client
const client = new MEWClient({
  gateway: 'wss://gateway.example.com',
  space: 'my-space',
  token: 'your-auth-token',
  participant_id: 'my-agent',
  capabilities: [
    {
      id: 'tools-execute',
      kind: 'mcp/request',
      payload: { method: 'tools/*' }
    }
  ]
});

// Connect to space
await client.connect();

// Listen for events
client.on('welcome', (data) => {
  console.log('Connected as:', data.you.id);
  console.log('Participants:', data.participants);
});

client.on('chat', (message, from) => {
  console.log(`${from}: ${message.text}`);
});

client.on('proposal', (proposal, from) => {
  console.log(`Proposal from ${from}:`, proposal);
  // Trusted participants can accept/reject
  if (shouldAccept(proposal)) {
    await client.acceptProposal(proposal.correlation_id);
  }
});

// Send messages
await client.sendChat('Hello, space!');

// Make MCP requests
const result = await client.request('tools/list');

// Propose actions (for untrusted agents)
const envelope = await client.propose('tools-execute', {
  kind: 'mcp/request',
  payload: {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { name: 'search', arguments: { query: 'MEW protocol' } }
  }
});
```

## Key Features

### Unified Context
All participants share the same visible stream of interactions. No hidden agent-to-agent or agent-to-tool communications.

### Capability-Based Access Control
Participants have capabilities that define what operations they can perform:

```typescript
// Grant capabilities to another participant
await client.grantCapabilities('untrusted-agent', [
  {
    id: 'read-only',
    kind: 'mcp/request',
    payload: { method: 'resources/read' }
  }
]);

// Check if we have a capability
if (client.hasCapability('mcp/request', 'coordinator')) {
  await client.request('tools/call', params, 'coordinator');
}
```

### Proposal-Execute Pattern
Untrusted agents propose operations that trusted participants execute:

```typescript
// Untrusted agent proposes
const result = await client.propose('tools-execute', {
  kind: 'mcp/request',
  payload: { /* ... */ }
});

// Trusted participant handles proposals
client.on('proposal', async (proposal, from) => {
  if (isAllowed(proposal)) {
    await client.acceptProposal(proposal.correlation_id);
  } else {
    await client.rejectProposal(proposal.correlation_id, 'Not allowed');
  }
});
```

### Sub-Context Protocol
Manage conversation scope with push/pop/resume operations:

```typescript
// Start a sub-task
await client.pushContext('research-task');

// Work within the context
await client.sendChat('Let me search for information...');

// Return to main context
await client.popContext();

// Resume a previous context
await client.resumeContext(correlationId);
```

## API Reference

### Constructor

```typescript
new MEWClient(options: ConnectionOptions)
```

Options:
- `gateway`: WebSocket gateway URL
- `space`: Space name to join
- `token`: Authentication token
- `participant_id`: Optional participant identifier
- `capabilities`: Initial capabilities array
- `reconnect`: Enable auto-reconnect (default: true)
- `reconnectDelay`: Initial reconnect delay in ms (default: 1000)
- `maxReconnectDelay`: Maximum reconnect delay in ms (default: 30000)
- `heartbeatInterval`: Heartbeat interval in ms (default: 30000)
- `requestTimeout`: Request timeout in ms (default: 30000)

### Methods

#### Connection
- `connect(): Promise<void>` - Connect to gateway
- `disconnect(): void` - Disconnect from gateway
- `isConnected(): boolean` - Check connection status

#### Messaging
- `send(envelope: PartialEnvelope): Promise<void>` - Send raw envelope
- `sendChat(text: string, format?: 'plain' | 'markdown'): Promise<void>` - Send chat message

#### MCP Operations
- `request<T>(method: string, params?: any, target?: string): Promise<T>` - Make MCP request
- `notify(method: string, params?: any, target?: string): Promise<void>` - Send MCP notification

#### Proposals
- `propose(capability: string, envelope: PartialEnvelope): Promise<Envelope>` - Propose an action
- `acceptProposal(correlationId: string): Promise<void>` - Accept a proposal
- `rejectProposal(correlationId: string, reason?: string): Promise<void>` - Reject a proposal

#### Capabilities
- `grantCapabilities(to: string, capabilities: Capability[]): Promise<void>` - Grant capabilities
- `revokeCapabilities(to: string, capabilityIds: string[]): Promise<void>` - Revoke capabilities
- `hasCapability(kind: string, to?: string): boolean` - Check for capability
- `getCapabilities(): Capability[]` - Get current capabilities

#### Context Management
- `pushContext(topic: string): Promise<void>` - Push new sub-context
- `popContext(): Promise<void>` - Pop current sub-context
- `resumeContext(correlationId: string, topic?: string): Promise<void>` - Resume previous context

#### State
- `getParticipants(): Participant[]` - Get current participants
- `getParticipantId(): string | null` - Get own participant ID

### Events

```typescript
client.on('welcome', (data: SystemWelcomePayload) => {});
client.on('message', (envelope: Envelope) => {});
client.on('chat', (message: ChatPayload, from: string) => {});
client.on('proposal', (proposal: Proposal, from: string) => {});
client.on('proposal-accept', (data: MewProposalAcceptPayload) => {});
client.on('proposal-reject', (data: MewProposalRejectPayload) => {});
client.on('capability-grant', (grant: CapabilityGrant) => {});
client.on('capability-revoke', (data: MewCapabilityRevokePayload) => {});
client.on('participant-joined', (participant: Participant) => {});
client.on('participant-left', (participant: Participant) => {});
client.on('error', (error: Error) => {});
client.on('connected', () => {});
client.on('disconnected', () => {});
client.on('reconnected', () => {});
```

## Protocol Version

This SDK implements MEW v0.4. See the specification for protocol details.

## License

MIT