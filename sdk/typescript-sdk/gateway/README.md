# @mew-protocol/gateway

Reference implementation of the MEW (Multi-Entity Workspace Protocol) gateway v0.2.

The MEW gateway manages spaces where participants can communicate with unified context visibility. It provides:

- WebSocket-based space endpoints
- Capability enforcement using JSON pattern matching
- System messages for presence, welcome, and errors
- Optional REST API for health and space info

## Installation

```bash
npm install @mew-protocol/gateway
```

## Usage

```ts
import { createGatewayServer } from '@mew-protocol/gateway';

createGatewayServer();
```

### Customization

```ts
import { MEWGateway, SpaceManager, CapabilityChecker } from '@mew-protocol/gateway';

const gateway = new MEWGateway({
  port: 8080,
  host: '0.0.0.0',
});

gateway.start();
```

## Protocol

All messages follow the MEW envelope format:

```json
{
  "protocol": "mew/v0.2",
  "id": "...",
  "ts": "...",
  "from": "...",
  "to": ["..."],
  "kind": "mcp/request",
  "payload": { /* method-specific */ }
}
```

### Default capabilities

```json
[
  { "id": "mew-proposals", "kind": "mew/proposal/*" },
  { "id": "propose", "kind": "mew/proposal" }
]
```

### Start server

```ts
import { createGatewayServer } from '@mew-protocol/gateway';
createGatewayServer();
```

This gateway implements MEW v0.2. Specification updates to v0.3 will follow.