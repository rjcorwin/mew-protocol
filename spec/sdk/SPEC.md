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

### Stream Support

- Raw WebSocket frames prefixed with `#streamId#` are detected automatically
- The client emits `stream/data` and `stream/data/<streamId>` events carrying `{ streamId, payload }`
- `sendStreamData(streamId, payload)` writes framed chunks back to the gateway
- Envelope-based stream negotiations (`stream/request`, `stream/open`, `stream/close`) continue to flow through the standard
  `message` event pipeline

### Participant Join Flow and Tool Discovery

When a participant joins a space, the following sequence occurs:

1. **Welcome Message**: Upon connection, the participant receives a `system/welcome` message containing:
   - Their own participant ID and capabilities
   - List of all current participants with their IDs and capabilities

2. **Initial Tool Discovery**: After processing the welcome message:
   - The participant examines each listed participant's capabilities
   - For any participant with `mcp/response` capability (can respond to MCP requests):
     - Schedule a `tools/list` request to discover their tools
     - Use staggered delays to avoid network storms (e.g., 3-5 seconds per participant)

3. **Presence Events**: When new participants join after initial connection:
   - Receive `system/presence` event with `event: "join"`
   - Check if the new participant has `mcp/response` capability
   - If yes, schedule tool discovery for that participant

4. **Persistent Discovery**: For robust operation, participants should:
   - Retry failed discovery attempts with exponential backoff
   - Cache successful discoveries with TTL (time-to-live)
   - Periodically refresh tool lists from long-running participants
   - Handle participants that take time to initialize (e.g., bridges starting MCP servers)

5. **Tool Discovery Failure Handling**:
   - If discovery times out, retry up to 3 times with increasing delays
   - Log warnings but don't fail - participant may not have tools
   - Continue operation with available tools from successful discoveries

Example flow:
```typescript
// On welcome, discover tools from all capable participants
onWelcome(async (data) => {
  for (const participant of data.participants) {
    if (participant.capabilities?.some(c => c.kind === 'mcp/response')) {
      // Schedule discovery with delay to avoid storms
      setTimeout(() => this.discoverToolsWithRetry(participant.id), 3000);
    }
  }
});

// Persistent discovery with retry
async discoverToolsWithRetry(participantId: string, attempt = 1): Promise<void> {
  try {
    await this.discoverTools(participantId);
  } catch (error) {
    if (attempt < 3) {
      const delay = attempt * 5000; // 5s, 10s, 15s
      setTimeout(() => this.discoverToolsWithRetry(participantId, attempt + 1), delay);
    }
  }
}
```

## Layer 2: MEWParticipant

### Purpose
Provides protocol-aware participant functionality with MCP support, tool/resource management, and capability-based routing.

### Responsibilities
- **MCP Protocol**: Handle MCP requests and responses
- **Tool Management**: Register and execute own tools (respond to tools/list and tools/call)
- **Resource Management**: Register and serve own resources
- **Tool Discovery**: Discover and cache tools from other participants
- **Capability Checking**: Validate operations against capabilities
- **Smart Routing**: Route requests via direct send or proposals
- **Request Tracking**: Track pending requests with timeouts
- **Tool Invocation**: Send tools/call requests to other participants (if has capability)
- **Chat Control**: Track pending acknowledgements and emit chat/acknowledge or chat/cancel
- **Participant Controls**: Enforce pause/resume/forget/clear/restart/shutdown envelopes with local state
- **Telemetry Reporting**: Maintain context usage counters and send participant/status updates
- **Stream Negotiation**: Request, accept, and monitor stream sessions alongside raw frame routing

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
  
  // Tool Discovery
  discoverTools(participantId: string): Promise<Tool[]>;
  getAvailableTools(): Tool[];
  enableAutoDiscovery(): void;
  
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
  onParticipantJoin(handler: (participant: any) => void): () => void;
  
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

#### Tool Discovery and State Management
MEWParticipant provides sophisticated tool discovery with state tracking:

```typescript
// Discovery state tracking
enum DiscoveryState {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  NO_TOOLS = 'no_tools'  // Participant has no tools
}

interface ParticipantDiscoveryStatus {
  state: DiscoveryState;
  lastAttempt?: Date;
  attempts: number;
  hasTools: boolean;
}

// Discovered tools stored by participant
discoveredTools: Map<string, Tool[]>;
participantDiscoveryStatus: Map<string, ParticipantDiscoveryStatus>;

// Tool cache with TTL
toolCache: {
  participant: string;
  tools: Tool[];
  timestamp: number;
  ttl: number;
}[];
```

