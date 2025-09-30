
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

### Phase 4 - Template Dependency Refactor (BEFORE PUBLISH)
**Blocking publish** - Templates must work seamlessly with local builds

See: REFACTOR-TEMPLATE-DEPS.md, ADR-TEMPLATE-DEPENDENCIES.md

#### Phase 4.1 - Add Dependencies & Create Commands
- [ ] Add dependencies to packages/mew/package.json (openai, @anthropic-ai/sdk, @modelcontextprotocol/server-filesystem)
- [ ] Create `packages/mew/src/cli/commands/mcp.js` command
- [ ] Create `packages/mew/src/mcp-servers/` directory
- [ ] Move/create `filesystem.js` MCP server wrapper
- [ ] Move cat-maze-server.js to `packages/mew/src/mcp-servers/cat-maze.js`
- [ ] Formalize built-in agents in `packages/mew/src/agents/` (echo, calculator)

#### Phase 4.2 - Update Templates (Remove package.json)
- [ ] coder-agent: Remove package.json, update space.yaml to use `mew mcp filesystem .`
- [ ] cat-maze: Remove package.json, update space.yaml to use `mew mcp cat-maze`
- [ ] note-taker: Remove package.json, update agent imports

#### Phase 4.3 - Simplify Init Command
- [ ] Remove `installDependencies()` method from init.js
- [ ] Remove `useLocalWorkspacePackagesIfAvailable()` method from init.js
- [ ] Remove `findMonorepoRoot()` method from init.js
- [ ] Remove package.json copying logic from init.js
- [ ] Update console messages (no more npm install)

#### Phase 4.4 - Test All Templates with Local Build
- [ ] Build packages/mew: `npm run build:all`
- [ ] Test coder-agent template: `mew init coder-agent` in spaces/test-coder
- [ ] Test cat-maze template: `mew init cat-maze` in spaces/test-cat-maze
- [ ] Test note-taker template: `mew init note-taker` in spaces/test-note-taker
- [ ] Verify `mew up` works for each template
- [ ] Verify agents can import from CLI's bundled deps
- [ ] Verify `mew mcp` commands work

### Phase 5 - Publish & Verify
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


