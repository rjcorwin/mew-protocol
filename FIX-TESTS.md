# Test Suite Refactor Analysis & Fix Plan

## Executive Summary

After the major repository refactor (multiple packages → single `@mew-protocol/mew` package, CLI JS → TypeScript), the test suite in `tests/` requires updates to work with the new structure. This document analyzes all 15 test scenarios and provides a comprehensive fix plan.

## Current State Analysis

### Repository Changes (Completed)

From REPO-SPEC.md Phase 3 (✅ COMPLETED):
- ✅ Consolidated multiple packages into single `packages/mew/`
- ✅ CLI converted from CommonJS to ESM (TypeScript)
- ✅ Templates no longer have `package.json` (Phase 4 requirement)
- ✅ All dependencies bundled in CLI package
- ✅ Global install required for PM2 to find `mew` command
- ✅ New paths: `packages/mew/dist/{bin,agent,bridge,gateway,client,participant,etc.}`

### Test Scenarios Overview

Found 15 test scenarios in `tests/`:
1. scenario-1-basic - Basic message flow
2. scenario-2-mcp - MCP tool execution
3. scenario-3-proposals - Proposal workflow
4. scenario-4-capabilities - Capability management
5. scenario-5-reasoning - Reasoning flow
6. scenario-6-errors - Error handling
7. scenario-7-mcp-bridge - MCP bridge integration
8. scenario-8-grant - Capability grant workflow
9. scenario-8-typescript-agent - TypeScript agent tools
10. scenario-9-typescript-proposals - TypeScript proposal workflow
11. scenario-10-multi-agent - Multi-agent coordination
12. scenario-11-chat-controls - Chat controls
13. scenario-12-stream-controls - Stream lifecycle
14. scenario-13-participant-controls - Participant lifecycle
15. scenario-14-cat-maze - Cat maze template test

Each scenario follows the pattern:
- `template/` - Template files copied to workspace
- `setup.sh` - Creates workspace, runs `mew init`, starts space
- `check.sh` - Runs test assertions
- `teardown.sh` - Stops space, cleans workspace
- `test.sh` - Orchestrates setup → check → teardown

## Issues Found

### 1. Old CLI Path References (HIGH PRIORITY)

**Location**: All `teardown.sh` files
**Issue**: Still reference `${REPO_ROOT}/cli/bin/mew.js`
**Impact**: Teardown fails to stop spaces properly

**Files affected**:
```
tests/scenario-1-basic/teardown.sh:9
tests/scenario-4-capabilities/teardown.sh:9
tests/scenario-5-reasoning/teardown.sh:9
tests/scenario-6-errors/teardown.sh:9
tests/scenario-8-grant/teardown.sh:9
tests/scenario-8-typescript-agent/teardown.sh:9
tests/scenario-9-typescript-proposals/teardown.sh:9
tests/scenario-11-chat-controls/teardown.sh:9
tests/scenario-13-participant-controls/teardown.sh:9
tests/scenario-14-cat-maze/check.sh:172
```

**Current code**:
```bash
CLI_BIN="${REPO_ROOT}/cli/bin/mew.js"
if [[ -f "${CLI_BIN}" ]]; then
  node "${CLI_BIN}" space down --space-dir "${WORKSPACE_DIR}" >/dev/null 2>&1 || true
fi
```

**Should be**:
```bash
# Use global mew command (required after refactor)
mew space down --space-dir "${WORKSPACE_DIR}" >/dev/null 2>&1 || true
```

### 2. Old SDK Path References (HIGH PRIORITY)

**Location**: TypeScript agent scenario templates
**Issue**: Reference old SDK path `../../../sdk/typescript-sdk/agent/dist/index.js`
**Impact**: TypeScript agent scenarios can't start agents

**Files affected**:
```
tests/scenario-8-typescript-agent/template/space.yaml:13
tests/scenario-9-typescript-proposals/template/space.yaml:13
```

**Current code**:
```yaml
command: "node"
args:
  - "../../../sdk/typescript-sdk/agent/dist/index.js"
```

**Should be**:
```yaml
command: "node"
args:
  - "../../../packages/mew/dist/agent/index.js"
```

