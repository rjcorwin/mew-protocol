# MEW Protocol Release Guide

This guide covers the complete process for releasing all MEW Protocol packages to npm.

## Release Order

The packages must be published in dependency order:

```
types → capability-matcher → client → participant → agent → bridge → (update CLI templates) → cli
```

## Current Package Versions

- `@mew-protocol/types`: 0.2.0
- `@mew-protocol/capability-matcher`: 0.2.0
- `@mew-protocol/client`: 0.2.0
- `@mew-protocol/participant`: 0.2.0
- `@mew-protocol/agent`: 0.4.1
- `@mew-protocol/bridge`: 0.1.1
- `@mew-protocol/cli`: 0.4.2

## Pre-Release Checklist

### 1. Verify Repository State
```bash
# Ensure all changes are committed
git status

# Run tests to ensure everything works
npm run test

# Build all packages
npm run build

# TODO: Add linting check once technical debt is resolved
# npm run lint
```

### 2. Check npm Authentication
```bash
# Verify npm login
npm whoami

# Verify access to @mew-protocol scope
npm access ls-packages
# Should show all @mew-protocol packages
```

### 3. Review Package Contents
```bash
# Check each package dry-run (example for types)
cd sdk/typescript-sdk/types
npm pack --dry-run
```

## Release Process

### Phase 1: Review Changes & Update Changelogs

Before versioning, review what has changed and update changelogs:

#### Identify Changes Since Last Release
```bash
# See commits since last tag (adjust tag name as needed)
git log --oneline v0.2.0..HEAD

# See changes in specific package directory
git log --oneline v0.2.0..HEAD -- sdk/typescript-sdk/agent/

# Compare with last published version on npm
npm view @mew-protocol/agent versions --json
npm view @mew-protocol/agent@latest version
```

#### Update Changelogs
Each package should have its changelog updated:

```bash
# Update package-specific changelogs (if they exist)
# Edit sdk/typescript-sdk/types/CHANGELOG.md
# Edit sdk/typescript-sdk/agent/CHANGELOG.md
# etc.

# Or update root changelog with package sections
# Edit CHANGELOG.md
```

**Changelog Entry Format:**
```markdown
## [0.2.1] - 2024-XX-XX

### Added
- New feature descriptions

### Changed
- Modified behavior descriptions

### Fixed
- Bug fix descriptions

### Breaking Changes
- Any breaking changes (especially important for v0.x)
```

### Phase 2: Version Management

Choose your versioning strategy and bump package versions:

#### Option A: Coordinated Release (All SDK Packages)
```bash
# Decide on version strategy (patch/minor/major)
NEW_VERSION="0.2.1"  # Example

# Bump each package version
cd sdk/typescript-sdk/types && npm version $NEW_VERSION --no-git-tag-version
cd ../capability-matcher && npm version $NEW_VERSION --no-git-tag-version
cd ../client && npm version $NEW_VERSION --no-git-tag-version
cd ../participant && npm version $NEW_VERSION --no-git-tag-version
cd ../agent && npm version $NEW_VERSION --no-git-tag-version
```

#### Option B: Selective Release (Individual Packages)
```bash
# Example: Only bump agent package
cd sdk/typescript-sdk/agent
npm version patch --no-git-tag-version  # or minor/major
```

### Phase 2: SDK Package Publishing

Publish packages in dependency order, only publishing packages that have version changes:

```bash
# Get your npm OTP ready first
npm whoami  # Verify you're logged in

# Publish in dependency order (skip packages that don't need updates)
cd sdk/typescript-sdk/types && npm publish --access public --otp=YOUR_OTP
cd ../capability-matcher && npm publish --access public --otp=YOUR_OTP
cd ../client && npm publish --access public --otp=YOUR_OTP
cd ../participant && npm publish --access public --otp=YOUR_OTP
cd ../agent && npm publish --access public --otp=YOUR_OTP
```

**Publishing order (dependencies):**
1. types
2. capability-matcher
3. client
4. participant
5. agent

### Phase 4: Bridge Package

```bash
cd bridge
npm publish --access public --otp=YOUR_OTP
```

### Phase 5: Update CLI Templates

After SDK and bridge packages are published, update ALL CLI template dependencies to reference the new versions.

#### Find All Templates
```bash
# List all template directories
ls cli/templates/

# Find all package.json files in templates
find cli/templates -name "package.json" -type f
```

#### Update Template Dependencies
For each template that has MEW protocol dependencies, update the `package.json`:

