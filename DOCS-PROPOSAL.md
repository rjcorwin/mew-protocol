# Documentation Reorganization Proposal

## Executive Summary

The MEW Protocol repository has accumulated significant documentation debt across multiple major refactorings:
1. Monorepo → Single package restructure (completed)
2. Multiple protocol spec versions (v0.0-v0.4 + draft)
3. Separate CLI/SDK specs waiting to merge
4. Outdated testing guides and architecture docs
5. Scattered TODOs and FIX.md files

This proposal outlines a comprehensive reorganization to create a **single source of truth** documentation structure that is:
- **Discoverable** - Clear entry points for different user types
- **Current** - Reflects the actual codebase after restructure
- **Consolidated** - No duplicate or contradictory information
- **Versioned** - Clear delineation between stable and draft specs

## Current State Analysis

### Documentation Inventory

**Root Level** (14 files):
- `README.md` - Main project readme ✅ Keep
- `CHANGELOG.md` - Package changelog ✅ Keep
- `ADR.md` - Repo restructure ADR ❌ Archive (completed)
- `AGENTS.md` - Quick reference for AI agents ⚠️ Outdated (references old structure)
- `CLAUDE.md` - Claude instructions ✅ Keep
- `RELEASE.md` - Release process ✅ Keep (needs update for new structure)
- `TEST.md` - Testing guide ❌ Outdated (references packages/mew)
- `TESTING-CAT-MAZE.md` - Template testing ❌ Outdated (references packages/mew)
- `TESTING-CODER-AGENT.md` - Template testing ❌ Outdated (references packages/mew)
- `TODO.md` - Project TODO (repo restructure) ❌ Archive (mostly complete)

