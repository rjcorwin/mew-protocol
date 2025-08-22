# Decision 2: OpenAI Tool Use with Peer Targeting in MCPx

## Context

OpenAI's function calling API expects tool definitions with unique names. In MCPx, multiple peers might offer the same tool (e.g., multiple agents might have a `search` tool). We need a strategy to handle peer targeting when using OpenAI's API to power MCPx agents.

## Problem Statement

When an LLM decides to use a tool in MCPx:
1. It needs to select which peer's version of the tool to call
2. The peer selection must be encoded in a way OpenAI's API understands
3. The system must handle cases where peers come and go dynamically
4. Tool names might conflict across peers

## Options

### Option 1: Peer-Prefixed Tool Names

Encode the peer ID directly in the tool name.

```typescript
// Tool definition for OpenAI
{
  name: "weather-agent__getCurrentWeather",
  description: "Get current weather from weather-agent",
  parameters: { /* schema */ }
}

// Multiple peers with same tool
{
  name: "service-a__search",
  description: "Search using service-a"
},
{
  name: "service-b__search", 
  description: "Search using service-b"
}
```

**Pros:**
- ✅ Simple and explicit - peer targeting is clear
- ✅ No ambiguity about which peer to call
- ✅ Works with existing OpenAI API without modification
- ✅ Easy to parse: just split on delimiter
- ✅ LLM can reason about which peer to use based on name

**Cons:**
- ❌ Verbose - duplicates tools for each peer
- ❌ Function list grows linearly with peers
- ❌ May hit OpenAI's function count limits quickly
- ❌ Peer IDs might not be meaningful to the LLM
- ❌ Dynamic peer changes require refreshing all tools

### Option 2: Single Tool with Peer Parameter

Define each tool once with peer as a parameter.

```typescript
// Tool definition for OpenAI
{
  name: "callMCPxTool",
  description: "Call a tool on any MCPx peer",
  parameters: {
    type: "object",
    properties: {
      peer: {
        type: "string",
        description: "ID of the peer to call",
        enum: ["weather-agent", "calendar-agent", "search-agent"]
      },
      tool: {
        type: "string",
        description: "Name of the tool to call"
      },
      params: {
        type: "object",
        description: "Parameters for the tool"
      }
    }
  }
}
```

**Pros:**
- ✅ Single function definition
- ✅ Scales well with many peers
- ✅ Won't hit function limits
- ✅ Easy to update peer list dynamically

**Cons:**
- ❌ Less natural for LLM - requires two-step reasoning
- ❌ Loses tool-specific parameter schemas
- ❌ LLM can't see all available tools directly
- ❌ May reduce tool selection accuracy
- ❌ Harder to provide tool-specific descriptions

### Option 3: Tool Categories with Peer Selection

Group similar tools and let LLM pick peer based on context.

```typescript
// Weather tool - system picks best weather peer
{
  name: "getWeather",
  description: "Get weather (system selects best provider)",
  parameters: {
    type: "object",
    properties: {
      location: { type: "string" },
      preferredProvider: { 
        type: "string",
        enum: ["weather-agent", "multi-service", "any"],
        description: "Optional preferred peer"
      }
    }
  }
}
```

**Pros:**
- ✅ Natural tool interface for LLM
- ✅ System can handle peer selection intelligently
- ✅ Failover built-in if preferred peer unavailable
- ✅ Reduces cognitive load on LLM
- ✅ Can load-balance across peers

**Cons:**
- ❌ Less control for LLM over peer selection
- ❌ Requires categorization/deduplication logic
- ❌ May call wrong peer if tools differ slightly
- ❌ Hidden complexity in peer selection
- ❌ Harder to debug which peer was called

### Option 4: Hybrid - Smart Prefixing

Use semantic prefixes for unique tools, deduplicate common ones.

```typescript
// Unique tool - include peer name
{
  name: "nasa__getMarsWeather",
  description: "Get Mars weather from NASA service"
}

// Common tool - deduplicated
{
  name: "search",
  description: "Search (multiple providers available)",
  parameters: {
    query: { type: "string" },
    source: { 
      type: "string", 
      enum: ["web", "docs", "code"],
      description: "Hint for peer selection"
    }
  }
}
```