```bash
# Example process for each template:
# 1. Check if template has MEW dependencies
grep "@mew-protocol" cli/templates/TEMPLATE_NAME/package.json

# 2. If it does, update versions to match newly published packages
# Edit cli/templates/TEMPLATE_NAME/package.json
```

**Common MEW dependencies to update:**
```json
{
  "dependencies": {
    "@mew-protocol/agent": "^[NEW_VERSION]",
    "@mew-protocol/bridge": "^[NEW_VERSION]",
    "@mew-protocol/client": "^[NEW_VERSION]",
    "@mew-protocol/participant": "^[NEW_VERSION]",
    "@mew-protocol/types": "^[NEW_VERSION]"
  }
}
```

#### Current Templates (as of this guide)
- `cli/templates/coder-agent/` - Has MEW dependencies
- `cli/templates/note-taker/` - Minimal dependencies
- *(Future templates will be automatically covered by this process)*

#### Verification
```bash
# Verify all templates reference correct versions
grep -r "@mew-protocol" cli/templates/*/package.json
```

### Phase 6: CLI Package

```bash
cd cli
npm publish --access public --otp=YOUR_OTP
```

## Post-Release Tasks

### 1. Create Git Tags
```bash
# Tag each package version (adjust versions as needed)
git tag types-v0.2.0
git tag capability-matcher-v0.2.0
git tag client-v0.2.0
git tag participant-v0.2.0
git tag agent-v0.4.1
git tag bridge-v0.1.1
git tag cli-v0.4.2

# Push tags
git push origin --tags
```

### 2. Verify Publications
```bash
# Check each package on npm
npm view @mew-protocol/types
npm view @mew-protocol/capability-matcher
npm view @mew-protocol/client
npm view @mew-protocol/participant
npm view @mew-protocol/agent
npm view @mew-protocol/bridge
npm view @mew-protocol/cli
```

### 3. Finalize Changelogs
```bash
# Update changelog dates to actual release date
# Edit CHANGELOG.md or package-specific changelog files
# Change "2024-XX-XX" to actual release date

# Commit changelog updates
git add CHANGELOG.md  # or specific changelog files
git commit -m "Update changelogs for release"
git push origin main
```

### 4. Update Documentation
- Update README.md files with new version numbers
- Update any getting started guides
- Consider announcing the release

## Troubleshooting

### Common Issues

**403 Forbidden Error**
```bash
# Check npm login and permissions
npm whoami
npm access ls-packages
```

**Version Already Published**
```bash
# The automated script handles this, but for manual publishes:
# Check existing versions
npm view @mew-protocol/[package-name] versions --json

# Bump version in package.json if needed
npm version patch  # or minor/major
```

**OTP Expired**
```bash
# The automated script will prompt for new OTP
# For manual publishes, generate new OTP and retry
```

**Missing Dependencies**
```bash
# Ensure all packages are built
npm run build

# Check for missing dist folders
find . -name "dist" -type d
```

### Build Issues

**TypeScript Compilation Errors**
```bash
# Clean and rebuild
npm run clean
npm run build

# Check specific package
cd sdk/typescript-sdk/[package-name]
npm run build
```

**Lint Warnings**
```bash
# Current lint issues are documented as non-blocking technical debt
# Tests should pass even with existing lint warnings
# TODO: Address lint issues and add to pre-release checklist
npm run test
```

## Version Management Strategy

### Recommendations
1. **For patch releases**: Bump individual packages as needed
2. **For minor releases**: Consider synchronizing major.minor across related packages
3. **For major releases**: Coordinate all packages to same major version

## Release Documentation

### SDK Packages
- **Process**: Manual publishing following dependency order
- **This guide**: Provides step-by-step instructions with proper sequencing

### CLI Package
- **Process**: Manual publish following template updates
- **This guide**: Complete instructions included above

### Bridge Package
- **Process**: Manual publish required

## Future Improvements

Consider creating:
1. **Improved release automation** with proper version management
2. **Template update automation** to sync CLI template versions
3. **Version synchronization tools** for coordinated releases
4. **Release notes generation** from git commits/PRs

## Emergency Procedures

### Unpublish (Within 24 Hours)
```bash
# Only for recent publishes, use with extreme caution
npm unpublish @mew-protocol/[package-name]@[version]
```

### Deprecate Version
```bash
# For problematic versions that can't be unpublished
npm deprecate @mew-protocol/[package-name]@[version] "Reason for deprecation"
```

### Hotfix Release
1. Create hotfix branch from release tag
2. Make minimal fix
3. Bump patch version
4. Follow normal release process
5. Merge back to main

---

**Note**: This process ensures that all packages are published in the correct dependency order and that CLI templates reference the newly published package versions.