**Key Features:**
- **State Tracking**: Track discovery state for each participant separately
- **Distinguish No Tools vs Failed**: Know if participant has no tools vs discovery failed
- **Auto-discovery**: Automatically discover tools when participants join (opt-in)
- **Manual discovery**: Explicitly discover tools from specific participants
- **Caching**: Cache discovered tools with configurable TTL
- **Unified access**: All discovered tools available through `getAvailableTools()`
- **Wait for Discoveries**: Can wait for pending discoveries before proceeding

**Discovery State Management Methods:**
```typescript
// Check if any discoveries are in progress
hasDiscoveriesInProgress(): boolean;

// Wait for pending discoveries (useful before reasoning)
await waitForPendingDiscoveries(maxWaitMs: number);

// Get discovery status for all participants
getDiscoveryStatus(): Map<string, ParticipantDiscoveryStatus>;

// Get participants not yet discovered
getUndiscoveredParticipants(): string[];
```

**Example usage:**
```typescript
// Human interface can discover tools
class HumanInterface extends MEWParticipant {
  async onReady() {
    // Enable automatic discovery
    this.enableAutoDiscovery();

    // Or manually discover
    await this.discoverTools('calculator-service');

    // Get all available tools
    const tools = this.getAvailableTools();
    this.ui.showTools(tools);
  }
}
```

#### Chat Acknowledgement Helpers

- `acknowledgeChat(messageId, target, status?)` wraps `chat/acknowledge` envelopes for UIs that track pending chat work
- `cancelChat(messageId, target?, reason?)` emits `chat/cancel` to clear stale tasks (used by the CLI `/cancel` command)
- Incoming `chat` messages automatically update context usage counters so telemetry stays accurate

#### Participant Control Lifecycle

- Pause envelopes update internal `pauseState`; non-exempt outbound traffic throws until resumed or timeout expires
- Resume clears the pause and automatically publishes a `participant/status` update noting the transition
- Forget, clear, restart, and shutdown envelopes call overridable hooks (`onForget`, `onClear`, `onRestart`, `onShutdown`)
  so subclasses can drop scratchpads or reload models before the SDK reports completion
- `requestParticipantStatus(target, fields?)` sends `participant/request-status`, while `reportStatus()` broadcasts current
  telemetry (tokens, max tokens, `messages_in_context`, optional status string)

#### Context Usage & Status Telemetry

- `recordContextUsage({ tokens, messages })` updates running totals used for status reports and threshold monitoring
- `buildStatusPayload(status?)` centralizes construction of compliant telemetry payloads (always including
  `messages_in_context`)
- When usage crosses the configured soft limit (90% by default) the SDK emits proactive `participant/status` messages so
  orchestrators can intervene before truncation occurs
- Autonomous compaction (triggered by forget/clear hooks) updates counters and publishes follow-up telemetry indicating how
  much headroom was reclaimed

#### Stream Lifecycle Helpers

- `requestStream(payload, target?)` sends `stream/request` and tracks pending negotiations until `stream/open` arrives
- Active streams are recorded with metadata (description, open envelope ID, last activity) to aid CLI visualizations
- The participant listens for `stream/open`/`stream/close` to keep bookkeeping accurate and leverages the client’s
  `sendStreamData`/`onStreamData` APIs for raw frame transfer
- Reasoning workflows can call `requestStream` when emitting `reasoning/start` so observers can subscribe to high-volume
  traces without polluting the envelope log

## Layer 3: MEWAgent

### Purpose
Provides autonomous agent functionality with reasoning, tool discovery, and decision-making capabilities.

### Responsibilities
- **Autonomous Behavior**: Optional ReAct pattern (Reason+Act loops, can be disabled for reasoning models)
- **Tool Selection**: Select appropriate tools using LLM reasoning
- **Tool Orchestration**: Call tools from other participants via tools/call or proposals
- **Reasoning Transparency**: Emit reasoning events
- **Message Handling**: Process chat and requests autonomously
- **LLM Tool Preparation**: Format discovered tools for LLM consumption
- **Dynamic Tool Use**: Use discovered tools without hardcoding
- **Own Tools**: Can also register own tools (inherited from MEWParticipant)

### Interface

