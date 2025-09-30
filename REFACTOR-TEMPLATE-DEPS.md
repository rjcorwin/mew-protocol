# Template Dependency Refactor

**Status**: Planned
**Date**: 2025-09-30
**Related**: ADR-TEMPLATE-DEPENDENCIES.md

## Problem

Currently `mew init` creates a `.mew/package.json` and runs `npm install`, which:
- Takes 5-60 seconds
- Creates ~50-100MB node_modules per space
- Requires complex monorepo detection logic
- Can cause version drift between spaces
- Breaks the seamless "instant start" user experience

## Solution

**Bundle all dependencies in the CLI and provide built-in commands for common needs.**

### Key Changes

1. **No more per-space package.json** - Templates just have space.yaml + agent scripts
2. **CLI bundles all common dependencies** - openai, anthropic, ws, js-yaml, etc.
3. **Built-in MCP servers via `mew mcp` command** - No separate MCP server processes to install
4. **Built-in test agents via `mew agent` command** - Already exists, just formalize it

### New Command: `mew mcp <server> [args]`

Run built-in MCP servers without separate installation:

```bash
# Filesystem MCP server
mew mcp filesystem /path/to/dir

# Cat-maze game server
mew mcp cat-maze
```

### Template Structure (After)

```
templates/coder-agent/
├── template.json
├── space.yaml          # References "mew mcp filesystem ."
└── agents/
    └── coder.js        # Imports from CLI's bundled deps
```

**No package.json!**

### space.yaml Example (After)

```yaml
participants:
  filesystem:
    command: mew mcp filesystem .
    capabilities:
      - filesystem/read
      - filesystem/write

  coder:
    command: .mew/agents/coder.js
    env:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
```

### Agent Script Example (After)

```javascript
#!/usr/bin/env node
import { MEWAgent } from '@mew-protocol/mew/agent';
import OpenAI from 'openai';  // Resolved from CLI's node_modules

const agent = new MEWAgent({
  participantId: 'coder',
  // ... config
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Agent implementation...
```

## Implementation Tasks

### Phase 1: Add Dependencies & Create Commands

- [ ] Add to `packages/mew/package.json` dependencies:
  - `openai` (for OpenAI agents)
  - `@anthropic-ai/sdk` (for Claude agents)
  - `@modelcontextprotocol/server-filesystem` (for filesystem server)

- [ ] Create `packages/mew/src/cli/commands/mcp.js`
  - Implement `mew mcp filesystem <path>`
  - Implement `mew mcp cat-maze`
  - Add `mew mcp list` to show available servers

- [ ] Create `packages/mew/src/mcp-servers/` directory
  - `filesystem.js` - Wrapper for @modelcontextprotocol/server-filesystem
  - `cat-maze.js` - Move from templates/cat-maze/agents/cat-maze-server.js

- [ ] Formalize built-in agents in `packages/mew/src/agents/`
  - Move echo/calculator logic from CLI command to standalone files
  - Can reference with `mew agent start --type echo`

### Phase 2: Update Templates

- [ ] **coder-agent template**:
  - Remove `package.json`
  - Update `space.yaml` to use `mew mcp filesystem .`
  - Verify agent script imports work

- [ ] **cat-maze template**:
  - Remove `package.json`
  - Update `space.yaml` to use `mew mcp cat-maze`
  - Update narrator agent to import from CLI deps

- [ ] **note-taker template**:
  - Remove `package.json`
  - Update agent script to import from CLI deps

### Phase 3: Simplify Init Command

Remove from `packages/mew/src/cli/commands/init.js`:

- [ ] Delete `installDependencies()` method (lines 363-425)
- [ ] Delete `useLocalWorkspacePackagesIfAvailable()` method (lines 742-796)
- [ ] Delete `findMonorepoRoot()` method (lines 798-826)
- [ ] Remove package.json copying from `copyTemplateFiles()` (lines 315-318)
- [ ] Remove package.json processing from `processTemplateFiles()` (lines 724-739)
- [ ] Update console messages to reflect no npm install

### Phase 4: Update Tests

- [ ] Update test scenarios to use `mew mcp` commands in space.yaml
- [ ] Update test scenarios to use `mew agent start --type <type>` for built-in agents
- [ ] Verify all tests pass without per-space npm install
- [ ] Remove any test-specific package.json files

### Phase 5: Documentation

- [ ] Update root README.md - reflect instant init experience
- [ ] Update packages/mew/README.md - document bundled dependencies
- [ ] Update DEVELOPMENT.md - remove per-space npm install docs
- [ ] Document `mew mcp` command
- [ ] Document how to add custom dependencies (if needed)
- [ ] Update ADR-TEMPLATE-DEPENDENCIES.md status to "Accepted"

## Benefits

### User Experience
- ✅ **Instant `mew init`** - Just copies files, no waiting
- ✅ **Simpler mental model** - Everything through `mew` command
- ✅ **No dependency management** - It just works

### Developer Experience
- ✅ **No monorepo detection** - Simpler init.js code
- ✅ **Guaranteed consistency** - All spaces use same versions
- ✅ **Easier testing** - No npm install in tests

### Disk Usage
- ✅ **~50-100MB saved per space** - No per-space node_modules
- ✅ **Single install** - Dependencies only in CLI's node_modules

## Tradeoffs

### CLI Package Size
- CLI package grows from ~1MB to ~15-20MB
- Acceptable for modern development (npm packages commonly 10-50MB)
- Users only install once globally

### Custom Dependencies
- Adding custom deps requires manual setup (rare case)
- Can document workaround: create package.json in space root, set NODE_PATH
- Or add `mew space install <package>` command in future if needed

### MCP Server Coverage
- Only includes filesystem and cat-maze initially
- Third-party MCP servers still require separate installation
- Can add more built-in servers over time based on demand

## Migration Notes

### For Existing Spaces (Post-Refactor)

If users have existing spaces with package.json:

1. **They continue to work** - No breaking changes to running spaces
2. **New inits are simpler** - Fresh `mew init` uses new approach
3. **Optional cleanup**: Remove `.mew/package.json` and `.mew/node_modules/`, update space.yaml

### For Template Authors

Custom templates will need to:
1. Remove package.json from template
2. Update space.yaml to use `mew mcp` commands where applicable
3. Ensure agent scripts import from shared CLI installation

## Open Questions

- [ ] Should `mew mcp list` show descriptions of each server?
- [ ] Do we want `mew mcp install <package>` for third-party MCP servers?
- [ ] Should built-in agents also be in a dedicated directory vs inline in CLI command?
- [ ] What's the story for users who need custom npm packages? (probably document later)

## Success Metrics

- `mew init` completes in < 1 second
- No `.mew/node_modules/` directories created
- No `.mew/package.json` files in new spaces
- All existing tests pass
- Template complexity reduced (fewer files)