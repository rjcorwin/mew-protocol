# ADR: Restructure packages/mew Location

**Status:** Accepted
**Date:** 2025-10-02
**Decision Makers:** MEW Protocol Team
**Implemented:** [Pending]

## Context

Currently, the MEW protocol codebase has all source code in `packages/mew/`, which was set up for a monorepo structure. However:

- There is only ONE package (`@mew-protocol/mew`)
- No other packages exist or are planned in the immediate future
- The `packages/` wrapper adds unnecessary nesting
- Build/test configurations reference `packages/mew` throughout
- CI workflows need to `cd packages/mew` for unit tests

The repository structure looks like:
```
mew-protocol/
├── packages/
│   └── mew/              # All source code lives here
│       ├── src/
│       ├── package.json
│       ├── tsconfig.json
│       └── ...
├── tests/                # Integration tests
├── package.json          # Root package.json
├── tsconfig.json         # Root tsconfig (references packages/mew)
└── ...
```

## Decision Drivers

1. **Simplicity** - Is the structure easy to understand for new contributors?
2. **Build tooling** - How does it affect TypeScript, npm, CI workflows?
3. **Future flexibility** - Can we add more packages later if needed?
4. **Migration effort** - How much work to change?
5. **Community conventions** - What do similar projects do?

## Options Considered

### Option 1: Keep `packages/mew/` (Status Quo)

**Structure:**
```
mew-protocol/
├── packages/
│   └── mew/
│       ├── src/
│       ├── package.json
│       └── ...
├── tests/
└── package.json
```

**Pros:**
- ✅ No migration needed
- ✅ Ready for future packages if needed
- ✅ Follows Lerna/Turborepo conventions
- ✅ Clear separation between package code and integration tests

**Cons:**
- ❌ Adds unnecessary nesting for single package
- ❌ CI needs `cd packages/mew` for unit tests
- ❌ More complex paths in imports/configs
- ❌ Overkill for current needs

**Examples:** Lerna monorepos, Turborepo projects, Nx workspaces

---

### Option 2: Move to Root (Flatten)

**Structure:**
```
mew-protocol/
├── src/
├── tests/              # Integration tests (or rename to e2e/)
├── package.json
├── tsconfig.json
└── ...
```

**Pros:**
- ✅ Simplest structure for single package
- ✅ Standard Node.js project layout
- ✅ Shorter import paths
- ✅ No `cd` needed in CI
- ✅ Familiar to most developers
- ✅ Easy to understand for contributors

**Cons:**
- ❌ Migration effort (update all imports, configs, CI)
- ❌ Harder to add packages later (would need to refactor again)
- ❌ Integration tests in `tests/` might conflict with unit tests

**Examples:** Express.js, Fastify, most npm packages

---

### Option 3: Hybrid - Keep Source Organized

**Structure:**
```
mew-protocol/
├── src/                # Source from packages/mew/src
├── packages/           # Keep empty for future packages
├── tests/              # Integration tests
├── package.json
└── tsconfig.json
```

**Pros:**
- ✅ Simpler than Option 1
- ✅ Signals intent to remain extensible
- ✅ Cleaner than full monorepo

**Cons:**
- ❌ Empty `packages/` directory is confusing
- ❌ Still requires migration
- ❌ Unclear conventions

---

### Option 4: Rename to Indicate Purpose

**Structure:**
```
mew-protocol/
├── packages/
│   └── mew/          # Keep but document as "main package"
├── e2e-tests/        # Rename tests/ to be explicit
└── ...
```

**Pros:**
- ✅ Minimal changes
- ✅ Clarifies that packages/mew is the main package
- ✅ Distinguishes e2e tests from unit tests

**Cons:**
- ❌ Still has nesting
- ❌ Doesn't solve core issue

---

## Comparison Matrix

| Criteria | Option 1 (Keep) | Option 2 (Root) | Option 3 (Hybrid) | Option 4 (Rename) |
|----------|-----------------|-----------------|-------------------|-------------------|
| Simplicity | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Build tooling | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Future flexibility | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Migration effort | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Community convention | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

## Analysis

### Current Pain Points
1. CI workflows require `cd packages/mew && npm test`
2. All documentation references `packages/mew/`
3. New contributors ask "why is there a packages folder with one package?"
4. Import paths are longer than necessary

