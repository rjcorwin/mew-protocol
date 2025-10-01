# Test Scenario Update Instructions

This guide provides step-by-step instructions for updating a single test scenario to work with the refactored repository structure (single `@mew-protocol/mew` package, TypeScript CLI).

**Related**: See FIX-TESTS.md for the complete analysis and overview of all scenarios.

## Prerequisites

Before updating any scenario:

1. **Ensure global mew is installed**:
   ```bash
   cd /Users/rj/Git/rjcorwin/mew-protocol
   npm run build
   npm install -g .
   mew --version  # Verify it works
   ```

2. **Clean any existing test workspaces**:
   ```bash
   # From repo root
   find tests -name ".workspace" -type d -exec rm -rf {} + 2>/dev/null || true
   ```

3. **Stop any running PM2 processes**:
   ```bash
   pm2 kill
   ```

## Update Checklist for Each Scenario

Work through these steps in order for each scenario (`tests/scenario-X-name/`):

### Step 1: Update teardown.sh

**File**: `tests/scenario-X-name/teardown.sh`

**Find**:
```bash
CLI_BIN="${REPO_ROOT}/cli/bin/mew.js"

if [[ -d "${WORKSPACE_DIR}" ]]; then
  if [[ -f "${ENV_FILE}" ]]; then
    source "${ENV_FILE}"
  fi

  if [[ -f "${CLI_BIN}" ]]; then
    node "${CLI_BIN}" space down --space-dir "${WORKSPACE_DIR}" >/dev/null 2>&1 || true
  fi

  rm -rf "${WORKSPACE_DIR}"
fi
```

**Replace with**:
```bash
if [[ -d "${WORKSPACE_DIR}" ]]; then
  if [[ -f "${ENV_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
  fi

  # Use global mew command (installed by test runner)
  mew space down --space-dir "${WORKSPACE_DIR}" >/dev/null 2>&1 || true

  rm -rf "${WORKSPACE_DIR}"
  printf "%b\n" "${GREEN}✓ Workspace removed${NC}"
else
  printf "No workspace directory found at %s\n" "${WORKSPACE_DIR}"
fi
```

**Changes**:
- ✅ Removed `CLI_BIN` variable
- ✅ Use global `mew` command instead of `node "${CLI_BIN}"`
- ✅ Simplified logic

### Step 2: Check setup.sh for Path References

**File**: `tests/scenario-X-name/setup.sh`

**Look for these patterns** and update if found:

#### Pattern A: Old SDK Agent Path
**Find**:
```bash
AGENT_DIST="${REPO_ROOT}/sdk/typescript-sdk/agent/dist/index.js"
```

**Replace**:
```bash
AGENT_DIST="${REPO_ROOT}/packages/mew/dist/agent/index.js"
```

#### Pattern B: Old Bridge Path
**Find**:
```bash
BRIDGE_DIST=${REPO_ROOT}/bridge/dist/mcp-bridge.js
```

**Replace**:
```bash
BRIDGE_DIST=${REPO_ROOT}/packages/mew/dist/bridge/index.js
```

#### Pattern C: Old CLI Path (rare in setup.sh)
**Find**:
```bash
node "${REPO_ROOT}/cli/bin/mew.js"
```

**Replace**:
```bash
mew
```

**Note**: Most setup.sh files already use `mew` command correctly. Only check for path references to built artifacts.

### Step 3: Update template/space.yaml

**File**: `tests/scenario-X-name/template/space.yaml`

**Look for participant command references** and update if needed:

#### Pattern A: TypeScript Agent Direct Path (scenarios 8, 9)
**Find**:
```yaml
participants:
  typescript-agent:
    command: "node"
    args:
      - "../../../sdk/typescript-sdk/agent/dist/index.js"
      - "--gateway"
      - "ws://localhost:${PORT}"
      # ... more args
```

**Replace (Option 1 - Update path)**:
```yaml
participants:
  typescript-agent:
    command: "node"
    args:
      - "../../../packages/mew/dist/agent/index.js"
      - "--gateway"
      - "ws://localhost:${PORT}"
      # ... more args
```

**Replace (Option 2 - Use mew command - PREFERRED)**:
```yaml
participants:
  typescript-agent:
    command: "mew"
    args:
      - "agent"
      - "run"
      - "--gateway"
      - "ws://localhost:${PORT}"
      - "--space"
      - "{{SPACE_NAME}}"
      - "--token"
      - "${TOKEN}"
      - "--id"
      - "typescript-agent"
      # ... other agent-specific args
```

**Recommendation**: Use Option 2 (mew command) for consistency with published templates.

#### Pattern B: Bridge Path (if any)
**Find**:
```yaml
command: "node"
args:
  - "../../../bridge/dist/mcp-bridge.js"
```

**Replace**:
```yaml
command: "mew"
args:
  - "bridge"
  - "start"
  # ... bridge args
```

#### Pattern C: Local Agents (most scenarios)
**These are usually correct** - no changes needed if they look like:
```yaml
command: "node"
args:
  - "./.mew/agents/some-agent.js"  # Local agent in template
  - "--gateway"
  - "ws://localhost:${PORT}"
```

