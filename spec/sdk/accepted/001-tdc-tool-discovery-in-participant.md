# ADR-TDC: Move Tool Discovery and Caching to MEWParticipant

**Status:** Accepted
**Date:** 2025-01-13
**Incorporation:** Complete

## Context

Currently, the SDK specification places tool discovery and management responsibilities in MEWAgent, which is the LLM-powered layer. However, tool discovery via `tools/list` is a deterministic, protocol-level operation that doesn't require LLM intelligence. This creates several issues:

1. **Unnecessary LLM dependency**: Non-LLM participants cannot discover and cache tools
2. **Duplication**: Multiple agents in the same process duplicate tool discovery
3. **Separation of concerns**: Protocol operations are mixed with AI logic
4. **Missed automation**: Deterministic operations that could be automated aren't

The key insight is that anything that can be automated without an LLM should be available at the MEWParticipant level, allowing both human-operated and programmatic participants to benefit.

## Options Considered

### Option 1: Keep Tool Discovery in MEWAgent (Current)

Tool discovery remains in the MEWAgent layer, only available to LLM-powered participants.

**Pros:**
- No changes needed to existing implementation
- Clear that agents are the primary tool users
- Simpler MEWParticipant interface

**Cons:**
- Non-AI participants cannot discover tools
- Violates separation of concerns (protocol vs AI)
- Duplicates discovery logic across agents
- Prevents deterministic automation at lower levels

### Option 2: Move Tool Discovery to MEWParticipant

Move tool discovery, caching, and lifecycle management to MEWParticipant, making it available to all participants.

**Pros:**
- Available to all participants (human tools, bridges, monitors)
- Better separation of concerns (protocol operations at protocol layer)
- Enables tool caching and sharing across agents
- Reduces duplication in multi-agent systems
- Allows deterministic automation without LLM

**Cons:**
- MEWParticipant becomes more complex
- May include features that simple participants don't need
- Need to refactor existing agent implementations

### Option 3: Create Intermediate ToolAwareParticipant Layer

Add a new layer between MEWParticipant and MEWAgent specifically for tool-aware participants.

**Pros:**
- Clean separation of concerns
- Opt-in complexity
- Backward compatible

**Cons:**
- Adds another layer to the hierarchy
- May create confusion about which class to extend
- Splits tool functionality across layers

## Decision

**Choose Option 2: Move Tool Discovery to MEWParticipant**

This aligns with the principle that deterministic, automatable operations should be available at the lowest appropriate level. Tool discovery is a protocol operation, not an AI operation.

### Implementation Details

1. **MEWParticipant gains:**
   - `discoverTools(participantId)`: Discover tools from a specific participant
   - `discoveredTools`: Map of participant → tools
   - `onParticipantJoin(handler)`: Hook for auto-discovery
   - `getAvailableTools()`: Get all discovered tools
   - Tool caching with TTL
   - Automatic discovery on participant join (opt-in)

2. **MEWAgent changes:**
   - Inherits discovered tools from MEWParticipant
   - Focuses on LLM-specific concerns:
     - Tool selection strategies
     - Natural language → tool mapping
     - Tool chaining and orchestration
     - Reasoning about tool usage
   - `prepareLLMTools()` uses parent's discovered tools

3. **Migration path:**
   - MEWParticipant methods are additive (backward compatible)
   - MEWAgent continues to work but uses parent's discovery
   - Deprecate duplicate discovery in MEWAgent

### Example Usage

```typescript
// Human-operated participant can discover tools
class HumanInterface extends MEWParticipant {
  async onReady() {
    // Automatically discover tools from all participants
    this.enableAutoDiscovery();
    
    // Or manually discover
    await this.discoverTools('calculator-service');
    
    // Present tools to human
    const tools = this.getAvailableTools();
    this.ui.showTools(tools);
  }
}

// Agent uses inherited discovery
class SmartAgent extends MEWAgent {
  prepareLLMTools() {
    // Use parent's discovered tools
    const tools = this.getAvailableTools();
    // Transform for LLM consumption
    return tools.map(t => this.formatForLLM(t));
  }
}
```

## Consequences

### Positive
- Better separation of concerns (protocol vs AI)
- Enables non-AI tool discovery use cases
- Reduces redundant discovery in multi-agent systems
- Improves caching and performance
- Follows principle of "automate what doesn't need intelligence"
- Makes protocol features available to all participants

### Negative
- MEWParticipant becomes more complex
- Breaking change for existing MEWAgent implementations
- May include features unused by simple participants
- Need to carefully manage backward compatibility

### Migration Strategy
1. Add new methods to MEWParticipant (non-breaking)
2. Update MEWAgent to use parent's discovery (with fallback)
3. Deprecate MEWAgent's discovery methods
4. Remove deprecated methods in next major version