# TypeScript Monorepo Setup Guide

This guide documents the recommended TypeScript configuration for the MEW Protocol monorepo, moving from path-based module resolution to TypeScript Project References.

## Current State

The monorepo currently uses:
- npm workspaces for package management
- Manual `paths` configuration in each package's tsconfig.json
- Path mappings pointing to `dist/` directories (compiled output)

### Issues with Current Approach

1. **Build dependency** - Must build packages before TypeScript can resolve types
2. **Stale types** - IDE shows outdated types until packages are rebuilt
3. **No incremental builds** - Every package rebuilds fully even for small changes
4. **Manual dependency tracking** - Path mappings duplicate what's already in package.json
5. **Poor refactoring support** - IDE can't properly track references across packages

## Recommended Setup: TypeScript Project References

TypeScript Project References is the official solution for monorepos, providing:
- Source-level type resolution (no build required)
- Incremental compilation
- Automatic build ordering
- Better IDE support

### Step 1: Create Base Configuration

Create a shared base configuration at the root:

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  }
}
```

### Step 2: Configure Package TSConfigs

The unified workspace keeps a single TypeScript project configuration. Extend the base settings
and exclude CLI/templates so that only library sources participate in incremental builds:

```json
// packages/mew/tsconfig.build.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": "src",
    "paths": {
      "@mew-protocol/mew": ["index.ts"],
      "@mew-protocol/mew/*": ["*/index.ts", "*/MEWAgent.ts"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": [
    "src/cli/**",
    "src/bin/**",
    "src/templates/**",
    "**/*.test.ts"
  ]
}
```

Add additional `references` only when introducing new subprojects under `packages/mew/src`
(for example, if a future module requires its own build output). For the current layout, the
single build config is sufficient.

### Step 3: Create Root TSConfig for Building

Create a root configuration that references all packages:

```json
// tsconfig.json
{
  "files": [],
  "references": [
    { "path": "./packages/mew" }
  ]
}
```

### Step 4: Update Build Scripts

Replace individual TypeScript compilation with project-wide builds:

```json
// package.json
{
  "scripts": {
    "build": "tsc -b",
    "build:force": "tsc -b --force",
    "clean": "tsc -b --clean",
    "watch": "tsc -b --watch"
  }
}
```

For individual packages:

```json
// packages/mew/src/agent/package.json
{
  "scripts": {
    "build": "tsc -b",
    "dev": "tsc -b --watch",
    "clean": "tsc -b --clean"
  }
}
```

### Step 5: Remove Path Mappings

Delete all `paths` configurations from individual tsconfig.json files:

```json
// REMOVE THIS from packages/mew/src/agent/tsconfig.json
"paths": {
  "@mew-protocol/mew/client": ["../client/dist"],
  "@mew-protocol/mew/client/*": ["../client/dist/*"],
  // ... etc
}
```

## Migration Checklist

- [ ] Create `tsconfig.base.json` at root
- [ ] Add `"composite": true` to each package's tsconfig.json
- [ ] Add `references` array pointing to dependencies
- [ ] Create root `tsconfig.json` with all package references
- [ ] Remove all `paths` configurations
- [ ] Update build scripts to use `tsc -b`
- [ ] Test incremental builds work correctly
- [ ] Verify IDE navigation works across packages

## Benefits After Migration

1. **Faster Development** - No need to build before getting types
2. **Incremental Builds** - Only changed packages rebuild
3. **Better IDE Support** - Go-to-definition works across packages
4. **Type Safety** - Real-time type checking across package boundaries
5. **Simpler Configuration** - No manual path mappings to maintain

## Common Issues and Solutions

### Issue: "Cannot find module '@mew-protocol/mew/types'"

**Solution**: Ensure the package is listed in both:
- `package.json` dependencies
- `tsconfig.json` references array

### Issue: "File is not listed within the file list of project"

**Solution**: Check that `include` patterns in tsconfig.json cover all source files.

### Issue: Build order problems

**Solution**: TypeScript automatically determines build order from references. If you have circular dependencies, you'll need to restructure your packages.

### Issue: Tests can't import from src

**Solution**: Create a separate `tsconfig.test.json` that includes test files:

```json
// tsconfig.test.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": false
  },
  "include": ["src/**/*", "test/**/*"]
}
```

## Additional Optimizations

### 1. Use Build Mode for CI

```bash
# CI build script
npm run clean
npm run build
npm run test
```

### 2. Enable Incremental Compilation

Add to base config for faster rebuilds:

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

### 3. Configure VS Code for Monorepo

```json
// .vscode/settings.json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.preferences.includePackageJsonAutoImports": "on"
}
```

## Resources

- [TypeScript Project References Documentation](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [TypeScript Monorepo Best Practices](https://typescript-eslint.io/linting/typed-linting/monorepos)
- [npm Workspaces Documentation](https://docs.npmjs.com/cli/v8/using-npm/workspaces)