# MCPx Agent Client Architecture

## Overview

An MCPx Agent Client is a specialized library that enables AI agents to participate in MCPx topics as full peers. Unlike the bridge (which connects existing MCP servers), the agent client is designed for new agents that are MCPx-native and need to interact with multiple peers dynamically.

## Key Differences from MCP Client

| Aspect | MCP Client | MCPx Agent Client |
|--------|------------|-------------------|
| Peers | Single server | Multiple participants |
| Discovery | Connect to known server | Dynamic peer discovery |
| Tool Calling | Direct invocation | Requires peer targeting |
| Connection | 1:1 relationship | 1:N relationships |
| Protocol | Pure MCP | MCPx envelopes |
| State | Single session | Topic-wide context |

## Proposed Architecture

### Core Components

```
┌─────────────────────────────────────────────┐
│             MCPx Agent Client               │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │         Connection Manager             │ │
│  │  - WebSocket connection to gateway     │ │
│  │  - Authentication & reconnection       │ │
│  │  - Heartbeat management                │ │
│  └────────────────────────────────────────┘ │
│                     │                        │
│  ┌────────────────────────────────────────┐ │
│  │          Peer Registry                 │ │
│  │  - Track active participants           │ │
│  │  - Cache tool capabilities per peer    │ │
│  │  - Monitor peer availability           │ │
│  └────────────────────────────────────────┘ │
│                     │                        │
│  ┌────────────────────────────────────────┐ │
│  │         Tool Invocation Layer          │ │
│  │  - Peer-targeted tool calls            │ │
│  │  - Request/response correlation        │ │
│  │  - Timeout & retry logic               │ │
│  └────────────────────────────────────────┘ │
│                     │                        │
│  ┌────────────────────────────────────────┐ │
│  │          Message Handler               │ │
│  │  - Envelope wrapping/unwrapping        │ │
│  │  - Chat message handling               │ │
│  │  - Event emission                      │ │
│  └────────────────────────────────────────┘ │
│                     │                        │
│  ┌────────────────────────────────────────┐ │
│  │        Agent Interface Layer           │ │
│  │  - High-level API for agents           │ │
│  │  - Tool schema aggregation             │ │
│  │  - Context management                  │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Client API Design

```typescript
interface MCPxAgentClient {
  // Connection Management
  connect(config: MCPxConfig): Promise<void>
  disconnect(): void
  on(event: string, handler: Function): void
  
  // Peer Discovery
  getPeers(): Peer[]
  getPeer(id: string): Peer | null
  waitForPeer(id: string, timeout?: number): Promise<Peer>
  
  // Tool Operations
  listTools(peerId?: string): Tool[]  // All tools or peer-specific
  callTool(peerId: string, tool: string, params: any): Promise<any>
  
  // Batch Operations
  callTools(calls: ToolCall[]): Promise<ToolResult[]>
  
  // Communication
  sendChat(message: string, format?: 'plain' | 'markdown'): void
  broadcast(kind: string, payload: any): void
  sendTo(peerId: string, kind: string, payload: any): void
  
  // Context
  getHistory(limit?: number): Envelope[]
  getContext(): TopicContext
}

interface Peer {
  id: string
  name?: string
  kind: 'human' | 'agent' | 'robot'
  tools: Tool[]
  status: 'online' | 'away' | 'offline'
  lastSeen: Date
  metadata?: Record<string, any>
}

interface Tool {
  peerId: string  // Which peer provides this tool
  name: string
  description?: string
  inputSchema?: JSONSchema
}

interface ToolCall {
  peerId: string
  tool: string
  params: any
  timeout?: number
}
```

## Usage Patterns

### 1. Basic Agent Setup

```typescript
const client = new MCPxAgentClient({
  serverUrl: 'ws://localhost:3000',
  topic: 'room:general',
  participantId: 'weather-agent',
  authToken: 'jwt-token'
})

await client.connect()

// Listen for chat messages
client.on('chat', (message: ChatMessage) => {
  if (message.text.includes('weather')) {
    // Respond to weather queries
    handleWeatherQuery(message)
  }
})

// Listen for direct tool calls
client.on('toolCall', (request: ToolCallRequest) => {
  // Handle incoming tool calls
  return handleToolCall(request)
})
```

### 2. Peer Discovery and Tool Calling

```typescript
// Wait for specific peer
const calendarPeer = await client.waitForPeer('calendar-agent')

// Call a tool on that peer
const events = await client.callTool(
  'calendar-agent',
  'getEvents',
  { date: '2024-01-20' }
)

// Or discover tools dynamically
const allTools = client.listTools()
const weatherTools = allTools.filter(t => 
  t.name.includes('weather') || 
  t.description?.includes('weather')
)

