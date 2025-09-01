# ADR-t8k: Agent Reasoning Transparency

**Status:** Proposed
**Date:** 2025-08-31
**Context:** MEUP/MEUP Protocol Draft Specification
**Incorporation:** Not Incorporated

## Context

Currently, agents in MEUP pods operate as black boxes - they receive inputs and produce outputs without revealing their internal reasoning process. This lack of transparency creates several challenges:

- **Debugging Difficulty**: When agents produce unexpected results, it's hard to understand why
- **Trust Issues**: Humans and other agents can't see the reasoning behind decisions
- **Learning Impediment**: Orchestrators can't learn from intermediate reasoning patterns
- **Context Loss**: Valuable problem-solving steps aren't captured in the shared context
- **Collaboration Barriers**: Other agents can't build upon or correct reasoning steps

Many modern AI systems show "thinking" or "reasoning" steps (like chain-of-thought prompting), but this valuable information is typically hidden from other participants in multi-agent systems.

### Decision Drivers
- Need for debugging and troubleshooting agent behavior
- Desire for explainable AI decisions in collaborative environments
- Requirement for audit trails showing complete reasoning chains
- Opportunity for agents to learn from each other's problem-solving approaches
- Balance between transparency and message volume/noise

## Decision

**Introduce optional reasoning transparency through sub-context messages**

Agents SHOULD be encouraged (but not required) to share their reasoning process using a special message kind that creates a sub-context for their "thinking aloud". This allows agents to:
1. Signal the start of a reasoning process
2. Share tool calls, reflections, and intermediate steps
3. Provide a final response that concludes the reasoning

Other participants can choose to:
- Monitor the full reasoning process for debugging
- Ignore sub-context messages for cleaner context
- Selectively include reasoning steps when relevant
- Learn from reasoning patterns for automation

## Options Considered

### Option 1: No Reasoning Transparency (Status Quo)

Keep agents as black boxes that only share final outputs.

**Pros:**
- Simpler protocol (no new message types)
- Less message traffic in pods
- Cleaner conversation flow
- No risk of exposing sensitive reasoning

**Cons:**
- No visibility into agent decision-making
- Difficult to debug failures
- Can't learn from reasoning patterns
- No explainability for critical decisions
- Trust issues with opaque operations

### Option 2: Inline Reasoning Messages

Agents share reasoning as regular chat messages or structured messages inline with normal conversation.

**Pros:**
- Simple to implement
- No new message kinds needed
- Full visibility by default

**Cons:**
- Clutters the main conversation
- Hard to distinguish reasoning from actual outputs
- Can't easily filter out reasoning noise
- No clear boundaries for reasoning sequences

### Option 3: Sub-Context Encapsulation (Recommended)

Create a special message kind for reasoning that encapsulates the thinking process.

**Pros:**
- Clear separation between reasoning and outputs
- Can be filtered/ignored by participants
- Maintains full traceability when needed
- Enables pattern learning from reasoning
- Provides natural grouping of related thoughts

**Cons:**
- Requires new message kind(s)
- Slightly more complex protocol
- Agents need to implement reasoning transparency
- Potential for message volume increase

### Option 4: Separate Reasoning Channel

Create entirely separate pods/topics for agent reasoning.

**Pros:**
- Complete separation of concerns
- No impact on main conversation
- Can have different access controls

**Cons:**
- Complex to correlate reasoning with actions
- Requires managing multiple connections
- Loses the benefit of shared context
- Harder to trace decision chains

## Implementation Details

### New Message Kinds

```json
{
  "kind": "reasoning/start",
  "payload": {
    "reasoning_id": "r-123",
    "description": "Analyzing the code change request",
    "parent_message": "msg-456"  // Optional reference to triggering message
  }
}

{
  "kind": "reasoning/step",
  "payload": {
    "reasoning_id": "r-123",
    "type": "tool_call|reflection|analysis|hypothesis",
    "content": {
      // Type-specific content
    }
  }
}

{
  "kind": "reasoning/end",
  "payload": {
    "reasoning_id": "r-123",
    "conclusion": "Final analysis or decision",
    "confidence": 0.85,  // Optional confidence score
    "key_factors": ["factor1", "factor2"]  // Optional key decision factors
  }
}
```

