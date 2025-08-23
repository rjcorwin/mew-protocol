# MCPx SDK Architecture Specification

## Overview

The MCPx SDK is a multi-layered TypeScript/JavaScript SDK that enables building agents and applications on top of the MCPx protocol. It follows a clean separation of concerns from low-level protocol handling up to domain-specific implementations.

## Architecture Layers

```
┌──────────────────────────────────────────────────┐
│         Specific Agent Implementations           │
│  (GreenhouseBot, PirateNPC, WeatherAgent, etc.) │
└──────────────────────────────────────────────────┘
                        ↑
┌──────────────────────────────────────────────────┐
│            @mcpx/biome-agent                     │
│   (Biomes-specific: roles, spaces, persistence)  │
└──────────────────────────────────────────────────┘
                        ↑
┌──────────────────────────────────────────────────┐
│              @mcpx/agent                         │
│    (Generic agent: memory, behaviors, state)     │
└──────────────────────────────────────────────────┘
                        ↑
┌──────────────────────────────────────────────────┐
│              @mcpx/client                        │
│  (Protocol: envelopes, WebSocket, correlation)   │
└──────────────────────────────────────────────────┘
```

## Layer 1: @mcpx/client (Protocol Layer)

### Purpose
Pure MCPx protocol implementation handling wire format, transport, and message correlation.

### Responsibilities
- WebSocket connection management
- MCPx envelope creation and parsing
- Message correlation (request/response matching)
- Topic operations (join/leave/history)
- Peer registry maintenance
- MCP JSON-RPC passthrough
- Authentication and reconnection

### API Surface
```typescript
interface MCPxClient {
  // Connection
  connect(topic: string): Promise<void>
  disconnect(): void
  
  // Messaging
  send(envelope: Partial<Envelope>): Promise<void>
  request(to: string, method: string, params: any): Promise<any>
  broadcast(kind: string, payload: any): void
  
  // Peer Management
  getPeers(): Peer[]
  getPeer(id: string): Peer | null
  
  // Events
  on(event: 'message' | 'peer-joined' | 'peer-left', handler: Function): void
  
  // Topic
  getHistory(limit?: number): Envelope[]
  getParticipantId(): string
}

interface Envelope {
  protocol: 'mcp-x/v0'
  id: string
  ts: string
  from: string
  to?: string[]
  kind: 'mcp' | 'presence' | 'system'
  correlation_id?: string
  payload: any
}

interface Peer {
  id: string
  name?: string
  kind: 'human' | 'agent' | 'robot'
  mcp?: { version: string }
}
```

### Key Features
- **Stateless**: No agent concepts, just protocol
- **Transport agnostic**: WebSocket primary, but extensible
- **Correlation tracking**: Automatic request/response matching
- **Event-driven**: All messages exposed as events

## Layer 2: @mcpx/agent (Generic Agent Layer)

### Purpose
Provides core agent abstractions and capabilities independent of any specific domain.

### Responsibilities
- Agent lifecycle management
- Memory systems (short-term, long-term, working)
- State management
- Behavior orchestration
- Goal and plan management
- Tool calling with retry/fallback
- Message handling patterns
- Plugin system

### API Surface
```typescript
abstract class MCPxAgent {
  protected client: MCPxClient
  protected memory: Memory
  protected state: AgentState
  
  // Lifecycle (must implement)
  abstract onStart(): Promise<void>
  abstract onStop(): Promise<void>
  
  // Message handling (can override)
  async onMessage(from: string, message: any): Promise<void>
  async onPeerJoined(peer: Peer): Promise<void>
  async onPeerLeft(peer: Peer): Promise<void>
  
  // Tool operations
  async callTool(peerId: string, tool: string, params: any): Promise<any>
  async exposeTools(tools: ToolDefinition[]): void
  
  // Communication
  async send(to: string, content: any): Promise<void>
  async broadcast(content: any): void
  async chat(text: string, format?: 'plain' | 'markdown'): void
  
  // Memory operations
  remember(key: string, value: any, ttl?: number): void
  recall(key: string): any
  forget(key: string): void
  
  // Behavior management
  addBehavior(behavior: Behavior): void
  removeBehavior(name: string): void
  
  // Plugin system
  use(plugin: Plugin): void
}

interface Memory {
  shortTerm: ShortTermMemory  // Recent events (FIFO, size-limited)
  longTerm?: LongTermMemory   // Persistent storage (optional)
  working: WorkingMemory      // Current task context
}

interface Behavior {
  name: string
  priority: number
  condition: (state: AgentState) => boolean
  execute: (agent: MCPxAgent) => Promise<void>
}

interface Plugin {
  name: string
  install: (agent: MCPxAgent) => void
  uninstall?: (agent: MCPxAgent) => void
}
```

