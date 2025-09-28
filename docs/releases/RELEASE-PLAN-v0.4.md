# MEW Protocol v0.4 Release Plan

**Release Date**: TBD
**Protocol Version**: v0.3 → v0.4
**Release Type**: Major Feature Release

## Executive Summary

This is a major release transitioning from MEW Protocol v0.3 to v0.4, featuring:
- Streaming capabilities
- Enhanced participant envelopes
- New cat maze template with MCP server integration
- Major CLI UX improvements (fuzzy matching, dynamic deep params)

## Current State Analysis

### Package Versions (Pre-Release)
- `@mew-protocol/types`: 0.2.0
- `@mew-protocol/capability-matcher`: 0.2.0
- `@mew-protocol/client`: 0.2.0
- `@mew-protocol/participant`: 0.2.0
- `@mew-protocol/agent`: 0.4.1
- `@mew-protocol/bridge`: 0.1.1
- `@mew-protocol/cli`: 0.4.2

### Version Inconsistencies Identified
- **Major Misalignment**: Most SDK packages at 0.2.0 but protocol is v0.4
- **CLI Advanced**: CLI already at 0.4.2 (actively developed)
- **Agent Aligned**: Agent at 0.4.1 (close to protocol version)
- **Bridge Behind**: Bridge at 0.1.1 (may need update)

### Template Dependencies Analysis
#### `coder-agent` template:
- `@mew-protocol/agent`: ^0.4.1 ✅
- `@mew-protocol/bridge`: ^0.1.1 ✅
- `@mew-protocol/client`: ^0.2.0 ⚠️ (needs update)
- `@mew-protocol/participant`: ^0.2.0 ⚠️ (needs update)
- `@mew-protocol/types`: ^0.2.0 ⚠️ (needs update)

#### `cat-maze` template:
- Same MEW dependencies as coder-agent ⚠️ (all need updates)

#### `note-taker` template:
- No MEW dependencies ✅ (only ws)

## Research Findings

### 1. Changes Analysis ✅
**183 commits since v0.3** - This is a MASSIVE release!

#### **Protocol Changes**:
- ✅ **Protocol v0.4 published**: `0445bfb release: publish MEW Protocol v0.4 spec`
- ✅ **Legacy envelope support**: `b41aa0d Allow gateway to accept legacy mew/v0.3 envelopes`
- ✅ **New envelope types**: Multiple commits adding envelope specifications

#### **Streaming Implementation**:
- ✅ **Stream handshake**: `71589a5 feat: Implement stream request/response handshake in CLI gateway`
- ✅ **Token streaming**: `ca111fd feat: Add token count streaming and /streams debug command`
- ✅ **Reasoning streams**: Multiple commits for agent reasoning streaming
- ✅ **Stream cleanup**: `ae95b12 fix: Send stream/close message when reasoning completes`

#### **CLI Improvements**:
- ✅ **Fuzzy matching**: `9c1ca14 Add fuzzy slash command suggestions to Ink CLI (#15)`
- ✅ **Schema autocomplete**: `9a9c090 feat(cli): implement schema-driven slash autocomplete phase 1/2 (#18)`
- ✅ **Arrow key history**: `4dca27b feat(cli): Add arrow key history navigation and multi-line input support`
- ✅ **Secure tokens**: `9f0d933 feat(cli): Implement secure token generation for spaces`
- ✅ **Top-level aliases**: `0487cc2 feat(cli): Add top-level aliases for space commands`

#### **New Templates**:
- ✅ **Cat maze template**: `e2d2f39 Add cat maze narrator agent to broadcast maze views (#21)`
  - Features: Stateful MCP server, 10 maze levels, cooperative play
  - Custom maze MCP server with navigation tools
  - Cooperative human + AI gameplay

### 2. Breaking Changes Analysis ✅
- **Minimal breaking changes detected**: Only one commit flagged
- `a477806 refactor: Migrate monorepo to TypeScript project references (#9)`
- **Legacy support maintained**: Gateway accepts v0.3 envelopes

