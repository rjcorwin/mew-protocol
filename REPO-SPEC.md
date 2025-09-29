# Option 4 — Single Package with Binaries and Subcommands

Status: Draft for review
Date: 2025-09-29
Owners: MEW Protocol Working Group

## Summary

Publish one npm package, `@mew-protocol/mew`, that contains:
- Library subpaths: `@mew-protocol/mew/{types,client,participant,agent,gateway,capability-matcher,bridge}`
- Executables (bins):
  - `mew` (primary CLI)
  - Subcommands: `mew agent …`, `mew bridge …`
  - Compatibility aliases (optional): `mew-agent`, `mew-bridge` → thin shims that forward to `mew agent` / `mew bridge`

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
      mew.ts                  # main CLI with subcommands
      mew-agent.ts            # (optional) thin shim → invokes subcommand
      mew-bridge.ts           # (optional) thin shim → invokes subcommand
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

## Package.json (sketch)

```
{
  "name": "@mew-protocol/mew",
  "type": "module",
  "bin": {
    "mew": "dist/bin/mew.js",
    "mew-agent": "dist/bin/mew-agent.js",    // optional compat shim
    "mew-bridge": "dist/bin/mew-bridge.js"   // optional compat shim
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
- Use `tsup` (or `rollup`) to bundle `src/bin/mew.ts` into `dist/bin/mew.js` with a shebang.
- Provide tiny compat shims `mew-agent.ts` and `mew-bridge.ts` that invoke the `mew` entry with `agent` or `bridge` subcommands.

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