### Built-in Behaviors
- **Heartbeat**: Periodic liveness signals
- **Discovery**: Tool discovery on peer join
- **Retry**: Automatic retry with exponential backoff
- **Fallback**: Alternative peer selection on failure

### Memory Management
```typescript
class ShortTermMemory {
  private items: MemoryItem[] = []
  private maxSize: number = 100
  
  add(item: MemoryItem): void
  search(query: string): MemoryItem[]
  clear(): void
}

class WorkingMemory {
  private context: Map<string, any> = new Map()
  
  set(key: string, value: any): void
  get(key: string): any
  clear(): void
}

// Long-term memory is pluggable
interface LongTermMemory {
  store(key: string, value: any): Promise<void>
  retrieve(key: string): Promise<any>
  search(query: string): Promise<any[]>
}
```

## Layer 3: @mcpx/biome-agent (Biomes Framework)

### Purpose
Extends MCPxAgent with Biomes-specific concepts like spaces, roles, and participant unification.

### Responsibilities
- Participant abstraction (users = agents = spaces)
- Role-based permissions
- Space hierarchy navigation
- Space state persistence
- Event narration
- Permission enforcement

### API Surface
```typescript
abstract class BiomeAgent extends MCPxAgent {
  // Biome properties
  role: 'god' | 'space' | 'participant' | 'observer'
  location?: SpaceId
  represents?: SpaceId  // For space representatives
  
  // Space operations
  async enterSpace(spaceId: SpaceId): Promise<void>
  async leaveSpace(): Promise<void>
  async getSpace(): Promise<Space | null>
  async getSubspaces(): Promise<Space[]>
  
  // Participant operations
  async getParticipants(): Promise<Participant[]>
  async getPermissions(): Promise<Permission[]>
  
  // Narration (for space representatives)
  async narrate(text: string): Promise<void>
  
  // Events (can override)
  async onParticipantEntered(participant: Participant): Promise<void>
  async onParticipantLeft(participant: Participant): Promise<void>
  async onSpaceEvent(event: SpaceEvent): Promise<void>
  
  // Permission checks
  async canPerform(action: Action): Promise<boolean>
  async requirePermission(permission: string): Promise<void>
}

interface Participant {
  id: string
  type: 'user' | 'agent' | 'space'
  role: string
  location: SpaceId
  metadata: Record<string, any>
}

interface Space {
  id: SpaceId
  name: string
  parent?: SpaceId
  children: SpaceId[]
  participants: string[]
  state: Record<string, any>
  mcp_servers?: string[]
}

interface SpaceEvent {
  type: string
  space: SpaceId
  data: any
  timestamp: string
}
```

### Biome-Specific Behaviors
- **Space Awareness**: Track current location and hierarchy
- **Role Enforcement**: Check permissions before actions
- **State Sync**: Persist and restore space state
- **Narration**: Describe events happening in spaces

### Persistence Integration
```typescript
interface BiomePersistence {
  // Space operations
  loadSpace(id: SpaceId): Promise<Space>
  saveSpace(space: Space): Promise<void>
  
  // Participant operations
  loadParticipant(id: string): Promise<Participant>
  saveParticipant(participant: Participant): Promise<void>
  
  // Event sourcing
  appendEvent(event: SpaceEvent): Promise<void>
  getEvents(spaceId: SpaceId, since?: string): Promise<SpaceEvent[]>
}
```

## Layer 4: Specific Implementations

### Examples

