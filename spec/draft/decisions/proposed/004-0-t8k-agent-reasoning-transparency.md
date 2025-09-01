# ADR-t8k: Agent Reasoning Transparency

**Status:** Proposed
**Date:** 2025-08-31
**Context:** MEUP Protocol Draft Specification
**Incorporation:** Not Incorporated
**Related ADRs:** 004-2-p4m (Context Field Structure)

## Context

Currently, agents in MEUP spaces operate as black boxes - they receive inputs and produce outputs without revealing their internal reasoning process. This lack of transparency creates several challenges:

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

**To be determined** - Evaluating options for reasoning transparency using the context field.

With the adoption of the path-based context field (ADR-p4m), we can now implement reasoning transparency by using context paths to group reasoning messages.

Other participants can choose to:
- Monitor the full reasoning process for debugging
- Filter sub-context messages for cleaner display (but MUST still process any MCP requests/proposals within them)
- Selectively include reasoning steps when relevant
- Learn from reasoning patterns for automation

**Important:** While sub-contexts can be visually collapsed or filtered in UIs, participants MUST still process any MCP protocol messages (requests, proposals, responses) that appear within sub-contexts, as these require action regardless of their context level.

## Options Considered

### Option 1: No Reasoning Transparency (Status Quo)

Keep agents as black boxes that only share final outputs.

**Pros:**
- Simpler protocol (no new message types)
- Less message traffic in spaces
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

### Option 3: Context Path with Regular Messages

Use the context field with regular message kinds (chat, MCP messages) for reasoning.

```json
// Normal message
{"kind": "chat", "payload": {"message": "I'll analyze this"}}

// Reasoning in context
{"context": "reason-123", "kind": "chat", "payload": {"message": "Checking permissions..."}}
{"context": "reason-123", "kind": "mcp.request", "payload": {...}}
{"context": "reason-123", "kind": "chat", "payload": {"message": "Permissions look good"}}
```

**Pros:**
- No new message kinds needed
- Uses existing context field
- Simple to implement
- Natural filtering by context

**Cons:**
- No structured reasoning format
- Reasoning mixed with regular messages
- No clear start/end markers
- Less semantic clarity

### Option 4: Context Path with Reasoning-Specific Kinds

Use context field plus dedicated reasoning message kinds for structured reasoning transparency.

#### Proposed Reasoning Kinds:
- `reasoning.start` - Begin a reasoning process
- `reasoning.thought` - Share a reflection or intermediate thought
- `reasoning.observation` - Note something observed from data/tools
- `reasoning.hypothesis` - Propose a potential explanation
- `reasoning.question` - Identify key questions to answer
- `reasoning.conclusion` - Final decision or summary

