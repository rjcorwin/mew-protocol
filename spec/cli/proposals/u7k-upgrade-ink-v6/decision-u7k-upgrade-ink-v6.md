# Decision: u7k - Upgrade Ink to v6

## Context

The MEW Protocol CLI uses the `ink` framework (React for CLIs) for its interactive terminal UI. The current version (v3.2.0) is significantly outdated, with v6.3.1 being the latest stable version.

## Decision

We will upgrade `ink` from v3.2.0 to v6.3.1, along with upgrading React from v18.2.0 to v19.0.0.

## Rationale

1. **Technical Health**: Keeping dependencies up-to-date reduces technical debt and security vulnerabilities
2. **Low Risk**: The upgrade requires no code changes due to:
   - Already using ESM
   - Already meeting Node.js version requirements
   - Using only supported color formats
3. **Future Maintenance**: Staying current makes future upgrades easier
4. **Performance**: Newer versions include performance improvements and bug fixes

## Consequences

### Positive
- Latest bug fixes and performance improvements
- Better React 19 support
- Reduced technical debt
- Security patches included

### Negative
- Need to update related React types
- Small risk of undocumented breaking changes
- Need to test thoroughly

### Neutral
- No code changes required
- Build process unchanged
- API surface unchanged for our usage

## Implementation

1. Update `package.json`:
   - `ink`: `^3.2.0` → `^6.3.1`
   - `react`: `^18.2.0` → `^19.0.0`
   - Add `@types/react`: `^19.0.0` to devDependencies

2. Install and test:
   - `npm install`
   - `npm run build`
   - `npm run test:e2e`

3. Update CHANGELOG.md with the changes

## Status

- **Decided**: 2025-10-21
- **Implemented**: Pending
- **Decision Maker**: Development team following standard upgrade practices
