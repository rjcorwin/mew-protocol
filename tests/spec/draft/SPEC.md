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
    │   └── (files mirroring packages/mew/templates/* structure)
    ├── setup.sh                        # initialises disposable workspace
    ├── check.sh / test.sh              # scenario assertions
    └── teardown.sh                     # shuts down & deletes workspace dir
```

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

- Scenario templates mimic the layout of `packages/mew/templates/*` (e.g. `package.json`,
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

---

---

## 8. Validation

- CI invokes the new scenarios via the updated test runner.
- Manual smoke tests cover representative scenarios (e.g. basic message flow,
  MCP bridge, proposal workflows).
- `npm run build --workspaces` and other workspace commands continue to operate
  without additional configuration.

---

## 9. Envelope Monitoring and Assertions

Test scenarios leverage gateway envelope logging for comprehensive protocol validation alongside traditional participant log monitoring.

### Gateway Log Integration

The CLI provides dual-log architecture (available v0.5.0+) enabled by default:
- **Envelope History** (`.mew/logs/envelope-history.jsonl`) - Message flow, delivery, failures
- **Capability Decisions** (`.mew/logs/capability-decisions.jsonl`) - Routing decisions, capability checks

### Hybrid Monitoring Approach

**Protocol-level validation** (gateway logs):
- Envelope routing and delivery confirmation
- Capability matching and grant decisions
- Timing and performance metrics
- Complete envelope flow tracing

**Application-level validation** (participant logs):
- Business logic and content validation
- Agent-specific behavior verification
- User interaction and response patterns

### Shared Test Utilities

**Standard Helper Library** (`tests/lib/gateway-logs.sh`):
```bash
# Envelope monitoring functions
wait_for_envelope() {
  local envelope_id="$1"
  timeout 30 bash -c "until grep -q '\"id\":\"$envelope_id\"' .mew/logs/envelope-history.jsonl; do sleep 0.1; done"
}

assert_envelope_delivered() {
  local envelope_id="$1" participant="$2"
  grep -q "\"event\":\"delivered\".*\"id\":\"$envelope_id\".*\"participant\":\"$participant\"" .mew/logs/envelope-history.jsonl
}

assert_capability_granted() {
  local participant="$1" capability="$2"
  grep -q "\"result\":\"allowed\".*\"participant\":\"$participant\".*\"required_capability\":\"$capability\"" .mew/logs/capability-decisions.jsonl
}
```

### Usage Pattern

**Enhanced Test Flow:**
```bash
# In check.sh
source ../lib/gateway-logs.sh

# Send test message with envelope ID
envelope_id=$(generate_envelope_id)
send_test_message "$envelope_id" "Hello agent"

# Validate protocol-level delivery
wait_for_envelope "$envelope_id"
assert_envelope_delivered "$envelope_id" "agent"
assert_capability_granted "agent" "chat"

# Validate application-level response
wait_for_pattern "${OUTPUT_LOG}" "Echo: Hello agent"
```

### Migration Strategy

**New scenarios**: Use gateway logs as primary monitoring with participant logs for application validation.

**Existing scenarios**: Add gateway log assertions alongside existing participant log checks, migrating critical validations incrementally.

---

## 10. Open Questions

- Final naming for the scratch workspace directory (`.workspace/` vs another).
- Standardising shared template structure vs per-scenario duplication.
- Whether to add a convenience flag to the CLI for “use local template”.
- CI strategy for running scenarios (parallel execution vs sequential).

---

## 11. Change Log

- 2025-09-27: Initial draft capturing planned final state of disposable
  workspaces for tests.
