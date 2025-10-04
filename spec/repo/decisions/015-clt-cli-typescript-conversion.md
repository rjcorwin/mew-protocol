# ADR 015: Convert CLI from JavaScript to TypeScript

**Status**: Proposed
**Date**: 2025-09-30
**Deciders**: Core Team
**Tags**: cli, typescript, build-system, module-resolution

## Context

During Phase 4 of the repository restructure, we consolidated all packages into a single `@mew-protocol/mew` package. The library code (types, client, participant, agent, gateway, bridge) is written in TypeScript, while the CLI (commands, UI, utilities) was converted from CommonJS to ESM JavaScript.

This mixed JavaScript/TypeScript setup has created a critical module resolution issue:

### The Problem

1. **TypeScript with `moduleResolution: "bundler"`** emits imports without `.js` extensions:
   ```typescript
   // src/agent/index.ts compiles to:
   import { MEWAgent } from './MEWAgent';  // No .js extension
   ```

2. **Node.js ESM requires `.js` extensions** for relative imports:
   ```typescript
   // Node.js needs:
   import { MEWAgent } from './MEWAgent.js';
   ```

3. **Bundled CLI tries to dynamically import library code**:
   ```javascript
   // src/cli/commands/agent.js attempts:
   const { MEWAgent } = await import('@mew-protocol/mew/agent');
   // This fails because the built agent/index.js has broken imports
   ```

### Impact

- `mew agent run` command is completely broken
- Templates that use `mew agent run` (coder-agent, cat-maze) cannot start agents
- Dynamic imports from CLI → library are unreliable
- Build system fragmentation (tsup for CLI, tsc for library)

### Current Workarounds Attempted

1. **Dynamic import with relative paths**: Bundler still tries to resolve and breaks
2. **Dynamic import with package subpath**: Library code has broken imports
3. **External dependencies in bundler**: Doesn't solve the core TypeScript → Node.js ESM mismatch

## Decision

**Convert the entire CLI codebase from JavaScript to TypeScript** and adopt consistent ESM module resolution across the entire package.

### Migration Strategy

#### Phase 5.2: CLI Conversion (~20 files)
- Convert `src/cli/utils/*.js` → `*.ts`
- Convert `src/cli/commands/*.js` → `*.ts` (12 command files)
- Convert `src/cli/ui/*.js` → `*.ts`
- Convert `src/cli/index.js` → `index.ts`
- Update `tsup.config.js` entry points to `.ts`

#### Phase 5.3: Module Resolution Fix
- Change `moduleResolution: "bundler"` → `"NodeNext"` in `tsconfig.json`
- Add `.js` extensions to **all** relative imports across the codebase (~50 files total)
- Use TypeScript's new `rewriteRelativeImportExtensions` option if needed
- Ensure `tsc` and `tsup` both produce correct output

#### Phase 5.4: Testing
- Test `mew agent run` command works
- Test all three templates end-to-end
- Run full integration test suite
- Verify no regressions in existing commands

## Consequences

### Positive

- **Unified codebase**: One language, one set of module resolution rules
- **Type safety in CLI**: Catch errors at compile time instead of runtime
- **Fixes dynamic imports**: Library code will have correct `.js` extensions
- **Better IDE support**: Full TypeScript IntelliSense throughout
- **Consistent build**: Same TypeScript compiler for everything
- **Future-proof**: Proper ESM that works with Node.js and bundlers

### Negative

- **Migration effort**: ~20 files to convert, ~50 files to add `.js` extensions
- **Breaking change risk**: Must test thoroughly to avoid regressions
- **Slight complexity**: TypeScript requires explicit `.js` in imports (but this is correct ESM)

### Neutral

- **Build time**: May increase slightly, but likely negligible
- **Bundle size**: Should remain approximately the same
- **Learning curve**: Team already knows TypeScript

## Alternatives Considered

### Alternative 1: Keep CLI as JavaScript, fix library imports manually
- Add a post-processing step to add `.js` extensions to built library files
- **Rejected**: Hacky, error-prone, doesn't solve root cause

### Alternative 2: Use CommonJS for everything
- Convert back to CommonJS to avoid ESM import issues
- **Rejected**: ESM is the future, we've already committed to it

### Alternative 3: Don't use dynamic imports
- Bundle MEWAgent directly into CLI
- **Rejected**: Creates bundling issues with micromatch, increases bundle size significantly

### Alternative 4: Remove `mew agent run`, use template scripts only
- Templates provide their own agent scripts (like note-taker)
- **Rejected**: Less convenient UX, doesn't solve underlying issue

## Implementation Plan

### Phase 5.1: Documentation ✓
- [x] Create this ADR
- [x] Update TODO.md with Phase 5 plan

### Phase 5.2: CLI Conversion (Est. 2-3 hours)
- [ ] Update `packages/mew/tsconfig.json` to include `src/cli/**/*.ts`
- [ ] Convert utility files first (smallest, fewest dependencies)
- [ ] Convert command files one by one, testing incrementally
- [ ] Convert UI components
- [ ] Convert main CLI entry point
- [ ] Update `tsup.config.js` entry points

### Phase 5.3: Module Resolution (Est. 1-2 hours)
- [ ] Change `moduleResolution` to `"NodeNext"`
- [ ] Add `.js` extensions to all relative imports (use find/replace + manual review)
- [ ] Fix any build errors
- [ ] Verify `tsc` output is correct
- [ ] Verify `tsup` bundles work

### Phase 5.4: Testing (Est. 1 hour)
- [ ] Build and install globally
- [ ] Test `mew agent run`
- [ ] Test all three templates
- [ ] Run integration tests
- [ ] Fix any issues found

**Total estimated time**: 4-6 hours

## References

- [Node.js ESM documentation](https://nodejs.org/api/esm.html)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/modules/theory.html#module-resolution)
- [TypeScript 5.0 - moduleResolution: "bundler"](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#moduleresolution-bundler)
- Phase 4 work: Template dependency refactor (REFACTOR-TEMPLATE-DEPS.md)
- Related: ADR 012 (secure token generation), ADR 014 (gateway envelope tracing)