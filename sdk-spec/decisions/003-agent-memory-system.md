# ADR-003: Agent Memory System

## Status
Proposed

## Context
Agents need memory to maintain context, learn from interactions, and make informed decisions. The memory system must be flexible enough for different agent types while being simple to use by default.

## Decision
Implement a three-tier memory system in @mcpx/agent:

1. **Short-term memory**: Recent events (in-memory, FIFO, size-limited)
2. **Working memory**: Current task context (key-value store)
3. **Long-term memory**: Persistent storage (optional, pluggable)

All memory operations go through a unified interface. Long-term memory is optional and pluggable to support different backends.

## Consequences

### Positive
- Works out-of-the-box with sensible defaults
- Can scale from simple to complex agents
- Clear separation of memory types
- Pluggable persistence backends
- No external dependencies for basic usage

### Negative
- Three systems might be overkill for simple agents
- Memory lifecycle management complexity
- Potential for memory leaks if not managed
- Need to educate developers on when to use which type

## Implementation
```typescript
class MCPxAgent {
  protected memory = {
    shortTerm: new ShortTermMemory(100),  // Last 100 items
    working: new WorkingMemory(),         // Current context
    longTerm: null                        // Optional
  }
  
  remember(key: string, value: any, ttl?: number) {
    this.memory.working.set(key, value);
    this.memory.shortTerm.add({ key, value, timestamp: Date.now() });
  }
  
  recall(key: string) {
    return this.memory.working.get(key) || 
           this.memory.shortTerm.find(key) ||
           this.memory.longTerm?.retrieve(key);
  }
}
```

## Memory Type Guidelines

### Short-term Memory
- Recent messages and events
- Conversation context
- Recent tool calls and results
- Auto-expires based on size limit

### Working Memory
- Current goal or task
- Active conversation state
- Temporary calculations
- Cleared between tasks

### Long-term Memory
- Learned patterns
- User preferences
- Historical summaries
- Persistent across restarts

## Alternatives Considered
1. **Single unified memory**: Everything in one store
   - Rejected: No distinction between memory types
2. **Vector database default**: Embeddings for everything
   - Rejected: Too heavy for simple agents
3. **No built-in memory**: Let implementations handle it
   - Rejected: Every agent needs basic memory