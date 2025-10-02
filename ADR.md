# ADR: Restructure packages/mew Location

**Status:** Proposed
**Date:** 2025-10-02
**Decision Makers:** MEW Protocol Team

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

**[PENDING]** - Awaiting team review

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
