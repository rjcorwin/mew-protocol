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
  src/
    bin/
      mew.js                  # main CLI with subcommands (JS first; TS later)
      mew-agent.js            # shim → invokes `mew agent …`
      mew-bridge.js           # shim → invokes `mew bridge …`
    types/index.ts            # re-export
    client/index.ts           # re-export
    participant/index.ts
    agent/index.ts
    gateway/index.ts
    capability-matcher/index.ts
    bridge/index.ts
  tsconfig.build.json         # emits dist/esm + .d.ts
  tsup.config.ts              # multi-entry bundle for bins (optional, see Build)
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
│     ├─ tsconfig.build.json
│     ├─ tsup.config.ts          # (optional) bin bundling config
│     ├─ CHANGELOG.md
│     └─ README.md
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

Both `spaces/` (developer sandboxes) and `tests/` (disposable scenario workspaces) must use the
local source during development while requiring zero manual `npm link` steps. This design bakes
that behavior into the CLI and harnesses.

### Inside the Repo (Dev Mode)

- Detection: CLI considers itself “inside the repo” if it finds the repo markers (e.g.,
  `REPO-SPEC.md` and `packages/mew/package.json`) when resolving the current working directory or
  a configured `--space` path.
- Rewrite rule during `space init` and scenario setup:
  - In the generated space `package.json`, set:
    ```json
    {
      "dependencies": {
        "@mew-protocol/mew": "link:../../packages/mew"
      }
    }
    ```
  - Rationale: `link:` creates a symlink to the local workspace ensuring changes are immediately
    visible without publish. This also avoids copying like `file:` does.
- Install step: CLI runs `npm install` inside the space after writing the dependency to realize the
  link.
- Provenance file: CLI writes `.mew/local-link.json` with the resolved absolute path and repo
  commit so issues are diagnosable from logs.

Local CLI path (stable wrapper):
- The repository keeps `cli/bin/mew.js` as a stable path for manual testing under `spaces/`.
- This wrapper invokes the current local CLI implementation and forwards to the built entry once
  the single package is in place. Example usage from a space directory:
  ```bash
  ../../cli/bin/mew.js space init .
  ../../cli/bin/mew.js space up
  ../../cli/bin/mew.js space connect
  ```
  As an alternative, after building the single package you may run:
  ```bash
  node ../../packages/mew/dist/bin/mew.js space init .
  ```

Environment overrides (optional):
- `MEW_LOCAL_SDK_PATH`: if set, CLI uses `link:${MEW_LOCAL_SDK_PATH}` for `@mew-protocol/mew`.
- `MEW_FORCE_PUBLISHED`: if set, disables linking and uses normal semver resolution even inside
  the repo (useful for simulating end-user installs in dev).

### Outside the Repo (Published Mode)

- CLI behaves as a normal consumer; templates depend on `@mew-protocol/mew` by semver.
- No linking or rewrites occur.

### spaces/README.md Integration

- Spaces created under `spaces/` are for interactive local dev and always use the local link rule
  described above. The README should document:
  - Creating a new space under `spaces/` and running `mew space init`.
  - Using the stable local CLI path `../../cli/bin/mew.js`.
  - That dependencies are linked to the local `packages/mew` automatically (no registry needed).
  - That no `npm link` or publish steps are required.

### tests/README.md Integration

- Scenario harnesses create disposable workspaces (typically under
  `tests/scenario-*/.workspace`). The CLI, invoked from the repo, applies the same link rule so that
  scenarios exercise the current source.
- Each scenario’s `setup.sh` continues to call the local CLI path (e.g., `../../cli/bin/mew.js …` or
  the new consolidated `mew` binary). The dependency rewrite occurs in the generated workspace
  transparently.
- Tests run with network access disabled; linking ensures no npm registry access is required.

### Fallback Behavior and Robustness

- If linking fails (e.g., path resolution or permissions), CLI falls back to
  `file:../../packages/mew` and logs a warning, so dev is not blocked.
- The presence of `.mew/local-link.json` helps diagnose whether a space is using linked or
  published bits.

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

Manual “spaces” exist under `spaces/` for developer exploration:

```bash
cd spaces && mkdir test-demo && cd test-demo
# Init uses local link: to @mew-protocol/mew when run inside the repo
../../cli/bin/mew.js space init .
../../cli/bin/mew.js space up
# Interact
../../cli/bin/mew.js space connect
```

Key points:
- The CLI writes `@mew-protocol/mew: link:../../packages/mew` into the space’s `package.json`.
- `npm install` is run inside the space automatically.
- Provenance written to `.mew/local-link.json` for diagnostics.
- To simulate end‑user installs (no local link), export `MEW_FORCE_PUBLISHED=1` and re‑init.

### 3) Tests Testing (E2E Scenarios)

E2E tests live under `tests/scenario-*` and create disposable workspaces under `.workspace/`:

```bash
# Run all non‑LLM scenarios
npm run test

# Or invoke a single scenario’s shell orchestrator
tests/scenario-14-cat-maze/test.sh
```

Behavior:
- Scenario setup calls the local CLI (compat wrapper path preserved) so the same linking rule applies.
- No network/npm required during runs; local link ensures the test workspace uses current sources.
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

Phase 1 — Package add
- Create `packages/mew` and wire the build (tsc + tsup).
- Implement `mew` subcommand dispatcher.
- Add optional shims for `mew-agent` and `mew-bridge`.

Phase 2 — Template & docs
- Switch templates to `@mew-protocol/mew`.
- Update docs and quick starts.

Phase 3 — Publish & verify
- `npm pack` verification.
- Smoke tests on bins from tarball: `mew --version`, `mew space init`, `mew agent --help`, `mew bridge --help`.

Phase 4 — (Optional) retire individual SDK packages
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
