# Scenario 9-typescript-proposals - RESOLVED

## Status
✅ Fixed and passing

## Issue
Test timeout - fulfiller agent failed to start due to module resolution error.

## Root Cause
The calculator-participant.js agent used `require('@mew-protocol/participant')` which doesn't exist after repository consolidation. The package was moved to `packages/mew/dist/participant/index.js`.

## Solution
Updated the require path in `template/agents/calculator-participant.js`:

```javascript
// Before:
const { MEWParticipant } = require('@mew-protocol/participant');

// After:
const { MEWParticipant } = require('../../../../../packages/mew/dist/participant/index.js');
```

The relative path navigates from `.workspace/.mew/agents/calculator-participant.js` (where the file is copied during test setup) to the consolidated participant module.

## Test Results
All 7 tests now pass:
- ✓ Gateway health endpoint
- ✓ TypeScript agent connected
- ✓ Fulfiller agent connected
- ✓ Proposal emitted for add tool
- ✓ Captured proposal metadata
- ✓ Fulfilled proposal result observed
- ✓ Direct tools/list handled

## Files Changed
- `tests/scenario-9-typescript-proposals/template/agents/calculator-participant.js` - Updated MEWParticipant require path

## Notes
The TypeScript agent also benefited from the earlier fix to `packages/mew/src/agent/index.ts` that added main() invocation for direct node execution.
