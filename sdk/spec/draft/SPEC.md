# MEW SDK Specification

**Version:** draft  
**Status:** Draft  
**Last Updated:** 2025-09-12

## Overview

The MEW SDK provides a TypeScript/JavaScript implementation for building participants in the MEW Protocol ecosystem. It consists of three layered classes that provide increasing levels of abstraction and functionality:

1. **MEWClient** - Low-level WebSocket connection and message handling
2. **MEWParticipant** - Protocol-aware participant with MCP capabilities
3. **MEWAgent** - AI/autonomous agent with reasoning and decision-making

Each layer builds upon the previous one, providing clear separation of concerns and allowing developers to choose the appropriate level of abstraction for their needs.

## Scope

This specification covers:
- The architecture and responsibilities of each SDK layer
- The interfaces between layers
- The lifecycle and state management of participants
- Tool and resource discovery mechanisms
- Capability-based message routing

This specification does NOT cover:
- The MEW Protocol itself (see protocol spec)
- Specific MCP method implementations
- Gateway implementation details
- Transport mechanisms beyond WebSocket

## Architecture

### Layer Hierarchy

```
┌─────────────────────────────────────────┐
│            MEWAgent                     │  Layer 3: AI/Autonomous
│  - Reasoning & decision-making          │  Agents with cognitive
│  - Autonomous tool discovery & use      │  capabilities
│  - Thinking/acting patterns             │
├─────────────────────────────────────────┤
│          MEWParticipant                 │  Layer 2: Protocol-aware
│  - MCP request/response handling        │  participants with
│  - Tool & resource registration         │  business logic
│  - Capability-based routing             │
│  - Proposal/fulfillment patterns        │
├─────────────────────────────────────────┤
│            MEWClient                    │  Layer 1: Transport &
│  - WebSocket connection management      │  basic messaging
│  - Message serialization                │
│  - Reconnection & heartbeat             │
│  - Event emission                       │
└─────────────────────────────────────────┘
```

### Class Relationships

```typescript
// Current implementation uses inheritance (to be refactored per ADR-cmp)
class MEWClient extends EventEmitter { }
class MEWParticipant extends MEWClient { }
class MEWAgent extends MEWParticipant { }

// Future implementation will use composition (per ADR-cmp)
class MEWClient extends EventEmitter { }
class MEWParticipant {
  private client: MEWClient;
}
class MEWAgent {
  private participant: MEWParticipant;
}
```

## Layer 1: MEWClient

### Purpose
Provides low-level WebSocket connectivity and message handling for the MEW Protocol.

### Responsibilities
- **Connection Management**: Connect, disconnect, reconnect to gateway
- **Message Transport**: Send and receive envelopes
- **Protocol Compliance**: Ensure messages follow MEW Protocol format
- **Event System**: Emit events for message types
- **Heartbeat**: Maintain connection with periodic heartbeats
- **State Tracking**: Track connection state

### Interface

```typescript
interface ClientOptions {
  gateway: string;          // WebSocket URL
  space: string;           // Space to join
  token: string;           // Authentication token
  participant_id?: string;  // Unique identifier
  reconnect?: boolean;     // Auto-reconnect on disconnect
  heartbeatInterval?: number;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  capabilities?: Capability[];  // Initial capabilities
}

class MEWClient extends EventEmitter {
  constructor(options: ClientOptions);
  
  // Connection management
  connect(): Promise<void>;
  disconnect(): void;
  
  // Message handling
  send(envelope: Envelope | PartialEnvelope): void;
  
  // Event handlers (for subclasses)
  onConnected(handler: () => void): void;
  onDisconnected(handler: () => void): void;
  onMessage(handler: (envelope: Envelope) => void): void;
  onWelcome(handler: (data: any) => void): void;
  onError(handler: (error: Error) => void): void;
}
```

### State Management
- `disconnected`: Not connected to gateway
- `connecting`: WebSocket connection in progress
- `connected`: WebSocket connected, not yet joined
- `joined`: Sent join message
- `ready`: Received welcome message

### Events
- `connected`: WebSocket connection established
- `disconnected`: Connection closed
- `message`: Envelope received
- `welcome`: Welcome message received
- `error`: Error occurred
- `reconnecting`: Attempting to reconnect

## Layer 2: MEWParticipant