### Example Reasoning Flow

```json
// 1. Agent signals start of reasoning
{
  "kind": "reasoning/start",
  "from": "code-analyst",
  "payload": {
    "reasoning_id": "r-789",
    "description": "Evaluating security implications of file write"
  }
}

// 2. Agent shares tool call within reasoning
{
  "kind": "reasoning/step",
  "from": "code-analyst",
  "payload": {
    "reasoning_id": "r-789",
    "type": "tool_call",
    "content": {
      "tool": "scan_permissions",
      "result": "File location requires elevated permissions"
    }
  }
}

// 3. Agent shares reflection
{
  "kind": "reasoning/step",
  "from": "code-analyst",
  "payload": {
    "reasoning_id": "r-789",
    "type": "reflection",
    "content": {
      "thought": "This operation could expose sensitive data if permissions are misconfigured"
    }
  }
}

// 4. Agent concludes reasoning
{
  "kind": "reasoning/end",
  "from": "code-analyst",
  "payload": {
    "reasoning_id": "r-789",
    "conclusion": "File write should be denied due to security risks",
    "confidence": 0.92,
    "key_factors": ["elevated_permissions", "sensitive_location"]
  }
}

// 5. Agent sends actual response/action
{
  "kind": "mcp/proposal:tools/call:write_file",
  "from": "code-analyst",
  "correlation_id": "r-789",  // Links to reasoning
  "payload": {
    // Actual proposal based on reasoning
  }
}
```

### Participant Behavior

**For Reasoning Agents:**
- SHOULD emit `reasoning/start` before complex decisions
- MAY share any number of `reasoning/step` messages
- SHOULD conclude with `reasoning/end` before taking action
- MUST ensure reasoning_id is unique within the pod session

**For Observing Participants:**
- MAY choose to ignore all `reasoning/*` messages
- MAY subscribe only to `reasoning/end` for summaries
- MAY use full reasoning chains for learning patterns
- SHOULD correlate reasoning with subsequent actions via correlation_id

### Gateway Behavior

The gateway treats `reasoning/*` messages like any other message kind:
- No special routing rules
- Standard capability checks apply
- Messages are broadcast unless using targeted `to` field

### Capability Control

New capability patterns for reasoning:
- `reasoning/*` - Can emit any reasoning messages
- `reasoning/start` - Can only start reasoning sequences
- `reasoning/step` - Can only add steps (not start/end)

This allows fine-grained control over which agents can share reasoning.

## Consequences

### Positive
- **Improved Debugging**: Full visibility into agent decision-making
- **Enhanced Trust**: Humans can understand why agents make decisions
- **Pattern Learning**: Orchestrators can identify and automate reasoning patterns
- **Knowledge Sharing**: Agents can learn from each other's approaches
- **Audit Compliance**: Complete reasoning chains for regulated environments
- **Selective Attention**: Participants can choose their level of detail

### Negative
- **Increased Complexity**: New message kinds to handle
- **Message Volume**: Potential for significant increase in pod traffic
- **Performance Impact**: Processing and storing reasoning chains
- **Privacy Concerns**: Reasoning might expose proprietary algorithms
- **Context Management**: Participants need strategies for handling reasoning noise

## Security Considerations

- Reasoning messages could expose internal agent logic or training patterns
- Malicious agents could flood pods with excessive reasoning messages
- Sensitive data might be inadvertently included in reasoning steps
- Rate limiting on reasoning messages may be necessary
- Consider capability restrictions on who can emit reasoning messages

## Migration Path

Since this is an optional feature:
1. Introduce message kinds in protocol spec
2. Agents can adopt reasoning transparency gradually
3. No breaking changes for existing participants
4. Orchestrators can start learning from reasoning patterns immediately
5. UI clients can add reasoning visualization features progressively

## Future Enhancements

- Structured reasoning templates for common patterns
- Reasoning compression for high-volume scenarios
- Cross-pod reasoning correlation
- Reasoning replay for training new agents
- Standardized confidence and uncertainty metrics