### Step 4: Review template/package.json

**File**: `tests/scenario-X-name/template/package.json`

**Decision tree**:

1. **Does the template have a package.json?**
   - If NO → Skip to Step 5
   - If YES → Continue to question 2

2. **What dependencies are listed?**
   - Check the `dependencies` field

3. **Apply these rules**:

   **KEEP package.json if it has**:
   - ✅ `ws` - WebSocket library for test clients
   - ✅ `@modelcontextprotocol/*` - External MCP servers
   - ✅ Other external test utilities

   **REMOVE package.json if it ONLY has**:
   - ❌ `@mew-protocol/agent` - Use `mew agent run` command instead
   - ❌ `@mew-protocol/participant` - Use `mew` commands instead
   - ❌ `@mew-protocol/client` - Use `mew` commands instead
   - ❌ No dependencies at all

   **UPDATE package.json if it has a mix**:
   - Remove old `@mew-protocol/*` packages
   - Keep legitimate external dependencies

**Example scenarios**:

**Scenario 1 (basic)** - Has `ws`:
```json
{
  "dependencies": {
    "ws": "^8.18.0"
  }
}
```
→ **KEEP** (ws is needed for test client)

**Scenario 7 (mcp-bridge)** - Has MCP server:
```json
{
  "dependencies": {
    "@modelcontextprotocol/server-filesystem": "^1.6.3"
  }
}
```
→ **KEEP** (external MCP server)

**Scenario 8 (typescript-agent)** - Has old SDK package:
```json
{
  "dependencies": {
    "@mew-protocol/agent": "^0.4.1"
  }
}
```
→ **REMOVE** entire file (using `mew agent run` instead)

