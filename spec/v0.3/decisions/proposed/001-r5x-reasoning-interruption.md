# ADR-r5x: Reasoning Interruption Mechanism

**Status:** Proposed  
**Date:** 2025-09-13  
**Context:** MEW Protocol v0.3  
**Incorporation:** Not Incorporated

## Context

MEW Protocol supports transparent reasoning through `reasoning/start`, `reasoning/thought`, and `reasoning/conclusion` message kinds. Agents can enter potentially long reasoning sequences, especially when using ReAct (Reason + Act) loops with LLMs that may require multiple iterations to complete complex tasks.

Currently, there is no standardized mechanism to interrupt an agent's reasoning process. This creates several problems:

1. **Runaway reasoning**: Agents may get stuck in reasoning loops or pursue unproductive lines of thought
2. **Resource management**: Long reasoning sequences consume computational resources and API calls
3. **User experience**: Humans cannot easily redirect or stop agents that are reasoning in the wrong direction
4. **Multi-agent coordination**: Other agents cannot signal that the reasoning agent should stop and reconsider

The protocol needs a mechanism to gracefully interrupt reasoning sequences while maintaining transparency and allowing for proper cleanup.

## Options Considered

### Option 1: Direct Stop Command
Add a new `reasoning/stop` message kind that any participant can send to interrupt another's reasoning.

**Pros:**
- Simple and direct approach
- Clear semantic meaning
- Works with existing message routing
- Can be capability-controlled

**Cons:**
- Abrupt interruption may not allow cleanup
- No mechanism for the reasoning agent to acknowledge the stop
- Could be disruptive if misused

### Option 2: Reasoning Interrupt with Acknowledgment
Add `reasoning/interrupt` and `reasoning/interrupt-ack` message kinds to create a two-phase interruption.

**Pros:**
- Allows reasoning agent to acknowledge and clean up gracefully  
- Two-phase pattern is already used in capability management
- Provides audit trail of interruptions
- Reasoning agent can choose to complete current thought before stopping

**Cons:**
- More complex than direct stop
- Requires additional message exchange
- Reasoning agent could ignore interrupt requests

### Option 3: Context-Based Interruption
Use chat messages within the reasoning context to signal interruption requests.

**Pros:**
- Leverages existing message types
- Natural for human participants to send chat messages
- Context field ensures messages are associated with the reasoning sequence
- No new message kinds needed

**Cons:**  
- Less semantically clear than dedicated message types
- Agents need to parse chat content to detect interruption intent
- Inconsistent with protocol's explicit message typing
- Harder to implement capability controls

### Option 4: Reasoning Redirect
Add `reasoning/redirect` message kind that provides new direction rather than just stopping.

**Pros:**
- More constructive than just stopping
- Allows steering reasoning toward better approaches
- Maintains reasoning context while changing direction
- Can include new goals or constraints

**Cons:**
- More complex to implement
- Reasoning agent may not be able to handle arbitrary redirections
- Unclear how to merge new direction with existing reasoning state

## Decision

**Option 2: Reasoning Interrupt with Acknowledgment** is selected.

This approach provides the right balance of control and grace, allowing for clean interruption while maintaining the protocol's explicit message semantics and audit trail philosophy.

### Implementation Details

#### New Message Kinds

**`reasoning/interrupt`** - Request interruption of a reasoning sequence
```json
{
  "protocol": "mew/v0.3",
  "id": "interrupt-123",
  "from": "human-supervisor",
  "to": ["reasoning-agent"],
  "kind": "reasoning/interrupt",
  "correlation_id": ["reason-start-1"],
  "payload": {
    "reason": "timeout|redirect|error|user_request|resource_limit",
    "message": "Optional human-readable explanation"
  }
}
```

**`reasoning/interrupt-ack`** - Acknowledge interruption and indicate response
```json
{
  "protocol": "mew/v0.3", 
  "id": "interrupt-ack-456",
  "from": "reasoning-agent",
  "correlation_id": ["interrupt-123"],
  "kind": "reasoning/interrupt-ack",
  "payload": {
    "status": "stopping|completing_thought|continuing|ignored",
    "message": "Optional explanation of chosen response"
  }
}
```

