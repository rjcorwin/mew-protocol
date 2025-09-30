# MEW Protocol Monorepo Architecture

This document provides a comprehensive guide to the MEW Protocol monorepo structure, package lifecycle, and recommended setup for optimal development workflow.

## Repository Structure

```
mew-protocol/
├── packages/
│   └── mew/                # Unified package published as @mew-protocol/mew
│       ├── src/
│       │   ├── types/                # Shared protocol types
│       │   ├── client/               # WebSocket client SDK
│       │   ├── participant/          # Participant helpers & tool registry
│       │   ├── agent/                # TypeScript agent runtime & CLI
│       │   ├── capability-matcher/   # Capability pattern matcher
│       │   ├── bridge/               # MCP bridge implementation
│       │   ├── cli/                  # MEW CLI implementation
│       │   └── bin/                  # Entry points (mew, mew-agent, mew-bridge)
│       ├── templates/       # Built-in space templates
│       ├── dist/            # Build output (tsc + copied CLI assets)
│       ├── package.json     # name: @mew-protocol/mew
│       └── README.md
├── cli/bin/mew.js           # Stable wrapper for local development
├── scripts/                 # Build utilities (e.g., scripts/build-cli.js)
├── tests/                   # Scenario test harnesses
├── spaces/                  # Developer playground workspaces
├── spec/                    # Protocol specifications and ADRs
└── docs/                    # Architecture notes, guides, and progress trackers
```

## Package Categories

### 1. Unified SDK Package
All runtime libraries and tools now live inside the `@mew-protocol/mew` workspace. The package exposes subpath exports for each module:

- `@mew-protocol/mew/types`
- `@mew-protocol/mew/capability-matcher`
- `@mew-protocol/mew/client`
- `@mew-protocol/mew/participant`
- `@mew-protocol/mew/agent`
- `@mew-protocol/mew/bridge`

**Dependency Graph:**
```
types
  ├── capability-matcher
  ├── client
  │     └── participant (+ capability-matcher, types)
  │           └── agent
  └── bridge (+ participant)
```

### 2. CLI and Templates
- `@mew-protocol/mew` ships the `mew` CLI plus `mew-agent` and `mew-bridge` shims in `src/bin/`.
- Built-in templates (cat-maze, coder-agent, note-taker) consume the unified package and depend on a single version.

### 3. Development Spaces
Located in `spaces/`, these are example/development environments:
- Each space has its own `package.json` for app-specific dependencies
- Contains `.mew/` directory with runtime configuration
- Should use local SDK packages during development

### 4. Test Scenarios
Located in `tests/`, these validate protocol implementation:
- Self-contained test scripts with `setup.sh`, `test.sh`, `teardown.sh`
- Use local CLI and SDK packages
- Not npm packages themselves

## Current Issues & Solutions

### Issue 1: TypeScript Path Mappings
**Problem**: Packages use path mappings to `dist/` folders, requiring build before type checking.

**Solution**: Implement TypeScript Project References for source-level imports.

### Issue 2: Manual Build Ordering
**Problem**: Build script manually chains package builds (`build:types && build:matcher && ...`).

**Solution**: Use `tsc -b` with project references for automatic dependency ordering.

### Issue 3: Workspace Configuration
**Problem**: `.mew` directories are included as workspaces but aren't packages.

**Solution**: Remove `.mew` from workspaces, handle them as runtime directories.

### Issue 4: Mixed Build Systems
**Problem**: Some packages use `tsc`, others use custom `build-ts-package.mjs`.

**Solution**: Standardize on approach based on package needs (libraries vs. tools).

## Recommended Monorepo Setup

### 1. Update Root package.json

```json
{
  "name": "mew-protocol",
  "private": true,
  "workspaces": [
    "packages/mew"
  ],
  "scripts": {
    "build": "npm run build --workspace=@mew-protocol/mew",
    "clean": "npm run clean --workspace=@mew-protocol/mew",
    "test": "./tests/run-all-tests.sh --no-llm",
    "test:all": "./tests/run-all-tests.sh",
    "lint": "npm run lint --workspace=@mew-protocol/mew --if-present"
  }
}
```

Note: Remove `tests/*/.mew` and `spaces/*/.mew` from workspaces.

### 2. Create Root tsconfig.json

```json
{
  "files": [],
  "references": [
    { "path": "./sdk/typescript-sdk/types" },
    { "path": "./sdk/typescript-sdk/capability-matcher" },
    { "path": "./sdk/typescript-sdk/client" },
    { "path": "./sdk/typescript-sdk/participant" },
    { "path": "./sdk/typescript-sdk/agent" },
    { "path": "./sdk/typescript-sdk/gateway" },
    { "path": "./bridge" }
  ]
}
```

### 3. Create Shared tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

### 4. Update Package TSConfigs

