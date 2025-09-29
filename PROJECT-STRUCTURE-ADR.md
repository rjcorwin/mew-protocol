# ADR: Repository Structure and Release Strategy

Status: Proposal
Date: 2025-09-29
Owners: MEW Protocol Working Group

## Context

Recent releases (see RELEASE.md and docs/releases/RELEASE-PLAN-v0.4.md) exposed friction and failure modes:
- Multi-package publish ordering is easy to get wrong (internal deps not bumped, templates stale).
- TypeScript project references behave differently in monorepo vs published packages (missing dist on publish).
- Manual template version updates cause spaces to be created with outdated SDK versions.
- Mixed JS/TS builds complicate tooling and verification (CLI in JS, SDK in TS).

Constraints and non-negotiables:
- A) Must continue to create and run spaces exactly as described in spaces/README.md.
- B) Tests must run as described in tests/spec/draft/SPEC.md (disposable workspaces, local templates, local linking).
- C) Release process must become simpler and less error-prone.
- CLI currently written in JS; we’re open to TypeScript refactor.
- We’re open to collapsing packages (bridge/cli/sdk) into fewer publishable units.

Goals:
- Reduce publish steps and internal version drift.
- Keep local development fast: spaces use local workspaces, not published packages.
- Keep public consumption straightforward (clear import paths, stable bins).
- Preserve or improve test and template flows.

---

## Options Considered

### Option 1 — Keep current monorepo, add disciplined release tooling (Changesets), and standardize builds

Summary:
- Keep the previous multi-package layout (separate SDK, bridge, and CLI packages).
- Adopt Changesets for versioning and publishing with dependency graph awareness.
- Convert CLI to TypeScript for a single toolchain, or keep JS with consistent build/verif.
- Add dual tsconfigs (monorepo vs publish) and a bundler for packages with bins.
- Automate template version updates in the release pipeline.

Key practices:
- Use Changesets “independent” mode or “pre” mode for coordinated releases.
- Use `workspace:` protocol (or automated replacement) for internal deps during dev; Changesets writes proper semver on publish.
- Add `tsconfig.build.json` (references, incremental) and `tsconfig.publish.json` (no refs; outDir=dist) per package.
- Bundle bin packages (agent, cli) using `tsup`/`rollup` to avoid missing dist or Node resolution mismatches.
- Add CI jobs: build, test, pack, smoke-test bin execution before publish.
- Add a script to bump template package.jsons automatically after publish.

Pros:
- Minimal disruption to code boundaries and imports (`@mew-protocol/*`).
- Fixes the “stale internal deps” class of errors via Changesets automation.
- Dual tsconfig + bundling fixes the “works in monorepo, breaks on npm” issue.
- Spaces and tests continue to work unchanged.

Cons:
- Still multiple packages to publish and coordinate.
- Requires setting up and maintaining release automation.
- Template bump step still exists (though automated).

Impact on A/B/C:
- A: No change. Spaces still use local workspaces.
- B: No change. Tests continue to init/run via local CLI and templates.
- C: Moderate improvement. Automation removes many human-error paths but keeps multi-step releases.

Migration notes:
- Introduce Changesets and CI; add dual tsconfigs; adopt bundling for bin packages.
- Optionally convert CLI to TS to unify.

---

### Option 2 — Monorepo with locked-step versioning across all packages

Summary:
- Same as Option 1, but enforce a single version for all published packages ("locked" policy).
- Every release bumps all packages to the same version (e.g., 0.5.0), regardless of which changed.

Pros:
- Simplifies release communication and internal dependency management.
- Templates always refer to a single version range; no cross-version matrix.
- Greatly reduces the chance of mixed versions in the wild.

Cons:
- “Over-versioning”: unchanged packages still get new versions.
- Larger install churn for end users compared to selective bumps.
- Still multi-package publish, though much simpler.

Impact on A/B/C:
- A: No change.
- B: No change.
- C: Large improvement. Locked versions + automation make releases predictable.

Migration notes:
- Decide on new baseline (e.g., v0.5.0) and align all packages. Drive with Changesets + CI.

---

### Option 3 — Two published packages: “SDK” aggregator + CLI

