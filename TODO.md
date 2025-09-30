
## Repository Restructure (REPO-SPEC.md)

### Phase 1 - Package Consolidation ✅
- [x] Create `packages/mew` directory structure
- [x] Move SDK library modules to `packages/mew/src/`
- [x] Move bridge to `packages/mew/src/bridge/`
- [x] Move CLI src and bin to `packages/mew/src/`
- [x] Move templates to `packages/mew/templates/`
- [x] Update root package.json workspaces
- [x] Create packages/mew/package.json

### Phase 2 - Build & Integration ✅
- [x] Create stable CLI wrapper at `cli/bin/mew.js` (forwards to packages/mew)
- [x] Create unified tsconfig.json for packages/mew
- [x] Move CLI metadata files (CHANGELOG, README, spec) to packages/mew
- [x] Flatten src/ structure (remove nested src/ in modules)
- [x] Remove per-module metadata files
- [x] Update templates to depend on `@mew-protocol/mew`
- [x] Clean up old directories (sdk/, cli/)
- [x] Update all import paths to use relative paths within package

### Phase 3 - Build System & Fixes ✅
- [x] Get builds to work
- [x] Switch to `moduleResolution: "bundler"` for pragmatic ESM support
- [x] Set up TypeScript build (tsc for libraries)
- [x] Convert CLI from CommonJS to ESM (all 20 files converted)
- [x] Add bridge command to CLI (mew bridge start)
- [x] Set up bin bundling (tsup for CLI binaries)
- [x] Test build with `npm run build:all`
- [x] Update test harnesses to use new paths (CLI wrapper → dist/bin/mew.js)
- [x] Wire bin shims (mew-agent, mew-bridge)

### Phase 4 - Template Dependency Refactor ✅
**Complete** - Templates now work seamlessly without npm install

See: REFACTOR-TEMPLATE-DEPS.md, ADR-TEMPLATE-DEPENDENCIES.md

#### Phase 4.1 - Add Dependencies & Create Commands ✅
- [x] Added dependencies to packages/mew/package.json (@modelcontextprotocol/sdk, @modelcontextprotocol/server-filesystem)
- [x] Created `packages/mew/src/cli/commands/mcp.js` command
- [x] Created `packages/mew/src/mcp-servers/` directory
- [x] Created `filesystem.js` MCP server wrapper
- [x] Moved cat-maze-server.js to `packages/mew/src/mcp-servers/cat-maze.js`
- [x] Built-in agents formalized via `mew agent start --type <type>` (echo, calculator)

#### Phase 4.2 - Update Templates (Remove package.json) ✅
- [x] coder-agent: Removed package.json, updated space.yaml to use `mew bridge` with `mew mcp filesystem`
- [x] cat-maze: Removed package.json, updated space.yaml to use `mew bridge` with `mew mcp cat-maze`
- [x] note-taker: Removed package.json, converted agent to ESM

#### Phase 4.3 - Simplify Init Command ✅
- [x] Removed `installDependencies()` method from init.js
- [x] Removed `useLocalWorkspacePackagesIfAvailable()` method from init.js
- [x] Removed `findMonorepoRoot()` method from init.js
- [x] Removed package.json copying logic from init.js
- [x] Updated console messages (no more npm install)
- [x] Fixed: Removed standalone execution code that was breaking bundled init

#### Phase 4.4 - Test All Templates with Local Build ✅
- [x] Built packages/mew: `npm run build:all` (success, mew.js = 299KB)
- [x] Tested coder-agent template: Instant init, no node_modules created
- [x] Tested cat-maze template: Instant init, no node_modules created
- [x] Tested note-taker template: Instant init, no node_modules created
- [x] Verified `mew mcp list` command works
- [ ] TODO: Verify `mew up` works for each template (needs fixing space command first)
- [ ] TODO: Verify agents can import from CLI's bundled deps (needs runtime test)

#### Phase 4.5 - Document Global Install Requirement ✅
**Complete** - REPO-SPEC.md and test infrastructure updated

Templates no longer have package.json. All dependencies are bundled in CLI and accessed
via mew subcommands. PM2 requires mew command in PATH.

**Changes Made**:
- [x] Updated REPO-SPEC.md to document global install requirement
- [x] Updated dev workflow sections to consistently use global `mew`
- [x] Updated tests/run-all-tests.sh to build and install globally before running scenarios
- [x] Updated all 15 scenario setup.sh scripts to use `mew` instead of `node ${CLI_BIN}`
- [x] Removed unused CLI_BIN variable from all scenarios

**Dev Workflow Now**:
```bash
npm run build
npm install -g .
mew space init .
mew space up
mew space connect
```

**Alternative (faster iteration)**:
```bash
npm link  # One-time
npm run build  # After changes
```

#### Phase 4.6 - Fix Space Command for New Structure ✅
**Complete** - Gateway starts, but agent command blocked on TS conversion