For packages using simple tsc build (agent, participant, bridge):

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
    { "path": "../client" }
  ]
}
```

For packages using custom build script (client, gateway):
Keep existing tsconfig.json but add separate configs for the build script.

## Package Lifecycle Management

### Development Workflow

1. **Local Development**
   ```bash
   # Install all dependencies
   npm install

   # Build all packages with proper ordering
   npm run build

   # Watch mode for development
   npm run watch
   ```

2. **Working on Specific Package**
   ```bash
   cd sdk/typescript-sdk/agent
   npm run dev  # Watch mode for this package
   ```

3. **Creating a Development Space**
   ```bash
   cd spaces/
   npx @mew-protocol/cli init my-space
   cd my-space
   # The space will use local packages automatically
   ```

4. **Running Tests**
   ```bash
   # Run all tests
   npm test

   # Run specific test
   cd tests/scenario-1-basic
   ./test.sh
   ```

### Build Pipeline

1. **Clean Build**
   ```bash
   npm run clean
   npm run build
   ```

2. **CI/CD Build**
   ```yaml
   - run: npm ci
   - run: npm run build
   - run: npm test
   ```

### Publishing Workflow

For comprehensive package publishing instructions, see the main release guide:

**📖 See [RELEASE.md](../../RELEASE.md) for complete publishing process**

The release guide covers:
- Version management strategies
- Dependency order publishing
- CLI template updates
- Post-release verification

### Dependency Management

1. **Adding Dependencies**
   ```bash
   # Add to specific workspace
   npm install express --workspace=@mew-protocol/gateway

   # Add dev dependency to root
   npm install -D eslint
   ```

2. **Updating Dependencies**
   ```bash
   # Update all workspaces
   npm update --workspaces

   # Update specific package
   npm update @mew-protocol/mew/types --workspace=@mew-protocol/mew/agent
   ```

## Space Development

Spaces in the `spaces/` directory are development environments that:
- Have their own `package.json` for app dependencies
- Use local MEW packages via npm workspaces
- Contain `.mew/` runtime configuration
- Are NOT built as part of the monorepo build

### Creating a Space

```bash
cd spaces/
mkdir my-app && cd my-app

# Initialize as a MEW space
npx @mew-protocol/cli init .

# Add app-specific dependencies
npm init -y
npm install express react
```

### Space package.json Example

```json
{
  "name": "my-mew-space",
  "private": true,
  "dependencies": {
    "@mew-protocol/mew/agent": "file:../../sdk/typescript-sdk/agent",
    "@mew-protocol/mew/client": "file:../../sdk/typescript-sdk/client",
    "express": "^4.18.0"
  }
}
```

## Testing Strategy

### Unit Tests
Each package has its own tests:
```bash
npm test --workspace=@mew-protocol/mew/client
```

### Integration Tests
Located in `tests/`, these test the full protocol:
```bash
./tests/run-all-tests.sh
```

### Test Structure
```
tests/scenario-X-description/
├── space.yaml      # Space configuration
├── test.sh        # Main test runner
├── setup.sh       # Setup script
├── check.sh       # Verification script
└── teardown.sh    # Cleanup script
```

## Build Optimization

### Incremental Builds
TypeScript project references enable incremental compilation:
- Only changed packages rebuild
- Dependency graph ensures correct order
- `.tsbuildinfo` files track build state

### Parallel Builds
Use tools like `lerna` or `nx` for parallel builds:
```bash
npx lerna run build --parallel
```

### Build Caching
For CI/CD, cache these directories:
- `node_modules/`
- `**/dist/`
- `**/.tsbuildinfo`

## Migration Plan

### Phase 1: Setup Project References
1. Create `tsconfig.base.json`
2. Update each package's `tsconfig.json` with `composite: true`
3. Add `references` between packages
4. Create root `tsconfig.json` with all references

### Phase 2: Fix Workspace Configuration
1. Remove `.mew` directories from workspaces
2. Update root `package.json` scripts
3. Test build pipeline

### Phase 3: Standardize Build Process
1. Decide on tsc vs. custom build per package
2. Update package.json scripts
3. Document build requirements

### Phase 4: Optimize CI/CD
1. Implement build caching
2. Add parallel builds where possible
3. Set up automated publishing

## Best Practices

1. **Keep Dependencies Explicit**: Each package should list its own dependencies
2. **Use Project References**: For TypeScript packages, always use project references
3. **Version Together**: Consider using a tool like `lerna` for coordinated versioning
4. **Test Locally**: Always test with local packages before publishing
5. **Document Changes**: Keep CHANGELOG.md for each published package
6. **Clean Regularly**: Run `npm run clean` periodically to avoid stale builds

## Common Issues & Solutions

### Issue: "Cannot find module '@mew-protocol/mew/types'"
**Solution**: Ensure you've built the types package first or use `npm run build` at root.

### Issue: Types not updating during development
**Solution**: Use `npm run watch` for automatic rebuilds, or check that project references are correct.

### Issue: Space can't find local packages
**Solution**: Ensure the space's package.json uses `file:` protocol for local packages.

### Issue: Build order is wrong
**Solution**: Check that `references` in tsconfig.json files match actual dependencies.

## Recommended VS Code Settings

For optimal development experience, create `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.tsserver.experimental.enableProjectDiagnostics": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

Recommended extensions:
- `dbaeumer.vscode-eslint` - ESLint integration
- `esbenp.prettier-vscode` - Prettier formatting
- `ms-vscode.vscode-typescript-next` - Latest TypeScript features

## Future Improvements

1. **Nx or Turborepo Integration**: For better caching and task orchestration
2. **Automated Publishing**: GitHub Actions for coordinated npm releases
3. **E2E Test Suite**: Full protocol testing with real spaces
4. **Performance Monitoring**: Track build times and optimize slow packages
5. **Documentation Generation**: Automated API docs from TypeScript