**Alternative** (use mew command for consistency):
```yaml
command: "mew"
args:
  - "agent"
  - "run"
  - "--gateway"
  - "ws://localhost:${PORT}"
  # ... rest of args
```

### 3. Old Bridge Path References (MEDIUM PRIORITY)

**Location**: Bridge scenario setup
**Issue**: References old bridge path `${REPO_ROOT}/bridge/dist/mcp-bridge.js`
**Impact**: Bridge scenario setup fails path checks

**Files affected**:
```
tests/scenario-7-mcp-bridge/setup.sh:33
```

**Current code**:
```bash
BRIDGE_DIST=${REPO_ROOT}/bridge/dist/mcp-bridge.js
if [[ ! -f "${BRIDGE_DIST}" ]]; then
  printf "%b\n" "${YELLOW}Building @mew-protocol/bridge (tsc)${NC}"
```

**Should be**:
```bash
BRIDGE_DIST=${REPO_ROOT}/packages/mew/dist/bridge/index.js
if [[ ! -f "${BRIDGE_DIST}" ]]; then
  printf "%b\n" "${YELLOW}Building mew package (tsc)${NC}"
```

### 4. Old Agent Path References in Setup Scripts (MEDIUM PRIORITY)

**Location**: TypeScript agent scenario setup
**Issue**: Checks for old agent path
**Impact**: Setup scripts fail or rebuild unnecessarily

**Files affected**:
```
tests/scenario-8-typescript-agent/setup.sh:13
```

**Current code**:
```bash
AGENT_DIST="${REPO_ROOT}/sdk/typescript-sdk/agent/dist/index.js"
```

**Should be**:
```bash
AGENT_DIST="${REPO_ROOT}/packages/mew/dist/agent/index.js"
```

### 5. Template package.json Files (PHASE 4 VIOLATION)

**Location**: All test scenario templates
**Issue**: Templates still have `package.json` files
**Impact**: Inconsistent with Phase 4 requirement and published templates

**Files affected**:
```
tests/scenario-1-basic/template/package.json
tests/scenario-2-mcp/template/package.json
tests/scenario-3-proposals/template/package.json
tests/scenario-4-capabilities/template/package.json
tests/scenario-5-reasoning/template/package.json
tests/scenario-6-errors/template/package.json
tests/scenario-7-mcp-bridge/template/package.json
tests/scenario-8-grant/template/package.json
tests/scenario-8-typescript-agent/template/package.json
tests/scenario-9-typescript-proposals/template/package.json
tests/scenario-10-multi-agent/template/package.json
tests/scenario-11-chat-controls/template/package.json
tests/scenario-12-stream-controls/template/package.json
tests/scenario-13-participant-controls/template/package.json
```

**Assessment**: Test templates may legitimately need dependencies (like `ws` for test clients) that aren't bundled in the CLI. However, they should NOT reference old package names.

**Found dependencies**:
- `ws` - WebSocket library (used by test client agents)
- `@modelcontextprotocol/server-filesystem` - MCP filesystem server (scenario 7)
- `@mew-protocol/agent` - Old package name (should reference global `mew agent` command instead)
- `@mew-protocol/participant` - Old package name (not needed if using global commands)

**Decision needed**:
- Keep `package.json` for legitimate test dependencies like `ws`?
- Or bundle everything and have test agents use global `mew` commands?

### 6. Template Structure Inconsistency (LOW PRIORITY)

**Observation**: Test templates have different structure from published templates:
- Published templates (in `packages/mew/templates/`): No `package.json`, uses `mew agent` and `mew bridge` commands
- Test templates: Have `package.json`, mix of `node` commands and file paths

**Impact**: Tests don't exercise the same code paths as real usage

### 7. Missing Scenarios (INFORMATIONAL)

**No scenario for**: scenario-14-cat-maze has some missing files referenced in logs

## Detailed Fix Plan

### Phase 1: Path Updates (CRITICAL - DO FIRST)

**Goal**: Fix all path references to work with new package structure

**Tasks**:

1. **Update all teardown.sh files** (10 files)
   - Remove `CLI_BIN` variable
   - Replace `node "${CLI_BIN}"` with `mew`
   - Simplify to use global command

2. **Update TypeScript agent space.yaml files** (2 files)
   - Change `../../../sdk/typescript-sdk/agent/dist/index.js`
   - To: `../../../packages/mew/dist/agent/index.js`
   - Or switch to: `mew agent run` command (preferred for consistency)

3. **Update bridge setup.sh** (1 file)
   - Change `${REPO_ROOT}/bridge/dist/mcp-bridge.js`
   - To: `${REPO_ROOT}/packages/mew/dist/bridge/index.js`

4. **Update agent setup.sh** (1 file)
   - Change `${REPO_ROOT}/sdk/typescript-sdk/agent/dist/index.js`
   - To: `${REPO_ROOT}/packages/mew/dist/agent/index.js`

5. **Update scenario-14 check.sh** (1 file)
   - Change `node "${REPO_ROOT}/cli/bin/mew.js"`
   - To: `mew`

**Validation**: Run `./tests/run-all-tests.sh` and verify no path errors

### Phase 2: Template Cleanup (RECOMMENDED)

**Goal**: Align test templates with Phase 4 architecture

**Decision point**: Keep package.json for test-specific dependencies?

**Option A - Keep Minimal package.json** (RECOMMENDED):
- Keep `package.json` ONLY if template has legitimate non-CLI dependencies
- Remove `package.json` from templates that don't need it
- Update remaining ones to remove old `@mew-protocol/*` dependencies

**Option B - Remove All package.json**:
- Bundle test dependencies in a shared test helper
- Update all test agents to use global commands or bundled utilities

**Recommended**: Option A for pragmatism

**Tasks** (Option A):

1. **Audit each template's dependencies**:
   ```bash
   # scenario-1-basic: ws (for test client) - KEEP
   # scenario-7-mcp-bridge: @modelcontextprotocol/server-filesystem - KEEP
   # scenario-8-typescript-agent: @mew-protocol/agent - REMOVE (use mew command)
   # scenario-9-typescript-proposals: @mew-protocol/agent - REMOVE
   # scenario-10-multi-agent: @mew-protocol/participant - REMOVE
   # Others: Check if package.json is actually used
   ```

2. **Remove unnecessary package.json files**:
   - Scenarios 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13 (if using only local agents)

3. **Update necessary package.json files**:
   - Remove `@mew-protocol/*` dependencies
   - Keep only external dependencies like `ws`, `@modelcontextprotocol/*`

4. **Convert TypeScript agent references**:
   - Update space.yaml to use `mew agent run` command
   - Remove `@mew-protocol/agent` dependency

**Validation**: Run specific scenarios and verify they still work

### Phase 3: Template Consistency (OPTIONAL)

**Goal**: Make test templates exercise the same code paths as real usage

**Tasks**:

1. **Convert direct path references to CLI commands**:
   - Change: `node ./.mew/agents/some-agent.js`
   - To: Use local JS agents with WebSocket (already correct pattern)

2. **Document test template patterns** in tests/README.md:
   - When to use `mew agent run` vs local JS agents
   - When to use `mew bridge start` vs direct MCP servers
   - How test templates differ from published templates

**Validation**: Manual review of template patterns

### Phase 4: Documentation Updates (REQUIRED)

**Goal**: Update test documentation to reflect new architecture

**Tasks**:

1. **Update tests/README.md**:
   - Add "Post-Refactor Changes" section
   - Document new package structure impact
   - Update "Running Tests" section with new paths
   - Note: Templates no longer use old SDK paths

2. **Update TESTING.md** (if exists):
   - Reference new package structure
   - Update any CLI path examples

3. **Update scenario READMEs** (if any exist):
   - Update outdated path references

**Validation**: Documentation review

## Implementation Order

### Week 1: Critical Fixes
1. ✅ Phase 1: Path Updates (all scenarios working)
2. ✅ Run all tests to verify no regressions

### Week 2: Cleanup & Consistency
3. ✅ Phase 2: Template Cleanup (align with Phase 4)
4. ✅ Run all tests again