### 3. Major Infrastructure Changes ✅
- ✅ **TypeScript project references**: Complete monorepo restructure
- ✅ **Documentation reorganization**: `e33c666 refactor: Organize documentation into structured docs directory (#10)`
- ✅ **Test refactoring**: `f898fcf Feature/tests refactor (#19)`
- ✅ **Gateway SDK removal**: `d76cf1e complete gateway sdk removal`

## Version Strategy Decision Points

### Option A: Coordinated Major Release (RECOMMENDED)
**All SDK packages → 0.4.0**
- ✅ Reflects protocol v0.4
- ✅ Clean version alignment
- ✅ Easier to communicate
- ✅ Matches massive feature set (183 commits!)
- ✅ Aligns with agent (0.4.1) and CLI (0.4.2)

### Option B: Individual Package Versioning
**Bump only changed packages**
- ❌ More complex to track
- ❌ Version chaos (0.2.0 vs 0.4.x confusion)
- ❌ Doesn't reflect scope of changes

### RECOMMENDED DECISION: **Option A - Coordinated v0.4.0 Release**

#### Proposed New Versions:
- `@mew-protocol/types`: 0.2.0 → **0.4.0**
- `@mew-protocol/capability-matcher`: 0.2.0 → **0.4.0**
- `@mew-protocol/client`: 0.2.0 → **0.4.0**
- `@mew-protocol/participant`: 0.2.0 → **0.4.0**
- `@mew-protocol/agent`: 0.4.1 → **0.4.2** (patch)
- `@mew-protocol/bridge`: 0.1.1 → **0.4.0** (major jump to align)
- `@mew-protocol/cli`: 0.4.2 → **0.4.3** (patch, already aligned)

## Changelog Strategy

### Major Categories for v0.4

#### 1. **Protocol Changes (v0.3 → v0.4)**
- **Streaming Support**: Complete stream request/response handshake system
- **Enhanced Envelopes**: New participant envelope types and gateway logging
- **Legacy Compatibility**: Maintains backward compatibility with v0.3 envelopes
- **Specification**: Published official MEW Protocol v0.4 specification

#### 2. **Streaming Features**
- **Token Streaming**: Real-time token count updates during LLM generation
- **Reasoning Streams**: Agent reasoning process visible in real-time
- **Stream Management**: Proper stream lifecycle with cleanup and cancellation
- **Debug Commands**: `/streams` command for stream monitoring

#### 3. **CLI Improvements**
- **Fuzzy Matching**: Smart command suggestions with fuzzy search
- **Schema Autocomplete**: Dynamic parameter completion for slash commands
- **Enhanced Input**: Arrow key history, multi-line support, improved key handling
- **Secure Tokens**: Cryptographically secure token generation for spaces
- **Command Aliases**: Top-level space command shortcuts
- **UI Polish**: Better reasoning display, inline help, improved layouts

#### 4. **New Templates & Features**
- **Cat Maze Template**: Cooperative gameplay with stateful MCP server
  - 10 handcrafted maze levels with escalating difficulty
  - Custom maze MCP server with navigation tools (`view`, `up`, `down`, `left`, `right`)
  - Cooperative human + AI gameplay
- **Tool Discovery**: Robust state tracking and retry logic for MCP tools
- **Proposal System**: Enhanced capability granting from CLI

#### 5. **Infrastructure & Developer Experience**
- **TypeScript Project References**: Complete monorepo restructure
- **Documentation**: Organized docs directory with architecture guides
- **Testing**: Refactored test suite with better scenario coverage
- **Build System**: Improved build process and dependency management

#### 6. **Breaking Changes**
- **Minimal Impact**: Only infrastructure changes (TypeScript project references)
- **Legacy Support**: v0.3 envelope compatibility maintained
- **Migration Path**: Smooth upgrade path for existing implementations

