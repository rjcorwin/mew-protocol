# Research: Ink v6 Upgrade

## Research Questions

1. What are the breaking changes between ink v3 and v6?
2. What are the breaking changes between React 18 and React 19?
3. How is ink currently used in the MEW Protocol CLI?
4. Are there any compatibility issues with other dependencies?

## Findings

### Ink Breaking Changes

#### v3 → v4
- **Pure ESM**: Package is now pure ESM
  - MEW Protocol already uses ESM (`"type": "module"` in package.json)
  - ✅ No action needed

- **Node.js 14.16**: Minimum version requirement
  - MEW Protocol requires Node.js >= 22.0.0
  - ✅ Already exceeds requirement

- **React 18**: Required React version
  - Currently on React 18.2.0
  - ✅ Compatible, will upgrade to React 19

- **Color formats**: Removed hsl, hsv, hwb, ansi formats
  - Need to audit current color usage
  - MEW Protocol uses named colors (e.g., 'magenta', 'cyan')
  - ✅ Should be compatible

#### v4 → v5
- **Node.js 18**: Minimum version bumped to 18
  - MEW Protocol requires >= 22.0.0
  - ✅ Already exceeds requirement

#### v5 → v6
- **Node.js 20**: Minimum version bumped to 20
  - MEW Protocol requires >= 22.0.0
  - ✅ Already exceeds requirement

- **React 19**: Required React version
  - Currently on React 18.2.0
  - ⚠️ Need to upgrade React

### React 18 → 19 Changes

React 19 is the latest stable version. Key changes:
- New JSX Transform (already in use since React 17)
- Improved TypeScript support
- Performance improvements
- Minor breaking changes (mostly edge cases)

### Current Ink Usage in MEW Protocol

Files using ink:
1. `src/cli/ui/components/EnhancedInput.ts`
   - Uses: `Box`, `Text`, `useInput` (via custom hook)
   - Colors: theme-based named colors

2. `src/cli/ui/components/SimpleInput.ts`
   - Uses: `Box`, `Text`, `useInput`
   - Colors: named colors

3. `src/cli/ui/hooks/useKeypress.ts`
   - Uses: `useInput`
   - Wraps ink's `useInput` hook

4. `src/cli/utils/advanced-interactive-ui.ts`
   - Large file, uses ink components extensively
   - Need to audit for color usage

### Color Usage Audit

Searched for color props in ink components:
- `color="magenta"` ✅
- `color="cyan"` ✅
- `color="white"` ✅
- `color={theme?.colors?....}` ✅ (named colors from theme)
- `borderColor="magenta"` ✅

All colors are named colors or hex values, no deprecated formats detected.

### Dependency Compatibility

Current dependencies that might be affected:
- `@types/react`: Currently not in package.json, should add `@types/react@^19.0.0`
- Other packages seem to have no direct React dependency

## Conclusion

The upgrade path is clear:
1. Update `ink` to `^6.3.1`
2. Update `react` to `^19.0.0`
3. Add `@types/react` to devDependencies
4. No code changes required (colors are already compatible)
5. Test thoroughly to ensure no regressions

Risk level: **Low** - No significant code changes required, mainly dependency bumps.
