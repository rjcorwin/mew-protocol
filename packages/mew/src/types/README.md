# @meup/types

Shared TypeScript type definitions for the MEUP (Multi-Entity Unified-context Protocol) v0.2.

## Installation

```bash
npm install @meup/types
```

## Usage

```typescript
import { 
  Envelope, 
  Participant, 
  Capability,
  Proposal,
  Tool,
  PROTOCOL_VERSION,
  MessageKinds 
} from '@meup/types';

// Use types in your code
const envelope: Envelope = {
  protocol: PROTOCOL_VERSION,
  id: '123',
  ts: new Date().toISOString(),
  from: 'my-agent',
  kind: MessageKinds.CHAT,
  payload: { text: 'Hello!' }
};

// Type-safe message handling
function handleMessage(envelope: Envelope) {
  switch (envelope.kind) {
    case MessageKinds.MCP_REQUEST:
      const request = envelope.payload as JsonRpcRequest;
      // Handle MCP request
      break;
      
    case MessageKinds.MEUP_PROPOSAL:
      const proposal = envelope.payload as MeupProposalPayload;
      // Handle proposal
      break;
  }
}
```

## Exported Types

### Core Protocol Types
- `Envelope` - MEUP message envelope
- `PartialEnvelope` - Partial envelope for sending
- `ContextField` - Sub-context operations
- `Participant` - Space participant with capabilities
- `Capability` - Capability definition
- `CapabilityGrant` - Capability grant between participants
- `Proposal` - Proposal for untrusted agents

### System Message Payloads
- `SystemWelcomePayload` - Welcome message when joining space
- `SystemErrorPayload` - Error notification
- `PresencePayload` - Join/leave/heartbeat events

### MEUP Message Payloads
- `MeupProposalPayload` - Proposal submission
- `MeupProposalAcceptPayload` - Proposal acceptance
- `MeupProposalRejectPayload` - Proposal rejection
- `MeupCapabilityGrantPayload` - Capability grant
- `MeupCapabilityRevokePayload` - Capability revocation

### MCP Types
- `JsonRpcRequest` - JSON-RPC 2.0 request
- `JsonRpcResponse` - JSON-RPC 2.0 response
- `JsonRpcNotification` - JSON-RPC 2.0 notification
- `JsonRpcError` - JSON-RPC 2.0 error
- `ServerCapabilities` - MCP server capabilities
- `Tool` - MCP tool definition
- `Resource` - MCP resource definition
- `Prompt` - MCP prompt definition
- `ToolExecutionResult` - Tool execution result
- `ResourceContent` - Resource content
- `ProgressParams` - Progress notification

### Constants
- `PROTOCOL_VERSION` - Current protocol version ('meup/v0.2')
- `MCP_VERSION` - MCP version ('2025-06-18')
- `MessageKinds` - All message kind constants
- `MCPMethods` - All MCP method names

## Type Categories

### 1. Protocol Layer
Types defining the MEUP protocol structure and message envelope format.

### 2. Capability System
Types for capability-based access control and permission management.

### 3. Proposal System
Types for the proposal-execute pattern used by untrusted agents.

### 4. MCP Integration
Types for Model Context Protocol operations within MEUP.

### 5. Application Layer
Types for application-level messages like chat.

## Version

This package implements MEUP v0.2 types. See the [specification](https://github.com/rjcorwin/mcpx-protocol/blob/main/spec/v0.2/SPEC.md) for protocol details.

## License

MIT