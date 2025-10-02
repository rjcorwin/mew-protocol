# Scenario 8-grant - FIXED ✅

## Status
✅ **All 16/16 tests passing**

## Issue Summary
The capability grant system was failing to resolve logical participant names to runtime client IDs when granting capabilities. This prevented agents from using dynamically granted capabilities.

## Root Cause
The gateway's capability grant handling code only looked up tokens in `tokenMap` (which contains stored/generated tokens from `.mew/tokens/` files), but didn't check the `tokens` field in `space.yaml`.

When participants joined with tokens defined in `space.yaml` (e.g., `tokens: ["agent-token"]`), the token resolution failed because:
1. Gateway loaded tokens from `space.yaml` and created files in `.mew/tokens/` with random tokens
2. Participants joined using the literal token strings from `space.yaml` (e.g., "agent-token")
3. Capability grant tried to resolve participant by looking only in `tokenMap` (which had random tokens)
4. Token mismatch → failed to find runtime client ID → capabilities never updated

## Fix Applied
Modified `gateway.ts` capability/grant handling to check both token sources in priority order:
1. **First**: Check `space.yaml` `tokens` field (for config-based tokens)
2. **Fallback**: Check `tokenMap` (for secure storage tokens)

This matches the same logic used in `defaultCapabilityResolver` for backward compatibility.

**File**: `packages/mew/src/cli/commands/gateway.ts:1154-1168`

## Test Results
All 16 tests now pass:
- ✅ Gateway health endpoint
- ✅ Proposal delivered to test-client
- ✅ Extract proposal details
- ✅ Capability grant sent
- ✅ Fulfill proposal via tools/call
- ✅ Gateway logged capability grant
- ✅ Fulfilment routed to file-server
- ✅ foo.txt created via fulfillment
- ✅ Agent observed capability grant
- ✅ Agent issued direct request
- ✅ **bar.txt created via direct request** (was failing)
- ✅ File server handled write requests
- ✅ Grant acknowledgment originates from recipient
- ✅ Gateway recorded grant acknowledgment
- ✅ **Gateway logged direct request envelope** (was failing)
- ✅ Gateway did not forge grant acknowledgment
