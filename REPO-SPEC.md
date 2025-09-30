# REPO SPEC 

## Summary

Publish one npm package, `@mew-protocol/mew`, that contains:
- Library subpaths: `@mew-protocol/mew/{types,client,participant,agent,gateway,capability-matcher,bridge}`
- Executables (bins):
  - `mew` (primary CLI)
  - Subcommands: `mew agent …`, `mew bridge …`
  - Additional binaries: `mew-agent`, `mew-bridge` → thin shims that forward to `mew agent` / `mew bridge`

Outcome:
- One install, one version, one publish.
- Templates depend only on `@mew-protocol/mew`.
- Keeps modular imports via subpath exports.

## Goals / Non-goals

Goals
- Simplify release to a single publish target.
- Preserve modular code organization and import ergonomics.
- Offer a clean CLI UX with subcommands while maintaining compatibility with existing bin names.

Non-goals
- Changing protocol specs or scenario harnesses.
- Deep refactors of SDK internals beyond packaging and exports.

## Package Structure

```
packages/mew/                 # Single published package
  package.json                # name: @mew-protocol/mew
  tsconfig.json               # unified build config (no per-module configs)
  src/
    bin/
      mew.js                  # main CLI with subcommands (JS first)
      mew-agent.js            # shim → invokes `mew agent …` (optional)
      mew-bridge.js           # shim → invokes `mew bridge …` (optional)
    cli/                      # CLI implementation (JS, no package.json)
      commands/
      ui/
      utils/
    types/                    # Library source (TS, no package.json)
      index.ts
      protocol.ts
      mcp.ts
    client/                   # Library source (TS, no package.json)
      index.ts
      MEWClient.ts
      types.ts
    participant/              # Library source (TS, no package.json)
      index.ts
      MEWParticipant.ts
      capabilities.ts
    agent/                    # Library source (TS, no package.json)
      index.ts
      MEWAgent.ts
    capability-matcher/       # Library source (TS, no package.json)
      index.ts
      matcher.ts
    bridge/                   # Library source (TS, no package.json)
      index.ts
      mcp-bridge.ts
  templates/                  # CLI templates
  dist/                       # Build output (gitignored)
```

## Repository Structure (Target)

Top-level layout after consolidation to a single published package:

```
.
├─ packages/
│  └─ mew/                       # Single published package (@mew-protocol/mew)
│     ├─ package.json            # name, bins, exports
│     ├─ src/
│     │  ├─ bin/                 # Executables and shims
│     │  │  ├─ mew.js            # primary CLI with subcommands (JS first)
│     │  │  ├─ mew-agent.js      # shim → runs `mew agent …`
│     │  │  └─ mew-bridge.js     # shim → runs `mew bridge …`
│     │  ├─ cli/                 # CLI implementation (commands, UI) — JS first
│     │  │  ├─ commands/
│     │  │  ├─ ui/
│     │  │  │  ├─ components/
│     │  │  │  ├─ hooks/
│     │  │  │  └─ utils/
│     │  │  └─ utils/
│     │  ├─ types/               # Library subpaths (sources or re-exports)
│     │  ├─ client/
│     │  ├─ participant/
│     │  ├─ agent/
│     │  ├─ gateway/
│     │  ├─ capability-matcher/
│     │  └─ bridge/
│     ├─ templates/              # CLI templates bundled with the package
│     │  ├─ cat-maze/
│     │  ├─ coder-agent/
│     │  └─ note-taker/
│     ├─ dist/                   # Build output (ESM + .d.ts, bin JS)
│     ├─ tsconfig.json           # unified build config
│     ├─ CHANGELOG.md
│     ├─ README.md
│     └─ spec/                   # CLI specs
├─ spaces/                       # Manual dev spaces (uses local CLI + link:)
├─ tests/                        # Integration scenarios (scenario-*)
├─ spec/                         # Protocol specs and ADRs
├─ docs/                         # Architecture, guides, progress
├─ .github/                      # CI workflows
├─ package.json                  # private workspace root (workspaces: ["packages/mew"])
├─ tsconfig.base.json            # shared TS settings (if/when TS used)
├─ RELEASE.md                    # release guide (updated for single package)
└─ README.md
```