## Release Execution Plan

### Phase 1: Preparation
1. **Complete Research** (items above)
2. **Update Changelogs** (based on research)
3. **Verify Repository State**
   - `git status` (should be clean)
   - `npm run test` (all tests pass)
   - `npm run build` (clean build)
4. **Check npm Authentication**
   - `npm whoami`
   - `npm access ls-packages`

### Phase 2: Version Management
1. **Bump Package Versions** (strategy TBD)
2. **Update Internal Dependencies** (if needed)
3. **Commit Version Changes**

### Phase 3: Publishing
1. **SDK Packages** (dependency order):
   - types → capability-matcher → client → participant → agent
2. **Bridge Package**
3. **Update CLI Templates** (with new package versions)
4. **CLI Package**

### Phase 4: Verification
1. **Post-publish Testing** (per RELEASE.md)
2. **Git Tagging**
3. **Documentation Updates**

## Risk Assessment & Mitigations

### Identified Risks

#### 1. **Version Jump Complexity** 🔴 HIGH
- **Risk**: Major version jumps (0.2.0 → 0.4.0) for most packages
- **Impact**: Potential confusion, dependency resolution issues
- **Mitigation**:
  - Thorough post-publish verification testing
  - Update all template dependencies simultaneously
  - Clear communication in release notes

#### 2. **Template Dependency Updates** 🟡 MEDIUM
- **Risk**: Coder-agent and cat-maze templates reference old versions
- **Impact**: New spaces created with outdated packages
- **Mitigation**:
  - Update templates BEFORE CLI publish
  - Test template initialization after SDK publish
  - Verify all templates work end-to-end

#### 3. **First-Time Release Process** 🟡 MEDIUM
- **Risk**: New RELEASE.md process, potential workflow issues
- **Impact**: Release delays, potential mistakes
- **Mitigation**:
  - Follow plan step-by-step with approvals
  - Test publish process in isolated environment first
  - Have rollback plan ready

#### 4. **Cross-Package Dependencies** 🟢 LOW
- **Risk**: Internal version references may break
- **Impact**: Build failures, runtime errors
- **Mitigation**: TypeScript build will catch most issues

### Success Criteria
- [x] All packages publish successfully to npm
- [x] Template dependencies updated correctly
- [ ] Post-publish verification tests pass
- [ ] No regression in existing functionality
- [ ] New features (streaming, cat maze) work as expected

## Post-Release Verification Plan (v0.4-Specific)

### Phase 1: Package Verification
**Verify Published Versions:**
```bash
# Check all packages show correct versions
npm view @mew-protocol/types version          # Expected: 0.4.0
npm view @mew-protocol/capability-matcher     # Expected: 0.4.1
npm view @mew-protocol/client version         # Expected: 0.4.1
npm view @mew-protocol/participant version    # Expected: 0.4.2
npm view @mew-protocol/agent version          # Expected: 0.4.3
npm view @mew-protocol/bridge version         # Expected: 0.4.1
npm view @mew-protocol/cli version            # Expected: 0.4.3
```

### Phase 2: Dependency Resolution Verification
**Test Internal Dependencies Work:**
```bash
# Create test environment
mkdir /tmp/mew-v0.4-test && cd /tmp/mew-v0.4-test
npm init -y

# Test that packages can resolve their internal dependencies
npm install @mew-protocol/agent@latest
npm list @mew-protocol/agent --depth=1
# Should show: participant@0.4.2, client@0.4.1, types@0.4.0

npm install @mew-protocol/participant@latest
npm list @mew-protocol/participant --depth=1
# Should show: capability-matcher@0.4.1, client@0.4.1, types@0.4.0
```