#### Extended Example:
```json
// User asks a complex question
{"kind": "chat", "from": "user", "payload": {"message": "Should we deploy this code change that modifies the authentication system?"}}

// Agent begins structured reasoning
{"context": "reason-123", "kind": "reasoning.start", "from": "agent", "payload": {
  "goal": "Evaluate deployment safety for auth system changes",
  "triggered_by": "user-request",
  "approach": "security-first analysis"
}}

// Agent identifies key questions
{"context": "reason-123", "kind": "reasoning.question", "from": "agent", "payload": {
  "questions": [
    "What specific auth components are modified?",
    "Are there breaking changes to the API?",
    "Have security tests passed?",
    "Is there a rollback plan?"
  ]
}}

// Agent starts investigating
{"context": "reason-123", "kind": "reasoning.thought", "from": "agent", "payload": {
  "content": "Need to check the diff and test results first"
}}

// Agent makes tool calls within reasoning context
{"context": "reason-123", "kind": "mcp.request", "from": "agent", "payload": {
  "method": "tools/call",
  "params": {"name": "git_diff", "arguments": {"files": "auth/*"}}
}}

{"context": "reason-123", "kind": "reasoning.observation", "from": "agent", "payload": {
  "content": "Changes affect OAuth2 token validation and session management",
  "severity": "high",
  "components": ["oauth2", "sessions"]
}}

// More investigation
{"context": "reason-123", "kind": "mcp.request", "from": "agent", "payload": {
  "method": "tools/call", 
  "params": {"name": "test_results", "arguments": {"suite": "security"}}
}}

{"context": "reason-123", "kind": "reasoning.observation", "from": "agent", "payload": {
  "content": "Security tests show 2 failures in token expiration handling",
  "severity": "critical",
  "details": "Tokens may not expire correctly under edge conditions"
}}

// Agent forms hypothesis
{"context": "reason-123", "kind": "reasoning.hypothesis", "from": "agent", "payload": {
  "hypothesis": "The code change introduces a regression in token expiration",
  "confidence": 0.85,
  "evidence": ["test_failures", "oauth2_changes"]
}}

// Check for mitigations
{"context": "reason-123", "kind": "reasoning.thought", "from": "agent", "payload": {
  "content": "Even with a rollback plan, deploying with known auth bugs is too risky"
}}

// Agent reaches conclusion
{"context": "reason-123", "kind": "reasoning.conclusion", "from": "agent", "payload": {
  "decision": "do_not_deploy",
  "confidence": 0.92,
  "key_factors": [
    "Failed security tests",
    "Critical auth components affected",
    "Token expiration regression"
  ],
  "recommendation": "Fix token expiration issues and re-test before deployment"
}}

// Agent provides final answer (no context - back to main conversation)
{"kind": "chat", "from": "agent", "correlationId": "reason-123", "payload": {
  "message": "I strongly recommend NOT deploying this change. The security tests show critical failures in token expiration that could compromise authentication. Please fix these issues first."
}}

// Optional: Agent could also create a proposal based on reasoning
{"kind": "mcp.proposal", "from": "agent", "correlationId": "reason-123", "payload": {
  "method": "tools/call",
  "params": {
    "name": "create_issue",
    "arguments": {
      "title": "Fix token expiration regression before deployment",
      "priority": "critical"
    }
  }
}}
```

**Pros:**
- **Rich semantic structure** - Different reasoning types are explicit
- **Machine-readable reasoning** - Can analyze patterns across agents
- **Progressive detail** - Can filter by reasoning kind for different views
- **Context groups everything** - All related reasoning in one context
- **Supports learning** - Can train on structured reasoning patterns
- **Debugging friendly** - Clear reasoning flow with typed steps

**Cons:**
- **New message kinds needed** - Must define reasoning.* namespace
- **More complex than Option 3** - Requires understanding both context and kinds
- **Two mechanisms** - Both context and kind convey meaning
- **More verbose** - Each thought needs proper kind selection

### Option 5: Simplified Reasoning Kinds (3 Types)

Use context field with just three reasoning kinds that mirror chat structure.

#### Minimal Reasoning Kinds:
- `reasoning.start` - Signal beginning of reasoning (optional message)
- `reasoning.thought` - Share thoughts during reasoning
- `reasoning.conclusion` - Conclude reasoning (optional message)

All use the same payload structure as `chat`: `{"message": "..."}`

#### Example Flow (Single Agent):
```json
// User asks a question
{"id": "msg-100", "kind": "chat", "from": "user", "payload": {"message": "Should we deploy this auth change?"}}

// Agent signals it's thinking (creates context, stays at top level)
{"id": "msg-101", "kind": "reasoning.start", "from": "agent", "correlationId": "msg-100", "payload": {"message": "Analyzing deployment safety..."}}

// Agent shares thoughts using msg-101 as context
{"context": "msg-101", "kind": "reasoning.thought", "from": "agent", "payload": {"message": "Need to check test results"}}

// Agent makes tool calls within reasoning context
{"context": "msg-101", "kind": "mcp.request", "from": "agent", "payload": {"method": "tools/call", "params": {"name": "get_test_results"}}}

{"context": "msg-101", "kind": "reasoning.thought", "from": "agent", "payload": {"message": "Security tests are failing - this is concerning"}}

{"context": "msg-101", "kind": "mcp.request", "from": "agent", "payload": {"method": "tools/call", "params": {"name": "check_rollback_plan"}}}

{"context": "msg-101", "kind": "reasoning.thought", "from": "agent", "payload": {"message": "Even with rollback, auth failures are too risky"}}

// Agent concludes reasoning within context
{"context": "msg-101", "kind": "reasoning.conclusion", "from": "agent", "payload": {"message": "Deployment is unsafe due to test failures"}}

// Agent provides actual response (no context, correlated to original)
{"id": "msg-108", "kind": "chat", "from": "agent", "correlationId": "msg-100", "payload": {"message": "I recommend against deploying. The security tests are failing and auth issues are too risky even with a rollback plan."}}
```