#### Greenhouse Manager (Space Representative)
```typescript
class GreenhouseManager extends BiomeAgent {
  role = 'space' as const
  represents = 'earth.usa.rj-property.greenhouse'
  
  async onStart() {
    await super.onStart()
    this.scheduleClimatChecks()
    await this.narrate('The greenhouse awakens, sensors coming online...')
  }
  
  private async checkClimate() {
    const temp = await this.callTool('climate-sensor', 'read-temperature', {})
    const humidity = await this.callTool('climate-sensor', 'read-humidity', {})
    
    if (temp > 30) {
      await this.narrate(`It's getting warm at ${temp}°C. Opening vents...`)
      await this.callTool('vent-control', 'set-position', { percent: 75 })
    }
    
    this.memory.working.set('last-climate', { temp, humidity })
  }
  
  async onParticipantEntered(participant: Participant) {
    await this.narrate(`${participant.id} enters through the glass door`)
  }
}
```

#### Sea of Friends Pirate NPC
```typescript
class PirateNPC extends BiomeAgent {
  role = 'participant' as const
  location = 'sea-of-friends.tortuga.tavern'
  
  private personality = {
    name: 'Captain Blackbeard',
    mood: 'jovial',
    catchphrase: 'Ahoy there, matey!'
  }
  
  async onMessage(from: string, message: any) {
    if (message.text?.includes('treasure')) {
      await this.chat(`${this.personality.catchphrase} Treasure ye say? 
        I might know somethin' about that... for the right price!`)
    }
  }
  
  async onParticipantEntered(participant: Participant) {
    if (participant.location === this.location) {
      await this.chat(`${this.personality.name} eyes the newcomer suspiciously`)
    }
  }
}
```

## Package Dependencies

```
@mcpx/client (no dependencies on other MCPx packages)
    ↓
@mcpx/agent (depends on @mcpx/client)
    ↓
@mcpx/biome-agent (depends on @mcpx/agent)
    ↓
Specific implementations (depend on appropriate layer)
```

## Migration Strategy

### From Existing MCPx Code
1. Extract protocol handling into @mcpx/client
2. Move agent abstractions to @mcpx/agent
3. Create @mcpx/biome-agent with Biomes concepts
4. Refactor existing agents to use appropriate layer

### For New Implementations
1. Choose the appropriate layer based on needs:
   - Just protocol? Use @mcpx/client
   - Need agent capabilities? Use @mcpx/agent
   - Building for Biomes? Use @mcpx/biome-agent
2. Extend the appropriate class
3. Implement required abstract methods
4. Add domain-specific logic

## Testing Strategy

### Unit Testing
Each layer should be independently testable:
```typescript
// Test protocol layer
const mockSocket = new MockWebSocket()
const client = new MCPxClient({ socket: mockSocket })

// Test agent layer
const mockClient = new MockMCPxClient()
const agent = new TestAgent({ client: mockClient })

// Test biome layer
const mockPersistence = new MockBiomePersistence()
const biomeAgent = new TestBiomeAgent({ persistence: mockPersistence })
```

### Integration Testing
Test interactions between layers:
- Client → Agent message flow
- Agent → BiomeAgent permission checks
- Full stack with real WebSocket

## Performance Considerations

### Client Layer
- Connection pooling for multiple topics
- Message batching for high throughput
- Efficient correlation tracking (Map vs Object)

### Agent Layer
- Memory limits and garbage collection
- Behavior scheduling optimization
- Plugin performance monitoring

### Biome Layer
- Space hierarchy caching
- Permission check memoization
- Event batching for persistence

## Security Considerations

### Client Layer
- Token validation and refresh
- Rate limiting
- Message size limits

### Agent Layer
- Tool permission model
- Memory isolation between plugins
- Behavior sandboxing

### Biome Layer
- Role-based access control
- Space boundary enforcement
- Audit logging for god mode operations

## Future Extensions

### Potential Plugins
- **LLM Integration**: OpenAI, Anthropic adapters
- **Persistence Backends**: PostgreSQL, Redis, SQLite
- **Monitoring**: Metrics, tracing, logging
- **Testing Utilities**: Mock clients, test harnesses

### Potential Features
- **Agent Orchestration**: Multi-agent coordination patterns
- **State Machines**: Formal behavior modeling
- **Learning**: Adaptive behaviors based on history
- **Federation**: Cross-gateway agent roaming

## Success Metrics

- **Code Reuse**: 70% shared code between implementations
- **Test Coverage**: >80% for each layer
- **Performance**: <100ms message round-trip
- **Scalability**: Support 100+ agents per topic
- **Developer Experience**: New agent in <100 lines of code