### Week 3: Polish
5. ✅ Phase 3: Template Consistency (optional improvements)
6. ✅ Phase 4: Documentation Updates
7. ✅ Final full test run

## Success Criteria

- [ ] All 15 test scenarios pass with `./tests/run-all-tests.sh`
- [ ] No references to old paths (`cli/bin/mew.js`, `sdk/typescript-sdk/`, `bridge/dist/`)
- [ ] Test templates align with Phase 4 requirements (minimal/no package.json)
- [ ] Documentation reflects new structure
- [ ] CI/CD passes (if configured)

## Risk Assessment

**Low Risk**:
- Path updates are straightforward find/replace
- Tests already use `mew` command in setup.sh (only teardown is outdated)
- Run-all-tests script already does global install

**Medium Risk**:
- Template package.json cleanup might break scenarios with real dependencies
- Mitigation: Test each scenario individually after changes

**High Risk**: None identified

## Open Questions

1. **Should test templates match published templates exactly?**
   - Pro: Tests real user experience
   - Con: Test templates may need special dependencies or test-specific agents
   - Recommendation: Close alignment, but allow test-specific variations

2. **What about TypeScript agent scenarios?**
   - Current: Use direct path to dist/agent/index.js
   - Alternative: Use `mew agent run` command
   - Recommendation: Switch to `mew agent run` for consistency, but keep path option if it simplifies testing

3. **Should we add new scenarios for refactor-specific features?**
   - E.g., scenario testing `mew bridge start` command
   - Recommendation: Not needed if existing scenarios cover functionality

## Appendix A: File Inventory

### Files Requiring Changes

**Teardown scripts** (10 files):
- tests/scenario-1-basic/teardown.sh
- tests/scenario-4-capabilities/teardown.sh
- tests/scenario-5-reasoning/teardown.sh
- tests/scenario-6-errors/teardown.sh
- tests/scenario-8-grant/teardown.sh
- tests/scenario-8-typescript-agent/teardown.sh
- tests/scenario-9-typescript-proposals/teardown.sh
- tests/scenario-11-chat-controls/teardown.sh
- tests/scenario-13-participant-controls/teardown.sh
- tests/scenario-14-cat-maze/check.sh (line 172)

**Space.yaml files** (2 files):
- tests/scenario-8-typescript-agent/template/space.yaml
- tests/scenario-9-typescript-proposals/template/space.yaml

**Setup scripts** (2 files):
- tests/scenario-7-mcp-bridge/setup.sh
- tests/scenario-8-typescript-agent/setup.sh

**Package.json files** (14 files - needs per-file assessment):
- tests/scenario-1-basic/template/package.json (ws - KEEP)
- tests/scenario-2-mcp/template/package.json (audit)
- tests/scenario-3-proposals/template/package.json (audit)
- tests/scenario-4-capabilities/template/package.json (audit)
- tests/scenario-5-reasoning/template/package.json (audit)
- tests/scenario-6-errors/template/package.json (audit)
- tests/scenario-7-mcp-bridge/template/package.json (MCP server - KEEP)
- tests/scenario-8-grant/template/package.json (audit)
- tests/scenario-8-typescript-agent/template/package.json (REMOVE - use mew command)
- tests/scenario-9-typescript-proposals/template/package.json (REMOVE - use mew command)
- tests/scenario-10-multi-agent/template/package.json (REMOVE - use mew command)
- tests/scenario-11-chat-controls/template/package.json (audit)
- tests/scenario-12-stream-controls/template/package.json (audit)
- tests/scenario-13-participant-controls/template/package.json (audit)

## Appendix B: Example Fixes

### Example 1: teardown.sh

**Before**:
```bash
CLI_BIN="${REPO_ROOT}/cli/bin/mew.js"

if [[ -d "${WORKSPACE_DIR}" ]]; then
  if [[ -f "${CLI_BIN}" ]]; then
    node "${CLI_BIN}" space down --space-dir "${WORKSPACE_DIR}" >/dev/null 2>&1 || true
  fi
  rm -rf "${WORKSPACE_DIR}"
fi
```