**docs/** (4 subdirectories, 11 files):
- `architecture/` - MONOREPO-ARCHITECTURE.md, MIGRATION-TO-PROJECT-REFERENCES.md, SETUP-TYPESCRIPT-FOR-MONOREPO.md ❌ All outdated
- `bugs/` - BUG.md, BUG-NPX-CACHE.md ⚠️ Check if still relevant
- `guides/` - DEVELOPMENT.md, INTEGRATION-PLAN.md, RELEASING.md, SPEC-GUIDE.md, TESTING.md ⚠️ Need updating
- `releases/` - README.md, RELEASE-PLAN-v0.4.md ✅ Keep
- `protocol-flow-comparison.md` ⚠️ Orphaned file

**protocol-spec/** (7 version directories):
- `README.md` ✅ Keep
- `CHANGELOG.md` ✅ Keep
- `v0.0/` (4 files + decisions/) ❌ Archive
- `v0.1/` (2 files + decisions/) ❌ Archive
- `v0.2/` (2 files + decisions/) ❌ Archive
- `v0.3/` (1 file + decisions/) ❌ Archive
- `v0.4/` (1 file + decisions/) ✅ **Current stable version**
- `draft/` (1 file + decisions/) ✅ **Next version development**

**specs-to-merge/** (2 specs):
- `cli-spec/` (v0.0.0, v0.1.0, draft) ⚠️ Needs merging
- `sdk-spec/` (draft only) ⚠️ Needs merging

**e2e/** (3 files):
- `README.md` ✅ Keep (update for new structure)
- `TODO.md` ❌ Archive (outdated refactor notes)
- `spec/` - Test specification ✅ Keep
- `scenario-*/FIX.md` (5 files) ❌ Remove (scenarios now passing)

**src/** subdirectories:
- `agent/TODO.md` - ❌ Archive or consolidate
- `bridge/spec/` - ⚠️ Move to main specs
- `cli/agents/README.md` - ❌ Remove (empty/stub)
- `client/docs/request-response-mechanism.md` - ⚠️ Move to protocol spec

**templates/** (3 templates):
- `cat-maze/README.md` ✅ Keep
- `coder-agent/README.md` ✅ Keep
- `note-taker/README.md` ✅ Keep

### Key Problems

1. **Duplication**: 3 separate testing guides (TEST.md, TESTING-*.md, docs/guides/TESTING.md) with inconsistent information
2. **Stale References**: Docs reference `packages/mew`, `sdk/typescript-sdk/*`, CLI paths that no longer exist
3. **Spec Fragmentation**: Protocol specs in 3 places (protocol-spec/, specs-to-merge/, src/bridge/spec/)
4. **Outdated Architecture**: All docs in `docs/architecture/` describe the old monorepo
5. **Unclear Entry Point**: New developers face 14+ root-level .md files
6. **Completed TODOs**: Multiple TODO/FIX files for completed work

## Proposed Structure

```
mew-protocol/
├── README.md                          # Main project readme (updated)
├── CHANGELOG.md                       # Package changelog
├── CONTRIBUTING.md                    # NEW: How to contribute
├── CLAUDE.md                         # Claude instructions (keep)
│
├── docs/
│   ├── README.md                     # NEW: Documentation hub
│   ├── getting-started.md            # NEW: Quick start guide
│   ├── development.md                # Consolidated dev guide
│   ├── testing.md                    # Consolidated test guide
│   ├── releasing.md                  # Release process (moved from RELEASE.md)
│   ├── architecture.md               # NEW: Current architecture (single package)
│   ├── templates.md                  # NEW: Template testing guide (combines TESTING-*.md)
│   ├── troubleshooting.md            # NEW: Common issues
│   └── migration/                    # NEW: Historical migrations
│       ├── monorepo-to-single.md    # Archive ADR.md here
│       └── typescript-esm.md        # Archive TS migration
│
├── spec/                             # Protocol specifications
│   ├── README.md                     # Spec navigation
│   ├── CHANGELOG.md                  # Protocol version history
│   ├── protocol/
│   │   ├── v0.4/                    # Current stable
│   │   │   ├── SPEC.md
│   │   │   └── decisions/
│   │   └── draft/                   # Next version
│   │       ├── SPEC.md
│   │       └── decisions/
│   ├── cli/                          # Merged from specs-to-merge/cli-spec
│   │   ├── v0.1.0/                  # Latest CLI spec
│   │   │   ├── SPEC.md
│   │   │   └── decisions/
│   │   └── draft/
│   │       ├── SPEC.md
│   │       └── decisions/
│   ├── sdk/                          # Merged from specs-to-merge/sdk-spec
│   │   └── draft/
│   │       ├── SPEC.md
│   │       └── decisions/
│   ├── bridge/                       # Moved from src/bridge/spec
│   │   └── draft/
│   │       ├── SPEC.md
│   │       └── decisions/
│   └── archive/                      # OLD: Historical specs
│       ├── protocol/v0.0/
│       ├── protocol/v0.1/
│       ├── protocol/v0.2/
│       └── protocol/v0.3/
│
├── e2e/
│   ├── README.md                     # Test scenario guide (updated)
│   └── spec/                         # Test infrastructure spec
│
├── templates/
│   ├── README.md                     # NEW: Templates overview
│   ├── cat-maze/README.md
│   ├── coder-agent/README.md
│   └── note-taker/README.md
│
└── archive/                          # NEW: Completed work artifacts
    ├── completed-todos.md            # Consolidated TODOs
    ├── completed-adrs.md             # Completed ADRs
    └── known-issues.md               # Resolved bugs/issues
```

## Detailed Actions

### Phase 1: Create New Structure (Non-Destructive)

#### 1.1 Create New Root-Level Docs

**docs/README.md** - Documentation hub:
```markdown
# MEW Protocol Documentation

## For Users
- [Getting Started](getting-started.md) - Install and run MEW in 5 minutes
- [Templates Guide](templates.md) - Cat-maze, coder-agent, note-taker walkthroughs
- [Troubleshooting](troubleshooting.md) - Common issues and solutions

## For Contributors
- [Development Guide](development.md) - Build, test, and iterate
- [Testing Guide](testing.md) - E2E scenarios and test infrastructure
- [Contributing Guidelines](../CONTRIBUTING.md) - How to submit PRs
- [Release Process](releasing.md) - Publishing packages

## Specifications
- [Protocol Spec](../spec/protocol/v0.4/SPEC.md) - Current stable (v0.4)
- [Protocol Draft](../spec/protocol/draft/SPEC.md) - Next version
- [CLI Spec](../spec/cli/v0.1.0/SPEC.md) - Command-line interface
- [SDK Spec](../spec/sdk/draft/SPEC.md) - TypeScript SDK

## Architecture
- [System Architecture](architecture.md) - How MEW works (post-restructure)
- [Migration History](migration/) - Past refactorings
```

**CONTRIBUTING.md**:
```markdown
# Contributing to MEW Protocol

## Quick Start
1. Fork and clone the repository
2. `npm install && npm run build`
3. `npm test` to verify everything works
4. Make changes, add tests
5. `npm run lint && npm test`
6. Submit PR

## Development Workflow
See [Development Guide](docs/development.md) for details.

## Submitting PRs
- Keep PRs focused on single feature/fix
- Add tests for new functionality
- Update specs if changing protocol
- Run full test suite before submitting
```

#### 1.2 Consolidate Guides

**docs/getting-started.md** - Distilled from README.md:
```markdown
# Getting Started with MEW Protocol

## Install
```bash
npm install -g @mew-protocol/mew
```

## Create Your First Space
```bash
mew init coder-agent my-workspace
cd my-workspace
mew space up
mew space connect
```

Type "help the cat get home" to see MEW in action!

## Next Steps
- [Templates Guide](templates.md) - Explore cat-maze and coder-agent
- [Architecture](architecture.md) - Understand how MEW works
- [Testing Guide](testing.md) - Run and write tests
```

**docs/development.md** - Merge & update:
- Current `docs/guides/DEVELOPMENT.md`
- Relevant sections from `AGENTS.md`
- Build instructions from `README.md`
- Remove all references to `packages/mew`, monorepo structure
- Update paths: `./dist/cli/index.js`, `npm run build`, etc.

**docs/testing.md** - Consolidate:
- `TEST.md` (local dev workflow)
- `docs/guides/TESTING.md` (PM2, logs, e2e)
- `e2e/README.md` (scenario descriptions)
- Remove duplicated PM2 instructions
- Update all paths to new structure

**docs/templates.md** - Merge:
- `TESTING-CAT-MAZE.md`
- `TESTING-CODER-AGENT.md`
- Template READMEs from `templates/*/README.md`
- Create unified guide: "Testing Templates" with subsections

**docs/releasing.md** - Move and update:
- Move `RELEASE.md` → `docs/releasing.md`
- Update all references from `packages/mew` to `.`
- Update build paths, npm scripts
- Keep comprehensive detail

**docs/architecture.md** - Create NEW:
- **Not** `docs/architecture/MONOREPO-ARCHITECTURE.md` (outdated)
- Describe **current** single-package architecture
- Source code organization (`src/`, `dist/`)
- Build system (TypeScript, tsup)
- Runtime architecture (PM2, spaces, gateway)
- Template system

**docs/troubleshooting.md** - Create NEW:
- Extract from `docs/bugs/BUG*.md` if still relevant
- Common build errors
- PM2 issues
- Module resolution problems
- Test failures

#### 1.3 Reorganize Specifications

**Merge specs-to-merge/** into **spec/**:

1. **CLI Spec**:
   ```bash
   mv specs-to-merge/cli-spec/v0.1.0/ spec/cli/v0.1.0/
   mv specs-to-merge/cli-spec/draft/ spec/cli/draft/
   # Archive old versions
   mv specs-to-merge/cli-spec/v0.0.0/ spec/archive/cli/v0.0.0/
   ```

2. **SDK Spec**:
   ```bash
   mv specs-to-merge/sdk-spec/draft/ spec/sdk/draft/
   ```

3. **Bridge Spec**:
   ```bash
   mv src/bridge/spec/draft/ spec/bridge/draft/
   ```

4. **Archive Old Protocol Specs**:
   ```bash
   mkdir -p spec/archive/protocol
   mv protocol-spec/v0.0/ spec/archive/protocol/
   mv protocol-spec/v0.1/ spec/archive/protocol/
   mv protocol-spec/v0.2/ spec/archive/protocol/
   mv protocol-spec/v0.3/ spec/archive/protocol/
   ```

5. **Reorganize Current Specs**:
   ```bash
   mv protocol-spec/ spec/protocol/
   # Now spec/protocol contains: v0.4/, draft/, README.md, CHANGELOG.md
   ```

**Create spec/README.md**:
```markdown
# MEW Protocol Specifications