```typescript
interface AgentConfig extends ParticipantOptions {
  name?: string;
  systemPrompt?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;  // Custom OpenAI API base URL (for alternative providers)
  reasoningEnabled?: boolean;  // Emit reasoning events (reasoning/start, reasoning/thought, reasoning/conclusion)
  autoRespond?: boolean;
  maxIterations?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  reasoningFormat?: 'native' | 'scratchpad';  // How to format previous thoughts for LLM (default: 'native')
  conversationHistoryLength?: number;  // Number of previous messages to include in context (default: 0)
  
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

#### Tool Preparation and Namespacing
Agents prepare discovered tools (from parent MEWParticipant) for LLM consumption using hierarchical namespace notation (per ADR-mpt):

1. Get discovered tools from parent's `getAvailableTools()`
2. Format tools with participant attribution
3. Present tools to LLM using `participant/tool` notation

```typescript
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

**Important Restriction**: Participant IDs MUST NOT contain underscores (`_`) as the SDK converts slashes to underscores for OpenAI API compatibility. Use hyphens (`-`) instead (e.g., `weather-service`, not `weather_service`).

#### Streaming Reasoning Transparency

- When `reasoning/start` is emitted the agent automatically requests an upload stream (if permitted) so observers can subscribe
  to high-volume traces without polluting the envelope log
- `reasoning/thought` payloads are mirrored into the active stream when one is open
- `stream/open`/`stream/close` messages update local bookkeeping so downstream UIs (CLI) know which stream IDs to display

#### Reasoning Cancellation Awareness

- Incoming `reasoning/cancel` envelopes matching the current context flip `reasoningCancelled` so additional thoughts stop
- Stream channels are closed when cancellation arrives, ensuring consumers do not receive stale data
- `/reason-cancel` commands from the CLI feed through `MEWParticipant.reasoning/cancel`, keeping SDK and UI semantics aligned

#### Automatic Context Compaction

- `ensureContextHeadroom()` monitors soft token limits and trims conversation history to maintain a 30% buffer before hard
  limits are reached
- Forget and clear directives reuse the participant-level hooks but also purge agent-specific caches like
  `conversationHistory` and active reasoning IDs
- Every compaction publishes `participant/status` updates so orchestrators understand why history changed

#### ReAct Loop

The ReAct (Reason + Act) loop is the core decision-making pattern for autonomous agents. This section details the complete flow including LLM calls, MEW Protocol messages, and response formation.

##### Tool Discovery Synchronization

Before starting the ReAct loop, agents SHOULD wait for pending tool discoveries to complete:

```typescript
// In the reason phase, before first iteration
if (previousThoughts.length === 0 && this.hasDiscoveriesInProgress()) {
  // Wait up to 5 seconds for discoveries to complete
  await this.waitForPendingDiscoveries(5000);

  // Check if we got new tools after waiting
  const tools = this.getAvailableTools();
  if (tools.length > 0) {
    log(`Tool discovery completed. ${tools.length} tools available.`);
  }
}
```

This ensures the agent has the most complete set of tools before reasoning, avoiding situations where it claims "no tools available" when tools are actually being discovered.

##### Data Structures

```typescript
interface Thought {
  reasoning: string;     // Analysis of the current situation
  action: string;        // Next action to take: "tool_call", "respond", or "continue"
  actionInput: any;      // Parameters for the action
  observation?: string;  // Result of the action (filled after execution)
}

interface ReActContext {
  originalEnvelope: Envelope;  // The triggering message
  thoughts: Thought[];          // Accumulated reasoning chain
  iteration: number;            // Current iteration count
  finalResponse?: string;       // Final response to send
}
```

##### Complete ReAct Flow

###### Step 1: Message Reception

When a chat message or MCP request arrives:

```typescript
// Incoming MEW Protocol envelope
{
  "protocol": "mew/v0.4",
  "id": "msg-123",
  "from": "user",
  "to": ["agent"],
  "kind": "chat",
  "payload": {
    "text": "What's the weather in Tokyo and calculate 15% tip on $85?"
  }
}
```

###### Step 2: Reasoning Start (MEW Protocol Message)

If `reasoningEnabled: true`, emit reasoning start:

```typescript
// Agent sends reasoning/start message
{
  "protocol": "mew/v0.4",
  "id": "reason-001",
  "from": "agent",
  "kind": "reasoning/start",
  "correlation_id": ["msg-123"],
  "payload": {
    "message": "Processing request about weather and tip calculation"
  }
}
```

###### Step 3: ReAct Iterations

The agent enters the ReAct loop (maximum `maxIterations` times):

**Iteration 1 - First LLM Call (Reasoning)**