if (weatherTools.length > 0) {
  const result = await client.callTool(
    weatherTools[0].peerId,
    weatherTools[0].name,
    { location: 'San Francisco' }
  )
}
```

### 3. Multi-Peer Coordination

```typescript
// Parallel tool calls to different peers
const results = await client.callTools([
  {
    peerId: 'weather-agent',
    tool: 'getCurrentWeather',
    params: { location: 'NYC' }
  },
  {
    peerId: 'calendar-agent',
    tool: 'findFreeSlots',
    params: { duration: 60 }
  },
  {
    peerId: 'email-agent',
    tool: 'draftEmail',
    params: { subject: 'Meeting Request' }
  }
])

// Process results
const [weather, slots, draft] = results
```

### 4. Reactive Agent Pattern

```typescript
class ReactiveAgent {
  constructor(private client: MCPxAgentClient) {
    this.setupListeners()
  }
  
  setupListeners() {
    // React to new peers joining
    this.client.on('peerJoined', async (peer: Peer) => {
      console.log(`New peer: ${peer.id}`)
      
      // Discover their capabilities
      if (peer.tools.some(t => t.name === 'getCalendar')) {
        // Register this peer as a calendar provider
        this.calendarPeers.add(peer.id)
      }
    })
    
    // React to chat messages
    this.client.on('chat', async (msg: ChatMessage) => {
      const response = await this.processMessage(msg)
      if (response) {
        this.client.sendChat(response)
      }
    })
    
    // Handle tool calls from other peers
    this.client.on('toolCall', async (req: ToolCallRequest) => {
      return this.handleToolCall(req)
    })
  }
}
```

## Integration with LLM Frameworks

### OpenAI Function Calling Integration

```typescript
class OpenAIAgentAdapter {
  constructor(
    private client: MCPxAgentClient,
    private openai: OpenAI
  ) {}
  
  // Convert MCPx tools to OpenAI function schemas
  getOpenAIFunctions(): OpenAIFunction[] {
    const tools = this.client.listTools()
    
    return tools.map(tool => ({
      name: `${tool.peerId}__${tool.name}`, // Encoded peer ID
      description: tool.description,
      parameters: tool.inputSchema
    }))
  }
  
  // Process OpenAI function calls
  async processFunctionCall(call: OpenAIFunctionCall) {
    // Extract peer ID and tool name
    const [peerId, ...toolParts] = call.name.split('__')
    const toolName = toolParts.join('__')
    
    // Make the actual call
    return await this.client.callTool(
      peerId,
      toolName,
      JSON.parse(call.arguments)
    )
  }
}
```

### LangChain Integration

```typescript
class MCPxToolkit implements LangChainToolkit {
  constructor(private client: MCPxAgentClient) {}
  
  getTools(): LangChainTool[] {
    return this.client.listTools().map(tool => 
      new MCPxLangChainTool(this.client, tool)
    )
  }
}

class MCPxLangChainTool implements LangChainTool {
  constructor(
    private client: MCPxAgentClient,
    private tool: Tool
  ) {}
  
  get name() {
    return `${this.tool.peerId}:${this.tool.name}`
  }
  
  async call(input: any) {
    return await this.client.callTool(
      this.tool.peerId,
      this.tool.name,
      input
    )
  }
}
```

## State Management

### Topic Context

The client maintains a view of the topic state:

```typescript
interface TopicContext {
  topic: string
  participants: Map<string, Peer>
  messageHistory: Envelope[]
  myTools: Tool[]  // Tools this agent exposes
  availableTools: Map<string, Tool[]>  // Tools by peer
  pendingRequests: Map<string, PendingRequest>
}

interface PendingRequest {
  envelope: Envelope
  timer: NodeJS.Timeout
  resolve: Function
  reject: Function
}
```

### Peer Availability Tracking

```typescript
class PeerTracker {
  private peers = new Map<string, PeerState>()
  
  updatePeer(peer: Peer, event: 'join' | 'leave' | 'heartbeat') {
    const state = this.peers.get(peer.id) || { 
      peer, 
      status: 'online',
      lastSeen: new Date(),
      reliability: 1.0
    }
    
    switch(event) {
      case 'join':
        state.status = 'online'
        state.lastSeen = new Date()
        break
      case 'leave':
        state.status = 'offline'
        break
      case 'heartbeat':
        state.lastSeen = new Date()
        break
    }
    
    this.peers.set(peer.id, state)
  }
  