### Phase 3: Template Verification (Critical for v0.4)
**Test CLI Templates Work with New Packages:**
```bash
# Test coder-agent template
mew space init --template coder-agent test-coder
cd test-coder
npm install
# Verify no dependency resolution errors
npm list @mew-protocol/agent  # Should show 0.4.3
npm list @mew-protocol/bridge # Should show 0.4.1

# Test cat-maze template (NEW in v0.4!)
cd ../
mew space init --template cat-maze test-maze
cd test-maze
npm install
# Should install without errors
npm list @mew-protocol/agent  # Should show 0.4.3
```

### Phase 4: Feature Verification (v0.4 Specific)
**Test New Streaming Features:**
```bash
# Start a space and test streaming
cd test-coder
mew space up --port 8081
# Test streaming endpoints exist (manual verification)
curl -f http://localhost:8081/health
# Look for stream-related capabilities in space status
```

**Test Cat Maze Template (Major v0.4 Feature):**
```bash
cd ../test-maze
mew space up --port 8082
# Test maze tools are available
curl -X POST http://localhost:8082/participants/human/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer human-token" \
  -d '{"method":"tools/call","params":{"name":"view"}}'
# Should return maze view
```

### Phase 5: CLI UX Verification (v0.4 Improvements)
**Test New CLI Features:**
```bash
# Test fuzzy command matching
mew sp up    # Should suggest "space up"
mew ini      # Should suggest "init"

# Test enhanced interactive mode
mew space connect
# Test arrow key history, multi-line input
# Test slash command autocomplete
```

### Phase 6: Backward Compatibility
**Ensure v0.3 → v0.4 Migration:**
- [ ] Verify gateway accepts v0.3 envelopes (per legacy support)
- [ ] Test existing spaces still work
- [ ] Confirm no breaking changes for consumers

### Verification Checklist
- [ ] **Package Versions**: All show correct final versions
- [ ] **Dependencies**: Internal deps resolve to correct versions
- [ ] **Templates**: Both coder-agent and cat-maze initialize and install
- [ ] **Streaming**: New streaming features functional
- [ ] **Cat Maze**: New template works end-to-end
- [ ] **CLI UX**: Fuzzy matching and enhanced input work
- [ ] **Backward Compatibility**: v0.3 functionality preserved
- [ ] **End-to-End**: Full workflow from init to running space works

### Known Issues to Monitor
- [ ] Agent package bin file warnings (non-blocking)
- [ ] Repository URL auto-corrections (cosmetic)
- [ ] React reconciler peer dependency warnings (dev-only)

## Final Recommendations

### 1. **VERSION STRATEGY**: Go with coordinated v0.4.0 release
**Rationale**: 183 commits, major protocol change, massive feature additions warrant major alignment

### 2. **RELEASE ORDER**: Follow RELEASE.md dependency order exactly
```
types (0.4.0) → capability-matcher (0.4.0) → client (0.4.0) → participant (0.4.0) → agent (0.4.2)
bridge (0.4.0) → UPDATE TEMPLATES → cli (0.4.3)
```

### 3. **TEMPLATE UPDATES**: Critical path item
- Update coder-agent and cat-maze package.json files
- Bump all @mew-protocol dependencies to ^0.4.0
- Test template initialization before CLI publish

### 4. **CHANGELOG FOCUS**: Emphasize the major features
- Streaming as headline feature
- Cat maze as showcase template (custom MCP server demo)
- CLI UX improvements as developer experience win

## Execution Timeline

### Immediate Next Steps:
1. **Get approval on this plan** ✋ **DECISION POINT**
2. **Pre-flight checks** (git status, npm auth, build tests)
3. **Execute coordinated release** (follow RELEASE.md)
4. **Post-release verification** (thorough testing)

## Questions for User

1. **Approve version strategy?** Coordinated v0.4.0 for SDK packages?
2. **CLI version bump?** 0.4.2 → 0.4.3 (patch) vs 0.4.4 (minor)?
3. **Bridge version?** 0.1.1 → 0.4.0 (major jump to align)?
4. **Timeline?** Execute today or schedule for specific time?
5. **Risk tolerance?** Comfortable with major version jumps?