```typescript
// LLM Call #1: Reasoning about the request
const reasoningPrompt = `
You are an AI assistant with access to these tools:
${JSON.stringify(llmTools, null, 2)}

User request: "What's the weather in Tokyo and calculate 15% tip on $85?"

Previous thoughts: []

Analyze this request and decide your next action.
Return a JSON object with:
{
  "reasoning": "your analysis",
  "action": "tool_call" | "respond" | "continue",
  "actionInput": {
    "tool": "tool_name" (if action is tool_call),
    "arguments": {...} (if action is tool_call),
    "message": "response text" (if action is respond)
  }
}`;

// LLM Response
{
  "reasoning": "The user needs two things: weather information for Tokyo and a tip calculation. I should handle these sequentially. First, I'll get the weather for Tokyo.",
  "action": "tool_call",
  "actionInput": {
    "tool": "weather-service/get_weather", // weather-service is the Participant ID, get_weather is the tool
    "arguments": {"city": "Tokyo"}
  }
}
```

**MEW Protocol Message - Reasoning Thought**

```typescript
// Agent emits reasoning/thought
{
  "protocol": "mew/v0.4",
  "id": "thought-001",
  "from": "agent",
  "kind": "reasoning/thought",
  "context": "reason-001",
  "payload": {
    "message": "The user needs weather info and tip calculation. Getting Tokyo weather first." // from reasoning
  }
}
```

**Tool Execution - MEW Protocol Messages**

```typescript
// Agent sends MCP request (or proposal if lacking capability)
{
  "protocol": "mew/v0.4",
  "id": "req-001",
  "from": "agent",
  "to": ["weather-service"],
  "kind": "mcp/request",  // or "mcp/proposal"
  "correlation_id": ["reason-001"],
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_weather",
      "arguments": {"city": "Tokyo"}
    }
  }
}

// Tool responds
{
  "protocol": "mew/v0.4",
  "id": "resp-001",
  "from": "weather-service",
  "to": ["agent"],
  "kind": "mcp/response",
  "correlation_id": ["req-001"],
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "content": [{
        "type": "text",
        "text": "Tokyo: 22°C, partly cloudy"
      }]
    }
  }
}
```

**Iteration 2 - Second LLM Call (Continue with tip calculation)**

```typescript
// LLM Call #2: Continue reasoning with observation
const continuationPrompt = `
You are an AI assistant with access to these tools:
${JSON.stringify(llmTools, null, 2)}

User request: "What's the weather in Tokyo and calculate 15% tip on $85?"

Previous thoughts:
1. Reasoning: "The user needs two things: weather information for Tokyo and a tip calculation. I should handle these sequentially. First, I'll get the weather for Tokyo."
   Action: tool_call (weather-service/get_weather)
   Observation: "Tokyo: 22°C, partly cloudy"

Continue processing this request.
Return a JSON object with:
{
  "reasoning": "your analysis",
  "action": "tool_call" | "respond" | "continue",
  "actionInput": {...}
}`;

// LLM Response
{
  "reasoning": "I've got the Tokyo weather. Now I need to calculate the 15% tip on $85. 15% of 85 is 12.75.",
  "action": "tool_call",
  "actionInput": {
    "tool": "calculator/multiply",
    "arguments": {"a": 85, "b": 0.15}
  }
}
```

**More MEW Protocol Messages for second tool call...**

```typescript
// Another reasoning/thought
{
  "protocol": "mew/v0.4",
  "id": "thought-002",
  "from": "agent",
  "kind": "reasoning/thought",
  "context": "reason-001",
  "payload": {
    "message": "Got Tokyo weather. Now calculating 15% tip on $85."
  }
}

// Another MCP request/response cycle...
```

###### Step 4: Final Response Formation

**Final LLM Call - Response Generation**

```typescript
// LLM Call #3: Generate final response
const responsePrompt = `
You are an AI assistant. You've gathered the following information:

User request: "What's the weather in Tokyo and calculate 15% tip on $85?"

Information gathered:
1. Tokyo weather: "Tokyo: 22°C, partly cloudy"
2. Tip calculation: 15% of $85 = $12.75

Generate a natural, helpful response to the user.`;

// LLM Response
"The weather in Tokyo is currently 22°C (72°F) with partly cloudy skies. 

For your tip calculation: 15% of $85 is $12.75, making your total $97.75."
```

###### Step 5: Reasoning Conclusion (MEW Protocol Message)

