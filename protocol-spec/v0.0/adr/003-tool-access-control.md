# ADR-003: Tool Access Control in MCPx

## Status
PROPOSED

## Context

MCPx needs to prevent rogue agents from calling tools they haven't been authorized to use. This is a security requirement that goes beyond user approval - we need to establish and enforce which agents have permission to call which tools BEFORE they attempt to do so.

### The Security Challenge

Current problems:
1. Any agent in a topic can attempt to call any other agent's tools
2. Elicitation/approval happens AFTER the attempt, which is too late for security
3. No mechanism to establish trust relationships between agents
4. Potential for denial-of-service through unauthorized call attempts

### Requirements

- **Preventive Security**: Block unauthorized calls before they reach the tool owner
- **Explicit Authorization**: Agents must explicitly grant access to their tools
- **Revocable Permissions**: Ability to revoke previously granted access
- **Audit Trail**: Track who has access to what
- **Minimal Performance Impact**: Security shouldn't significantly slow down legitimate calls

## Decision

Implement a capability-based access control system where agents must possess valid capability tokens to call tools. This will be enforced at multiple levels: by the tool owner, optionally by the gateway, and through cryptographic signatures.

### Access Control Architecture

#### 1. Tool Access Declaration

When an agent joins a topic, it declares its tool access policy:

```json
{
  "protocol": "mcp-x/v0",
  "id": "msg-100",
  "ts": "2024-01-01T12:00:00Z",
  "from": "agent-b",
  "kind": "system",
  "payload": {
    "type": "tool_access_policy",
    "policy": {
      "mode": "allowlist", // or "denylist" or "open"
      "default": "deny", // default action for unlisted agents
      "rules": [
        {
          "agent": "agent-a",
          "tools": ["read_file", "list_files"],
          "expires": "2024-01-02T00:00:00Z"
        },
        {
          "agent": "user-1",
          "tools": "*", // all tools
          "requires_approval": true // still needs elicitation per call
        }
      ]
    }
  }
}
```

#### 2. Capability Token Request

Before calling a tool, an agent must request a capability token:

```json
{
  "protocol": "mcp-x/v0",
  "id": "msg-101",
  "ts": "2024-01-01T12:00:00Z",
  "from": "agent-a",
  "to": ["agent-b"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": "cap-req-1",
    "method": "capabilities/request",
    "params": {
      "tools": ["dangerous_operation"],
      "duration": 3600, // seconds
      "reason": "Need to perform maintenance task"
    }
  }
}
```

#### 3. Capability Token Grant

The tool owner can grant (automatically or after user approval) a capability token:

```json
{
  "protocol": "mcp-x/v0",
  "id": "msg-102",
  "ts": "2024-01-01T12:00:01Z",
  "from": "agent-b",
  "to": ["agent-a"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": "cap-req-1",
    "result": {
      "token": "cap_2024_abc123def456",
      "tools": ["dangerous_operation"],
      "expires": "2024-01-01T13:00:00Z",
      "signature": "..." // cryptographic signature from agent-b
    }
  }
}
```

#### 4. Tool Call with Capability

When calling a tool, the agent includes the capability token:

```json
{
  "protocol": "mcp-x/v0",
  "id": "msg-103",
  "ts": "2024-01-01T12:05:00Z",
  "from": "agent-a",
  "to": ["agent-b"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": "tool-call-1",
    "method": "tools/call",
    "params": {
      "name": "dangerous_operation",
      "arguments": {"target": "staging"},
      "capability": "cap_2024_abc123def456"
    }
  }
}
```

#### 5. Capability Validation

Agent B validates the capability before executing:
- Checks signature authenticity
- Verifies token hasn't expired
- Confirms tool is included in capability
- Validates caller matches token holder

If invalid, returns an error immediately:

```json
{
  "error": {
    "code": -32003,
    "message": "Invalid or missing capability token",
    "data": {
      "reason": "Token expired"
    }
  }
}
```

### Gateway Enforcement (Optional)

Gateways can provide an additional security layer by:

1. **Caching Access Policies**: Gateways cache agent access policies
2. **Pre-filtering**: Block tool calls without valid capabilities before forwarding
3. **Rate Limiting**: Prevent capability request spam
4. **Revocation Lists**: Maintain lists of revoked capabilities