### Purpose
Provides protocol-aware participant functionality with MCP support, tool/resource management, and capability-based routing.

### Responsibilities
- **MCP Protocol**: Handle MCP requests and responses
- **Tool Management**: Register and execute own tools (respond to tools/list and tools/call)
- **Resource Management**: Register and serve own resources
- **Capability Checking**: Validate operations against capabilities
- **Smart Routing**: Route requests via direct send or proposals
- **Request Tracking**: Track pending requests with timeouts
- **Tool Invocation**: Send tools/call requests to other participants (if has capability)

### Interface

```typescript
interface ParticipantOptions extends ClientOptions {
  requestTimeout?: number;  // Default timeout for MCP requests
}

// Handler types
type MCPProposalHandler = (envelope: Envelope) => Promise<void>;
type MCPRequestHandler = (envelope: Envelope) => Promise<void>;

class MEWParticipant {
  constructor(options: ParticipantOptions);
  
  // Connection (delegates to client)
  connect(): Promise<void>;
  disconnect(): void;
  
  // Tool & Resource Management
  registerTool(tool: Tool): void;
  registerResource(resource: Resource): void;
  
  // Capability checking
  canSend(envelope: Partial<Envelope>): boolean;
  
  // Smart MCP request routing (uses mcp/request or mcp/proposal based on capabilities)
  mcpRequest(
    target: string | string[],
    payload: any,
    timeoutMs?: number
  ): Promise<any>;
  
  // Direct messaging
  chat(text: string, to?: string | string[]): void;
  
  // MCP event handlers
  onMCPProposal(handler: MCPProposalHandler): () => void;
  onMCPRequest(handler: MCPRequestHandler): () => void;
  
  // Lifecycle hooks (for subclasses)
  protected onReady(): Promise<void>;
  protected onShutdown(): Promise<void>;
}
```

### Key Features

#### Capability Checking
The `canSend()` method uses the capability matcher to evaluate if a participant can send a specific message:
- Accepts a partial envelope containing at least the `kind` field
- Optionally includes `payload` for more specific capability matching  
- Uses `@mew-protocol/capability-matcher` for pattern matching
- Supports negative patterns (e.g., `!tools/call`), wildcards, and complex payload patterns
- Returns true if any capability matches the envelope

Example:
```typescript
// Check basic capability
participant.canSend({ kind: 'chat' }); // true if has chat capability

// Check with payload
participant.canSend({ 
  kind: 'mcp/request', 
  payload: { method: 'tools/call' } 
}); // false if has !tools/call restriction
```

#### Smart MCP Request Routing
The `mcpRequest()` method automatically chooses the appropriate mechanism for MCP operations:
1. If has `mcp/request` capability for the payload → send directly
2. If has `mcp/proposal` capability → create proposal with the payload
3. Otherwise → reject with error

Example:
```typescript
// Send an MCP request (or proposal if lacking capability)
const result = await participant.mcpRequest(
  'target-participant',
  { method: 'tools/call', params: { name: 'add', arguments: { a: 1, b: 2 } } },
  5000 // timeout
);
```

#### Proposal Pattern
When a participant lacks capability for direct requests:
```typescript
// Participant creates proposal
{
  kind: "mcp/proposal",
  to: ["mcp-fs-bridge"],  // MUST specify target participant(s)
  payload: {
    method: "tools/call",
    params: { name: "calculate", arguments: { a: 1, b: 2 } }
  }
}

// Human/authorized participant fulfills
{
  kind: "mcp/request",
  to: ["target"], // same as proposal's
  correlation_id: ["proposal-id"],
  payload: { /* same as proposal */ }
}

// Target responds to fulfiller (proposer observes via broadcast)
{
  kind: "mcp/response",
  to: ["fulfiller"],
  correlation_id: ["fulfillment-id"],
  payload: { /* result or error */ }
}
```

**Key Points:**
- Proposals MUST include `to` field specifying target participant(s)
- Fulfillment MUST include `correlation_id` referencing the proposal
- Fulfillment MUST match `to` of the proposal
- Response goes to fulfiller, but proposer can observe outcome via broadcast
- Proposers MAY timeout waiting for fulfillment (implementation-specific)
- Multiple participants MAY fulfill the same proposal (first wins)

