# ADR-tns: Tool Namespace Management for LLM Integration

**Status:** Accepted  
**Date:** 2025-09-12  
**Incorporation:** Complete
**Depends On:** ADR-mpt (Multi-Participant Tool Selection)

## Context

Following the decision in ADR-mpt to use hierarchical namespace notation (`participant/tool`) for multi-participant tool selection, we need to determine which layer of the SDK should be responsible for implementing this namespacing strategy.

The implementation requires:
1. **Tool Discovery**: Collecting tools from all participants
2. **Namespace Preparation**: Presenting tools to LLM as `{participantId}/{toolName}`
3. **LLM Selection**: LLM chooses a namespaced tool like `calculator/add`
4. **Envelope Translation**: Converting `calculator/add` into a MEW envelope with `to: ["calculator"]` and `payload.params.name: "add"`

The question is: should this namespace management be a concern of MEWParticipant (protocol layer) or MEWAgent (application layer)?

## Options Considered

### Option 1: MEWParticipant Handles Namespacing

MEWParticipant manages tool namespaces as part of its protocol responsibilities.

**Implementation:**
```typescript
class MEWParticipant {
  // Maintains discovered tools with namespaces
  private toolRegistry: Map<string, ToolInfo>;
  
  // Returns tools in LLM-ready format
  getAvailableTools(): Array<{
    name: string;  // "participant/tool"
    description: string;
    schema: any;
  }>;
  
  // Handles namespaced tool calls
  async callTool(namespacedTool: string, args: any): Promise<any> {
    const [participantId, toolName] = namespacedTool.split('/');
    return this.mcpRequest([participantId], {
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    });
  }
}
```

**Pros:**
- Centralized tool management
- Reusable across different agent implementations
- Protocol-aware namespace handling
- Single source of truth for tool registry

**Cons:**
- Adds LLM concerns to protocol layer
- MEWParticipant becomes more complex
- Couples protocol layer to AI/LLM patterns
- Not all participants need tool discovery

### Option 2: MEWAgent Handles Namespacing

MEWAgent manages namespacing as part of its orchestration responsibilities.

**Implementation:**
```typescript
class MEWAgent {
  // Agent maintains discovered tools
  private discoveredTools: Map<string, {
    participantId: string;
    name: string;
    description?: string;
    schema?: any;
  }>;
  
  // Prepares tools for LLM
  private prepareLLMTools(): Array<{
    name: string;  // "participant/tool"
    description: string;
    schema: any;
  }> {
    return Array.from(this.discoveredTools.values()).map(tool => ({
      name: `${tool.participantId}/${tool.name}`,
      description: tool.description,
      schema: tool.schema
    }));
  }
  
  // Translates LLM tool call to MEW envelope
  private async executeLLMToolCall(namespacedTool: string, args: any) {
    const [participantId, toolName] = namespacedTool.split('/');
    return this.mcpRequest([participantId], {
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    });
  }
}
```

**Pros:**
- Keeps LLM concerns in application layer
- MEWParticipant stays focused on protocol
- Agent has full control over tool presentation
- More flexible for different AI strategies

**Cons:**
- Each agent implementation must handle namespacing
- Potential for inconsistent implementations
- Code duplication across agent types

### Option 3: Hybrid Approach with Helper Class

Create a separate ToolNamespaceManager that can be used by either layer.

**Implementation:**
```typescript
// Separate utility class
class ToolNamespaceManager {
  private tools: Map<string, ToolInfo>;
  
  addTool(participantId: string, tool: Tool): void;
  getNamespacedTools(): Array<LLMTool>;
  parseNamespacedCall(call: string): { participantId: string; toolName: string };
}

// MEWParticipant can optionally use it
class MEWParticipant {
  protected toolManager?: ToolNamespaceManager;
  
  // Optional tool discovery
  enableToolDiscovery(): void {
    this.toolManager = new ToolNamespaceManager();
  }
}

// MEWAgent always uses it
class MEWAgent extends MEWParticipant {
  constructor(config: AgentConfig) {
    super(config);
    this.enableToolDiscovery();
  }
}
```

**Pros:**
- Separation of concerns
- Reusable without coupling
- Optional for participants
- Testable in isolation

**Cons:**
- Additional complexity
- Another component to maintain
- May lead to confusion about responsibilities

## Decision

**Option 2: MEWAgent Handles Namespacing** should be adopted.

### Rationale

1. **Separation of Concerns**: LLM integration and tool namespacing for AI decision-making is fundamentally an application-layer concern, not a protocol concern.

2. **Protocol Purity**: MEWParticipant should remain focused on MEW/MCP protocol implementation without assumptions about AI/LLM usage patterns.

3. **Flexibility**: Different agent implementations might want different namespacing strategies (e.g., some might prefer `participant.tool` or just `tool` if unambiguous).

4. **Progressive Enhancement**: Not all participants need tool discovery. Agents that need it can implement it, while simpler participants aren't burdened with the complexity.

### Implementation Details

MEWAgent will:
1. Maintain a `discoveredTools` map with full participant attribution
2. Implement `prepareLLMTools()` to format tools as `{participantId}/{toolName}`
3. Implement `executeLLMToolCall()` to parse namespaced calls and create proper envelopes
4. Handle ambiguity (same tool name from multiple participants) at the agent level

MEWParticipant will:
1. Provide basic `mcpRequest()` for sending tools/call requests
2. Not maintain any tool discovery state
3. Focus on protocol-level tool registration and execution for its own tools

## Consequences

### Positive
- **Clear Separation**: Protocol and application concerns remain separate
- **Agent Flexibility**: Agents can implement custom namespacing strategies
- **Simpler Participant**: MEWParticipant remains focused and simple
- **Testability**: Agent-level namespacing can be tested independently
- **Evolution**: Can evolve namespacing strategies without changing protocol layer

### Negative
- **Code Duplication**: Multiple agent implementations might duplicate namespacing logic
- **Inconsistency Risk**: Different agents might implement slightly different strategies
- **Documentation**: Need clear documentation on recommended namespacing patterns
- **Migration Effort**: Existing code expecting participant-level discovery needs refactoring

### Mitigation Strategies

To address the negatives:
1. Provide a reference implementation in MEWAgent
2. Document best practices for tool namespacing
3. Consider extracting common patterns into utility functions
4. Provide examples of different namespacing strategies