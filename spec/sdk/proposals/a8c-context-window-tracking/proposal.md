# Proposal a8c: Context Window Usage Tracking

**Status:** Accepted
**Date:** 2025-01-10
**Area:** SDK (MEWAgent)
**Tracking:** See CHANGELOG.md

## Summary

Replace token estimation with actual token counts from OpenAI API responses to accurately track context window usage. This enables better context management decisions and accurate status reporting.

## Motivation

### Current Problem

MEW agents track context window usage to decide when to compact conversation history. Currently:

```typescript
// Estimation (current approach)
protected estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Accumulated across messages
this.recordContextUsage({ tokens: this.estimateTokens(text), messages: 1 });
```

**Issues:**
- Estimation doesn't match actual tokenization
- Error accumulates over multiple messages
- Different models tokenize differently
- Leads to conservative compaction (compact too early)
- Can't accurately report to other participants

### Why This Matters

Accurate context tracking enables:
1. **Optimal compaction**: Maintain maximum history without hitting limits
2. **Better collaboration**: Other participants see accurate context status
3. **Predictable behavior**: Agent compacts at consistent thresholds
4. **Model flexibility**: Works with any OpenAI-compatible model

### Opportunity

OpenAI API returns exact token counts in every response:

```typescript
{
  usage: {
    prompt_tokens: 50,      // Input tokens
    completion_tokens: 12,  // Output tokens
    total_tokens: 62        // Sum (our context usage)
  }
}
```

We already request this via `stream_options: { include_usage: true }` but don't capture it.

## Goals

### Primary Goals

1. **Accurate context tracking**: Use actual token counts from API
2. **Simple implementation**: Minimal code changes, no new structures
3. **Backward compatible**: No protocol or API changes

### Non-Goals

- Cost tracking or analytics
- Per-message token statistics
- Token counting for non-reasoning LLM calls
- Historical token usage trends

## Technical Design

### Overview

After each main reasoning LLM call, replace `contextTokens` with `total_tokens` from the API response:

```typescript
const message = await this.createStreamingReasoning(messages, tools);

if (message.usage?.total_tokens) {
  this.contextTokens = message.usage.total_tokens;
}
```

### Why total_tokens?

`total_tokens = prompt_tokens + completion_tokens`

This represents actual context window usage because:
- `prompt_tokens` = what we sent (history + current message)
- `completion_tokens` = model's response (added to history immediately)
- Together = context state after this call

**Example:**
```typescript
// Call 1: User asks "What is 2+2?"
response.usage = {
  prompt_tokens: 50,      // System + message + tools
  completion_tokens: 10,  // "The answer is 4"
  total_tokens: 60
}
// Context after call: 60 tokens

// Call 2: User asks "What about 3+3?"
response.usage = {
  prompt_tokens: 70,      // 50 + 10 (our response) + 10 (new message)
  completion_tokens: 12,  // "The answer is 6"
  total_tokens: 82
}
// Context after call: 82 tokens
```

### Implementation Steps

#### Step 1: Capture usage from streaming responses

**File:** `src/agent/MEWAgent.ts` (~line 920-994)

```typescript
private async createStreamingReasoning(messages: any[], tools: LLMTool[]): Promise<any> {
  const params: any = {
    model: this.config.model!,
    messages,
    stream: true,
    stream_options: { include_usage: true }
  };

  const stream = await this.openai.chat.completions.create(params);
  const aggregated: any = { content: '' };

  for await (const part of stream as any) {
    // ... existing chunk processing ...

    // ✅ ADD: Capture usage from final chunk
    if (part.usage) {
      aggregated.usage = part.usage;
    }
  }

  return aggregated;
}
```

#### Step 2: Update context with actual usage

**File:** `src/agent/MEWAgent.ts` (~line 1060-1192, in `reason()` method)