```json
{
  "protocol": "mcp-x/v0",
  "id": "msg-104",
  "ts": "2024-01-01T12:05:00Z",
  "from": "gateway",
  "to": ["agent-a"],
  "kind": "system",
  "payload": {
    "type": "tool_call_blocked",
    "reason": "No valid capability for tool 'dangerous_operation' on agent 'agent-b'",
    "suggestion": "Request capability first using capabilities/request"
  }
}
```

### Access Control Modes

Agents can operate in different modes:

1. **Open Mode**: All tools accessible to everyone (backward compatible)
2. **Allowlist Mode**: Only specified agents can access tools
3. **Denylist Mode**: Everyone except specified agents can access tools
4. **Hybrid Mode**: Default policy with exceptions

### Capability Token Structure

```typescript
interface CapabilityToken {
  id: string;                 // Unique token ID
  issuer: string;             // Agent ID that issued token
  holder: string;             // Agent ID that can use token
  tools: string[];            // List of authorized tools or "*"
  constraints?: {
    maxUses?: number;         // Maximum number of uses
    validFrom?: string;       // ISO timestamp
    validUntil?: string;      // ISO timestamp
    arguments?: Record<string, any>; // Constraints on tool arguments
  };
  signature: string;          // Cryptographic signature
}
```

## Consequences

### Positive
- **Strong Security**: Unauthorized agents cannot call tools they lack capabilities for
- **Explicit Trust**: Clear trust relationships between agents
- **Revocable**: Can revoke access by invalidating tokens
- **Audit Trail**: All capability grants and uses are logged
- **DoS Prevention**: Rogue agents can't spam tool calls
- **Flexible**: Supports various access control patterns

### Negative
- **Additional Complexity**: Requires capability management
- **Performance Overhead**: Extra round-trip for capability requests
- **State Management**: Agents and gateways must track capabilities
- **Breaking Change**: Not backward compatible with simple tool calling

### Neutral
- **Cryptographic Requirements**: Needs signature verification (but libraries exist)
- **Token Management**: Similar to OAuth/JWT patterns developers know
- **Gateway Optional**: Can work with or without gateway enforcement

## Security Analysis: Man-in-the-Middle Attacks

### Attack Scenario

In MCPx, all messages in a topic are visible to all participants (broadcast by default). A malicious agent could:

1. **Observe capability token exchange**: See Agent A receive a capability token from Agent B
2. **Steal and replay the token**: Use the token to impersonate Agent A
3. **Intercept tool calls**: See the capability tokens being used in tool calls

#### Attack Example

```
1. Agent B grants capability to Agent A:
   {from: "agent-b", to: ["agent-a"], capability: "cap_xyz"}
   
2. Malicious Agent M observes this message in the topic

3. Agent M attempts to use the stolen token:
   {from: "agent-m", to: ["agent-b"], method: "tools/call", 
    params: {capability: "cap_xyz"}}
```

### Defense Mechanisms

#### 1. Token Binding to Agent Identity

Capability tokens MUST be cryptographically bound to the holder's identity:

```typescript
interface SecureCapabilityToken {
  holder: string;              // Agent ID that can use token
  holderPublicKey: string;     // Public key of the holder
  // ... other fields ...
  issuerSignature: string;     // Signed by issuer
}
```

When using a capability, the caller must prove ownership:

```json
{
  "method": "tools/call",
  "params": {
    "name": "dangerous_operation",
    "capability": "cap_xyz",
    "proof": {
      "timestamp": "2024-01-01T12:05:00Z",
      "nonce": "unique-random-value",
      "signature": "..." // Signed with holder's private key
    }
  }
}
```

#### 2. Validation Process

