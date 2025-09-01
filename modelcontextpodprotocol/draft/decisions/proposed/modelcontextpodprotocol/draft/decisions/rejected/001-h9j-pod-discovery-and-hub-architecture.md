# ADR-h9j: Pod Discovery and Hub Architecture

**Status:** Rejected  
**Date:** 2025-08-30  
**Context:** MECP Protocol Draft Specification
**Incorporation:** Not Incorporated
**Rejection Date:** 2025-08-31
**Rejection Reason:** Out of scope for initial version. Pod configuration (ADR-d4n) provides a different approach that needs to mature first. Some aspects may be addressed by reasoning transparency (ADR-t8k).

## Context

A hub hosts multiple pods where participants collaborate. When a participant connects to a hub, they need a way to:
- Discover what pods exist on the hub
- Understand what each pod is for
- Request access to pods they're interested in
- Create new pods if authorized

This creates a fundamental discoverability problem: how do participants learn about and access pods on a hub?

The solution must:
- Work within the existing MCPx protocol design
- Maintain stateless gateway architecture
- Avoid special protocol extensions
- Support varying levels of access control
- Enable different hub implementations

## Options Considered

### Option 1: Special Discovery Protocol

Add dedicated protocol messages for pod discovery (pod/list, pod/join, pod/create).

**Pros:**
- Purpose-built for discovery
- Clear protocol semantics
- Standardized across all hubs

**Cons:**
- Adds complexity to core protocol
- Special cases in message handling
- Not using MCP's existing capabilities
- More protocol surface area to maintain

### Option 2: Direct Pod Connection

Participants connect directly to known pod URLs without discovery.

**Pros:**
- Simple - no discovery needed
- No special infrastructure
- Direct access path

**Cons:**
- No way to discover available pods
- Requires out-of-band pod URL sharing
- No central access control point
- Poor user experience

### Option 3: Lobby Pod with Hub Agent

Create a special "lobby" pod that all participants join first, containing a hub agent that exposes MCP tools for discovery and management.

**Pros:**
- Uses standard MCP tools - no protocol extensions
- Dogfooding - hub uses its own protocol
- Flexible - different hubs can offer different tools
- Natural entry point metaphor
- Discoverable via standard MCP tool introspection

**Cons:**
- Requires hub agent implementation
- Adds a layer of indirection
- Lobby pod becomes special case

### Option 4: System Messages Only

Use system messages in each pod to announce other pods.

**Pros:**
- No special components needed
- Works with existing protocol

**Cons:**
- No interactive discovery
- Can't query for specific pods
- No way to request access
- Limited to broadcast information

## Decision

**Adopt Option 3: Lobby Pod with Hub Agent**

The lobby pod pattern with a hub agent exposing MCP tools provides the best balance of simplicity, flexibility, and functionality.

### Hub Architecture

```
Hub (ws://hub.example.com)
├── /lobby                    # Entry pod with hub agent
├── /podA                     # Application pod
├── /podA/subpod1            # Nested pod
└── /podB                     # Another application pod
```

### Terminology

- **Hub**: Server infrastructure hosting multiple pods
- **Pod**: Isolated collaboration space within a hub
- **Lobby**: Special pod serving as hub entry point
- **Hub Agent**: MCP server in lobby pod exposing discovery and management tools

### Hub Agent MCP Tools

The hub agent SHOULD expose tools like:

```typescript
{
  "list_pods": {
    "description": "List available pods on this hub",
    "parameters": { 
      "filter": "string"  // Optional filter pattern
    }
  },
  "get_pod_info": {
    "description": "Get metadata about a specific pod",
    "parameters": { 
      "pod_id": "string" 
    }
  },
  "request_access": {
    "description": "Request access to a pod",
    "parameters": { 
      "pod_id": "string",
      "token": "string"  // Optional auth token
    }
  },
  "create_pod": {
    "description": "Create a new pod on this hub",
    "parameters": { 
      "name": "string",
      "config": "object"  // Optional configuration
    }
  }
}
```

### Discovery Flow

1. **Connect**: Participant connects to hub WebSocket
2. **Join Lobby**: Automatically placed in `/lobby` pod
3. **Discover Tools**: Standard MCP tool discovery from hub agent
4. **List Pods**: Call `list_pods` tool to see available pods
5. **Request Access**: Call `request_access` for desired pod
6. **Join Pod**: Connect to pod-specific WebSocket if granted

### Example: Discovering Pods

```json
// Request
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "list_pods",
    "arguments": {}
  },
  "id": "disc-1"
}

// Response
{
  "jsonrpc": "2.0",
  "result": {
    "pods": [
      {
        "id": "/podA",
        "name": "Development Team",
        "description": "Main development coordination",
        "members": 5,
        "public": true
      },
      {
        "id": "/podB", 
        "name": "Testing",
        "description": "QA and testing discussions",
        "members": 3,
        "public": false
      }
    ]
  },
  "id": "disc-1"
}
```

### Implementation Flexibility

- Hubs MAY provide a lobby pod (recommended but not required)
- Lobby pods CAN contain hub agents with varying tool sets
- Hub agents SHOULD expose standard discovery tools
- Different hubs MAY offer different capabilities
- Hubs without lobby pods must provide alternative discovery mechanisms

### Benefits

1. **Protocol Simplicity**: No special discovery protocol needed
2. **Dogfooding**: Hub operations use MCP itself
3. **Flexibility**: Each hub can customize its tools
4. **Discoverability**: Standard MCP tool introspection
5. **Extensibility**: Add new hub features by adding tools
6. **Compatibility**: Works with existing MCP clients

## Consequences

### Positive
- Clean separation between protocol and hub operations
- Hub features can evolve independently of protocol
- Natural entry point for new participants
- Supports both public and private pod models

### Negative
- Requires hub agent implementation
- Lobby pod is a special case
- Additional hop for pod access
- Dependency on MCP tool discovery working properly

## Security Considerations

- Hub agent validates all access requests
- Token-based authentication for pod access
- Rate limiting on tool calls
- Audit logging of access decisions
- Gateway remains stateless - auth handled by agents

## Migration Path

For existing implementations:
1. Add lobby pod to hub configuration
2. Implement hub agent with basic tools
3. Update client connection flow
4. Maintain backward compatibility during transition