## Active Specifications

### Protocol (Core)
- **[v0.4](protocol/v0.4/SPEC.md)** - Current stable release
- **[Draft](protocol/draft/SPEC.md)** - Next version under development

### CLI (Command-Line Interface)
- **[v0.1.0](cli/v0.1.0/SPEC.md)** - Current CLI spec
- **[Draft](cli/draft/SPEC.md)** - CLI enhancements

### SDK (TypeScript)
- **[Draft](sdk/draft/SPEC.md)** - SDK architecture and patterns

### Bridge (MCP Integration)
- **[Draft](bridge/draft/SPEC.md)** - MCP-MEW bridge specification

## Specification Development

See [spec/protocol/README.md](protocol/README.md) for:
- How to propose changes (ADRs)
- Version progression (draft → stable)
- Writing guidelines

## Archive

Historical specifications preserved in [archive/](archive/) for reference.
```

#### 1.4 Archive Completed Work

**archive/completed-todos.md** - Consolidate:
- `TODO.md` (repo restructure)
- `e2e/TODO.md` (test refactor)
- `src/agent/TODO.md`
- Any other scattered TODOs

**archive/completed-adrs.md**:
- `ADR.md` (repo restructure - DONE)

**archive/known-issues.md**:
- Extract still-relevant bugs from `docs/bugs/`
- Issues from old `TEST.md` that were resolved
- FIX.md files from e2e scenarios

### Phase 2: Update Existing Docs

#### 2.1 Update README.md

**Current**: 100 lines with quick start, goals, spec references

**Changes**:
1. Update installation section (no longer need CLI subdirectory reference)
2. Fix spec links: `/spec/v0.4/SPEC.md` → `/spec/protocol/v0.4/SPEC.md`
3. Add "Documentation" section pointing to `docs/README.md`
4. Simplify - move detailed quick start to `docs/getting-started.md`
5. Remove references to monorepo, workspaces

#### 2.2 Update AGENTS.md

**Current**: 109 lines - Quick reference for AI agents (like Claude)

**Changes**:
1. Update "Repository Structure" section:
   - Remove `sdk/typescript-sdk/`, `cli/`, `bridge/` directories
   - Update to reflect `src/` structure
   - Change `tests/` → `e2e/`
   - Change `spec/` → `spec/protocol/`
2. Update "Common Commands":
   - Remove `./cli/bin/mew.js` references
   - Use global `mew` command
   - Update build commands for single package
3. Update "Quick Testing Guide":
   - Remove references to test spaces in `tests/`
   - Update paths and commands
4. Update "Critical Docs" paths at top

#### 2.3 Update CHANGELOG.md

**Changes**:
1. Add entry for documentation reorganization
2. Note spec/ directory restructure (breaking for anyone with hardcoded links)

#### 2.4 Update e2e/README.md

**Current**: Excellent scenario descriptions, but references old structure

**Changes**:
1. Update "Test Environment" section for single package
2. Remove references to `packages/mew`, monorepo, local package linking
3. Update build/install instructions
4. Keep scenario descriptions (those are great!)

#### 2.5 Create templates/README.md

**New file** - Consolidate template information:
```markdown
# MEW Protocol Templates