Notes:
- Only `packages/mew` is published to npm. The root remains `private: true` and manages the workspace.
- CLI code lives under `packages/mew/src/cli/` and `packages/mew/src/bin/`.
- Library modules live under `packages/mew/src/{types,client,participant,agent,gateway,capability-matcher,bridge}` and are exposed via subpath exports.
- Templates ship from `packages/mew/templates/`.

## Package.json (sketch)

```
{
  "name": "@mew-protocol/mew",
  "type": "module",
  "bin": {
    "mew": "dist/bin/mew.js",
    "mew-agent": "dist/bin/mew-agent.js",
    "mew-bridge": "dist/bin/mew-bridge.js"
  },
  "exports": {
    ".": "./dist/index.js",
    "./types": "./dist/types/index.js",
    "./client": "./dist/client/index.js",
    "./participant": "./dist/participant/index.js",
    "./agent": "./dist/agent/index.js",
    "./gateway": "./dist/gateway/index.js",
    "./capability-matcher": "./dist/capability-matcher/index.js",
    "./bridge": "./dist/bridge/index.js"
  }
}
```

## Build Strategy

### TypeScript Configuration

The package uses **`"moduleResolution": "bundler"`** with ESM output:

- **Module settings**: `"module": "ESNext"`, `"moduleResolution": "bundler"`, `"type": "module"`
- **Rationale**: Pragmatic approach used by real-world ESM libraries (e.g., @langchain/core)
- **Benefits**:
  - No `.js` extension required in relative imports (developer-friendly)
  - Still produces valid ESM output
  - Compatible with modern bundlers and Node.js ESM
- **Alternative considered**: `"moduleResolution": "NodeNext"` requires explicit `.js` extensions in all imports, adding friction without clear benefit for this use case

See `tsconfig.base.json` for the canonical settings.

### Build Patterns

Two viable patterns; choose one to keep things simple:

1) Multi-entry bundle for bins, plain ESM for libraries (recommended MVP)
- Use `tsc` to emit ESM and `.d.ts` for the library subpaths.
- Use `tsup` (or `rollup`) to bundle `src/bin/mew.js` into `dist/bin/mew.js` with a shebang (source can be JS initially).
- Provide shims `mew-agent.js` and `mew-bridge.js` that invoke the `mew` entry with `agent` or `bridge` subcommands.

2) Single tool for all entries
- Use a single `tsup` config with multiple entries (library + bins), emitting ESM for libraries and preserving tree-shaking. Slightly more config, still one command.

## CLI UX

- Primary: `mew …` with subcommands
  - `mew agent …`
  - `mew bridge …`
- Compatibility (optional):
  - `mew-agent …` ≡ `mew agent …`
  - `mew-bridge …` ≡ `mew bridge …`

## Templates

- Update all templates to depend on a single package:
  ```json
  {
    "dependencies": {
      "@mew-protocol/mew": "^X.Y.Z"
    }
  }
  ```
- CLI continues to rewrite dependencies to workspace during local dev/tests.

### Workspaces

Root `package.json` (sketch):

```json
{
  "private": true,
  "workspaces": [
    "packages/mew"
  ]
}
```

### Entry Points

- Binaries (package.json):
  ```json
  {
    "bin": {
      "mew": "dist/bin/mew.js",
      "mew-agent": "dist/bin/mew-agent.js",
      "mew-bridge": "dist/bin/mew-bridge.js"
    }
  }
  ```
- Subpath exports (as specified above) for all libraries.

### Transitional Compatibility (Optional)

- During migration, you may keep thin wrapper bin files to preserve old entry points (`mew-agent`, `mew-bridge`). These can be removed after downstreams update to `mew agent` / `mew bridge`.

## Spaces and Tests: Local Dependency Strategy

### Phase 4 Update: Global Install Required for PM2

**Templates no longer have `package.json` or `node_modules`**. All dependencies (including MCP
servers and agents) are now bundled in the CLI package itself and accessed via `mew` subcommands.

Templates use PM2 to start participants with commands like:
- `mew agent run --gateway ws://localhost:${PORT} ...`
- `mew bridge start --mcp-command mew --mcp-args mcp,filesystem,...`

**This requires the `mew` command to be available globally** when PM2 starts processes.

### Inside the Repo (Dev Mode)

**Required setup before testing**:
```bash
# Build and install globally from local source
npm run build
npm install -g .

# Now use global mew command for everything
cd tests/test-feature
mew space init .
mew space up
mew space connect
```

**After code changes**:
```bash
npm run build
npm install -g .  # Reinstall to pick up changes
```