#### Interrupt Reason Codes

- `"timeout"`: Reasoning has exceeded time limits
- `"redirect"`: Need to change reasoning direction  
- `"error"`: Error condition requires stopping reasoning
- `"user_request"`: Human participant wants to interrupt
- `"resource_limit"`: Computational resources are being exhausted
- `"other"`: Other reason (must include message explanation)

#### Acknowledgment Status Codes

- `"stopping"`: Will stop reasoning immediately after current thought
- `"completing_thought"`: Will complete current reasoning step then stop
- `"continuing"`: Choosing to continue despite interrupt request
- `"ignored"`: Interrupt not applicable or not authorized

#### Behavioral Requirements

1. **Interrupt Messages**: 
   - MUST target specific reasoning agent via `to` field
   - MUST reference the reasoning sequence via `correlation_id`
   - SHOULD include human-readable explanation in message field

2. **Reasoning Agents**:
   - SHOULD check for interrupt messages between reasoning iterations
   - MUST send acknowledgment within 30 seconds of receiving interrupt
   - MAY continue reasoning if interrupt is not from authorized participant
   - SHOULD emit `reasoning/conclusion` with interruption context when stopping

3. **Capability Control**:
   - Sending `reasoning/interrupt` SHOULD be capability-controlled
   - Agents SHOULD respect interrupts from participants with appropriate capabilities
   - Self-interruption (agent interrupting its own reasoning) is always allowed

#### Example Flow

1. Agent begins reasoning sequence with `reasoning/start` (id: `reason-start-1`)
2. Agent sends several `reasoning/thought` messages
3. Human sends `reasoning/interrupt` with `correlation_id: ["reason-start-1"]`
4. Agent receives interrupt and sends `reasoning/interrupt-ack` with `status: "completing_thought"`
5. Agent completes current thought, sends `reasoning/thought` message
6. Agent sends `reasoning/conclusion` indicating it was interrupted
7. Agent stops reasoning sequence

## Consequences

### Positive
- Provides mechanism to stop runaway or unproductive reasoning
- Maintains protocol transparency with explicit message types  
- Allows graceful cleanup and acknowledgment
- Enables capability-based control over who can interrupt
- Creates audit trail of interruptions for debugging and analysis
- Supports both automated (timeout/resource) and human interruptions

### Negative
- Adds complexity with two new message kinds
- Reasoning agents must implement interruption checking logic
- Requires additional network round-trips for acknowledgment
- Agents can choose to ignore interrupts, making it not guaranteed
- May need additional capability configuration for interruption permissions

### Security Considerations
- Interruption capability should be granted carefully to prevent DoS attacks
- Agents should validate interrupt requests are from authorized participants  
- Frequent interruptions could be used to disrupt agent reasoning maliciously
- Interrupt acknowledgments reveal reasoning agent state to other participants

### Migration Path
- Existing reasoning sequences continue to work without changes
- Agents can gradually implement interrupt handling capabilities
- Participants can start sending interrupts once agents support acknowledgment
- No breaking changes to existing `reasoning/*` message types

## Examples

### Timeout-Based Interruption
```json
{
  "kind": "reasoning/interrupt",
  "from": "resource-monitor",
  "to": ["slow-reasoner"],
  "correlation_id": ["long-reasoning-seq"],
  "payload": {
    "reason": "timeout", 
    "message": "Reasoning exceeded 5 minute limit"
  }
}
```

### Human Redirection  
```json
{
  "kind": "reasoning/interrupt", 
  "from": "human-operator",
  "to": ["assistant-agent"],
  "correlation_id": ["task-reasoning"],
  "payload": {
    "reason": "redirect",
    "message": "Please focus on the security implications instead"
  }
}
```

### Graceful Acknowledgment
```json
{
  "kind": "reasoning/interrupt-ack",
  "from": "assistant-agent", 
  "correlation_id": ["interrupt-request"],
  "payload": {
    "status": "completing_thought",
    "message": "Will finish current security analysis then address new direction"
  }
}
```