**Changes Made**:
- [x] Fixed WebSocketServer import in gateway.js (ESM bundling issue)
- [x] Changed space.js to use 'mew' command directly (finds in PATH)
- [x] Fixed root tsconfig.json references
- [x] Tested: Gateway starts successfully via PM2
- [x] Tested: mew space up/down works

**Remaining Issue**:
- `mew agent run` fails: Dynamic import of `@mew-protocol/mew/agent` broken
- Root cause: TypeScript emits imports without `.js` extensions
- Node.js ESM can't resolve: `import { MEWAgent } from './MEWAgent'` needs `./MEWAgent.js`
- **Blocked on Phase 5**: Need to convert CLI to TypeScript for unified module resolution

### Phase 5 - Convert CLI to TypeScript (IN PROGRESS)
**Goal**: Fix module resolution by converting entire codebase to TypeScript with consistent ESM

**Problem**: Mixed JS (CLI) + TS (library) creates import resolution issues when bundled CLI tries to dynamically import library code that has extensionless imports.

**Solution**: Convert CLI to TypeScript, use `moduleResolution: "NodeNext"` everywhere, add `.js` to all imports.

#### Phase 5.1 - Documentation & Planning
- [ ] Create ADR documenting CLI → TypeScript conversion rationale
- [ ] Document migration strategy and expected outcomes

#### Phase 5.2 - Convert CLI to TypeScript
- [ ] Update tsconfig.json to include CLI sources with proper settings
- [ ] Convert utility files: `src/cli/utils/*.js` → `*.ts`
- [ ] Convert command files: `src/cli/commands/*.js` → `*.ts` (12 files)
- [ ] Convert UI files: `src/cli/ui/*.js` → `*.ts`
- [ ] Convert main entry: `src/cli/index.js` → `index.ts`
- [ ] Update tsup.config.js entry points (`.js` → `.ts`)

#### Phase 5.3 - Fix Module Resolution (Critical)
- [ ] Change `moduleResolution: "bundler"` → `"NodeNext"` in packages/mew/tsconfig.json
- [ ] Add `.js` extensions to ALL relative imports in library code (~30 files)
- [ ] Add `.js` extensions to ALL relative imports in CLI code
- [ ] Test that tsc builds without errors
- [ ] Test that tsup bundles correctly

#### Phase 5.4 - Test Everything
- [ ] Build and install globally: `npm run build && cd packages/mew && npm run build:all && npm install -g .`
- [ ] Test `mew agent run` works (the blocked command)
- [ ] Test coder-agent template (uses `mew agent run`)
- [ ] Test cat-maze template (uses `mew agent run`)
- [ ] Test note-taker template (uses custom agent script)
- [ ] Run integration test suite: `npm test`
- [ ] Verify no regressions in gateway, bridge, space commands

### Phase 6 - Publish & Verify
- [x] Test `npm pack` from packages/mew
- [x] Smoke test bins from tarball
- [ ] Update all documentation
- [ ] First publish of @mew-protocol/mew

## SDK
- `sdk/typescript-sdk/types/src/protocol.ts` still types `Envelope.correlation_id` as `string | string[]`. The v0.4 spec requires the field to always be an array, so the typings should be tightened before the next release.
- MEWAgent needs real support for Participant/compact

## Tests
- `tests/agents/echo.js` builds chat replies with `correlation_id: envelope.id`. This sends the identifier as a bare string, but v0.4 mandates an array. The agent (or the helper that serialises envelopes) needs an update to wrap single identifiers in an array.

## CLI
- `cli/src/commands/gateway.js` (and the enhanced variant) still default missing `protocol` fields to the MEW constant. The protocol field is mandatory in v0.4, so the CLI should probably reject envelopes without an explicit `protocol` instead of back-filling it.

- The built-in `client connect` and `agent start` workflows still send a legacy `{ type: 'join' }` handshake instead of a v0.4 MEW envelope. The gateway continues to translate this legacy format, but participants should emit full envelopes going forward.
- **`correlation_id` handling**: The shared types (`@mew-protocol/types`) and dependent packages (`@mew-protocol/client`, `@mew-protocol/participant`, `@mew-protocol/agent`) still type and handle `correlation_id` values as `string | string[]`. The v0.4 specification requires the envelope field to always be an array of strings. Updating the types will require touchpoints across the SDK and tests (for example, `sdk/typescript-sdk/client/tests/envelope.test.ts`) that currently assert against string-valued `correlation_id`s.
- The note-taker template agent uses the rejected `system/join` message kind. A compliant join/authorization sequence needs to be defined for v0.4.
- `npm run lint`, need to update all packages to conform
- `gateway` back-fills envelope fields (protocol, id, timestamps) when participants omit them. Under the v0.4 spec every message on the wire should already be a complete envelope.
- The note-taker template agent uses the rejected `system/join` message kind. A compliant join/authorization sequence needs to be defined for v0.4.

## SDK
- The shared `Envelope` type still allows `correlation_id` to be a single string for backward compatibility, whereas v0.4 requires an array of strings. Client code should emit arrays once the ecosystem is ready.