  getBestPeerForTool(toolName: string): string | null {
    const candidates = Array.from(this.peers.values())
      .filter(s => 
        s.status === 'online' && 
        s.peer.tools.some(t => t.name === toolName)
      )
      .sort((a, b) => b.reliability - a.reliability)
    
    return candidates[0]?.peer.id || null
  }
}
```

## Error Handling

### Retry Logic

```typescript
class RetryableToolCall {
  async callWithRetry(
    client: MCPxAgentClient,
    peerId: string,
    tool: string,
    params: any,
    options: RetryOptions = {}
  ) {
    const { 
      maxRetries = 3, 
      timeout = 30000,
      backoff = 1000 
    } = options
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await client.callTool(peerId, tool, params)
      } catch (error) {
        if (error.code === 'PEER_OFFLINE') {
          // Try to find alternative peer
          const altPeer = this.findAlternativePeer(tool)
          if (altPeer) {
            peerId = altPeer
            continue
          }
        }
        
        if (attempt === maxRetries - 1) throw error
        
        await this.wait(backoff * Math.pow(2, attempt))
      }
    }
  }
}
```

### Graceful Degradation

```typescript
class ResilientAgent {
  async executeTask(task: Task) {
    try {
      // Try primary approach
      return await this.executePrimary(task)
    } catch (error) {
      console.warn('Primary failed, trying fallback', error)
      
      try {
        // Try fallback approach
        return await this.executeFallback(task)
      } catch (fallbackError) {
        console.warn('Fallback failed, using local', fallbackError)
        
        // Use local capabilities
        return await this.executeLocal(task)
      }
    }
  }
}
```

## Performance Considerations

### Tool Call Batching

```typescript
class BatchedToolCaller {
  private queue: ToolCall[] = []
  private timer: NodeJS.Timeout | null = null
  
  async call(peerId: string, tool: string, params: any) {
    return new Promise((resolve, reject) => {
      this.queue.push({ 
        peerId, 
        tool, 
        params,
        resolve,
        reject 
      })
      
      if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), 10)
      }
    })
  }
  
  private async flush() {
    const batch = this.queue.splice(0)
    this.timer = null
    
    // Group by peer for efficiency
    const byPeer = this.groupByPeer(batch)
    
    // Execute in parallel by peer
    await Promise.all(
      Object.entries(byPeer).map(([peerId, calls]) =>
        this.executePeerBatch(peerId, calls)
      )
    )
  }
}
```

### Caching

```typescript
class CachedToolClient {
  private cache = new Map<string, CacheEntry>()
  
  async callTool(
    peerId: string, 
    tool: string, 
    params: any,
    cacheTTL?: number
  ) {
    const key = this.getCacheKey(peerId, tool, params)
    const cached = this.cache.get(key)
    
    if (cached && cached.expires > Date.now()) {
      return cached.value
    }
    
    const result = await this.client.callTool(peerId, tool, params)
    
    if (cacheTTL) {
      this.cache.set(key, {
        value: result,
        expires: Date.now() + cacheTTL
      })
    }
    
    return result
  }
}
```

## Security Considerations

### Tool Permission Model

```typescript
interface ToolPermissions {
  // Which peers can call my tools
  allowList?: string[]
  denyList?: string[]
  
  // Rate limiting
  rateLimit?: {
    callsPerMinute: number
    callsPerPeer?: number
  }
  
  // Require confirmation for sensitive tools
  requireConfirmation?: boolean
}

class SecureAgentClient extends MCPxAgentClient {
  private permissions = new Map<string, ToolPermissions>()
  
  async handleToolCall(request: ToolCallRequest) {
    // Check permissions
    const perms = this.permissions.get(request.tool)
    
    if (perms?.denyList?.includes(request.from)) {
      throw new Error('Permission denied')
    }
    
    if (perms?.allowList && !perms.allowList.includes(request.from)) {
      throw new Error('Not in allowlist')
    }
    
    if (perms?.requireConfirmation) {
      const confirmed = await this.requestConfirmation(request)
      if (!confirmed) throw new Error('User denied')
    }
    
    // Execute tool
    return await this.executeLocalTool(request)
  }
}
```

## Implementation Recommendations

### 1. Start Simple

Begin with a minimal client that can:
- Connect to a topic
- Discover peers and their tools
- Make targeted tool calls
- Handle responses

### 2. Add Intelligence Gradually

- Peer selection strategies
- Caching and batching
- Retry and fallback logic
- Learning from interactions

### 3. Framework-Specific Adapters

Create adapters for popular frameworks:
- OpenAI SDK adapter
- LangChain toolkit
- Anthropic Claude adapter
- AutoGPT plugin

### 4. Monitoring and Observability

Built-in metrics:
- Tool call latency by peer
- Success/failure rates
- Peer availability tracking
- Topic activity levels

## Next Steps

1. Implement core MCPxAgentClient class
2. Create OpenAI adapter (see decision-2.md for approach)
3. Build example agents using the client
4. Add advanced features based on usage patterns
5. Create framework-specific integrations