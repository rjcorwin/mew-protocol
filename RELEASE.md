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

#### Commit Template Updates
```bash
# Add template changes
git add cli/templates/*/package.json

# Commit template updates
git commit -m "Update CLI templates to use latest package versions

- Update @mew-protocol dependencies to match published versions
- Ensures new spaces use correct package versions

# Push template updates
git push origin main
```

### Phase 6: CLI Package

```bash
cd cli
npm publish --access public --otp=YOUR_OTP
```

## Git Workflow

### Commit Version Changes
After bumping versions but before publishing:

```bash
# Check what files were modified by version bumps
git status

# Add version changes
git add sdk/typescript-sdk/*/package.json  # Add all package.json changes
git add CHANGELOG.md  # If you updated it in Phase 1

# Commit the version bump
git commit -m "Bump package versions for release

- types: 0.2.0 → 0.2.1
- client: 0.2.0 → 0.2.1
- participant: 0.2.0 → 0.2.1
- agent: 0.4.1 → 0.4.2
- (list all changed packages)

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push the version bump commit
git push origin main
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

### 3. Post-Publish Verification Testing

Verify that published packages work correctly in a clean environment:

#### Create Test Environment
```bash
# Create temporary test directory
mkdir /tmp/mew-release-test
cd /tmp/mew-release-test

# Initialize test project
npm init -y
```

#### Test SDK Package Installation
```bash
# Install published SDK packages
npm install @mew-protocol/types@latest
npm install @mew-protocol/client@latest
npm install @mew-protocol/participant@latest
npm install @mew-protocol/agent@latest
npm install @mew-protocol/bridge@latest

# Verify installations
npm list @mew-protocol/types
npm list @mew-protocol/client
npm list @mew-protocol/participant
npm list @mew-protocol/agent
npm list @mew-protocol/bridge
```

#### Test CLI Package Installation
```bash
# Test global CLI installation
npm install -g @mew-protocol/cli@latest

# Verify CLI works
mew --version
mew --help

# Test CLI functionality
mew space init --template coder-agent test-space
cd test-space

# Verify template dependencies installed correctly
npm list @mew-protocol/types
npm list @mew-protocol/agent
npm list @mew-protocol/bridge
npm list @mew-protocol/client
npm list @mew-protocol/participant
```

#### Test Package Imports (Quick Smoke Test)
```bash
# Create simple test script
cat > test-imports.js << 'EOF'
try {
  // Test core type imports
  const types = require('@mew-protocol/types');
  console.log('✓ Types package imports successfully');

  // Test client import
  const { MEWClient } = require('@mew-protocol/client');
  console.log('✓ Client package imports successfully');

  // Test participant import
  const { MEWParticipant } = require('@mew-protocol/participant');
  console.log('✓ Participant package imports successfully');

  console.log('🎉 All published packages import successfully!');
} catch (error) {
  console.error('❌ Package import failed:', error.message);
  process.exit(1);
}
EOF

# Run import test
node test-imports.js
```

#### Test End-to-End Workflow
```bash
# Test complete workflow with published packages
cd test-space

# Start the space (this uses published CLI)
mew space up --port 8081 &
SPACE_PID=$!

# Wait for startup
sleep 5

# Test basic health check
curl -f http://localhost:8081/health

# Test basic message flow (if agents are running)
curl -X POST http://localhost:8081/participants/human/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer human-token" \
  -d '{"kind":"chat","payload":{"text":"Hello from published packages!"}}' || true

# Cleanup
mew space down
kill $SPACE_PID 2>/dev/null || true
```

#### Cleanup Test Environment
```bash
# Remove test directory
cd /
rm -rf /tmp/mew-release-test

# Uninstall global CLI if desired
# npm uninstall -g @mew-protocol/cli
```

#### Verification Checklist
- [ ] All packages install from npm without errors
- [ ] Package versions match what was published
- [ ] CLI global installation works
- [ ] CLI templates use correct package versions
- [ ] Basic package imports work without errors
- [ ] End-to-end space creation and startup works
- [ ] No dependency resolution conflicts

### 4. Finalize Changelogs
```bash
# Update changelog dates to actual release date
# Edit CHANGELOG.md or package-specific changelog files
# Change "2024-XX-XX" to actual release date

# Commit changelog updates
git add CHANGELOG.md  # or specific changelog files
git commit -m "Update changelogs for release"
git push origin main
```

### 5. Update Documentation
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