### Future Considerations
- **Will we add more packages?**
  - Gateway could be separate (but currently part of mew CLI)
  - Bridge could be separate (but currently part of mew CLI)
  - Client library could be separate (but already exported from mew)
  - Unlikely in near term (6-12 months)

- **Is monorepo overhead worth it?**
  - Not currently - no package interdependencies
  - Could revisit if/when we actually need multiple packages

### TypeScript Project References
Current setup uses project references to build `packages/mew`. Moving to root would simplify to a single tsconfig.

### Similar Projects
- **single package:** next.js, sveltekit, fastify (root-level src/)
- **monorepo:** turborepo, babel, jest (packages/* structure)
- MEW Protocol is currently a **single package** that looks like a **monorepo**

## Recommendation

**Option 2: Move to Root** with the following structure:

```
mew-protocol/
├── src/                  # Move from packages/mew/src/
│   ├── cli/
│   ├── client/
│   ├── gateway/
│   ├── agent/
│   ├── bridge/
│   └── ...
├── e2e/                  # Rename tests/ → e2e/ for clarity
│   ├── scenario-1-basic/
│   ├── scenario-2-mcp/
│   └── ...
├── package.json          # Move from packages/mew/package.json
├── tsconfig.json         # Simplify (no project references)
├── vitest.config.ts      # Move from packages/mew/
└── README.md
```

### Rationale

1. **We're not a monorepo** - One package deserves one clean structure
2. **Simpler for contributors** - Standard Node.js layout everyone understands
3. **Better DX** - No `cd` commands, shorter paths, clearer organization
4. **Can refactor later** - If we genuinely need multiple packages (unlikely), we can add them then
5. **Industry standard** - Single-package projects use root-level src/

### Migration Plan

If approved, migration would involve:

1. Move `packages/mew/src/` → `src/`
2. Move `packages/mew/package.json` → `package.json` (merge with root)
3. Move `packages/mew/tsconfig.json` → `tsconfig.json`
4. Rename `tests/` → `e2e/` (optional but clearer)
5. Update CI workflows (remove `cd packages/mew`)
6. Update imports (if any absolute paths reference packages/mew)
7. Update documentation

**Estimated effort:** 2-3 hours

### Risks

- **Breaking changes for contributors** - Anyone with open PRs would need to rebase
- **Documentation drift** - Need to update all guides/READMEs
- **Future refactor if we need monorepo** - Would need to restructure again

**Mitigation:**
- Do this migration now before more external contributors
- Document clearly in CHANGELOG
- If monorepo becomes needed, tools like `npm workspaces` can be added incrementally

## Decision

**ACCEPTED: Option 2 - Move to Root**

We will flatten the repository structure by moving `packages/mew/` contents to the root level. This simplifies the project structure to match its reality as a single-package project.

## Implementation Plan

### Phase 1: Preparation

1. **Backup current state**
   - Create a backup branch: `git checkout -b backup-before-flatten`
   - Tag the current commit: `git tag pre-flatten-structure`

2. **Review open PRs/branches**
   - Document any open pull requests that will need rebasing
   - Notify contributors of upcoming breaking change

### Phase 2: File Movements

3. **Move source code**
   ```bash
   # Move src directory to root
   mv packages/mew/src ./src

   # Move configuration files
   mv packages/mew/package.json ./package.json.new
   mv packages/mew/tsconfig.json ./tsconfig.json.new
   mv packages/mew/vitest.config.ts ./vitest.config.ts
   mv packages/mew/.eslintrc.json ./.eslintrc.json  # if exists
   mv packages/mew/.prettierrc ./.prettierrc  # if exists

   # Move templates if they exist
   mv packages/mew/templates ./templates

   # Move spec files (if in packages/mew)
   # (Currently spec is already at root, so skip this)
   ```

4. **Merge package.json files**
   - Merge `packages/mew/package.json` into root `package.json`
   - Keep dependencies from packages/mew/package.json
   - Remove project references/workspaces config from root
   - Update bin path from `dist/cli/index.js` to match new structure
   - Update exports to point to root-level dist/

5. **Rename tests directory**
   ```bash
   mv tests e2e
   ```

6. **Clean up old structure**
   ```bash
   rm -rf packages/
   ```

### Phase 3: Configuration Updates

7. **Update tsconfig.json**
   - Remove project references
   - Simplify to single project configuration
   - Update include/exclude paths
   - Ensure outDir points to `./dist`

8. **Update GitHub Actions CI** (`.github/workflows/test.yml`)
   - Remove `cd packages/mew` commands
   - Update test commands:
     ```yaml
     - name: Run unit tests
       run: npm test
       env:
         CI: true

     - name: Run integration tests
       run: npm run test:e2e -- --no-llm --verbose
       env:
         CI: true
     ```

9. **Update root package.json scripts**
   ```json
   {
     "scripts": {
       "test": "vitest run",
       "test:watch": "vitest",
       "test:ui": "vitest --ui",
       "test:coverage": "vitest run --coverage",
       "test:e2e": "./e2e/run-all-tests.sh",
       "build": "tsc",
       "build:watch": "tsc --watch",
       "clean": "rm -rf dist",
       "lint": "eslint .",
       "lint:fix": "eslint . --fix",
       "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,md}\"",
       "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,md}\""
     }
   }
   ```

10. **Update e2e test scripts**
    - Update `e2e/run-all-tests.sh`:
      ```bash
      # Change from:
      if ! (cd "${REPO_ROOT}/packages/mew" && npm install -g . > /dev/null 2>&1); then

      # To:
      if ! (cd "${REPO_ROOT}" && npm install -g . > /dev/null 2>&1); then
      ```
    - Update scenario setup scripts if they reference `packages/mew`

### Phase 4: Import Path Updates

11. **Check for absolute imports**
    ```bash
    # Search for any hardcoded references to packages/mew
    grep -r "packages/mew" src/ e2e/ || echo "None found"
    grep -r "@mew-protocol/mew" src/ || echo "None found"
    ```

12. **Update any hardcoded paths**
    - Most imports should be relative and won't need changes
    - Update any absolute paths found

### Phase 5: Documentation Updates

13. **Update README.md**
    - Update directory structure diagrams
    - Update build/test instructions
    - Update contribution guide

14. **Update CONTRIBUTING.md** (if exists)
    - Update project structure section
    - Update testing instructions

15. **Create CHANGELOG entry**
    ```markdown
    ## [Unreleased]

    ### Changed
    - **BREAKING**: Restructured repository from monorepo to single-package layout
      - Moved `packages/mew/src/` → `src/`
      - Moved `packages/mew/package.json` → root `package.json`
      - Renamed `tests/` → `e2e/` for clarity
      - Simplified TypeScript configuration
      - Updated CI workflows
      - Contributors with open PRs will need to rebase
    ```

### Phase 6: Validation

16. **Build and test locally**
    ```bash
    npm install
    npm run build
    npm test
    npm run test:e2e -- --no-llm
    npm install -g .
    mew --version
    mew --help
    ```

17. **Test end-to-end scenarios**
    - Run full e2e test suite
    - Test CLI installation globally
    - Test gateway startup
    - Test agent creation

18. **Verify CI passes**
    - Push to a test branch
    - Ensure GitHub Actions passes on both Node 22 and 23

### Phase 7: Deployment

19. **Merge and communicate**
    - Create pull request with clear breaking change notice
    - Update all documentation
    - Notify contributors
    - Merge to main branch

20. **Post-migration cleanup**
    - Update any external documentation
    - Update package registry metadata if needed
    - Remove backup branch after confirming everything works

## Rollback Plan

If issues arise during migration:

1. **Immediate rollback:**
   ```bash
   git reset --hard pre-flatten-structure
   git push --force origin main  # Only if absolutely necessary
   ```

2. **Issues found after merge:**
   - Keep the `backup-before-flatten` branch for reference
   - Can cherry-pick specific fixes while reverting structure
   - Tag is available: `git checkout pre-flatten-structure`

## Consequences

### If we choose Option 2 (Recommended)

**Positive:**
- Simpler project structure
- Easier onboarding for new contributors
- Cleaner CI/build configs
- Shorter import paths
- Follows Node.js conventions

**Negative:**
- One-time migration effort
- Breaking change for existing contributors
- Future monorepo would require refactoring

**Neutral:**
- Documentation updates needed
- Need to communicate change clearly

---

## Notes

- This ADR focuses on **structure only**, not the actual code architecture
- Package name `@mew-protocol/mew` can remain unchanged
- The spec (`spec/`) can stay at root level regardless of choice
- Templates can stay at root or move to `src/templates/` in Option 2

## References

- [Node.js Package Layout Best Practices](https://docs.npmjs.com/cli/v10/configuring-npm/package-json)
- [Monorepo Tools Comparison](https://monorepo.tools/)
- Similar single-package projects: fastify, express, next.js
