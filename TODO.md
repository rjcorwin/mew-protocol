
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

### Phase 3 - Build System & Fixes (IN PROGRESS)
- [x] Get builds to work
- [x] Switch to `moduleResolution: "bundler"` for pragmatic ESM support
- [x] Set up TypeScript build (tsc for libraries)
- [x] Convert CLI from CommonJS to ESM (all 19 files converted)
- [x] Set up bin bundling (tsup for CLI binaries)
- [x] Test build with `npm run build:all`
- [ ] Update test harnesses to use new paths
- [ ] Wire bin shims (mew-agent, mew-bridge)

### Phase 4 - Publish & Verify
- [ ] Test `npm pack` from packages/mew
- [ ] Smoke test bins from tarball
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