**Scenario 10 (multi-agent)** - Has old SDK package:
```json
{
  "dependencies": {
    "@mew-protocol/participant": "^0.2.0"
  }
}
```
→ **REMOVE** entire file (local agents don't need it)

### Step 5: Check check.sh for Path References

**File**: `tests/scenario-X-name/check.sh`

**Look for old CLI references**:

**Find**:
```bash
if node "${REPO_ROOT}/cli/bin/mew.js" init --list-templates | grep -q "template-name"; then
```

**Replace**:
```bash
if mew init --list-templates | grep -q "template-name"; then
```

**Most check.sh files don't have CLI references** - they use curl to send messages. Only check if you see `cli/bin/mew.js` in the file.

### Step 6: Test the Scenario

**Run the scenario**:
```bash
cd tests/scenario-X-name
./test.sh
```

**Watch for**:
- ✅ Setup completes without errors
- ✅ Gateway starts and health check passes
- ✅ All participants start (check `pm2 list` if curious)
- ✅ Checks pass
- ✅ Teardown completes and cleans up

**If it fails**, see Troubleshooting section below.

### Step 7: Clean Up After Testing

```bash
# Ensure teardown ran
cd tests/scenario-X-name
./teardown.sh

# Double-check PM2 is clean
pm2 list  # Should be empty or no matching processes
```

## Troubleshooting

### Issue: "mew: command not found"

**Cause**: Global mew not installed

**Fix**:
```bash
cd /Users/rj/Git/rjcorwin/mew-protocol
npm run build
npm install -g .
```

### Issue: "Gateway failed to start"

**Symptoms**: Setup hangs at "Gateway failed to start within timeout"

**Debug**:
```bash
cd tests/scenario-X-name/.workspace
cat logs/space-up.log
cat logs/gateway.log
```

**Common causes**:
- Port already in use (test uses random port, should be rare)
- Build artifacts missing (run `npm run build` at repo root)
- PM2 daemon issues (run `pm2 kill` and retry)

### Issue: "Cannot find module '../../../packages/mew/dist/agent/index.js'"

**Cause**: Path in space.yaml is wrong or build artifacts missing

**Fix**:
1. Verify build artifacts exist:
   ```bash
   ls /Users/rj/Git/rjcorwin/mew-protocol/packages/mew/dist/agent/index.js
   ```
2. If missing, rebuild:
   ```bash
   cd /Users/rj/Git/rjcorwin/mew-protocol
   npm run build
   ```
3. Double-check space.yaml has correct path

### Issue: TypeScript agent doesn't start

**Symptoms**: PM2 shows agent as "errored" or "stopped"

**Debug**:
```bash
cd tests/scenario-X-name/.workspace
pm2 logs typescript-agent --nostream --lines 50
```

**Common causes**:
- Old path in space.yaml (see Step 3)
- Missing MEW_AGENT_CONFIG env variable
- Package not built

**Fix**: Review Step 3, ensure using correct path or `mew agent run` command

### Issue: "ReferenceError: require is not defined" in gateway

**Symptoms**: Gateway starts but immediately crashes with:
```
ReferenceError: require is not defined
    at autoConnectOutputLogParticipant (file://.../gateway.js:...)
```

**Cause**: CLI code still has CommonJS `require()` calls in ESM modules

**Fix**: This is a CLI bug, not a test issue. Check gateway.ts for `require('fs')` or `require('path')` and convert to ESM imports. The imports should already exist at the top of the file.

**Verification after fix**:
```bash
npm run build
npm install -g .
# Retry the test
```

### Issue: Tests fail but setup/teardown work

**Symptoms**: Setup succeeds, checks fail

**This is expected during refactor** - some test assertions may need updates too. Focus on getting setup/teardown working first, then debug specific test failures.

**Debug**:
```bash
cd tests/scenario-X-name/.workspace
# Check envelope history
tail -n 50 .mew/logs/envelope-history.jsonl | jq .

# Check participant logs
ls logs/
tail -n 50 logs/*.log
```

### Issue: Teardown leaves processes running

**Symptoms**: `pm2 list` shows processes after teardown

**Fix**:
```bash
# Manual cleanup
pm2 delete all
pm2 kill

# Or specific to test
pm2 delete scenario-X-*
```

**Prevention**: Ensure teardown.sh uses global `mew space down` (Step 1)

## Scenario-Specific Notes

### Scenario 1 (Basic) - COMPLETED ✅

**Status**: Fully updated and passing all tests

**Changes made**:
- Updated teardown.sh to use global `mew` command
- No other files needed updates (already correct)
- **CLI Bug Fixed**: Found and fixed `require()` calls in gateway.ts `autoConnectOutputLogParticipant()` function

**CLI Bug Details**:
- **Location**: `packages/mew/src/cli/commands/gateway.ts` lines 707-708
- **Issue**: Function was using `const fs = require('fs')` and `const path = require('path')` in ESM module
- **Fix**: Removed those lines (imports already exist at top of file)
- **Impact**: Gateway would crash when auto-connecting participants with `output_log` and `auto_connect: true`

**Test Results**: 7/7 tests passing
- Gateway health endpoint ✓
- Client output log exists ✓
- Simple chat message ✓
- Message with correlation ID ✓
- Multiple messages ✓
- Large message handling ✓
- Rapid message handling ✓

### Scenarios 8 & 9 (TypeScript Agent)

**Extra considerations**:
- These scenarios test the TypeScript agent from the SDK
- Must update space.yaml to use new agent path (Step 3)
- Remove template/package.json (has old `@mew-protocol/agent` dependency)
- Consider switching to `mew agent run` command instead of direct path

### Scenario 7 (MCP Bridge)

**Extra considerations**:
- Uses external MCP filesystem server
- Keep template/package.json (has `@modelcontextprotocol/server-filesystem`)
- Update setup.sh bridge path check (Step 2)
- Test files are created in .workspace/test-files/ during setup

### Scenario 14 (Cat Maze)

**Extra considerations**:
- Tests CLI template functionality
- check.sh references old CLI path (Step 5)
- Depends on cat-maze template in packages/mew/templates/

## Quick Reference

### Path Mappings (Old → New)

| Old Path | New Path |
|----------|----------|
| `cli/bin/mew.js` | `mew` (global command) |
| `sdk/typescript-sdk/agent/dist/index.js` | `packages/mew/dist/agent/index.js` |
| `bridge/dist/mcp-bridge.js` | `packages/mew/dist/bridge/index.js` |
| `@mew-protocol/agent` (package) | `mew agent run` (command) |
| `@mew-protocol/bridge` (package) | `mew bridge start` (command) |

### Files to Check in Each Scenario

- ✅ `teardown.sh` - ALWAYS update (remove CLI_BIN)
- ✅ `setup.sh` - Check for path references (agent/bridge)
- ✅ `template/space.yaml` - Check participant commands
- ✅ `template/package.json` - Review dependencies
- ✅ `check.sh` - Check for CLI references (rare)
- ⚠️ `test.sh` - Usually fine (just orchestrates other scripts)

### Testing Checklist

- [ ] Setup completes without errors
- [ ] Gateway starts successfully
- [ ] All participants start (check PM2)
- [ ] Test assertions pass
- [ ] Teardown completes successfully
- [ ] No processes left in PM2
- [ ] .workspace directory removed

## Batch Processing Tips

If updating multiple scenarios:

1. **Update all teardown.sh files first** (they're all the same pattern)
2. **Group scenarios by type**:
   - TypeScript agent scenarios (8, 9)
   - MCP bridge scenarios (7)
   - Basic scenarios (1-6, 10-13, 14)
3. **Test as you go** - don't update all scenarios before testing
4. **Keep notes** on scenario-specific issues in FIX-TESTS.md

## Final Validation

After updating a scenario, add it to the tracking list in FIX-TESTS.md:

```markdown
## Scenario Update Status

- [x] scenario-1-basic - Updated, tested, passing
- [ ] scenario-2-mcp - Not yet updated
- [ ] scenario-3-proposals - Not yet updated
...
```

## Getting Help

If you encounter issues not covered here:

1. Check FIX-TESTS.md for analysis details
2. Review REPO-SPEC.md for architecture context
3. Check packages/mew/dist/ to verify built artifacts exist
4. Look at published templates in packages/mew/templates/ for patterns

---

**Document Status**: Ready for use
**Last Updated**: 2025-10-01
**Author**: Claude Code
**Related**: FIX-TESTS.md, REPO-SPEC.md, tests/README.md
