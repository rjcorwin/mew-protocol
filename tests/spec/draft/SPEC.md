# MEW Tests Specification (Draft)

**Status:** Draft  
**Last Updated:** 2025-09-27  
**Owner:** Testing & QA Working Group

---

## 1. Overview

The MEW test suite exercises the protocol, CLI, and SDK behaviours using executable
scenarios. Each scenario lives in its own directory and creates a disposable MEW
space at runtime. The permanent contents under `tests/` are limited to:

- Scenario templates describing the desired space configuration
- Test harness scripts (`setup.sh`, `check.sh`, `teardown.sh`)
- Expected outputs and documentation

All runtime artefacts (`.mew/`, tokens, logs, PM2 state) are generated during
`setup.sh` and removed in `teardown.sh`.

---

## 2. Objectives

- Guarantee scenarios run against the **current** monorepo packages (no stale
  published versions).
- Provide a reproducible workflow for creating, executing, and cleaning up test
  spaces.
- Keep the repository clean of runtime artefacts while still documenting scenario
  behaviour through tracked templates and scripts.

---

## 3. Directory Structure

```
tests/
├── spec/
│   └── draft/
│       ├── SPEC.md                      # this document
│       └── decisions/ (optional ADRs)
├── templates/                          # shared base templates (optional)
└── scenario-*/
    ├── template/                       # scenario-specific template
    │   └── (files mirroring cli/templates/* structure)
    ├── setup.sh                        # initialises disposable workspace
    ├── check.sh / test.sh              # scenario assertions
    └── teardown.sh                     # shuts down & deletes workspace dir
```

Legacy scenarios are archived under `tests-deprecated/` and are not executed by
CI once the migration completes.

---

## 4. Scenario Lifecycle

1. **Setup (`setup.sh`)**
   - Creates a scratch directory (default: `.workspace/`) and `cd`s into it.
   - Runs `../../cli/bin/mew.js space init --template ../template --space-dir .` so the local template is treated exactly like the built-in CLI templates.
   - Starts the space via `../../cli/bin/mew.js space up --space-dir . [--port N]`.
   - Exports environment variables needed by the scenario scripts (e.g. port,
     log paths).

2. **Execution (`check.sh` / `test.sh`)**
   - Interacts with the running space (curl, CLI commands, client scripts).
   - Asserts expected responses and exits with non-zero code on failure.

3. **Teardown (`teardown.sh`)**
   - Calls `mew space down --space-dir .workspace`.
   - Removes the scratch directory to eliminate tokens/logs/fifo artefacts.

---

## 5. CLI Integration

- `mew space init` accepts template **paths** in addition to named templates.
- When run inside the monorepo, both `space init` and `space up` rewrite
  `.mew/package.json` dependencies to `link:` the local `@mew-protocol/*`
  workspaces and re-run `npm install` inside the workspace directory.
- Behaviour for published CLI users (outside the repo) is unchanged; they still
  receive the published package versions.

---

## 6. Templates

- Scenario templates mimic the layout of `cli/templates/*` (e.g. `package.json`,
  `.mew/space.yaml`, supporting files). This allows `mew space init --template`
  to operate without special handling.
- Templates follow the usual substitution tokens (`{{SPACE_NAME}}`, etc.).
- Shared assets (common agents, scripts) may live under `tests/templates/` and be
  referenced via template inheritance or duplication, depending on needs.
- Each template is versioned alongside its scenario scripts to keep historical
  context.

---

## 7. Git Hygiene

- `.workspace/` (or the chosen scratch directory name) is gitignored at the
  scenario level.
- Only template files, scripts, and documentation are tracked.
- Legacy directories remain under `tests-deprecated/` until migration finishes.

---

## 8. Migration Strategy

1. Move the old `tests/` tree to `tests-deprecated/` (completed).
2. For each scenario:
   - Port the configuration into `template/.mew/space.yaml`.
   - Update scripts to use the disposable workspace lifecycle outlined above.
   - Validate the scenario locally.
3. Update the test runner (`run-all-tests.sh` or replacement) to operate on the
   new scenario directories.
4. Remove `tests-deprecated/` once all scenarios are migrated and passing.

---

## 9. Validation

- CI invokes the new scenarios via the updated test runner.
- Manual smoke tests cover representative scenarios (e.g. basic message flow,
  MCP bridge, proposal workflows).
- `npm run build --workspaces` and other workspace commands continue to operate
  without additional configuration.

---

## 10. Open Questions

- Final naming for the scratch workspace directory (`.workspace/` vs another).
- Standardising shared template structure vs per-scenario duplication.
- Whether to add a convenience flag to the CLI for “use local template”.
- CI strategy during migration (run both new and deprecated scenarios or adopt a
  phased rollout).

---

## 11. Change Log

- 2025-09-27: Initial draft capturing planned final state of disposable
  workspaces for tests.