```typescript
// Agent sends reasoning/conclusion
{
  "protocol": "mew/v0.4",
  "id": "reason-end-001",
  "from": "agent",
  "kind": "reasoning/conclusion",
  "context": "reason-001",
  "payload": {
    "message": "Successfully retrieved weather data and calculated tip. Ready to respond."
  }
}
```

###### Step 6: Final Chat Response (MEW Protocol Message)

```typescript
// Agent sends final response
{
  "protocol": "mew/v0.4",
  "id": "response-001",
  "from": "agent",
  "to": ["user"],
  "kind": "chat",
  "correlation_id": ["msg-123"],
  "payload": {
    "text": "The weather in Tokyo is currently 22°C (72°F) with partly cloudy skies.\n\nFor your tip calculation: 15% of $85 is $12.75, making your total $97.75."
  }
}
```

##### Loop Termination Conditions

The ReAct loop ends when:
1. **Action is "respond"**: LLM decides to send final response
2. **Max iterations reached**: Prevents infinite loops (typically 5-10)
3. **Error occurs**: Tool call fails or timeout
4. **No more actions needed**: Task completed

##### Error Handling in ReAct Loop

```typescript
try {
  // Execute tool call
  const result = await this.mcpRequest(target, payload);
  thought.observation = result;
} catch (error) {
  // On error, add observation and let LLM decide next action
  thought.observation = `Error: ${error.message}`;
  
  // LLM might retry, use different tool, or respond with error info
  // Next iteration will include this error in context
}
```


##### Reasoning Format Options

The agent supports two formats for providing context to the LLM during ReAct iterations:

###### Native Format (`reasoningFormat: 'native'`)
Uses OpenAI's standard message format with proper role designations:

```typescript
// Previous tool call represented as:
{
  role: 'assistant',
  content: 'Let me check the weather in Tokyo',
  tool_calls: [{
    id: 'call_abc123',
    type: 'function',
    function: {
      name: 'weather_service_get_weather',
      arguments: '{"city": "Tokyo"}'
    }
  }]
}

// Tool result represented as:
{
  role: 'tool',
  tool_call_id: 'call_abc123',
  content: 'Tokyo: 22°C, partly cloudy'
}
```

Benefits:
- LLM sees tool calls in the expected format
- Better context understanding for models trained on this format
- Maintains proper correlation between calls and results

###### Scratchpad Format (`reasoningFormat: 'scratchpad'`)
Builds a text-based context summary:

```typescript
{
  role: 'assistant',
  content: `Previous actions and observations:

Reasoning: The user needs weather information for Tokyo
Action: tool
Tool used: weather-service/get_weather
Observation: Tokyo: 22°C, partly cloudy

Based on the above context, continue processing the user's request.`
}
```

Benefits:
- More human-readable format
- Works with models that may not support tool calling
- Easier to debug and understand

##### Conversation History

The `conversationHistoryLength` configuration controls how much conversation context is included:

```typescript
const agent = new MEWAgent({
  conversationHistoryLength: 10,  // Include last 10 messages
  // 0 = only current request (default)
  // -1 could mean all history (not implemented)
});
```

When set, the agent includes previous user/assistant exchanges in the LLM context, enabling:
- Multi-turn conversations with context
- Reference to earlier topics
- More coherent long-form interactions

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
// 1. Agent gets discovered tools from parent and prepares for LLM
const tools = this.getAvailableTools(); // From MEWParticipant
const llmTools = this.prepareLLMTools(tools);
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
- Tool discovery and caching from other participants
- Calling other participants' tools (via tools/call)
- Request/response correlation
- Proposal patterns
- Participant join/leave tracking

**NOT Concerns:**
- Transport details
- Autonomous behavior
- Reasoning patterns
- LLM-specific tool selection strategies
- Natural language to tool mapping

### MEWAgent (Application Layer)
**Concerns:**
- Autonomous behavior
- Reasoning and decision-making (ReAct pattern)
- LLM-specific tool selection strategies
- Tool namespace management for LLM (per ADR-tns)
- Converting `participant/tool` calls to MEW envelopes
- Natural language to tool mapping
- Dynamic tool orchestration across participants
- Multi-step workflows
- Natural language understanding
- Own tools (via inheritance from MEWParticipant)

**NOT Concerns:**
- Protocol details
- Connection management
- Low-level message handling
- Direct tool discovery (uses parent's discovery)
- Tool caching (handled by parent)

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
- MEW Protocol v0.4
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

- [MEW Protocol Specification v0.4](../spec/v0.4/SPEC.md)
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