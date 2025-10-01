# Scenario 14-cat-maze - ESM/CJS Module Issue

## Status
⚠️ Refactor complete, test fails due to module type mismatch

## Refactor Changes Completed
- ✅ Updated check.sh to use global `mew` command
- ✅ Updated setup.sh template paths:
  - `cli/templates/cat-maze/agents/cat-maze-server.js` → `packages/mew/templates/cat-maze/agents/cat-maze-server.js`
  - `cli/templates/cat-maze/agents/cat-maze-narrator.js` → `packages/mew/templates/cat-maze/agents/cat-maze-narrator.js`
- ✅ teardown.sh was already correct (no CLI references)

## Issue
**ReferenceError: require is not defined in ES module scope**

The cat-maze template agent files (cat-maze-server.js, cat-maze-narrator.js) are CommonJS files using `require()`, but because they're now located in `packages/mew/templates/` and `packages/mew/package.json` has `"type": "module"`, Node treats `.js` files as ESM modules.

## Error Message
```
ReferenceError: require is not defined in ES module scope, you can use import instead
This file is being treated as an ES module because it has a '.js' file extension and
'/Users/rj/Git/rjcorwin/mew-protocol/packages/mew/package.json' contains "type": "module".
To treat it as a CommonJS script, rename it to use the '.cjs' file extension.
```

## Root Cause
During the repository consolidation, templates moved from `cli/templates/` (which had no package.json) to `packages/mew/templates/` (which inherits the parent's `"type": "module"` setting).

## Solutions (Pick One)

### Option 1: Rename template agents to .cjs
Rename all CommonJS template files to use `.cjs` extension:
- `cat-maze-server.js` → `cat-maze-server.cjs`
- `cat-maze-narrator.js` → `cat-maze-narrator.cjs`
- Update references in space.yaml templates

### Option 2: Convert template agents to ESM
Convert the template agents from CommonJS to ESM:
- Replace `require()` with `import`
- Replace `module.exports` with `export`

### Option 3: Add package.json to templates directory
Add a `packages/mew/templates/package.json` with `{"type": "commonjs"}` to override the parent setting.

## Recommendation
**Option 1** (rename to .cjs) is the quickest fix and maintains backward compatibility. The template agents are simple scripts that don't need ESM features.

## Next Steps
1. Choose and implement one of the solutions above
2. Re-run the test to verify it passes