Summary:
- Collapse all SDK libraries (types, client, participant, capability-matcher, agent, gateway, bridge) into one published package: `@mew-protocol/mew`.
- Keep CLI as a separate published package `@mew-protocol/cli` (or include CLI here; see Option 4).
- Inside the repo, retain modular source folders. The aggregator package builds and exports subpaths, e.g.:
  - `@mew-protocol/mew/types`
  - `@mew-protocol/mew/client`
  - `@mew-protocol/mew/participant`
  - `@mew-protocol/mew/agent`
  - `@mew-protocol/mew/gateway`
  - `@mew-protocol/mew/bridge`
- Publish only `@mew-protocol/mew` and `@mew-protocol/cli`; stop publishing individual SDK packages.

Pros:
- Drastically fewer publish steps and version edges.
- Internal dependency drift disappears (single package boundary).
- Templates pin one SDK version (`@mew-protocol/mew`), making CLI template maintenance trivial.
- Subpath exports retain modular import ergonomics for consumers.

Cons:
- Breaking import path change for existing users (`@mew-protocol/mew/agent` → `@mew-protocol/mew/agent`).
- Larger single package; requires careful exports and externalization to keep install size reasonable.
- Requires migration plan for existing dependent projects and templates.

Impact on A/B/C:
- A: Minimal changes. CLI can still rewrite dependencies for local dev. Spaces depend on `@mew-protocol/mew` instead of multiple packages.
- B: Minimal changes. Tests point templates at the aggregator; local linking still works.
- C: Very large improvement. Only two packages to release; dependency ordering issues vanish inside SDK.

Migration notes:
- Provide compatibility stubs: keep publishing very thin `@mew-protocol/*` packages for 1–2 minor releases that re-export from `@mew-protocol/mew/*`, with deprecation warnings.
- Update CLI templates and docs to use `@mew-protocol/mew`.
- Add a wrapper at `./packages/mew/src/bin/mew.js` that forwards to the built CLI location to preserve test/dev scripts during transition.

---

### Option 4 — Single published package including the CLI

Summary:
- Publish one package: `@mew-protocol/mew`, containing both SDK subpath exports and the `mew` binary.
- Monorepo retains modular source layout; the publish step bundles everything into one install.

Pros:
- Simplest possible release surface: one version, one publish, zero internal dependency drift.
- Templates need no cross-package alignment.
- E2E verification is straightforward (install once, run everything).

Cons:
- Bigger package install; users who only need types still install the CLI binary and other code (can be mitigated with conditional exports and optional dependencies).
- Requires very careful packaging (bin, exports map, tree-shaking/unbundled externals).
- Harder to adopt different release cadences between CLI and SDK if needed later.

Impact on A/B/C:
- A: Minimal change, possibly even simpler (CLI + SDK always in sync).
- B: Minimal change; tests use local CLI from the same package.
- C: Maximum simplification. Only one publish.

Migration notes:
- Same as Option 3, plus moving CLI into the aggregator. Provide a temporary `cli` wrapper to avoid breaking local dev paths.

---

### Option 5 — Split into multiple repositories (SDK, CLI, Bridge)

Summary:
- Separate repos and releases per responsibility (sdk, cli, bridge).

Pros:
- Clear ownership and isolated release cycles.
- Smaller repos, potentially simpler CI per repo.

Cons:
- Local dev becomes harder (cross-repo linking) and slows iteration.
- Integration tests and spaces must coordinate multiple repos.
- Does not solve internal dependency drift across repos; arguably makes it worse.

Impact on A/B/C:
- A: Risk to simplicity of local space creation.
- B: More complicated test bootstrapping across repos.
- C: Could simplify per-repo releases, but increases cross-repo coordination.

Migration notes:
- Significant non-trivial retooling of tests and developer workflow.

---

## Recommended Path

Recommendation: Option 3 now, with an easy path to Option 4 later if we want even more simplicity.

Why:
- It meaningfully reduces release complexity today while preserving modular imports (via subpaths) and code organization.
- It keeps CLI as a separate package so we can iterate its UX faster without forcing SDK updates, but still cuts publish surfaces from 7→2.
- It makes template maintenance trivial (one SDK version to update in templates), and avoids internal SDK dependency skew entirely.
- It minimizes breaking changes by offering compatibility stubs for `@mew-protocol/*` packages during a migration window.

If we later find ourselves still doing too much ceremony, moving to Option 4 (one package including CLI) is straightforward from Option 3.

---

