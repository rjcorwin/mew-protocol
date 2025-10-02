# Scenario 14-cat-maze - RESOLVED

## Status
✅ Fixed and passing

## Issue
ReferenceError: require is not defined in ES module scope

The cat-maze template agent files used CommonJS (`require()`) but were treated as ESM modules because they're located in `packages/mew/templates/` which inherits `"type": "module"` from the parent package.json.

## Root Cause
During repository consolidation, templates moved from `cli/templates/` (no package.json) to `packages/mew/templates/` (inherits parent's `"type": "module"`). Node.js treats `.js` files in this directory as ESM, causing the require() calls to fail.

## Solution
Renamed CommonJS template files to use `.cjs` extension:
- `cat-maze-server.js` → `cat-maze-server.cjs`
- `cat-maze-narrator.js` → `cat-maze-narrator.cjs`

Updated test setup.sh to reference the new filenames.

## Test Results
All tests now pass:
- ✓ cat-maze template advertised by mew init
- ✓ Cat maze run completed successfully
- ✓ Narrator relayed move results with walkway tiles

## Files Changed
- `packages/mew/templates/cat-maze/agents/cat-maze-server.js` → `.cjs`
- `packages/mew/templates/cat-maze/agents/cat-maze-narrator.js` → `.cjs`
- `tests/scenario-14-cat-maze/setup.sh` - Updated file paths

## Notes
The `.cjs` extension explicitly tells Node.js to treat these files as CommonJS modules regardless of the parent package.json settings. This is the quickest fix and maintains backward compatibility.

The built MCP server at `src/mcp-servers/cat-maze.ts` is separate and unaffected by this change.