**Proposal Lifecycle:**
- **Withdrawal** (`mcp/withdraw`): Proposer cancels their OWN proposal ONLY
  - MUST only be sent by the original proposer (security: prevents privilege escalation)
  - The `from` field MUST match the proposal's original `from` field
  - Use when: Timeout reached, found alternative solution, or no longer needed
  - Example: Proposer times out after 30s and sends withdrawal
  - **IMPORTANT**: Other participants CANNOT withdraw someone else's proposals
- **Rejection** (`mcp/reject`): Target participant declines to fulfill
  - Can be sent by any participant (typically those addressed in `to` field)
  - Use when: Unsafe operation, busy, or lacks capability
  - Example: File service rejects write to protected directory

**SDK Behavior (fail-fast):**
- When `mcp/reject` received: Proposal fails immediately with error
- When `mcp/withdraw` received: Only processed if `from` matches original proposer
- Withdrawals from other participants MUST be ignored (security check)
- Error format: `"Proposal rejected by filesystem-service: unsafe"`
- Proposers SHOULD send `mcp/withdraw` when giving up (timeout or alternative found)

#### Tool Registry
```typescript
interface Tool {
  name: string;
  description?: string;
  inputSchema?: JSONSchema;
  execute: (args: any) => Promise<any>;
}
```

## Layer 3: MEWAgent

### Purpose
Provides autonomous agent functionality with reasoning, tool discovery, and decision-making capabilities.

### Responsibilities
- **Autonomous Behavior**: Optional ReAct pattern (Reason+Act loops, can be disabled for reasoning models)
- **Tool Discovery**: Automatically discover tools from other participants via tools/list
- **Tool Orchestration**: Call tools from other participants via tools/call or proposals
- **Reasoning Transparency**: Emit reasoning events
- **Message Handling**: Process chat and requests autonomously
- **Participant Tracking**: Track other participants and their capabilities
- **Dynamic Tool Use**: Use discovered tools without hardcoding
- **Own Tools**: Can also register own tools (inherited from MEWParticipant)

### Interface

```typescript
interface AgentConfig extends ParticipantOptions {
  name?: string;
  systemPrompt?: string;
  model?: string;
  apiKey?: string;
  reasoningEnabled?: boolean;  // Enable ReAct pattern (false for models with built-in reasoning)
  autoRespond?: boolean;
  maxIterations?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  
  // Overridable prompts for different phases (ReAct pattern)
  prompts?: {
    system?: string;    // Override the base system prompt
    reason?: string;    // Template for reasoning/planning phase (ReAct: Reason)
    act?: string;       // Template for tool selection and execution (ReAct: Act)
    respond?: string;   // Template for formatting final response
  };
}

class MEWAgent extends MEWParticipant {
  constructor(config: AgentConfig);
  
  // Lifecycle
  start(): Promise<void>;
  stop(): void;
  
  // Tool management (extends parent)
  addTool(tool: Tool): void;
  addResource(resource: Resource): void;
  
  // Internal methods (protected) - ReAct pattern
  protected reason(input: string, previousThoughts: Thought[]): Thought;
  protected act(action: string, input: any): Promise<string>;
  
  // Tool namespace management (per ADR-tns)
  protected prepareLLMTools(): LLMTool[];
  protected executeLLMToolCall(namespacedTool: string, args: any): Promise<any>;
}
```

### Key Features

#### Tool Discovery and Namespacing
Agents automatically discover tools when participants join and present them using hierarchical namespace notation (per ADR-mpt):

1. Listen for `system/presence` events
2. Send `tools/list` request to new participants
3. Store discovered tools with participant attribution
4. Present tools to LLM using `participant/tool` notation

```typescript
// Internal storage
discoveredTools: Map<string, {
  name: string;
  participantId: string;
  description?: string;
  schema?: any;
}>;

// Tool presentation for LLM (per ADR-mpt)
interface LLMTool {
  name: string;        // "calculator/add" - hierarchical namespace
  description: string; // Includes participant context
  parameters?: any;    // Tool schema
}

// Example tool list for LLM
[
  {
    name: "calculator/add",
    description: "Add two numbers using the calculator service",
    parameters: { /* schema */ }
  },
  {
    name: "math-service/add",
    description: "Add two numbers using the math-service",
    parameters: { /* schema */ }
  }
]
```