Agent B validates:
1. **Token validity**: Signature matches issuer (Agent B's own signature)
2. **Holder verification**: `from` field matches token's `holder` field
3. **Proof of possession**: Caller's signature proves they have the private key
4. **Replay prevention**: Timestamp and nonce prevent replay attacks

#### 3. Direct Message Capability Exchange (Optional)

For sensitive capabilities, use directed messages instead of broadcast:

```json
{
  "protocol": "mcp-x/v0",
  "to": ["agent-a"],  // Directed only to Agent A
  "kind": "mcp",
  "payload": {
    "result": {
      "token": "cap_xyz",
      "encrypted": true  // Token encrypted with Agent A's public key
    }
  }
}
```

However, this requires:
- Gateway support for directed messages
- Public key infrastructure for encryption
- May not prevent observation if gateway is compromised

#### 4. Channel Binding

Bind capabilities to specific communication channels:

```typescript
interface ChannelBoundToken {
  holder: string;
  channelId: string;        // Specific WebSocket connection ID
  sessionId: string;        // Specific session identifier
  // ...
}
```

This prevents tokens from being used on different connections, even by the same agent.

### Residual Vulnerabilities

Even with these defenses:

1. **Compromised Agent Keys**: If an agent's private key is stolen, attacker can impersonate
   - Mitigation: Key rotation, hardware security modules

2. **Gateway Compromise**: A compromised gateway could forge messages
   - Mitigation: End-to-end encryption between agents

3. **Capability Leak via Side Channels**: Tokens might leak through logs, errors, etc.
   - Mitigation: Careful handling, token redaction in logs

4. **Social Engineering**: Tricking agents into granting capabilities
   - Mitigation: User confirmation for sensitive capability grants

### Recommended Implementation

1. **Mandatory**: Token binding to holder identity with signature verification
2. **Mandatory**: Replay prevention with timestamp/nonce
3. **Recommended**: Direct message exchange for sensitive capabilities  
4. **Optional**: Channel binding for high-security environments
5. **Optional**: End-to-end encryption for defense-in-depth

## Implementation Considerations

1. **Bootstrap Problem**: How does an agent get initial capabilities?
   - Solution: User-agents (humans) can have implicit capabilities
   - Solution: Topics can have default capability policies

2. **Capability Discovery**: How do agents know what capabilities they need?
   - Solution: Include required capabilities in tool listings
   - Solution: Error messages guide agents to request capabilities

3. **Offline Agents**: What if tool owner is offline when capability is needed?
   - Solution: Pre-issued long-lived capabilities
   - Solution: Capability delegation to online agents

4. **Revocation**: How to revoke compromised capabilities?
   - Solution: Broadcast revocation notices
   - Solution: Short-lived tokens with refresh mechanism

5. **Key Management**: How do agents manage cryptographic keys?
   - Solution: Use existing PKI or derive from agent credentials
   - Solution: Gateway can act as certificate authority

## Migration Path

1. **Phase 1**: Implement capability system in parallel with open access
2. **Phase 2**: Agents can opt-in to capability requirements
3. **Phase 3**: Gateways begin enforcing capabilities where configured
4. **Phase 4**: Make capability-based access the default

## Alternatives Considered

1. **Pure Elicitation-Based**: Use elicitation for all tool calls
   - Rejected: Doesn't prevent unauthorized attempts, enables DoS

2. **Topic-Level Permissions**: Set permissions when joining topic
   - Rejected: Too coarse, doesn't allow dynamic permission changes

3. **Challenge-Response**: Require proof of authorization per call
   - Rejected: Too much latency for every call

4. **Trust Scores**: Reputation-based system
   - Rejected: Complex, doesn't provide hard security guarantees

5. **Gateway-Enforced Privilege Separation** (Alternative Design)
   - See detailed analysis below

### Alternative Design: Gateway-Enforced Privilege Separation

Instead of agent-managed capabilities, the gateway could issue two types of tokens with different privilege levels:

#### Token Types

1. **Full Access Token** (Type: `full`)
   - Can send any message type including direct `tools/call`
   - Typically issued to trusted agents and human users
   - Tool calls go through immediately

2. **Request-Only Token** (Type: `restricted`)  
   - Can only send `tools/request` messages, not direct `tools/call`
   - Issued to untrusted or new agents
   - Tool calls require fulfillment by a privileged participant

#### How It Works

##### 1. Gateway Token Assignment

When an agent connects, the gateway assigns a token type:

```json
{
  "protocol": "mcp-x/v0",
  "from": "gateway",
  "to": ["agent-a"],
  "kind": "system",
  "payload": {
    "type": "welcome",
    "tokenType": "restricted",  // or "full"
    "participantId": "agent-a"
  }
}
```

##### 2. Restricted Agent Makes Tool Request

A restricted agent cannot call tools directly, but can request them:

```json
{
  "protocol": "mcp-x/v0",
  "from": "agent-a",
  "to": ["agent-b"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": "req-123",
    "method": "tools/request",  // Not tools/call
    "params": {
      "name": "dangerous_operation",
      "arguments": {"target": "staging"},
      "reason": "Need to complete maintenance task"
    }
  }
}
```

##### 3. Gateway Transforms and Broadcasts

The gateway intercepts and transforms the request:

```json
{
  "protocol": "mcp-x/v0",
  "from": "gateway",
  "kind": "system",
  "payload": {
    "type": "tool_request_pending",
    "requester": "agent-a",
    "target": "agent-b",
    "tool": "dangerous_operation",
    "arguments": {"target": "staging"},
    "requestId": "req-123"
  }
}
```

##### 4. Privileged Agent Fulfills Request

An agent with full access can choose to fulfill the request:

```json
{
  "protocol": "mcp-x/v0",
  "from": "user-1",
  "to": ["agent-b"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": "call-456",
    "method": "tools/call",
    "params": {
      "name": "dangerous_operation",
      "arguments": {"target": "staging"},
      "onBehalfOf": "agent-a",
      "requestId": "req-123"
    }
  }
}
```

##### 5. Response Routing

The tool response is sent to both the fulfiller and original requester:

```json
{
  "protocol": "mcp-x/v0",
  "from": "agent-b",
  "to": ["user-1", "agent-a"],
  "kind": "mcp",
  "payload": {
    "jsonrpc": "2.0",
    "id": "call-456",
    "result": {
      "content": [{
        "type": "text",
        "text": "Operation completed"
      }],
      "fulfilledBy": "user-1",
      "originalRequester": "agent-a"
    }
  }
}
```

#### Advantages of Gateway Privilege Separation

1. **Simpler Implementation**: No cryptographic capabilities needed
2. **Centralized Control**: Gateway manages all permissions
3. **Clear Trust Boundaries**: Binary trust model (full vs restricted)
4. **No Token Theft Risk**: Privileges tied to connection, not transferable tokens
5. **Human-in-the-Loop**: Natural pattern for human oversight of untrusted agents
6. **Gradual Trust**: Agents can be promoted from restricted to full over time

#### Disadvantages

1. **Gateway Dependency**: All security depends on gateway implementation
2. **Less Flexible**: Binary model vs granular per-tool capabilities
3. **Gateway Becomes Bottleneck**: Must process all permission checks
4. **No Peer-to-Peer Trust**: Agents can't directly trust each other
5. **Stateful Gateway**: Gateway must track token types and connections

#### Hybrid Approach

Could combine both approaches:
- Gateway privilege separation for coarse-grained trust levels
- Agent capabilities for fine-grained tool access control
- Restricted agents must get capabilities AND fulfillment
- Full agents only need capabilities

## Recommendation

Consider a **phased approach**:

### Phase 1: Gateway Privilege Separation (Immediate Security)
Start with gateway-enforced privilege separation as it:
- Provides immediate security benefits
- Requires no cryptographic infrastructure
- Is simpler to implement and understand
- Naturally supports human-in-the-loop patterns

### Phase 2: Agent Capabilities (Fine-Grained Control)
Add agent-managed capabilities for:
- Granular per-tool access control
- Peer-to-peer trust relationships
- Reduced gateway dependency
- Advanced security scenarios

### Why This Phased Approach Works

1. **Immediate Protection**: Gateway privilege separation can be deployed quickly to prevent rogue agents
2. **Progressive Enhancement**: Capabilities can be added without breaking existing privilege separation
3. **Best of Both Worlds**: Coarse-grained gateway control + fine-grained agent control
4. **Graceful Degradation**: If capability system fails, gateway separation still provides baseline security

### Combined Security Model

In the final state:
- **Restricted agents**: Must use `tools/request` AND need fulfillment from privileged agents
- **Full agents**: Can use `tools/call` but still need valid capabilities from target agents
- **Human users**: Have full access by default but can delegate through tool requests
- **Gateway enforcement**: Blocks invalid messages at transport layer
- **Agent enforcement**: Validates capabilities at application layer

This can be combined with elicitation (ADR-002) for human approval workflows:
1. Gateway tokens control WHO can attempt tool calls
2. Capability tokens control WHICH tools can be called
3. Elicitation controls WHETHER specific calls are approved

## References

- ADR-001: Tool Authorization
- ADR-002: Elicitation for Tool Approval  
- OAuth 2.0 RFC 6749
- JSON Web Token (JWT) RFC 7519
- Capability-based Security literature