**Alternative - npm link** (faster iteration):
```bash
npm link  # One-time setup
# After code changes:
npm run build  # Just rebuild, link is persistent
```

Environment overrides (optional):
- `MEW_FORCE_PUBLISHED`: if set, uses published `@mew-protocol/mew` from registry instead of local.

### Outside the Repo (Published Mode)

- CLI behaves as a normal consumer; templates use globally installed `mew` command.
- Install: `npm install -g @mew-protocol/mew`

### spaces/README.md Integration

- Spaces created under `spaces/` are for interactive local dev. The README should document:
  - Building and installing globally: `npm run build && npm install -g .`
  - Creating a new space: `cd spaces && mkdir test && cd test`
  - Using global mew command: `mew space init .`, `mew space up`, `mew space connect`

### tests/README.md Integration

- Scenario harnesses create disposable workspaces under `tests/scenario-*/.workspace`.
- Test runner (`tests/run-all-tests.sh`) installs globally once at the start.
- All scenarios use global `mew` command (not local wrapper paths).
- Example in setup.sh:
  ```bash
  # Use global mew for all commands
  mew init "${TEMPLATE_NAME}" --force --name "${SPACE_NAME}"
  mew space up --space-dir . --port "${TEST_PORT}" --detach
  ```

### Rationale

- **Why global install?** PM2 spawns processes independently and needs `mew` in PATH.
- **Why not local paths in templates?** Templates are shipped to users and can't have repo-relative paths.
- **Why not bundle everything?** Phase 4 accomplished this - templates have no dependencies, everything is in the CLI package.

### Fallback Behavior and Robustness

- If global `mew` is not found, `space up` will fail with clear error from PM2.
- The CLI can detect if running from repo and warn if global install is outdated.

## Operating Modes & Release Process

This section consolidates four concerns: developer workflow, manual space testing, E2E testing, and
the single‑package release process.

### 1) Developer Workflow (Dev)

- Edit code in `packages/mew/src/**`.
- Build locally:
  - Libraries: `npm --workspace packages/mew run build` (tsc → `dist/` with `.d.ts`).
  - Binaries: `npm --workspace packages/mew run build:bin` (tsup/rollup → `dist/bin/*`).
  - Combined: `npm --workspace packages/mew run build:all`.
- Optional watch task for fast iteration: `npm --workspace packages/mew run dev`.
- Run CLI from source (dev):
  - With compat wrapper: `./cli/bin/mew.js …` (for existing scripts) → forwards to `packages/mew/dist/bin/mew.js`.
  - Or direct: `node packages/mew/dist/bin/mew.js …`.
- Lint/format: `npm run lint --workspaces`, `npm run format --workspaces`.

### 2) Spaces Testing (Manual Integration)

Manual "spaces" exist under `spaces/` for developer exploration:

```bash
# First time: build and install globally
npm run build
npm install -g .

cd spaces && mkdir test-demo && cd test-demo
# Use global mew for all commands
mew space init .
mew space up
mew space connect
```

Key points:
- Templates no longer have `package.json` - all dependencies bundled in CLI.
- All commands use global `mew` (required for PM2 to find it in PATH).
- After code changes: `npm run build && npm install -g .` to reinstall.
- Alternative for faster iteration: `npm link` once, then just `npm run build` after changes.

### 3) Tests Testing (E2E Scenarios)

E2E tests live under `tests/scenario-*` and create disposable workspaces under `.workspace/`:

```bash
# First time: build and install globally
npm run build
npm install -g .

# Run all non‑LLM scenarios (test runner installs globally automatically)
npm run test

# Or invoke a single scenario's shell orchestrator
tests/scenario-14-cat-maze/test.sh
```

Behavior:
- Test runner (`tests/run-all-tests.sh`) builds and installs globally before running scenarios.
- All scenarios use global `mew` command consistently.
- Logs and envelope history validate protocol flows; failures surface in scenario logs.

### 4) Release Process (Single Package)

Pre‑release checks:
- Build & pack from a clean tree:
  ```bash
  npm ci
  npm --workspace packages/mew run build:all
  (cd packages/mew && npm pack --dry-run)
  ```
- E2E: `npm run test` (expect green on core scenarios).
- Manual smoke: create a temp dir and test `mew` from the packed tarball.

Versioning & changelog:
- Bump version in `packages/mew/package.json` (semver) and update `packages/mew/CHANGELOG.md`.