**Pros:**
- ✅ Best of both worlds - explicit when needed
- ✅ Reduces function count for common tools
- ✅ Maintains clarity for unique capabilities
- ✅ LLM can understand semantic differences
- ✅ Natural naming that makes sense

**Cons:**
- ❌ More complex implementation
- ❌ Requires classification of tools
- ❌ Inconsistent patterns might confuse LLM
- ❌ Need rules for when to prefix vs deduplicate
- ❌ Maintenance overhead

### Option 5: Dynamic Tool Binding

Let LLM discover and bind to peers conversationally.

```typescript
// First, LLM asks what's available
{
  name: "discoverTools",
  description: "Discover available tools from peers",
  parameters: {
    capability: { type: "string" }
  }
}

// Then bind to specific peer
{
  name: "bindToPeer",
  description: "Select a peer for subsequent tool calls",
  parameters: {
    peerId: { type: "string" }
  }
}

// Then call tools on bound peer
{
  name: "callTool",
  description: "Call tool on currently bound peer",
  parameters: { /* tool specific */ }
}
```

**Pros:**
- ✅ Natural conversation flow
- ✅ LLM learns about peers progressively
- ✅ Reduces upfront complexity
- ✅ Stateful interaction pattern
- ✅ Can build peer preferences over time

**Cons:**
- ❌ Requires multiple LLM calls for single action
- ❌ Stateful - complexity in managing bindings
- ❌ Slower - discovery adds latency
- ❌ May forget bindings between calls
- ❌ Not idiomatic for OpenAI function calling

## Recommendation: Option 1 (Peer-Prefixed Tool Names)

Despite its verbosity, **Option 1** is recommended for the initial implementation because:

1. **Simplicity**: It's the most straightforward to implement and debug
2. **Explicitness**: No ambiguity about which peer handles what
3. **LLM-friendly**: Modern LLMs handle long function lists well
4. **Compatibility**: Works perfectly with existing OpenAI API
5. **Transparency**: Easy to see in logs exactly what was called

### Implementation Strategy

```typescript
class OpenAIPeerToolAdapter {
  private tools: Map<string, ToolDefinition> = new Map()
  
  registerPeerTools(peer: Peer) {
    for (const tool of peer.tools) {
      const openAIName = `${peer.id}__${tool.name}`
      
      this.tools.set(openAIName, {
        name: openAIName,
        description: `${tool.description} (via ${peer.id})`,
        parameters: tool.inputSchema,
        peerId: peer.id,
        originalName: tool.name
      })
    }
  }
  
  getOpenAIFunctions(): OpenAIFunction[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }))
  }
  
  async executeFunctionCall(call: OpenAIFunctionCall) {
    const tool = this.tools.get(call.name)
    if (!tool) throw new Error(`Unknown tool: ${call.name}`)
    
    return await this.client.callTool(
      tool.peerId,
      tool.originalName,
      JSON.parse(call.arguments)
    )
  }
}
```

### Mitigation Strategies for Cons

1. **Function Limit**: If approaching OpenAI's limit, implement smart filtering:
   - Only include tools relevant to current context
   - Rotate tool sets based on conversation topic
   - Use GPT-4's larger function limit (128 functions)

2. **Verbosity**: Use clear, concise naming conventions:
   - Short but meaningful peer IDs
   - Tool descriptions that explain peer specialization

3. **Dynamic Updates**: Implement intelligent refresh:
   - Only update when peers change significantly
   - Cache tool definitions
   - Batch updates to reduce API calls

## Future Enhancements

Once the basic system works with Option 1, consider:

1. **Gradual Migration to Option 4**: As patterns emerge, identify common tools that can be deduplicated

2. **Peer Reputation System**: Track which peers provide best results for which tools

3. **Semantic Tool Matching**: Use embeddings to find similar tools across peers

4. **Load Balancing**: Distribute calls across capable peers

## Decision

✅ **Proceed with Option 1 (Peer-Prefixed Tool Names)** for initial implementation.

This provides a solid foundation that works today and can be enhanced based on real usage patterns. The explicit peer targeting will help us understand how LLMs reason about multi-peer environments, informing future optimizations.