#### Example Flow (Multiple Agents Reasoning):
```json
// User asks for multiple perspectives
{"id": "msg-200", "kind": "chat", "from": "user", "payload": {"message": "Should we deploy this auth change?"}}

// Security agent starts reasoning (creates its context)
{"id": "msg-201", "kind": "reasoning.start", "from": "security-agent", "correlationId": "msg-200", "payload": {"message": "Checking security implications..."}}

// Performance agent starts reasoning (creates separate context)
{"id": "msg-202", "kind": "reasoning.start", "from": "perf-agent", "correlationId": "msg-200", "payload": {"message": "Analyzing performance impact..."}}

// Security agent's reasoning (in its context)
{"context": "msg-201", "kind": "reasoning.thought", "from": "security-agent", "payload": {"message": "Auth changes need careful review"}}
{"context": "msg-201", "kind": "mcp.request", "from": "security-agent", "payload": {"method": "tools/call", "params": {"name": "security_scan"}}}
{"context": "msg-201", "kind": "reasoning.thought", "from": "security-agent", "payload": {"message": "Found vulnerabilities in token handling"}}
{"context": "msg-201", "kind": "reasoning.conclusion", "from": "security-agent", "payload": {"message": "Security risk is too high"}}

// Performance agent's reasoning (in its context, potentially parallel)
{"context": "msg-202", "kind": "reasoning.thought", "from": "perf-agent", "payload": {"message": "Checking latency impact"}}
{"context": "msg-202", "kind": "mcp.request", "from": "perf-agent", "payload": {"method": "tools/call", "params": {"name": "load_test"}}}
{"context": "msg-202", "kind": "reasoning.thought", "from": "perf-agent", "payload": {"message": "Minimal performance impact detected"}}
{"context": "msg-202", "kind": "reasoning.conclusion", "from": "perf-agent", "payload": {"message": "Performance is acceptable"}}

// Agents provide their responses
{"id": "msg-210", "kind": "chat", "from": "security-agent", "correlationId": "msg-200", "payload": {"message": "Security perspective: Do not deploy. Critical vulnerabilities found in token handling."}}
{"id": "msg-211", "kind": "chat", "from": "perf-agent", "correlationId": "msg-200", "payload": {"message": "Performance perspective: Safe to deploy. Minimal impact on latency."}}
```

**Key Pattern (Improved):**
1. User sends question/request
2. Agent sends `reasoning.start` at TOP LEVEL (not in context) with correlationId to question
3. The `reasoning.start` message ID becomes the context for subsequent reasoning
4. Agent uses that message ID as context for all reasoning messages
5. Agent sends `reasoning.conclusion` within that context
6. Agent sends final `chat` response at top level with correlationId to original

**Benefits of This Pattern:**
- **Visibility**: All `reasoning.start` messages visible at top level
- **Parallel reasoning**: Multiple agents can reason simultaneously in separate contexts
- **Clean namespacing**: Each agent's reasoning contained in their own context
- **Easy filtering**: Can show/hide each agent's reasoning independently
- **Clear attribution**: Context ID tells you which agent is reasoning

**Pros:**
- **Minimal new kinds** - Just 3, all using chat-like payload
- **Fast signaling** - Start/conclusion can be empty for speed
- **Clear boundaries** - Explicit start and end of reasoning
- **Simple payload** - Reuses chat's message field
- **Non-blocking** - Can signal reasoning start immediately
- **Clean correlation** - reasoning.start correlates to trigger, final chat correlates to original

**Cons:**
- Still requires new message kinds
- Less semantic richness than Option 4
- No structured metadata (confidence, factors, etc.)

#### Potential Enhancements:

**1. Nested Reasoning Contexts**
```json
// Main reasoning starts
{"id": "msg-301", "kind": "reasoning.start", "from": "agent", "correlationId": "msg-300", "payload": {"message": "Analyzing request"}}

// Agent needs to do sub-reasoning
{"context": "msg-301", "id": "msg-302", "kind": "reasoning.start", "from": "agent", "payload": {"message": "Deep dive into security"}}

// Sub-reasoning uses path notation
{"context": "msg-301/msg-302", "kind": "reasoning.thought", "from": "agent", "payload": {"message": "Checking permissions..."}}
{"context": "msg-301/msg-302", "kind": "reasoning.conclusion", "from": "agent", "payload": {"message": "Security check passed"}}

// Back to main reasoning
{"context": "msg-301", "kind": "reasoning.thought", "from": "agent", "payload": {"message": "Security is fine, checking performance..."}}
```

