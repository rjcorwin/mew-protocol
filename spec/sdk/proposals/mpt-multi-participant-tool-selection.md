# ADR-mpt: Multi-Participant Tool Selection Pattern for LLMs

**Status:** Accepted  
**Date:** 2025-09-12  
**Incorporation:** Complete

## Context

Traditional LLM tool use assumes a flat namespace where all tools are equally accessible. In MEW Protocol, tools are distributed across multiple participants, each with their own capabilities and identity. This creates a novel challenge: how should an LLM select and invoke tools when they're owned by different participants?

Current LLM training data typically assumes:
- All tools are local to the agent
- Tool names are unique
- No routing or addressing is needed
- Tools can be called directly

In MEW Protocol reality:
- Tools belong to specific participants
- Multiple participants may have similarly named tools
- Tool calls must be routed to the correct participant
- Some tools may only be accessible via proposals

## Options Considered

### Option 1: Flat Namespace with Name Mangling

Present all tools with unique names by combining participant and tool names.

**Example:**
```json
{
  "tools": [
    {
      "name": "calculator_add",
      "description": "Add two numbers (from calculator participant)"
    },
    {
      "name": "math_service_add", 
      "description": "Add two numbers (from math-service participant)"
    }
  ]
}
```

**Pros:**
- Simple for LLM to understand
- No special training needed
- Works with existing tool-use patterns

**Cons:**
- Loses participant context
- Ugly naming convention
- Difficult to parse reliably
- Name collisions still possible

### Option 2: Hierarchical Namespace with Slash Notation

Use a path-like notation that LLMs are familiar with from file systems and URLs.

**Example:**
```json
{
  "tools": [
    {
      "name": "calculator/add",
      "description": "Add two numbers using the calculator participant"
    },
    {
      "name": "math-service/add",
      "description": "Add two numbers using the math-service participant"
    }
  ]
}
```

**Pros:**
- Clear participant attribution
- Familiar pattern (like file paths)
- Easy to parse
- Maintains context
- Natural for LLMs trained on code

**Cons:**
- Requires LLM to understand the notation
- May need prompt engineering
- Could be confused with actual paths

### Option 3: Structured Tool Definitions

Extend tool definitions with explicit participant information.

**Example:**
```json
{
  "tools": [
    {
      "name": "add",
      "participant": "calculator",
      "description": "Add two numbers",
      "full_name": "calculator.add"
    }
  ]
}
```

**Pros:**
- Most explicit and clear
- Preserves all metadata
- Allows for rich filtering

**Cons:**
- Requires custom prompt engineering
- LLM may not use participant field
- More complex to implement
- Not standard tool format

### Option 4: Virtual Unified Tool Interface

Present tools as if they're all local, but handle routing transparently.

**Example:**
```json
{
  "tools": [
    {
      "name": "add_numbers",
      "description": "Add two numbers (best available implementation)"
    }
  ]
}
```

Agent internally decides which participant's tool to use based on availability, performance, or other criteria.

**Pros:**
- Simplest for LLM
- No special handling needed
- Can optimize tool selection

**Cons:**
- Loses control and transparency
- Can't leverage specific participant capabilities
- Debugging is difficult
- May not match user intent

### Option 5: Prompt-Based Participant Awareness

Include participant information in system prompt and let LLM reason about it.

**Example System Prompt:**
```
You have access to tools from multiple participants:
- calculator: Provides basic math operations (add, multiply)
- math-service: Provides advanced math operations (add, integrate)
- database: Provides data operations (query, insert)

When calling a tool, specify both participant and tool name.
```

**Pros:**
- Leverages LLM reasoning
- Flexible and adaptable
- Can include participant characteristics

**Cons:**
- Relies on prompt engineering
- May be inconsistent
- Token overhead
- Requires careful prompt design

## Decision

**Option 2: Hierarchical Namespace with Slash Notation** should be adopted as the primary pattern.

### Rationale

1. **Familiarity**: The `participant/tool` notation is similar to file paths, module imports, and URLs that LLMs have seen in training data.

2. **Clarity**: It's immediately clear which participant owns which tool, maintaining full context.

3. **Parseable**: Simple string split operation to extract participant and tool name.

4. **Compatibility**: Works with existing function-calling formats by treating `participant/tool` as the function name.

5. **Prompt Enhancement**: Can be combined with Option 5 for better results through prompt engineering.

### Implementation Pattern

```typescript
// Tool presented to LLM
{
  "name": "calculator/add",
  "description": "Add two numbers using the calculator service",
  "parameters": {
    "type": "object",
    "properties": {
      "a": { "type": "number" },
      "b": { "type": "number" }
    }
  }
}

// LLM generates call
{
  "tool": "calculator/add",
  "arguments": { "a": 5, "b": 3 }
}

// Agent parses and routes
const [participantId, toolName] = toolCall.tool.split('/');
await this.mcpRequest([participantId], {
  method: 'tools/call',
  params: {
    name: toolName,
    arguments: toolCall.arguments
  }
});
```

### System Prompt Enhancement

Include participant context in the system prompt:

```
You have access to tools from multiple participants in this workspace. Tools are 
namespaced as 'participant/tool'. For example:
- 'calculator/add' - Basic addition from the calculator participant
- 'database/query' - Database queries from the database participant

When multiple participants offer similar tools, consider:
1. The participant's description and capabilities
2. The specific tool's description
3. The context of the user's request

Always use the full 'participant/tool' name when calling tools.
```

## Consequences

### Positive
- **Clear Attribution**: Always know which participant is being used
- **Disambiguation**: Handles duplicate tool names across participants
- **Debugging**: Easy to trace tool calls to specific participants
- **Extensible**: Can add more context without changing the pattern
- **LLM-Friendly**: Notation is familiar from training data

### Negative
- **Prompt Engineering**: Requires careful system prompt design
- **Token Usage**: Longer tool names mean more tokens
- **Learning Curve**: Users need to understand the notation
- **Legacy Models**: Older models might struggle with the pattern

### Migration Path

1. Start with hierarchical namespace as default
2. Provide clear examples in documentation
3. Test with various LLM providers
4. Build prompt templates for common scenarios
5. Consider fallback strategies for models that struggle

### Future Considerations

- Could extend to three-level hierarchy: `space/participant/tool`
- Might add aliases for frequently used tools
- Could implement smart routing when participant not specified
- May need different strategies for different LLM providers