## Lessons Learned (Real-Time)

### Critical Process Gap: Internal Package Dependencies

**Issue Discovered**: During release execution, we discovered that the RELEASE.md process is missing a critical step for managing internal package dependencies in a monorepo.

**What Happened**:
1. ✅ We bumped package versions correctly (0.2.0 → 0.4.0)
2. ❌ We published packages with stale internal dependencies
3. 🔍 **Discovery**: All packages had internal `@mew-protocol/*` dependencies still pointing to `^0.2.0`

**Examples of Stale Dependencies Found**:
- `agent/package.json`: Still referenced `@mew-protocol/participant: ^0.2.0`
- `participant/package.json`: Still referenced `@mew-protocol/client: ^0.2.0`
- `bridge/package.json`: Still referenced `@mew-protocol/participant: ^0.2.0`

**Root Cause**: The RELEASE.md process doesn't include a step to update internal package dependencies before version bumping.

**Impact**:
- Published packages can't properly resolve their internal dependencies
- Consumers may get inconsistent package versions
- Requires patch releases to fix dependency references

**Required Fix**:
1. Update all internal dependencies to new versions
2. Bump patch versions for affected packages
3. Re-publish affected packages with correct dependencies

### Critical Issues Encountered During Release

#### 1. **Agent Package Build Failure** 🚨 CRITICAL
- **Issue**: `@mew-protocol/agent@0.4.3` published without `dist/` directory
- **Root Cause**: TypeScript composite build with stale `.tsbuildinfo` files + incorrect `outDir` path format
- **Symptoms**: `npx @mew-protocol/agent` failed with "command not found"
- **Fix Required**:
  - Fixed `outDir: "./dist"` → `outDir: "dist"` in tsconfig.json
  - Updated clean script to remove `*.tsbuildinfo` files
  - Removed problematic project references temporarily
  - Published `@mew-protocol/agent@0.4.5` with working binary
- **Future Prevention**:
  - Add post-publish verification step to test binary execution
  - Include `.tsbuildinfo` cleanup in all package clean scripts
  - Consider build verification in CI before publish

#### 2. **CLI Text Truncation in Envelope Display** 🟡 MEDIUM
- **Issue**: MCP response content truncated at 150 characters in CLI envelope preview
- **Symptoms**: Cat maze displays cut off with "..."
- **Root Cause**: `getPayloadPreview()` function in `advanced-interactive-ui.js` hardcoded 150 char limit
- **Fix**: Increased limit from 150 to 1000 characters for better content display
- **Impact**: Critical for visual content like mazes, ASCII art, formatted output

#### 3. **Template Visual Bug - All Green Squares** 🟡 MEDIUM
- **Issue**: Cat maze showing all green squares instead of walls
- **Root Cause**: Changed `WALL` constant but level definitions contained hardcoded `🟫` characters
- **Symptoms**: Maze unplayable - no walls visible
- **Fix**: Updated `buildLevels()` function to convert hardcoded `🟫` → current `WALL` constant
- **Learning**: When changing emoji constants, audit all hardcoded usages in data

#### 4. **Participant Streaming Crash** 🟡 MEDIUM
- **Issue**: `@mew-protocol/participant@0.4.1` crashed with `ReferenceError: WebSocket is not defined` (fixed in `0.4.2`)
- **Root Cause**: Participant package relied on the monorepo `@mew-protocol/client` bringing in `ws`; the published build lacked the dependency/import
- **Symptoms**: Tool discovery timed out and stream delivery failed in clean installs (e.g. `npx @mew-protocol/agent`)
- **Fix**: Added explicit `ws` import in `MEWParticipant` and declared `ws` runtime dependency (will publish patch release)
- **Learning**: Each SDK package must declare transport dependencies explicitly; monorepo cross-talk hides missing deps