**After**:
```bash
if [[ -d "${WORKSPACE_DIR}" ]]; then
  # Use global mew command (installed by test runner)
  mew space down --space-dir "${WORKSPACE_DIR}" >/dev/null 2>&1 || true
  rm -rf "${WORKSPACE_DIR}"
fi
```

### Example 2: TypeScript agent space.yaml

**Before**:
```yaml
typescript-agent:
  command: "node"
  args:
    - "../../../sdk/typescript-sdk/agent/dist/index.js"
    - "--gateway"
    - "ws://localhost:${PORT}"
```

**After (Option A - Direct path)**:
```yaml
typescript-agent:
  command: "node"
  args:
    - "../../../packages/mew/dist/agent/index.js"
    - "--gateway"
    - "ws://localhost:${PORT}"
```

**After (Option B - Use mew command - PREFERRED)**:
```yaml
typescript-agent:
  command: "mew"
  args:
    - "agent"
    - "run"
    - "--gateway"
    - "ws://localhost:${PORT}"
```

### Example 3: Minimal package.json for test templates

**Before**:
```json
{
  "name": "scenario-1-basic-{{SPACE_NAME}}",
  "dependencies": {
    "ws": "^8.18.0"
  }
}
```

**After** (same - ws is legitimate test dependency):
```json
{
  "name": "scenario-1-basic-{{SPACE_NAME}}",
  "private": true,
  "dependencies": {
    "ws": "^8.18.0"
  }
}
```

**Remove entirely if**:
```json
{
  "dependencies": {
    "@mew-protocol/agent": "^0.4.1"  // Old package, use mew command instead
  }
}
```

## Scenario Update Status

Track progress updating each scenario following TEST-SCENARIO-UPDATE-INSTRUCTIONS.md:

- [x] **scenario-1-basic** - ✅ COMPLETED & PASSING (7/7 tests)
  - Updated teardown.sh
  - Fixed CLI bug: removed `require()` calls in gateway.ts
  - All other files were already correct
- [x] **scenario-2-mcp** - ✅ COMPLETED & PASSING (8/8 tests)
  - Updated teardown.sh
  - All other files were already correct
- [x] **scenario-3-proposals** - ✅ COMPLETED & PASSING (6/6 tests)
  - Updated teardown.sh
  - All other files were already correct
- [x] **scenario-4-capabilities** - ✅ COMPLETED & PASSING (9/9 tests)
  - Updated teardown.sh
  - All other files were already correct
- [x] **scenario-5-reasoning** - ✅ COMPLETED & PASSING (7/7 tests)
  - Updated teardown.sh
  - All other files were already correct
- [ ] scenario-6-errors - Not yet updated
- [ ] scenario-7-mcp-bridge - Not yet updated
- [ ] scenario-8-grant - Not yet updated
- [ ] scenario-8-typescript-agent - Not yet updated
- [ ] scenario-9-typescript-proposals - Not yet updated
- [ ] scenario-10-multi-agent - Not yet updated
- [ ] scenario-11-chat-controls - Not yet updated
- [ ] scenario-12-stream-controls - Not yet updated
- [ ] scenario-13-participant-controls - Not yet updated
- [ ] scenario-14-cat-maze - Not yet updated

### Discoveries During Updates

**scenario-1-basic**:
- ✅ Found and fixed CLI bug: `autoConnectOutputLogParticipant()` in gateway.ts was using CJS `require()` in ESM module
- ✅ Confirmed teardown.sh pattern works correctly
- ✅ Confirmed global `mew` command works for all operations

## Next Steps

1. Continue updating scenarios one by one following TEST-SCENARIO-UPDATE-INSTRUCTIONS.md
2. Document any new issues discovered in the instructions guide
3. After all scenarios updated, run full test suite with `./tests/run-all-tests.sh`

---

**Document Status**: In Progress - Scenarios 1-5 Complete (5/15)
**Last Updated**: 2025-10-01
**Author**: Claude Code
**Related**: REPO-SPEC.md, TEST.md, TESTING-CODER-AGENT.md, TEST-SCENARIO-UPDATE-INSTRUCTIONS.md