**2. Reasoning References**
Allow reasoning to reference other messages or data:
```json
{"id": "msg-401", "kind": "reasoning.start", "from": "agent", "correlationId": "msg-400", "payload": {
  "message": "Analyzing deployment", 
  "references": ["msg-380", "msg-390"]  // Building on previous context
}}
```

**3. Collaborative Reasoning**
Multiple agents can contribute to the same reasoning context:
```json
// Agent A starts reasoning
{"id": "msg-501", "kind": "reasoning.start", "from": "agent-a", "correlationId": "msg-500"}

// Agent A shares a thought
{"id": "msg-502", "context": "msg-501", "kind": "reasoning.thought", "from": "agent-a", "payload": {"message": "I think we should check performance first"}}

// Agent B responds to A's thought with a question
{"id": "msg-503", "context": "msg-501", "kind": "reasoning.thought", "from": "agent-b", "correlationId": "msg-502", "payload": {"message": "Have you considered the cache impact?"}}

// Agent A replies to B's question
{"id": "msg-504", "context": "msg-501", "kind": "reasoning.thought", "from": "agent-a", "correlationId": "msg-503", "payload": {"message": "Good point, let me check cache..."}}

// Agent A shares findings
{"id": "msg-505", "context": "msg-501", "kind": "reasoning.thought", "from": "agent-a", "payload": {"message": "Cache impact is minimal, proceeding with performance check"}}
```

**4. Reasoning Metadata (Optional Extension)**
While keeping the simple message format, could add optional metadata:
```json
{"id": "msg-601", "kind": "reasoning.start", "from": "agent", "correlationId": "msg-600", "payload": {
  "message": "Analyzing request",
  "metadata": {
    "approach": "security-first",
    "estimated_duration": "30s",
    "confidence": 0.7
  }
}}
```

### Option 6: Hierarchical Context Paths

Use nested context paths to show reasoning depth.

```json
{"context": "reason-123", "kind": "chat", "payload": {"message": "Starting analysis"}}
{"context": "reason-123/security", "kind": "chat", "payload": {"message": "Checking security"}}
{"context": "reason-123/security/perms", "kind": "mcp.request", "payload": {...}}
{"context": "reason-123/performance", "kind": "chat", "payload": {"message": "Checking performance"}}
{"context": "reason-123", "kind": "chat", "payload": {"message": "Analysis complete"}}
```

**Pros:**
- Shows reasoning structure
- Natural sub-problem decomposition
- Powerful filtering options
- No new message kinds

**Cons:**
- Paths can get long
- No formal reasoning structure
- Complexity in path management

### Option 6: Separate Reasoning Channel

Create entirely separate spaces for agent reasoning.

**Pros:**
- Complete separation of concerns
- No impact on main conversation
- Can have different access controls

**Cons:**
- Complex to correlate reasoning with actions
- Requires managing multiple connections
- Loses the benefit of shared context
- Harder to trace decision chains

## Comparison Matrix

| Option | New Kinds | Structure | Filtering | Complexity | Speed |
|--------|-----------|-----------|-----------|------------|-------|
| 1. Status Quo | None | None | N/A | Very Low | N/A |
| 2. Inline | None | None | Hard | Low | Slow |
| 3. Context + Regular | None | Context only | By context | Low | Medium |
| 4. Context + Rich Reasoning | 6+ kinds | Both | By both | High | Slow |
| 5. Context + Simple Reasoning | 3 kinds | Both | By both | Medium | Fast |
| 6. Hierarchical | None | Path hierarchy | By path | Medium | Medium |
| 7. Separate Channel | Maybe | Separate | By channel | High | Medium |

## Recommendation

**Option 5 (Simplified Reasoning Kinds)** strikes the best balance:

