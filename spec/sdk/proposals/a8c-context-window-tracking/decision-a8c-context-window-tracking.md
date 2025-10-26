# ADR-a8c: Context Window Usage Tracking

**Status:** Accepted
**Date:** 2025-01-10
**Area:** SDK (MEWAgent)

## Context

MEW agents maintain conversation history to provide context-aware responses. As conversations grow, the history consumes more of the model's context window (e.g., 128k tokens for GPT-4o). The agent needs to know "how full is my context window?" to make informed decisions about when to compact history.

Currently, the SDK estimates token usage using a simple heuristic: `Math.ceil(text.length / 4)`. This estimation:
- Accumulates error over time (different tokenization than actual model)
- Doesn't match the model's actual token counting
- Leads to conservative compaction (compacting too early)
- Can't warn accurately about approaching limits

OpenAI's API returns actual token usage in the `usage` field of every completion response, including `prompt_tokens`, `completion_tokens`, and `total_tokens`. We already request this data via `stream_options: { include_usage: true }` but don't capture it.

## Decision

**Use `total_tokens` from OpenAI API responses to track context window usage.**

After each main reasoning LLM call, set `contextTokens = response.usage.total_tokens`. This represents the actual context window usage because:

1. `prompt_tokens` = current input (system prompt + history + current message + tools)
2. `completion_tokens` = model's response (will be added to history)
3. `total_tokens` = `prompt_tokens + completion_tokens` = actual context after this call

The next LLM call will include the current completion in its prompt, so `total_tokens` accurately represents our current context window state.

## Implementation

### What Changes

**Add** (2 locations):
1. Capture `usage` from streaming response final chunk (`MEWAgent.ts:~940`)
2. Set `contextTokens = usage.total_tokens` after reasoning call (`MEWAgent.ts:~1160`)

**Remove** (6 locations):
- All `recordContextUsage()` calls that accumulate estimates
- Chat sending/receiving estimates
- Reasoning thought estimates
- Tool call estimates
- Observation estimates
- Response estimates

**Update** (1 location):
- Default `contextMaxTokens` from 20k → 128k (match GPT-4o)

### What Stays the Same

- No protocol changes
- No new data structures
- No API changes
- Same `ParticipantStatusPayload` fields
- `estimateTokens()` method kept as fallback

### Scope

**Track only:**
- Main reasoning LLM calls that include conversation history

**Do NOT track:**
- Classification calls (`shouldRespondToChat`)
- One-off utility LLM calls
- Individual message additions between LLM calls

## Rationale

### Why total_tokens?

`total_tokens` represents the complete context state after a call:
- Input tokens (what we sent)
- Output tokens (what we received, now part of history)
- Together = current context window usage

### Why not accumulate estimates?

Estimation accumulates error:
- Character-based estimation (`text.length / 4`) doesn't match tokenization
- Different models tokenize differently
- Error compounds over multiple messages
- API gives us the exact count

### Why only reasoning calls?

The main reasoning calls are where we:
- Send full conversation history
- Need accurate context tracking
- Make compaction decisions

Other calls (like classification) don't include full history and don't affect context management.

### Why remove all estimates?

The API's `total_tokens` is the single source of truth. Between LLM calls, we don't need updated counts - the last known value is sufficient for compaction decisions.

## Consequences

### Positive

- **Accurate tracking**: Exact token counts from the model
- **Better compaction**: Compact at the right time, not prematurely
- **Model-agnostic**: Works with any OpenAI-compatible model
- **Simple implementation**: ~10 lines of code changes
- **Backward compatible**: No protocol or API changes
- **Lower maintenance**: No manual token estimation logic

### Negative

- **Stale between calls**: Context count only updates during LLM calls
  - **Mitigation**: Acceptable - we only need accuracy when deciding to compact
- **Requires API usage data**: If API doesn't return usage, we have no count
  - **Mitigation**: Keep `estimateTokens()` as fallback (though unlikely to need it)

### Neutral

- **Testing**: Tests need to include `usage` in mocked responses
- **Monitoring**: Status reports will show accurate context usage

## Alternatives Considered

### Alternative 1: Keep Accumulating Estimates

**Rejected because:**
- Accumulates error over time
- Doesn't match actual tokenization
- More complex than using API data
- Less accurate for compaction decisions

### Alternative 2: Use tiktoken Library

**Rejected because:**
- Adds dependency
- Still an estimate (may differ from API)
- Requires specifying model
- API already gives us exact counts

### Alternative 3: Track prompt_tokens Only

**Rejected because:**
- Misses completion tokens that become part of history
- Undercounts context usage
- Would need to track completion separately anyway

### Alternative 4: Track All Token Types Separately

**Rejected because:**
- Over-engineering for context management needs
- Only need "how full is my context window"
- `total_tokens` answers that question directly

## References

- [OpenAI API Reference - Chat Completions](https://platform.openai.com/docs/api-reference/chat/create)
- Research document: `research.md` (this proposal)
- Protocol spec: `spec/protocol/SPEC.md`
- SDK spec: `spec/sdk/SPEC.md`
