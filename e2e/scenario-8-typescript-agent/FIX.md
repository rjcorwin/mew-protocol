# Scenario 8-typescript-agent - RESOLVED

## Status
✅ Fixed and passing

## Issue
Test timeout during checks phase - the TypeScript agent never connected to the gateway.

## Root Cause
The agent's `packages/mew/src/agent/index.ts` defined a `main()` function but never called it. The process would start, load the module, but immediately exit without executing any code.

## Solution
Added main() invocation at the end of `packages/mew/src/agent/index.ts`:

```typescript
// Run main if executed directly (not imported as a module)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
```

This ensures the agent actually starts when the file is executed directly (as opposed to being imported as a module).

## Additional Fixes (for consistency with `mew agent run`)

While fixing this issue, we also improved the `mew agent run` CLI command to:

1. **Read MEW_AGENT_CONFIG** environment variable (packages/mew/src/cli/commands/agent.ts:264-272):
   ```typescript
   if (process.env.MEW_AGENT_CONFIG) {
     try {
       const envConfig = JSON.parse(process.env.MEW_AGENT_CONFIG);
       agentConfig = { ...agentConfig, ...envConfig };
     } catch (error: any) {
       console.error('Failed to parse MEW_AGENT_CONFIG:', error.message);
     }
   }
   ```

2. **Use `start()` instead of `connect()`** (packages/mew/src/cli/commands/agent.ts:276):
   ```typescript
   await agent.start();  // was: await agent.connect()
   ```

   The `start()` method calls `connect()` and also sets `isRunning = true`, which is needed for the agent to function properly.

## Test Results
All 7 tests now pass:
- ✓ Gateway health endpoint
- ✓ TypeScript agent connected
- ✓ Tools list includes calculate
- ✓ Addition result returned (5 + 3 = 8)
- ✓ Multiplication result returned (7 × 6 = 42)
- ✓ Echo tool returned message
- ✓ Agent responded to chat

## Files Changed
- `packages/mew/src/agent/index.ts` - Added main() invocation for CLI execution
- `packages/mew/src/cli/commands/agent.ts` - Added MEW_AGENT_CONFIG support and fixed to use start()
- `packages/mew/dist/` - Rebuilt from source

## Agent Invocation Approaches

The test currently uses direct node invocation for testing a different code path:
```yaml
command: "node"
args: ["../../../packages/mew/dist/agent/index.js", ...]
```

The coder-agent template uses the CLI command:
```yaml
command: "mew"
args: ["agent", "run", ...]
```

Both approaches now work correctly. The direct invocation tests the module's main() entry point, while the CLI command tests the commander.js integration.

## Notes
The refactor changes from repo restructuring were already complete and correct. This was a functional bug in the agent implementation unrelated to the restructuring.
