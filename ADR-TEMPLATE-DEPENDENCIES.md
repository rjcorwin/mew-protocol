# ADR: Template Dependency Management

**Status**: Proposed
**Date**: 2025-09-30
**Context**: Repository restructure to single package

## Problem

When users run `mew init [template]`, they want a seamless experience that starts immediately. Currently, templates include a `package.json` that triggers `npm install` during initialization, which:

1. Takes 5-60 seconds to complete
2. Creates a `.mew/node_modules/` directory in each space
3. Requires special monorepo detection logic to use local packages during development
4. Can result in version mismatches across different spaces
5. Adds complexity to the init workflow

The goal is to make `mew init` instant - just copy config files and start the space.

## Current Implementation

**Template structure:**
```
templates/coder-agent/
├── template.json
├── space.yaml
├── agents/
│   └── coder.js
└── package.json          # Includes dependencies
```

**Dependencies in template package.json:**
- `@mew-protocol/mew` - Core protocol library
- `@modelcontextprotocol/server-filesystem` - MCP filesystem server
- `openai` - OpenAI API client
- `js-yaml` - YAML parser
- `ws` - WebSocket library

**Init process:**
1. Copy template files to `.mew/`
2. Process variables in space.yaml
3. **Run `npm install` in `.mew/`** ← Slow step
4. Done

## Options

### Option 1: Bundle All Dependencies in CLI

**Approach**: Include all common template dependencies in the CLI package's `dependencies`.

**Changes:**
- Add template deps to `packages/mew/package.json` dependencies
- Remove `package.json` from templates
- Remove npm install logic from init command
- Agent scripts import from shared installation

**Pros:**
- ✅ Zero install time - instant `mew init`
- ✅ Guaranteed version consistency across all spaces
- ✅ Simpler template structure (just space.yaml + agents/)
- ✅ No per-space node_modules directories
- ✅ No monorepo detection logic needed

**Cons:**
- ❌ CLI package size increases (~10-20MB total)
- ❌ Users get all deps even if they only use some templates
- ❌ Dependency updates require CLI release
- ❌ Custom agent dependencies harder to add

**Impact on templates:**
```
templates/coder-agent/
├── template.json
├── space.yaml
└── agents/
    └── coder.js           # import { MEWAgent } from '@mew-protocol/mew/agent'
```

**Agent code:**
```javascript
#!/usr/bin/env node
import { MEWAgent } from '@mew-protocol/mew/agent';
import OpenAI from 'openai';  // Resolved from CLI's node_modules
// ... rest of agent code
```

### Option 2: Keep Per-Space package.json (Current)

**Approach**: Each space has its own `package.json` and runs `npm install`.

**Pros:**
- ✅ Spaces can have custom dependencies
- ✅ Each space controls its own versions
- ✅ CLI package stays smaller
- ✅ Familiar npm workflow

**Cons:**
- ❌ Slow init experience (5-60 seconds)
- ❌ Duplicate node_modules across spaces (~50-100MB each)
- ❌ Complex monorepo detection logic
- ❌ Version drift between spaces
- ❌ More files to manage (.mew/package.json, package-lock.json)

### Option 3: Hybrid - CLI Provides Core, Optional Per-Space Deps

**Approach**: CLI bundles core dependencies, spaces can add extras via package.json if needed.

**Changes:**
- CLI includes common deps (openai, ws, js-yaml)
- Templates ship without package.json by default
- Init command supports `--with-package-json` flag for advanced users
- Document how to add custom deps if needed

**Pros:**
- ✅ Fast default experience (instant for basic templates)
- ✅ Flexibility for advanced use cases
- ✅ Smaller per-space overhead
- ✅ Clear separation: core vs custom deps

**Cons:**
- ❌ Two different workflows to document
- ❌ Potential confusion about when to use package.json
- ❌ Still need some monorepo detection logic
- ❌ More CLI complexity

### Option 4: Global Cache with Lazy Install

**Approach**: First `mew init` installs deps to `~/.mew/node_modules/`, subsequent inits reuse cache.

**Changes:**
- Remove package.json from templates
- Install template deps globally to `~/.mew/` on first use
- Spaces symlink to cached deps
- Add `NODE_PATH=~/.mew/node_modules` when running agents

**Pros:**
- ✅ Fast after first install
- ✅ No per-space duplication
- ✅ Spaces share same versions
- ✅ Can update deps independently of CLI

**Cons:**
- ❌ First init still slow
- ❌ Global cache management complexity
- ❌ NODE_PATH manipulation fragile
- ❌ Harder to debug import resolution
- ❌ Still need monorepo detection for dev

### Option 5: Download Pre-bundled Template Packages

**Approach**: Publish pre-bundled template packages that include all dependencies.

**Changes:**
- Create `@mew-protocol/template-coder-agent` packages
- Each published with all deps bundled
- Init downloads/extracts template package
- No npm install needed

**Pros:**
- ✅ Fast init (just download + extract)
- ✅ No dependency resolution needed
- ✅ Consistent versions per template version
- ✅ Easy to publish template updates

**Cons:**
- ❌ Need separate publish process for templates
- ❌ More packages to maintain
- ❌ Download size larger
- ❌ Template updates don't pick up CLI fixes
- ❌ Network required for init

## Recommendation

**Option 1: Bundle All Dependencies in CLI** is recommended because:

1. **Aligns with user expectation**: `mew init` should be instant and seamless
2. **Simplifies architecture**: No per-space package management
3. **Better for development**: No special monorepo detection needed
4. **Acceptable tradeoffs**:
   - CLI size increase (10-20MB) is small compared to modern packages
   - Most users will use provided templates anyway
   - Can document custom dependency workflow later if needed

### Implementation Plan

1. **Phase 1**: Add template deps to packages/mew/package.json
   ```json
   "dependencies": {
     "@modelcontextprotocol/server-filesystem": "^0.6.2",
     "openai": "^5.20.1",
     "js-yaml": "^4.1.0",
     "ws": "^8.14.0",
     // ... existing deps
   }
   ```

2. **Phase 2**: Update templates
   - Remove package.json from all templates
   - Update agent scripts to import from shared installation
   - Test that imports resolve correctly

3. **Phase 3**: Simplify init command
   - Remove `installDependencies()` method
   - Remove `useLocalWorkspacePackagesIfAvailable()` method
   - Remove `findMonorepoRoot()` method
   - Remove package.json processing from `processTemplateFiles()`

4. **Phase 4**: Document custom dependencies
   - Add docs explaining how to add custom deps if needed
   - Suggest: create package.json in space root, set NODE_PATH, or use global install

### Future Extensions

If custom dependencies become a common need:

- Add `mew space install <package>` command that manages space-local deps
- Create `~/.mew/plugins/` directory for user extensions
- Support template variants with different dependency sets

## Alternative: Hybrid Approach (Option 3)

If we want maximum flexibility, implement Option 3:

- CLI bundles openai, ws, js-yaml (most common)
- Templates ship without package.json
- Add `mew init --custom-deps` that creates package.json for advanced users
- Document both workflows clearly

This preserves the simple path (instant init) while allowing advanced customization.

## Decision

[To be decided - awaiting user input]

## Notes

- The MCP filesystem server (`@modelcontextprotocol/server-filesystem`) runs as a separate process, but we spawn it from agents, so having it in CLI deps makes sense
- Anthropic SDK could also be added for Claude-based agents
- Total size impact: ~15MB for all common deps (openai ~5MB, @modelcontextprotocol/* ~3MB, others smaller)