## Migration Plan (to Option 3)

Phase 0 — Prework
- Adopt Changesets for versioning and CI-driven publish to support the transition safely.
- Add per-package dual tsconfigs and bundling for bin packages (agent, cli) to stabilize publishing now.

Phase 1 — Create aggregator package
- New workspace `packages/mew` (or `sdk/mew`) with `name: "@mew-protocol/mew"`.
- Export subpaths mapping to current modules: `types`, `client`, `participant`, `agent`, `gateway`, `capability-matcher`, `bridge`.
- Set up build to roll the subpackages into `@mew-protocol/mew` dist (either re-export via `exports` that target built outputs, or bundle).
- Keep existing package folders as source-of-truth; avoid code duplication.

Phase 2 — Update consumers and templates
- Update CLI templates to depend on `@mew-protocol/mew` only.
- Keep a local dev rewrite in the CLI so spaces in `tests/` and `spaces/` link to the aggregator workspace automatically.

Phase 3 — Publish compatibility stubs
- Publish thin `@mew-protocol/mew/agent`, `@mew-protocol/mew/client`, etc., that re-export from `@mew-protocol/mew/*` and emit console deprecation warnings. Mark them as deprecated on npm.
- Maintain for 1–2 minor versions, then retire.

Phase 4 — Decommission individual SDK packages (publish)
- Stop publishing the old SDK packages once most consumers have migrated. Keep source subfolders for code organization.

Phase 5 — Stabilize release
- CI pipeline publishes only `@mew-protocol/mew` and `@mew-protocol/cli` in order.
- Add end-to-end post-publish smoke tests: `npx @mew-protocol/cli space init` → `space up` → HTTP curl checks.

---

## CLI Language Choice

Recommendation: Convert CLI to TypeScript while migrating. Benefits:
- Unified toolchain (shared tsconfig.base, stricter types, easier refactors).
- Better confidence in publish artifacts by reusing the bundling/publish script.

If we defer conversion, keep JS but add the same publish verification steps (pack, execute bin, template init) in CI.

---

## Testing and Spaces — Ensuring A and B

Spaces (spaces/README.md):
- Keep the local rewrite behavior: when running inside this repo, `space init`/`space up` rewrite `.mew/package.json` deps to link workspaces, then run `npm install` inside the space.
- With Option 3, rewrite to `@mew-protocol/mew` only. This actually shortens the rewrite surface.

Tests (tests/spec/draft/SPEC.md):
- The disposable workspace strategy is unaffected: `packages/mew/src/bin/mew.js space init --template ../template --space-dir .` still works.
- Ensure we keep a stable wrapper at `./packages/mew/src/bin/mew.js` (or forwards to the built CLI) so existing scripts and docs don’t break.
- Add a minimal shared test util to assert `@mew-protocol/mew` version inside the workspace to catch template drift early.

---

## Additional Process Improvements (independent of structure)

- Automated internal dependency audit: even with Options 1/2, Changesets solves most of this; keep a guard script in CI that fails if any `@mew-protocol/*` dep drifts from the planned version.
- Post-publish verification: in CI, `npm pack` each publishable, verify `dist/`, run a bin smoke test, then publish.
- Template sync automation: script that updates CLI template package.jsons and runs a quick `npm install` check.
- Envelope-level test assertions: continue adopting the gateway log assertions described in tests/spec/draft/SPEC.md to increase protocol coverage.

---

## Decision

Adopt Option 3 (SDK aggregator + separate CLI) as the target structure, with a planned compatibility window and automation as described. Revisit moving to Option 4 after 1–2 releases if we still experience undue release friction.

Rationale:
- Largest reduction in publisher-surface with minimal impact to tests/spaces.
- Clear path to migrate import paths with limited disruption.
- Places failure-prone manual steps (internal version bumps, template skew) behind a smaller, more automated surface.

---

## Open Questions

- Subpath export granularity: Do we expose `@mew-protocol/mew/gateway/server`-level paths or keep to top-level modules?
- ESM/CJS packaging: Do we publish dual builds or ESM-only with clear guidance? (Recommendation: ESM-only for new releases + `.d.ts`, with NodeNext.)
- Template slimming: With a single SDK dep, can we remove duplicate template dependencies without harming clarity?
- Version policy: If we later align CLI and SDK releases, would Option 4 materially reduce friction further?