Templates provide pre-configured spaces demonstrating MEW capabilities.

## Available Templates

### cat-maze
**Purpose**: Demonstrate MCP bridge and tool calling
**Agents**: MEW AI agent, cat-maze MCP server, narrator
**Try it**: `mew init cat-maze`
[Full Guide →](../docs/templates.md#cat-maze)

### coder-agent
**Purpose**: Human-in-loop file operations with proposals
**Agents**: MEW AI agent, filesystem MCP bridge
**Try it**: `mew init coder-agent`
[Full Guide →](../docs/templates.md#coder-agent)

### note-taker
**Purpose**: Minimal agent for note-taking
**Agents**: Note-taking assistant
**Try it**: `mew init note-taker`
[Full Guide →](../docs/templates.md#note-taker)

## Creating Custom Templates

See [Template Development Guide](../docs/development.md#templates).
```

### Phase 3: Remove/Archive Outdated Docs

#### 3.1 Remove Files

**Delete** (content moved/obsolete):
- `TEST.md` → content in `docs/testing.md`
- `TESTING-CAT-MAZE.md` → content in `docs/templates.md`
- `TESTING-CODER-AGENT.md` → content in `docs/templates.md`
- `TODO.md` → archived in `archive/completed-todos.md`
- `e2e/TODO.md` → archived
- `e2e/scenario-*/FIX.md` (5 files) → archived
- `src/agent/TODO.md` → archived
- `src/cli/agents/README.md` → empty stub
- `docs/architecture/MONOREPO-ARCHITECTURE.md` → archived
- `docs/architecture/MIGRATION-TO-PROJECT-REFERENCES.md` → archived
- `docs/architecture/SETUP-TYPESCRIPT-FOR-MONOREPO.md` → archived
- `docs/guides/INTEGRATION-PLAN.md` → outdated (completed)
- `docs/protocol-flow-comparison.md` → incorporate into architecture or archive

#### 3.2 Move to Archive

**archive/migrations/**:
- `ADR.md` → `archive/migrations/monorepo-to-single.md`
- Old architecture docs → `archive/migrations/monorepo-architecture.md`

**archive/specs/**:
- Old protocol spec versions (already handled in Phase 1.3)

#### 3.3 Keep But Update Path

These files stay but need internal path updates:
- `RELEASE.md` → `docs/releasing.md`
- `docs/guides/DEVELOPMENT.md` → `docs/development.md`
- `docs/guides/TESTING.md` → content merged into `docs/testing.md`
- `docs/guides/RELEASING.md` → verify vs `RELEASE.md`, consolidate
- `docs/guides/SPEC-GUIDE.md` → `spec/README.md` or keep in docs/

## Implementation Plan

### Week 1: Foundation
- [ ] Create `docs/README.md` (documentation hub)
- [ ] Create `CONTRIBUTING.md`
- [ ] Create `docs/getting-started.md`
- [ ] Create `docs/architecture.md` (current state)
- [ ] Create `docs/troubleshooting.md`

### Week 2: Consolidation
- [ ] Merge → `docs/development.md` (DEVELOPMENT.md + AGENTS.md sections)
- [ ] Merge → `docs/testing.md` (TEST.md + TESTING.md + e2e/README.md)
- [ ] Merge → `docs/templates.md` (TESTING-CAT-MAZE + TESTING-CODER-AGENT)
- [ ] Move → `docs/releasing.md` (from RELEASE.md)

### Week 3: Specifications
- [ ] Reorganize protocol specs: `protocol-spec/` → `spec/protocol/`
- [ ] Merge CLI spec: `specs-to-merge/cli-spec/` → `spec/cli/`
- [ ] Merge SDK spec: `specs-to-merge/sdk-spec/` → `spec/sdk/`
- [ ] Move bridge spec: `src/bridge/spec/` → `spec/bridge/`
- [ ] Archive old protocol versions → `spec/archive/protocol/`
- [ ] Create `spec/README.md` (navigation)

### Week 4: Archive & Cleanup
- [ ] Create `archive/` directory
- [ ] Archive completed TODOs → `archive/completed-todos.md`
- [ ] Archive completed ADRs → `archive/migrations/`
- [ ] Archive FIX.md files → `archive/known-issues.md`
- [ ] Archive old architecture docs → `archive/migrations/`
- [ ] Delete obsolete files (see Phase 3.1)

### Week 5: Updates & Verification
- [ ] Update `README.md` (paths, links, structure)
- [ ] Update `AGENTS.md` (repository structure, paths)
- [ ] Update `CHANGELOG.md` (document reorganization)
- [ ] Update `e2e/README.md` (single package references)
- [ ] Create `templates/README.md`
- [ ] Update all template READMEs (paths, commands)
- [ ] Update spec READMEs for new structure

### Week 6: Validation
- [ ] Verify all internal links work
- [ ] Check for broken references to old paths
- [ ] Validate all code examples still work
- [ ] Run spell check on all docs
- [ ] Get feedback from team/community
- [ ] Make final adjustments

## Migration Considerations

### Breaking Changes
1. **Spec paths change**: `spec/v0.4/` → `spec/protocol/v0.4/`
2. **CLI spec**: Now at `spec/cli/` (was in `specs-to-merge/`)
3. **Guides moved**: `docs/guides/DEVELOPMENT.md` → `docs/development.md`

### Backward Compatibility
- Keep `protocol-spec/` symlink → `spec/protocol/` for 1 release cycle
- Add README.md in old locations pointing to new paths
- Update CHANGELOG.md with clear migration guide

### Documentation Debt Resolved
- ✅ Single testing guide (not 3)
- ✅ All specs in one place (`spec/`)
- ✅ Clear entry point (`docs/README.md`)
- ✅ No references to old monorepo structure
- ✅ Archived completed work (not mixed with active docs)
- ✅ Unified template guide
- ✅ Current architecture documentation

## Success Metrics

### Discoverability
- [ ] New contributor can find dev guide in < 30 seconds
- [ ] User can find template walkthrough in < 30 seconds
- [ ] Clear path from README → specific topic

### Accuracy
- [ ] Zero references to `packages/mew` in docs
- [ ] Zero references to old directory structure
- [ ] All code examples verified to work
- [ ] All file paths verified to exist

### Maintainability
- [ ] Single source of truth for each topic
- [ ] Clear ownership for each doc category
- [ ] Easy to update when code changes
- [ ] Archive keeps history without cluttering active docs

## Open Questions

1. **AGENTS.md**: Keep at root or move to `docs/ai-agent-guide.md`?
   - **Recommendation**: Keep at root (high visibility for AI agents)
   - Update content for new structure

2. **specs-to-merge/**: Delete directory or keep as historical reference?
   - **Recommendation**: Delete after successful merge, Git history preserves it

3. **docs/bugs/**: Keep directory or merge into troubleshooting?
   - **Recommendation**: Review bugs, move relevant to troubleshooting, delete directory

4. **docs/releases/**: Keep separate or merge with releasing.md?
   - **Recommendation**: Keep - useful for version-specific release notes

5. **Protocol CHANGELOG**: Keep in `spec/protocol/CHANGELOG.md` or consolidate with root?
   - **Recommendation**: Keep separate - protocol versions independently of package

## Appendix: File Disposition Matrix

| Current Path | Status | New Path / Action |
|--------------|--------|-------------------|
| `README.md` | Update | Update paths and links |
| `CHANGELOG.md` | Keep | Add reorg entry |
| `ADR.md` | Archive | `archive/migrations/monorepo-to-single.md` |
| `AGENTS.md` | Update | Update for new structure |
| `CLAUDE.md` | Keep | No changes |
| `RELEASE.md` | Move | `docs/releasing.md` |
| `TEST.md` | Remove | → `docs/testing.md` |
| `TESTING-CAT-MAZE.md` | Remove | → `docs/templates.md` |
| `TESTING-CODER-AGENT.md` | Remove | → `docs/templates.md` |
| `TODO.md` | Archive | `archive/completed-todos.md` |
| `docs/architecture/*` | Archive | `archive/migrations/` |
| `docs/bugs/*` | Review | → `docs/troubleshooting.md` or delete |
| `docs/guides/DEVELOPMENT.md` | Merge | → `docs/development.md` |
| `docs/guides/TESTING.md` | Merge | → `docs/testing.md` |
| `docs/guides/RELEASING.md` | Consolidate | with `RELEASE.md` → `docs/releasing.md` |
| `docs/guides/SPEC-GUIDE.md` | Move | `spec/README.md` |
| `docs/guides/INTEGRATION-PLAN.md` | Archive | Completed work |
| `docs/protocol-flow-comparison.md` | Review | → `docs/architecture.md` or archive |
| `docs/releases/*` | Keep | No changes |
| `protocol-spec/` | Reorganize | → `spec/protocol/` |
| `protocol-spec/v0.0-v0.3/` | Archive | → `spec/archive/protocol/` |
| `protocol-spec/v0.4/` | Move | → `spec/protocol/v0.4/` |
| `protocol-spec/draft/` | Move | → `spec/protocol/draft/` |
| `specs-to-merge/cli-spec/` | Merge | → `spec/cli/` |
| `specs-to-merge/sdk-spec/` | Merge | → `spec/sdk/` |
| `src/bridge/spec/` | Move | → `spec/bridge/` |
| `src/agent/TODO.md` | Archive | `archive/completed-todos.md` |
| `src/cli/agents/README.md` | Remove | Empty stub |
| `src/client/docs/*.md` | Move | → `spec/protocol/` (as appendix) |
| `e2e/README.md` | Update | Update paths |
| `e2e/TODO.md` | Archive | `archive/completed-todos.md` |
| `e2e/scenario-*/FIX.md` | Archive | `archive/known-issues.md` |
| `e2e/spec/` | Keep | No changes |
| `templates/*/README.md` | Keep | Update paths |
| N/A | Create | `docs/README.md` |
| N/A | Create | `CONTRIBUTING.md` |
| N/A | Create | `docs/getting-started.md` |
| N/A | Create | `docs/architecture.md` |
| N/A | Create | `docs/troubleshooting.md` |
| N/A | Create | `docs/templates.md` |
| N/A | Create | `spec/README.md` |
| N/A | Create | `templates/README.md` |
| N/A | Create | `archive/completed-todos.md` |
| N/A | Create | `archive/known-issues.md` |

---

**Total Impact**:
- **Delete**: 18 files
- **Archive**: 12 files → `archive/`
- **Move**: 8 files to new locations
- **Update**: 10 existing files
- **Create**: 10 new files
- **Net Change**: Cleaner, more discoverable structure with ~40% fewer active docs
