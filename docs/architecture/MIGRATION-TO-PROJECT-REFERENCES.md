# Migration Guide: TypeScript Project References

This guide provides step-by-step instructions to migrate each package to use TypeScript project references.

## Prerequisites

✅ Root `tsconfig.json` created with project references
✅ Root `tsconfig.base.json` created with shared configuration
✅ Workspaces cleaned up (removed `.mew` directories)
✅ Root build scripts updated

## Package-by-Package Migration

### 1. @mew-protocol/mew/types

**Current tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    // ... other options
  }
}
```

**Updated tsconfig.json:**
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### 2. @mew-protocol/mew/capability-matcher

**Updated tsconfig.json:**
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"],
  "references": [
    { "path": "../types" }
  ]
}
```

### 3. @mew-protocol/mew/client

Since this package uses the custom build script with multiple configs, we need a different approach:

**Create tsconfig.json for project references:**
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"],
  "references": [
    { "path": "../types" }
  ]
}
```

**Keep existing build configs but update them to extend the main tsconfig:**
- `tsconfig.build.esm.json`
- `tsconfig.build.cjs.json`
- `tsconfig.build.types.json`

### 4. @mew-protocol/mew/participant

**Updated tsconfig.json:**
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"],
  "references": [
    { "path": "../types" },
    { "path": "../client" },
    { "path": "../capability-matcher" }
  ]
}
```

**Remove path mappings from current tsconfig:**
```json
// REMOVE THESE:
"baseUrl": "./",
"paths": {
  "@mew-protocol/mew/types": ["../types/src"],
  "@mew-protocol/mew/client": ["../client/src"],
  // ...
}
```

### 5. @mew-protocol/mew/agent

**Current problematic configuration:**
```json
{
  "baseUrl": "./",
  "paths": {
    "@mew-protocol/mew/client": ["../client/dist"],
    "@mew-protocol/mew/client/*": ["../client/dist/*"],
    "@mew-protocol/mew/participant": ["../participant/dist"],
    "@mew-protocol/mew/participant/*": ["../participant/dist/*"],
    "@mew-protocol/mew/types": ["../types/dist"],
    "@mew-protocol/mew/types/*": ["../types/dist/*"]
  }
}
```

**Updated tsconfig.json:**
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"],
  "references": [
    { "path": "../types" },
    { "path": "../client" },
    { "path": "../participant" }
  ]
}
```

### 6. @mew-protocol/gateway

Similar to client, uses custom build script:

**Create/update tsconfig.json:**
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"],
  "references": [
    { "path": "../types" },
    { "path": "../capability-matcher" }
  ]
}
```

### 7. @mew-protocol/mew/bridge

**Updated tsconfig.json:**
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"],
  "references": [
    { "path": "../types" },
    { "path": "../participant" }
  ]
}
```

## Migration Steps

### Step 1: Build the unified workspace
```bash
cd packages/mew
npm run build
```

### Step 2: Verify root build orchestration
```bash
cd ..
npm run build
```

### Step 4: Update Participant
```bash
cd ../participant
# Update tsconfig.json
# Remove path mappings
npm run build
```

### Step 5: Update Agent
```bash
cd ../agent
# Update tsconfig.json
# Remove all path mappings
npm run build
```

### Step 6: Update Gateway
```bash
cd ../gateway
# Update tsconfig.json
npm run build
```

### Step 7: Update Bridge
```bash
cd ../../bridge
# Update tsconfig.json
npm run build
```

### Step 8: Test Full Build
```bash
cd ../..
npm run clean
npm run build
```

## Verification Checklist

- [ ] All packages have `"composite": true` in tsconfig
- [ ] All packages extend `tsconfig.base.json`
- [ ] All path mappings removed
- [ ] All packages have correct `references`
- [ ] Root `npm run build` works
- [ ] Root `npm run build:watch` works
- [ ] IDE navigation works between packages
- [ ] Tests still pass

## Troubleshooting

### Error: "Cannot find module '@mew-protocol/mew/types'"
**Solution:**
1. Ensure the package is listed in `references` in tsconfig.json
2. Run `npm run build` at the root first
3. Check that the referenced package has `"composite": true`

### Error: "Referenced project must have setting 'composite': true"
**Solution:** Add `"composite": true` to the referenced package's tsconfig.json

### Error: "File is not listed within the file list of project"
**Solution:** Check the `include` patterns in tsconfig.json cover all source files

### Build order issues
**Solution:** TypeScript automatically determines build order from references. Check that references match actual import dependencies.

## Benefits After Migration

1. **Source-level imports**: No need to build packages to get types
2. **Incremental builds**: Only changed packages rebuild
3. **Watch mode**: `npm run build:watch` at root watches all packages
4. **Better IDE support**: Go-to-definition works across packages
5. **Automatic build ordering**: No manual build chain needed

## Notes on Special Cases

### Packages with Custom Build Scripts

For packages using `build-ts-package.mjs` (client, gateway):
- Keep the custom build script for creating ESM/CJS outputs
- Add a standard tsconfig.json for project references
- The custom script handles the dual-format package creation

### CLI Package

The CLI package doesn't use TypeScript, so it doesn't need project references. However, it's still part of workspaces for dependency management.

## Next Steps

After completing the migration:

1. **Update CI/CD**: Ensure build pipeline uses `npm run build` at root
2. **Update Documentation**: Update package READMEs with new build process
3. **Developer Training**: Ensure team knows to use `npm run build:watch` for development
4. **Consider Further Optimization**: Look into tools like Nx or Turborepo for additional performance gains