```typescript
// After streaming call
const message = await this.createStreamingReasoning(messages, tools);

// ✅ ADD: Update context with actual usage
if (message.usage?.total_tokens) {
  this.contextTokens = message.usage.total_tokens;
}

// Also handle non-streaming fallback
if (!streamed) {
  message = await this.createStandardReasoning(messages, tools);
  if (message.usage?.total_tokens) {
    this.contextTokens = message.usage.total_tokens;
  }
}
```

#### Step 3: Remove estimation calls

**Delete these lines:**
- `MEWParticipant.ts:291` - Chat sending estimate
- `MEWParticipant.ts:753` - Chat receiving estimate
- `MEWAgent.ts:814` - Reasoning thought estimate
- `MEWAgent.ts:837` - Tool call estimate
- `MEWAgent.ts:854` - Observation estimate
- `MEWAgent.ts:1435` - Response estimate

**Rationale:** The API's `total_tokens` is the single source of truth. Accumulating estimates adds error.

#### Step 4: Update default context limit

**File:** `src/participant/MEWParticipant.ts` (~line 106)

```typescript
// Change from:
private contextMaxTokens = 20000;

// To:
private contextMaxTokens = 128000;  // Match GPT-4o default
```

### What Doesn't Change

- `contextTokens` field remains (just updated differently)
- `ParticipantStatusPayload` structure unchanged
- `estimateTokens()` method kept as fallback
- Protocol messages unchanged
- Status reporting unchanged

### Scope

**Track:**
- Main reasoning LLM calls (with full conversation history)

**Don't track:**
- Classification calls (`shouldRespondToChat`)
- One-off utility LLM calls
- Individual messages between LLM calls

Between reasoning calls, `contextTokens` represents "last known context usage" which is sufficient for compaction decisions.

## Testing Strategy

### Unit Tests

Add `usage` to mocked OpenAI responses:

```typescript
const mockResponse = {
  choices: [{ message: { content: 'Test response' } }],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 20,
    total_tokens: 120
  }
};

// Verify contextTokens updated
expect(agent.getContextTokens()).toBe(120);
```

### Integration Tests

1. **Context tracking**: Verify `contextTokens` matches API `total_tokens`
2. **Compaction trigger**: Verify compaction at correct threshold (90% of limit)
3. **Status reporting**: Verify reported tokens match actual usage
4. **Streaming**: Verify usage captured from stream final chunk

### Edge Cases

1. **Missing usage data**: Verify graceful handling if API doesn't return usage
2. **Model switching**: Verify works with different models
3. **Error responses**: Verify context not updated on API errors

## Migration

### Code Changes

- No breaking changes
- No API changes
- No protocol changes
- No data structure changes

### For Developers

- Update tests to include `usage` in mocked responses
- No changes needed for existing code using status reports

### For Users

- More accurate context usage reporting
- Better compaction timing (closer to actual limits)
- No configuration changes needed

## Performance Impact

### Positive

- Fewer unnecessary compactions (better accuracy)
- Simpler code (fewer estimation calls)

### Neutral

- Same API call overhead (already requesting usage)
- Same memory usage (reusing existing field)

## Security Considerations

- No security implications
- No new data exposure
- Token counts already available in logs

## Future Enhancements

This proposal enables future work on:

1. **Cost tracking**: Could track `completion_tokens` separately for cost calculations
2. **Token analytics**: Could log token usage trends over time
3. **Model detection**: Could detect model from response and adjust limits
4. **Pre-call estimation**: Could integrate tiktoken for pre-call token counting

These are NOT part of this proposal but become easier with accurate usage data.

## References

- Decision record: `decision-a8c-context-window-tracking.md`
- Research document: `research.md`
- OpenAI API docs: https://platform.openai.com/docs/api-reference/chat/create
- SDK spec: `spec/sdk/SPEC.md`
- Protocol spec: `spec/protocol/SPEC.md`

## Timeline

1. **Proposal approval**: Review and approve this proposal
2. **Implementation**: ~1 hour (simple changes)
3. **Testing**: ~1 hour (update test mocks)
4. **Documentation**: Update SDK spec with new behavior
5. **Release**: Include in next SDK release