The `participant/tool` notation:
- Provides clear attribution of which participant owns each tool
- Handles duplicate tool names across participants
- Is familiar to LLMs (similar to file paths and module imports)
- Easy to parse: `const [participantId, toolName] = toolCall.split('/')`

#### ReAct Loop
```typescript
interface Thought {
  reasoning: string;  // ReAct: reasoning step
  action: string;     // ReAct: action to take
  actionInput: any;   // ReAct: action parameters
}

// ReAct pattern (Reason + Act cycle)
1. Receive input (chat/request)
2. Start reasoning (emit reasoning/start if reasoningEnabled)
3. Process:
   - If reasoningEnabled (ReAct pattern): 
     * Loop (up to maxIterations):
       - Reason: Analyze and decide action
       - Emit: reasoning/thought
       - Act: Execute action
       - Observe: Process result
   - If reasoning disabled (for models with built-in reasoning):
     * Direct execution with model's built-in reasoning
     * Model handles its own chain-of-thought internally
4. Conclude (emit reasoning/conclusion if reasoningEnabled)
5. Respond to original sender
```

#### Custom Prompts
Agents support customizable prompts for different ReAct phases:

```typescript
const agent = new MEWAgent({
  // ... other config
  prompts: {
    system: "You are a helpful assistant with access to tools.",
    reason: "Analyze this request: {input}\nAvailable tools: {tools}\nReason about your approach:",
    act: "Select and execute the best tool for: {objective}\nTools: {tools}",
    respond: "Based on the result: {observation}\nProvide a helpful response:"
  }
});
```

The prompt phases correspond to the agent's workflow:
1. **system**: Base instructions for the agent's behavior
2. **reason**: Reasoning phase - analyze request and determine approach (ReAct: Reason)
3. **act**: Action phase - select and call appropriate tools (ReAct: Act)
4. **respond**: Response phase - format results for the user

Default prompts are provided but can be overridden for:
- **Domain-specific reasoning**: Customize ReAct reasoning for specific use cases
- **Language/tone adjustment**: Match organizational communication style
- **Specialized workflows**: Add domain knowledge to prompts

#### Dynamic Tool Selection
Agents select tools based on:
- Natural language matching of request to tool names/descriptions
- Availability of discovered tools
- Adaptation of arguments to tool schemas
- No hardcoded tool names or participant IDs

Example flow:
```typescript
// 1. Agent discovers tools and prepares for LLM
const llmTools = this.prepareLLMTools();
// Returns: [{ name: "calculator/add", ... }, { name: "math-service/multiply", ... }]

// 2. LLM selects a tool
const llmResponse = {
  tool: "calculator/add",
  arguments: { a: 5, b: 3 }
};

// 3. Agent parses and executes
const [participantId, toolName] = llmResponse.tool.split('/');
await this.mcpRequest([participantId], {
  method: 'tools/call',
  params: {
    name: toolName,
    arguments: llmResponse.arguments
  }
});
```

## Separation of Concerns

### MEWClient (Transport Layer)
**Concerns:**
- WebSocket lifecycle
- Message serialization/deserialization
- Connection reliability
- Event distribution

**NOT Concerns:**
- Protocol semantics
- Business logic
- Tool execution
- Decision making

### MEWParticipant (Protocol Layer)
**Concerns:**
- MCP protocol implementation
- Capability enforcement
- Own tool/resource management (register, list, execute)
- Calling other participants' tools (via tools/call)
- Request/response correlation
- Proposal patterns

**NOT Concerns:**
- Transport details
- Autonomous behavior
- Reasoning patterns
- Tool discovery from other participants
- Dynamic tool orchestration

### MEWAgent (Application Layer)
**Concerns:**
- Autonomous behavior
- Reasoning and decision-making (ReAct pattern)
- Tool discovery from other participants
- Tool namespace management for LLM (per ADR-tns)
- Converting `participant/tool` calls to MEW envelopes
- Dynamic tool orchestration across participants
- Multi-step workflows
- Natural language understanding
- Own tools (via inheritance from MEWParticipant)

