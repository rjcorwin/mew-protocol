# Test Scenario Workspace Refactor Specification

**Version:** draft (target v0.5)
**Status:** Draft
**Last Updated:** 2025-09-27
**Authors:** RJ Corwin, Contributors

## 1. Summary

Refactor automated test scenarios so each test materialises a disposable MEW space from a local template at runtime, uses the current monorepo packages, and leaves no persistent artifacts in the repository.

## 2. Motivation

- Legacy scenarios under `tests/` contain hand-maintained `space.yaml`, `tokens/`, and `logs/` directories that fall out of sync with the CLI and SDK.
- Published package versions (e.g. `mew/v0.3`) linger in checked-in configs and cause protocol mismatches when the core stack advances.
- Regenerating scenarios manually is error prone; we want a single source of truth (template) per scenario.
- Disposable spaces keep the repository clean and make test runs reproducible.

## 3. Goals & Non-Goals

### Goals
- Convert every automated scenario to initialise a fresh MEW space during `setup.sh` using a local template.
- Ensure both `space init` and `space up` automatically link local `@mew-protocol/*` workspaces when run inside the monorepo.
- Store only templates, scripts, and expected outputs in git; treat `.mew/` directories as runtime artifacts.
- Provide a repeatable migration path from `tests-deprecated/` to `tests/`.

### Non-Goals
- Changing the assertions or behaviour of existing scenario scripts beyond what is required for workspace management.
- Providing a general-purpose template system beyond the needs of automated tests.

## 4. Proposed Design

### 4.1 Repository Layout

```
tests/
├── spec/
│   └── draft/
│       └── TEST-SCENARIOS-REFACTOR.md   # this document
├── templates/                           # optional shared scenario templates
├── scenario-foo/                        # new disposable scenario
│   ├── template/                        # local template used for cloning
│   │   ├── .mew/space.yaml
│   │   └── supporting files
│   ├── setup.sh
│   ├── check.sh
│   └── teardown.sh
└── ...                                  # additional scenarios migrated over time

tests-deprecated/                        # legacy scenarios (frozen)
```

### 4.2 Scenario Lifecycle

1. **Setup**
   - `setup.sh` creates a scratch workspace directory (e.g. `.workspace/`).
   - Executes `../../cli/bin/mew.js space init --template ./template --space-dir .workspace`.
   - Runs `../../cli/bin/mew.js space up --space-dir .workspace [--port N]`.

2. **Check**
   - Existing `check.sh`/`test.sh` operate against the running space.

3. **Teardown**
   - Executes `../../cli/bin/mew.js space down --space-dir .workspace`.
   - Deletes the scratch directory.

All runtime files (`.workspace/.mew/**`) stay out of git.

### 4.3 CLI Enhancements

1. **`space init`** already supports template discovery. Extend it to accept filesystem paths (`--template ./template`).
2. **`space up`** and related commands detect when they run inside the monorepo and rewrite `.mew/package.json` dependencies to `link:` local workspaces (already implemented on `feature/tests-refactor`).
3. Both commands keep behaviour unchanged for external users using the published CLI.

### 4.4 Git Hygiene

- Add `.workspace/` (or final scratch directory name) to scenario-level `.gitignore` files or a shared ignore.
- Remove legacy `space.yaml`, `tokens/`, `logs/`, etc. from migrated scenarios.
- Preserve `tests-deprecated/` for historical reference until every scenario is ported.

## 5. Implementation Plan

1. **CLI Support**
   - Verify `space init --template <path>`; implement path support if missing.
   - Finalise the monorepo-link logic in `space up` (already drafted).

2. **Scaffold New Tests Tree**
   - Create new `tests/` directory containing `spec/`, optional shared templates, and an empty scenario stub.
   - Move legacy assets to `tests-deprecated/` (completed).

3. **Iterative Scenario Migration**
   For each scenario:
   - Extract a template under `tests/scenario-X/template/`.
   - Update scripts to use `.workspace/` scratch directory.
   - Remove legacy artefacts.
   - Run the scenario locally (via `run-all-tests.sh --no-llm` or targeted script).

4. **Documentation**
   - Update `docs/guides/TESTING.md` (in progress) with the new workflow.
   - Optionally add README notes in `tests/` describing how to generate new scenarios.

5. **Cleanup**
   - Once all scenarios are migrated, archive or remove `tests-deprecated/`.

## 6. Testing & Validation

- CI should invoke the updated `run-all-tests.sh` pointing at the new scenario directories.
- Manual smoke tests for representative scenarios (e.g. `scenario-1-basic`, `scenario-7-mcp-bridge`, `scenario-12-stream-controls`).
- Verify that `npm run build --workspaces` and `npm run test` still operate without special casing.

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Path-based templates introduce regressions in `mew space init` | Add unit/integration tests around template resolution. |
| Scenario scripts forget to clean up workspace directories | Include cleanup in `teardown.sh` and enforce via CI (fail if `.workspace/` exists after test). |
| Legacy scenarios needed for comparison | Preserve `tests-deprecated/` until migration completes. |
| Local package linking causes install delays | Use `link:` targeting relative paths; npm install runs only once per scenario setup. |

## 8. Open Questions

1. What scratch directory name should we standardise on? (`.workspace/`, `.scenario/`, etc.)
2. Do we want shared base templates (`tests/templates/`) or duplicated per scenario?
3. Should the CLI expose a convenience flag (e.g. `--local-template`) to simplify path usage?
4. How will CI select which scenarios run by default during the migration period (new vs deprecated)?

## 9. Decision Record

- Draft status: pending review.
- Implementation will proceed once CLI path support is confirmed and the migration plan is approved.