Publish:
```bash
cd packages/mew
npm publish --access public --otp=XXXXXX
```

Tag & push:
```bash
git tag mew-vX.Y.Z
git push origin main --tags
```

Post‑publish verification:
```bash
TMP=$(mktemp -d)
cd "$TMP" && npm init -y >/dev/null 2>&1
npm install @mew-protocol/mew@latest
./node_modules/.bin/mew --version
./node_modules/.bin/mew space init --template coder-agent demo
```

Notes:
- Templates ship with the package; no separate publish for CLI/templates.
- Compat bins (`mew-agent`, `mew-bridge`) are optional; keep them during the migration window.

## Migration

Phase 1 — Package consolidation ✅ COMPLETED
- Create `packages/mew` directory structure
- Move SDK library modules, bridge, and CLI to packages/mew/src/
- Move templates to packages/mew/templates/
- Update root package.json workspaces
- Create packages/mew/package.json

Phase 2 — Flatten and integrate ✅ COMPLETED
- Flatten src/ structure (remove nested src/ in each module)
- Remove per-module metadata files (package.json, tsconfig.json, etc.)
- Create unified packages/mew/tsconfig.json
- Move CLI metadata (CHANGELOG, README, spec) to packages/mew/
- Create stable CLI wrapper at cli/bin/mew.js
- Update templates to depend on `@mew-protocol/mew`
- Clean up old directories

Phase 3 — Import paths and build system ✅ COMPLETED
- ✅ Update all import paths in source code (relative imports within package)
- ✅ Switch to `moduleResolution: "bundler"` for pragmatic ESM support
- ✅ Set up TypeScript build (tsc for libraries)
- ✅ Convert CLI from CommonJS to ESM (all 20 files converted)
- ✅ Add bridge command to CLI (mew bridge start)
- ✅ Set up bin bundling (tsup for CLI binaries)
- ✅ Update test harnesses to use new paths (CLI wrapper forwards to dist/bin/mew.js)
- ✅ Wire bin shims (mew-agent, mew-bridge)

Phase 4 — Publish & verify
- Test `npm pack` from packages/mew
- Smoke tests on bins from tarball: `mew --version`, `mew space init`
- Update all documentation
- First publish of @mew-protocol/mew

Phase 5 — (Optional) retire individual SDK packages
- Publish deprecation notes or compatibility stubs for a short window.

## Execution Plan & Order of Operations

To minimize risk and maximize speed, defer the CLI TypeScript refactor until after
the single‑package consolidation is shipped:

1) Deliver Option 4 MVP first (Phases 1–3 above):
   - One npm package `@mew-protocol/mew`
   - `mew` with `agent`/`bridge` subcommands (+ optional shims)
   - Library subpath exports
   - Templates updated to a single dependency

2) After consolidation is stable, perform the CLI TypeScript refactor as a
   follow‑up (tracked separately from this spec):
   - Convert CLI JS → TS with minimal behavior change
   - Keep subcommand UX intact
   - Add tarball smoke tests and types emission

Rationale for sequencing: isolates packaging changes from language refactors,
delivers the biggest release simplification first, and keeps debugging scopes
small if issues arise.

## Testing

- Keep existing scenario tests; they run via the `mew` binary.
- Add a minimal bin smoke suite in CI:
  - `npm pack` → install in temp dir → run `mew --version`, `mew agent --help`, `mew bridge --help`.

## Risks & Mitigations

- Larger install size → mitigate by externalizing heavyweight peer deps where safe and relying on ESM tree-shaking for libs.
- Bin dispatch regressions → maintain optional bin shims for compatibility; add smoke tests.

## Acceptance Criteria

- One npm package publishes successfully with working `mew` subcommands.
- Templates install and run using only `@mew-protocol/mew`.
- Integration scenarios pass without changes beyond dependency names.

## Protocol Spec Placement

- Canonical sources remain under `spec/` with versioned folders (`spec/v0.x/`) and draft (`spec/draft/`).
- Add a root `SPEC.md` that links to:
  - Latest stable: `spec/v0.4/SPEC.md` (update as versions change)
  - Draft (next): `spec/draft/SPEC.md`
  - ADR index: `spec/draft/decisions/`
- Root `README.md` gets a short “Protocol Spec” section linking to `SPEC.md`.
- The published npm package excludes `spec/` (docs live in GitHub, not the tarball).