**NOT Concerns:**
- Protocol details
- Connection management
- Low-level message handling
- Direct tool registration (uses parent's methods)

## Configuration

### Environment Variables
```bash
MEW_GATEWAY=ws://localhost:8080
MEW_SPACE=default
MEW_TOKEN=agent-token
MEW_PARTICIPANT_ID=my-agent
MEW_AGENT_CONFIG='{"thinkingEnabled": true}'
```

### Configuration Files
Agents support YAML/JSON configuration:
```yaml
# agent-config.yaml
gateway: ws://localhost:8080
space: production
token: ${AGENT_TOKEN}
participant_id: assistant-1
systemPrompt: "You are a helpful assistant"
thinkingEnabled: true
maxIterations: 10
```

## Dependencies

### Required
- Node.js >= 18.0.0
- WebSocket support
- TypeScript 5.0+ (for TypeScript SDK)

### Protocol Dependencies
- MEW Protocol v0.3
- MCP (Model Context Protocol)

### Package Dependencies
```json
{
  "@mew-protocol/types": "workspace:*",
  "@mew-protocol/client": "workspace:*",
  "@mew-protocol/participant": "workspace:*",
  "@mew-protocol/agent": "workspace:*"
}
```

## Security Considerations

### Authentication
- Tokens passed in connection options
- Gateway validates tokens before allowing join
- No token refresh mechanism (reconnect with new token)

### Capability Enforcement
- Gateway enforces capabilities at message level
- Participants should validate capabilities before sending
- Proposals allow capability-limited operations

### Tool Security
- Tools execute in participant's context
- No sandboxing of tool execution
- Tools should validate inputs
- Agents should not expose dangerous operations

### Message Security
- No end-to-end encryption (relies on TLS)
- Messages visible to gateway
- No message signing/verification

## Error Handling

### Connection Errors
- Automatic reconnection with exponential backoff
- Maximum retry attempts configurable
- Events emitted for connection state changes

### Protocol Errors
- MCP errors returned with proper error codes
- Capability violations result in gateway errors
- Timeout errors for pending requests

### Tool Errors
- Tool execution errors caught and returned
- Validation errors for invalid arguments
- Schema validation before execution

## Testing

### Unit Testing
Each layer should be independently testable:
- MEWClient: Mock WebSocket
- MEWParticipant: Mock client events
- MEWAgent: Mock participant methods

### Integration Testing
- Use test gateway for end-to-end tests
- Test capability enforcement
- Test proposal/fulfillment patterns
- Test tool discovery and execution

## Migration Guide

### From Direct WebSocket
1. Replace WebSocket with MEWClient
2. Convert message handlers to event listeners
3. Add envelope wrapping/unwrapping

### From MEWClient to MEWParticipant
1. Change inheritance/composition
2. Register tools/resources
3. Use `mcpRequest()` for MCP operations

### From MEWParticipant to MEWAgent
1. Configure agent-specific options
2. Implement reasoning patterns
3. Enable tool discovery

## Examples

### Basic Client
```typescript
const client = new MEWClient({
  gateway: 'ws://localhost:8080',
  space: 'test',
  token: 'client-token'
});

await client.connect();
client.send({
  kind: 'chat',
  payload: { text: 'Hello!' }
});
```

### Participant with Tools
```typescript
const participant = new MEWParticipant({
  gateway: 'ws://localhost:8080',
  space: 'test',
  token: 'participant-token',
  participant_id: 'calculator'
});

participant.registerTool({
  name: 'add',
  execute: async ({ a, b }) => a + b
});

await participant.connect();

// Make an MCP request (will use proposal if lacking mcp/request capability)
const result = await participant.mcpRequest(
  'another-participant',
  { method: 'tools/list' }
);
```

### Autonomous Agent
```typescript
// Agent with explicit ReAct pattern
const agent = new MEWAgent({
  gateway: 'ws://localhost:8080',
  space: 'test',
  token: 'agent-token',
  participant_id: 'assistant',
  reasoningEnabled: true,  // Enable ReAct (Reason + Act) loop
  autoRespond: true
});

// Agent with reasoning model (no explicit ReAct)
const reasoningAgent = new MEWAgent({
  gateway: 'ws://localhost:8080',
  space: 'test',
  token: 'agent-token',
  participant_id: 'reasoning-assistant',
  model: 'o1-preview',  // Has built-in reasoning
  reasoningEnabled: false,  // Model handles ReAct internally
  autoRespond: true
});

// Agent with custom prompts for specialized domain
const specializedAgent = new MEWAgent({
  gateway: 'ws://localhost:8080',
  space: 'test',
  token: 'agent-token',
  participant_id: 'medical-assistant',
  reasoningEnabled: true,
  prompts: {
    system: "You are a medical assistant. Always prioritize patient safety and include appropriate disclaimers.",
    reason: "Analyze this medical query: {input}\nConsider patient safety and available tools: {tools}",
    act: "Select appropriate medical tool for: {objective}\nEnsure safe usage of: {tools}",
    respond: "Provide medically accurate response based on: {observation}\nInclude necessary disclaimers."
  }
});

await agent.start();
// Agent now autonomously handles messages
```

## Future Considerations

### Composition vs Inheritance
The current implementation uses inheritance, but will be refactored to use composition per ADR-cmp (see `decisions/accepted/001-cmp-composition-over-inheritance.md`). This refactoring is planned for the next major version (2.0) to provide better separation of concerns, testability, and flexibility.

### Plugin System
Allow extending agents with plugins:
- Custom thinking strategies
- Tool providers
- Middleware for message processing

### Multi-Transport
Support beyond WebSocket:
- HTTP long-polling
- Server-sent events
- WebRTC data channels

### Persistence
Add state persistence:
- Save/restore conversation context
- Persist discovered tools
- Resume after disconnect

## References

- [MEW Protocol Specification v0.3](../spec/v0.3/SPEC.md)
- [MCP Specification](https://modelcontextprotocol.org)
### Chat Message Response Strategy

MEWAgent implements a selective response pattern for chat messages to avoid noise while ensuring relevant interactions. The agent decides whether to respond based on multiple factors:

#### Response Decision Criteria

The agent evaluates the following triggers when a chat message is received:

1. **Direct Addressing** (Priority: HIGH)
   - Message is addressed to the agent via the `to` field
   - Agent's name or ID is mentioned in the message text
   - Always responds when directly addressed

2. **Content Relevance** (Priority: MEDIUM) - *Requires LLM Classification*
   - When not directly addressed, agent uses LLM to classify if response is appropriate
   - LLM evaluates:
     - Whether message contains a question
     - Whether message relates to agent's tools/resources
     - Whether agent can meaningfully contribute
   - Response decision based on classification confidence score

3. **Conversation Context** (Priority: LOW) - *LLM-Assisted*
   - Agent uses LLM to evaluate ongoing conversation relevance
   - Considers previous message history in context window
   - Determines if agent has unique value to add to discussion

#### Configuration Options

```typescript
interface ChatResponseConfig {
  autoRespond: boolean;           // Global enable/disable (default: true)
  respondToQuestions: boolean;    // Respond to questions (default: true)
  respondToMentions: boolean;     // Respond when mentioned (default: true)
  respondToDirect: boolean;       // Respond to direct messages (default: true)
  confidenceThreshold: number;    // Min confidence to respond (0-1, default: 0.5)
  contextWindow: number;          // Messages to consider for context (default: 10)
}
```

#### Response Flow

```
Chat Message Received
        ↓
Is it from self? → Yes → Ignore
        ↓ No
Is autoRespond enabled? → No → Ignore
        ↓ Yes
Is it directly addressed? → Yes → Respond
        ↓ No
Does it mention agent? → Yes → Respond
        ↓ No
        ↓
[LLM Classification Call]
"Should I respond to this message?"
- Analyze message content
- Check relevance to my tools
- Evaluate if I can help
        ↓
Confidence > threshold? → Yes → Respond
        ↓ No
      Ignore
```

#### LLM Classification Prompt

When not directly addressed, the agent uses an LLM call with a prompt like:

```typescript
const classificationPrompt = `
You are an AI agent with the following tools: ${agent.tools}
A message was sent in the conversation: "${message.text}"

Should you respond to this message?
Consider:
1. Is this a question you can answer?
2. Does it relate to your tools or capabilities?
3. Can you provide unique value by responding?

Return a JSON object:
{
  "shouldRespond": boolean,
  "confidence": number (0-1),
  "reason": string
}
`;
```

#### Implementation Notes

- Agents SHOULD implement rate limiting to avoid chat spam
- Agents SHOULD track conversation context to avoid redundant responses
- Agents MAY use LLM to determine response relevance
- Agents MUST respect the `autoRespond` configuration flag
- Multiple agents SHOULD coordinate to avoid duplicate responses

## References

- [TypeScript SDK Documentation](../typescript-sdk/README.md)
- [Test Scenarios](../tests/README.md)