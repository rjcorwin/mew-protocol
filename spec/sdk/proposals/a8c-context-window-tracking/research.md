# Research: Context Window Usage Tracking

**Proposal Code:** a8c
**Research Date:** 2025-01-10
**Status:** Complete

## Purpose

This research document explores how to accurately track context window usage in MEW agents. It examines the current estimation approach, investigates OpenAI API usage data, and evaluates implementation options.

## Problem Context

MEW agents maintain conversation history to provide context-aware responses. As conversations grow, the history consumes more of the model's context window (e.g., 128k tokens for GPT-4o). The agent needs to know "how full is my context window?" to make informed decisions about when to compact history.

**Key question:** How can we accurately measure context window usage instead of estimating it?

## Current Approach

### Token Estimation

```typescript
// src/participant/MEWParticipant.ts:675
protected estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
```

**Method:** Character-based estimation (`text.length / 4`)

**Accumulation:** Estimates are accumulated across multiple message additions:
- Chat message sending
- Chat message receiving
- Reasoning thoughts
- Tool calls
- Observations
- Assistant responses

### Problems with Estimation

1. **Inaccurate tokenization**: Character count doesn't match model's actual tokenization
2. **Error accumulation**: Small errors compound over many messages
3. **Model-agnostic**: Same estimation for all models (GPT-4, GPT-3.5, o1, etc.)
4. **Conservative behavior**: Uncertainty leads to early compaction

### Impact

- **Poor compaction decisions**: May compact too early or too late
- **Inaccurate status reports**: Other participants see estimated (not actual) usage
- **Risk of hitting limits**: Can't accurately predict when we're approaching capacity

## Available Data from OpenAI API

### Response Structure

Every OpenAI API response includes a `usage` object:

```typescript
{
  id: "chatcmpl-123",
  object: "chat.completion",
  model: "gpt-4o",
  choices: [...],
  usage: {
    prompt_tokens: 50,      // Input: system + history + message + tools
    completion_tokens: 12,  // Output: assistant's response
    total_tokens: 62        // Sum of prompt + completion
  }
}
```

### Token Meanings

**`prompt_tokens`**: What we sent to the model
- System prompt
- Conversation history
- Current user message
- Tool definitions
- Previous reasoning thoughts

**`completion_tokens`**: What the model generated
- Assistant's response text
- Tool call JSON
- Reasoning output

**`total_tokens`**: `prompt_tokens + completion_tokens`
- Total tokens for this request
- Becomes the new context size (completion added to history)

### Streaming Responses

Usage data is available in streaming mode:

```typescript
// Requires: stream_options: { include_usage: true }
for await (const chunk of stream) {
  // ... process chunks ...

  // Final chunk contains usage
  if (chunk.usage) {
    console.log(chunk.usage.total_tokens);
  }
}
```

**Current status**: We already request usage via `stream_options` but don't capture it!

## Research Questions

### Q1: What metric represents context window usage?

**Options considered:**
- A) `prompt_tokens` only
- B) `prompt_tokens + completion_tokens` (= `total_tokens`)
- C) Track both separately

**Analysis:**
- `prompt_tokens` = what's in context **right now** (before this call)
- `completion_tokens` = what **will be** in context (after this call)
- Therefore: `total_tokens` = context usage **after this call completes**

**Example flow:**
```
Call 1: total = 60 (50 prompt + 10 completion)
→ Context: 60 tokens

Call 2: prompt = 70 (includes previous 10 completion)
        total = 82 (70 prompt + 12 completion)
→ Context: 82 tokens

Call 3: prompt = 82+ (includes previous 12 completion)
```

**Conclusion:** Use `total_tokens` - it represents current context state

### Q2: Should we accumulate or replace?

**Options considered:**
- A) Accumulate estimates + actual tokens
- B) Replace estimates with actual on each call
- C) Hybrid: estimate between calls, replace on calls