- **Just 3 new kinds** that mirror chat structure
- **Non-blocking** - Can signal reasoning start immediately
- **Clear boundaries** - Explicit start/end of reasoning
- **Simple payload** - Reuses familiar chat message format
- **Clean correlation** - Clear relationships between messages
- **Supports all use cases** - Debugging, learning, audit trails

This provides structured reasoning transparency without the complexity of Option 4 or the ambiguity of Option 3.

## Implementation Details

*To be determined based on selected option*

### Example Reasoning Flows

#### Option 3: Context + Regular Messages
```json
// User request
{"kind": "chat", "from": "user", "payload": {"message": "Can you check if this file write is safe?"}}

// Agent reasoning (in context)
{"context": "reason-789", "kind": "chat", "from": "agent", "payload": {"message": "Let me check the file permissions..."}}
{"context": "reason-789", "kind": "mcp.request", "from": "agent", "payload": {"method": "tools/call", "params": {"name": "check_permissions"}}}
{"context": "reason-789", "kind": "chat", "from": "agent", "payload": {"message": "The location requires elevated permissions, this could be risky"}}

// Agent conclusion (back to main context)
{"kind": "chat", "from": "agent", "payload": {"message": "This file write is not safe due to permission requirements"}}
```

#### Option 4: Context + Reasoning Kinds
```json
// User request
{"kind": "chat", "from": "user", "payload": {"message": "Can you check if this file write is safe?"}}

// Agent reasoning (structured)
{"context": "reason-789", "kind": "reasoning.start", "from": "agent", "payload": {"goal": "Evaluate file write safety"}}
{"context": "reason-789", "kind": "reasoning.thought", "from": "agent", "payload": {"content": "Need to check permissions"}}
{"context": "reason-789", "kind": "mcp.request", "from": "agent", "payload": {"method": "tools/call", "params": {"name": "check_permissions"}}}
{"context": "reason-789", "kind": "reasoning.observation", "from": "agent", "payload": {"content": "Elevated permissions required"}}
{"context": "reason-789", "kind": "reasoning.conclusion", "from": "agent", "payload": {"decision": "Unsafe", "confidence": 0.92}}

// Agent response
{"kind": "chat", "from": "agent", "correlationId": "reason-789", "payload": {"message": "This file write is not safe"}}
```

#### Option 5: Hierarchical Paths
```json
// User request
{"kind": "chat", "from": "user", "payload": {"message": "Can you check if this file write is safe?"}}

// Agent reasoning (hierarchical)
{"context": "reason-789", "kind": "chat", "from": "agent", "payload": {"message": "Starting safety analysis"}}
{"context": "reason-789/permissions", "kind": "chat", "from": "agent", "payload": {"message": "Checking permissions"}}
{"context": "reason-789/permissions", "kind": "mcp.request", "from": "agent", "payload": {"method": "tools/call"}}
{"context": "reason-789/permissions/result", "kind": "chat", "from": "agent", "payload": {"message": "Requires elevated access"}}
{"context": "reason-789/risk-assessment", "kind": "chat", "from": "agent", "payload": {"message": "Evaluating risk level"}}
{"context": "reason-789", "kind": "chat", "from": "agent", "payload": {"message": "Analysis complete: unsafe"}}

// Agent response
{"kind": "chat", "from": "agent", "payload": {"message": "This file write is not safe"}}
```


### Participant Behavior

**For Reasoning Agents (all options):**
- SHOULD use context field when sharing reasoning
- MUST ensure context IDs are unique within the space
- MAY use hierarchical paths for complex reasoning
- SHOULD return to main context (no context field) for final responses

**For Observing Participants:**
- MAY filter messages by context to hide/show reasoning
- MUST still process protocol messages (mcp.request, mcp.proposal) in any context
- MAY use context paths to understand reasoning structure
- SHOULD correlate final responses with reasoning context via correlation_id

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
- **Message Volume**: Potential for significant increase in space traffic
- **Performance Impact**: Processing and storing reasoning chains
- **Privacy Concerns**: Reasoning might expose proprietary algorithms
- **Context Management**: Participants need strategies for handling reasoning noise

## Security Considerations

- Reasoning messages could expose internal agent logic or training patterns
- Malicious agents could flood spaces with excessive reasoning messages
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
- Cross-space reasoning correlation
- Reasoning replay for training new agents
- Standardized confidence and uncertainty metrics