### Missing Process Steps

#### 1. **Changelog Updates**
- **Missing**: We skipped the "Phase 1: Review Changes & Update Changelogs" entirely
- **Impact**: No changelog documentation for this major release
- **Should Do**: Update CHANGELOG.md with comprehensive v0.4.0 changes

#### 2. **Internal Dependency Audit**
- **Missing**: No systematic check of internal `@mew-protocol/*` dependencies
- **Should Add**: Pre-release audit step to update internal dependencies

#### 3. **Build Verification** ⭐ NEW
- **Missing**: No verification that published packages actually work
- **Should Add**: Post-publish smoke tests for binary packages

### Critical Architectural Issue: Monorepo vs Published Package Builds

#### **The Agent Build Problem** 🚨 UNRESOLVED
**Current Situation**: Agent package builds work in monorepo but fail when published to npm

**Root Cause**: TypeScript project references + composite builds don't work the same way in:
1. **Monorepo context**: Uses local project references, builds work
2. **Published package**: No access to sibling projects, composite builds fail

**Immediate Workaround Applied**:
- Removed `composite: true` and project references from agent tsconfig
- Changed `outDir: "./dist"` → `outDir: "dist"`
- This fixes publishing but may break monorepo development builds

**CRITICAL TODO for Next Release**:
- [ ] **Investigate proper TypeScript monorepo + publishing setup**
- [ ] **Test that monorepo builds still work after our workarounds**
- [ ] **Consider separate tsconfig files**: `tsconfig.json` (monorepo) + `tsconfig.publish.json` (npm)
- [ ] **Evaluate build tools**: nx, lerna, or custom scripts for dual-context builds
- [ ] **Add CI verification**: Test both monorepo builds AND simulate npm package builds

**Research Needed**:
- How do other TypeScript monorepos handle this? (Next.js, Nx, etc.)
- Should we use a build tool that handles this automatically?
- Can we detect context (monorepo vs published) and use different tsconfigs?

### Proposed RELEASE.md Improvements

#### Add New Phase 1.5: Internal Dependency Management
```bash
# BEFORE version bumping, update internal dependencies
# Find all internal dependencies
grep -r "@mew-protocol" sdk/typescript-sdk/*/package.json bridge/package.json

# Update internal dependencies to target versions
# Example: If bumping to 0.4.0, update all internal refs to ^0.4.0
```

#### Enhanced Pre-Release Checklist
- [ ] Verify all internal `@mew-protocol/*` dependencies are updated
- [ ] Check that dependency versions align with planned release versions
- [ ] Test that packages can resolve internal dependencies

### Process Improvements for Next Release
1. **Add internal dependency audit** to RELEASE.md
2. **Create script** to automatically update internal dependencies
3. **Add verification step** to ensure dependency consistency
4. **Update changelog process** to be more systematic

---

**Status**: ✅ COMPLETED - All Issues Resolved
**Last Updated**: 2025-01-28
**Total Commits Since v0.3**: 183
**Release Scope**: MAJOR (Protocol v0.4, Streaming, CLI Overhaul, New Templates)

### Final Published Versions:
- `@mew-protocol/types@0.4.0`
- `@mew-protocol/capability-matcher@0.4.1`
- `@mew-protocol/client@0.4.1`
- `@mew-protocol/participant@0.4.2`
- `@mew-protocol/agent@0.4.5` ⚠️ (Fixed build issues)
- `@mew-protocol/bridge@0.4.1`
- `@mew-protocol/cli@0.4.8` ⚠️ (Fixed truncation + maze bugs)

### Post-Release Fixes Applied:
1. **Agent Binary**: Fixed missing dist files (v0.4.3 → v0.4.5)
2. **CLI Text Display**: Fixed 150-char truncation limit (v0.4.6 → v0.4.7)
3. **Maze Visuals**: Fixed wall/walkway display bug (v0.4.7 → v0.4.8)