**Analysis:**
- Accumulation compounds error (estimates + actuals don't align)
- Each API call gives us the complete picture
- Between calls, "last known value" is sufficient

**Conclusion:** Replace `contextTokens` with `total_tokens` on each reasoning call

### Q3: When should we capture usage?

**LLM call types in MEWAgent:**
1. **Main reasoning calls** (`createStreamingReasoning`) - Include full conversation history
2. **Classification calls** (`classifyChat`) - One-off, no conversation history
3. **Standard reasoning fallback** (`createStandardReasoning`) - Backup for streaming

**Analysis:**
- Only reasoning calls include full conversation history
- Classification calls don't affect context management
- Standard reasoning is rare (streaming usually succeeds)

**Conclusion:** Capture usage only from main reasoning calls (both streaming and standard)

### Q4: How to handle streaming vs non-streaming?

**Current implementation:**
```typescript
private async createStreamingReasoning(messages: any[], tools: LLMTool[]): Promise<any> {
  const params = {
    stream: true,
    stream_options: { include_usage: true }  // ✅ Already requesting!
  };

  const stream = await this.openai.chat.completions.create(params);
  const aggregated: any = { content: '' };

  for await (const part of stream as any) {
    // ❓ Where do we capture part.usage?
  }

  return aggregated;
}
```

**Finding:** We request usage but don't capture it from the stream!

**Solution:** Capture `usage` from final chunk and include in returned object

### Q5: Do we need backward compatibility?

**Current status reporting:**
```typescript
interface ParticipantStatusPayload {
  tokens: number;           // Currently: accumulated estimates
  max_tokens: number;
  messages_in_context: number;
  status?: string;
}
```

**Analysis:**
- `tokens` field already represents "context usage"
- Consumers interpret it as "how full is the context window"
- We're just changing the source from estimates to actuals
- Same semantic meaning, better accuracy

**Conclusion:** Fully backward compatible - no protocol changes needed

### Q6: What about tool call tokens?

**Question:** Do we need to separately track tokens from tool calls and results?

**Analysis:**
- Tool call arguments are part of `completion_tokens` (when called)
- Tool results are added to conversation history (as messages)
- Next LLM call includes tool results in `prompt_tokens`
- The `total_tokens` from each call already includes everything

**Conclusion:** No separate tracking needed - automatic inclusion

### Q7: What happens between LLM calls?

**Question:** Is context usage stale between reasoning calls?

**Analysis:**
- Yes, `contextTokens` represents "last known state"
- Between calls, messages are added but count isn't updated
- This is acceptable: we only need accuracy when deciding to compact
- Compaction decisions happen during/after LLM calls

**Conclusion:** Stale values between calls are acceptable

## Implementation Considerations

### Simplicity

**Minimal changes required:**
- Capture `usage` from streaming responses (2 lines)
- Set `contextTokens = usage.total_tokens` (1 line)
- Remove estimation recording sites (delete 6 lines)
- Update default max tokens (1 line)

### No New Structures

**Reuse existing fields:**
- `contextTokens` - Same field, new data source
- `contextMaxTokens` - Same field, updated default
- `contextMessages` - No change

### Backward Compatibility

**No protocol changes:**
- Status payload structure unchanged
- Message formats unchanged
- Capability patterns unchanged

### Testing

**Mock response format:**
```typescript
const mockResponse = {
  choices: [{ message: { content: 'Test' } }],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 20,
    total_tokens: 120
  }
};
```

## Alternative Approaches Considered

### Alternative 1: Use tiktoken Library

**Pros:**
- Pre-call token counting
- Model-specific tokenization
- No API dependency for estimation

**Cons:**
- Adds dependency
- Still an estimate (may differ from API)
- Requires model specification
- More complex than using API data

**Verdict:** Rejected - API gives exact counts

### Alternative 2: Track All Token Types

**Pros:**
- Detailed analytics
- Cost tracking possible
- Separate prompt/completion visibility

**Cons:**
- Over-engineering for context management
- More complex data structures
- Only need "how full is context window"

**Verdict:** Rejected - `total_tokens` sufficient

### Alternative 3: Accumulate with Correction

**Pros:**
- Maintains continuity
- Real-time updates between calls

**Cons:**
- Complex correction logic
- Estimates + actuals don't align
- Accumulates error anyway

**Verdict:** Rejected - simpler to replace

## Risks and Mitigations

### Risk: Missing Usage Data

**Scenario:** API doesn't return `usage` field

**Likelihood:** Very low (OpenAI always includes it)

**Mitigation:** Keep `estimateTokens()` as fallback

### Risk: Stale Between Calls

**Scenario:** `contextTokens` outdated between reasoning calls

**Impact:** Low - only matters when deciding to compact

**Mitigation:** None needed - acceptable behavior

### Risk: Test Compatibility

**Scenario:** Existing tests don't include `usage` in mocks

**Impact:** Tests fail after implementation

**Mitigation:** Update test mocks to include `usage` object

## Prior Art

### OpenAI Python SDK
```python
response = openai.ChatCompletion.create(...)
print(f"Used {response.usage.total_tokens} tokens")
```

### OpenAI Node.js SDK
```typescript
const response = await openai.chat.completions.create({...});
console.log(`Used ${response.usage?.total_tokens} tokens`);
```

### Token Counting Libraries

**tiktoken** (OpenAI official):
- Accurate pre-call estimation
- Requires model specification
- Used by OpenAI internally

**gpt-3-encoder** (Community):
- JavaScript implementation
- GPT-3 only
- May not match current models

## Recommendations

Based on this research:

1. **Use `total_tokens` from API responses** - Exact count of context window usage
2. **Replace estimation** - Stop accumulating character-based estimates
3. **Capture only reasoning calls** - Main calls that include full history
4. **Keep existing structures** - No new fields or protocol changes
5. **Maintain backward compatibility** - Same semantic meaning, better accuracy

## Next Steps

See `proposal.md` and `decision-a8c-context-window-tracking.md` for implementation details.

## References

- [OpenAI API Reference - Chat Completions](https://platform.openai.com/docs/api-reference/chat/create)
- [OpenAI Cookbook - Token Counting](https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken)
- [tiktoken on GitHub](https://github.com/openai/tiktoken)
- [OpenAI Node.js SDK](https://github.com/openai/openai-node)
