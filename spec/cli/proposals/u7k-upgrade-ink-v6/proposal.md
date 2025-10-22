# Proposal u7k: Upgrade Ink to v6

## Status
- **Status**: Proposed
- **Proposed**: 2025-10-21
- **Type**: Enhancement
- **Area**: CLI

## Summary

Upgrade the `ink` React CLI framework from v3.2.0 to v6.3.1 to get latest features, improvements, and security updates.

## Motivation

The current version of ink (v3.2.0) is significantly outdated. Upgrading to v6.3.1 provides:

1. **Up-to-date dependencies**: Aligns with modern React (v19) and Node.js (v20+)
2. **Bug fixes and improvements**: Three major versions of fixes and performance improvements
3. **Better maintainability**: Staying current with dependencies reduces technical debt
4. **Security**: Latest versions include security patches and updates

## Current State

- `ink`: ^3.2.0
- `react`: ^18.2.0
- Node.js requirement: >=22.0.0 (already meets v6 requirement)
- Package type: ESM (already configured)

## Proposed Changes

### Dependencies

Upgrade the following packages in `package.json`:

```json
{
  "dependencies": {
    "ink": "^6.3.1",
    "react": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0"
  }
}
```

### Breaking Changes to Address

Based on ink release notes:

#### v4.0.0 Breaking Changes
1. **Pure ESM**: Package is now pure ESM (already using ESM with `"type": "module"`)
2. **React 18**: Requires React 18+ (upgrading to React 19)
3. **Color formats**: Removed support for hsl, hsv, hwb, and ansi color formats in `Text` component's `color` prop
4. **react-devtools-core**: Moved to optional peer dependency (not used in this project)

#### v5.0.0 Breaking Changes
1. **Node.js 18**: Requires Node.js >= 18 (current requirement is >= 22, already met)

#### v6.0.0 Breaking Changes
1. **Node.js 20**: Requires Node.js >= 20 (current requirement is >= 22, already met)
2. **React 19**: Requires React 19 (will upgrade)

### Code Changes Required

Need to verify that color props in `Text` components don't use deprecated formats:
- Check all `color` props in:
  - `src/cli/ui/components/EnhancedInput.ts`
  - `src/cli/ui/components/SimpleInput.ts`
  - `src/cli/utils/advanced-interactive-ui.ts` (if applicable)
  - Any other files using ink components

Current usage appears to use named colors (e.g., 'magenta', 'cyan', 'white') which are still supported.

## Implementation Plan

1. Update `package.json` dependencies
2. Review code for deprecated color format usage
3. Run `npm install` to update dependencies
4. Run build to check for TypeScript/compilation errors
5. Run e2e tests to verify functionality
6. Update CHANGELOG.md

## Testing Strategy

1. **Build test**: `npm run build` should succeed without errors
2. **Type check**: `npm run typecheck` should pass
3. **E2E tests**: `npm run test:e2e:all` should pass
4. **Manual testing**:
   - Test `mew space connect` interactive mode
   - Verify input components work correctly
   - Check color rendering in terminal

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| React 19 introduces breaking changes | Review React 19 migration guide and test thoroughly |
| Color rendering changes | Verify all themed colors render correctly |
| Input handling changes | Test all keyboard shortcuts and input modes |
| Third-party compatibility | Check if any other dependencies conflict with React 19 |

## Alternatives Considered

1. **Stay on v3**: Keep current version
   - Pros: No breaking changes to handle
   - Cons: Missing updates, potential security issues, technical debt

2. **Incremental upgrade**: Upgrade v3 → v4 → v5 → v6
   - Pros: Smaller changes per step
   - Cons: More work, same end result

3. **Direct upgrade to v6**: (Selected)
   - Pros: Single migration, immediate benefits
   - Cons: More breaking changes at once

## References

- [Ink v4.0.0 Release](https://github.com/vadimdemedes/ink/releases/tag/v4.0.0)
- [Ink v6.0.0 Release](https://github.com/vadimdemedes/ink/releases/tag/v6.0.0)
- [Ink GitHub Repository](https://github.com/vadimdemedes/ink)
- Current usage in MEW Protocol: `src/cli/ui/` directory
